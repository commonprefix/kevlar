import { toHexString, fromHexString } from '@chainsafe/ssz';
import bls from '@chainsafe/bls/switchable';
import _ from 'lodash';
import axios from 'axios';
import LRU from 'lru-cache';

const cache = new LRU({ max: 500 });
// console.log('CACHE',cache)

export async function handleGETRequest(
  url: string,
  isBuffer: boolean = true,
  retry: number = 3,
): Promise<any> {
  if (retry < 0) {
    throw Error(`GET request failed: ${url}`);
  }

  // Check if the data is already in the cache
  const cachedData = cache.get(url);
  if (cachedData) {
    console.log('cachedData 1', cachedData)
    return cachedData;
  }

  try {
    const { data } = await axios.get(
      url,
      isBuffer ? { responseType: 'arraybuffer' } : undefined,
    );
    cache.set(url, data);
    // console.log('cachedData 2',cachedData)
    console.log('CACHE',cache)
    console.log('CACHE',cache.keys)
    return data;
  } catch (e) {
    console.error(`failed GET request (${url}): ${e.message}`);
    return handleGETRequest(url, isBuffer, retry - 1);
  }
}

export function logFloor(x: number, base: number = 2) {
  return Math.floor(Math.log(x) / Math.log(base));
}

export function concatUint8Array(data: Uint8Array[]) {
  const l = data.reduce((l, d) => l + d.length, 0);
  let result = new Uint8Array(l);
  let offset = 0;
  data.forEach(d => {
    result.set(d, offset);
    offset += d.length;
  });
  return result;
}

export const isUint8ArrayEq = (a: Uint8Array, b: Uint8Array): boolean => {
  return toHexString(a) === toHexString(b);
}

export const isCommitteeSame = (a: Uint8Array[], b: Uint8Array[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((c, i) => isUint8ArrayEq(c, b[i]));
}

export const generateRandomSyncCommittee = (): Uint8Array[] => {
  return Array.from({length: 512}, () => bls.SecretKey.fromKeygen().toPublicKey().toBytes());
}

export const getRandomInt = (max: number) => {
  return Math.floor(Math.random() * max);
}

export const smallHexStr = (data: Uint8Array) => toHexString(data).slice(0, 8);

export const numberToUint8Array = (num: number): Uint8Array => {
  return new Uint8Array(
    Array.from({length: 8}, (_, i) => (num >> (8 * i)) & 0xff)
    .reverse()
  );
}

export const shuffle = (array: any[]) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export const wait = async (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function deepTypecast<T>(
  obj: any,
  checker: (val: any) => boolean,
  caster: (val: T) => any,
): any {
  return _.mapValues(obj, (val) => checker(val) 
  ? caster(val) 
  : deepTypecast(val, checker, caster));
}

// export class RandomBytesGenerator {
//   prng: seedrandom.PRNG;

//   constructor(seed: string) {
//     this.prng = seedrandom(seed);
//   }

//   generateArray(bytesPerElement: number, elements: number): Uint8Array[] {
//     return new Array(elements).fill(null).map(() => {
//       const res = new Uint8Array(bytesPerElement);
//       for (let i = 0; i < bytesPerElement; i++) {
//         res[i] = Math.floor(this.prng() * 256);
//       }
//       return res;
//     });
//   }
// }