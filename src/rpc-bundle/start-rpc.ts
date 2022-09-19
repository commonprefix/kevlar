import * as dotenv from 'dotenv';
dotenv.config();

import { startServer } from 'patronum';
import { ClientManager } from './client-manager.js';

const CHAIN_ID = parseInt(process.env.CHAIN_ID || '1');
const PORT = CHAIN_ID === 5 ? 8547 : 8546;
const BEACON_CHAIN_API_URL = process.env.BEACON_CHAIN_API_URL || '';
const PROVIDER_URL = process.env.PROVIDER_URL || '';

async function main() {
  try {
    const cm = new ClientManager(BEACON_CHAIN_API_URL, PROVIDER_URL, CHAIN_ID);
    const provider = await cm.sync();
    await startServer(provider, PORT);
  } catch (err) {
    console.error(err);
  }
}

main();
