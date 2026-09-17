import { DaoStorage } from '../../storage/storage-dao';
import { Router } from 'express';
import { type Request, type Response } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { daos, daoMemberships, daoSettings, vaults, vaultTransactions } from '../../../shared/schema';
import { eq, desc, sql, and, inArray, gte } from 'drizzle-orm';
import { requireRole } from '../../middleware/rbac';
import featureGate from '../../middleware/featureGate';
import { logAuditEvent, AuditEventType } from '../../services/auditLogging';
import { TreasuryService } from '../../services/treasuryService';

const router = Router();
const daoStorage = new DaoStorage();
const requireSuperAdmin = requireRole('super_admin');

function parsePagination(query: Request['query']): { page: number; limit: number; offset: number } | null {
  const pageValue = String(query.page ?? '1');
  const limitValue = String(query.limit ?? '20');
  if (!/^\d+$/.test(pageValue) || !/^\d+$/.test(limitValue)) return null;

  const page = Number(pageValue);
  const limit = Number(limitValue);
  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset)) {
    return null;
  }

  return { page, limit, offset };
}

function getUserRoles(req: Request): string[] {
  const user = req.user as { role?: string; roles?: string[] } | undefined;
  return Array.from(new Set([...(user?.roles || []), ...(user?.role ? [user.role] : [])]));
}

function hasSuperAdminRole(req: Request): boolean {
  return getUserRoles(req).includes('super_admin');
}

function getAuthenticatedUserId(req: Request): string | null {
  const userId = (req.user as { id?: unknown } | undefined)?.id;
  return typeof userId === 'string' && userId.trim() ? userId.trim() : null;
}

async function canAccessDao(daoId: string, userId: string, req: Request): Promise<boolean> {
  if (hasSuperAdminRole(req)) return true;

  const membership = await db
    .select({ id: daoMemberships.id })
    .from(daoMemberships)
    .where(and(
      eq(daoMemberships.daoId, daoId),
      eq(daoMemberships.userId, userId),
      inArray(daoMemberships.role, ['admin', 'owner', 'elder']),
      eq(daoMemberships.status, 'approved'),
      eq(daoMemberships.isBanned, false)
    ));

  return membership.length > 0;
}

async function getTreasuryFrozen(daoId: string): Promise<boolean> {
  return TreasuryService.isFrozen(daoId);
}

function validateReason(reason: unknown): string | null {
  if (typeof reason !== 'string') return null;
  const trimmed = reason.trim();
  return trimmed.length >= 10 && trimmed.length <= 1000 ? trimmed : null;
}

function getBalanceHealth(balance: unknown): 'at_risk' | 'stable' | 'healthy' | 'unknown' {
  const parsed = Number.parseFloat(String(balance ?? ''));
  if (!Number.isFinite(parsed)) return 'unknown';
  if (parsed <= 1000) return 'at_risk';
  if (parsed > 100000) return 'healthy';
  return 'stable';
}

function parseBalance(balance: unknown): number {
  const parsed = Number.parseFloat(String(balance ?? '0'));
  if (!Number.isFinite(parsed)) throw new Error('Invalid treasury balance');
  return parsed;
}

/**
 * Treasury Management Routes with Role-Based Access Control
 * 
 * SUPER ADMIN (Platform Admin):
 * - Can VIEW all treasury data
 * - Can MONITOR treasury health
 * - Can FREEZE treasuries in emergency
 * - Can INVESTIGATE transactions
 * - CANNOT make transfers or distributions (DAO admin only)
 * 
 * DAO ADMIN (DAO Creator/Elder):
 * - Can manage their own DAO's treasury
 * - Can make transfers and distributions
 * - Can set spending limits
 * - Limited to their own DAO
 */

// GET /api/admin/daos/:daoId/treasury - Get treasury overview for a DAO
router.get('/daos/:daoId/treasury', featureGate('treasury.view'), async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const adminId = getAuthenticatedUserId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });
    const userRole = getUserRoles(req);

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions
    if (!(await canAccessDao(daoId, adminId, req))) {
      return res.status(403).json({ error: 'Access denied to this DAO' });
    }

    // Get vault info
    const vaultList = await db
      .select({
        id: vaults.id,
        address: vaults.address,
        balance: vaults.balance,
        isActive: vaults.isActive,
      })
      .from(vaults)
      .where(eq(vaults.daoId, daoId));

    // Calculate total value (simplified - would need oracle for real prices)
    const totalBalance = vaultList.reduce((sum: number, v: any) => sum + parseBalance(v.balance), 0);

    // Get recent transactions
    const recentTransactions = vaultList.length === 0 ? [] : await db
      .select({
        id: vaultTransactions.id,
        transactionType: vaultTransactions.transactionType,
        tokenSymbol: vaultTransactions.tokenSymbol,
        amount: vaultTransactions.amount,
        createdAt: vaultTransactions.createdAt,
        status: vaultTransactions.status,
      })
      .from(vaultTransactions)
      .where(inArray(vaultTransactions.vaultId, vaultList.map(vault => vault.id)))
      .orderBy(desc(vaultTransactions.createdAt))
      .limit(10);

    res.json({
      dao: {
        id: dao[0].id,
        name: dao[0].name,
        treasuryHealth: getBalanceHealth(dao[0].treasuryBalance),
        isFrozen: await getTreasuryFrozen(daoId),
      },
      vaults: vaultList,
      summary: {
        totalBalance,
        vaultCount: vaultList.length,
        activeVaults: vaultList.filter(v => v.isActive).length,
      },
      recentTransactions: recentTransactions.slice(0, 5),
      userRole,
      isSuperAdmin: hasSuperAdminRole(req),
    });
  } catch (error) {
    logger.error('Error fetching treasury overview:', error);
    res.status(500).json({ error: 'Failed to fetch treasury overview' });
  }
});

// GET /api/admin/daos/:daoId/treasury/transactions - Get treasury transactions
router.get('/daos/:daoId/treasury/transactions', featureGate('treasury.view'), async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { type = '', status = '' } = req.query;
    const adminId = getAuthenticatedUserId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });
    const userRole = getUserRoles(req);

    const pagination = parsePagination(req.query);
    if (!pagination) {
      return res.status(400).json({ error: 'page must be >= 1 and limit must be between 1 and 100' });
    }

    // Verify DAO exists
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions
    if (!(await canAccessDao(daoId, adminId, req))) {
      return res.status(403).json({ error: 'Access denied to this DAO' });
    }

    // Get vaults for this DAO
    const daoVaults = await db
      .select({ id: vaults.id })
      .from(vaults)
      .where(eq(vaults.daoId, daoId));

    const vaultIds = daoVaults.map(v => v.id);
    if (vaultIds.length === 0) {
      return res.json({
        transactions: [],
        pagination: { page: pagination.page, limit: pagination.limit, total: 0, pages: 0 },
      });
    }

    const conditions: any[] = [inArray(vaultTransactions.vaultId, vaultIds)];

    // Filter by type if provided
    if (type && typeof type === 'string' && type !== 'all') {
      conditions.push(eq(vaultTransactions.transactionType, type));
    }

    // Filter by status if provided
    if (status && typeof status === 'string' && status !== 'all') {
      conditions.push(eq(vaultTransactions.status, status));
    }

    const transactionsList = await db
      .select({
        id: vaultTransactions.id,
        vaultId: vaultTransactions.vaultId,
        transactionType: vaultTransactions.transactionType,
        amount: vaultTransactions.amount,
        createdAt: vaultTransactions.createdAt,
        status: vaultTransactions.status,
      })
      .from(vaultTransactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(vaultTransactions.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(vaultTransactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({
      transactions: transactionsList,
      dao: {
        id: daoId,
        name: dao[0].name,
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / pagination.limit),
      },
      userRole,
    });
  } catch (error) {
    logger.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// POST /api/admin/daos/:daoId/treasury/freeze - Freeze treasury (Super Admin Emergency)
router.post('/daos/:daoId/treasury/freeze', requireSuperAdmin, featureGate('treasury.view'), async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const reason = validateReason(req.body?.reason);
    if (!reason) return res.status(400).json({ error: 'reason must be between 10 and 1000 characters' });
    const adminId = getAuthenticatedUserId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });

    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Freeze the treasury
    await daoStorage.upsertDaoSetting(daoId, 'treasury_frozen', true, { description: reason });

    // Log audit event
    await logAuditEvent({
      eventType: AuditEventType.TREASURY_FROZEN,
      userId: adminId,
      action: `Treasury frozen for DAO: ${dao[0].name}`,
      severity: 'critical',
      endpoint: `/api/admin/daos/:daoId/treasury/freeze`,
      method: 'POST',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: 200,
      metadata: {
        daoId,
        reason,
      }
    });

    logger.warn('Treasury frozen by super admin', { daoId, adminId, reason });

    res.json({
      success: true,
      message: 'Backend treasury withdrawal proposals are now blocked',
      scope: 'backend_proposals_only',
      dao: {
        id: daoId,
        treasuryFrozen: true,
      }
    });
  } catch (error) {
    logger.error('Error freezing treasury:', error);
    res.status(500).json({ error: 'Failed to freeze treasury' });
  }
});

// POST /api/admin/daos/:daoId/treasury/unfreeze - Unfreeze treasury (Super Admin Emergency)
router.post('/daos/:daoId/treasury/unfreeze', requireSuperAdmin, featureGate('treasury.view'), async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const reason = validateReason(req.body?.reason);
    if (!reason) return res.status(400).json({ error: 'reason must be between 10 and 1000 characters' });
    const adminId = getAuthenticatedUserId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });

    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Unfreeze the treasury
    await daoStorage.upsertDaoSetting(daoId, 'treasury_frozen', false, { description: reason });

    // Log audit event
    await logAuditEvent({
      eventType: AuditEventType.TREASURY_UNFROZEN,
      userId: adminId,
      action: `Treasury unfrozen for DAO: ${dao[0].name}`,
      severity: 'high',
      endpoint: `/api/admin/daos/:daoId/treasury/unfreeze`,
      method: 'POST',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: 200,
      metadata: {
        daoId,
        reason,
      }
    });

    logger.info('Treasury unfrozen by super admin', { daoId, adminId, reason });

    res.json({
      success: true,
      message: 'Backend treasury withdrawal proposals are now allowed',
      scope: 'backend_proposals_only',
      dao: {
        id: daoId,
        treasuryFrozen: false,
      }
    });
  } catch (error) {
    logger.error('Error unfreezing treasury:', error);
    res.status(500).json({ error: 'Failed to unfreeze treasury' });
  }
});

// GET /api/admin/daos/:daoId/treasury/health - Get treasury health status
router.get('/daos/:daoId/treasury/health', featureGate('treasury.view'), async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const adminId = getAuthenticatedUserId(req);
    if (!adminId) return res.status(401).json({ error: 'Authentication required' });
    const userRole = getUserRoles(req);

    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Check permissions
    if (!(await canAccessDao(daoId, adminId, req))) {
      return res.status(403).json({ error: 'Access denied to this DAO' });
    }

    // Get treasury metrics
    const vaultList = await db
      .select({
        id: vaults.id,
        balance: vaults.balance,
      })
      .from(vaults)
      .where(eq(vaults.daoId, daoId));

    const totalBalance = vaultList.reduce((sum: number, v: any) => sum + parseBalance(v.balance), 0);

    // Get transaction volume (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentTransactions = vaultList.length === 0 ? [] : await db
      .select({
        count: sql<number>`count(*)`,
        totalAmount: sql<number>`COALESCE(SUM(CAST(amount AS numeric)), 0)`,
      })
      .from(vaultTransactions)
      .where(and(
        inArray(vaultTransactions.vaultId, vaultList.map(vault => vault.id)),
        gte(vaultTransactions.createdAt, thirtyDaysAgo)
      ));

    const health = {
      status: dao[0].treasuryHealth || 'unknown',
      isFrozen: await getTreasuryFrozen(daoId),
      totalBalance,
      vaultCount: vaultList.length,
      recentActivity: {
        transactionCount: recentTransactions[0]?.count || 0,
        volumeInPeriod: parseFloat(recentTransactions[0]?.totalAmount?.toString() || '0'),
      },
      riskLevel: totalBalance > 1000000 ? 'high' : totalBalance > 100000 ? 'medium' : 'low',
    };

    res.json({ health });
  } catch (error) {
    logger.error('Error fetching treasury health:', error);
    res.status(500).json({ error: 'Failed to fetch treasury health' });
  }
});

// GET /api/admin/treasury/status - Get all DAOs treasury status (Super Admin only)
router.get('/treasury/status', requireSuperAdmin, featureGate('treasury.view'), async (req: Request, res: Response) => {
  try {
    const pagination = parsePagination(req.query);
    if (!pagination) {
      return res.status(400).json({ error: 'page must be >= 1 and limit must be between 1 and 100' });
    }

    const daoTreasuryStatus = await db
      .select({
        id: daos.id,
        name: daos.name,
        treasuryBalance: daos.treasuryBalance,
        updatedAt: daos.updatedAt,
      })
      .from(daos)
      .orderBy(desc(daos.updatedAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(daos);

    const daoIds = daoTreasuryStatus.map((dao: any) => dao.id);
    const frozenSettings = daoIds.length === 0 ? [] : await db
      .select({ daoId: daoSettings.daoId, settingValue: daoSettings.settingValue })
      .from(daoSettings)
      .where(and(
        inArray(daoSettings.daoId, daoIds),
        eq(daoSettings.settingKey, 'treasury_frozen')
      ));
    const frozenByDaoId = new Map(frozenSettings.map(setting => [
      setting.daoId,
      setting.settingValue === true || setting.settingValue === 'true'
    ]));

    const daosWithFlags = daoTreasuryStatus.map((d: any) => {
      const frozen = frozenByDaoId.get(d.id) || false;
      const health = getBalanceHealth(d.treasuryBalance);
      return { id: d.id, name: d.name, treasuryBalance: d.treasuryBalance, treasuryHealth: health, isFrozen: frozen, updatedAt: d.updatedAt };
    });

    res.json({
      daos: daosWithFlags,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / pagination.limit),
      }
    });
  } catch (error) {
    logger.error('Error fetching treasury status:', error);
    res.status(500).json({ error: 'Failed to fetch treasury status' });
  }
});

export default router;
