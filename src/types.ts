import { routes } from '@lodestar/api';
import * as capella from '@lodestar/types/capella';

export type PubKeyString = string;
export type Slot = number;
export type Bytes32 = string;

export type OptimisticUpdate = capella.LightClientOptimisticUpdate;
export type LightClientUpdate = capella.LightClientUpdate;
