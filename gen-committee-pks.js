// A script to fetch sync committee public keys from beaconcha.in API.
// Used for RPC bootstrap data.
//
// Usage:
// node gen-comittee-pks.js <network> <slot>
import fs from 'fs';
import path from 'path';

const SLOTS_PER_EPOCH = 32;
const EPOCHS_PER_SYNC_COMMITTEE_PERIOD = 256;

const networkApiHostnames = {
  sepolia: 'https://sepolia.beaconcha.in/api/v1',
  mainnet: 'https://beaconcha.in/api/v1',
};

const fetchValidatorIds = async (network, period) => {
  const apiUrl = `${networkApiHostnames[network]}/sync_committee/${period}`;
  const response = await fetch(apiUrl);
  const data = await response.json();
  return data.data.validators;
};

// Note: max 100 validators can be fetched at once
const fetchValidatorDetails = async (network, validatorIds) => {
  const apiUrl = `${networkApiHostnames[network]}/validator/${validatorIds.join(',')}`;
  const response = await fetch(apiUrl);
  const data = await response.json();
  const validatorMap = new Map(
    data.data.map(validator => [validator.validatorindex, validator]),
  );
  return validatorIds.map(id => validatorMap.get(id));
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const calculateSyncCommitteePeriod = slot => {
  return Math.floor(
    slot / (SLOTS_PER_EPOCH * EPOCHS_PER_SYNC_COMMITTEE_PERIOD),
  );
};

const extractPublicKeys = async (network, slot) => {
  const period = calculateSyncCommitteePeriod(slot);
  const committeePk = [];
  const validatorIds = await fetchValidatorIds(network, period);

  console.log(`Sync committee period: ${period}`);
  console.log(
    `Fetching validator details for ${validatorIds.length} validators...`,
  );
  console.log(`Validator IDs: ${validatorIds}`);

  // Split validator IDs into chunks of 100
  const chunkSize = 100;
  for (let i = 0; i < validatorIds.length; i += chunkSize) {
    const chunk = validatorIds.slice(i, i + chunkSize);
    try {
      const validatorDetails = await fetchValidatorDetails(network, chunk);
      validatorDetails.forEach(validator => {
        if (validator.pubkey) {
          committeePk.push(validator.pubkey);
        }
      });
    } catch (err) {
      console.error(
        `Error fetching validator details for chunk starting at index ${i}:`,
        err,
      );
    }
    // Wait for 2 seconds between requests to avoid rate limiting
    await delay(2000);
  }

  const outputFilePath = path.join(
    process.cwd(),
    `committee_pk_${network}_${slot}.json`,
  );
  const outputData = {
    network,
    slot,
    committee_pk: committeePk,
  };

  fs.writeFileSync(outputFilePath, JSON.stringify(outputData, null, 2), 'utf8');
  console.log(`Output saved to ${outputFilePath}`);
};

const args = process.argv.slice(2);
const network = args[0];
const slot = parseInt(args[1], 10);

if (!network || isNaN(slot)) {
  console.error('Usage: node gen-comittee-pks.js <network> <slot>');
  process.exit(1);
}

extractPublicKeys(network, slot);
