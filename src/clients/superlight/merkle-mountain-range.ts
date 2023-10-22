import { MerkleTree, HashFunction } from './merkle-tree.js';
import { logFloor, concatUint8Array, isUint8ArrayEq } from '../../utils.js';
import { toHexString } from '@chainsafe/ssz';

export class MerkleMountainRange {
  protected merkleTrees: MerkleTree[] = [];
  protected lookupMap: { [rootHex: string]: MerkleTree } = {};
  protected rootHash: Uint8Array;

  constructor(protected hashFn: HashFunction, protected n: number = 2) {}

  init(leaves: Uint8Array[]) {
    const l = leaves.length;
    if (!l) throw new Error(`there should be at least one leaf`);

    let leftL = l;
    const rootHashes = [];
    while (leftL > 0) {
      const merkleTree = new MerkleTree(this.hashFn, this.n);
      const possibleTreeL = this.n ** logFloor(leftL, this.n);
      merkleTree.init(leaves.slice(l - leftL, l - leftL + possibleTreeL));
      const root = merkleTree.getRoot();
      this.merkleTrees.push(merkleTree);
      rootHashes.push(root.hash);
      this.lookupMap[toHexString(root.hash)] = merkleTree;
      leftL -= possibleTreeL;
    }
    this.rootHash = this.hashFn(concatUint8Array(rootHashes));
  }

  getTree(treeRoot: Uint8Array) {
    return this.lookupMap[toHexString(treeRoot)];
  }

  getRootHash() {
    return this.rootHash;
  }

  getPeaks(): Peaks {
    return this.merkleTrees.map(t => ({
      rootHash: t.getRoot().hash,
      size: t.size,
    }));
  }

  generateProof(index: number): {
    rootHash: Uint8Array;
    proof: Uint8Array[][];
  } {
    let i = index;
    for (let t of this.merkleTrees) {
      if (t.size <= i) i -= t.size;
      else {
        return {
          rootHash: t.getRoot().hash,
          proof: t.generateProof(i),
        };
      }
    }
    throw new Error('index out of range');
  }
}

export type Peak = { rootHash: Uint8Array; size: number };
export type Peaks = Peak[];

export class MerkleMountainVerify {
  constructor(protected hashFn: HashFunction, protected n: number = 2) {}

  verify(root: Uint8Array, peaks: Peaks, size: number): boolean {
    let leftL = size;
    let i = 0;
    while (leftL > 0) {
      const possibleTreeL = this.n ** logFloor(leftL, this.n);
      if (peaks[i++].size !== possibleTreeL) return false;
      leftL -= possibleTreeL;
    }

    if (i !== peaks.length) return false;
    return isUint8ArrayEq(
      root,
      this.hashFn(concatUint8Array(peaks.map(i => i.rootHash))),
    );
  }

  getPeakAndIndex(peaks: Peaks, index: number): { peak: Peak; index: number } {
    let sum = 0;
    for (let peak of peaks) {
      if (sum + peak.size > index) return { peak, index: index - sum };
      else sum += peak.size;
    }
    throw new Error('index should not be greater than the tree size');
  }
}
