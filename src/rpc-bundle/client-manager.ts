// import axios from 'axios';
// import * as altair from '@lodestar/types/altair';
// import * as bellatrix from '@lodestar/types/bellatrix';
// import { toHexString, fromHexString } from '@chainsafe/ssz';
// import { init } from '@chainsafe/bls/switchable';
// import { createIBeaconConfig, IBeaconConfig } from '@lodestar/config';
// import { networksChainConfig } from '@lodestar/config/networks';
// import { LightClient } from '../client/light-client.js';
// import { BeaconAPIProver } from '../prover/beacon-api-prover.js';
// import { BeaconStoreVerifier } from '../store/beacon-store.js';
// import { IProver } from '../prover/iprover.js';
// import { Bytes32 } from '../types.js';
// import { VerifyingProvider } from 'patronum';
// import GoerliBootstrapData from './bootstrap-data/goerli.json' assert { type: 'json' };

// export type ExecutionInfo = {
//   blockhash: string;
//   blockNumber: bigint;
// }

// export class ClientManager {
//   // TODO: make it generic to any client
//   client: LightClient<altair.LightClientUpdate>;
//   store: BeaconStoreVerifier;
//   provers: IProver<altair.LightClientUpdate>[];
//   provider: VerifyingProvider | null = null;

//   constructor(
//     proverURLs: string[],
//     protected beaconChainAPIURL: string,
//     protected providerURL: string,
//     protected chainId: number,
//     n: number = 2,
//   ) {
//     const chainConfig = createIBeaconConfig(
//       networksChainConfig['goerli'],
//       fromHexString(GoerliBootstrapData.genesis_validator_root),
//     );
//     this.store = new BeaconStoreVerifier(
//       GoerliBootstrapData.committee_pk,
//       parseInt(GoerliBootstrapData.slot),
//       parseInt(GoerliBootstrapData.genesis_time),
//       chainConfig,
//     );
//     this.provers = [new BeaconAPIProver(beaconChainAPIURL)];
//     // TODO: change the batch size after the BeaconAPIProver edge case is done
//     this.client = new LightClient(this.store, this.provers, 1);
//   }

//   async setup() {
//     await init('blst-native');
//   }

//   async sync(): Promise<VerifyingProvider> {
//     const { syncCommittee } = await this.client.sync();
//     console.log('Verified to the syncCommittee of the latest period');

//     const res = await axios.get(
//       `${this.beaconChainAPIURL}/eth/v1/beacon/light_client/optimistic_update/`,
//     );
//     const updateJSON = res.data.data;
//     const update = this.store.optimisticUpdateFromJSON(updateJSON);
//     const isUpdateCorrect = this.store.optimisticUpdateVerify(
//       syncCommittee,
//       update,
//     );
//     // TODO: check the update agains the latest sync commttee
//     if (!(isUpdateCorrect as boolean))
//       throw new Error('invalid optimistic update provided by the rpc');
//     console.log(
//       `Optimistic update verified for slot ${updateJSON.attested_header.slot}`,
//     );

//     const { blockhash, blockNumber } = await this.getConcensusBlock(
//       updateJSON.attested_header.slot,
//       updateJSON.attested_header.body_root,
//     );
//     console.log(
//       `Booting verified provider with blockhash(${blockhash}) and blockNumber(${blockNumber})`,
//     );
//     this.provider = new VerifyingProvider(
//       this.providerURL,
//       blockNumber,
//       blockhash,
//       this.chainId,
//     );
//     return this.provider;
//   }

//   async getConcensusBlock(
//     slot: bigint,
//     expectedBlockRoot: Bytes32,
//   ): Promise<ExecutionInfo> {
//     const res = await axios.get(
//       `${this.beaconChainAPIURL}/eth/v2/beacon/blocks/${slot}`,
//     );
//     const blockJSON = res.data.data.message.body;
//     const block = bellatrix.ssz.BeaconBlockBody.fromJson(blockJSON);
//     const blockRoot = toHexString(
//       bellatrix.ssz.BeaconBlockBody.hashTreeRoot(block),
//     );
//     if (blockRoot !== expectedBlockRoot) {
//       throw Error(
//         `block provided by the beacon chain api doesn't match the expected block root`,
//       );
//     }

//     return {
//       blockhash: blockJSON.execution_payload.block_hash,
//       blockNumber: blockJSON.execution_payload.block_number,
//     };
//   }
// }
