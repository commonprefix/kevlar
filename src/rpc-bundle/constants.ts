import { ClientType } from '../constants.js';

export const defaultBeaconAPIURL: { [network: number]: string } = {
  // 1: 'https://lodestar-mainnet.chainsafe.io',
  1: 'http://testing.mainnet.beacon-api.nimbus.team',
  // 5: 'https://lodestar-goerli.chainsafe.io',
  5: 'http://testing.prater.beacon-api.nimbus.team'
};

export const defaultProvers: { [client: string]: { [network: number]: string[] } } = {
  [ClientType.optimistic]: {
    1: [
      'https://light-optimistic-mainnet-1.herokuapp.com',
      'https://light-optimistic-mainnet-2.herokuapp.com',
      'https://eth-rpc-proxy.herokuapp.com',
      'https://kevlar-tzinas.herokuapp.com',
    ],
    5: [
      'https://light-optimistic-goerli-1.herokuapp.com',
      'https://light-optimistic-goerli-2.herokuapp.com',
    ],
  },
  [ClientType.light]: {
    1: [defaultBeaconAPIURL[1]],
    5: [defaultBeaconAPIURL[5]],
  },
};

// TODO: Add more endpoints.
// Every endpoint needs to support eth_createAccessList, eth_estimateGas
export const defaultPublicRPC: { [network: number]: string[] } = {
  1: [
    // 'https://eth-mainnet.gateway.pokt.network/v1/5f3453978e354ab992c4da79', (not very stable)
    'https://rpc.ankr.com/eth',
  ],
  5: ['https://eth-goerli.gateway.pokt.network/v1/5f3453978e354ab992c4da79'],
};