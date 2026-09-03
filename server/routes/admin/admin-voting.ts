import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { daos, daoMemberships, proposals, votes } from '../../../shared/schema';
import { eq, desc, sql, and, inArray } from 'drizzle-orm';
import { logConsolidatedAuditEvent, AuditEventType } from '../../services/auditConsolidated';

const router = Router();

// Express User Type Interface
interface AuthenticatedUser {
  id: string;
  roles?: string | string[];
}

/**
 * Helper to verify DAO existence and validate caller permissions.
 */
async function verifyDaoAccess(daoId: string, userId?: string, userRole?: string, allowedRoles: string[] = ['admin']) {
  const daoRecords = await db.select().from(daos).where(eq(daos.id, daoId));
  if (!daoRecords.length) {
    return { error: 'DAO not found', statusCode: 404, dao: null, isAuthorized: false };
  }

  const dao = daoRecords[0];

  if (userRole === 'super_admin') {
    return { error: null, statusCode: 200, dao, isAuthorized: true };
  }

  if (!userId) {
    return { error: 'Unauthorized access', statusCode: 401, dao: null, isAuthorized: false };
  }

  const membership = await db
    .select()
    .from(daoMemberships)
    .where(
      and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId),
        inArray(daoMemberships.role, allowedRoles)
      )
    );

  if (!membership.length) {
    return { error: 'Access denied to this DAO', statusCode: 403, dao, isAuthorized: false };
  }

  return { error: null, statusCode: 200, dao, isAuthorized: true };
}

// GET /api/admin/daos/:daoId/voting/config - Get voting configuration
router.get('/daos/:daoId/voting/config', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const user = req.user as AuthenticatedUser | undefined;
    const adminId = user?.id;
    const userRole = typeof user?.roles === 'string'
      ? user.roles
      : Array.isArray(user?.roles)
        ? user.roles[0]
        : undefined;

    const { error, statusCode, dao } = await verifyDaoAccess(daoId, adminId, userRole, ['admin', 'elder', 'member']);
    if (error || !dao) {
      return res.status(statusCode).json({ error });
    }

    const votingPeriodHours = dao.votingPeriod ?? 72;
    const votingConfig = {
      votingPeriodDays: Math.max(1, Math.round(votingPeriodHours / 24)),
      approvalThreshold: 0.51,
      minimumParticipation: (dao.quorumPercentage ?? 20) / 100,
      votingWeightType: 'equal',
      votingPaused: dao.status === 'suspended',
      allowAbstain: true,
      requireSignature: true,
      delayExecutionDays: Math.max(1, Math.round((dao.executionDelay ?? 24) / 24)),
    };

    const isDaoAdmin = userRole === 'super_admin' ? false : true; // Per JSDoc: Super admin views; DAO admin manages

    res.json({
      config: votingConfig,
      dao: {
        id: dao.id,
        name: dao.name,
      },
      userRole,
      canModify: isDaoAdmin,
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
    const { votingPeriodDays, approvalThreshold, minimumParticipation, votingWeightType } = req.body;
    const user = req.user as AuthenticatedUser | undefined;
    const adminId = user?.id;
    const userRole = Array.isArray(user?.roles) ? user.roles[0] : user?.roles;

    const { error, statusCode, dao } = await verifyDaoAccess(daoId, adminId, userRole, ['admin']);
    if (error || !dao) {
      return res.status(statusCode).json({ error });
    }

    // Input Validation
    if (votingPeriodDays !== undefined && (Number(votingPeriodDays) < 1 || Number(votingPeriodDays) > 90)) {
      return res.status(400).json({ error: 'Voting period must be between 1 and 90 days' });
    }

    if (approvalThreshold !== undefined && (Number(approvalThreshold) < 0 || Number(approvalThreshold) > 1)) {
      return res.status(400).json({ error: 'Approval threshold must be between 0 and 1' });
    }

    if (minimumParticipation !== undefined && (Number(minimumParticipation) < 0 || Number(minimumParticipation) > 1)) {
      return res.status(400).json({ error: 'Minimum participation must be between 0 and 1' });
    }

    const nextVotingPeriodHours = votingPeriodDays !== undefined
      ? Math.max(1, Math.min(90, Number(votingPeriodDays))) * 24
      : dao.votingPeriod ?? 72;

    const nextQuorumPercentage = minimumParticipation !== undefined
      ? Math.max(0, Math.min(100, Number(minimumParticipation) * 100))
      : dao.quorumPercentage ?? 20;

    await db
      .update(daos)
      .set({
        votingPeriod: nextVotingPeriodHours,
        quorumPercentage: nextQuorumPercentage,
        updatedAt: new Date(),
      })
      .where(eq(daos.id, daoId));

    if (adminId) {
      await logConsolidatedAuditEvent({
        actorId: adminId,
        actorType: 'admin',
        actorRole: typeof userRole === 'string' ? userRole : 'admin',
        actionType: AuditEventType.ADMIN_SETTINGS_CHANGED,
        actionCategory: 'admin',
        targetType: 'dao',
        targetId: daoId,
        targetName: dao.name || undefined,
        result: 'success',
        severity: 'medium',
        endpoint: '/api/admin/daos/:daoId/voting/config',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          daoId,
          changes: {
            votingPeriodDays: votingPeriodDays ?? Math.max(1, Math.round((dao.votingPeriod ?? 72) / 24)),
            approvalThreshold: approvalThreshold ?? 0.51,
            minimumParticipation: minimumParticipation ?? (dao.quorumPercentage ?? 20) / 100,
            votingWeightType: votingWeightType ?? 'equal',
          },
        },
      }).catch((err: unknown) => logger.error('Audit log failed:', err));
    }

    logger.info('Voting config updated', { daoId, adminId, ...req.body });

    res.json({
      success: true,
      message: 'Voting configuration updated successfully',
      config: {
        votingPeriodDays: votingPeriodDays ?? Math.max(1, Math.round(nextVotingPeriodHours / 24)),
        approvalThreshold: approvalThreshold ?? 0.51,
        minimumParticipation: minimumParticipation ?? (nextQuorumPercentage / 100),
        votingWeightType: votingWeightType ?? 'equal',
      },
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
    const user = req.user as AuthenticatedUser | undefined;
    const adminId = user?.id;
    const userRole = Array.isArray(user?.roles) ? user.roles[0] : user?.roles;

    const { error, statusCode, dao } = await verifyDaoAccess(daoId, adminId, userRole, ['admin']);
    if (error || !dao) {
      return res.status(statusCode).json({ error });
    }

    await db
      .update(daos)
      .set({
        status: 'suspended',
        updatedAt: new Date(),
      })
      .where(eq(daos.id, daoId));

    if (adminId) {
      await logConsolidatedAuditEvent({
        actorId: adminId,
        actorType: 'admin',
        actorRole: typeof userRole === 'string' ? userRole : 'admin',
        actionType: AuditEventType.ADMIN_SETTINGS_CHANGED,
        actionCategory: 'admin',
        targetType: 'dao',
        targetId: daoId,
        targetName: dao.name || undefined,
        result: 'success',
        severity: 'high',
        endpoint: '/api/admin/daos/:daoId/voting/pause',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { daoId, reason, votingStatus: 'paused' },
      }).catch((err: unknown) => logger.error('Audit log failed:', err));
    }

    logger.warn('Voting paused', { daoId, adminId, reason });

    res.json({
      success: true,
      message: 'Voting paused successfully',
      dao: { id: daoId, votingStatus: 'paused' },
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
    const user = req.user as AuthenticatedUser | undefined;
    const adminId = user?.id;
    const userRole = Array.isArray(user?.roles) ? user.roles[0] : user?.roles;

    const { error, statusCode, dao } = await verifyDaoAccess(daoId, adminId, userRole, ['admin']);
    if (error || !dao) {
      return res.status(statusCode).json({ error });
    }

    await db
      .update(daos)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(daos.id, daoId));

    if (adminId) {
      await logConsolidatedAuditEvent({
        actorId: adminId,
        actorType: 'admin',
        actorRole: typeof userRole === 'string' ? userRole : 'admin',
        actionType: AuditEventType.ADMIN_SETTINGS_CHANGED,
        actionCategory: 'admin',
        targetType: 'dao',
        targetId: daoId,
        targetName: dao.name || undefined,
        result: 'success',
        severity: 'medium',
        endpoint: '/api/admin/daos/:daoId/voting/resume',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { daoId, votingStatus: 'active' },
      }).catch((err: unknown) => logger.error('Audit log failed:', err));
    }

    logger.info('Voting resumed', { daoId, adminId });

    res.json({
      success: true,
      message: 'Voting resumed successfully',
      dao: { id: daoId, votingStatus: 'active' },
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
    const user = req.user as AuthenticatedUser | undefined;
    const adminId = user?.id;
    const userRole = typeof user?.roles === 'string'
      ? user.roles
      : Array.isArray(user?.roles)
        ? user.roles[0]
        : undefined;

    const { error, statusCode, dao } = await verifyDaoAccess(daoId, adminId, userRole, ['admin', 'elder', 'member']);
    if (error || !dao) {
      return res.status(statusCode).json({ error });
    }

    const [
      totalProposalsRes,
      passedProposalsRes,
      failedProposalsRes,
      totalVotesRes,
      averageParticipationRes,
    ] = await Promise.all([
      db.select({ count: sql<string>`count(*)` }).from(proposals).where(eq(proposals.daoId, daoId)),
      db.select({ count: sql<string>`count(*)` }).from(proposals).where(and(eq(proposals.daoId, daoId), eq(proposals.status, 'passed'))),
      db.select({ count: sql<string>`count(*)` }).from(proposals).where(and(eq(proposals.daoId, daoId), eq(proposals.status, 'failed'))),
      // FIXED: Scoped vote count to target DAO proposals
      db.select({ count: sql<string>`count(*)` })
        .from(votes)
        .innerJoin(proposals, eq(votes.proposalId, proposals.id))
        .where(eq(proposals.daoId, daoId)),
      db.select({ avg: sql<string>`AVG(CAST(participation AS numeric))` })
        .from(proposals)
        .where(eq(proposals.daoId, daoId)),
    ]);

    const totalProposals = Number(totalProposalsRes[0]?.count ?? 0);
    const passedProposals = Number(passedProposalsRes[0]?.count ?? 0);
    const failedProposals = Number(failedProposalsRes[0]?.count ?? 0);
    const totalVotes = Number(totalVotesRes[0]?.count ?? 0);
    const averageParticipation = Number(averageParticipationRes[0]?.avg ?? 0);

    const passRate = totalProposals > 0 ? (passedProposals / totalProposals) * 100 : 0;

    res.json({
      analytics: {
        totalProposals,
        passedProposals,
        failedProposals,
        totalVotes,
        passRate: Number(passRate.toFixed(2)),
        averageParticipation: Number(averageParticipation.toFixed(2)),
        votingStatus: dao.status === 'suspended' ? 'paused' : 'active',
      },
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
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '20', 10)));
    const offset = (page - 1) * limit;

    const user = req.user as AuthenticatedUser | undefined;
    const adminId = user?.id;
    const userRole = typeof user?.roles === 'string'
      ? user.roles
      : Array.isArray(user?.roles)
        ? user.roles[0]
        : undefined;

    const { error, statusCode, dao } = await verifyDaoAccess(daoId, adminId, userRole, ['admin', 'elder', 'member']);
    if (error || !dao) {
      return res.status(statusCode).json({ error });
    }

    const participation = await db
      .select({
        memberId: votes.userId,
        totalVotes: sql<number>`CAST(count(*) AS integer)`,
        yesVotes: sql<number>`CAST(COUNT(CASE WHEN ${votes.voteType} = 'yes' THEN 1 END) AS integer)`,
        noVotes: sql<number>`CAST(COUNT(CASE WHEN ${votes.voteType} = 'no' THEN 1 END) AS integer)`,
        abstainVotes: sql<number>`CAST(COUNT(CASE WHEN ${votes.voteType} = 'abstain' THEN 1 END) AS integer)`,
      })
      .from(votes)
      .innerJoin(proposals, eq(votes.proposalId, proposals.id))
      .where(eq(proposals.daoId, daoId))
      .groupBy(votes.userId)
      .orderBy(desc(sql`count(*)`))
      .limit(limit)
      .offset(offset);

    res.json({
      participation,
      dao: { id: daoId, name: dao.name },
      pagination: {
        page,
        limit,
      },
    });
  } catch (error) {
    logger.error('Error fetching participation:', error);
    res.status(500).json({ error: 'Failed to fetch participation data' });
  }
});

export default router;