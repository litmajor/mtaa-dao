import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { proposals, daos, daoMemberships, votes, auditLogs } from '../../../shared/schema';
import { eq, desc, sql, and, or, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { requireRole } from '../../middleware/rbac';
import { getEventEmitter } from '../../middleware/websocket-event-emitter';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');

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
    const adminId = getUserId(req);
    const isSuperAdmin = hasRole(req, 'super_admin');

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions
    // Super admin can see all DAOs
    // Regular admins can only see their own DAO's proposals
    if (!isSuperAdmin && !(adminId && await isDaoAdministrator(adminId, daoId))) {
        return res.status(403).json({ error: 'Access denied to this DAO' });
    }

    const pagination = parsePagination(page, limit);
    const offset = (pagination.page - 1) * pagination.limit;
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
        proposalType: proposals.proposalType,
        createdAt: proposals.createdAt,
        voteEndTime: proposals.voteEndTime,
        proposerId: proposals.proposerId,
      })
      .from(proposals)
      .where(whereClause)
      .orderBy(desc(proposals.createdAt))
      .limit(pagination.limit)
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
        page: pagination.page,
        limit: pagination.limit,
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / pagination.limit),
      },
      userRole: isSuperAdmin ? 'super_admin' : 'admin',
      canManage: isSuperAdmin || Boolean(adminId && await isDaoAdministrator(adminId, daoId)),
    });
  } catch (error) {
    if (error instanceof InvalidParameterError) {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Error fetching proposals:', error);
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

// GET /api/admin/daos/:daoId/proposals/:proposalId - Get proposal details
router.get('/daos/:daoId/proposals/:proposalId', async (req: Request, res: Response) => {
  try {
    const { daoId, proposalId } = req.params;
    const adminId = getUserId(req);
    const isSuperAdmin = hasRole(req, 'super_admin');

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions
    if (!isSuperAdmin && !(adminId && await isDaoAdministrator(adminId, daoId))) {
      return res.status(403).json({ error: 'Access denied to this DAO' });
    }

    // Get proposal with votes
    const proposal = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        description: proposals.description,
        proposalType: proposals.proposalType,
        status: proposals.status,
        daoId: proposals.daoId,
        proposerId: proposals.proposerId,
        voteStartTime: proposals.voteStartTime,
        voteEndTime: proposals.voteEndTime,
        quorumRequired: proposals.quorumRequired,
        yesVotes: proposals.yesVotes,
        noVotes: proposals.noVotes,
        abstainVotes: proposals.abstainVotes,
        metadata: proposals.metadata,
        createdAt: proposals.createdAt,
        updatedAt: proposals.updatedAt,
      })
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
      votes: {
        yesCount: Number(voteStats[0]?.yesCount || 0),
        noCount: Number(voteStats[0]?.noCount || 0),
        abstainCount: Number(voteStats[0]?.abstainCount || 0),
      },
      dao: {
        id: dao[0].id,
        name: dao[0].name,
      },
      userRole: isSuperAdmin ? 'super_admin' : 'admin',
      isSuperAdmin,
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
    const adminId = getUserId(req);

    if (!adminId || !isValidReason(reason)) {
      return res.status(400).json({ error: 'A reason between 1 and 1000 characters is required' });
    }
    if (severity !== undefined && !['low', 'medium', 'high', 'critical'].includes(severity)) {
      return res.status(400).json({ error: 'Invalid severity' });
    }

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

    const now = new Date();
    await db.transaction(async tx => {
      await tx
        .update(proposals)
        .set({
          metadata: sql`jsonb_set(
            COALESCE(${proposals.metadata}, '{}'::jsonb),
            '{moderation}',
            COALESCE(${proposals.metadata}->'moderation', '{}'::jsonb) || ${JSON.stringify({
              flagged: true,
              flagReason: reason,
              flaggedAt: now.toISOString(),
              flaggedBy: adminId,
            })}::jsonb,
            true
          )`,
        })
        .where(and(eq(proposals.id, proposalId), eq(proposals.daoId, daoId)));

      await tx.insert(auditLogs).values({
        id: randomUUID(),
        userId: adminId,
        action: 'PROPOSAL_FLAGGED',
        resource: 'proposal',
        resourceId: proposalId,
        method: 'admin',
        endpoint: '/api/admin/daos/:daoId/proposals/:proposalId/flag',
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('user-agent') || 'unknown',
        status: 200,
        details: { daoId, reason, severity: severity || 'high' },
        severity: severity || 'high',
        category: 'governance',
        createdAt: now,
        updatedAt: now,
      } as any);
    });

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
      logger.warn('Failed to emit WebSocket event for proposal flag:', { error: String(wsError) });
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
    const adminId = getUserId(req);

    if (!adminId || !isValidReason(reason)) {
      return res.status(400).json({ error: 'A reason between 1 and 1000 characters is required' });
    }

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

    const now = new Date();
    await db.transaction(async tx => {
      await tx
        .update(proposals)
        .set({
          status: 'suspended',
          updatedAt: now,
          metadata: sql`jsonb_set(
            COALESCE(${proposals.metadata}, '{}'::jsonb),
            '{moderation}',
            COALESCE(${proposals.metadata}->'moderation', '{}'::jsonb) || ${JSON.stringify({
              suspendedReason: reason,
              suspendedAt: now.toISOString(),
              suspendedBy: adminId,
            })}::jsonb,
            true
          )`,
        })
        .where(and(eq(proposals.id, proposalId), eq(proposals.daoId, daoId)));

      await tx.insert(auditLogs).values({
        id: randomUUID(),
        userId: adminId,
        action: 'PROPOSAL_SUSPENDED',
        resource: 'proposal',
        resourceId: proposalId,
        method: 'admin',
        endpoint: '/api/admin/daos/:daoId/proposals/:proposalId/suspend',
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('user-agent') || 'unknown',
        status: 200,
        details: { daoId, reason },
        severity: 'critical',
        category: 'governance',
        createdAt: now,
        updatedAt: now,
      } as any);
    });

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
      logger.warn('Failed to emit WebSocket event for proposal suspend:', { error: String(wsError) });
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
    const adminId = getUserId(req);
    const isSuperAdmin = hasRole(req, 'super_admin');

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions
    if (!isSuperAdmin && !(adminId && await isDaoAdministrator(adminId, daoId))) {
        return res.status(403).json({ error: 'Access denied to this DAO' });
    }

    const [proposalStats] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        active: sql<number>`COUNT(*) FILTER (WHERE ${proposals.status} = 'active')`,
        passed: sql<number>`COUNT(*) FILTER (WHERE ${proposals.status} = 'passed')`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${proposals.status} = 'failed')`,
        suspended: sql<number>`COUNT(*) FILTER (WHERE ${proposals.status} = 'suspended')`,
        flagged: sql<number>`COUNT(*) FILTER (WHERE ${proposals.metadata}->'moderation'->>'flagged' = 'true')`,
      })
      .from(proposals)
      .where(eq(proposals.daoId, daoId));

    res.json({
      stats: {
        totalProposals: Number(proposalStats.total),
        activeProposals: Number(proposalStats.active),
        passedProposals: Number(proposalStats.passed),
        failedProposals: Number(proposalStats.failed),
        suspendedProposals: Number(proposalStats.suspended),
        flaggedProposals: Number(proposalStats.flagged),
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
    const pagination = parsePagination(page, limit);
    const offset = (pagination.page - 1) * pagination.limit;

    const pendingProposals = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        daoId: proposals.daoId,
        status: proposals.status,
        createdAt: proposals.createdAt,
        flagged: sql<boolean>`COALESCE(${proposals.metadata}->'moderation'->>'flagged', 'false') = 'true'`,
      })
      .from(proposals)
      .where(eq(proposals.status, 'active'))
      .orderBy(desc(proposals.createdAt))
      .limit(pagination.limit)
      .offset(offset);

    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(proposals)
      .where(eq(proposals.status, 'active'));

    res.json({
      proposals: pendingProposals,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / pagination.limit),
      }
    });
  } catch (error) {
    if (error instanceof InvalidParameterError) {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Error fetching pending proposals:', error);
    res.status(500).json({ error: 'Failed to fetch pending proposals' });
  }
});

function getUserId(req: Request): string | undefined {
  const user = req.user as any;
  return user?.id || user?.claims?.sub;
}

function hasRole(req: Request, role: string): boolean {
  const user = req.user as any;
  const roleValues = user?.roles ?? user?.role ?? user?.claims?.roles ?? user?.claims?.role ?? [];
  const roles = Array.isArray(roleValues) ? roleValues : String(roleValues).split(',').map(value => value.trim());
  return roles.includes(role);
}

async function isDaoAdministrator(userId: string, daoId: string): Promise<boolean> {
  const memberships = await db
    .select({ id: daoMemberships.id })
    .from(daoMemberships)
    .where(and(
      eq(daoMemberships.daoId, daoId),
      eq(daoMemberships.userId, userId),
      eq(daoMemberships.status, 'approved'),
      eq(daoMemberships.isBanned, false),
      or(
        inArray(daoMemberships.role, ['admin', 'owner', 'elder']),
        eq(daoMemberships.isAdmin, true)
      )
    ))
    .limit(1);
  return memberships.length > 0;
}

function parsePagination(pageValue: unknown, limitValue: unknown): { page: number; limit: number } {
  const page = Number(pageValue);
  const limit = Number(limitValue);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new InvalidParameterError('Invalid pagination parameters');
  }
  return { page, limit };
}

function isValidReason(reason: unknown): reason is string {
  return typeof reason === 'string' && reason.trim().length > 0 && reason.length <= 1000;
}

class InvalidParameterError extends Error {}

export default router;
