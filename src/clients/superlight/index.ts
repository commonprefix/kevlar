import { digest } from '@chainsafe/as-sha256';
import {
  concatUint8Array,
  isUint8ArrayEq,
  smallHexStr,
  isCommitteeSame,
  logFloor,
} from '../../utils.js';
import { MerkleVerify } from './merkle-tree.js';
import { MerkleMountainVerify, Peaks } from './merkle-mountain-range.js';
import { BaseClient } from '../base-client.js';
import { ClientConfig, ProverInfo } from '../types.js';
import { IProver } from './iprover.js';
import { DEFAULT_TREE_DEGREE } from '../constants.js';

type ProverInfoSL = {
  root: Uint8Array;
  peaks: Peaks;
  index: number;
};

export class SuperlightClient extends BaseClient {
  merkleVerify: MerkleVerify;
  merkleMountainVerify: MerkleMountainVerify;
  treeDegree: number;

  constructor(
    config: ClientConfig,
    beaconChainAPIURL: string,
    protected provers: IProver[],
  ) {
    super(config, beaconChainAPIURL);
    this.treeDegree = config.n || DEFAULT_TREE_DEGREE;
    this.merkleVerify = new MerkleVerify(digest, config.n);
    this.merkleMountainVerify = new MerkleMountainVerify(digest, config.n);
  }

  protected async getVerifiedSyncCommittee(
    prover: IProver,
    period: number | 'latest',
    verifiedPeaks: Peaks,
  ): Promise<Uint8Array[] | false> {
    const { syncCommittee, proof } = await prover.getLeafWithProof(period);
    const lastPeak = verifiedPeaks[verifiedPeaks.length - 1];
    const { peak, index } =
      period === 'latest'
        ? { peak: lastPeak, index: lastPeak.size - 1 }
        : this.merkleMountainVerify.getPeakAndIndex(verifiedPeaks, period);
    const leafHash = digest(concatUint8Array(syncCommittee));
    const isSyncValid = this.merkleVerify.verify(
      leafHash,
      index,
      peak.rootHash,
      proof,
    );
    if (!isSyncValid) return false;
    else return syncCommittee;
  }

  protected async checkNodeAndPrevUpdate(
    prover1: IProver,
    prover2: IProver,
    peaks1: Peaks,
    peaks2: Peaks,
    period: number,
  ): Promise<boolean> {
    const committee1 = await this.getVerifiedSyncCommittee(
      prover1,
      period,
      peaks1,
    );
    if (!committee1) return false;

    const committee2 = await this.getVerifiedSyncCommittee(
      prover2,
      period,
      peaks2,
    );
    if (!committee2) return true;

    let is1Correct = false;
    let is2Correct = false;
    if (period === 0) {
      // If period is zero then we can check against
      // the genesis sync committee that is known
      const genesisCommittee = this.genesisCommittee;
      is1Correct = isCommitteeSame(genesisCommittee, committee1);
      is2Correct = isCommitteeSame(genesisCommittee, committee2);
    } else {
      const lastPeriod = period - 1;
      // ask for the previous leaf from either
      // parties with a merkle proof
      const prevCommittee = await this.getVerifiedSyncCommittee(
        prover1,
        lastPeriod,
        peaks1,
      );
      if (!prevCommittee) return false;

      // ask both parties for sync update
      // related to previous period
      const update1 = await prover1.getSyncUpdate(lastPeriod, 1);
      is1Correct = await this.syncUpdateVerify(
        prevCommittee,
        committee1,
        period,
        update1,
      );

      const update2 = await prover2.getSyncUpdate(lastPeriod, 1);
      is2Correct = await this.syncUpdateVerify(
        prevCommittee,
        committee2,
        period,
        update2,
      );
    }

    if (is1Correct && !is2Correct) return true;
    else if (is2Correct && !is1Correct) return false;
    else if (!is2Correct && !is1Correct) {
      // If both of them are correct we can return either
      // true or false. The one honest prover will defeat
      // this prover later
      return false;
    } else throw new Error('both updates can not be correct at the same time');
  }

  protected async treeVsTree(
    prover1: IProver,
    prover2: IProver,
    tree1: Uint8Array,
    tree2: Uint8Array,
    stepsToLeafs: number,
    node1: Uint8Array = tree1,
    node2: Uint8Array = tree2,
    index: number = 0,
  ): Promise<boolean | number> {
    // if (nodeInfo1.isLeaf !== nodeInfo2.isLeaf)
    //   throw new Error('tree of unequal heights received');

    // if you reach the leaf then this is the first point of disagreement
    if (stepsToLeafs === 0) {
      console.log(`Found first point of disagreement at index(${index})`);
      return index;
    } else {
      // get node info
      const nodeInfo1 = await prover1.getNode(tree1, node1);
      const nodeInfo2 = await prover2.getNode(tree2, node2);

      const children1 = nodeInfo1.children!;
      console.log(`Compare node1(${smallHexStr(node1)})`);
      const children2 = nodeInfo2.children!;
      console.log(`Compare node2(${smallHexStr(node2)})`);
      // check the children are correct
      const parentHash1 = digest(concatUint8Array(children1));
      if (
        children1.length !== this.treeDegree ||
        !isUint8ArrayEq(parentHash1, node1)
      )
        return false;

      const parentHash2 = digest(concatUint8Array(children2));
      if (
        children2.length !== this.treeDegree ||
        !isUint8ArrayEq(parentHash2, node2)
      )
        return true;

      // find the first point of disagreement
      for (let i = 0; i < this.treeDegree; i++) {
        if (!isUint8ArrayEq(children1[i], children2[i])) {
          return await this.treeVsTree(
            prover1,
            prover2,
            tree1,
            tree2,
            stepsToLeafs - 1,
            children1[i],
            children2[i],
            index * this.treeDegree + i,
          );
        }
      }
      throw new Error('all the children can not be same');
    }
  }

  // return true if the first prover wins
  protected async peaksVsPeaks(
    prover1: IProver,
    prover2: IProver,
    peaks1: Peaks,
    peaks2: Peaks,
  ): Promise<boolean> {
    if (peaks1.length !== peaks2.length)
      throw new Error('there should be equal number of peaks');
    let offset = 0;
    for (let i = 0; i < peaks1.length; i++) {
      // check the first peak of disagreement
      if (!isUint8ArrayEq(peaks1[i].rootHash, peaks2[i].rootHash)) {
        // run tree vs tree bisection game
        console.log(
          `TreeVsTree for Peak(${smallHexStr(
            peaks1[i].rootHash,
          )}) and Peak(${smallHexStr(peaks2[i].rootHash)}) of size(${
            peaks2[i].size
          })`,
        );
        const winnerOrIndexOfDifference = await this.treeVsTree(
          prover1,
          prover2,
          peaks1[i].rootHash,
          peaks2[i].rootHash,
          logFloor(peaks1[i].size, this.treeDegree),
        );
        if (typeof winnerOrIndexOfDifference === 'boolean')
          return winnerOrIndexOfDifference;
        else
          return this.checkNodeAndPrevUpdate(
            prover1,
            prover2,
            peaks1,
            peaks2,
            winnerOrIndexOfDifference + offset,
          );
      }
      offset += peaks1[i].size;
    }
    throw new Error('all peaks should not be same');
  }

  // returns the prover info of the honest provers
  protected async tournament(
    proverInfos: ProverInfoSL[],
  ): Promise<ProverInfoSL[]> {
    let winners = [proverInfos[0]];
    for (let i = 1; i < proverInfos.length; i++) {
      // Consider one of the winner for thi current round
      const currWinner = winners[0];
      const currProver = proverInfos[i];
      if (isUint8ArrayEq(currWinner.root, currProver.root)) {
        // if the prover has the same root as the current
        // winners simply add it to list of winners
        console.log(
          `Prover(${currProver.index}) added to the existing winners list`,
        );
        winners.push(currProver);
      } else {
        console.log(
          `PeaksVsPeaks between Prover(${currWinner.index}) and Prover(${currProver.index})`,
        );
        const areCurrentWinnersHonest = await this.peaksVsPeaks(
          this.provers[currWinner.index],
          this.provers[currProver.index],
          currWinner.peaks,
          currProver.peaks,
        );
        // If the winner lost discard all the existing winners
        if (!areCurrentWinnersHonest) {
          console.log(
            `Prover(${currProver.index}) defeated all existing winners`,
          );
          winners = [currProver];
        }
      }
    }
    return winners;
  }

  // returns the prover info containing the current sync
  // committee and prover index of the honest provers
  protected async syncFromGenesis(): Promise<ProverInfo[]> {
    // get the tree size by currentPeriod - genesisPeriod
    const currentPeriod = this.getCurrentPeriod();
    const genesisPeriod = this.genesisPeriod;
    const mmrSize = currentPeriod - genesisPeriod + 1;
    console.log(
      `Sync started using ${this.provers.length} Provers from period(${genesisPeriod}) to period(${currentPeriod})`,
    );

    const validProverInfos = [];
    for (let i = 0; i < this.provers.length; i++) {
      const prover = this.provers[i];
      const mmrInfo = await prover.getMMRInfo();
      const isMMRCorrect = this.merkleMountainVerify.verify(
        mmrInfo.rootHash,
        mmrInfo.peaks,
        mmrSize,
      );
      if (!isMMRCorrect) {
        console.log(`Prover(${i}) filtered because of incorrect MMR`);
        continue;
      }

      validProverInfos.push({
        root: mmrInfo.rootHash,
        peaks: mmrInfo.peaks,
        index: i,
      });
    }

    const winners = await this.tournament(validProverInfos);

    for (const winner of winners) {
      const syncCommittee = await this.getVerifiedSyncCommittee(
        this.provers[winner.index],
        'latest',
        winner.peaks,
      );
      if (syncCommittee) {
        return [
          {
            index: winner.index,
            syncCommittee,
          },
        ];
      }
    }
    throw new Error('all winners cheated');
  }
}
