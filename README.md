PoS Ethereum LightClients
=========================
Implements different light client implementations for PoS Ethereum. 

### Start the RPC Proxy
```bash
npm install -g pos-eth-lightclients
rpc-proxy -u <rpc-url> -n <chain-id> 
```
Add proxy network to metamask. By default the proxy starts at port `8546` for mainnet and `8547` for goerli.     

### Build Locally
Clone the repo and perform the following commands
```bash
yarn install
yarn build
```

### Run Server
```bash
cp .env.example .env
yarn start
```

### Deploy Server to heroku
```bash
bash src/provers/light-optimistic/deploy-heroku.sh <heroku-app-name>
```



