/**
 * Admin Dashboard Status Route
 * Day 3 - System Status and Recovery Overview
 * 
 * Single endpoint for dashboard overview information
 * Power Checklist: #4 Authority Transparency, #8 Post-Action Narrative
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import softDeleteService from '../../services/softDeleteService';
import auditLoggingService from '../../services/auditLoggingService';
import { logger as dashboardLogger } from '../../utils/logger';
import { requireRole } from '../../middleware/rbac';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');

function getAdminId(req: Request): string | null {
  return req.user?.userId || req.user?.claims?.sub || req.user?.id || null;
}

function getAdminRole(req: Request): string {
  if (req.userRole) return req.userRole;
  if (req.user?.role) return req.user.role;
  const roles = req.user?.roles;
  return Array.isArray(roles) ? roles[0] || 'super_admin' : roles || 'super_admin';
}

function parsePagination(query: Request['query']): { limit: number; offset: number } | null {
  const limitValue = String(query.limit ?? '50');
  const offsetValue = String(query.offset ?? '0');
  if (!/^\d+$/.test(limitValue) || !/^\d+$/.test(offsetValue)) return null;
  const limit = Number(limitValue);
  const offset = Number(offsetValue);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0) return null;
  return { limit, offset };
}

async function auditDashboardAccess(req: Request, actionType: string, targetId: string): Promise<void> {
  const actorId = getAdminId(req);
  if (!actorId) return;
  try {
    await auditLoggingService.logAction({
      actorId, actorType: 'super_admin', actorRole: getAdminRole(req), actionType,
      actionCategory: 'admin', targetType: 'admin_dashboard', targetId, targetName: targetId,
      result: 'success', reversible: false, endpoint: req.originalUrl,
    });
  } catch (error) {
    dashboardLogger.error('Dashboard access audit failed:', error);
  }
}

/**
 * GET /api/admin/dashboard/status
 * Get comprehensive dashboard status
 */
router.get('/status', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const adminId = getAdminId(req);
    if (!adminId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const now = new Date();
    const recoveryStats = await softDeleteService.getSoftDeletedStats();

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
      ['user_deleted', 'dao_deleted', 'admin_deleted', 'user_permanently_deleted', 'dao_permanently_deleted', 'admin_permanently_deleted', 'permission_changed', 'audit_override'].includes(
        log.actionType
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
            users: recoveryStats.user.recoverable,
            daos: recoveryStats.dao.recoverable,
            admins: recoveryStats.admin.recoverable,
            total: recoveryStats.user.recoverable + recoveryStats.dao.recoverable + recoveryStats.admin.recoverable,
          },
          expiringWithin3Days: {
            users: recoveryStats.user.expiringSoon,
            daos: recoveryStats.dao.expiringSoon,
            admins: recoveryStats.admin.expiringSoon,
            total: recoveryStats.user.expiringSoon + recoveryStats.dao.expiringSoon + recoveryStats.admin.expiringSoon,
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

    await auditDashboardAccess(req, 'ADMIN_DASHBOARD_STATUS_ACCESSED', 'status');
    res.json(systemStatus);
  } catch (error) {
    dashboardLogger.error('Error getting dashboard status:', error);
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
router.get('/recovery-items', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const adminId = getAdminId(req);
    if (!adminId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { type = 'all' } = req.query;
    const pagination = parsePagination(req.query);
    if (!pagination) return res.status(400).json({ error: 'limit must be between 1 and 100 and offset must be non-negative' });
    if (type !== 'all' && type !== 'user' && type !== 'dao' && type !== 'admin') {
      return res.status(400).json({ error: 'Invalid recovery item type' });
    }

    const items = { total: 0 as number, items: [] as Array<Record<string, unknown>> };
    const addItem = (item: Awaited<ReturnType<typeof softDeleteService.listSoftDeleted>>[number]) => items.items.push({
      id: item.id, type: item.type, name: item.name, deletedAt: item.deletedAt, deletedBy: item.deletedBy,
      reason: item.reason, recoveryDeadline: item.recoveryDeadline, daysRemaining: item.daysRemaining,
    });

    if (type === 'all') {
      (await softDeleteService.listAllSoftDeleted(pagination.limit, pagination.offset)).forEach(addItem);
    }

    if (type === 'user') {
      (await softDeleteService.listSoftDeleted('user', pagination.limit, pagination.offset)).forEach(addItem);
    }

    if (type === 'dao') {
      (await softDeleteService.listSoftDeleted('dao', pagination.limit, pagination.offset)).forEach(addItem);
    }

    if (type === 'admin') {
      (await softDeleteService.listSoftDeleted('admin', pagination.limit, pagination.offset)).forEach(addItem);
    }

    items.total = items.items.length;

    await auditDashboardAccess(req, 'ADMIN_DASHBOARD_RECOVERY_ITEMS_ACCESSED', String(type));
    res.json(items);
  } catch (error) {
    dashboardLogger.error('Error getting recovery items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/dashboard/audit-summary
 * Get audit activity summary with trends
 */
router.get('/audit-summary', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const adminId = getAdminId(req);
    if (!adminId) {
      return res.status(401).json({ error: 'Authentication required' });
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

    const response = {
      periods: {
        last7Days: {
          stats: stats7Day,
        },
        last30Days: {
          stats: stats30Day,
        },
      },
    };
    await auditDashboardAccess(req, 'ADMIN_DASHBOARD_AUDIT_SUMMARY_ACCESSED', 'audit-summary');
    res.json(response);
  } catch (error) {
    dashboardLogger.error('Error getting audit summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
