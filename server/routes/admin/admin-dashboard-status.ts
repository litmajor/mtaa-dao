/**
 * Admin Dashboard Status Route
 * Day 3 - System Status and Recovery Overview
 * 
 * Single endpoint for dashboard overview information
 * Power Checklist: #4 Authority Transparency, #8 Post-Action Narrative
 */

import { Router, Request, Response } from 'express';
import softDeleteService from '../../services/softDeleteService';
import auditLoggingService from '../../services/auditLoggingService';

const router = Router();

/**
 * GET /api/admin/dashboard/status
 * Get comprehensive dashboard status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).adminId;
    if (!adminId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const now = new Date();

    // Get soft-deleted items pending recovery
    const [
      deletedUsers,
      deletedDAOs,
      deletedAdmins,
    ] = await Promise.all([
      softDeleteService.listSoftDeleted('user', 100, 0),
      softDeleteService.listSoftDeleted('dao', 100, 0),
      softDeleteService.listSoftDeleted('admin_user', 100, 0),
    ]);

    // Filter for items still in recovery window (not expired)
    const recoveryItems = {
      users: deletedUsers.filter(u => u.daysRemaining > 0),
      daos: deletedDAOs.filter(d => d.daysRemaining > 0),
      admins: deletedAdmins.filter(a => a.daysRemaining > 0),
    };

    // Count items expiring soon (< 3 days)
    const expiringItems = {
      users: deletedUsers.filter(u => u.daysRemaining > 0 && u.daysRemaining <= 3).length,
      daos: deletedDAOs.filter(d => d.daysRemaining > 0 && d.daysRemaining <= 3).length,
      admins: deletedAdmins.filter(a => a.daysRemaining > 0 && a.daysRemaining <= 3).length,
    };

    // Get recent audit activity (last 24 hours)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const { logs: recentLogs, total: recentTotal } = await auditLoggingService.queryAuditLogs({
      sinceDate: oneDayAgo,
      limit: 10,
      offset: 0,
    });

    // Get audit statistics (last 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const auditStats = await auditLoggingService.getAuditStats({
      since: sevenDaysAgo,
      until: now,
    });

    // Count critical actions (deletions, permission changes)
    const criticalActions = recentLogs.filter(log =>
      ['user_deleted', 'dao_deleted', 'admin_deleted', 'permission_changed', 'audit_override'].includes(
        log.action_type
      )
    ).length;

    // System health indicators
    const systemStatus = {
      timestamp: now,
      status: 'operational' as const,
      health: {
        softDeleteRecoverySystem: {
          status: 'operational' as const,
          pendingRecoveryItems: {
            users: recoveryItems.users.length,
            daos: recoveryItems.daos.length,
            admins: recoveryItems.admins.length,
            total: recoveryItems.users.length + recoveryItems.daos.length + recoveryItems.admins.length,
          },
          expiringWithin3Days: {
            users: expiringItems.users,
            daos: expiringItems.daos,
            admins: expiringItems.admins,
            total: expiringItems.users + expiringItems.daos + expiringItems.admins,
          },
        },
        auditLoggingSystem: {
          status: 'operational' as const,
          last24Hours: {
            total: recentTotal,
            criticalActions: criticalActions,
          },
          last7Days: {
            totalActions: auditStats.totalActions || 0,
            byResult: auditStats.byResult || {},
            successRate: auditStats.successRate || 0,
          },
        },
      },
      recentActivity: {
        logs: recentLogs.slice(0, 10),
        total: recentTotal,
      },
    };

    res.json(systemStatus);
  } catch (error) {
    console.error('Error getting dashboard status:', error);
    res.status(500).json({
      error: 'Internal server error',
      timestamp: new Date(),
    });
  }
});

/**
 * GET /api/admin/dashboard/recovery-items
 * Get detailed recovery items list with filtering
 */
router.get('/recovery-items', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).adminId;
    if (!adminId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { type = 'all', limit = '50', offset = '0' } = req.query;

    const items: any = {
      total: 0,
      items: [],
    };

    const pageLimit = Math.min(parseInt(limit as string), 100);
    const pageOffset = parseInt(offset as string);

    if (type === 'all' || type === 'user') {
      const users = await softDeleteService.listSoftDeleted('user', pageLimit, pageOffset);
      items.items.push(
        ...users
          .filter(u => u.daysRemaining > 0)
          .map(u => ({
            id: u.id,
            type: 'user',
            name: u.name,
            deletedAt: u.deletedAt,
            deletedBy: u.deletedBy,
            reason: u.reason,
            recoveryDeadline: u.recoveryDeadline,
            daysRemaining: u.daysRemaining,
          }))
      );
    }

    if (type === 'all' || type === 'dao') {
      const daos = await softDeleteService.listSoftDeleted('dao', pageLimit, pageOffset);
      items.items.push(
        ...daos
          .filter(d => d.daysRemaining > 0)
          .map(d => ({
            id: d.id,
            type: 'dao',
            name: d.name,
            deletedAt: d.deletedAt,
            deletedBy: d.deletedBy,
            reason: d.reason,
            recoveryDeadline: d.recoveryDeadline,
            daysRemaining: d.daysRemaining,
          }))
      );
    }

    if (type === 'all' || type === 'admin') {
      const admins = await softDeleteService.listSoftDeleted('admin_user', pageLimit, pageOffset);
      items.items.push(
        ...admins
          .filter(a => a.daysRemaining > 0)
          .map(a => ({
            id: a.id,
            type: 'admin',
            name: a.name,
            deletedAt: a.deletedAt,
            deletedBy: a.deletedBy,
            reason: a.reason,
            recoveryDeadline: a.recoveryDeadline,
            daysRemaining: a.daysRemaining,
          }))
      );
    }

    items.total = items.items.length;

    res.json(items);
  } catch (error) {
    console.error('Error getting recovery items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/dashboard/audit-summary
 * Get audit activity summary with trends
 */
router.get('/audit-summary', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).adminId;
    if (!adminId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get stats for different periods
    const [stats7Day, stats30Day] = await Promise.all([
      auditLoggingService.getAuditStats({
        since: sevenDaysAgo,
        until: now,
      }),
      auditLoggingService.getAuditStats({
        since: thirtyDaysAgo,
        until: now,
      }),
    ]);

    res.json({
      periods: {
        last7Days: {
          stats: stats7Day,
        },
        last30Days: {
          stats: stats30Day,
        },
      },
    });
  } catch (error) {
    console.error('Error getting audit summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
