
import express from 'express';
import { db } from '../db';
import { daos, daoMemberships, proposals, quorumHistory } from '../../shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { isAuthenticated } from '../nextAuthMiddleware';

const router = express.Router();

// ════════════════════════════════════════════════════════════════════════════════
// NEW RESTful ENDPOINTS (RECOMMENDED) - Consolidated Quorum API
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/dao/:daoId/quorum
 * Get current quorum requirements and status (NEW - consolidated endpoint)
 */
router.get('/dao/:daoId/quorum', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;

    const dao = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
    if (!dao.length) {
      return res.status(404).json({ message: 'DAO not found' });
    }

    // Get active member count
    const activeMemberCount = await db.select({ count: sql<number>`count(*)` })
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.status, 'approved'),
        eq(daoMemberships.isBanned, false)
      ));

    const totalActiveMembers = activeMemberCount[0]?.count || 0;
    const quorumPercentage = dao[0].quorumPercentage || 20;
    const requiredQuorum = Math.ceil((totalActiveMembers * quorumPercentage) / 100);

    // Get recent quorum history
    const recentHistory = await db.select()
      .from(quorumHistory)
      .where(eq(quorumHistory.daoId, daoId))
      .orderBy(desc(quorumHistory.calculatedAt))
      .limit(10);

    const successRate = recentHistory.length > 0
      ? (recentHistory.filter(h => h.quorumMet).length / recentHistory.length) * 100
      : 0;

    res.json({
      success: true,
      data: {
        daoId,
        totalActiveMembers,
        quorumPercentage,
        requiredQuorum,
        recentHistory,
        successRate: successRate.toFixed(1)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/dao/:daoId/quorum
 * Update quorum percentage (admin only) (NEW - consolidated endpoint)
 */
router.put('/dao/:daoId/quorum', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { quorumPercentage } = req.body;
    const userId = (req as any).user?.claims?.sub;

    // Verify admin permissions
    const membership = await db.select().from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    if (!membership.length || !['admin', 'elder'].includes(membership[0].role || '')) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    // Validate quorum percentage (5-75% range)
    if (quorumPercentage < 5 || quorumPercentage > 75) {
      return res.status(400).json({ 
        message: 'Quorum percentage must be between 5% and 75%' 
      });
    }

    await db.update(daos)
      .set({ 
        quorumPercentage,
        updatedAt: new Date()
      })
      .where(eq(daos.id, daoId));

    res.json({
      success: true,
      message: `Quorum updated to ${quorumPercentage}%`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/dao/:daoId/quorum/check
 * Check if a specific proposal meets quorum requirements (NEW - consolidated endpoint)
 */
router.post('/dao/:daoId/quorum/check', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { proposalId } = req.body;

    if (!proposalId) {
      return res.status(400).json({ message: 'proposalId is required' });
    }

    const proposal = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
    if (!proposal.length) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    const proposalData = proposal[0];

    // Verify proposal belongs to DAO
    if (proposalData.daoId !== daoId) {
      return res.status(400).json({ message: 'Proposal does not belong to this DAO' });
    }

    // Check if voting period has ended
    if (new Date() < new Date(proposalData.voteEndTime)) {
      return res.status(400).json({ message: 'Voting period has not ended yet' });
    }

    // CRITICAL: Calculate and enforce quorum
    const dao = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
    if (!dao.length) {
      return res.status(404).json({ message: 'DAO not found' });
    }

    const daoData = dao[0];
    const activeMemberCount = await db.select({ count: sql<number>`count(*)` })
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.status, 'approved'),
        eq(daoMemberships.isBanned, false)
      ));

    const totalActiveMembers = activeMemberCount[0]?.count || 0;
    const quorumPercentage = daoData.quorumPercentage || 20;
    const requiredQuorum = Math.ceil((totalActiveMembers * quorumPercentage) / 100);

    // Calculate vote totals
    const yesVotes = proposalData.yesVotes || 0;
    const noVotes = proposalData.noVotes || 0;
    const totalVotes = yesVotes + noVotes + (proposalData.abstainVotes || 0);

    // CRITICAL: Enforce quorum requirement
    if (totalVotes < requiredQuorum) {
      await db.update(proposals)
        .set({ 
          status: 'failed',
          metadata: sql`jsonb_set(COALESCE(metadata, '{}'::jsonb), '{failureReason}', '"Quorum not met"')`
        })
        .where(eq(proposals.id, proposalId));

      // Record quorum failure in history
      await db.insert(quorumHistory).values({
        daoId: daoId,
        proposalId: proposalId,
        activeMemberCount: totalActiveMembers,
        requiredQuorum: requiredQuorum,
        achievedQuorum: totalVotes,
        quorumMet: false
      });

      return res.status(400).json({ 
        success: false,
        message: `Quorum not met. Required: ${requiredQuorum} votes (${quorumPercentage}% of ${totalActiveMembers} members), Got: ${totalVotes}`,
        data: {
          totalActiveMembers,
          quorumPercentage,
          requiredQuorum,
          totalVotes,
          quorumMet: false
        }
      });
    }

    // Record successful quorum in history
    await db.insert(quorumHistory).values({
      daoId: daoId,
      proposalId: proposalId,
      activeMemberCount: totalActiveMembers,
      requiredQuorum: requiredQuorum,
      achievedQuorum: totalVotes,
      quorumMet: true
    });

    // Check majority
    const majorityReached = yesVotes > noVotes;
    const quorumMet = totalVotes >= requiredQuorum;
    const passed = requiredQuorum > 0 && totalVotes >= requiredQuorum && majorityReached;

    let newStatus = 'failed';
    let failureReason = '';

    if (!quorumMet) {
      newStatus = 'failed';
      failureReason = `Quorum not met: ${totalVotes}/${requiredQuorum} votes (${(totalVotes / totalActiveMembers * 100).toFixed(2)}% participation)`;
    } else if (!majorityReached) {
      newStatus = 'failed';
      failureReason = `Majority not reached: ${yesVotes} yes vs ${noVotes} no votes`;
    } else {
      newStatus = 'passed';
    }

    await db.update(proposals)
      .set({ 
        status: newStatus,
        metadata: failureReason ? sql`jsonb_set(
          COALESCE(metadata, '{}'::jsonb), 
          '{failure_reason}', 
          ${JSON.stringify(failureReason)}
        )` : proposalData.metadata
      })
      .where(eq(proposals.id, proposalId));

    res.json({
      success: true,
      data: {
        quorumMet: true,
        majorityReached,
        passed,
        totalVotes,
        requiredQuorum,
        participationRate: (totalVotes / totalActiveMembers * 100).toFixed(2),
        yesVotes: proposalData.yesVotes,
        noVotes: proposalData.noVotes,
        abstainVotes: proposalData.abstainVotes,
        status: newStatus
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to check proposal quorum',
      error: error.message
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// DEPRECATED ENDPOINTS (Keep for 6 months, then remove)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use GET /api/dao/:daoId/quorum instead
 * Sunset: 2026-09-01
 * 
 * GET /api/governance/quorum/:daoId
 * Get current quorum requirements and status
 */
router.get('/quorum/:daoId', isAuthenticated, async (req, res) => {
  // Issue deprecation warning
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 01 Sep 2026 00:00:00 GMT');
  res.setHeader('Link', '</api/dao/:daoId/quorum>; rel="successor-version"');
  res.setHeader('Warning', '299 - "GET /api/governance/quorum/:daoId is deprecated. Use GET /api/dao/:daoId/quorum instead"');

  try {
    const { daoId } = req.params;

    const dao = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
    if (!dao.length) {
      return res.status(404).json({ message: 'DAO not found' });
    }

    // Get active member count
    const activeMemberCount = await db.select({ count: sql<number>`count(*)` })
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.status, 'approved'),
        eq(daoMemberships.isBanned, false)
      ));

    const totalActiveMembers = activeMemberCount[0]?.count || 0;
    const quorumPercentage = dao[0].quorumPercentage || 20;
    const requiredQuorum = Math.ceil((totalActiveMembers * quorumPercentage) / 100);

    // Get recent quorum history
    const recentHistory = await db.select()
      .from(quorumHistory)
      .where(eq(quorumHistory.daoId, daoId))
      .orderBy(desc(quorumHistory.calculatedAt))
      .limit(10);

    const successRate = recentHistory.length > 0
      ? (recentHistory.filter(h => h.quorumMet).length / recentHistory.length) * 100
      : 0;

    res.json({
      success: true,
      data: {
        daoId,

        totalActiveMembers,
        quorumPercentage,
        requiredQuorum,
        recentHistory,
        successRate: successRate.toFixed(1)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/governance/quorum/:daoId
 * Update quorum percentage (admin only)
 */
router.put('/quorum/:daoId', isAuthenticated, async (req, res) => {
  // Issue deprecation warning
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 01 Sep 2026 00:00:00 GMT');
  res.setHeader('Link', '</api/dao/:daoId/quorum>; rel="successor-version"');
  res.setHeader('Warning', '299 - "PUT /api/governance/quorum/:daoId is deprecated. Use PUT /api/dao/:daoId/quorum instead"');

  try {
    const { daoId } = req.params;
    const { quorumPercentage } = req.body;
    const userId = (req as any).user?.claims?.sub;

    // Verify admin permissions
    const membership = await db.select().from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ))
      .limit(1);

    if (!membership.length || !['admin', 'elder'].includes(membership[0].role || '')) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    // Validate quorum percentage (5-75% range)
    if (quorumPercentage < 5 || quorumPercentage > 75) {
      return res.status(400).json({ 
        message: 'Quorum percentage must be between 5% and 75%' 
      });
    }

    await db.update(daos)
      .set({ 
        quorumPercentage,
        updatedAt: new Date()
      })
      .where(eq(daos.id, daoId));

    res.json({
      success: true,
      message: `Quorum updated to ${quorumPercentage}%`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
