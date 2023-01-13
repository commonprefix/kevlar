import { routes } from '@lodestar/api';
import * as altair from '@lodestar/types/altair';

export type PubKeyString = string;
export type Slot = number;
export type Bytes32 = string;

export type OptimisticUpdate = altair.LightClientOptimisticUpdate;
export type LightClientUpdate = altair.LightClientUpdate;
