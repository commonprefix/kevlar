import { AsyncOrSync } from 'ts-essentials';
import { LightClientUpdate } from '../../types.js';

export interface IProver {
  getCommittee(period: number | 'latest'): AsyncOrSync<Uint8Array[]>;

  getCommitteeHash(
    period: number,
    currentPeriod: number,
    count: number,
  ): AsyncOrSync<Uint8Array>;

  getSyncUpdate(period: number): AsyncOrSync<LightClientUpdate>;
}
