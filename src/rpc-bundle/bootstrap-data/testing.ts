import axios from 'axios';

    export const config = await axios.get(
        `https://lodestar-mainnet.chainsafe.io/eth/v1/beacon/light_client/bootstrap/0x2717a90fa0cabc1dbe6e7c5b3e90d112465038e6820b42731d6ef21d2668b679`,
    );
    console.log(config.data)
