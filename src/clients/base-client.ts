import * as altair from '@lodestar/types/altair';
import * as phase0 from '@lodestar/types/phase0';
import { digest } from '@chainsafe/as-sha256';
import { IBeaconConfig } from '@lodestar/config';
import { PublicKey } from '@chainsafe/bls/blst-native';
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
import { BEACON_SYNC_SUPER_MAJORITY } from './constants';
import { isCommitteeSame, concatUint8Array } from '../utils';
import { ClientConfig, OptimisticUpdate, LightClientUpdate } from './types';

export abstract class BaseClient {
  genesisCommittee: Uint8Array[];
  genesisPeriod: number;
  genesisTime: number;
  chainConfig: IBeaconConfig;

  constructor(config: ClientConfig) {
    this.genesisCommittee = config.genesis.committee.map(pk =>
      fromHexString(pk),
    );
    this.genesisPeriod = computeSyncPeriodAtSlot(config.genesis.slot);
    this.genesisTime = config.genesis.time;
    this.chainConfig = config.chainConfig;
  }

  protected getCommitteeHash(committee: Uint8Array[]): Uint8Array {
    return digest(concatUint8Array(committee));
  }

  private deserializePubkeys(pubkeys: Uint8Array[]): PublicKey[] {
    return pubkeys.map(pk => PublicKey.fromBytes(pk));
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
      aggregatePubkey: PublicKey.aggregate(pubkeys),
    };
  }

  protected syncUpdateVerifyGetCommittee(
    prevCommittee: Uint8Array[],
    update: LightClientUpdate,
  ): false | Uint8Array[] {
    const prevCommitteeFast = this.deserializeSyncCommittee(prevCommittee);
    try {
      // check if the update has valid signatures
      assertValidLightClientUpdate(this.chainConfig, prevCommitteeFast, update);
      return update.nextSyncCommittee.pubkeys;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  protected syncUpdateVerify(
    prevCommittee: Uint8Array[],
    currentCommittee: Uint8Array[],
    update: LightClientUpdate,
  ): boolean {
    // check if update.nextSyncCommittee is currentCommittee
    const isUpdateValid = isCommitteeSame(
      update.nextSyncCommittee.pubkeys,
      currentCommittee,
    );
    if (!isUpdateValid) return false;

    const prevCommitteeFast = this.deserializeSyncCommittee(prevCommittee);
    try {
      // check if the update has valid signatures
      assertValidLightClientUpdate(this.chainConfig, prevCommitteeFast, update);
      return true;
    } catch (e) {
      return false;
    }
  }

  optimisticUpdateFromJSON(update: any): OptimisticUpdate {
    return {
      syncAggregate: altair.ssz.SyncAggregate.fromJson(update.sync_aggregate),
      attestedHeader: phase0.ssz.BeaconBlockHeader.fromJson(
        update.attested_header,
      ),
    };
  }

  optimisticUpdateVerify(
    committee: Uint8Array[],
    update: OptimisticUpdate,
  ): boolean {
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
      assertValidSignedHeader(
        this.chainConfig,
        committeeFast,
        syncAggregate,
        headerBlockRoot,
        header.slot,
      );
    } catch (e) {
      return false;
    }

    const participation =
      syncAggregate.syncCommitteeBits.getTrueBitIndexes().length;
    if (participation < BEACON_SYNC_SUPER_MAJORITY) {
      return false;
    }
    return true;
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
