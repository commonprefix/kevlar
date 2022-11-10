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
import { isCommitteeSame, concatUint8Array } from '../utils.js';
import {
  ClientConfig,
  ProverInfo,
  ExecutionInfo,
  VerifyWithReason,
} from './types.js';
import { Bytes32, OptimisticUpdate, LightClientUpdate } from '../types.js';

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

  public async sync() {
    // TODO: this always sync's from Genesis but you can sync
    // from the last verified sync committee
    const currentPeriod = this.getCurrentPeriod();
    if (currentPeriod > this.latestPeriod) {
      const proverInfos = await this.syncFromGenesis();
      // TODO: currently we simply take the first honest prover,
      // but the client might need other provers if the first one
      // doesn't respond
      this.latestCommittee = proverInfos[0].syncCommittee;
      this.latestPeriod = currentPeriod;
    }
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

  public async subscribe(callback: (ei: ExecutionInfo) => AsyncOrSync<void>) {
    setInterval(async () => {
      try {
        await this.sync();
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
    const res = await axios.get(
      `${this.beaconChainAPIURL}/eth/v1/beacon/light_client/optimistic_update`,
    );
    const updateJSON = res.data.data;
    const update = this.optimisticUpdateFromJSON(updateJSON);
    const verify = await this.optimisticUpdateVerify(this.latestCommittee, update);
    // TODO: check the update agains the latest sync commttee
    if (!verify.correct) {
      console.error(`Invalid Optimistic Update: ${verify.reason}`);
      return null;
    }
    console.log(
      `Optimistic update verified for slot ${updateJSON.attested_header.slot}`,
    );
    return this.getExecutionFromBlockRoot(
      updateJSON.attested_header.slot,
      updateJSON.attested_header.body_root,
    );
  }

  protected async getExecutionFromBlockRoot(
    slot: bigint,
    expectedBlockRoot: Bytes32,
  ): Promise<ExecutionInfo> {
    const res = await axios.get(
      `${this.beaconChainAPIURL}/eth/v2/beacon/blocks/${slot}`,
    );
    const blockJSON = res.data.data.message.body;
    const block = bellatrix.ssz.BeaconBlockBody.fromJson(blockJSON);
    const blockRoot = toHexString(
      bellatrix.ssz.BeaconBlockBody.hashTreeRoot(block),
    );
    if (blockRoot !== expectedBlockRoot) {
      throw Error(
        `block provided by the beacon chain api doesn't match the expected block root`,
      );
    }

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
  private deserializeSyncCommittee(
    syncCommittee: Uint8Array[],
  ): SyncCommitteeFast {
    const pubkeys = this.deserializePubkeys(syncCommittee);
    return {
      pubkeys,
      aggregatePubkey: bls.PublicKey.aggregate(pubkeys),
    };
  }

  protected async syncUpdateVerifyGetCommittee(
    prevCommittee: Uint8Array[],
    update: LightClientUpdate,
  ): Promise<false | Uint8Array[]> {
    const prevCommitteeFast = this.deserializeSyncCommittee(prevCommittee);
    try {
      // check if the update has valid signatures
      await assertValidLightClientUpdate(this.chainConfig, prevCommitteeFast, update);
      return update.nextSyncCommittee.pubkeys;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  protected async syncUpdateVerify(
    prevCommittee: Uint8Array[],
    currentCommittee: Uint8Array[],
    update: LightClientUpdate,
  ): Promise<boolean> {
    // check if update.nextSyncCommittee is currentCommittee
    const isUpdateValid = isCommitteeSame(
      update.nextSyncCommittee.pubkeys,
      currentCommittee,
    );
    if (!isUpdateValid) return false;

    const prevCommitteeFast = this.deserializeSyncCommittee(prevCommittee);
    try {
      // check if the update has valid signatures
      await assertValidLightClientUpdate(this.chainConfig, prevCommitteeFast, update);
      return true;
    } catch (e) {
      return false;
    }
  }

  optimisticUpdateFromJSON(update: any): OptimisticUpdate {
    return altair.ssz.LightClientOptimisticUpdate.fromJson(update);
  }

  async optimisticUpdateVerify(
    committee: Uint8Array[],
    update: OptimisticUpdate,
  ): Promise<VerifyWithReason> {
    const { attestedHeader: header, syncAggregate } = update;

    // TODO: fix this
    // Prevent registering updates for slots to far ahead
    // if (header.slot > slotWithFutureTolerance(this.config, this.genesisTime, MAX_CLOCK_DISPARITY_SEC)) {
    //   throw Error(`header.slot ${header.slot} is too far in the future, currentSlot: ${this.currentSlot}`);
    // }

    const period = computeSyncPeriodAtSlot(header.slot);
    const headerBlockRoot = phase0.ssz.BeaconBlockHeader.hashTreeRoot(header);
    const headerBlockRootHex = toHexString(headerBlockRoot);
    const committeeFast = this.deserializeSyncCommittee(committee);
    try {
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

    const participation =
      syncAggregate.syncCommitteeBits.getTrueBitIndexes().length;
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

  // updatesFromBytes(
  //   bytesUpdates: Uint8Array,
  //   maxItems: number,
  // ): LightClientUpdate[] {
  //   // TODO: check the reason for type error
  //   return new ListCompositeType(
  //     altair.ssz.LightClientUpdate as any,
  //     maxItems,
  //   ).deserialize(bytesUpdates);
  // }
}
