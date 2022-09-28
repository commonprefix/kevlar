# PoS Ethereum LightClients

Implements different light client implementations for PoS Ethereum.

### Start the RPC Proxy

```bash
npm install -g pos-eth-lightclients
rpc-proxy
```

Add proxy network to metamask. By default the proxy starts at port `8546` for mainnet and `8547` for goerli.


```bash
rpc-proxy --help
Options:
      --help        Show help                                          [boolean]
      --version     Show version number                                [boolean]
  -n, --network     chain id to start the proxy on (1, 5)        [choices: 1, 5]
  -c, --client      type of the client          [choices: "light", "optimistic"]
  -o, --provers     comma separated prover urls
  -u, --rpc         rpc url to proxy
  -p, --port        port to start the proxy                             [number]
  -a, --beacon-api  beacon chain api URL
```

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
