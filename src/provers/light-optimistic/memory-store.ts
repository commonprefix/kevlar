import { digest } from '@chainsafe/as-sha256';
import { IStore } from '../../clients/light/istore.js';
import { LightClientUpdate } from '../../types.js';
import { LightClientUpdateSSZ, CommitteeSSZ, HashesSSZ } from '../../ssz.js';
import { concatUint8Array } from '../../utils.js';

export class MemoryStore implements IStore {
  store: {
    [period: number]: {
      update: Uint8Array;
      nextCommittee: Uint8Array;
      nextCommitteeHash: Uint8Array;
    };
  } = {};

  addUpdate(period: number, update: LightClientUpdate) {
    this.store[period] = {
      update: LightClientUpdateSSZ.serialize(update),
      nextCommittee: CommitteeSSZ.serialize(update.nextSyncCommittee.pubkeys),
      nextCommitteeHash: digest(
        concatUint8Array(update.nextSyncCommittee.pubkeys),
      ),
    };
  }

  getUpdate(period: number): Uint8Array {
    if (period in this.store) return this.store[period].update;
    throw new Error(`update unavailable for period ${period}`);
  }

  getCommittee(period: number): Uint8Array {
    if (period < 1)
      throw new Error('committee not unavailable for period less than 1');
    const predPeriod = period - 1;
    if (predPeriod in this.store) return this.store[predPeriod].nextCommittee;
    throw new Error(`committee unavailable for period ${predPeriod}`);
  }

  getCommitteeHashes(period: number, count: number): Uint8Array {
    if (period < 1)
      throw new Error('committee not unavailable for period less than 1');
    const predPeriod = period - 1;

    const hashes = new Array(count).fill(0).map((_, i) => {
      const p = predPeriod + i;
      if (p in this.store) return this.store[p].nextCommitteeHash;
      throw new Error(`committee unavailable for period ${p}`);
    });

    return HashesSSZ.serialize(hashes);
  }
}
