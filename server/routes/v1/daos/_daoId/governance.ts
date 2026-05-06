/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * V1 DAO Governance Router
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * DAO-scoped governance leaderboards with:
 * - Activity tracking (contributions, proposals, votes)
 * - Dual-scope leaderboards (system-wide + DAO-specific)
 * - Member rankings and reputation
 * - Activity scoring and analytics
 *
 * Base Path: /api/v1/daos/:daoId/governance
 * Parent ensures: isAuthenticated, validateDaoId
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express, { Request, Response, Router } from 'express';
import { sql, and, eq, desc } from 'drizzle-orm';
import { pool } from '../../../../db';
import { db } from '../../../../db';
import { daoMemberships, users, contributions, proposals, votes } from '../../../../../shared/schema';
import { logger } from '../../../../utils/logger';

interface GovernanceParams {
  daoId: string;
  userId?: string;
}

type GovernanceRequest = Request<GovernanceParams>;

const router: Router = express.Router({ mergeParams: true });

// Helper: Calculate activity score for a user
const calculateActivityScore = (
  contributions: number,
  proposals: number,
  votes: number
): number => {
  return contributions * 10 + proposals * 20 + votes * 5;
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/daos/:daoId/governance/leaderboard
// DAO-specific leaderboard based on activity
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/leaderboard', async (req: GovernanceRequest, res: Response) => {
  try {
    const { daoId } = req.params as GovernanceParams;
    const { limit = 20 } = req.query;
    const parsedLimit = Math.min(parseInt(limit as string) || 20, 500);

    // Query precomputed denormalized stats (no expensive aggregations!)
    const result = await pool.query(
      `SELECT 
        dms.member_id as id,
        u.username,
        u.email,
        u.profile_image_url as profileImageUrl,
        dm.joined_at as joinedAt,
        dm.role,
        dms.contributions_count as contributionCount,
        dms.proposals_count as proposalCount,
        dms.votes_count as voteCount,
        dms.rank_score as score
       FROM dao_member_stats dms
       INNER JOIN user_accounts u ON dms.member_id = u.id
       INNER JOIN dao_memberships dm ON dms.member_id = dm.user_id AND dms.dao_id = dm.dao_id
       WHERE dms.dao_id = $1
       ORDER BY dms.rank_score DESC
       LIMIT $2`,
      [daoId, parsedLimit]
    );
    
    const members = result.rows;

    const leaderboard = members.map((m: any, index: number) => ({
      rank: index + 1,
      userId: m.id,
      username: m.username,
      email: m.email,
      profileImage: m.profileImageUrl,
      role: m.role,
      joinedAt: m.joinedAt,
      stats: {
        contributions: m.contributioncount || 0,
        proposals: m.proposalcount || 0,
        votes: m.votecount || 0,
        score: m.score || 0,  // Pre-computed in dao_member_stats
      },
    }));

    res.json({ daoId, leaderboard });
  } catch (error) {
    logger.error(`Error fetching governance leaderboard for DAO ${req.params.daoId}:`, error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/daos/:daoId/governance/stats
// Overall governance statistics for the DAO
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/stats', async (req: GovernanceRequest, res: Response) => {
  try {
    const { daoId } = req.params as GovernanceParams;

    // Sum precomputed counts from denormalized table (no expensive aggregations!)
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) as totalMembers,
        SUM(contributions_count) as totalContributions,
        SUM(proposals_count) as totalProposals,
        SUM(votes_count) as totalVotes
       FROM dao_member_stats
       WHERE dao_id = $1`,
      [daoId]
    );

    const result = {
      totalMembers: parseInt(statsResult.rows[0]?.totalmembers) || 0,
      totalContributions: parseInt(statsResult.rows[0]?.totalcontributions) || 0,
      totalProposals: parseInt(statsResult.rows[0]?.totalproposals) || 0,
      totalVotes: parseInt(statsResult.rows[0]?.totalvotes) || 0,
    };

    res.json({
      daoId,
      stats: {
        members: result.totalMembers,
        contributions: result.totalContributions,
        proposals: result.totalProposals,
        votes: result.totalVotes,
        totalActivityScore: calculateActivityScore(
          result.totalContributions,
          result.totalProposals,
          result.totalVotes
        ),
      },
    });
  } catch (error) {
    logger.error(
      `Error fetching governance stats for DAO ${req.params.daoId}:`,
      error
    );
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/daos/:daoId/governance/members/:userId/rank
// Get user's rank and standing in the DAO
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/members/:userId/rank', async (req: GovernanceRequest, res: Response) => {
  try {
    const { daoId, userId: paramUserId } = req.params as GovernanceParams & { userId: string };

    // Get user's precomputed stats
    const userResult = await pool.query(
      `SELECT 
        dms.member_id as id,
        u.username,
        u.email,
        u.profile_image_url as profileImageUrl,
        dm.role,
        dms.contributions_count as contributionCount,
        dms.proposals_count as proposalCount,
        dms.votes_count as voteCount,
        dms.rank_score as score
       FROM dao_member_stats dms
       INNER JOIN user_accounts u ON dms.member_id = u.id
       INNER JOIN dao_memberships dm ON dms.member_id = dm.user_id
       WHERE dms.dao_id = $1 AND dms.member_id = $2`,
      [daoId, paramUserId]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ error: 'User not found in this DAO' });
    }

    const user = userResult.rows[0];

    // Count members ranked higher (using precomputed rank_score, not expensive aggregations!)
    const rankResult = await pool.query(
      `SELECT COUNT(*) as rank FROM dao_member_stats 
       WHERE dao_id = $1 AND rank_score > (SELECT rank_score FROM dao_member_stats WHERE dao_id = $1 AND member_id = $2)`,
      [daoId, paramUserId]
    );

    const rank = parseInt(rankResult.rows[0]?.rank) + 1 || 1;

    res.json({
      daoId,
      userId: paramUserId,
      rank,
      username: user.username,
      email: user.email,
      profileImage: user.profileImageUrl,
      role: user.role,
      stats: {
        contributions: user.contributioncount || 0,
        proposals: user.proposalcount || 0,
        votes: user.votecount || 0,
        score: user.score || 0,  // Pre-computed in dao_member_stats
      },
    });
  } catch (error) {
    logger.error(
      `Error fetching rank for user ${req.params.userId} in DAO ${req.params.daoId}:`,
      error
    );
    res.status(500).json({ error: 'Failed to fetch rank' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/daos/:daoId/governance/top-contributors
// Get top contributors by activity type
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/top-contributors', async (req: GovernanceRequest, res: Response) => {
  try {
    const { daoId } = req.params as GovernanceParams;
    const { type = 'overall', limit = 10 } = req.query;

    const parsedLimit = Math.min(parseInt(limit as string) || 10, 100);

    // Query precomputed denormalized stats (no expensive aggregations!)
    const orderClause = 
      type === 'contributions' ? 'contributions_count DESC' :
      type === 'proposals' ? 'proposals_count DESC' :
      type === 'votes' ? 'votes_count DESC' :
      'rank_score DESC';  // overall
    
    const result = await pool.query(
      `SELECT 
        dms.member_id as userId,
        u.username,
        u.profile_image_url as profileImageUrl,
        dms.contributions_count as contributionCount,
        dms.proposals_count as proposalCount,
        dms.votes_count as voteCount,
        dms.rank_score as score
       FROM dao_member_stats dms
       INNER JOIN user_accounts u ON dms.member_id = u.id
       WHERE dms.dao_id = $1
       ORDER BY ${orderClause}
       LIMIT $2`,
      [daoId, parsedLimit]
    );
    
    const contributors = result.rows;

    const mappedContributors = contributors.map((c: any, index: number) => ({
      rank: index + 1,
      userId: c.userid,
      username: c.username,
      profileImage: c.profileimageurl,
      contributions: c.contributioncount || 0,
      proposals: c.proposalcount || 0,
      votes: c.votecount || 0,
      totalScore: c.score || 0,  // Pre-computed in dao_member_stats
    }));

    res.json({ daoId, type, topContributors: mappedContributors });
  } catch (error) {
    logger.error(
      `Error fetching top contributors for DAO ${req.params.daoId}:`,
      error
    );
    res.status(500).json({ error: 'Failed to fetch contributors' });
  }
});

export default router;
