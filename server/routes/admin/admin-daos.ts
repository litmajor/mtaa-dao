import { Router } from 'express';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { daos, daoMemberships, vaults, proposals, users } from '../../../shared/schema';
import { eq, desc, sql, and, or, like, count, gte, lte } from 'drizzle-orm';
import { requireRole } from '../../middleware/rbac';
import { logAuditEvent, AuditEventType } from '../../services/auditLogging';
import auditLoggingService from '../../services/auditLoggingService';
import softDeleteService from '../../services/softDeleteService';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');

// DAO management endpoints
router.get('/daos/list', requireSuperAdmin, async (req, res) => {
  try {
    const { page = '1', limit = '20', search = '', status = '' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const conditions: any[] = [];

    if (search && typeof search === 'string') {
      conditions.push(
        or(
          like(daos.name, `%${search}%`),
          like(daos.description, `%${search}%`),
          like(daos.id, `%${search}%`)
        )
      );
    }

    if (status && typeof status === 'string' && status !== 'all') {
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
      .orderBy(desc(daos.createdAt))
      .limit(parseInt(limit as string))
      .offset(offset);

    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(daos)
      .where(whereClause);

    res.json({
      daos: daosList,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / parseInt(limit as string)),
      },
    });
  } catch (error) {
    logger.error('Error listing DAOs:', error);
    res.status(500).json({ error: 'Failed to list DAOs' });
  }
});

// GET /api/admin/daos/:daoId/detail - Get detailed DAO info
router.get('/daos/:daoId/detail', requireSuperAdmin, async (req, res) => {
  try {
    const { daoId } = req.params;

    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Get member count
    const memberCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(daoMemberships)
      .where(eq(daoMemberships.daoId, daoId));

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
      .where(eq(daoMemberships.daoId, daoId))
      .orderBy(desc(daoMemberships.joinedAt))
      .limit(10);

    res.json({
      dao: dao[0],
      stats: {
        members: memberCount[0].count,
        vaults: vaultsInfo[0].count,
        totalTreasuryBalance: vaultsInfo[0].totalBalance,
        activeProposals: proposalsCount[0].count,
      },
      recentMembers,
    });
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
    const adminId = (req.user as any).id;

    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    const updates: any = { updatedAt: new Date() };
    if (plan) updates.plan = plan;
    if (status) updates.status = status;
    if (description) updates.description = description;

    await db
      .update(daos)
      .set(updates)
      .where(eq(daos.id, daoId));

    // Log audit event
    await logAuditEvent({
      eventType: AuditEventType.DAO_SETTINGS_CHANGED,
      userId: adminId,
      action: `DAO settings updated: ${dao[0].name}`,
      severity: 'medium',
      endpoint: '/api/admin/daos/:daoId',
      method: 'PUT',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: 200,
      metadata: {
        daoId,
        daoName: dao[0].name,
        updates,
      }
    }).catch(err => console.error('Audit log failed:', err));

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
    const { reason } = req.body;
    const adminId = (req.user as any).id;

    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    await db
      .update(daos)
      .set({
        status: 'suspended',
        updatedAt: new Date(),
      })
      .where(eq(daos.id, daoId));

    // Log audit event
    await logAuditEvent({
      eventType: AuditEventType.DAO_SETTINGS_CHANGED,
      userId: adminId,
      action: `DAO suspended: ${dao[0].name}`,
      severity: 'high',
      endpoint: '/api/admin/daos/:daoId/suspend',
      method: 'POST',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: 200,
      metadata: {
        daoId,
        daoName: dao[0].name,
        reason,
      }
    }).catch(err => console.error('Audit log failed:', err));

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
    const adminId = (req.user as any).id;

    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    await db
      .update(daos)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(daos.id, daoId));

    // Log audit event
    await logAuditEvent({
      eventType: AuditEventType.DAO_SETTINGS_CHANGED,
      userId: adminId,
      action: `DAO restored: ${dao[0].name}`,
      severity: 'medium',
      endpoint: '/api/admin/daos/:daoId/restore',
      method: 'POST',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: 200,
      metadata: {
        daoId,
        daoName: dao[0].name,
      }
    }).catch(err => console.error('Audit log failed:', err));

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
    const adminId = (req.user as any).id;

    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao.length) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Use soft delete with recovery window
    await softDeleteService.softDeleteDAO({
      targetId: daoId,
      deletedBy: adminId,
      reason: req.body?.reason || 'Admin deletion',
    });

    // Log audit event using new service
    await auditLoggingService.logAction({
      actorId: adminId,
      actorType: 'admin_user',
      actorRole: 'admin',
      actionType: 'dao_deleted',
      actionCategory: 'dao_management',
      targetType: 'dao',
      targetId: daoId,
      targetName: dao[0].name,
      result: 'success',
      reversible: true,
      metadata: {
        deletionReason: req.body?.reason || 'Admin deletion',
        recoveryWindowDays: 30,
        daoName: dao[0].name,
      },
    }).catch(err => console.error('Audit log failed:', err));

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
      db.select({ count: sql<number>`count(*)` }).from(daos),
      db.select({ count: sql<number>`count(*)` }).from(daos).where(eq(daos.status, 'active')),
      db.select({ count: sql<number>`count(*)` }).from(daos).where(eq(daos.status, 'suspended')),
      db.select({ count: sql<number>`count(DISTINCT ${daoMemberships.userId})` }).from(daoMemberships),
      db.select({ count: sql<number>`count(*)` }).from(vaults),
    ]);

    const totalTreasuryBalance = await db
      .select({ total: sql<number>`COALESCE(SUM(CAST(${vaults.balance} AS NUMERIC)), 0)` })
      .from(vaults);

    res.json({
      stats: {
        totalDaos: totalDaos[0].count,
        activeDaos: activeDaos[0].count,
        suspendedDaos: suspendedDaos[0].count,
        totalMembers: totalMembers[0].count,
        totalVaults: totalVaults[0].count,
        totalTreasuryBalance: totalTreasuryBalance[0].total,
      }
    });
  } catch (error) {
    logger.error('Error fetching DAO stats:', error);
    res.status(500).json({ error: 'Failed to fetch DAO stats' });
  }
});

export default router;
