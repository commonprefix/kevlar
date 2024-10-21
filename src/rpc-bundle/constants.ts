import { Chain } from '@ethereumjs/common';
import { ClientType } from '../constants.js';

export const NETWORK_NAMES = {
  [Chain.Mainnet]: 'mainnet',
  [Chain.Sepolia]: 'sepolia',
} as const;

export const defaultBeaconAPIURL: { [network: number]: string } = {
  [Chain.Mainnet]: 'https://lodestar-mainnet.chainsafe.io',
  [Chain.Sepolia]: 'https://lodestar-sepolia.chainsafe.io',
};

export const defaultProvers: {
  [client: string]: { [network: number]: string[] };
} = {
  [ClientType.optimistic]: {
    [Chain.Mainnet]: [
      'https://light-optimistic-mainnet-1.herokuapp.com',
      'https://light-optimistic-mainnet-2.herokuapp.com',
    ],
    [Chain.Sepolia]: [
      // TODO setup for sepolia
      'https://light-optimistic-goerli-1.herokuapp.com',
      'https://light-optimistic-goerli-2.herokuapp.com',
    ],
  },
  [ClientType.light]: {
    [Chain.Mainnet]: [defaultBeaconAPIURL[Chain.Mainnet]],
    [Chain.Sepolia]: [defaultBeaconAPIURL[Chain.Sepolia]],
  },
};

// TODO: Add more endpoints.
// Every endpoint needs to support eth_createAccessList, eth_estimateGas
export const defaultPublicRPC: { [network: number]: string[] } = {
  [Chain.Mainnet]: ['https://rpc.ankr.com/eth'],
  [Chain.Sepolia]: ['https://rpc.ankr.com/eth_sepolia'],
};
