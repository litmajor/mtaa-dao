
import { db } from './db';
import { eq, and, gte, sql } from 'drizzle-orm';
import { achievements, userAchievements, achievementProgress } from '../shared/achievementSchema';
import { mintAchievementOnChain } from './services/achievement_contract';
import { users } from '../shared/schema';
import { msiaMoPoints, userGamification } from '../shared/reputationSchema';
import { votes, proposals, contributions } from '../shared/schema';
import { ReputationService } from './reputationService';

export class AchievementService {
  // Initialize default achievements
  static async initializeDefaultAchievements(): Promise<void> {
    const defaultAchievements = [
      {
        name: "First Vote",
        description: "Cast your first vote in any proposal",
        category: "voting",
        criteria: JSON.stringify({ action: "vote", count: 1 }),
        rewardPoints: 50,
        rewardTokens: "1",
        badge: "Voter",
        icon: "🗳️",
        rarity: "common"
      },
      {
        name: "Democracy Champion",
        description: "Vote on 50 different proposals",
        category: "voting",
        criteria: JSON.stringify({ action: "vote", count: 50 }),
        rewardPoints: 500,
        rewardTokens: "10",
        badge: "Champion",
        icon: "🏆",
        rarity: "rare"
      },
      {
        name: "Proposal Pioneer",
        description: "Create your first proposal",
        category: "governance",
        criteria: JSON.stringify({ action: "proposal_created", count: 1 }),
        rewardPoints: 100,
        rewardTokens: "5",
        badge: "Pioneer",
        icon: "💡",
        rarity: "common"
      },
      {
        name: "Community Builder",
        description: "Have 10 of your proposals pass",
        category: "governance",
        criteria: JSON.stringify({ action: "proposal_passed", count: 10 }),
        rewardPoints: 1000,
        rewardTokens: "25",
        badge: "Builder",
        icon: "🏗️",
        rarity: "epic"
      },
      {
        name: "Generous Soul",
        description: "Contribute a total of 1000 cUSD",
        category: "contribution",
        criteria: JSON.stringify({ action: "contribution_total", amount: 1000 }),
        rewardPoints: 2000,
        rewardTokens: "50",
        badge: "Generous",
        icon: "💝",
        rarity: "epic"
      },
      {
        name: "Streak Master",
        description: "Maintain a 30-day activity streak",
        category: "streak",
        criteria: JSON.stringify({ action: "daily_streak", count: 30 }),
        rewardPoints: 750,
        rewardTokens: "15",
        badge: "Consistent",
        icon: "⚡",
        rarity: "rare"
      },
      {
        name: "Social Butterfly",
        description: "Refer 10 friends to the platform",
        category: "social",
        criteria: JSON.stringify({ action: "referral", count: 10 }),
        rewardPoints: 1500,
        rewardTokens: "30",
        badge: "Influencer",
        icon: "🦋",
        rarity: "epic"
      },
      {
        name: "Reputation Legend",
        description: "Reach 10,000 total reputation points",
        category: "reputation",
        criteria: JSON.stringify({ action: "reputation_total", count: 10000 }),
        rewardPoints: 5000,
        rewardTokens: "100",
        badge: "Legend",
        icon: "👑",
        rarity: "legendary"
      }
    ];

    for (const achievement of defaultAchievements) {
      try {
        await db.insert(achievements).values(achievement);
      } catch (error) {
        // Achievement might already exist, continue
        console.log(`Achievement ${achievement.name} already exists or failed to create`);
      }
    }
  }

  // Check and unlock achievements for user
  static async checkUserAchievements(userId: string): Promise<string[]> {
    const unlockedAchievements: string[] = [];
    const allAchievements = await db
      .select()
      .from(achievements)
      .where(eq(achievements.isActive, true));

    for (const achievement of allAchievements) {
      const isAlreadyUnlocked = await this.isAchievementUnlocked(userId, achievement.id);
      if (isAlreadyUnlocked) continue;

      const criteria = JSON.parse(achievement.criteria);
      const isUnlocked = await this.evaluateAchievementCriteria(userId, criteria);

      if (isUnlocked) {
        await this.unlockAchievement(userId, achievement.id);
        unlockedAchievements.push(achievement.name);
      }
    }

    return unlockedAchievements;
  }

  // Evaluate if user meets achievement criteria
  private static async evaluateAchievementCriteria(userId: string, criteria: any): Promise<boolean> {
    switch (criteria.action) {
      case 'vote':
        const voteCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(votes)
          .where(eq(votes.userId, userId));
        return (voteCount[0]?.count || 0) >= criteria.count;

      case 'proposal_created':
        const proposalCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(proposals)
          .where(eq(proposals.proposerId, userId));
        return (proposalCount[0]?.count || 0) >= criteria.count;

      case 'proposal_passed':
        const passedProposals = await db
          .select({ count: sql<number>`count(*)` })
          .from(proposals)
          .where(
            and(
              eq(proposals.proposerId, userId),
              eq(proposals.status, 'passed')
            )
          );
        return (passedProposals[0]?.count || 0) >= criteria.count;

      case 'contribution_total':
        const totalContributions = await db
          .select({ total: sql<number>`sum(${contributions.amount})` })
          .from(contributions)
          .where(eq(contributions.userId, userId));
        return (totalContributions[0]?.total || 0) >= criteria.amount;

      case 'daily_streak':
        const userRep = await db
          .select()
          .from(userGamification)
          .where(eq(userGamification.userId, userId));
        return (userRep[0]?.currentStreak || 0) >= criteria.count;

      case 'referral':
        const referralCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(msiaMoPoints)
          .where(
            and(
              eq(msiaMoPoints.userId, userId),
              eq(msiaMoPoints.action, 'REFERRAL')
            )
          );
        return (referralCount[0]?.count || 0) >= criteria.count;

      case 'reputation_total':
        const reputation = await db
          .select()
          .from(userGamification)
          .where(eq(userGamification.userId, userId));
        return (reputation[0]?.totalPoints || 0) >= criteria.count;

      default:
        return false;
    }
  }

  // Check if achievement is already unlocked
  private static async isAchievementUnlocked(userId: string, achievementId: string): Promise<boolean> {
    const existing = await db
      .select()
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.achievementId, achievementId),
          eq(userAchievements.isCompleted, true)
        )
      );
    return existing.length > 0;
  }

  // Unlock achievement for user
  private static async unlockAchievement(userId: string, achievementId: string): Promise<void> {
    const achievement = await db
      .select()
      .from(achievements)
      .where(eq(achievements.id, achievementId));

    if (!achievement[0]) return;

    // Create user achievement record (mark mintPending for rare+ achievements)
    const isRarePlus = ['rare', 'epic', 'legendary'].includes((achievement[0].rarity || '').toLowerCase());
    const inserted = await db.insert(userAchievements).values({
      userId,
      achievementId,
      isCompleted: true,
      rewardClaimed: false,
      mintPending: isRarePlus,
    }).returning();

    const uaId = inserted?.[0]?.id;

    // Award reputation points
    if (achievement[0] && achievement[0].rewardPoints && achievement[0].rewardPoints > 0) {
      await ReputationService.awardPoints(
        userId,
        'ACHIEVEMENT_UNLOCKED',
        achievement[0].rewardPoints,
        undefined,
        `Unlocked achievement: ${achievement[0].name}`,
        1.0
      );
    }

    // If configured, asynchronously mint on-chain for rare+ rarities
    if (isRarePlus) {
      (async () => {
        try {
          // resolve user wallet address
          const us = await db.select().from(users).where(eq(users.id, userId));
          const wallet = us?.[0]?.walletAddress;
          if (!wallet) {
            console.warn('No wallet address for user', userId);
            return;
          }

          const mintResult = await mintAchievementOnChain(wallet, {
            name: achievement[0].name,
            category: achievement[0].category,
            tier: 1,
            rarity: 0,
            rewardPoints: achievement[0].rewardPoints || 0,
            rewardTokens: Number(achievement[0].rewardTokens || '0'),
            imageUrl: achievement[0].icon || '',
            metadataUri: '',
            tradeable: false,
            burnable: false,
            milestoneLevel: 0,
          });

          if (mintResult?.txHash && uaId) {
            await db.update(userAchievements).set({ mintTxHash: mintResult.txHash }).where(eq(userAchievements.id, uaId));
          }
        } catch (err) {
          console.warn('Failed to mint achievement on-chain:', err instanceof Error ? err.message : err);
        }
      })();
    }
  }

  // Get user's achievements
  static async getUserAchievements(userId: string): Promise<any[]> {
    return await db
      .select({
        achievement: achievements,
        userAchievement: userAchievements,
      })
      .from(userAchievements)
      .leftJoin(achievements, eq(userAchievements.achievementId, achievements.id))
      .where(eq(userAchievements.userId, userId));
  }

  // Get user's achievement statistics
  static async getUserAchievementStats(userId: string): Promise<any> {
    const totalAchievements = await db
      .select({ count: sql<number>`count(*)` })
      .from(achievements)
      .where(eq(achievements.isActive, true));

    const unlockedAchievements = await db
      .select({ count: sql<number>`count(*)` })
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.isCompleted, true)
        )
      );

    const totalRewardPoints = await db
      .select({ total: sql<number>`sum(${achievements.rewardPoints})` })
      .from(userAchievements)
      .leftJoin(achievements, eq(userAchievements.achievementId, achievements.id))
      .where(
        and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.isCompleted, true),
          eq(userAchievements.rewardClaimed, true)
        )
      );

    return {
      totalAchievements: totalAchievements[0]?.count || 0,
      unlockedAchievements: unlockedAchievements[0]?.count || 0,
      completionRate: ((unlockedAchievements[0]?.count || 0) / (totalAchievements[0]?.count || 1)) * 100,
      totalRewardPointsEarned: totalRewardPoints[0]?.total || 0,
    };
  }

  // Claim achievement rewards
  static async claimAchievementReward(userId: string, achievementId: string): Promise<boolean> {
    const userAchievement = await db
      .select()
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.achievementId, achievementId),
          eq(userAchievements.isCompleted, true),
          eq(userAchievements.rewardClaimed, false)
        )
      );

    if (!userAchievement[0]) return false;

    // Enqueue reward request for batch processing (idempotent)
    const ua = userAchievement[0];
    // Check if a reward_request already exists for this userAchievement
    const existing = await db.select().from((await import('../shared/rewardsSchema')).reward_requests).where(eq((await import('../shared/rewardsSchema')).reward_requests.idempotencyKey, ua.id));
    if (existing && existing.length > 0) {
      return true; // already queued
    }

    // amountUnits: convert rewardTokens to smallest unit (assume 18 decimals)
    const ach = await db.select().from(achievements).where(eq(achievements.id, achievementId));
    const rewardTokensStr = ach?.[0]?.rewardTokens || '0';
    const tokensNum = Number(rewardTokensStr || 0);
    const amountUnits = BigInt(Math.round(tokensNum * 1e18));

    await db.insert((await import('../shared/rewardsSchema')).reward_requests).values({
      userId,
      userAchievementId: ua.id,
      amountUnits: amountUnits.toString(),
      idempotencyKey: ua.id,
      status: 'pending'
    });

    return true;
  }
}
