/**
 * Admin Soft Delete Recovery Routes
 * Day 3 - User/DAO/Admin Recovery Operations
 * 
 * Endpoints for restoring and permanently deleting soft-deleted items
 * Power Checklist: #1 Reversibility, #3 Approval Authority, #8 Post-Action Narrative
 */

import { Router, Request, Response } from 'express';
import softDeleteService from '../../services/softDeleteService';
import auditLoggingService from '../../services/auditLoggingService';

const router = Router();

/**
 * GET /api/admin/soft-delete-recovery/items
 * List all soft-deleted items pending recovery
 */
router.get('/items', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).adminId;
    if (!adminId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { type = 'all', limit = '50', offset = '0' } = req.query;

    const pageLimit = Math.min(parseInt(limit as string), 100);
    const pageOffset = parseInt(offset as string);

    const items: any = [];

    if (type === 'all' || type === 'user') {
      const users = await softDeleteService.listSoftDeleted('user', pageLimit, pageOffset);
      items.push(
        ...users.map(u => ({
          id: u.id,
          type: 'user',
          name: u.name,
          deletedAt: u.deletedAt,
          deletedBy: u.deletedBy,
          reason: u.reason,
          recoveryDeadline: u.recoveryDeadline,
          daysRemaining: u.daysRemaining,
          isExpired: u.daysRemaining <= 0,
          isExpiringSoon: u.daysRemaining > 0 && u.daysRemaining <= 3,
        }))
      );
    }

    if (type === 'all' || type === 'dao') {
      const daos = await softDeleteService.listSoftDeleted('dao', pageLimit, pageOffset);
      items.push(
        ...daos.map(d => ({
          id: d.id,
          type: 'dao',
          name: d.name,
          deletedAt: d.deletedAt,
          deletedBy: d.deletedBy,
          reason: d.reason,
          recoveryDeadline: d.recoveryDeadline,
          daysRemaining: d.daysRemaining,
          isExpired: d.daysRemaining <= 0,
          isExpiringSoon: d.daysRemaining > 0 && d.daysRemaining <= 3,
        }))
      );
    }

    if (type === 'all' || type === 'admin') {
      const admins = await softDeleteService.listSoftDeleted('admin_user', pageLimit, pageOffset);
      items.push(
        ...admins.map(a => ({
          id: a.id,
          type: 'admin',
          name: a.name,
          deletedAt: a.deletedAt,
          deletedBy: a.deletedBy,
          reason: a.reason,
          recoveryDeadline: a.recoveryDeadline,
          daysRemaining: a.daysRemaining,
          isExpired: a.daysRemaining <= 0,
          isExpiringSoon: a.daysRemaining > 0 && a.daysRemaining <= 3,
        }))
      );
    }

    res.json({
      items: items.sort((a: any, b: any) => a.daysRemaining - b.daysRemaining),
      count: items.length,
      type,
    });
  } catch (error) {
    console.error('Error getting soft-deleted items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/soft-delete-recovery/items/:targetType/:targetId
 * Get recovery status for a specific item
 */
router.get('/items/:targetType/:targetId', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).adminId;
    if (!adminId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { targetType, targetId } = req.params;

    const status = await softDeleteService.getRecoveryStatus(targetId, targetType);

    if (!status.isDeleted) {
      return res.status(404).json({ error: 'Item not deleted or not found' });
    }

    res.json({
      targetId,
      targetType,
      status,
    });
  } catch (error) {
    console.error('Error getting recovery status:', error);
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
    const adminId = (req as any).adminId;
    if (!adminId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { targetType, targetId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Reason for restoration is required' });
    }

    // Check current status
    const status = await softDeleteService.getRecoveryStatus(targetId, targetType);

    if (!status.isDeleted) {
      return res.status(400).json({ error: 'Item is not deleted' });
    }

    if (status.daysRemaining <= 0) {
      return res.status(400).json({
        error: 'Recovery window expired',
        expiredAt: status.recoveryDeadline,
      });
    }

    // Restore the item
    await softDeleteService.restoreUser({
      targetId,
      targetType: targetType as 'user' | 'dao' | 'admin',
      restoredBy: adminId,
      reason,
    });

    // Log audit entry - restoration is reversible if undone within policy window
    await auditLoggingService.logAction({
      actorId: adminId,
      actorType: 'admin',
      actorRole: 'admin',
      actionType: `${targetType}_restored`,
      actionCategory: 'admin',
      targetType,
      targetId,
      targetName: targetId, // Should be fetched from DB in production
      result: 'success',
      reversible: false, // Restoration itself is not reversible, but restoration action is logged
      metadata: {
        restorationReason: reason,
        recoveryWindowUsed: `${status.daysRemaining} days remaining`,
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
    console.error('Error restoring item:', error);

    if (error instanceof Error && error.message.includes('Recovery window expired')) {
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
    const adminId = (req as any).adminId;
    if (!adminId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { targetType, targetId } = req.params;
    const { reason, confirmDelete } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Reason for permanent deletion is required' });
    }

    if (!confirmDelete) {
      return res.status(400).json({ error: 'Permanent deletion must be explicitly confirmed' });
    }

    // Check current status
    const status = await softDeleteService.getRecoveryStatus(targetId, targetType);

    if (!status.isDeleted) {
      return res.status(400).json({ error: 'Item is not deleted' });
    }

    if (status.daysRemaining > 0) {
      return res.status(400).json({
        error: 'Recovery window not yet expired',
        recoveryDeadline: status.recoveryDeadline,
        daysRemaining: status.daysRemaining,
        message: 'Cannot permanently delete until recovery period expires',
      });
    }

    // Permanently delete the item
    await softDeleteService.permanentlyDelete(targetId, targetType, reason);

    // Log audit entry - permanent deletion is NOT reversible
    await auditLoggingService.logAction({
      actorId: adminId,
      actorType: 'admin',
      actorRole: 'admin',
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
    console.error('Error permanently deleting item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/soft-delete-recovery/stats
 * Get statistics on soft-deleted items
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).adminId;
    if (!adminId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const [users, daos, admins] = await Promise.all([
      softDeleteService.listSoftDeleted('user', 1000, 0),
      softDeleteService.listSoftDeleted('dao', 1000, 0),
      softDeleteService.listSoftDeleted('admin_user', 1000, 0),
    ]);

    const stats = {
      all: {
        total: (users.length || 0) + (daos.length || 0) + (admins.length || 0),
        recoverable: [
          ...(users || []),
          ...(daos || []),
          ...(admins || []),
        ].filter(i => i.daysRemaining > 0).length,
        expired: [
          ...(users || []),
          ...(daos || []),
          ...(admins || []),
        ].filter(i => i.daysRemaining <= 0).length,
        expiringSoon: [
          ...(users || []),
          ...(daos || []),
          ...(admins || []),
        ].filter(i => i.daysRemaining > 0 && i.daysRemaining <= 3).length,
      },
      byType: {
        users: {
          total: (users || []).length,
          recoverable: (users || []).filter(u => u.daysRemaining > 0).length,
          expiringSoon: (users || []).filter(u => u.daysRemaining > 0 && u.daysRemaining <= 3).length,
        },
        daos: {
          total: (daos || []).length,
          recoverable: (daos || []).filter(d => d.daysRemaining > 0).length,
          expiringSoon: (daos || []).filter(d => d.daysRemaining > 0 && d.daysRemaining <= 3).length,
        },
        admins: {
          total: (admins || []).length,
          recoverable: (admins || []).filter(a => a.daysRemaining > 0).length,
          expiringSoon: (admins || []).filter(a => a.daysRemaining > 0 && a.daysRemaining <= 3).length,
        },
      },
    };

    res.json(stats);
  } catch (error) {
    console.error('Error getting recovery stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
