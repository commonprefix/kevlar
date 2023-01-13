import { concatUint8Array, isUint8ArrayEq, smallHexStr } from '../../utils.js';
import { BaseClient } from '../base-client.js';
import { ClientConfig, ProverInfo } from '../types.js';
import { IProver } from './iprover.js';
import { DEFAULT_BATCH_SIZE } from '../constants.js';

export type ProverInfoL = {
  syncCommitteeHash: Uint8Array;
  index: number;
};

export class OptimisticLightClient extends BaseClient {
  batchSize: number;

  constructor(
    config: ClientConfig,
    beaconChainAPIURL: string,
    protected provers: IProver[],
  ) {
    super(config, beaconChainAPIURL);
    this.batchSize = config.n || DEFAULT_BATCH_SIZE;
  }

  async getCommittee(
    period: number,
    proverIndex: number,
    expectedCommitteeHash: Uint8Array | null,
  ): Promise<Uint8Array[]> {
    if (period === this.genesisPeriod) return this.genesisCommittee;
    if (!expectedCommitteeHash) throw new Error('expectedCommitteeHash required');
    const committee = await this.provers[proverIndex].getCommittee(period);
    const committeeHash = this.getCommitteeHash(committee);
    if (!isUint8ArrayEq(committeeHash, expectedCommitteeHash as Uint8Array)) throw new Error('prover responded with an incorrect committee');
    return committee;
  }

  async checkCommitteeHashAt(
    proverIndex: number,
    expectedCommitteeHash: Uint8Array,
    period: number,
    prevCommittee: Uint8Array[],
  ): Promise<boolean> {
    
    try {
      const update = await this.provers[proverIndex].getSyncUpdate(period - 1);
      const validOrCommittee = await this.syncUpdateVerifyGetCommittee(
        prevCommittee,
        period,
        update,
      );
      if (!(validOrCommittee as boolean)) return false;
      const committeeHash = this.getCommitteeHash(
        validOrCommittee as Uint8Array[],
      );
      
      return isUint8ArrayEq(committeeHash, expectedCommitteeHash);
    } catch (e) {
      console.error(
        `failed to check committee hash for prover(${proverIndex}) at period(${period})`,
        e,
      );
      return false;
    }
  }

  async fight(prover1: ProverInfoL, prover2: ProverInfoL, period: number, prevCommitteeHash: Uint8Array): Promise<boolean> {
    let prevCommittee = period === this.genesisPeriod ? this.genesisCommittee : await this.getCommittee(period - 1, prover1.index, prevCommitteeHash)
    try {
      prevCommittee = prevCommittee || await this.getCommittee(period - 1, prover2.index, prevCommitteeHash)
    } catch (e) {
      console.error(`failed to fetch committee from provers for period(${period - 1})`, e)
      throw new Error(`failed to fetch committee from all provers for period(${period - 1})`)
    }
    const isProver1Correct = await this.checkCommitteeHashAt(prover1.index, prover1.syncCommitteeHash, period, prevCommittee);
    if (isProver1Correct) return true
    const isProver2Correct = await this.checkCommitteeHashAt(prover2.index, prover2.syncCommitteeHash, period, prevCommittee);
    if (isProver2Correct) return false;
    throw new Error('both updates can not be correct at the same time');
  }

  async tournament(proverInfos: ProverInfoL[], period: number, lastCommitteeHash: Uint8Array) {
    let winners = [proverInfos[0]];
    for (let i = 1; i < proverInfos.length; i++) {
        const currProver = proverInfos[i];
        if (isUint8ArrayEq(winners[0].syncCommitteeHash, currProver.syncCommitteeHash)) {
            winners.push(currProver);
        } else {
            const areCurrentWinnersHonest = await this.fight(winners[0], currProver, period, lastCommitteeHash);
            if (!areCurrentWinnersHonest) winners = [currProver];
        }
    }
    return winners;
  }

  // returns the prover info containing the current sync
  // committee and prover index of the first honest prover
  protected async syncFromGenesis(): Promise<ProverInfo[]> {
    // get the tree size by currentPeriod - genesisPeriod
    const currentPeriod = this.getCurrentPeriod();
    let startPeriod = this.genesisPeriod;
    console.log(
      `Sync started using ${this.provers.length} Provers from period(${startPeriod}) to period(${currentPeriod})`,
    );

    let lastCommitteeHash: Uint8Array = this.getCommitteeHash(
      this.genesisCommittee,
    );
    let proverInfos: ProverInfoL[] = this.provers.map((_, i) => ({
      index: i,
      syncCommitteeHash: new Uint8Array(),
    }));

    for (let period = startPeriod + 1; period <= currentPeriod; period++) {
      const committeeHashes: (Uint8Array | null)[] = await Promise.all(
        proverInfos.map(async pi => {
          try {
            return await this.provers[pi.index].getCommitteeHash(
              period,
              currentPeriod,
              this.batchSize,
            );
          } catch (e) {
            console.error(
              `failed to fetch committee hash for prover(${pi.index}) at period(${period})`,
              e,
            );
            return null;
          }
        }),
      );

      const nonNullIndex = committeeHashes.findIndex(v => v !== null);
      if (nonNullIndex === -1) {
        proverInfos = [];
        break;
      }

      let foundConflict = false;
      for (let j = nonNullIndex + 1; j < committeeHashes.length; j++) {
        if (
          committeeHashes[j] !== null &&
          !isUint8ArrayEq(committeeHashes[j]!, committeeHashes[nonNullIndex]!)
        ) {
          foundConflict = true;
          break;
        }
      }

      proverInfos = proverInfos.reduce(
        (acc: ProverInfoL[], pi: ProverInfoL, i: number) => {
          if (committeeHashes[i] !== null) {
            acc.push({
              ...pi,
              syncCommitteeHash: committeeHashes[i]!,
            });
          }
          return acc;
        },
        [],
      );

      if (foundConflict) {
        proverInfos = await this.tournament(
          proverInfos,
          period,
          lastCommitteeHash,
        );
      }

      if (proverInfos.length === 0) {
        throw new Error('none of the provers responded honestly :(');
      } else if (proverInfos.length === 1) {
        try {
          lastCommitteeHash = await this.provers[
            proverInfos[0].index
          ].getCommitteeHash(currentPeriod, currentPeriod, this.batchSize);
          break;
        } catch (e) {
          throw new Error(
            `none of the provers responded honestly :( : ${e.message}`,
          );
        }
      } else {
        lastCommitteeHash = proverInfos[0].syncCommitteeHash;
      }
    }

    for (const p of proverInfos) {
      try {
        const committee = await this.getCommittee(
          currentPeriod,
          p.index,
          lastCommitteeHash,
        );
        return [
          {
            index: p.index,
            syncCommittee: committee,
          },
        ];
      } catch (e) {
        console.error(
          `seemingly honest prover(${p.index}) responded incorrectly!`,
        );
      }
    }
    throw new Error('none of the provers responded honestly :(');
  }
}
