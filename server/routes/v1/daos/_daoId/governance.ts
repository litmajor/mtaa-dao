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

import express from 'express';
import type { Request, Response, Router } from 'express';
import { logger } from '../../../../utils/logger';
import { createRateLimiter } from '../../../../middleware/rateLimiting';
import {
  getGovernanceLeaderboard,
  getGovernanceStats,
  getGovernanceMemberRank,
  getTopContributors,
} from '../../../../services/governance-service';

interface GovernanceParams {
  daoId: string;
  userId?: string;
}

type GovernanceRequest = Request<GovernanceParams>;

const router: Router = express.Router({ mergeParams: true });

const governanceRateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 120,
  keyGenerator: (req) => `dao-governance:${(req as any).user?.id || req.ip}`,
});

router.use(governanceRateLimiter);

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

    const leaderboard = await getGovernanceLeaderboard(daoId, parsedLimit);

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

    const stats = await getGovernanceStats(daoId);

    res.json({
      daoId,
      stats: {
        members: stats.totalMembers,
        contributions: stats.totalContributions,
        proposals: stats.totalProposals,
        votes: stats.totalVotes,
        totalActivityScore: stats.totalActivityScore,
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

    const user = await getGovernanceMemberRank(daoId, paramUserId);

    res.json(user);
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

    const contributors = await getTopContributors(daoId, type as string, parsedLimit);

    res.json({ daoId, type, topContributors: contributors.topContributors });
  } catch (error) {
    logger.error(
      `Error fetching top contributors for DAO ${req.params.daoId}:`,
      error
    );
    res.status(500).json({ error: 'Failed to fetch contributors' });
  }
});

export default router;
