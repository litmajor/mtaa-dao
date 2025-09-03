
import { db } from './db';
import { eq, and, gte, sql } from 'drizzle-orm';
import { userReputation, msiaMoConversions, airdropEligibility } from '../shared/reputationSchema';
import { users } from '../shared/schema';
import { sendCUSD } from './blockchain';

export interface AirdropCampaign {
  id: string;
  name: string;
  totalTokens: number;
  minimumReputation: number;
  baseAmount: number;
  maxMultiplier: number;
  startDate: Date;
  endDate: Date;
  tokenAddress?: string;
  isActive: boolean;
}

export class AirdropService {
  // Create new airdrop campaign
  static async createAirdropCampaign(campaign: Omit<AirdropCampaign, 'id'>): Promise<string> {
    const campaignId = `airdrop_${Date.now()}`;
    
    // Store campaign in database (you may want to create an airdrops table)
    // For now, we'll use the existing airdropEligibility table structure
    
    return campaignId;
  }

  // Calculate airdrop eligibility for all users
  static async calculateAirdropEligibility(
    airdropId: string,
    minimumReputation: number,
    baseAmount: number,
    maxMultiplier: number = 5
  ): Promise<{ processed: number; eligible: number }> {
    const users = await db
      .select({
        userId: userReputation.userId,
        totalPoints: userReputation.totalPoints,
        badge: userReputation.badge,
      })
      .from(userReputation)
      .where(gte(userReputation.totalPoints, minimumReputation));

    let processed = 0;
    let eligible = 0;

    for (const user of users) {
      const reputationMultiplier = Math.min(user.totalPoints / minimumReputation, maxMultiplier);
      const airdropAmount = baseAmount * reputationMultiplier;

      // Apply badge bonus
      const badgeMultiplier = this.getBadgeMultiplier(user.badge);
      const finalAmount = airdropAmount * badgeMultiplier;

      await db.insert(airdropEligibility).values({
        userId: user.userId,
        airdropId,
        eligibleAmount: finalAmount.toString(),
        minimumReputation,
        userReputation: user.totalPoints,
        claimed: false,
      });

      processed++;
      eligible++;
    }

    return { processed, eligible };
  }

  // Execute airdrop distribution
  static async executeAirdrop(airdropId: string): Promise<{ success: number; failed: number }> {
    const eligibleUsers = await db
      .select()
      .from(airdropEligibility)
      .where(
        and(
          eq(airdropEligibility.airdropId, airdropId),
          eq(airdropEligibility.claimed, false)
        )
      );

    let success = 0;
    let failed = 0;

    for (const eligibility of eligibleUsers) {
      try {
        // Get user wallet address
        const user = await db
          .select({ walletAddress: users.walletAddress })
          .from(users)
          .where(eq(users.id, eligibility.userId));

        if (!user[0]?.walletAddress) {
          failed++;
          continue;
        }

        // Send tokens (using cUSD for now)
        const txHash = await sendCUSD(
          user[0].walletAddress,
          eligibility.eligibleAmount
        );

        // Mark as claimed
        await db
          .update(airdropEligibility)
          .set({
            claimed: true,
            claimedAt: new Date(),
            transactionHash: txHash,
          })
          .where(eq(airdropEligibility.id, eligibility.id));

        success++;
      } catch (error) {
        console.error(`Airdrop failed for user ${eligibility.userId}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  // Get badge multiplier for airdrop calculations
  private static getBadgeMultiplier(badge: string): number {
    switch (badge) {
      case 'Diamond': return 2.0;
      case 'Platinum': return 1.8;
      case 'Gold': return 1.5;
      case 'Silver': return 1.2;
      default: return 1.0;
    }
  }

  // Check user's airdrop eligibility
  static async getUserAirdropEligibility(userId: string): Promise<any[]> {
    return await db
      .select()
      .from(airdropEligibility)
      .where(eq(airdropEligibility.userId, userId));
  }

  // Claim airdrop for user
  static async claimAirdrop(userId: string, airdropId: string): Promise<string> {
    const eligibility = await db
      .select()
      .from(airdropEligibility)
      .where(
        and(
          eq(airdropEligibility.userId, userId),
          eq(airdropEligibility.airdropId, airdropId),
          eq(airdropEligibility.claimed, false)
        )
      );

    if (!eligibility[0]) {
      throw new Error('No eligible airdrop found or already claimed');
    }

    // Get user wallet
    const user = await db
      .select({ walletAddress: users.walletAddress })
      .from(users)
      .where(eq(users.id, userId));

    if (!user[0]?.walletAddress) {
      throw new Error('User wallet address not found');
    }

    // Send tokens
    const txHash = await sendCUSD(
      user[0].walletAddress,
      eligibility[0].eligibleAmount
    );

    // Mark as claimed
    await db
      .update(airdropEligibility)
      .set({
        claimed: true,
        claimedAt: new Date(),
        transactionHash: txHash,
      })
      .where(eq(airdropEligibility.id, eligibility[0].id));

    return txHash;
  }
}
