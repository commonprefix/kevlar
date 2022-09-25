import * as dotenv from 'dotenv';
dotenv.config();

import { startServer } from './server.js';

const PORT = parseInt(process.env.PORT || '80');
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '1');

if (!process.env.BEACON_CHAIN_API_URL)
  throw new Error('Beacon API URL not set in the env');
const BEACON_API_URL = process.env.BEACON_CHAIN_API_URL;

startServer(PORT, CHAIN_ID, BEACON_API_URL);
