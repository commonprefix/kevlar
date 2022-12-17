import { createAsyncMiddleware } from 'json-rpc-engine';
import { getJSONRPCServer } from '@lightclients/patronum';
import { ClientManager } from './client-manager.js';
import { ClientType } from '../constants.js';
import {
  DEFAULT_BEACON_API_URL,
  DEFAULT_PROVERS,
  DEFAULT_PUBLIC_RPC_CHAIN_ID,
} from './constants.js';
import { EthereumRpcError, ethErrors } from 'eth-rpc-errors';

// TODO: fix types
export function getMiddleware(network: number) {
  const clientType: ClientType = ClientType.optimistic;
  const beaconAPIURL: string = DEFAULT_BEACON_API_URL[network];
  const proverURLs: string[] = DEFAULT_PROVERS[clientType][network];
  const [providerURL]: string[] = DEFAULT_PUBLIC_RPC_CHAIN_ID[network];

  const clientManager = new ClientManager(
    network,
    clientType,
    beaconAPIURL,
    providerURL,
    proverURLs,
  );

  const syncPromise = clientManager.sync();
  let server: any = null;

  return createAsyncMiddleware(async (req: any, res: any, next: any) => {
    if (server === null) {
      const provider = await syncPromise;
      server = getJSONRPCServer(provider);
    }
    const _res = await server.receive(req);
    // TODO: fix error
    if (!_res)
      throw ethErrors.rpc.internal({
        message: `⛔️ Something went wrong`,
      });
    else if (_res.error)
      throw ethErrors.rpc.internal({
        data: _res.error,
      });
    res.result = _res.result;
  });
}
