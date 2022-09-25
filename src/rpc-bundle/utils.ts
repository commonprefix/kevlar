import { readFileSync } from 'fs';
import { createIBeaconConfig } from '@lodestar/config';
import { fromHexString } from '@chainsafe/ssz';
import { networksChainConfig } from '@lodestar/config/networks';

export function getDefaultClientConfig(chain: number, n?: number) {
  const networkName = chain === 1 ? 'mainnet' : 'goerli';
  const bootstrapData = JSON.parse(
    readFileSync(
      new URL(`./bootstrap-data/${networkName}.json`, import.meta.url),
      { encoding: 'utf8', flag: 'r' },
    ),
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

  return clientConfig;
}
