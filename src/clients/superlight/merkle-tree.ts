import { logFloor, concatUint8Array, isUint8ArrayEq } from '../../utils.js';
import { toHexString } from '@chainsafe/ssz';

export type Node = {
  hash: Uint8Array;
  parent?: Node;
  children?: Node[];
  isRoot: boolean;
  isLeaf: boolean;
};

export type HashFunction = (data: Uint8Array) => Uint8Array;

export class MerkleTree {
  protected root: Node;
  protected lookupMap: { [hashHex: string]: Node } = {};
  protected leaves: Node[] = [];

  constructor(protected hashFn: HashFunction, protected n: number = 2) {}

  init(leaves: Uint8Array[]) {
    const l = leaves.length;
    if (!l) throw new Error(`there should be atleast one leaf`);

    if (l !== this.n ** logFloor(l, this.n))
      throw new Error(`leaves should be exact power of n(${this.n})`);

    let lastLayer: Node[] = leaves.map(l => ({
      hash: l,
      isLeaf: true,
      isRoot: false,
    }));
    lastLayer.forEach(n => (this.lookupMap[toHexString(n.hash)] = n));
    this.leaves = lastLayer;

    while (lastLayer.length > 1) {
      const nextLayerSize = lastLayer.length / this.n;
      const nextLayer: Node[] = [];
      for (let i = 0; i < nextLayerSize; i++) {
        const children = lastLayer.slice(i * this.n, (i + 1) * this.n);
        const hash = this.hashFn(concatUint8Array(children.map(c => c.hash)));
        const n: Node = {
          hash,
          children,
          isRoot: false,
          isLeaf: false,
        };
        this.lookupMap[toHexString(hash)] = n;
        nextLayer.push(n);
        children.forEach(c => (c.parent = n));
      }
      lastLayer = nextLayer;
    }

    lastLayer[0].isRoot = true;
    this.root = lastLayer[0];
  }

  getNode(hash: Uint8Array): Node {
    return this.lookupMap[toHexString(hash)];
  }

  generateProof(index: number): Uint8Array[][] {
    let result = [];
    let curr = this.leaves[index];
    if (!curr) throw new Error('index out of range');
    while (!curr.isRoot && curr.parent) {
      const pos = index % this.n;
      const siblings = curr.parent.children!.filter((_, i) => i !== pos);
      result.push(siblings.map(s => s.hash));
      curr = curr.parent;
      index = Math.floor(index / this.n);
    }
    return result;
  }

  get size() {
    return this.leaves.length;
  }

  getRoot(dept: number = 0) {
    let root = this.root;
    for (let i = 0; i < dept; i++) {
      if (!root.children) throw new Error('dept too big for the tree');
      root = root.children[0];
    }
    return root;
  }
}

export class MerkleVerify {
  constructor(protected hashFn: HashFunction, protected n: number = 2) {}

  verify(
    leaf: Uint8Array,
    index: number,
    root: Uint8Array,
    proof: Uint8Array[][],
  ): boolean {
    let value = leaf;
    for (let i = 0; i < proof.length; i++) {
      const pos = Math.floor(index / this.n ** i) % this.n;
      // copy proof to avoid modification of original array
      const children = [...proof[i]];
      // insert the value at the correct position
      children.splice(pos, 0, value);
      value = this.hashFn(concatUint8Array(children));
    }
    return isUint8ArrayEq(value, root);
  }
}
