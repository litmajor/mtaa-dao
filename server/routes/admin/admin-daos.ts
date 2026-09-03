import { Router } from 'express';
import type { Request } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { daos, daoMemberships, vaults, proposals } from '../../../shared/schema';
import { eq, desc, sql, and, or, ilike, isNull, inArray } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { requireRole } from '../../middleware/rbac';
import { logConsolidatedAuditEvent, AuditEventType } from '../../services/auditConsolidated';
import softDeleteService from '../../services/softDeleteService';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');
const validPlans = ['free', 'premium', 'short_term', 'collective'] as const;
const validStatuses = ['active', 'pending', 'suspended', 'archived'] as const;

function getAdminId(req: Request): string | null {
  return req.user?.userId || req.user?.claims?.sub || req.user?.id || null;
}

function parsePagination(query: Request['query']): { page: number; limit: number; offset: number } | null {
  const pageValue = String(query.page ?? '1');
  const limitValue = String(query.limit ?? '20');
  if (!/^\d+$/.test(pageValue) || !/^\d+$/.test(limitValue)) return null;
  const page = Number(pageValue);
  const limit = Number(limitValue);
  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset)) return null;
  return { page, limit, offset };
}

function escapeSearch(value: string): string {
  return value.replace(/[%_]/g, character => `\\${character}`);
}

function parseReason(value: unknown, fallback?: string): string | null {
  if (value === undefined && fallback) return fallback;
  if (typeof value !== 'string') return null;
  const reason = value.trim();
  return reason.length > 0 && reason.length <= 1000 ? reason : null;
}

async function auditDaoAccess(req: Request, actionType: AuditEventType | string, daoId: string): Promise<void> {
  const actorId = getAdminId(req);
  if (!actorId) return;
  try {
    await logConsolidatedAuditEvent({ actorId, actorType: 'super_admin', actorRole: 'super_admin', actionType,
      actionCategory: 'admin', targetType: 'dao', targetId: daoId, endpoint: req.originalUrl,
      ipAddress: req.ip, userAgent: req.get('user-agent'), result: 'success', severity: 'low' });
  } catch (error) {
    logger.error('DAO audit logging failed:', error);
  }
}

async function auditDaoMutation(req: Request, actionType: AuditEventType | string, daoId: string, metadata: Record<string, unknown>): Promise<void> {
  const actorId = getAdminId(req);
  if (!actorId) return;
  try {
    await logConsolidatedAuditEvent({ actorId, actorType: 'super_admin', actorRole: 'super_admin', actionType,
      actionCategory: 'admin', targetType: 'dao', targetId: daoId, endpoint: req.originalUrl,
      ipAddress: req.ip, userAgent: req.get('user-agent'), result: 'success', severity: 'high', metadata });
  } catch (error) {
    logger.error('DAO mutation audit logging failed:', error);
  }
}

function parseDaoIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) return null;
  const ids = value.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).map(id => id.trim());
  return ids.length === value.length && new Set(ids).size === ids.length ? ids : null;
}

function parseDaoId(daoId: string): string | null {
  return daoId.trim().length > 0 ? daoId.trim() : null;
}

// Static batch route must precede /daos/:daoId/* routes.
router.post('/daos/batch-suspend', requireSuperAdmin, async (req, res) => {
  try {
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });
    const daoIds = parseDaoIds(req.body?.daoIds);
    const reason = parseReason(req.body?.reason);
    if (!daoIds) return res.status(400).json({ error: 'daoIds must contain 1 to 50 unique IDs' });
    if (!reason) return res.status(400).json({ error: 'A suspension reason is required' });

    const result = await db.transaction(async (tx) => {
      const records = await tx.select({ id: daos.id, status: daos.status, deletedAt: daos.deleted_at })
        .from(daos).where(inArray(daos.id, daoIds));
      const byId = new Map(records.map(record => [record.id, record]));
      const skipped: Array<{ daoId: string; reason: string }> = [];
      const eligibleIds: string[] = [];
      for (const daoId of daoIds) {
        const record = byId.get(daoId);
        if (!record) skipped.push({ daoId, reason: 'DAO not found' });
        else if (record.deletedAt) skipped.push({ daoId, reason: 'DAO is deleted' });
        else if (record.status !== 'active') skipped.push({ daoId, reason: `DAO is ${record.status || 'not active'}` });
        else eligibleIds.push(daoId);
      }
      if (eligibleIds.length === 0) return { succeeded: [], skipped, failed: [] };
      const updated = await tx.update(daos).set({ status: 'suspended', updatedAt: new Date() })
        .where(and(inArray(daos.id, eligibleIds), eq(daos.status, 'active'), isNull(daos.deleted_at)))
        .returning({ id: daos.id });
      const updatedIds = new Set(updated.map(item => item.id));
      const failed = eligibleIds.filter(daoId => !updatedIds.has(daoId)).map(daoId => ({ daoId, reason: 'DAO changed before update' }));
      return { succeeded: [...updatedIds], skipped, failed };
    });
    for (const daoId of result.succeeded) await auditDaoMutation(req, 'DAO_SUSPENDED', daoId, { reason, batch: true });
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Error batch suspending DAOs:', error);
    res.status(500).json({ error: 'Failed to batch suspend DAOs' });
  }
});

router.get('/daos/:daoId/suspend-preflight', requireSuperAdmin, async (req, res) => {
  try {
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });
    const daoId = parseDaoId(req.params.daoId);
    if (!daoId) return res.status(400).json({ error: 'DAO ID is required' });
    const [dao, members, proposalsSummary, treasury] = await Promise.all([
      db.select({ id: daos.id, name: daos.name, status: daos.status, deletedAt: daos.deleted_at }).from(daos).where(eq(daos.id, daoId)).limit(1),
      db.select({ count: sql<number>`count(*)` }).from(daoMemberships).where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.status, 'approved'), eq(daoMemberships.isBanned, false))),
      db.select({
        active: sql<number>`count(*) filter (where ${proposals.status} = 'active')`,
        pending: sql<number>`count(*) filter (where ${proposals.status} = 'pending')`,
      }).from(proposals).where(eq(proposals.daoId, daoId)),
      db.select({ vaults: sql<number>`count(*)`, balance: sql<number>`coalesce(sum(cast(${vaults.balance} as numeric)), 0)` }).from(vaults).where(eq(vaults.daoId, daoId)),
    ]);
    if (!dao.length) return res.status(404).json({ error: 'DAO not found' });
    const response = { advisory: true, dao: dao[0], impact: {
      activeMembers: Number(members[0]?.count || 0), activeProposals: Number(proposalsSummary[0]?.active || 0),
      pendingProposals: Number(proposalsSummary[0]?.pending || 0), vaults: Number(treasury[0]?.vaults || 0),
      treasuryBalanceSnapshot: treasury[0]?.balance || 0,
    }, canSuspend: dao[0].status === 'active' && !dao[0].deletedAt };
    await auditDaoAccess(req, 'ADMIN_DAO_SUSPEND_PREFLIGHT_ACCESSED', daoId);
    res.json(response);
  } catch (error) {
    logger.error('Error getting DAO suspend preflight:', error);
    res.status(500).json({ error: 'Failed to get DAO suspend preflight' });
  }
});

router.post('/daos/:daoId/recover', requireSuperAdmin, async (req, res) => {
  try {
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });
    const daoId = parseDaoId(req.params.daoId);
    const reason = parseReason(req.body?.reason, 'Admin DAO recovery');
    if (!daoId || !reason) return res.status(400).json({ error: 'DAO ID and a valid recovery reason are required' });
    const status = await softDeleteService.getRecoveryStatus(daoId, 'dao');
    if (!status.isDeleted) return res.json({ success: true, alreadyRestored: true, daoId });
    await softDeleteService.restoreDAO({ targetId: daoId, targetType: 'dao', restoredBy: adminId, reason });
    await auditDaoMutation(req, 'DAO_RECOVERED', daoId, { reason });
    res.json({ success: true, daoId, recovered: true, recoveredAt: new Date() });
  } catch (error) {
    logger.error('Error recovering DAO:', error);
    if (error instanceof Error && /expired|not found/i.test(error.message)) return res.status(409).json({ error: 'DAO cannot be recovered' });
    res.status(500).json({ error: 'Failed to recover DAO' });
  }
});

// DAO management endpoints
router.get('/daos/list', requireSuperAdmin, async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    if (!pagination) return res.status(400).json({ error: 'page must be >= 1 and limit must be between 1 and 100' });
    const { page, limit, offset } = pagination;
    const { search = '', status = '' } = req.query;

    const conditions: SQL[] = [isNull(daos.deleted_at)];

    if (typeof search === 'string' && search.trim()) {
      const escapedSearch = `%${escapeSearch(search.trim())}%`;
      const searchCondition = or(
        ilike(daos.name, escapedSearch),
        ilike(daos.description, escapedSearch),
        ilike(daos.id, escapedSearch)
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    if (typeof status === 'string' && status && status !== 'all') {
      if (!validStatuses.includes(status as typeof validStatuses[number])) return res.status(400).json({ error: 'Invalid DAO status' });
      conditions.push(eq(daos.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const daosList = await db
      .select({
        id: daos.id,
        name: daos.name,
        description: daos.description,
        status: daos.status,
        plan: daos.plan,
        createdAt: daos.createdAt,
        updatedAt: daos.updatedAt,
      })
      .from(daos)
      .where(whereClause)
      .orderBy(desc(daos.createdAt), desc(daos.id))
      .limit(limit)
      .offset(offset);

    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(daos)
      .where(whereClause);

    const response = {
      daos: daosList,
      pagination: {
        page,
        limit,
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / limit),
      },
    };
    await auditDaoAccess(req, 'ADMIN_DAO_LIST_ACCESSED', 'all');
    res.json(response);
  } catch (error) {
    logger.error('Error listing DAOs:', error);
    res.status(500).json({ error: 'Failed to list DAOs' });
  }
});

// GET /api/admin/daos/:daoId/detail - Get detailed DAO info
router.get('/daos/:daoId/detail', requireSuperAdmin, async (req, res) => {
  try {
    const { daoId } = req.params;

    const dao = await db.select({ id: daos.id, name: daos.name, description: daos.description, status: daos.status,
      plan: daos.plan, createdAt: daos.createdAt, updatedAt: daos.updatedAt, founderId: daos.founderId,
      deletedAt: daos.deleted_at }).from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Get member count
    const memberCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(daoMemberships)
      .where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.status, 'approved'), eq(daoMemberships.isBanned, false)));

    // Get vaults info
    const vaultsInfo = await db
      .select({
        count: sql<number>`count(*)`,
        totalBalance: sql<number>`COALESCE(SUM(CAST(${vaults.balance} AS NUMERIC)), 0)`,
      })
      .from(vaults)
      .where(eq(vaults.daoId, daoId));

    // Get active proposals count
    const proposalsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(proposals)
      .where(and(
        eq(proposals.daoId, daoId),
        eq(proposals.status, 'active')
      ));

    // Get recent members
    const recentMembers = await db
      .select({
        userId: daoMemberships.userId,
        role: daoMemberships.role,
        joinedAt: daoMemberships.joinedAt,
      })
      .from(daoMemberships)
      .where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.status, 'approved'), eq(daoMemberships.isBanned, false)))
      .orderBy(desc(daoMemberships.joinedAt), desc(daoMemberships.id))
      .limit(10);

    const response = {
      dao: dao[0],
      stats: {
        members: memberCount[0].count,
        vaults: vaultsInfo[0].count,
        totalTreasuryBalance: vaultsInfo[0].totalBalance,
        activeProposals: proposalsCount[0].count,
      },
      recentMembers,
    };
    await auditDaoAccess(req, 'ADMIN_DAO_DETAILS_ACCESSED', daoId);
    res.json(response);
  } catch (error) {
    logger.error('Error fetching DAO detail:', error);
    res.status(500).json({ error: 'Failed to fetch DAO detail' });
  }
});

// Update DAO settings
router.put('/daos/:daoId', requireSuperAdmin, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { plan, status, description } = req.body;
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });
    if (plan !== undefined && (typeof plan !== 'string' || !validPlans.includes(plan as typeof validPlans[number]))) {
      return res.status(400).json({ error: 'Invalid DAO plan' });
    }
    if (status !== undefined && (typeof status !== 'string' || !validStatuses.includes(status as typeof validStatuses[number]))) {
      return res.status(400).json({ error: 'Invalid DAO status' });
    }
    if (description !== undefined && (typeof description !== 'string' || description.length > 5000)) {
      return res.status(400).json({ error: 'Invalid DAO description' });
    }

    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }
    const updates: Partial<typeof daos.$inferInsert> = { updatedAt: new Date() };
    if (plan !== undefined) updates.plan = plan;
    if (status !== undefined) updates.status = status;
    if (description !== undefined) updates.description = description;
    if (Object.keys(updates).length === 1) return res.status(400).json({ error: 'At least one DAO setting is required' });

    await db
      .update(daos)
      .set(updates)
      .where(eq(daos.id, daoId));

    await auditDaoMutation(req, AuditEventType.DAO_UPDATED, daoId, { daoName: dao[0].name, updates });

    logger.info('DAO updated', { daoId, plan, status, adminId });

    res.json({
      success: true,
      message: 'DAO updated successfully',
      dao: { id: daoId, ...updates }
    });
  } catch (error) {
    logger.error('Error updating DAO:', error);
    res.status(500).json({ error: 'Failed to update DAO' });
  }
});

// POST /api/admin/daos/:daoId/suspend - Suspend a DAO
router.post('/daos/:daoId/suspend', requireSuperAdmin, async (req, res) => {
  try {
    const { daoId } = req.params;
    const reason = parseReason(req.body?.reason);
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });
    if (!reason) return res.status(400).json({ error: 'A suspension reason is required' });

    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }
    if (dao[0].status !== 'active') return res.status(409).json({ error: 'Only active DAOs can be suspended' });

    await db
      .update(daos)
      .set({
        status: 'suspended',
        updatedAt: new Date(),
      })
      .where(eq(daos.id, daoId));

    await auditDaoMutation(req, 'DAO_SUSPENDED', daoId, { daoName: dao[0].name, reason });

    logger.warn('DAO suspended', { daoId, name: dao[0].name, reason, adminId });

    res.json({
      success: true,
      message: 'DAO suspended successfully',
    });
  } catch (error) {
    logger.error('Error suspending DAO:', error);
    res.status(500).json({ error: 'Failed to suspend DAO' });
  }
});

// POST /api/admin/daos/:daoId/restore - Restore suspended DAO
router.post('/daos/:daoId/restore', requireSuperAdmin, async (req, res) => {
  try {
    const { daoId } = req.params;
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });

    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }
    if (dao[0].status !== 'suspended') return res.status(409).json({ error: 'Only suspended DAOs can be restored' });

    await db
      .update(daos)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(daos.id, daoId));

    await auditDaoMutation(req, 'DAO_RESTORED', daoId, { daoName: dao[0].name });

    logger.info('DAO restored', { daoId, name: dao[0].name, adminId });

    res.json({
      success: true,
      message: 'DAO restored successfully',
    });
  } catch (error) {
    logger.error('Error restoring DAO:', error);
    res.status(500).json({ error: 'Failed to restore DAO' });
  }
});

// DELETE /api/admin/daos/:daoId - Delete DAO
router.delete('/daos/:daoId', requireSuperAdmin, async (req, res) => {
  try {
    const { daoId } = req.params;
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });
    const reason = parseReason(req.body?.reason, 'Admin deletion');
    if (!reason) return res.status(400).json({ error: 'Deletion reason must be a non-empty string of 1000 characters or fewer' });

    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Use soft delete with recovery window
    await softDeleteService.softDeleteDAO({
      targetId: daoId,
      targetType: 'dao',
      deletedBy: adminId,
      reason,
    });

    await auditDaoMutation(req, AuditEventType.DAO_DELETED, daoId, {
      deletionReason: reason,
      recoveryWindowDays: 30,
      daoName: dao[0].name,
    });

    logger.warn('DAO soft-deleted', { 
      daoId, 
      name: dao[0].name, 
      adminId,
      recoveryDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    res.json({
      success: true,
      message: 'DAO deleted successfully (recoverable within 30 days)',
      recoveryDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  } catch (error) {
    logger.error('Error deleting DAO:', error);
    res.status(500).json({ error: 'Failed to delete DAO' });
  }
});

// GET /api/admin/daos/stats - DAO statistics
router.get('/stats', requireSuperAdmin, async (req, res) => {
  try {
    const [
      totalDaos,
      activeDaos,
      suspendedDaos,
      totalMembers,
      totalVaults,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(daos).where(isNull(daos.deleted_at)),
      db.select({ count: sql<number>`count(*)` }).from(daos).where(and(eq(daos.status, 'active'), isNull(daos.deleted_at))),
      db.select({ count: sql<number>`count(*)` }).from(daos).where(and(eq(daos.status, 'suspended'), isNull(daos.deleted_at))),
      db.select({ count: sql<number>`count(DISTINCT ${daoMemberships.userId})` }).from(daoMemberships)
        .innerJoin(daos, eq(daoMemberships.daoId, daos.id))
        .where(and(isNull(daos.deleted_at), eq(daoMemberships.status, 'approved'), eq(daoMemberships.isBanned, false))),
      db.select({ count: sql<number>`count(*)` }).from(vaults)
        .innerJoin(daos, eq(vaults.daoId, daos.id))
        .where(isNull(daos.deleted_at)),
    ]);

    const totalTreasuryBalance = await db
      .select({ total: sql<number>`COALESCE(SUM(CAST(${vaults.balance} AS NUMERIC)), 0)` })
      .from(vaults)
      .innerJoin(daos, eq(vaults.daoId, daos.id))
      .where(isNull(daos.deleted_at));

    const response = {
      stats: {
        totalDaos: totalDaos[0].count,
        activeDaos: activeDaos[0].count,
        suspendedDaos: suspendedDaos[0].count,
        totalMembers: totalMembers[0].count,
        totalVaults: totalVaults[0].count,
        totalTreasuryBalance: totalTreasuryBalance[0].total,
      }
    };
    await auditDaoAccess(req, 'ADMIN_DAO_STATS_ACCESSED', 'all');
    res.json(response);
  } catch (error) {
    logger.error('Error fetching DAO stats:', error);
    res.status(500).json({ error: 'Failed to fetch DAO stats' });
  }
});

export default router;
