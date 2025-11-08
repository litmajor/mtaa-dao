
import express from 'express';
import { db } from '../db';
import { daos, daoMemberships, proposals, quorumHistory } from '../../shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { isAuthenticated } from '../nextAuthMiddleware';

const router = express.Router();

/**
 * GET /api/governance/quorum/:daoId
 * Get current quorum requirements and status
 */
router.get('/quorum/:daoId', isAuthenticated, async (req, res) => {
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
