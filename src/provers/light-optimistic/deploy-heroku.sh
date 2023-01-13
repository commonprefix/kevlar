name=$1

heroku create "$name" 
git remote add "$name" "https://git.heroku.com/$name.git"

heroku config:set --app "$name" BEACON_CHAIN_API_URL=https://lodestar-mainnet.chainsafe.io CHAIN_ID=1

git push "$name" main