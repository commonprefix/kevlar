import { digest } from '@chainsafe/as-sha256';
import { IStore } from '../../clients/light/istore.js';
import { LightClientUpdate } from '../../types.js';
import { LightClientUpdateSSZ, CommitteeSSZ, HashesSSZ } from '../../ssz.js';
import { concatUint8Array } from '../../utils.js';

export class MemoryStore implements IStore {
  store = new Map<number, {
    update: Uint8Array;
    nextCommittee: Uint8Array;
    nextCommitteeHash: Uint8Array;
  }>();
  latestPeriod: number = 0;

  addUpdate(period: number, update: LightClientUpdate) {
    this.latestPeriod = period;
    this.store.set(period, {
      update: LightClientUpdateSSZ.serialize(update),
      nextCommittee: CommitteeSSZ.serialize(update.nextSyncCommittee.pubkeys),
      nextCommitteeHash: digest(concatUint8Array(update.nextSyncCommittee.pubkeys)),
    });
  }

  getUpdate(period: number): Uint8Array {
    const data = this.store.get(period);
    if (!data) throw new Error(`update unavailable for period ${period}`);
    return data.update;
  }

  getCommittee(period: number): Uint8Array {
    if (period < 1) throw new Error('committee not unavailable for period less than 1');
    if (period > this.latestPeriod) throw new Error(`committee unavailable for period ${period}`);
    return this.store.get(period - 1)!.nextCommittee;
  }

  getCommitteeHashes(period: number, count: number): Uint8Array {
    if (period < 1) throw new Error('committee not unavailable for period less than 1');
    const hashes = new Array(count).fill(0).map((_, i) => {
      const p = period + i;
      if (p > this.latestPeriod) throw new Error(`committee unavailable for period ${p}`);
      return this.store.get(p)!.nextCommitteeHash;
    });
    return HashesSSZ.serialize(hashes);
  }
}
