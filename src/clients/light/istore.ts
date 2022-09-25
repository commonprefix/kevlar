import { AsyncOrSync } from 'ts-essentials';
import { LightClientUpdate } from '../../types';

export interface IStore {
  addUpdate(period: number, update: LightClientUpdate): AsyncOrSync<void>;
}
