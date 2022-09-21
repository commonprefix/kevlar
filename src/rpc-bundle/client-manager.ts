import { init } from '@chainsafe/bls/switchable';
import { Chain } from '@ethereumjs/common';
import { toHexString, fromHexString } from '@chainsafe/ssz';
import { networksChainConfig } from '@lodestar/config/networks';
import { createIBeaconConfig, IBeaconConfig } from '@lodestar/config';
import { VerifyingProvider } from '@lightclients/patronum';
import { BaseClient } from '../clients/base-client.js';
import { BeaconAPIProver } from '../clients/light/beacon-api-prover.js';
import { LightClient } from '../clients/light/index.js';
import { readFileSync } from 'fs';


export class ClientManager {
  client: BaseClient;

  constructor(
    protected beaconChainAPIURL: string,
    protected providerURL: string,
    protected chain: Chain,
    n?: number,
  ) {
    const networkName = chain === 1 ? 'mainnet' : 'goerli';
    const bootstrapData = JSON.parse(
      readFileSync(
        new URL(`./bootstrap-data/${networkName}.json`, import.meta.url),
        {encoding:'utf8', flag:'r'}
      )
    );
    const chainConfig = createIBeaconConfig(
      networksChainConfig[networkName],
      fromHexString(bootstrapData.genesis_validator_root),
    );
    const clientConfig = {
      genesis: {
        committee: bootstrapData.committee_pk,
        slot: parseInt(bootstrapData.slot),
        time: parseInt(bootstrapData.genesis_time),
      },
      chainConfig,
      n,
    };
    const provers = [new BeaconAPIProver(beaconChainAPIURL)];
    this.client = new LightClient(clientConfig, beaconChainAPIURL, provers);
  }

  async sync(): Promise<VerifyingProvider> {
    await init('blst-native');

    const { blockhash, blockNumber } = await this.client.sync();
    const provider = new VerifyingProvider(
      this.providerURL,
      blockNumber,
      blockhash,
      this.chain,
    );
    this.client.subscribe(ei => {
      console.log(
        `Recieved a new blockheader: ${ei.blockNumber} ${ei.blockhash}`,
      );
      provider.update(ei.blockhash, ei.blockNumber);
    });

    return provider;
  }
}
