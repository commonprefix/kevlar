import { AsyncOrSync } from 'ts-essentials';
import { LightClientUpdate } from '../types.js';

export interface IProver {
  getSyncUpdate(
    period: number,
    cacheCount: number,
  ): AsyncOrSync<LightClientUpdate>;
}
