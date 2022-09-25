import { concatUint8Array, isUint8ArrayEq, smallHexStr } from '../../utils.js';
import { BaseClient } from '../base-client.js';
import { ClientConfig, ProverInfo } from '../types.js';
import { IProver } from './iprover.js';
import { IStore } from './istore';
import { DEFAULT_BATCH_SIZE } from '../constants.js';

export class LightClient extends BaseClient {
  batchSize: number;

  constructor(
    config: ClientConfig,
    beaconChainAPIURL: string,
    protected provers: IProver[],
    protected store?: IStore,
  ) {
    super(config, beaconChainAPIURL);
    this.batchSize = config.n || DEFAULT_BATCH_SIZE;
  }

  // Returns the last valid sync committee
  async syncProver(
    prover: IProver,
    startPeriod: number,
    currentPeriod: number,
    startCommittee: Uint8Array[],
  ): Promise<{ syncCommittee: Uint8Array[]; period: number }> {
    for (let period = startPeriod; period < currentPeriod; period += 1) {
      const update = await prover.getSyncUpdate(
        period,
        currentPeriod,
        this.batchSize,
      );
      const validOrCommittee = this.syncUpdateVerifyGetCommittee(
        startCommittee,
        update,
      );

      if (!(validOrCommittee as boolean)) {
        console.log(`Found invalid update at period(${period})`);
        return {
          syncCommittee: startCommittee,
          period,
        };
      }

      if (this.store) await this.store.addUpdate(period, update);
      startCommittee = validOrCommittee as Uint8Array[];
    }
    return {
      syncCommittee: startCommittee,
      period: currentPeriod,
    };
  }

  // returns the prover info containing the current sync
  // committee and prover index of the first honest prover
  protected async syncFromGenesis(): Promise<ProverInfo[]> {
    // get the tree size by currentPeriod - genesisPeriod
    const currentPeriod = this.getCurrentPeriod();
    let startPeriod = this.genesisPeriod;
    let startCommittee = this.genesisCommittee;
    console.log(
      `Sync started using ${this.provers.length} Provers from period(${startPeriod}) to period(${currentPeriod})`,
    );

    for (let i = 0; i < this.provers.length; i++) {
      const prover = this.provers[i];
      console.log(`Validating Prover(${i})`);
      const { syncCommittee, period } = await this.syncProver(
        prover,
        startPeriod,
        currentPeriod,
        startCommittee,
      );
      if (period === currentPeriod) {
        return [
          {
            index: i,
            syncCommittee,
          },
        ];
      }
      startPeriod = period;
      startCommittee = syncCommittee;
    }
    throw new Error('no honest prover found');
  }
}
