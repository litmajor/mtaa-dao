/**
 * Admin Soft Delete Recovery Routes
 * Day 3 - User/DAO/Admin Recovery Operations
 * 
 * Endpoints for restoring and permanently deleting soft-deleted items
 * Power Checklist: #1 Reversibility, #3 Approval Authority, #8 Post-Action Narrative
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import softDeleteService from '../../services/softDeleteService';
import auditLoggingService from '../../services/auditLoggingService';
import { requireRole } from '../../middleware/rbac';

const router = Router();
router.use(requireRole('admin', 'super_admin'));
const targetTypes = ['user', 'dao', 'admin'] as const;
type TargetType = typeof targetTypes[number];

function getAdminId(req: Request): string | null {
  return req.user?.userId || req.user?.claims?.sub || req.user?.id || null;
}

function getAdminRole(req: Request): string {
  if (req.userRole) return req.userRole;
  if (req.user?.role) return req.user.role;
  const roles = req.user?.roles;
  return Array.isArray(roles) ? roles[0] || 'admin' : roles || 'admin';
}

function parseTargetType(value: string): TargetType | null {
  return targetTypes.includes(value as TargetType) ? value as TargetType : null;
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

async function logRecoveryAudit(entry: Parameters<typeof auditLoggingService.logAction>[0]): Promise<void> {
  try {
    await auditLoggingService.logAction(entry);
  } catch (error) {
    logger.error('Soft-delete recovery audit failed', { error, actionType: entry.actionType, targetType: entry.targetType, targetId: entry.targetId });
  }
}

/**
 * GET /api/admin/soft-delete-recovery/items
 * List all soft-deleted items pending recovery
 */
router.get('/items', async (req: Request, res: Response) => {
  try {
    const adminId = getAdminId(req);
    if (!adminId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { type = 'all' } = req.query;
    const pagination = parsePagination(req.query);
    if (!pagination) return res.status(400).json({ error: 'limit must be between 1 and 100 and offset must be non-negative' });
    if (type !== 'all' && !parseTargetType(String(type))) return res.status(400).json({ error: 'Invalid target type' });

    const { limit: pageLimit, offset: pageOffset } = pagination;

    const items: Array<Record<string, unknown>> = [];
    const addItem = (item: Awaited<ReturnType<typeof softDeleteService.listSoftDeleted>>[number]) => items.push({
      id: item.id, type: item.type, name: item.name, deletedAt: item.deletedAt, deletedBy: item.deletedBy,
      reason: item.reason, recoveryDeadline: item.recoveryDeadline, daysRemaining: item.daysRemaining,
      isExpired: item.daysRemaining <= 0, isExpiringSoon: item.daysRemaining > 0 && item.daysRemaining <= 3,
    });

    if (type === 'all') {
      const allItems = await softDeleteService.listAllSoftDeleted(pageLimit, pageOffset);
      allItems.forEach(addItem);
    }

    if (type === 'user') {
      const users = await softDeleteService.listSoftDeleted('user', pageLimit, pageOffset, true);
      users.forEach(addItem);
    }

    if (type === 'dao') {
      const daos = await softDeleteService.listSoftDeleted('dao', pageLimit, pageOffset, true);
      daos.forEach(addItem);
    }

    if (type === 'admin') {
      const admins = await softDeleteService.listSoftDeleted('admin', pageLimit, pageOffset, true);
      admins.forEach(addItem);
    }

    res.json({
      items: items.sort((a, b) => Number(a.daysRemaining) - Number(b.daysRemaining)),
      count: items.length,
      type,
    });
    await logRecoveryAudit({
      actorId: getAdminId(req) as string, actorType: 'admin', actorRole: getAdminRole(req), actionType: 'soft_delete_recovery_list_accessed',
      actionCategory: 'admin', targetType: 'soft_delete_recovery', targetId: String(type), targetName: String(type),
      result: 'success', reversible: false, metadata: { limit: pageLimit, offset: pageOffset },
    });
  } catch (error) {
    logger.error('Error getting soft-deleted items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/soft-delete-recovery/items/:targetType/:targetId
 * Get recovery status for a specific item
 */
router.get('/items/:targetType/:targetId', async (req: Request, res: Response) => {
  try {
    const adminId = getAdminId(req);
    if (!adminId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { targetId } = req.params;
    const targetType = parseTargetType(req.params.targetType);
    if (!targetType) return res.status(400).json({ error: 'Invalid target type' });

    const status = await softDeleteService.getRecoveryStatus(targetId, targetType);

    if (!status.isDeleted) {
      return res.status(404).json({ error: 'Item not deleted or not found' });
    }

    res.json({
      targetId,
      targetType,
      status,
    });
    await logRecoveryAudit({
      actorId: getAdminId(req) as string, actorType: 'admin', actorRole: getAdminRole(req), actionType: 'soft_delete_recovery_status_accessed',
      actionCategory: 'admin', targetType, targetId, targetName: targetId,
      result: 'success', reversible: false,
    });
  } catch (error) {
    logger.error('Error getting recovery status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/soft-delete-recovery/items/:targetType/:targetId/restore
 * Restore a soft-deleted item (within recovery window)
 * Power Checklist: #1 Reversibility, #3 Approval Authority, #8 Post-Action Narrative
 */
router.post('/items/:targetType/:targetId/restore', async (req: Request, res: Response) => {
  try {
    const adminId = getAdminId(req);
    if (!adminId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { targetId } = req.params;
    const targetType = parseTargetType(req.params.targetType);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!targetType) return res.status(400).json({ error: 'Invalid target type' });

    if (!reason || reason.length > 1000) {
      return res.status(400).json({ error: 'Reason for restoration is required' });
    }

    // Check current status
    const status = await softDeleteService.getRecoveryStatus(targetId, targetType);

    if (!status.isDeleted) {
      return res.status(400).json({ error: 'Item is not deleted' });
    }

    const daysRemaining = status.daysRemaining ?? 0;
    if (daysRemaining <= 0) {
      return res.status(400).json({
        error: 'Recovery window expired',
        expiredAt: status.recoveryDeadline,
      });
    }

    // Restore the item
    const restore = targetType === 'user'
      ? softDeleteService.restoreUser
      : targetType === 'dao'
        ? softDeleteService.restoreDAO
        : softDeleteService.restoreAdmin;
    await restore.call(softDeleteService, {
      targetId,
      targetType,
      restoredBy: adminId,
      reason,
    });

    // Log audit entry - restoration is reversible if undone within policy window
    await logRecoveryAudit({
      actorId: adminId,
      actorType: 'admin',
      actorRole: getAdminRole(req),
      actionType: `${targetType}_restored`,
      actionCategory: 'admin',
      targetType,
      targetId,
      targetName: targetId, // Should be fetched from DB in production
      result: 'success',
      reversible: true,
      metadata: {
        restorationReason: reason,
        recoveryWindowUsed: `${daysRemaining} days remaining`,
      },
    });

    res.json({
      success: true,
      message: `${targetType} restored successfully`,
      targetId,
      targetType,
      restoredAt: new Date(),
    });
  } catch (error) {
    logger.error('Error restoring item:', error);

    if (error instanceof Error && /recovery (window|deadline) expired|recovery window is open/i.test(error.message)) {
      return res.status(400).json({ error: 'Recovery window has expired' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/soft-delete-recovery/items/:targetType/:targetId/force-delete
 * Permanently delete a soft-deleted item (only after recovery deadline)
 * Power Checklist: #3 Approval Authority, #8 Post-Action Narrative
 */
router.post('/items/:targetType/:targetId/force-delete', async (req: Request, res: Response) => {
  try {
    const adminId = getAdminId(req);
    if (!adminId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { targetId } = req.params;
    const targetType = parseTargetType(req.params.targetType);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const { confirmDelete } = req.body ?? {};
    if (!targetType) return res.status(400).json({ error: 'Invalid target type' });

    if (!reason || reason.length > 1000) {
      return res.status(400).json({ error: 'Reason for permanent deletion is required' });
    }

    if (confirmDelete !== true) {
      return res.status(400).json({ error: 'Permanent deletion must be explicitly confirmed' });
    }

    // Check current status
    const status = await softDeleteService.getRecoveryStatus(targetId, targetType);

    if (!status.isDeleted) {
      return res.status(400).json({ error: 'Item is not deleted' });
    }

    const daysRemaining = status.daysRemaining ?? 0;
    if (daysRemaining > 0) {
      return res.status(400).json({
        error: 'Recovery window not yet expired',
        recoveryDeadline: status.recoveryDeadline,
        daysRemaining,
        message: 'Cannot permanently delete until recovery period expires',
      });
    }

    // Permanently delete the item
    await softDeleteService.permanentlyDelete(targetId, targetType, reason);

    // Log audit entry - permanent deletion is NOT reversible
    await logRecoveryAudit({
      actorId: adminId,
      actorType: 'admin',
      actorRole: getAdminRole(req),
      actionType: `${targetType}_permanently_deleted`,
      actionCategory: 'admin',
      targetType,
      targetId,
      targetName: targetId,
      result: 'success',
      reversible: false,
      metadata: {
        deletionReason: reason,
        recoveryWindowExpiredAt: status.recoveryDeadline,
        permanentDeletionConfirmed: true,
      },
    });

    res.json({
      success: true,
      message: `${targetType} permanently deleted`,
      targetId,
      targetType,
      deletedAt: new Date(),
      warning: 'This action is permanent and cannot be reversed',
    });
  } catch (error) {
    logger.error('Error permanently deleting item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/soft-delete-recovery/stats
 * Get statistics on soft-deleted items
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const adminId = getAdminId(req);
    if (!adminId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const byType = await softDeleteService.getSoftDeletedStats();
    const stats = {
      all: {
        total: byType.user.total + byType.dao.total + byType.admin.total,
        recoverable: byType.user.recoverable + byType.dao.recoverable + byType.admin.recoverable,
        expired: byType.user.expired + byType.dao.expired + byType.admin.expired,
        expiringSoon: byType.user.expiringSoon + byType.dao.expiringSoon + byType.admin.expiringSoon,
      },
      byType: {
        users: byType.user,
        daos: byType.dao,
        admins: byType.admin,
      },
    };

    res.json(stats);
    await logRecoveryAudit({
      actorId: getAdminId(req) as string, actorType: 'admin', actorRole: getAdminRole(req), actionType: 'soft_delete_recovery_stats_accessed',
      actionCategory: 'admin', targetType: 'soft_delete_recovery', targetId: 'stats', targetName: 'stats',
      result: 'success', reversible: false,
    });
  } catch (error) {
    logger.error('Error getting recovery stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
