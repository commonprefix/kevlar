import { BEACON_SYNC_COMMITTEE_SIZE } from '../constants.js';

export const BEACON_SYNC_SUPER_MAJORITY = Math.ceil(
  (BEACON_SYNC_COMMITTEE_SIZE * 2) / 3,
);

// These are the rough numbers from benchmark experiments
export const DEFAULT_BATCH_SIZE = 200;
export const DEFAULT_TREE_DEGREE = 200;

export const POLLING_DELAY = 13 * 1000; //13s (slightly higher than the slot time)
