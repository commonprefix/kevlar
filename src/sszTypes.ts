import { ByteVectorType, UintNumberType, UintBigintType, BooleanType } from "@chainsafe/ssz";
export declare const Boolean: BooleanType;
export declare const Byte: UintNumberType;
export declare const Bytes4: ByteVectorType;
export declare const Bytes8: ByteVectorType;
export declare const Bytes20: ByteVectorType;
export declare const Bytes32: ByteVectorType;
export declare const Bytes48: ByteVectorType;
export declare const Bytes96: ByteVectorType;
export declare const Uint8: UintNumberType;
export declare const Uint16: UintNumberType;
export declare const Uint32: UintNumberType;
export declare const UintNum64: UintNumberType;
export declare const UintNumInf64: UintNumberType;
export declare const UintBn64: UintBigintType;
export declare const UintBn128: UintBigintType;
export declare const UintBn256: UintBigintType;
/**
 * Use JS Number for performance, values must be limited to 2**52-1.
 * Slot is a time unit, so in all usages it's bounded by the clock, ensuring < 2**53-1
 */
export declare const Slot: UintNumberType;
/**
 * Use JS Number for performance, values must be limited to 2**52-1.
 * Epoch is a time unit, so in all usages it's bounded by the clock, ensuring < 2**53-1
 */
export declare const Epoch: UintNumberType;
/** Same as @see Epoch + some validator properties must represent 2**52-1 also, which we map to `Infinity` */
export declare const EpochInf: UintNumberType;
/**
 * Use JS Number for performance, values must be limited to 2**52-1.
 * SyncPeriod is a time unit, so in all usages it's bounded by the clock, ensuring < 2**53-1
 */
export declare const SyncPeriod: UintNumberType;
/**
 * Use JS Number for performance, values must be limited to 2**52-1.
 * CommitteeIndex is bounded by the max possible number of committees which is bounded by `VALIDATOR_REGISTRY_LIMIT`
 */
export declare const CommitteeIndex: UintNumberType;
/** @see CommitteeIndex */
export declare const SubcommitteeIndex: UintNumberType;
/**
 * Use JS Number for performance, values must be limited to 2**52-1.
 * ValidatorIndex is bounded by `VALIDATOR_REGISTRY_LIMIT`
 */
export declare const ValidatorIndex: UintNumberType;
export declare const Gwei: UintBigintType;
export declare const Root: ByteVectorType;
export declare const Version: ByteVectorType;
export declare const DomainType: ByteVectorType;
export declare const ForkDigest: ByteVectorType;
export declare const BLSPubkey: ByteVectorType;
export declare const BLSSignature: ByteVectorType;
export declare const Domain: ByteVectorType;
export declare const ParticipationFlags: UintNumberType;
export declare const ExecutionAddress: ByteVectorType;
//# sourceMappingURL=sszTypes.d.ts.map