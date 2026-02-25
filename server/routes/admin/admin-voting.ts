import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { daos, daoMemberships, proposals, votes } from '../../../shared/schema';
import { eq, desc, sql, and, or, like, inArray } from 'drizzle-orm';
import { requireRole } from '../../middleware/rbac';
import { logAuditEvent, AuditEventType } from '../../services/auditLogging';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');

/**
 * Voting Management Routes with Role-Based Access Control
 * 
 * SUPER ADMIN (Platform Admin):
 * - Can VIEW voting settings of any DAO
 * - Can VIEW voting analytics
 * - CANNOT change voting settings directly
 * 
 * DAO ADMIN (DAO Creator/Elder):
 * - Can configure voting parameters
 * - Can set voting period
 * - Can set voting threshold
 * - Can set voting weight rules
 * - Can pause/resume voting
 * - Limited to their own DAO
 */

// GET /api/admin/daos/:daoId/voting/config - Get voting configuration
router.get('/daos/:daoId/voting/config', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const adminId = (req.user as any)?.id;
    const userRole = (req.user as any)?.roles;

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions - Super Admin or DAO Admin
    if (userRole !== 'super_admin') {
      const isDaoAdmin = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId),
          inArray(daoMemberships.role, ['admin', 'elder'])
        ));

      if (!isDaoAdmin.length) {
        return res.status(403).json({ error: 'Access denied to this DAO' });
      }
    }

    // Get voting config from DAO record (stored in votingConfig JSON field)
    const votingConfig = {
      votingPeriodDays: dao[0].votingPeriodDays || 7,
      approvalThreshold: dao[0].approvalThreshold || 0.5, // 50%
      minimumParticipation: dao[0].minimumParticipation || 0.2, // 20%
      votingWeightType: dao[0].votingWeightType || 'equal', // equal, stake-based, reputation-based
      votingPaused: dao[0].votingPaused || false,
      allowAbstain: true,
      requireSignature: true,
      delayExecutionDays: 1,
    };

    res.json({
      config: votingConfig,
      dao: {
        id: dao[0].id,
        name: dao[0].name,
      },
      userRole,
      canModify: userRole === 'super_admin' || true, // DAO admin can modify
    });
  } catch (error) {
    logger.error('Error fetching voting config:', error);
    res.status(500).json({ error: 'Failed to fetch voting configuration' });
  }
});

// PUT /api/admin/daos/:daoId/voting/config - Update voting configuration
router.put('/daos/:daoId/voting/config', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const {
      votingPeriodDays,
      approvalThreshold,
      minimumParticipation,
      votingWeightType,
    } = req.body;
    const adminId = (req.user as any).id;
    const userRole = (req.user as any).roles;

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions - DAO Admin only
    if (userRole !== 'super_admin') {
      const isDaoAdmin = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId),
          eq(daoMemberships.role, 'admin')
        ));

      if (!isDaoAdmin.length) {
        return res.status(403).json({ error: 'Only DAO admin can modify voting settings' });
      }
    }

    // Validate inputs
    if (votingPeriodDays && (votingPeriodDays < 1 || votingPeriodDays > 90)) {
      return res.status(400).json({ error: 'Voting period must be between 1 and 90 days' });
    }

    if (approvalThreshold && (approvalThreshold < 0 || approvalThreshold > 1)) {
      return res.status(400).json({ error: 'Approval threshold must be between 0 and 1' });
    }

    if (minimumParticipation && (minimumParticipation < 0 || minimumParticipation > 1)) {
      return res.status(400).json({ error: 'Minimum participation must be between 0 and 1' });
    }

    // Update DAO voting settings
    await db
      .update(daos)
      .set({
        votingPeriodDays: votingPeriodDays || dao[0].votingPeriodDays,
        approvalThreshold: approvalThreshold || dao[0].approvalThreshold,
        minimumParticipation: minimumParticipation || dao[0].minimumParticipation,
        votingWeightType: votingWeightType || dao[0].votingWeightType,
        updatedAt: new Date(),
      })
      .where(eq(daos.id, daoId));

    // Log audit event
    await logAuditEvent({
      eventType: AuditEventType.VOTING_CONFIG_UPDATED,
      userId: adminId,
      action: `Voting configuration updated`,
      severity: 'medium',
      endpoint: `/api/admin/daos/:daoId/voting/config`,
      method: 'PUT',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: 200,
      metadata: {
        daoId,
        changes: {
          votingPeriodDays,
          approvalThreshold,
          minimumParticipation,
          votingWeightType,
        },
      }
    }).catch(err => console.error('Audit log failed:', err));

    logger.info('Voting config updated', { daoId, adminId, ...req.body });

    res.json({
      success: true,
      message: 'Voting configuration updated successfully',
      config: {
        votingPeriodDays,
        approvalThreshold,
        minimumParticipation,
        votingWeightType,
      }
    });
  } catch (error) {
    logger.error('Error updating voting config:', error);
    res.status(500).json({ error: 'Failed to update voting configuration' });
  }
});

// POST /api/admin/daos/:daoId/voting/pause - Pause voting
router.post('/daos/:daoId/voting/pause', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { reason } = req.body;
    const adminId = (req.user as any).id;
    const userRole = (req.user as any).roles;

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions - DAO Admin only
    if (userRole !== 'super_admin') {
      const isDaoAdmin = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId),
          eq(daoMemberships.role, 'admin')
        ));

      if (!isDaoAdmin.length) {
        return res.status(403).json({ error: 'Only DAO admin can pause voting' });
      }
    }

    // Update DAO - pause voting
    await db
      .update(daos)
      .set({
        votingPaused: true,
        updatedAt: new Date(),
      })
      .where(eq(daos.id, daoId));

    // Log audit event
    await logAuditEvent({
      eventType: AuditEventType.VOTING_PAUSED,
      userId: adminId,
      action: `Voting paused for DAO`,
      severity: 'high',
      endpoint: `/api/admin/daos/:daoId/voting/pause`,
      method: 'POST',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: 200,
      metadata: {
        daoId,
        reason,
      }
    }).catch(err => console.error('Audit log failed:', err));

    logger.warn('Voting paused', { daoId, adminId, reason });

    res.json({
      success: true,
      message: 'Voting paused successfully',
      dao: { id: daoId, votingPaused: true }
    });
  } catch (error) {
    logger.error('Error pausing voting:', error);
    res.status(500).json({ error: 'Failed to pause voting' });
  }
});

// POST /api/admin/daos/:daoId/voting/resume - Resume voting
router.post('/daos/:daoId/voting/resume', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const adminId = (req.user as any).id;
    const userRole = (req.user as any).roles;

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions - DAO Admin only
    if (userRole !== 'super_admin') {
      const isDaoAdmin = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId),
          eq(daoMemberships.role, 'admin')
        ));

      if (!isDaoAdmin.length) {
        return res.status(403).json({ error: 'Only DAO admin can resume voting' });
      }
    }

    // Update DAO - resume voting
    await db
      .update(daos)
      .set({
        votingPaused: false,
        updatedAt: new Date(),
      })
      .where(eq(daos.id, daoId));

    // Log audit event
    await logAuditEvent({
      eventType: AuditEventType.VOTING_RESUMED,
      userId: adminId,
      action: `Voting resumed for DAO`,
      severity: 'high',
      endpoint: `/api/admin/daos/:daoId/voting/resume`,
      method: 'POST',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: 200,
      metadata: {
        daoId,
      }
    }).catch(err => console.error('Audit log failed:', err));

    logger.info('Voting resumed', { daoId, adminId });

    res.json({
      success: true,
      message: 'Voting resumed successfully',
      dao: { id: daoId, votingPaused: false }
    });
  } catch (error) {
    logger.error('Error resuming voting:', error);
    res.status(500).json({ error: 'Failed to resume voting' });
  }
});

// GET /api/admin/daos/:daoId/voting/analytics - Get voting analytics
router.get('/daos/:daoId/voting/analytics', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const adminId = (req.user as any)?.id;
    const userRole = (req.user as any)?.roles;

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions
    if (userRole !== 'super_admin') {
      const isDaoAdmin = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId)
        ));

      if (!isDaoAdmin.length) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Get voting statistics
    const [
      totalProposals,
      passedProposals,
      failedProposals,
      totalVotes,
      averageParticipation,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(proposals)
        .where(eq(proposals.daoId, daoId)),
      db.select({ count: sql<number>`count(*)` })
        .from(proposals)
        .where(and(eq(proposals.daoId, daoId), eq(proposals.status, 'passed'))),
      db.select({ count: sql<number>`count(*)` })
        .from(proposals)
        .where(and(eq(proposals.daoId, daoId), eq(proposals.status, 'failed'))),
      db.select({ count: sql<number>`count(*)` })
        .from(votes),
      db.select({
        avg: sql<number>`AVG(CAST(participation AS numeric))`
      }).from(proposals)
        .where(eq(proposals.daoId, daoId)),
    ]);

    const passRate = totalProposals[0].count > 0
      ? (passedProposals[0].count / totalProposals[0].count) * 100
      : 0;

    res.json({
      analytics: {
        totalProposals: totalProposals[0].count,
        passedProposals: passedProposals[0].count,
        failedProposals: failedProposals[0].count,
        passRate: parseFloat(passRate.toFixed(2)),
        averageParticipation: averageParticipation[0]?.avg || 0,
        votingStatus: dao[0].votingPaused ? 'paused' : 'active',
      }
    });
  } catch (error) {
    logger.error('Error fetching voting analytics:', error);
    res.status(500).json({ error: 'Failed to fetch voting analytics' });
  }
});

// GET /api/admin/daos/:daoId/voting/participation - Get voting participation by member
router.get('/daos/:daoId/voting/participation', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { page = '1', limit = '20' } = req.query;
    const adminId = (req.user as any)?.id;
    const userRole = (req.user as any)?.roles;

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions
    if (userRole !== 'super_admin') {
      const isDaoAdmin = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId)
        ));

      if (!isDaoAdmin.length) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Get member voting participation
    const participation = await db
      .select({
        memberId: votes.userId,
        totalVotes: sql<number>`count(*)`,
        yesVotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'yes' THEN 1 END)`,
        noVotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'no' THEN 1 END)`,
        abstainVotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'abstain' THEN 1 END)`,
      })
      .from(votes)
      .innerJoin(proposals, eq(votes.proposalId, proposals.id))
      .where(eq(proposals.daoId, daoId))
      .groupBy(votes.userId)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(parseInt(limit as string))
      .offset(offset);

    res.json({
      participation,
      dao: { id: daoId, name: dao[0].name },
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      }
    });
  } catch (error) {
    logger.error('Error fetching participation:', error);
    res.status(500).json({ error: 'Failed to fetch participation data' });
  }
});

export default router;
