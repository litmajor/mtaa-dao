import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { daos, daoMemberships, vaults, vaultTransactions } from '../../../shared/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { requireRole } from '../../middleware/rbac';
import { logAuditEvent, AuditEventType } from '../../services/auditLogging';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');

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
router.get('/daos/:daoId/treasury', async (req: Request, res: Response) => {
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

    // Get vault info
    const vaultList = await db
      .select({
        id: vaults.id,
        tokenAddress: vaults.tokenAddress,
        balance: vaults.balance,
        isActive: vaults.isActive,
      })
      .from(vaults)
      .where(eq(vaults.daoId, daoId));

    // Calculate total value (simplified - would need oracle for real prices)
    const totalBalance = vaultList.reduce((sum, v) => sum + parseFloat(v.balance.toString()), 0);

    // Get recent transactions
    const recentTransactions = await db
      .select({
        id: vaultTransactions.id,
        type: vaultTransactions.type,
        amount: vaultTransactions.amount,
        createdAt: vaultTransactions.createdAt,
        status: vaultTransactions.status,
      })
      .from(vaultTransactions)
      .where(eq(vaultTransactions.vaultId, vaultList[0]?.id || ''))
      .orderBy(desc(vaultTransactions.createdAt))
      .limit(10);

    res.json({
      dao: {
        id: dao[0].id,
        name: dao[0].name,
        treasuryHealth: dao[0].treasuryHealth || 'healthy',
        isFrozen: dao[0].treasuryFrozen || false,
      },
      vaults: vaultList,
      summary: {
        totalBalance,
        vaultCount: vaultList.length,
        activeVaults: vaultList.filter(v => v.isActive).length,
      },
      recentTransactions: recentTransactions.slice(0, 5),
      userRole,
      isSuperAdmin: userRole === 'super_admin',
    });
  } catch (error) {
    logger.error('Error fetching treasury overview:', error);
    res.status(500).json({ error: 'Failed to fetch treasury overview' });
  }
});

// GET /api/admin/daos/:daoId/treasury/transactions - Get treasury transactions
router.get('/daos/:daoId/treasury/transactions', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { page = '1', limit = '20', type = '', status = '' } = req.query;
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

    // Get vaults for this DAO
    const daoVaults = await db
      .select({ id: vaults.id })
      .from(vaults)
      .where(eq(vaults.daoId, daoId));

    const vaultIds = daoVaults.map(v => v.id);
    if (vaultIds.length === 0) {
      return res.json({
        transactions: [],
        pagination: { page: 1, limit: parseInt(limit as string), total: 0, pages: 0 },
      });
    }

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const conditions: any[] = [];

    // Filter by type if provided
    if (type && typeof type === 'string' && type !== 'all') {
      conditions.push(eq(vaultTransactions.type, type));
    }

    // Filter by status if provided
    if (status && typeof status === 'string' && status !== 'all') {
      conditions.push(eq(vaultTransactions.status, status));
    }

    const transactionsList = await db
      .select({
        id: vaultTransactions.id,
        vaultId: vaultTransactions.vaultId,
        type: vaultTransactions.type,
        amount: vaultTransactions.amount,
        description: vaultTransactions.description,
        createdAt: vaultTransactions.createdAt,
        status: vaultTransactions.status,
      })
      .from(vaultTransactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(vaultTransactions.createdAt))
      .limit(parseInt(limit as string))
      .offset(offset);

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
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / parseInt(limit as string)),
      },
      userRole,
    });
  } catch (error) {
    logger.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// POST /api/admin/daos/:daoId/treasury/freeze - Freeze treasury (Super Admin Emergency)
router.post('/daos/:daoId/treasury/freeze', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { reason } = req.body;
    const adminId = (req.user as any).id;

    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Freeze the treasury
    await db
      .update(daos)
      .set({
        treasuryFrozen: true,
        updatedAt: new Date(),
      })
      .where(eq(daos.id, daoId));

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
    }).catch(err => console.error('Audit log failed:', err));

    logger.warn('Treasury frozen by super admin', { daoId, adminId, reason });

    res.json({
      success: true,
      message: 'Treasury frozen successfully',
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
router.post('/daos/:daoId/treasury/unfreeze', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { reason } = req.body;
    const adminId = (req.user as any).id;

    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Unfreeze the treasury
    await db
      .update(daos)
      .set({
        treasuryFrozen: false,
        updatedAt: new Date(),
      })
      .where(eq(daos.id, daoId));

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
    }).catch(err => console.error('Audit log failed:', err));

    logger.info('Treasury unfrozen by super admin', { daoId, adminId, reason });

    res.json({
      success: true,
      message: 'Treasury unfrozen successfully',
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
router.get('/daos/:daoId/treasury/health', async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const adminId = (req.user as any)?.id;
    const userRole = (req.user as any)?.roles;

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

    // Get treasury metrics
    const vaultList = await db
      .select({
        id: vaults.id,
        balance: vaults.balance,
      })
      .from(vaults)
      .where(eq(vaults.daoId, daoId));

    const totalBalance = vaultList.reduce((sum, v) => sum + parseFloat(v.balance.toString()), 0);

    // Get transaction volume (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentTransactions = await db
      .select({
        count: sql<number>`count(*)`,
        totalAmount: sql<number>`COALESCE(SUM(CAST(amount AS numeric)), 0)`,
      })
      .from(vaultTransactions)
      .where(and(
        eq(vaultTransactions.vaultId, vaultList[0]?.id || ''),
        // @ts-ignore
        sql`createdAt >= ${thirtyDaysAgo}`
      ));

    const health = {
      status: dao[0].treasuryHealth || 'healthy',
      isFrozen: dao[0].treasuryFrozen || false,
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
router.get('/treasury/status', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const daoTreasuryStatus = await db
      .select({
        id: daos.id,
        name: daos.name,
        treasuryHealth: daos.treasuryHealth,
        treasuryFrozen: daos.treasuryFrozen,
        updatedAt: daos.updatedAt,
      })
      .from(daos)
      .orderBy(desc(daos.updatedAt))
      .limit(parseInt(limit as string))
      .offset(offset);

    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(daos);

    res.json({
      daos: daoTreasuryStatus,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / parseInt(limit as string)),
      }
    });
  } catch (error) {
    logger.error('Error fetching treasury status:', error);
    res.status(500).json({ error: 'Failed to fetch treasury status' });
  }
});

export default router;
