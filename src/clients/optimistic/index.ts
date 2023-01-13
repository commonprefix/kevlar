import { isUint8ArrayEq } from '../../utils.js';
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
    return await this.provers[proverIndex].getCommittee(period);
  }

  async checkCommitteeHashAt(proverIndex: number, expectedCommitteeHash: Uint8Array, period: number, prevCommittee: Uint8Array[]): Promise<boolean> {
    const update = await this.provers[proverIndex].getSyncUpdate(period - 1);
    const validOrCommittee = await this.syncUpdateVerifyGetCommittee(prevCommittee, period, update);
    return validOrCommittee && isUint8ArrayEq(this.getCommitteeHash(validOrCommittee), expectedCommitteeHash);
  }

  async fight(prover1: ProverInfoL, prover2: ProverInfoL, period: number, prevCommitteeHash: Uint8Array): Promise<[boolean, boolean]> {
    let prevCommittee = period === this.genesisPeriod ? this.genesisCommittee : await this.getCommittee(period - 1, prover1.index, prevCommitteeHash)
    prevCommittee = prevCommittee || await this.getCommittee(period - 1, prover2.index, prevCommitteeHash)
    return [await this.checkCommitteeHashAt(prover1.index, prover1.syncCommitteeHash, period, prevCommittee),
    await this.checkCommitteeHashAt(prover2.index, prover2.syncCommitteeHash, period, prevCommittee)];
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
  async syncFromGenesis(): Promise<ProverInfo[]> {
    const currentPeriod = this.getCurrentPeriod();
    let lastCommitteeHash: Uint8Array = this.getCommitteeHash(this.genesisCommittee);
    let proverInfos: ProverInfoL[] = this.provers.map((_, i) => ({index: i, syncCommitteeHash: new Uint8Array()}));
    let foundConflict = false;
    for (let period = this.genesisPeriod + 1; period <= currentPeriod; period++) {
      const committeeHashes: (Uint8Array | null)[] = await Promise.all(proverInfos.map(async pi => {
      try {
        return await this.provers[pi.index].getCommitteeHash(period, currentPeriod, this.batchSize);
      } catch (e) {
        return null;
      }
      }));
      const nonNullIndex = committeeHashes.findIndex(v => v !== null);
      if (nonNullIndex === -1) {
        proverInfos = [];
        break;
      }
    
      for (let j = nonNullIndex + 1; j < committeeHashes.length; j++) {
        if (committeeHashes[j] !== null && !isUint8ArrayEq(committeeHashes[j]!, committeeHashes[nonNullIndex]!)) {
          foundConflict = true;
          break;
        }
      }
      if (!foundConflict) {
        const index = proverInfos[nonNullIndex].index;
        const committee = await this.getCommittee(currentPeriod, index, committeeHashes[nonNullIndex]!);
        return [{index: index, syncCommittee: committee}];
      }
      proverInfos = proverInfos.filter((pi: ProverInfoL, i: number) => (committeeHashes[i] !== null));
      proverInfos = await this.tournament(proverInfos, period, lastCommitteeHash);
      if (proverInfos.length === 0) throw new Error('none of the provers responded honestly :(');
      else if (proverInfos.length === 1) {
        try {
          lastCommitteeHash = await this.provers[proverInfos[0].index].getCommitteeHash(currentPeriod, currentPeriod, this.batchSize);
          break;
        } catch (e) {
          throw new Error(`none of the provers responded honestly :( : ${e.message}`);
        }
      } else lastCommitteeHash = proverInfos[0].syncCommitteeHash;
    
      foundConflict = false;
    }
    for (const p of proverInfos) {
      try {
      const committee = await this.getCommittee(currentPeriod, p.index, lastCommitteeHash);
      return [{index: p.index, syncCommittee: committee}
      ];
      } catch (e) {}
    }
    throw new Error('none of the provers responded honestly :(');
  }
}
