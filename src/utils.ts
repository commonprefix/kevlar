// import * as https from 'https';
// import * as http from 'http';
// import { URL } from 'url';
// import * as net from 'net';

import Decimal from 'decimal.js';
import { toHexString, fromHexString } from '@chainsafe/ssz';
import bls from '@chainsafe/bls/switchable';
// import seedrandom from 'seedrandom';
import _ from 'lodash';

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

export type RequestResult = {
  bytesRead: number;
  bytesWritten: number;
  data: object | Buffer;
};

const REQUEST_TIMEOUT = 10 * 1000;

// export async function handleHTTPSRequest(
//   method: 'GET' | 'POST',
//   url: string,
//   isBuffer: boolean = false,
//   logging: boolean = true,
// ): Promise<RequestResult> {
//   return new Promise((resolve, reject) => {
//     const timer = setTimeout(
//       () => reject(new Error(`Timeout`)),
//       REQUEST_TIMEOUT,
//     );

//     if (logging) console.log(`${method} ${url}`);
//     const data: any[] = [];
//     const option = {
//       method,
//     };

//     let socket: net.Socket;

//     const _url = new URL(url);
//     const req = (_url.protocol === 'http:' ? http : https).request(
//       url,
//       option,
//       resp => {
//         resp.on('data', chunk => data.push(chunk));
//         resp.on('end', () => {
//           clearTimeout(timer);
//           resolve({
//             data: isBuffer
//               ? Buffer.concat(data)
//               : JSON.parse(Buffer.concat(data).toString()),
//             bytesRead: socket.bytesRead,
//             bytesWritten: socket.bytesWritten,
//           });
//         });
//       },
//     );

//     req.setTimeout(REQUEST_TIMEOUT);
//     req.on('socket', _socket => (socket = _socket));
//     req.on('error', err => {
//       clearTimeout(timer);
//       reject(err);
//     });
//     req.on('timeout', () => {
//       req.destroy(new Error('timeout'));
//     });

//     req.end();
//   });
// }

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
