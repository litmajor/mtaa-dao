import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { proposals, daos, daoMemberships, votes } from '../../../shared/schema';
import { eq, desc, sql, and, or, like, inArray, gte, lte } from 'drizzle-orm';
import { requireRole } from '../../middleware/rbac';
import { logConsolidatedAuditEvent, AuditEventType } from '../../services/auditConsolidated';
import { getEventEmitter } from '../../middleware/websocket-event-emitter';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');
const requireAdmin = requireRole('admin');

/**
 * Proposals Management Routes with Role-Based Access Control
 * 
 * SUPER ADMIN (Platform Admin):
 * - Can VIEW all proposals
 * - Can FLAG proposals for review
 * - Can SUSPEND proposals if violation
 * - Can APPROVE/REJECT critical proposals
 * - CANNOT make standard DAO decisions (that's DAO admin's job)
 * 
 * DAO ADMIN (DAO Creator/Elder):
 * - Can manage their own DAO's proposals
 * - Can approve/reject proposals
 * - Can manage voting
 * - Limited to their own DAO
 */

// GET /api/admin/daos/:daoId/proposals - List proposals for a DAO
// Access: Super admin (view all) OR DAO admin (view own)
router.get('/daos/:daoId/proposals', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { page = '1', limit = '20', status = '' } = req.query;
    const adminId = (req.user as any)?.id;
    const userRole = (req.user as any)?.roles;

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions
    // Super admin can see all DAOs
    // Regular admins can only see their own DAO's proposals
    if (userRole !== 'super_admin') {
      const isDAOAdmin = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId),
          eq(daoMemberships.role, 'admin') // or 'creator'
        ));
      
      if (!isDAOAdmin.length) {
        return res.status(403).json({ error: 'Access denied to this DAO' });
      }
    }

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const conditions: any[] = [eq(proposals.daoId, daoId)];

    if (status && typeof status === 'string' && status !== 'all') {
      conditions.push(eq(proposals.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const proposalsList = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        description: proposals.description,
        status: proposals.status,
        type: proposals.type,
        createdAt: proposals.createdAt,
        votingEndDate: proposals.votingEndDate,
        createdBy: proposals.createdBy,
      })
      .from(proposals)
      .where(whereClause)
      .orderBy(desc(proposals.createdAt))
      .limit(parseInt(limit as string))
      .offset(offset);

    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(proposals)
      .where(whereClause);

    res.json({
      proposals: proposalsList,
      dao: {
        id: dao[0].id,
        name: dao[0].name,
      },
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / parseInt(limit as string)),
      },
      userRole,
      canManage: userRole === 'super_admin' || (userRole === 'admin' || userRole === 'user'), // DAO admin check
    });
  } catch (error) {
    logger.error('Error fetching proposals:', error);
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

// GET /api/admin/daos/:daoId/proposals/:proposalId - Get proposal details
router.get('/daos/:daoId/proposals/:proposalId', async (req: Request, res: Response) => {
  try {
    const { daoId, proposalId } = req.params;
    const adminId = (req.user as any)?.id;
    const userRole = (req.user as any)?.roles;

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions
    if (userRole !== 'super_admin') {
      const isDAOAdmin = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId)
        ));
      
      if (!isDAOAdmin.length) {
        return res.status(403).json({ error: 'Access denied to this DAO' });
      }
    }

    // Get proposal with votes
    const proposal = await db
      .select()
      .from(proposals)
      .where(and(
        eq(proposals.id, proposalId),
        eq(proposals.daoId, daoId)
      ));

    if (!proposal.length) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Get vote stats
    const voteStats = await db
      .select({
        yesCount: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'yes' THEN 1 END)`,
        noCount: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'no' THEN 1 END)`,
        abstainCount: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'abstain' THEN 1 END)`,
      })
      .from(votes)
      .where(eq(votes.proposalId, proposalId));

    res.json({
      proposal: proposal[0],
      votes: voteStats[0],
      dao: {
        id: dao[0].id,
        name: dao[0].name,
      },
      userRole,
      isSuperAdmin: userRole === 'super_admin',
    });
  } catch (error) {
    logger.error('Error fetching proposal detail:', error);
    res.status(500).json({ error: 'Failed to fetch proposal' });
  }
});

// POST /api/admin/daos/:daoId/proposals/:proposalId/flag - Flag for review (Super Admin only)
router.post('/daos/:daoId/proposals/:proposalId/flag', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { daoId, proposalId } = req.params;
    const { reason, severity } = req.body;
    const adminId = (req.user as any).id;

    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    const proposal = await db
      .select()
      .from(proposals)
      .where(and(
        eq(proposals.id, proposalId),
        eq(proposals.daoId, daoId)
      ));

    if (!proposal.length) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Update proposal with flag
    await db
      .update(proposals)
      .set({
        flagged: true,
        flagReason: reason,
        flaggedAt: new Date(),
        flaggedBy: adminId,
      })
      .where(eq(proposals.id, proposalId));

    // Log audit event
    await logAuditEvent({
      eventType: AuditEventType.PROPOSAL_FLAGGED,
      userId: adminId,
      action: `Proposal flagged: ${proposal[0].title}`,
      severity: severity || 'high',
      endpoint: `/api/admin/daos/:daoId/proposals/:proposalId/flag`,
      method: 'POST',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: 200,
      metadata: {
        daoId,
        proposalId,
        reason,
        severity,
      }
    }).catch(err => console.error('Audit log failed:', err));

    logger.info('Proposal flagged by super admin', { proposalId, daoId, adminId, reason });

    // Emit WebSocket event for real-time updates
    try {
      const wsEmitter = getEventEmitter();
      wsEmitter.emitApprovalUpdate('proposal', proposalId, 'flagged', adminId, {
        daoId,
        reason,
        severity,
        flaggedAt: new Date()
      });
    } catch (wsError) {
      logger.warn('Failed to emit WebSocket event for proposal flag:', wsError);
    }

    res.json({
      success: true,
      message: 'Proposal flagged for review',
      proposal: {
        id: proposalId,
        flagged: true,
        flagReason: reason,
      }
    });
  } catch (error) {
    logger.error('Error flagging proposal:', error);
    res.status(500).json({ error: 'Failed to flag proposal' });
  }
});

// POST /api/admin/daos/:daoId/proposals/:proposalId/suspend - Suspend proposal (Super Admin only)
// Used in case of critical issues or violations
router.post('/daos/:daoId/proposals/:proposalId/suspend', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { daoId, proposalId } = req.params;
    const { reason } = req.body;
    const adminId = (req.user as any).id;

    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    const proposal = await db
      .select()
      .from(proposals)
      .where(and(
        eq(proposals.id, proposalId),
        eq(proposals.daoId, daoId)
      ));

    if (!proposal.length) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Suspend the proposal
    await db
      .update(proposals)
      .set({
        status: 'suspended',
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, proposalId));

    // Log audit event
    await logAuditEvent({
      eventType: AuditEventType.PROPOSAL_SUSPENDED,
      userId: adminId,
      action: `Proposal suspended: ${proposal[0].title}`,
      severity: 'critical',
      endpoint: `/api/admin/daos/:daoId/proposals/:proposalId/suspend`,
      method: 'POST',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: 200,
      metadata: {
        daoId,
        proposalId,
        reason,
      }
    }).catch(err => console.error('Audit log failed:', err));

    logger.warn('Proposal suspended by super admin', { proposalId, daoId, adminId, reason });

    // Emit WebSocket event for real-time updates (critical status change)
    try {
      const wsEmitter = getEventEmitter();
      wsEmitter.emitApprovalUpdate('proposal', proposalId, 'suspended', adminId, {
        daoId,
        reason,
        suspendedAt: new Date()
      });
    } catch (wsError) {
      logger.warn('Failed to emit WebSocket event for proposal suspend:', wsError);
    }

    res.json({
      success: true,
      message: 'Proposal suspended successfully',
    });
  } catch (error) {
    logger.error('Error suspending proposal:', error);
    res.status(500).json({ error: 'Failed to suspend proposal' });
  }
});

// GET /api/admin/daos/:daoId/proposals/stats - Get proposal statistics for a DAO
router.get('/daos/:daoId/proposals/stats', async (req: Request, res: Response) => {
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
      const isDAOAdmin = await db
        .select()
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, adminId)
        ));
      
      if (!isDAOAdmin.length) {
        return res.status(403).json({ error: 'Access denied to this DAO' });
      }
    }

    const [
      totalProposals,
      activeProposals,
      passedProposals,
      failedProposals,
      suspendedProposals,
      flaggedProposals,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(proposals).where(eq(proposals.daoId, daoId)),
      db.select({ count: sql<number>`count(*)` }).from(proposals).where(and(
        eq(proposals.daoId, daoId),
        eq(proposals.status, 'active')
      )),
      db.select({ count: sql<number>`count(*)` }).from(proposals).where(and(
        eq(proposals.daoId, daoId),
        eq(proposals.status, 'passed')
      )),
      db.select({ count: sql<number>`count(*)` }).from(proposals).where(and(
        eq(proposals.daoId, daoId),
        eq(proposals.status, 'failed')
      )),
      db.select({ count: sql<number>`count(*)` }).from(proposals).where(and(
        eq(proposals.daoId, daoId),
        eq(proposals.status, 'suspended')
      )),
      db.select({ count: sql<number>`count(*)` }).from(proposals).where(and(
        eq(proposals.daoId, daoId),
        // @ts-ignore - flagged is a custom field
        sql`flagged = true`
      )),
    ]);

    res.json({
      stats: {
        totalProposals: totalProposals[0].count,
        activeProposals: activeProposals[0].count,
        passedProposals: passedProposals[0].count,
        failedProposals: failedProposals[0].count,
        suspendedProposals: suspendedProposals[0].count,
        flaggedProposals: flaggedProposals[0].count,
      }
    });
  } catch (error) {
    logger.error('Error fetching proposal stats:', error);
    res.status(500).json({ error: 'Failed to fetch proposal stats' });
  }
});

// GET /api/admin/proposals/pending - Get all pending proposals (Super Admin only)
// For platform overview
router.get('/proposals/pending', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const pendingProposals = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        daoId: proposals.daoId,
        status: proposals.status,
        createdAt: proposals.createdAt,
        flagged: sql<boolean>`flagged`,
      })
      .from(proposals)
      .where(eq(proposals.status, 'active'))
      .orderBy(desc(proposals.createdAt))
      .limit(parseInt(limit as string))
      .offset(offset);

    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(proposals)
      .where(eq(proposals.status, 'active'));

    res.json({
      proposals: pendingProposals,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / parseInt(limit as string)),
      }
    });
  } catch (error) {
    logger.error('Error fetching pending proposals:', error);
    res.status(500).json({ error: 'Failed to fetch pending proposals' });
  }
});

export default router;
