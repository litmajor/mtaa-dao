
import express, { Request, Response } from 'express';
import { daoTreasuryFlowService } from '../services/daoTreasuryFlowService';
import { isAuthenticated } from '../nextAuthMiddleware';
import { db } from '../db';
import { daoMemberships } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

const router = express.Router();

/**
 * GET /api/dao-treasury-flows/:daoId/balance
 * Get DAO's MTAA treasury balance
 */
router.get('/:daoId/balance', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const balance = await daoTreasuryFlowService.getDaoTreasuryMtaaBalance(daoId);
    
    res.json({ 
      daoId, 
      mtaaBalance: balance,
      formattedBalance: `${balance.toLocaleString()} MTAA`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dao-treasury-flows/:daoId/history
 * Get DAO treasury credit history
 */
router.get('/:daoId/history', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const history = await daoTreasuryFlowService.getDaoTreasuryHistory(daoId, limit);
    
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/dao-treasury-flows/:daoId/check-milestones
 * Manually trigger milestone check (admin only)
 */
router.post('/:daoId/check-milestones', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const userId = (req as any).user?.id;

    // Verify user is admin or elder
    const membership = await db
      .select()
      .from(daoMemberships)
      .where(
        and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, userId)
        )
      )
      .limit(1);

    if (!membership.length || !['admin', 'elder'].includes(membership[0].role || '')) {
      return res.status(403).json({ error: 'Only admins and elders can check milestones' });
    }

    const awarded = await daoTreasuryFlowService.checkAndAwardMilestones(daoId);
    
    res.json({ 
      success: true, 
      milestonesAwarded: awarded.length,
      milestones: awarded
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dao-treasury-flows/:daoId/stats
 * Get comprehensive DAO treasury stats
 */
router.get('/:daoId/stats', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const history = await daoTreasuryFlowService.getDaoTreasuryHistory(daoId, 1000);
    
    const stats = {
      totalMtaa: await daoTreasuryFlowService.getDaoTreasuryMtaaBalance(daoId),
      bySource: {
        earnings_rake: history.filter(h => h.source === 'earnings_rake')
          .reduce((sum, h) => sum + parseFloat(h.amount), 0),
        achievements: history.filter(h => h.source === 'achievement')
          .reduce((sum, h) => sum + parseFloat(h.amount), 0),
        task_pool: history.filter(h => h.source === 'task_pool')
          .reduce((sum, h) => sum + parseFloat(h.amount), 0),
        referral_kickback: history.filter(h => h.source === 'referral_kickback')
          .reduce((sum, h) => sum + parseFloat(h.amount), 0)
      },
      transactionCount: history.length,
      lastCredit: history[0]
    };
    
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
