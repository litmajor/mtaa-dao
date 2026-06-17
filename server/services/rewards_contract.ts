import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';

const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const PRIVATE_KEY = process.env.REWARDS_SIGNER_PRIVATE_KEY || '';
const REWARDS_CONTRACT_ADDRESS = process.env.REWARDS_CONTRACT_ADDRESS || '';

function loadAbi() {
  const abiPath = path.resolve(__dirname, '..', '..', 'artifacts', 'contracts', 'MtaaGovernance.sol', 'MTAARewardsManager.json');
  const json = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  return json.abi;
}

export async function batchDistributeOnChain(recipients: string[], amounts: bigint[], rewardType: number = 0, reason: string = 'achievement_batch') {
  if (!REWARDS_CONTRACT_ADDRESS) throw new Error('REWARDS_CONTRACT_ADDRESS not configured');
  if (!PRIVATE_KEY) throw new Error('REWARDS_SIGNER_PRIVATE_KEY not configured');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  const abi = loadAbi();
  const contract = new ethers.Contract(REWARDS_CONTRACT_ADDRESS, abi, signer);

  // convert bigint amounts to strings or ethers BigNumber
  const amountsBN = amounts.map(a => a.toString());

  const tx = await contract.batchDistribute(recipients, amountsBN, rewardType, reason);
  const receipt = await tx.wait();
  return { txHash: receipt.transactionHash, blockNumber: receipt.blockNumber };
}
