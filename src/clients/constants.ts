export const BEACON_SYNC_COMMITTEE_SIZE = 512;
export const BEACON_SYNC_SUPER_MAJORITY = Math.ceil(
  (BEACON_SYNC_COMMITTEE_SIZE * 2) / 3,
);

// These are the rough numbers from benchmark experiments
export const DEFAULT_BATCH_SIZE = 200;
export const DEFAULT_TREE_DEGREE = 200;