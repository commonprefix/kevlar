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
// import { guessAbiEncodedData } from './decoder';
// import {EthereumBlockDecoder} from './EthereumBlockDecoder';
type UpdateInfo = {
  ei: ExecutionInfo;
  blockhash: string;
  blockNumber: number | bigint;
  blockData: unknown;
}
export abstract class BaseClient {
  genesisCommittee: Uint8Array[];
  genesisPeriod: number;
  genesisTime: number;
  chainConfig: IBeaconConfig;

  latestCommittee: Uint8Array[];
  latestPeriod: number = -1;
  latestBlockHash: string;
  // private ethereumBlockDecoder: EthereumBlockDecoder;

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
    const proverInfos =  await this.syncFromGenesis();
    // const proverInfosAsHex = proverInfos[0].syncCommittee.map(pk => smallHexStr(pk))
    // console.log('PROVERS:', proverInfosAsHex)

    if (proverInfos.length === 0) throw new Error("Failed to retrieve proverInfos");
    this.latestCommittee = proverInfos[0].syncCommittee;
    this.latestPeriod = currentPeriod;
    // console.log('proverInfos[0].syncCommittee',proverInfos[0].syncCommittee)
  }

  public get isSynced() {
    return this.latestPeriod === this.getCurrentPeriod();
  }

  public async subscribe(callback: (ei: ExecutionInfo) => AsyncOrSync<void>) {
    let timeoutId: any;
    const checkUpdates = async () => {
        try {
            await this.sync();
            console.log('⏳ Optimistic Update - Verifying execution...')
            const ei = await this.getLatestExecution();
            if (callback) {
                await callback(ei);
            }
            timeoutId = setTimeout(checkUpdates, POLLING_DELAY);
        } catch (e) {
            console.error(e);
            timeoutId = setTimeout(checkUpdates, POLLING_DELAY);
        }
    };
    timeoutId = setTimeout(checkUpdates, POLLING_DELAY);
}

async verifyUpdate(update: Uint8Array): Promise<boolean> {
  assertValidLightClientUpdate(update, this.chainConfig);
  const updateData = LightClientUpdate.decode(update);
  assertValidSignedHeader(updateData.signedHeader, this.chainConfig);
  const {signedHeader, proof} = updateData;
  const {slot, committeeIndex, blockRoot} = signedHeader;
  const committee = this.getCurrentCommittee(slot, committeeIndex);
  const pubkey = committee[signedHeader.proposerIndex];
  return bls.verify(pubkey, digest(update), proof);
}

async extractNewCommittee(update: Uint8Array): Promise<Uint8Array[]> {
  const updateData = LightClientUpdate.decode(update);
  return updateData.newCommittee;
}

async compareCommittees(startCommittee: Uint8Array[], newCommittee: Uint8Array[]): Promise<boolean> {
  return isCommitteeSame(startCommittee, newCommittee);
}

getCurrentCommittee(slot: number, committeeIndex: number):Uint8Array[] {
    const period = computeSyncPeriodAtSlot(slot);
    const committee = this.genesisCommittee;
    for (let i = this.genesisPeriod; i < period; i++) {
      const update = await this.store.getUpdate(i);
      if (!update) {
        throw new Error(`Failed to retrieve update for period ${i}`);
      }
      const { newCommittee } = LightClientUpdate.decode(update);
      committee = newCommittee;
    }
    return committee;
  }

  getCurrentPeriod(): number {
    return computeSyncPeriodAtSlot(getCurrentSlot());
  }
}



