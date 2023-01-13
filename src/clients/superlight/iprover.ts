import { AsyncOrSync } from 'ts-essentials';
import { Peaks } from './merkle-mountain-range.js';
import { LightClientUpdate } from '../../types.js';

export interface IProver {
  getLeafWithProof(period: number | 'latest'): AsyncOrSync<{
    syncCommittee: Uint8Array[];
    rootHash: Uint8Array;
    proof: Uint8Array[][];
  }>;

  getMMRInfo(): AsyncOrSync<{
    rootHash: Uint8Array;
    peaks: Peaks;
  }>;

  getNode(
    treeRoot: Uint8Array,
    nodeHash: Uint8Array,
  ): AsyncOrSync<{ isLeaf: boolean; children?: Uint8Array[] }>;

  getSyncUpdate(
    period: number,
    cacheCount: number,
  ): AsyncOrSync<LightClientUpdate>;
}
