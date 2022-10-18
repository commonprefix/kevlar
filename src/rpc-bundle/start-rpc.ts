#!/usr/bin/env node

import * as dotenv from 'dotenv';
dotenv.config();

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startServer } from '@lightclients/patronum';
import { ClientManager } from './client-manager.js';
import { ClientType } from '../constants.js';

const defaultBeaconAPIURL: { [network: number]: string } = {
  1: 'https://lodestar-mainnet.chainsafe.io',
  5: 'https://lodestar-goerli.chainsafe.io',
};

const defaultProvers: { [client: string]: { [network: number]: string[] } } = {
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
const defaultPublicRPC: { [network: number]: string[] } = {
  1: [
    // 'https://eth-mainnet.gateway.pokt.network/v1/5f3453978e354ab992c4da79', (not very stable)
    'https://rpc.ankr.com/eth',
  ],
  5: ['https://eth-goerli.gateway.pokt.network/v1/5f3453978e354ab992c4da79'],
};

const getDefaultRPC = (network: number): string => {
  const rpc = defaultPublicRPC[network];
  return rpc[Math.floor(Math.random() * rpc.length)];
};

async function main() {
  try {
    const argv = await yargs(hideBin(process.argv))
      .option('network', {
        alias: 'n',
        choices: [1, 5],
        description: 'chain id to start the proxy on (1, 5)',
      })
      .option('client', {
        alias: 'c',
        choices: ['light', 'optimistic'],
        description: 'type of the client',
      })
      .option('provers', {
        alias: 'o',
        description: 'comma separated prover urls',
      })
      .option('rpc', {
        alias: 'u',
        description: 'rpc url to proxy',
      })
      .option('port', {
        alias: 'p',
        type: 'number',
        description: 'port to start the proxy',
      })
      .option('beacon-api', {
        alias: 'a',
        description: 'beacon chain api URL',
      })
      .parse();

    const network = argv.network || parseInt(process.env.CHAIN_ID || '1');
    const port = argv.port || (network === 5 ? 8547 : 8546);
    const clientType =
      argv.client === 'light' ? ClientType.light : ClientType.optimistic;
    const proverURLs = defaultProvers[clientType][network].concat(
      argv.provers ? (argv.provers as string).split(',') : [],
    );
    const beaconAPIURL =
      (argv['beacon-api'] as string) ||
      (network === 5
        ? 'https://lodestar-goerli.chainsafe.io'
        : 'https://lodestar-mainnet.chainsafe.io');
    const providerURL = (argv.rpc as string) || getDefaultRPC(network);

    const cm = new ClientManager(
      network,
      clientType,
      beaconAPIURL,
      providerURL,
      proverURLs,
    );
    const provider = await cm.sync();
    await startServer(provider, port);
  } catch (err) {
    console.error(err);
  }
}

main();
