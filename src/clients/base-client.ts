import { AsyncOrSync } from 'ts-essentials';
import axios from 'axios';
import * as altair from '@lodestar/types/altair';
import * as phase0 from '@lodestar/types/phase0';
import * as bellatrix from '@lodestar/types/bellatrix';
import { digest } from '@chainsafe/as-sha256';
import { IBeaconConfig } from '@lodestar/config';
import type { PublicKey } from '@chainsafe/bls/types';
import bls from '@chainsafe/bls/switchable';
import { ListCompositeType, fromHexString, toHexString } from '@chainsafe/ssz';
import {
  computeSyncPeriodAtSlot,
  getCurrentSlot,
} from '@lodestar/light-client/utils';
import {
  assertValidLightClientUpdate,
  assertValidSignedHeader,
} from '@lodestar/light-client/validation';
import { SyncCommitteeFast } from '@lodestar/light-client/types';
import { BEACON_SYNC_SUPER_MAJORITY, POLLING_DELAY } from './constants.js';
import { isCommitteeSame, concatUint8Array, smallHexStr } from '../utils.js';
import {
  ClientConfig,
  ProverInfo,
  ExecutionInfo,
  VerifyWithReason,
} from './types.js';
import { Bytes32, OptimisticUpdate, LightClientUpdate } from '../types.js';
import { Console } from 'console';

export abstract class BaseClient {
  genesisCommittee: Uint8Array[];
  genesisPeriod: number;
  genesisTime: number;
  chainConfig: IBeaconConfig;

  latestCommittee: Uint8Array[];
  latestPeriod: number = -1;
  latestBlockHash: string;

  constructor(config: ClientConfig, protected beaconChainAPIURL: string) {
    this.genesisCommittee = config.genesis.committee.map(pk =>
      fromHexString(pk),
    );
    this.genesisPeriod = computeSyncPeriodAtSlot(config.genesis.slot);
    this.genesisTime = config.genesis.time;
    this.chainConfig = config.chainConfig;
  }

  protected abstract syncFromGenesis(): Promise<ProverInfo[]>;

  public async sync(): Promise<void> {
    const currentPeriod = this.getCurrentPeriod();
    if (currentPeriod <= this.latestPeriod) {return }
    const proverInfos = await this.syncFromGenesis();
    const proverInfosAsHex = proverInfos[0].syncCommittee.map(pk => smallHexStr(pk))
    console.log('PROVERS:', proverInfosAsHex)

    if (proverInfos.length === 0) throw new Error("Failed to retrieve proverInfos");
    this.latestCommittee = proverInfos[0].syncCommittee;
    this.latestPeriod = currentPeriod;
    // console.log('proverInfos[0].syncCommittee',proverInfos[0].syncCommittee)
  }

  public async getNextValidExecutionInfo(
    retry: number = 10,
  ): Promise<ExecutionInfo> {
    if (retry === 0)
      throw new Error(
        'no valid execution payload found in the given retry limit',
      );
    const ei = await this.getLatestExecution();
    if (ei) return ei;
    // delay for the next slot
    await new Promise(resolve => setTimeout(resolve, POLLING_DELAY));
    return this.getNextValidExecutionInfo(retry - 1);
  }

  public get isSynced() {
    return this.latestPeriod === this.getCurrentPeriod();
  }

  // FIRST THE ENGINE SUBSCRIBES TO THE EXECUTION
  public async subscribe(callback: (ei: ExecutionInfo) => AsyncOrSync<void>) {
    // NEXT THE ENGINE TRIES TO SINK
    // AFTER 12 SECONDS IT REPEATS AFTER OTHER LOGIC
    setInterval(async () => {
      try {
        await this.sync();
        console.log('⏳ Optimistic Update - Verifying execution...')
        const ei = await this.getLatestExecution();
        if (ei && ei.blockhash !== this.latestBlockHash) {
          this.latestBlockHash = ei.blockhash;
          return await callback(ei);
        }
      } catch (e) {
        console.error(e);
      }
    }, POLLING_DELAY);
  }

  protected async getLatestExecution(): Promise<ExecutionInfo | null> {
    const { data } = await axios.get(`${this.beaconChainAPIURL}/eth/v1/beacon/light_client/optimistic_update`);
    const opUp = this.optimisticUpdateFromJSON(data.data);
    const verify = await this.optimisticUpdateVerify(this.latestCommittee, opUp);
    if (!verify.correct) throw new Error(`🚫 Invalid Optimistic Update: ${verify.reason}`);
    console.log(`✅ Optimistic Update - Slot ${data.data.attested_header.slot}, Header ${data.data.attested_header.body_root} VERIFIED !\n`);
    return this.getExecutionFromBlockRoot(data.data.attested_header.slot, data.data.attested_header.body_root);
  }
// 
  protected async getExecutionFromBlockRoot(
    slot: bigint,
    expectedBlockRoot: Bytes32,
  ): Promise<ExecutionInfo> {
    const { data: { data: { message: { body: blockJSON } } } } = await axios.get(`${this.beaconChainAPIURL}/eth/v2/beacon/blocks/${slot}`);
    const block = bellatrix.ssz.BeaconBlockBody.fromJson(blockJSON);
    const blockRoot = toHexString(bellatrix.ssz.BeaconBlockBody.hashTreeRoot(block));
    if (blockRoot !== expectedBlockRoot) throw Error(`block provided by the beacon chain api doesn't match the expected block root`);

    return {
      blockhash: blockJSON.execution_payload.block_hash,
      blockNumber: blockJSON.execution_payload.block_number,
    };
  }

  protected getCommitteeHash(committee: Uint8Array[]): Uint8Array {
    return digest(concatUint8Array(committee));
  }

  private deserializePubkeys(pubkeys: Uint8Array[]): PublicKey[] {
    return pubkeys.map(pk => bls.PublicKey.fromBytes(pk));
  }

  // This function is ovveride of the original function in
  // @chainsafe/lodestar-light-client/lib/utils/utils
  // this was required as the light client doesn't have access
  // to aggregated signatures
  protected async syncUpdateVerifyGetCommittee(
    prevCommittee: Uint8Array[],
    period: number,
    update: LightClientUpdate,
    ): Promise<false | Uint8Array[]> {
    try {
    // check if the update has valid signatures
    const prevCommitteeFast = {
    pubkeys: this.deserializePubkeys(prevCommittee),
    aggregatePubkey: bls.PublicKey.aggregate(this.deserializePubkeys(prevCommittee))
    };
    await assertValidLightClientUpdate(
    this.chainConfig,
    prevCommitteeFast,
    update,
    );
    } catch (e) {
    console.error(e);
    return false;
    }
    
    const updatePeriod = computeSyncPeriodAtSlot(update.attestedHeader.slot);
  if (period !== updatePeriod) {
    console.error(`Expected update with period ${period}, but recieved ${updatePeriod}`);
    return false;
  }
  return update.nextSyncCommittee.pubkeys;
  }

  protected async syncUpdateVerify(prevCommittee: Uint8Array[], currentCommittee: Uint8Array[], period: number, update: LightClientUpdate): Promise<boolean> {
    const nextCommittee = await this.syncUpdateVerifyGetCommittee(prevCommittee, period, update);
    if (nextCommittee) {
        return isCommitteeSame(nextCommittee, currentCommittee);
    }
    return false;
  }

  optimisticUpdateFromJSON(update: any): OptimisticUpdate {
    return altair.ssz.LightClientOptimisticUpdate.fromJson(update);
  }

  async optimisticUpdateVerify(
    committee: Uint8Array[],
    update: OptimisticUpdate,
  ): Promise<VerifyWithReason> {
    const { attestedHeader: header, syncAggregate } = update;
    const headerBlockRoot = phase0.ssz.BeaconBlockHeader.hashTreeRoot(header);
    try {
      const pubkeys = this.deserializePubkeys(committee);
      const aggregatePubkey = bls.PublicKey.aggregate(pubkeys);
      const committeeFast = { pubkeys, aggregatePubkey };
      await assertValidSignedHeader(
        this.chainConfig,
        committeeFast,
        syncAggregate,
        headerBlockRoot,
        header.slot,
      );
    } catch (e) {
      return { correct: false, reason: 'invalid signatures' };
    }

    const participation = syncAggregate.syncCommitteeBits.getTrueBitIndexes().length;
    if (participation < BEACON_SYNC_SUPER_MAJORITY) {
      return { correct: false, reason: 'insufficient signatures' };
    }
      return { correct: true };
  }
  
  getCurrentPeriod(): number {
    return computeSyncPeriodAtSlot(
      getCurrentSlot(this.chainConfig, this.genesisTime),
    );
  }
}
