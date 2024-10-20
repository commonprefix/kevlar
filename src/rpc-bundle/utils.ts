import { createBeaconConfig } from '@lodestar/config';
import { fromHexString } from '@chainsafe/ssz';
import { networksChainConfig } from '@lodestar/config/networks';
import { Chain } from '@ethereumjs/common';
import { mainnetConfig } from './bootstrap-data/mainnet.js';
import { NETWORK_NAMES } from './constants.js';
import { sepoliaConfig } from './bootstrap-data/sepolia.js';

const bootstrapDataMap: { [network: number]: any } = {
  [Chain.Mainnet]: mainnetConfig,
  [Chain.Sepolia]: sepoliaConfig,
};

export function getDefaultClientConfig(
  chain: Chain.Mainnet | Chain.Sepolia,
  n?: number,
) {
  const bootstrapData = bootstrapDataMap[chain];
  if (!bootstrapData)
    throw new Error(`bootstrapData not found for chain ${chain}`);
  const networkName = NETWORK_NAMES[chain];
  const chainConfig = createBeaconConfig(
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

  return clientConfig;
}
