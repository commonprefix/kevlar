import { IBeaconConfig } from '@lodestar/config';
import * as altair from '@lodestar/types/altair';
import * as phase0 from '@lodestar/types/phase0';
import { routes } from '@lodestar/api';
import { PubKeyString, Slot } from '../types';

export type GenesisData = {
  committee: PubKeyString[];
  slot: Slot;
  time: number;
};

export type ClientConfig = {
  genesis: GenesisData;
  chainConfig: IBeaconConfig;
  // treeDegree in case of Superlight and batchSize in case of Light and Optimistic
  n?: number;
};

export type OptimisticUpdate = routes.events.LightclientOptimisticHeaderUpdate;
export type LightClientUpdate = altair.LightClientUpdate;
