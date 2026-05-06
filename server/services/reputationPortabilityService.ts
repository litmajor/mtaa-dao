/**
 * @file reputationPortabilityService.ts
 * @description Cross-DAO reputation and achievement portability
 * @notice Enables members to transfer reputation/achievements between DAOs in federation
 */

import { db } from '../db';
import { memberReputation, memberAchievements, users, daoMemberships } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

// ==================== TYPES ====================

interface ReputationTransfer {
  memberId: string;
  fromDAOId: string;
  toDAOId: string;
  transferPercentage?: number;  // Default 70%
}

interface AchievementPortability {
  memberId: string;
  achievementId: string;
  fromDAOId: string;
  targetDAOs: string[];  // DAOs to port achievement to
}

interface ReputationPortfolio {
  memberId: string;
  totalReputation: number;
  achievementCount: number;
  daoCount: number;
  portfolioTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  achievements: {
    id: string;
    type: string;
    earnedAt: string;
    daoId: string;
  }[];
}

// ==================== SERVICE ====================

export class ReputationPortabilityService {

  // ==================== REPUTATION TRANSFER ====================

  /**
   * Transfer member reputation between DAOs
   * E.g., when member joins new DAO in federation
   * Transfer at 70% to prevent arbitrage (join every DAO, farm reputation)
   */
  async transferReputation(params: ReputationTransfer): Promise<{
    transferred: number;
    retained: number;
    newDAOBalance: number;
  }> {
    try {
      const transferPercentage = params.transferPercentage || 70;

      // Get source reputation
      const sourceRep = await db.query.memberReputation.findFirst({
        where: and(
          eq(memberReputation.memberId, params.memberId as any),
          eq(memberReputation.daoId, params.fromDAOId as any)
        ),
      });

      if (!sourceRep) {
        throw new Error(`No reputation found for member in source DAO`);
      }

      // Calculate transfer amount
      const transferAmount = Math.floor(
        (sourceRep.reputationScore * transferPercentage) / 100
      );
      const retainedAmount = sourceRep.reputationScore - transferAmount;

      // Check if target DAO has existing reputation
      const targetRep = await db.query.memberReputation.findFirst({
        where: and(
          eq(memberReputation.memberId, params.memberId as any),
          eq(memberReputation.daoId, params.toDAOId as any)
        ),
      });

      if (targetRep) {
        // Add to existing reputation
        await db.execute(sql`
          UPDATE member_reputation
          SET reputation_score = reputation_score + ${transferAmount}
          WHERE member_id = ${params.memberId} AND dao_id = ${params.toDAOId}
        `);
      } else {
        // Create new reputation record
        await db.execute(sql`
          INSERT INTO member_reputation (
            member_id, dao_id, reputation_score, created_at, updated_at
          )
          VALUES (${params.memberId}, ${params.toDAOId}, ${transferAmount}, NOW(), NOW())
        `);
      }

      // Record transfer in audit log
      await db.execute(sql`
        INSERT INTO reputation_transfers (
          member_id, from_dao_id, to_dao_id, 
          transferred_amount, transferred_at
        )
        VALUES (
          ${params.memberId}, ${params.fromDAOId}, ${params.toDAOId},
          ${transferAmount}, NOW()
        )
      `);

      return {
        transferred: transferAmount,
        retained: retainedAmount,
        newDAOBalance: transferAmount + (targetRep?.reputationScore ?? 0),
      };
    } catch (error) {
      console.error('❌ Error transferring reputation:', error);
      throw error;
    }
  }

  /**
   * Bulk transfer reputation (for Meta DAO members joining)
   */
  async bulkTransferReputation(
    memberIds: string[],
    fromDAOId: string,
    toDAOId: string
  ): Promise<void> {
    try {
      for (const memberId of memberIds) {
        await this.transferReputation({
          memberId,
          fromDAOId,
          toDAOId,
          transferPercentage: 70,
        });
      }

      console.log(`✅ Bulk transfer completed: ${memberIds.length} members`);
    } catch (error) {
      console.error('❌ Error in bulk transfer:', error);
      throw error;
    }
  }

  // ==================== ACHIEVEMENT PORTABILITY ====================

  /**
   * Port achievement to other DAOs
   * E.g., "Elder" role earned in DAO A can be recognized in DAO B
   */
  async portAchievement(params: AchievementPortability): Promise<void> {
    try {
      // Get source achievement
      const achievement = await db.query.memberAchievements.findFirst({
        where: eq(memberAchievements.id, params.achievementId as any),
      });

      if (!achievement) {
        throw new Error(`Achievement not found: ${params.achievementId}`);
      }

      // Port to each target DAO
      for (const targetDAOId of params.targetDAOs) {
        // Check if achievement already ported
        const existingPort = await db.query.memberAchievements.findFirst({
          where: and(
            eq(memberAchievements.memberId, params.memberId as any),
            eq(memberAchievements.daoId, targetDAOId as any),
            sql`achievement_type = ${achievement.achievementType}`
          ),
        });

        if (existingPort) {
          continue;  // Already ported
        }

        // Create ported achievement
        // Ported achievements have lower weight (marked with "PORTED_" prefix)
        await db.execute(sql`
          INSERT INTO member_achievements (
            member_id, dao_id, achievement_type, earned_at, 
            is_ported, original_dao_id, created_at
          )
          VALUES (
            ${params.memberId}, ${targetDAOId},
            ${'PORTED_' + achievement.achievementType},
            ${achievement.earnedAt},
            true, ${params.fromDAOId}, NOW()
          )
        `);
      }

      console.log(`✅ Achievement ported: ${achievement.achievementType} → ${params.targetDAOs.length} DAOs`);
    } catch (error) {
      console.error('❌ Error porting achievement:', error);
      throw error;
    }
  }

  /**
   * Get achievement transfer history
   */
  async getAchievementTransferHistory(memberId: string): Promise<any[]> {
    try {
      const history = await db.execute(sql`
        SELECT 
          id, achievement_type, original_dao_id, dao_id,
          earned_at, is_ported, created_at
        FROM member_achievements
        WHERE member_id = ${memberId}
        ORDER BY created_at DESC
      `);

      return history;
    } catch (error) {
      console.error('❌ Error getting achievement history:', error);
      throw error;
    }
  }

  // ==================== REPUTATION PORTFOLIO ====================

  /**
   * Get member's reputation portfolio across DAOs
   */
  async getReputationPortfolio(memberId: string): Promise<ReputationPortfolio> {
    try {
      // Get all reputation records
      const reputations = await db.execute(sql`
        SELECT reputation_score, dao_id FROM member_reputation
        WHERE member_id = ${memberId}
        ORDER BY reputation_score DESC
      `);

      // Get all achievements
      const achievements = await db.execute(sql`
        SELECT id, achievement_type, earned_at, dao_id FROM member_achievements
        WHERE member_id = ${memberId}
        ORDER BY earned_at DESC
      `);

      const totalReputation = reputations.reduce(
        (sum: number, r: any) => sum + r.reputation_score,
        0
      );

      // Determine tier based on total reputation
      let tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' = 'BRONZE';
      if (totalReputation >= 5000) tier = 'PLATINUM';
      else if (totalReputation >= 3000) tier = 'GOLD';
      else if (totalReputation >= 1000) tier = 'SILVER';

      return {
        memberId,
        totalReputation,
        achievementCount: achievements.length,
        daoCount: reputations.length,
        portfolioTier: tier,
        achievements: achievements.map((a: any) => ({
          id: a.id,
          type: a.achievement_type,
          earnedAt: a.earned_at,
          daoId: a.dao_id,
        })),
      };
    } catch (error) {
      console.error('❌ Error getting reputation portfolio:', error);
      throw error;
    }
  }

  /**
   * Get reputation leaderboard across federation
   */
  async getFederationLeaderboard(metaDAOId: string, limit: number = 100): Promise<any[]> {
    try {
      const leaderboard = await db.execute(sql`
        SELECT 
          u.id, u.name, u.wallet_address,
          SUM(mr.reputation_score) as total_reputation,
          COUNT(DISTINCT mr.dao_id) as dao_count,
          COUNT(DISTINCT ma.id) as achievement_count
        FROM users u
        LEFT JOIN member_reputation mr ON u.id = mr.member_id
        LEFT JOIN member_achievements ma ON u.id = ma.member_id
        LEFT JOIN daoMemberships dm ON u.id = dm.member_id
        LEFT JOIN meta_dao_child_registry mcr ON dm.dao_id = mcr.child_dao_address
        WHERE mcr.parent_dao_id = ${metaDAOId}
        GROUP BY u.id, u.name, u.wallet_address
        ORDER BY total_reputation DESC
        LIMIT ${limit}
      `);

      return leaderboard;
    } catch (error) {
      console.error('❌ Error getting federation leaderboard:', error);
      throw error;
    }
  }

  // ==================== REPUTATION DECAY & MAINTENANCE ====================

  /**
   * Apply reputation decay for inactive members
   * Inactive = no activity in 90 days
   * Decay: 10% per month, 50% per year
   */
  async applyReputationDecay(): Promise<void> {
    try {
      const now = new Date();

      // 30-day decay (10%)
      await db.execute(sql`
        UPDATE member_reputation
        SET reputation_score = FLOOR(reputation_score * 0.9),
            last_decay_applied = NOW()
        WHERE updated_at < NOW() - INTERVAL '30 days'
        AND last_decay_applied IS NULL
        OR last_decay_applied < NOW() - INTERVAL '30 days'
      `);

      // 365-day decay (additional 50%)
      await db.execute(sql`
        UPDATE member_reputation
        SET reputation_score = FLOOR(reputation_score * 0.5)
        WHERE updated_at < NOW() - INTERVAL '365 days'
      `);

      console.log('✅ Reputation decay applied');
    } catch (error) {
      console.error('❌ Error applying reputation decay:', error);
      throw error;
    }
  }

  /**
   * Request reputation appeal (if member disputes decay)
   */
  async requestReputationAppeal(params: {
    memberId: string;
    daoId: string;
    reason: string;
  }): Promise<string> {
    try {
      const appealId = crypto.randomUUID();

      await db.execute(sql`
        INSERT INTO reputation_appeals (
          id, member_id, dao_id, reason, appeal_status, created_at
        )
        VALUES (${appealId}, ${params.memberId}, ${params.daoId}, ${params.reason}, 'PENDING', NOW())
      `);

      return appealId;
    } catch (error) {
      console.error('❌ Error requesting reputation appeal:', error);
      throw error;
    }
  }

  // ==================== ANALYTICS ====================

  /**
   * Get reputation transfer analytics
   */
  async getTransferAnalytics(fromDAOId: string, toPeriodDays: number = 30): Promise<{
    totalTransfers: number;
    totalReputationTransferred: number;
    averageTransferAmount: number;
    topRecipientDAOs: Array<{daoId: string; transferCount: number}>;
  }> {
    try {
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) as total_transfers,
          SUM(transferred_amount) as total_amount,
          AVG(transferred_amount) as avg_amount,
          to_dao_id,
          COUNT(*) as transfer_count
        FROM reputation_transfers
        WHERE from_dao_id = ${fromDAOId}
        AND transferred_at >= NOW() - INTERVAL '${toPeriodDays} days'
        GROUP BY to_dao_id
        ORDER BY transfer_count DESC
        LIMIT 10
      `);

      return {
        totalTransfers: result[0]?.total_transfers || 0,
        totalReputationTransferred: result[0]?.total_amount || 0,
        averageTransferAmount: result[0]?.avg_amount || 0,
        topRecipientDAOs: result.map((r: any) => ({
          daoId: r.to_dao_id,
          transferCount: r.transfer_count,
        })),
      };
    } catch (error) {
      console.error('❌ Error getting transfer analytics:', error);
      throw error;
    }
  }

  /**
   * Get portability score (how easily member transitions between DAOs)
   */
  async getPortabilityScore(memberId: string): Promise<number> {
    try {
      const portfolio = await this.getReputationPortfolio(memberId);

      // Score based on:
      // - Total reputation (0-500 points)
      // - DAO diversity (0-300 points: 100 per DAO, max 3)
      // - Achievements (0-200 points: 10 per achievement, max 20)
      const reputationScore = Math.min(500, portfolio.totalReputation / 10);
      const diversityScore = Math.min(300, portfolio.daoCount * 100);
      const achievementScore = Math.min(200, portfolio.achievementCount * 10);

      const totalScore = reputationScore + diversityScore + achievementScore;
      return Math.min(1000, totalScore);  // Max score 1000
    } catch (error) {
      console.error('❌ Error calculating portability score:', error);
      throw error;
    }
  }
}

export const reputationPortabilityService = new ReputationPortabilityService();
