import Decimal from 'decimal.js';
import { toHexString, fromHexString } from '@chainsafe/ssz';
import bls from '@chainsafe/bls/switchable';
import _ from 'lodash';
import axios from 'axios';

export function logFloor(x: number, base: number = 2) {
  return Decimal.log(x, base).floor().toNumber();
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

export function isUint8ArrayEq(a: Uint8Array, b: Uint8Array): boolean {
  return toHexString(a) === toHexString(b);
}

export function isCommitteeSame(a: Uint8Array[], b: Uint8Array[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((c, i) => isUint8ArrayEq(c, b[i]));
}

export function generateRandomSyncCommittee(): Uint8Array[] {
  let res = [];
  // TODO: change 512 to constant
  for (let i = 0; i < 512; i++) {
    res.push(bls.SecretKey.fromKeygen().toPublicKey().toBytes());
  }
  return res;
}

export function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

export const smallHexStr = (data: Uint8Array) => toHexString(data).slice(0, 8);

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

export function numberToUint8Array(num: number): Uint8Array {
  const rawHex = num.toString(16);
  const hex = '0x' + (rawHex.length % 2 === 0 ? rawHex : '0' + rawHex);
  return fromHexString(hex);
}

// credit: https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
export function shuffle(array: any[]) {
  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

export async function wait(ms: number) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}

export async function handleGETRequest(
  url: string,
  isBuffer: boolean = true,
  retry: number = 3,
): Promise<any> {
  if (retry < 0) {
    throw Error(`GET request failed: ${url}`);
  }
  try {
    const { data } = await axios.get(
      url,
      isBuffer ? { responseType: 'arraybuffer' } : undefined,
    );
    return data;
  } catch (e) {
    console.error(`failed GET request (${url}): ${e.message}`);
    return handleGETRequest(url, isBuffer, retry - 1);
  }
}

export function deepTypecast<T>(
  obj: any,
  checker: (val: any) => boolean,
  caster: (val: T) => any,
): any {
  return _.forEach(obj, (val: any, key: any, obj: any) => {
    obj[key] = checker(val)
      ? caster(val)
      : _.isObject(val)
      ? deepTypecast(val, checker, caster)
      : val;
  });
}
