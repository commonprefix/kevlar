// import Web3 from 'web3';
// import { ExecutionInfo } from './types';

// export class EthereumBlockDecoder {
//     private web3: Web3;

//     constructor(web3: Web3) {
//         this.web3 = web3;
//     }

//     async decodeBlock(blockNumber: number): Promise<ExecutionInfo> {
//         const block = await this.web3.eth.getBlock(blockNumber);
//         const transactions = await this.decodeTransactions(block.transactions);
//         return {
//             blockNumber: BigInt(block.number),
//             // timestamp: block.timestamp,
//             // transactions,
//         }
//     }

//     async decodeTransactions(transactions: string[]): Promise<any[]> {
//         const decodedTransactions = [];
//         for (const tx of transactions) {
//             const receipt = await this.web3.eth.getTransactionReceipt(tx);
//             const transaction = await this.web3.eth.getTransaction(tx);
//             const decodedTransaction = {
//                 transactionHash: receipt.transactionHash,
//                 from: transaction.from,
//                 to: transaction.to,
//                 value: this.web3.utils.fromWei(transaction.value, 'ether'),
//                 gasUsed: receipt.gasUsed,
//             }
//             decodedTransactions.push(decodedTransaction);
//         }
//         return decodedTransactions;
//     }
// }
