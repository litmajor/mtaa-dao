import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { createWalletIfValid } from '../utils/cryptoWallet';

const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const PRIVATE_KEY = process.env.ACHIEVEMENT_SIGNER_PRIVATE_KEY || '';
const ACHIEVEMENT_CONTRACT_ADDRESS = process.env.ACHIEVEMENT_CONTRACT_ADDRESS || '';

function loadAbi() {
  const abiPath = path.resolve(__dirname, '..', '..', 'artifacts', 'contracts', 'AchievementNFTv2.sol', 'AchievementNFTv2.json');
  const json = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  return json.abi;
}

export async function mintAchievementOnChain(to: string, params: {
  name: string;
  category: string;
  tier?: number;
  rarity?: number;
  rewardPoints?: number;
  rewardTokens?: number;
  imageUrl?: string;
  metadataUri?: string;
  tradeable?: boolean;
  burnable?: boolean;
  milestoneLevel?: number;
}) {
  if (!ACHIEVEMENT_CONTRACT_ADDRESS) throw new Error('ACHIEVEMENT_CONTRACT_ADDRESS not configured');
  if (!PRIVATE_KEY) throw new Error('ACHIEVEMENT_SIGNER_PRIVATE_KEY not configured');
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = createWalletIfValid(PRIVATE_KEY, provider);
  if (!signer) throw new Error('ACHIEVEMENT_SIGNER_PRIVATE_KEY not configured or invalid');
  const abi = loadAbi();
  const contract = new ethers.Contract(ACHIEVEMENT_CONTRACT_ADDRESS, abi, signer);

  const tier = params.tier ?? 1;
  const rarity = params.rarity ?? 0;
  const rewardPoints = BigInt(params.rewardPoints ?? 0);
  const rewardTokens = BigInt(params.rewardTokens ?? 0);
  const imageUrl = params.imageUrl ?? '';
  const metadataUri = params.metadataUri ?? '';
  const tradeable = params.tradeable ?? false;
  const burnable = params.burnable ?? false;
  const milestoneLevel = BigInt(params.milestoneLevel ?? 0);

  // Retry wrapper with exponential backoff
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const tx = await contract.mintAchievement(
        to,
        params.name,
        params.category,
        tier,
        rarity,
        rewardPoints,
        rewardTokens,
        imageUrl,
        metadataUri,
        tradeable,
        burnable,
        milestoneLevel
      );

      const receipt = await tx.wait();

      // Try to find AchievementMinted event in receipt
      let tokenId: string | null = null;
      for (const ev of receipt.events || []) {
        if (ev.event === 'AchievementMinted') {
          const args = ev.args as any;
          if (args && args[0] != null) {
            tokenId = args[0].toString();
            break;
          }
        }
      }

      return { txHash: receipt.transactionHash, blockNumber: receipt.blockNumber, tokenId };
    } catch (err: any) {
      const isLast = attempt === maxAttempts;
      const msg = err && err.message ? err.message : String(err);
      console.warn(`mintAchievementOnChain attempt ${attempt} failed: ${msg}`);
      if (isLast) throw err;
      // exponential backoff
      const delayMs = Math.pow(2, attempt) * 1000;
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }

  // should never reach here
  throw new Error('mintAchievementOnChain: unexpected failure');
}

export function getAchievementAbi() {
  return loadAbi();
}
