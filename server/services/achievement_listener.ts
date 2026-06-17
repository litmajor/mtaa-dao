import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { users } from '../../shared/schema';
import { achievements, userAchievements } from '../../shared/achievementSchema';
import { eq, and, sql } from 'drizzle-orm';

const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const ACHIEVEMENT_CONTRACT_ADDRESS = process.env.ACHIEVEMENT_CONTRACT_ADDRESS || '';

function loadAbi() {
  const abiPath = path.resolve(__dirname, '..', '..', 'artifacts', 'contracts', 'AchievementNFTv2.sol', 'AchievementNFTv2.json');
  const json = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  return json.abi;
}

export function startAchievementListener() {
  if (!ACHIEVEMENT_CONTRACT_ADDRESS) {
    console.warn('ACHIEVEMENT_CONTRACT_ADDRESS not set — achievement listener disabled');
    return;
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const abi = loadAbi();
  const contract = new ethers.Contract(ACHIEVEMENT_CONTRACT_ADDRESS, abi, provider);

  contract.on('AchievementMinted', async (tokenId: any, owner: string, name: string, tier: any, rewardPoints: any, event: any) => {
    try {
      const ownerLc = (owner || '').toLowerCase();
      // find user by walletAddress (case-insensitive)
      const found = await db.select().from(users).where(sql`${users.walletAddress} ILIKE ${ownerLc}`);
      if (!found || found.length === 0) return;
      const user = found[0];

      // find achievement by name
      const ach = await db.select().from(achievements).where(eq(achievements.name, name));
      if (!ach || ach.length === 0) return;
      const achievementRow = ach[0];

      // update userAchievements row for this user and achievement
      await db.update(userAchievements)
        .set({ tokenId: tokenId.toString(), mintPending: false, mintedAt: new Date() })
        .where(and(eq(userAchievements.userId, user.id), eq(userAchievements.achievementId, achievementRow.id)) as any);
    } catch (err) {
      console.warn('Error processing AchievementMinted event:', err instanceof Error ? err.message : err);
    }
  });

  console.info('[STARTUP] Achievement event listener registered');
}
