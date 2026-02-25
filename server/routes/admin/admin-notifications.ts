/**
 * Admin Notification Management Routes
 * Super admin endpoints for managing notifications and templates
 * Phase 3c Part 4 - User Notifications
 */

import express, { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { UserNotificationService, NotificationType, NotificationChannel } from '../services/userNotificationService';
import { db } from '../../db';
import { AppError } from '../utils/appError';

const router = Router();

// All routes require super admin auth
router.use(authenticate, authorize('super_admin'));

/**
 * GET /admin/notifications/templates
 * Get all notification templates
 */
router.get('/admin/notifications/templates', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM notification_templates ORDER BY type, channel'
    );

    res.json({
      timestamp: new Date(),
      templates: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      error: 'Failed to fetch templates',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /admin/notifications/templates/:type/:channel
 * Get specific notification template
 */
router.get('/admin/notifications/templates/:type/:channel', async (req, res) => {
  try {
    const { type, channel } = req.params;

    const result = await db.query(
      'SELECT * FROM notification_templates WHERE type = $1 AND channel = $2',
      [type, channel]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Template not found'
      });
    }

    res.json({
      timestamp: new Date(),
      template: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({
      error: 'Failed to fetch template',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /admin/notifications/templates
 * Create new notification template
 * Body: { type, channel, title, template, variables, isActive }
 */
router.post('/admin/notifications/templates', async (req, res) => {
  try {
    const { type, channel, title, template, variables, isActive } = req.body;

    if (!type || !channel || !title || !template) {
      return res.status(400).json({
        error: 'Missing required fields: type, channel, title, template'
      });
    }

    // Validate notification type
    if (!Object.values(NotificationType).includes(type)) {
      return res.status(400).json({
        error: `Invalid notification type. Must be one of: ${Object.values(NotificationType).join(', ')}`
      });
    }

    // Validate channel
    if (!Object.values(NotificationChannel).includes(channel)) {
      return res.status(400).json({
        error: `Invalid channel. Must be one of: ${Object.values(NotificationChannel).join(', ')}`
      });
    }

    const result = await db.query(
      `INSERT INTO notification_templates (type, channel, title, template, variables, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [type, channel, title, template, JSON.stringify(variables || []), isActive !== false]
    );

    res.status(201).json({
      timestamp: new Date(),
      template: result.rows[0],
      message: 'Template created successfully'
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      error: 'Failed to create template',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /admin/notifications/templates/:id
 * Update notification template
 */
router.put('/admin/notifications/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, template, variables, isActive } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (template !== undefined) {
      updates.push(`template = $${paramCount++}`);
      values.push(template);
    }
    if (variables !== undefined) {
      updates.push(`variables = $${paramCount++}`);
      values.push(JSON.stringify(variables));
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No fields to update'
      });
    }

    values.push(id);
    updates.push(`updated_at = NOW()`);

    const result = await db.query(
      `UPDATE notification_templates SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Template not found'
      });
    }

    res.json({
      timestamp: new Date(),
      template: result.rows[0],
      message: 'Template updated successfully'
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      error: 'Failed to update template',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * DELETE /admin/notifications/templates/:id
 * Delete notification template
 */
router.delete('/admin/notifications/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM notification_templates WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Template not found'
      });
    }

    res.json({
      timestamp: new Date(),
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      error: 'Failed to delete template',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /admin/notifications/stats
 * Get notification statistics
 */
router.get('/admin/notifications/stats', async (req, res) => {
  try {
    const hoursBack = req.query.hoursBack ? parseInt(req.query.hoursBack as string) : 24;

    const fromDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    // Total notifications
    const totalResult = await db.query(
      'SELECT COUNT(*) as count FROM user_notifications WHERE created_at > $1',
      [fromDate]
    );

    // By type
    const byTypeResult = await db.query(
      `SELECT type, COUNT(*) as count FROM user_notifications 
       WHERE created_at > $1 GROUP BY type ORDER BY count DESC`,
      [fromDate]
    );

    // By priority
    const byPriorityResult = await db.query(
      `SELECT priority, COUNT(*) as count FROM user_notifications 
       WHERE created_at > $1 GROUP BY priority ORDER BY count DESC`,
      [fromDate]
    );

    // By channel
    const byChannelResult = await db.query(
      `SELECT channel, COUNT(*) as count FROM notification_deliveries 
       WHERE created_at > $1 GROUP BY channel ORDER BY count DESC`,
      [fromDate]
    );

    // Delivery status
    const deliveryResult = await db.query(
      `SELECT status, COUNT(*) as count FROM notification_deliveries 
       WHERE created_at > $1 GROUP BY status`,
      [fromDate]
    );

    // Unread vs read
    const readResult = await db.query(
      `SELECT is_read, COUNT(*) as count FROM user_notifications 
       WHERE created_at > $1 GROUP BY is_read`,
      [fromDate]
    );

    res.json({
      timestamp: new Date(),
      period: {
        hours: hoursBack,
        from: fromDate,
        to: new Date()
      },
      stats: {
        total: totalResult.rows[0].count,
        byType: byTypeResult.rows,
        byPriority: byPriorityResult.rows,
        byChannel: byChannelResult.rows,
        deliveryStatus: deliveryResult.rows,
        readStatus: {
          unread: readResult.rows.find(r => r.is_read === false)?.count || 0,
          read: readResult.rows.find(r => r.is_read === true)?.count || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({
      error: 'Failed to fetch notification stats',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /admin/notifications/delivery-status
 * Get notification delivery status and failures
 */
router.get('/admin/notifications/delivery-status', async (req, res) => {
  try {
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string), 100) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const status = req.query.status as string || 'all';

    let whereClause = '';
    const values = [];

    if (status !== 'all') {
      whereClause = 'WHERE status = $1';
      values.push(status);
    }

    const result = await db.query(
      `SELECT d.*, n.type, n.title, n.priority, n.user_id 
       FROM notification_deliveries d
       JOIN user_notifications n ON d.notification_id = n.id
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM notification_deliveries ${whereClause}`,
      values
    );

    res.json({
      timestamp: new Date(),
      deliveries: result.rows,
      pagination: {
        total: countResult.rows[0].count,
        limit,
        offset,
        returned: result.rows.length
      }
    });
  } catch (error) {
    console.error('Error fetching delivery status:', error);
    res.status(500).json({
      error: 'Failed to fetch delivery status',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /admin/notifications/failed
 * Get failed deliveries
 */
router.get('/admin/notifications/failed', async (req, res) => {
  try {
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string), 100) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const result = await db.query(
      `SELECT d.*, n.type, n.title, n.priority, n.user_id, n.message
       FROM notification_deliveries d
       JOIN user_notifications n ON d.notification_id = n.id
       WHERE d.status = 'failed'
       ORDER BY d.updated_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as count FROM notification_deliveries WHERE status = $1',
      ['failed']
    );

    // Group by failure reason
    const failureReasons: Record<string, number> = {};
    result.rows.forEach(row => {
      const reason = row.failure_reason || 'Unknown';
      failureReasons[reason] = (failureReasons[reason] || 0) + 1;
    });

    res.json({
      timestamp: new Date(),
      failures: result.rows,
      summary: {
        total: countResult.rows[0].count,
        returned: result.rows.length,
        topFailureReasons: Object.entries(failureReasons)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([reason, count]) => ({ reason, count }))
      },
      pagination: {
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('Error fetching failed notifications:', error);
    res.status(500).json({
      error: 'Failed to fetch failed notifications',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /admin/notifications/retry-failed
 * Retry failed notification deliveries
 * Body: { notificationId } or { channel, maxRetries } for bulk retry
 */
router.post('/admin/notifications/retry-failed', async (req, res) => {
  try {
    const { notificationId, channel, maxRetries } = req.body;

    if (notificationId) {
      // Retry specific notification
      await db.query(
        `UPDATE notification_deliveries 
         SET status = 'pending', retry_count = 0, last_retry_at = $1
         WHERE notification_id = $2`,
        [new Date(), notificationId]
      );

      res.json({
        timestamp: new Date(),
        message: `Notification ${notificationId} queued for retry`
      });
    } else if (channel) {
      // Retry by channel
      const result = await db.query(
        `UPDATE notification_deliveries 
         SET status = 'pending', retry_count = 0, last_retry_at = $1
         WHERE status = 'failed' AND channel = $2 AND retry_count < $3
         RETURNING notification_id`,
        [new Date(), channel, maxRetries || 3]
      );

      res.json({
        timestamp: new Date(),
        retriedCount: result.rowCount || 0,
        message: `${result.rowCount || 0} failed ${channel} notifications queued for retry`
      });
    } else {
      return res.status(400).json({
        error: 'Must provide either notificationId or channel'
      });
    }
  } catch (error) {
    console.error('Error retrying failed notifications:', error);
    res.status(500).json({
      error: 'Failed to retry notifications',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /admin/notifications/user/:userId
 * Get all notifications for a specific user (admin view)
 */
router.get('/admin/notifications/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string), 100) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const result = await db.query(
      `SELECT * FROM user_notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as count FROM user_notifications WHERE user_id = $1',
      [userId]
    );

    const unreadResult = await db.query(
      'SELECT COUNT(*) as count FROM user_notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    res.json({
      timestamp: new Date(),
      userId,
      notifications: result.rows,
      summary: {
        total: countResult.rows[0].count,
        unread: unreadResult.rows[0].count,
        read: countResult.rows[0].count - unreadResult.rows[0].count
      },
      pagination: {
        limit,
        offset,
        returned: result.rows.length
      }
    });
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    res.status(500).json({
      error: 'Failed to fetch user notifications',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /admin/notifications/user/:userId/preferences
 * Get user's notification preferences (admin view)
 */
router.get('/admin/notifications/user/:userId/preferences', async (req, res) => {
  try {
    const { userId } = req.params;

    const preferences = await UserNotificationService.getUserPreferences(userId);

    res.json({
      timestamp: new Date(),
      userId,
      preferences
    });
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    res.status(500).json({
      error: 'Failed to fetch user preferences',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /admin/notifications/test
 * Send test notification to a user
 * Body: { userId, type, title, message, priority, channels }
 */
router.post('/admin/notifications/test', async (req, res) => {
  try {
    const { userId, type, title, message, priority, channels } = req.body;

    if (!userId || !type || !title || !message) {
      return res.status(400).json({
        error: 'Missing required fields: userId, type, title, message'
      });
    }

    const notification = await UserNotificationService.createNotification({
      userId,
      type: type as NotificationType,
      title,
      message,
      priority: priority || 'medium',
      channels: channels || [NotificationChannel.IN_APP]
    });

    res.status(201).json({
      timestamp: new Date(),
      notification,
      message: 'Test notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      error: 'Failed to send test notification',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
