#!/usr/bin/env node

import * as dotenv from 'dotenv';
dotenv.config();

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startServer } from '@lightclients/patronum';
import { ClientManager } from './client-manager.js';
import { ClientType } from '../constants.js';
import {
  DEFAULT_BEACON_API_URL,
  DEFAULT_PROVERS,
  DEFAULT_PUBLIC_RPC_CHAIN_ID,
} from './constants.js';

const getDefaultRPC = (network: number): string => {
  const rpc = DEFAULT_PUBLIC_RPC_CHAIN_ID[network];
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
    const proverURLs = DEFAULT_PROVERS[clientType][network].concat(
      argv.provers ? (argv.provers as string).split(',') : [],
    );
    const beaconAPIURL =
      (argv['beacon-api'] as string) || DEFAULT_BEACON_API_URL[network];
    const providerURL = (argv.rpc as string) || getDefaultRPC(network);

    const clientManager = new ClientManager(
      network,
      clientType,
      beaconAPIURL,
      providerURL,
      proverURLs,
    );
    const provider = await clientManager.sync();
    await startServer(provider, port);
  } catch (err) {
    console.error(err);
  }
}

main();
