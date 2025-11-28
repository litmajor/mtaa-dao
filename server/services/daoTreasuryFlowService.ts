
import { db } from '../db';
import { 
  daoTreasuryCredits, 
  mtaaDistributionRules, 
  daoAchievementMilestones,
  daos,
  daoMemberships,
  contributions,
  proposals
} from '../../shared/schema';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { Logger } from '../utils/logger';

export class DaoTreasuryFlowService {
  /**
   * Apply 10% rake on user MTAA earnings → DAO treasury
   */
  async applyEarningsRake(
    userId: string,
    daoId: string,
    totalMtaaEarned: number,
    reason: string
  ): Promise<{ userAmount: number; daoAmount: number }> {
    try {
      // Get distribution rule (DAO-specific or global default)
      const rules = await db
        .select()
        .from(mtaaDistributionRules)
        .where(
          and(
            eq(mtaaDistributionRules.actionType, 'contribution'),
            eq(mtaaDistributionRules.isActive, true)
          )
        )
        .orderBy(mtaaDistributionRules.daoId) // DAO-specific first, then global
        .limit(2);

      const rule = rules.find(r => r.daoId === daoId) || rules.find(r => !r.daoId) || {
        userPercentage: 90,
        daoPercentage: 10,
        platformPercentage: 0
      };

      const userAmount = (totalMtaaEarned * rule.userPercentage) / 100;
      const daoAmount = (totalMtaaEarned * rule.daoPercentage) / 100;

      // Record DAO treasury credit
      await db.insert(daoTreasuryCredits).values({
        daoId,
        source: 'earnings_rake',
        amount: daoAmount.toString(),
        userId,
        reason: `10% rake from ${reason}`,
        metadata: {
          totalEarned: totalMtaaEarned,
          userPercentage: rule.userPercentage,
          daoPercentage: rule.daoPercentage
        }
      });

      Logger.getLogger().info(`DAO Treasury Rake: ${daoAmount} MTAA to DAO ${daoId} from user ${userId}`);

      return { userAmount, daoAmount };
    } catch (error) {
      Logger.getLogger().error('Error applying earnings rake:', error);
      throw error;
    }
  }

  /**
   * Award DAO achievement milestone rewards
   */
  async checkAndAwardMilestones(daoId: string): Promise<DaoAchievementMilestone[]> {
    try {
      const awarded: any[] = [];

      // Get uncompleted milestones
      const milestones = await db
        .select()
        .from(daoAchievementMilestones)
        .where(
          and(
            eq(daoAchievementMilestones.daoId, daoId),
            isNull(daoAchievementMilestones.completedAt)
          )
        );

      for (const milestone of milestones) {
        let achieved = false;

        switch (milestone.type) {
          case 'member_count':
            const memberCount = await db
              .select({ count: sql<number>`count(*)` })
              .from(daoMemberships)
              .where(eq(daoMemberships.daoId, daoId));
            achieved = (memberCount[0]?.count || 0) >= milestone.threshold;
            break;

          case 'treasury_value':
            const dao = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
            achieved = parseFloat(dao[0]?.treasuryBalance || '0') >= milestone.threshold;
            break;

          case 'proposal_success':
            const successfulProposals = await db
              .select({ count: sql<number>`count(*)` })
              .from(proposals)
              .where(
                and(
                  eq(proposals.daoId, daoId),
                  eq(proposals.status, 'passed')
                )
              );
            achieved = (successfulProposals[0]?.count || 0) >= milestone.threshold;
            break;

          case 'contribution_count':
            const contributionCount = await db
              .select({ count: sql<number>`count(*)` })
              .from(contributions)
              .where(eq(contributions.daoId, daoId));
            achieved = (contributionCount[0]?.count || 0) >= milestone.threshold;
            break;
        }

        if (achieved) {
          // Mark milestone as completed
          await db
            .update(daoAchievementMilestones)
            .set({ completedAt: new Date() })
            .where(eq(daoAchievementMilestones.id, milestone.id));

          // Award MTAA to DAO treasury
          await db.insert(daoTreasuryCredits).values({
            daoId,
            source: 'achievement',
            amount: milestone.mtaaReward,
            reason: `Achievement: ${milestone.type} reached ${milestone.threshold}`,
            metadata: {
              milestoneId: milestone.id,
              type: milestone.type,
              threshold: milestone.threshold
            }
          });

          awarded.push(milestone);
          Logger.getLogger().info(`DAO Achievement: ${milestone.mtaaReward} MTAA awarded to DAO ${daoId}`);
        }
      }

      return awarded;
    } catch (error) {
      Logger.getLogger().error('Error checking milestones:', error);
      throw error;
    }
  }

  /**
   * Apply 20% task pool allocation when task benefits DAO
   */
  async applyTaskPoolRake(
    taskId: string,
    userId: string,
    daoId: string,
    taskReward: number,
    benefitsDao: boolean
  ): Promise<{ userAmount: number; daoAmount: number }> {
    if (!benefitsDao) {
      return { userAmount: taskReward, daoAmount: 0 };
    }

    const daoAmount = taskReward * 0.2; // 20% to DAO
    const userAmount = taskReward * 0.8; // 80% to user

    await db.insert(daoTreasuryCredits).values({
      daoId,
      source: 'task_pool',
      amount: daoAmount.toString(),
      userId,
      reason: `20% task pool allocation from task ${taskId}`,
      metadata: { taskId, totalReward: taskReward }
    });

    Logger.getLogger().info(`Task Pool: ${daoAmount} MTAA to DAO ${daoId} from task ${taskId}`);

    return { userAmount, daoAmount };
  }

  /**
   * Apply 5% referral kickback on lifetime earnings
   */
  async applyReferralKickback(
    referrerId: string,
    referredUserId: string,
    daoId: string,
    lifetimeEarnings: number
  ): Promise<number> {
    const kickbackAmount = lifetimeEarnings * 0.05;

    await db.insert(daoTreasuryCredits).values({
      daoId,
      source: 'referral_kickback',
      amount: kickbackAmount.toString(),
      userId: referrerId,
      reason: `5% referral kickback from ${referredUserId}'s lifetime earnings`,
      metadata: {
        referrerId,
        referredUserId,
        lifetimeEarnings
      }
    });

    Logger.getLogger().info(`Referral Kickback: ${kickbackAmount} MTAA to DAO ${daoId}`);

    return kickbackAmount;
  }

  /**
   * Get DAO treasury MTAA balance
   */
  async getDaoTreasuryMtaaBalance(daoId: string): Promise<number> {
    const result = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${daoTreasuryCredits.amount} AS DECIMAL)), 0)`
      })
      .from(daoTreasuryCredits)
      .where(eq(daoTreasuryCredits.daoId, daoId));

    return result[0]?.total || 0;
  }

  /**
   * Get DAO treasury credits history
   */
  async getDaoTreasuryHistory(daoId: string, limit: number = 50) {
    return await db
      .select()
      .from(daoTreasuryCredits)
      .where(eq(daoTreasuryCredits.daoId, daoId))
      .orderBy(sql`${daoTreasuryCredits.createdAt} DESC`)
      .limit(limit);
  }

  /**
   * Initialize default milestones for a new DAO
   */
  async initializeDefaultMilestones(daoId: string): Promise<void> {
    const defaultMilestones = [
      { type: 'member_count', threshold: 50, mtaaReward: '500' },
      { type: 'member_count', threshold: 100, mtaaReward: '1000' },
      { type: 'treasury_value', threshold: 10000, mtaaReward: '1000' },
      { type: 'proposal_success', threshold: 1, mtaaReward: '200' },
      { type: 'proposal_success', threshold: 10, mtaaReward: '500' },
      { type: 'contribution_count', threshold: 100, mtaaReward: '2000' }
    ];

    await db.insert(daoAchievementMilestones).values(
      defaultMilestones.map(m => ({ daoId, ...m }))
    );

    Logger.getLogger().info(`Initialized default milestones for DAO ${daoId}`);
  }
}

export const daoTreasuryFlowService = new DaoTreasuryFlowService();
