import { init } from '@chainsafe/bls/switchable';
import { Chain } from '@ethereumjs/common';
import { toHexString } from '@chainsafe/ssz';
import { VerifyingProvider } from '@lightclients/patronum';
import { BaseClient } from '../clients/base-client.js';
import { BeaconAPIProver } from '../provers/beacon-api-light/client.js';
import { LightOptimisticProver } from '../provers/light-optimistic/client.js';
import { LightClient } from '../clients/light/index.js';
import { OptimisticLightClient } from '../clients/optimistic/index.js';
import { getDefaultClientConfig } from './utils.js';
import { ClientType } from '../constants.js';

export class ClientManager {
  client: BaseClient;

  constructor(
    protected chain: Chain,
    clientType: ClientType,
    beaconChainAPIURL: string,
    protected providerURL: string,
    proverURLS: string[],
    n?: number,
  ) {
    const config = getDefaultClientConfig(chain, n);
    if (clientType === ClientType.light) {
      const provers = proverURLS.map(pu => new BeaconAPIProver(pu));
      this.client = new LightClient(config, beaconChainAPIURL, provers);
    } else if (clientType === ClientType.optimistic) {
      const provers = proverURLS.map(pu => new LightOptimisticProver(pu));
      this.client = new OptimisticLightClient(
        config,
        beaconChainAPIURL,
        provers,
      );
    } else {
      throw new Error('superlight client not implemented yet');
    }
  }

  async sync(): Promise<VerifyingProvider> {
    try {
      await init('blst-native');
    } catch {
      await init('herumi');
    }

    await this.client.sync();
    const { blockhash, blockNumber } =
      await this.client.getNextValidExecutionInfo();
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
