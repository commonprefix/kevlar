import { defaultAbiCoder, ParamType } from '@ethersproject/abi';
import { FunctionFragment } from '@ethersproject/abi/lib';
import { arrayify, BytesLike, hexlify, toUtf8String } from 'ethers/lib/utils';

// check if a given bigint can safely be represented in a number
const isSafeNumber = (val: bigint): boolean => {
    return val < BigInt(Number.MAX_SAFE_INTEGER);
};

// try and parse an offset from the data
// returns the word as a number if it's a potentially valid offset into the data
const tryParseOffset = (data: Uint8Array, pos: number): number | null => {
    let offset = 0;
    for (let i = 0; i < 32; i++) {
        offset = (offset << 8) | data[pos + i];
    }
    return pos < offset && offset < data.length && offset % 32 === 0
        ? offset
        : null;
};

const tryParseLength = (data: Uint8Array, offset: number): number | null => {
    let length = 0;
    for (let i = 0; i < 32; i++) {
        length = (length << 8) | data[offset + i];
    }
    return offset + 32 + length <= data.length
        ? length
        : null;
};

// count the number of leading zeros
const countLeadingZeros = (arr: Uint8Array) => {
    return arr.slice(0, arr.length).findIndex((elem) => elem !== 0);
};

// count the number of trailing zeros
const countTrailingZeros = (arr: Uint8Array) => {
    let count = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i] != 0) break;

        count++;
    }
    return count;
};

// pretty print the potential param
const formatParam = (p: DecodedParam) => {
    // if (p === undefined) return 'undefined';

    if (ParamType.isParamType(p)) {
        return p.format();
    }

    return `dynamic(offset=${p.offset},len=${p.length})`;
};
const formatParams = (params: ParamType[]): string => {
    return `(${params.map((v) => v.format()).join(',')})`;
};

const areParamsConsistent = (params: ParamType[]): unknown => {
    return params.reduce((acc, curr) => acc === curr.format() ? acc : false, params[0].format());
};

// represents a placeholder for a potential dynamic variable
type DynamicPlaceholder = {
    // the offset of the dynamic variable. always exists
    offset: number;

    // the length of the dynamic variable. only exists sometimes, like for variable length arrays
    length: number | null;
};

export type DecodedParam = ParamType | DynamicPlaceholder;

const testParams = (params: ParamType[] | null): boolean => {
    if (!params) return false;
    for (let i = 0; i < params.length; i++) {
        if (!ParamType.isParamType(params[i])) {
            return false;
        }
    }
    return true;
};


// decode a well formed tuple using backtracking
// for each parameter that we think we've identified, add it to collectedParams and backtrack
// this allows us to perform dfs through the entire search space without needing to implement the requisite data structure
const decodeWellFormedTuple = (
    depth: number,
    data: Uint8Array,
    paramIdx: number,
    collectedParams: Array<DecodedParam>,
    endOfStaticCalldata: number,
    expectedLength: number | null,
    isDynamicArrayElement: boolean | null
): ParamType[] | null => {
    const paramOffset = paramIdx * 32;
    if (paramOffset >= endOfStaticCalldata) return null;
    let maybeOffset = tryParseOffset(data, paramOffset);
    if (maybeOffset !== null) {
        let maybeLength = tryParseLength(data, maybeOffset);
        if (maybeLength !== null && (isDynamicArrayElement === null || isDynamicArrayElement === true)) {
            let fragment = decodeWellFormedTuple(depth, data, paramIdx + 1, [...collectedParams, { offset: maybeOffset, length: maybeLength }], Math.min(endOfStaticCalldata, maybeOffset), expectedLength, isDynamicArrayElement);
            if (testParams(fragment)) {
                return fragment;
            }
        }
        if (isDynamicArrayElement === null || isDynamicArrayElement === false) {
            let fragment = decodeWellFormedTuple(depth, data, paramIdx + 1, [...collectedParams, { offset: maybeOffset, length: null }], Math.min(endOfStaticCalldata, maybeOffset), expectedLength, isDynamicArrayElement);
            if (testParams(fragment)) {
                return fragment;
            }
        }
    }
    if (isDynamicArrayElement === null) {
        let fragment = decodeWellFormedTuple(depth, data, paramIdx + 1, [...collectedParams, ParamType.from('bytes32')], endOfStaticCalldata, expectedLength, isDynamicArrayElement);
        if (testParams(fragment)) {
            return fragment;
        }
    }
    return null;
};


/*
assume the calldata is "well-formed". by well-formed, we mean that all the static parameters come first,
then all the dynamic parameters come after. we assume there is no overlaps in dynamic parameters
and all trailing zeros are explicitly specified
 */
// The function tryParseOffset and tryParseLength are used to check if a given offset and length are valid. The function countLeadingZeros and countTrailingZeros are used to determine if a given value is an address, uint256, or bytes.
export const guessAbiEncodedData = (bytes: BytesLike): ParamType[] | null => {
    const data = arrayify(bytes);
    const decoded = [];
    let offset = 0;
    while (offset < data.length) {
        const maybeOffset = tryParseOffset(data, offset);
        if (maybeOffset !== null) {
            const maybeLength = tryParseLength(data, maybeOffset);
            if (maybeLength !== null) {
                decoded.push({
                    type: 'bytes',
                    offset: maybeOffset,
                    length: maybeLength,
                });
                offset += 32;
            } else {
                decoded.push({
                    type: 'bytes32',
                    offset,
                });
                offset += 32;
            }
        } else {
            const val = data.slice(offset, offset + 32);
            const leadingZeros = countLeadingZeros(val);
            const trailingZeros = countTrailingZeros(val);
            if (leadingZeros >= 12 && leadingZeros <= 17) {
                decoded.push({
                    type: 'address',
                    offset,
                });
            } else if (leadingZeros > 16) {
                decoded.push({
                    type: 'uint256',
                    offset,
                });
            } else if (trailingZeros > 0) {
                decoded.push({
                    type: `bytes${32 - trailingZeros}`,
                    offset,
                });
            } else {
                decoded.push({
                    type: 'bytes32',
                    offset,
                });
            }
            offset += 32;
        }
    }
    let decodedParams = decoded.map(({ type, offset, length }) => {
        return {
            type: type === 'bytes' ? 'string' : type,
            value: tryToDecode(data.slice(offset, offset + (length || 32)))
        };
    });
    const tryToDecode = (data: Uint8Array) => {
        try {
            return toUtf8String(data);
        } catch {
            return data;
        }
    }       
    return decodedParams.map(({ type, value }) => {
        if (type === 'bytes') {
            return ParamType.from(`bytes${value.length}`);
        } else {
            return ParamType.from(type);
        }
    });
};


export const guessFragment = (calldata: BytesLike): FunctionFragment | null => {
    const bytes = arrayify(calldata);
    if (bytes.length === 0) return null;
    const tupleData = bytes.slice(4);

    const params = guessAbiEncodedData(tupleData);
    if (!params) {
        return null;
    }

    const selector = hexlify(bytes.slice(0, 4)).substring(2);
    return FunctionFragment.from(`guessed_${selector}(${formatParams(params)})`);
};


// // split a string into chunks of given length
// const chunkString = (str: string, len: number): string[] => {
//     const result: string[] = [];

//     const size = Math.ceil(str.length / len);
//     let offset = 0;

//     for (let i = 0; i < size; i++) {
//         result.push(str.substring(offset, offset + len));
//         offset += len;
//     }

//     return result;
// };
