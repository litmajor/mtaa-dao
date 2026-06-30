import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { createWalletIfValid } from '../utils/cryptoWallet';

const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const PRIVATE_KEY = process.env.ROTATION_SIGNER_PRIVATE_KEY || '';
const ROTATION_MODULE_ADDRESS = process.env.ROTATION_MODULE_ADDRESS || '';

function loadAbi() {
  const abiPath = path.resolve(__dirname, '..', '..', 'artifacts', 'contracts', 'RotationModule.sol', 'RotationModule.json');
  const json = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  return json.abi;
}

export async function distributeToRecipientOnChain(vaultAddress: string) {
  if (!ROTATION_MODULE_ADDRESS) throw new Error('ROTATION_MODULE_ADDRESS not configured');
  if (!PRIVATE_KEY) throw new Error('ROTATION_SIGNER_PRIVATE_KEY not configured');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = createWalletIfValid(PRIVATE_KEY, provider);
  if (!signer) throw new Error('ROTATION_SIGNER_PRIVATE_KEY not configured or invalid');

  const abi = loadAbi();
  const contract = new ethers.Contract(ROTATION_MODULE_ADDRESS, abi, signer);

  const tx = await contract.distributeToRecipient(vaultAddress);
  const receipt = await tx.wait();
  return { txHash: receipt.transactionHash, blockNumber: receipt.blockNumber };
}

export function getRotationAbi() {
  return loadAbi();
}
