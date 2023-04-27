import {
  ContainerType,
  VectorCompositeType,
  ByteVectorType,
  BooleanType,
  UintNumberType,
  ListCompositeType,
} from '@chainsafe/ssz';
import * as capella from '@lodestar/types/capella';
import { BEACON_SYNC_COMMITTEE_SIZE } from './constants.js';

const MAX_BATCHSIZE = 10000;

export const LightClientUpdateSSZ = capella.ssz.LightClientUpdate;
export const LightClientUpdatesSSZ = new ListCompositeType(
  LightClientUpdateSSZ as any,
  MAX_BATCHSIZE,
);

export const CommitteeSSZ = new VectorCompositeType(
  new ByteVectorType(48),
  BEACON_SYNC_COMMITTEE_SIZE,
);

const HashSSZ = new ByteVectorType(32);
export const HashesSSZ = new ListCompositeType(HashSSZ, MAX_BATCHSIZE);
