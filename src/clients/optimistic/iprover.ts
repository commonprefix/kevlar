import { AsyncOrSync } from 'ts-essentials';
import { LightClientUpdate } from '../types.js';

export interface IProver {
  getLeaf(period: number | 'latest'): AsyncOrSync<Uint8Array[]>;

  getLeafHash(period: number, cacheCount: number): AsyncOrSync<Uint8Array>;

  getSyncUpdate(
    period: number,
    cacheCount: number,
  ): AsyncOrSync<LightClientUpdate>;
}
