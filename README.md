PoS Ethereum LightClients
=========================
Implements different light client implementations for PoS Ethereum. 

### Start the RPC Proxy
```bash
npm install -g pos-eth-lightclients
rpc-proxy -u <rpc-url> -n <chain-id> 
```
Add proxy network to metamask. By default the proxy starts at port `8546` for mainnet and `8547` for goerli.     


### Build RPC Proxy from source
```bash
yarn install
yarn build
yarn rpc-proxy -u <rpc-url> -n <chain-id> 
```