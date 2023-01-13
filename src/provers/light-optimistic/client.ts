import { handleGETRequest } from '../../utils.js';
import { IProver } from '../../clients/optimistic/iprover.js';
import { LightClientUpdate, Bytes32 } from '../../types.js';
import { HashesSSZ, CommitteeSSZ, LightClientUpdateSSZ } from '../../ssz.js';

// This prover can only be used by am optimistic client
export class LightOptimisticProver implements IProver {
  cachedHashes: Map<number, Uint8Array> = new Map();
  cache: Map<string, any> = new Map();

  constructor(protected serverURL: string) {}

  async getCommittee(period: number | 'latest'): Promise<Uint8Array[]> {
    let res;
    try {
      res = this.cache.get(`/sync-committee/${period}`) || await handleGETRequest(`${this.serverURL}/sync-committee/${period}`);
      this.cache.set(`/sync-committee/${period}`, res);
    } catch (error) {
      console.error(error);
    }
    return CommitteeSSZ.deserialize(new Uint8Array(res));
  }

  async getSyncUpdate(period: number): Promise<LightClientUpdate> {
    let res;
    try {
      res = this.cache.get(`/sync-committee/${period}`) || await handleGETRequest(`${this.serverURL}/sync-committee/${period}`);
      this.cache.set(`/sync-committee/${period}`, res);
    } catch (error) {
      console.error(error);
    }
    return LightClientUpdateSSZ.deserialize(new Uint8Array(res));
  }

  async _getHashes(startPeriod: number, count: number): Promise<Uint8Array[]> {
    let res;
    try {
      res = this.cache.get(`/sync-committee/hashes?startPeriod=${startPeriod}&maxCount=${count}`) || await handleGETRequest(`${this.serverURL}/sync-committee/hashes?startPeriod=${startPeriod}&maxCount=${count}`);
      this.cache.set(`/sync-committee/hashes?startPeriod=${startPeriod}&maxCount=${count}`, res);
    } catch (error) {
      console.error(error);
    }
    return HashesSSZ.deserialize(new Uint8Array(res));
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
