import axios from 'axios';
import { IProver } from '../../clients/optimistic/iprover.js';
import { LightClientUpdate, Bytes32 } from '../../types.js';
import { HashesSSZ, CommitteeSSZ, LightClientUpdateSSZ } from '../../ssz.js';

// This prover can only be used by am optimistic client
export class LightOptimisticProver implements IProver {
  cachedHashes: Map<number, Uint8Array> = new Map();

  constructor(protected serverURL: string) {}

  async getCommittee(period: number | 'latest'): Promise<Uint8Array[]> {
    const res = await axios.get(`${this.serverURL}/sync-committee/${period}`, {
      responseType: 'arraybuffer',
    });
    return CommitteeSSZ.deserialize(res.data);
  }

  async getSyncUpdate(period: number): Promise<LightClientUpdate> {
    const res = await axios.get(`${this.serverURL}/sync-committee/${period}`, {
      responseType: 'arraybuffer',
    });
    return LightClientUpdateSSZ.deserialize(res.data);
  }

  async _getHashes(startPeriod: number, count: number): Promise<Uint8Array[]> {
    const res = await axios.get(
      `${this.serverURL}/sync-committee/hashes?startPeriod=${startPeriod}&maxCount=${count}`,
      { responseType: 'arraybuffer' },
    );
    return HashesSSZ.deserialize(res.data);
  }

  async getCommitteeHash(
    period: number,
    currentPeriod: number,
    cacheCount: number,
  ): Promise<Uint8Array> {
    const _count = Math.min(currentPeriod - period + 1, cacheCount);
    if (!this.cachedHashes.has(period)) {
      const vals = await this._getHashes(period, _count);
      for (let i = 0; i < _count; i++) {
        this.cachedHashes.set(period + i, vals[i]);
      }
    }
    return this.cachedHashes.get(period)!;
  }
}
