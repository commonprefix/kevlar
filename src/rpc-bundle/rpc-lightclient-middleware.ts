import { createAsyncMiddleware } from 'json-rpc-engine';
import { getJSONRPCServer } from '@lightclients/patronum';
import { ClientManager } from './client-manager.js';
import { ClientType } from '../constants.js';
import { defaultBeaconAPIURL, defaultProvers, defaultPublicRPC } from './constants.js';
import { EthereumRpcError, ethErrors } from 'eth-rpc-errors';

// TODO: fix types
export function getRPCLightClientMiddleware(network: number) {
  const clientType = ClientType.optimistic;
  const beaconAPIURL = defaultBeaconAPIURL[network];
  const proverURLs = defaultProvers[clientType][network];
  const [providerURL] = defaultPublicRPC[network]; 

  const cm = new ClientManager(
    network,
    clientType,
    beaconAPIURL,
    providerURL, 
    proverURLs,
  );
  const syncPromise = cm.sync();
  let server: any = null;

  return createAsyncMiddleware(async (req: any, res: any, next: any) => {
    if(server === null) {
      const provider = await syncPromise;
      server = getJSONRPCServer(provider);
    }
    const _res = await server.receive(req);
    // TODO: fix error
    if(!_res) 
      throw ethErrors.rpc.internal({
        message: `something went wrong`,
      });
    else if(_res.error)
      throw ethErrors.rpc.internal({
        data: _res.error,
      });
    res.result = _res;
  });
}