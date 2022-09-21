// import * as dotenv from 'dotenv';
// dotenv.config();

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { startServer } from '@lightclients/patronum';
import { ClientManager } from './client-manager.js';


async function main() {
  try{
    const argv = await yargs(hideBin(process.argv))
      .option('network', {
        alias: 'n',
        choices: [1, 5],
        description: 'chain id to start the proxy on (1, 5)'
      })
      .option('rpc', {
        alias: 'u',
        description: 'rpc url to proxy'
      })
      .option('port', {
        alias: 'p',
        type: 'number',
        description: 'port to start the proxy'
      })
      .option('beacon-api', {
        alias: 'a',
        description: 'beacon chain api URL'
      })
      .demandOption(['rpc'])
      .parse();

    const network = argv.network || parseInt(process.env.CHAIN_ID || '1');
    const port = argv.port || (network === 5 ? 8547 : 8546);
    const beaconAPIURL = (argv['beacon-api'] as string) || (network === 5 ? 'https://lodestar-goerli.chainsafe.io' : 'https://lodestar-mainnet.chainsafe.io');
    const providerURL = (argv.rpc as string);
    
    const cm = new ClientManager(beaconAPIURL, providerURL, network);
    const provider = await cm.sync();
    await startServer(provider, port);
  } catch (err) {
    console.error(err);
  }
}

main();