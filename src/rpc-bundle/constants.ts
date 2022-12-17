import { ClientType } from '../constants.js';

export const DEFAULT_BEACON_API_URL: { [network: number]: string } = {
  // 1: 'https://lodestar-mainnet.chainsafe.io',
  // 1: 'http://testing.mainnet.beacon-api.nimbus.team',
  1: 'http://nimbus-mainnet.commonprefix.com',
  // 5: 'https://lodestar-goerli.chainsafe.io',
  5: 'http://testing.prater.beacon-api.nimbus.team',
};

export const DEFAULT_PROVERS: {
  [client: string]: { [network: number]: string[] };
} = {
  [ClientType.optimistic]: {
    1: [
      // 'https://light-optimistic-mainnet-1.herokuapp.com',
      // 'https://light-optimistic-mainnet-2.herokuapp.com',
      'https://eth-rpc-proxy.herokuapp.com',
      'https://kevlar-tzinas.herokuapp.com',
    ],
    5: [
      'https://light-optimistic-goerli-1.herokuapp.com',
      'https://light-optimistic-goerli-2.herokuapp.com',
    ],
  },
  [ClientType.light]: {
    1: [DEFAULT_BEACON_API_URL[1]],
    5: [DEFAULT_BEACON_API_URL[5]],
  },
};

// TODO: Add more endpoints.
// Every endpoint needs to support eth_createAccessList, eth_estimateGas
export const DEFAULT_PUBLIC_RPC_CHAIN_ID: { [network: number]: string[] } = {
  1: [
    // 'https://eth-mainnet.gateway.pokt.network/v1/5f3453978e354ab992c4da79', (not very stable)
    'https://rpc.ankr.com/eth',
  ],
  5: ['https://eth-goerli.gateway.pokt.network/v1/5f3453978e354ab992c4da79'],
};
