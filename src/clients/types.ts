import { BeaconConfig } from '@lodestar/config';
import { PubKeyString, Slot } from '../types.js';

export type GenesisData = {
  committee: PubKeyString[];
  slot: Slot;
  time: number;
};

export type ClientConfig = {
  genesis: GenesisData;
  chainConfig: BeaconConfig;
  // treeDegree in case of Superlight and batchSize in case of Light and Optimistic
  n?: number;
};

export type ProverInfo = {
  index: number;
  syncCommittee: Uint8Array[];
};

export type ExecutionInfo = {
  blockhash: string;
  blockNumber: bigint;
};

export type VerifyWithReason =
  | { correct: true }
  | { correct: false; reason: string };
