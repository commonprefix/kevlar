import { handleGETRequest } from '../../utils.js';
import { LightClientUpdateSSZ } from '../../ssz.js';
import { IProver } from '../../clients/light/iprover.js';
import { LightClientUpdate } from '../../types.js';

// This prover can only be used by a light client
export class BeaconAPIProver implements IProver {
  cachedSyncUpdate: Map<number, LightClientUpdate> = new Map();

  constructor(protected serverURL: string) {}

  async _getSyncUpdates(
    startPeriod: number,
    maxCount: number,
  ): Promise<LightClientUpdate[]> {
    const res = await handleGETRequest(
      `${this.serverURL}/eth/v1/beacon/light_client/updates?start_period=${startPeriod}&count=${maxCount}`,
      false,
    );
    return res.map((u: any) => LightClientUpdateSSZ.fromJson(u.data));
  }

  async getSyncUpdate(
    period: number,
    currentPeriod: number,
    cacheCount: number,
  ): Promise<LightClientUpdate> {
    const _cacheCount = Math.min(currentPeriod - period + 1, cacheCount);
    if (!this.cachedSyncUpdate.has(period)) {
      const vals = await this._getSyncUpdates(period, _cacheCount);
      for (let i = 0; i < _cacheCount; i++) {
        this.cachedSyncUpdate.set(period + i, vals[i]);
      }
    }
    return this.cachedSyncUpdate.get(period)!;
  }
}
