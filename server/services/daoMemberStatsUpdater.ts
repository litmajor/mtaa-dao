/**
 * DAO MEMBER STATS UPDATER SERVICE
 * 
 * Maintains denormalized dao_member_stats table for fast leaderboard queries.
 * Avoids expensive COUNT(DISTINCT) aggregations.
 * 
 * Updates via:
 * 1. Incremental updates on contribution/proposal/vote insert (event-driven)
 * 2. Periodic reconciliation to catch drift
 */

import { pool } from '../db';
import { logger } from '../utils/logger';

class DaoMemberStatsUpdater {
  /**
   * On contribution created: increment contributions_count
   */
  async onContributionCreated(daoId: string, memberId: string): Promise<void> {
    try {
      // Ensure stats row exists
      await this.ensureStatsRow(daoId, memberId);
      
      // Increment counter
      await pool.query(
        `UPDATE dao_member_stats 
         SET contributions_count = contributions_count + 1,
             last_activity_at = NOW(),
             updated_at = NOW()
         WHERE dao_id = $1 AND member_id = $2`,
        [daoId, memberId]
      );
      
      // Recalculate rank_score
      await this.updateRankScore(daoId, memberId);
      
      logger.debug(`[DAO STATS] Contribution counted for member ${memberId} in DAO ${daoId}`);
    } catch (error) {
      logger.error(`[DAO STATS] Failed to count contribution:`, error);
    }
  }

  /**
   * On proposal created: increment proposals_count
   */
  async onProposalCreated(daoId: string, memberId: string): Promise<void> {
    try {
      await this.ensureStatsRow(daoId, memberId);
      
      await pool.query(
        `UPDATE dao_member_stats 
         SET proposals_count = proposals_count + 1,
             last_activity_at = NOW(),
             updated_at = NOW()
         WHERE dao_id = $1 AND member_id = $2`,
        [daoId, memberId]
      );
      
      await this.updateRankScore(daoId, memberId);
      
      logger.debug(`[DAO STATS] Proposal counted for member ${memberId} in DAO ${daoId}`);
    } catch (error) {
      logger.error(`[DAO STATS] Failed to count proposal:`, error);
    }
  }

  /**
   * On vote cast: increment votes_count
   */
  async onVoteCast(daoId: string, memberId: string): Promise<void> {
    try {
      await this.ensureStatsRow(daoId, memberId);
      
      await pool.query(
        `UPDATE dao_member_stats 
         SET votes_count = votes_count + 1,
             last_activity_at = NOW(),
             updated_at = NOW()
         WHERE dao_id = $1 AND member_id = $2`,
        [daoId, memberId]
      );
      
      await this.updateRankScore(daoId, memberId);
      
      logger.debug(`[DAO STATS] Vote counted for member ${memberId} in DAO ${daoId}`);
    } catch (error) {
      logger.error(`[DAO STATS] Failed to count vote:`, error);
    }
  }

  /**
   * Recalculate rank_score (contributions*10 + proposals*20 + votes*5)
   */
  private async updateRankScore(daoId: string, memberId: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE dao_member_stats 
         SET rank_score = (contributions_count * 10 + proposals_count * 20 + votes_count * 5),
             updated_at = NOW()
         WHERE dao_id = $1 AND member_id = $2`,
        [daoId, memberId]
      );
    } catch (error) {
      logger.warn(`[DAO STATS] Failed to update rank_score:`, error);
    }
  }

  /**
   * Ensure stats row exists for member (creates if missing)
   */
  private async ensureStatsRow(daoId: string, memberId: string): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO dao_member_stats (dao_id, member_id)
         VALUES ($1, $2)
         ON CONFLICT (dao_id, member_id) DO NOTHING`,
        [daoId, memberId]
      );
    } catch (error) {
      logger.warn(`[DAO STATS] Failed to ensure stats row:`, error);
    }
  }

  /**
   * Periodic reconciliation: recompute all stats from source of truth
   * Run every 5-10 minutes to catch any drift from failed triggers
   */
  async reconcileAllStats(): Promise<{ processed: number; fixed: number }> {
    try {
      logger.info('[DAO STATS] Starting reconciliation...');
      
      // Get all active DAO members
      const members = await pool.query(
        `SELECT DISTINCT dao_id, user_id as member_id 
         FROM dao_memberships`
      );
      
      let fixed = 0;
      
      for (const { dao_id, member_id } of members.rows) {
        const hasDrift = await this.validateAndFixMemberStats(dao_id, member_id);
        if (hasDrift) fixed++;
      }
      
      logger.info(`[DAO STATS] Reconciliation complete: processed ${members.rows.length}, fixed ${fixed}`);
      return { processed: members.rows.length, fixed };
    } catch (error) {
      logger.error('[DAO STATS] Reconciliation failed:', error);
      return { processed: 0, fixed: 0 };
    }
  }

  /**
   * Validate and fix stats for a member
   * Returns true if drift was detected and fixed
   */
  private async validateAndFixMemberStats(daoId: string, memberId: string): Promise<boolean> {
    try {
      // Get current denormalized stats
      const current = await pool.query(
        `SELECT contributions_count, proposals_count, votes_count 
         FROM dao_member_stats 
         WHERE dao_id = $1 AND member_id = $2`,
        [daoId, memberId]
      );
      
      if (current.rows.length === 0) {
        // Stats row missing, create it
        await this.ensureStatsRow(daoId, memberId);
        return true;
      }
      
      // Calculate expected from source of truth (but avoid expensive JOINs!)
      // Instead, count each table independently (simpler queries)
      const contribCount = await pool.query(
        `SELECT COUNT(*) as count FROM contributions 
         WHERE dao_id = $1 AND user_id = $2`,
        [daoId, memberId]
      );
      
      const propCount = await pool.query(
        `SELECT COUNT(*) as count FROM proposals 
         WHERE dao_id = $1 AND user_id = $2`,
        [daoId, memberId]
      );
      
      const voteCount = await pool.query(
        `SELECT COUNT(*) as count FROM votes 
         WHERE dao_id = $1 AND user_id = $2`,
        [daoId, memberId]
      );
      
      const curr = current.rows[0];
      const expContrib = parseInt(contribCount.rows[0].count) || 0;
      const expProp = parseInt(propCount.rows[0].count) || 0;
      const expVote = parseInt(voteCount.rows[0].count) || 0;
      
      // Check for drift
      const hasContribDrift = curr.contributions_count !== expContrib;
      const hasPropDrift = curr.proposals_count !== expProp;
      const hasVoteDrift = curr.votes_count !== expVote;
      
      if (hasContribDrift || hasPropDrift || hasVoteDrift) {
        logger.warn(`[DAO STATS] Drift detected for ${memberId} in DAO ${daoId}`, {
          contributions: { current: curr.contributions_count, expected: expContrib },
          proposals: { current: curr.proposals_count, expected: expProp },
          votes: { current: curr.votes_count, expected: expVote },
        });
        
        // Fix it and recalculate rank_score
        await pool.query(
          `UPDATE dao_member_stats 
           SET contributions_count = $1,
               proposals_count = $2,
               votes_count = $3,
               rank_score = ($1 * 10 + $2 * 20 + $3 * 5),
               last_reconciled_at = NOW(),
               updated_at = NOW()
           WHERE dao_id = $4 AND member_id = $5`,
          [expContrib, expProp, expVote, daoId, memberId]
        );
        
        return true;
      }
      
      // No drift, just update last_reconciled_at
      await pool.query(
        `UPDATE dao_member_stats SET last_reconciled_at = NOW() 
         WHERE dao_id = $1 AND member_id = $2`,
        [daoId, memberId]
      );
      
      return false;
    } catch (error) {
      logger.error(`[DAO STATS] Validation failed for ${memberId}:`, error);
      return false;
    }
  }
}

export const daoMemberStatsUpdater = new DaoMemberStatsUpdater();
