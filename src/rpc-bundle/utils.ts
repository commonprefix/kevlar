import { readFileSync } from 'fs';
import { createIBeaconConfig } from '@lodestar/config';
import { fromHexString } from '@chainsafe/ssz';
import { networksChainConfig } from '@lodestar/config/networks';
import { goerliConfig } from './bootstrap-data/goerli.js';
import { mainnetConfig } from './bootstrap-data/mainnet.js';

const bootstrapDataMap: { [network: number]: any } = {
  1: mainnetConfig,
  5: goerliConfig,
};

export function getDefaultClientConfig(chain: number, n?: number) {
  const bootstrapData = bootstrapDataMap[chain];
  if (!bootstrapData) throw new Error(`bootstrapData not found for chain ${chain}`);
  const networkName = chain === 1 ? 'mainnet' : 'goerli';
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

  return clientConfig;
}
