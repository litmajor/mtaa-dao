/**
 * User Notification Routes
 * In-app notification endpoints for users
 * Phase 3c Part 4 - User Notifications
 */

import express, { Router } from 'express';
import { authenticateToken } from '../../middleware/auth';
import { UserNotificationService } from '../../services/userNotificationService';
import { AppError } from '../../utils/appError';

const router = Router();

/**
 * GET /
 * Get user's notifications (paginated)
 * Query params: unreadOnly (boolean), limit (default 20), offset (default 0)
 */
router.get('/', authenticateToken as any, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const { unreadOnly, limit, offset } = req.query;

    const { notifications, total, unread } = await UserNotificationService.getUserNotifications(userId, {
      unreadOnly: unreadOnly === 'true',
      limit: limit ? Math.min(parseInt(limit as string), 100) : 20,
      offset: offset ? parseInt(offset as string) : 0
    });

    res.json({
      timestamp: new Date(),
      notifications,
      summary: {
        total,
        unread,
        fetched: notifications.length
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      error: 'Failed to fetch notifications',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /unread
 * Get count of unread notifications
 */
router.get('/unread', authenticateToken as any, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const { notifications, unread } = await UserNotificationService.getUserNotifications(userId, {
      unreadOnly: true,
      limit: 1,
      offset: 0
    });

    res.json({
      timestamp: new Date(),
      unreadCount: unread,
      hasUnread: unread > 0
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      error: 'Failed to fetch unread count',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /preferences
 * Get user notification preferences
 */
router.get('/preferences', authenticateToken as any, async (req: any, res) => {
  try {
    const userId = req.user?.id;

    const preferences = await UserNotificationService.getUserPreferences(userId);

    res.json({
      timestamp: new Date(),
      preferences
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({
      error: 'Failed to fetch preferences',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /summary
 * Get notification summary (counts by type and status)
 */
router.get('/summary', authenticateToken as any, async (req: any, res) => {
  try {
    const userId = req.user?.id;

    const { notifications, total, unread } = await UserNotificationService.getUserNotifications(userId, {
      limit: 10000, // Get all for summary
      offset: 0
    });

    // Calculate summary statistics
    const typeCount: Record<string, number> = {};
    const priorityCount: Record<string, number> = {};

    notifications.forEach(n => {
      typeCount[n.type] = (typeCount[n.type] || 0) + 1;
      priorityCount[n.priority] = (priorityCount[n.priority] || 0) + 1;
    });

    // Count by channel
    const channelCount: Record<string, number> = {};
    notifications.forEach(n => {
      n.channels.forEach(ch => {
        channelCount[ch] = (channelCount[ch] || 0) + 1;
      });
    });

    res.json({
      timestamp: new Date(),
      summary: {
        total,
        unread,
        read: total - unread,
        byType: typeCount,
        byPriority: priorityCount,
        byChannel: channelCount,
        oldestNotification: notifications.length > 0 ? notifications[notifications.length - 1].createdAt : null,
        newestNotification: notifications.length > 0 ? notifications[0].createdAt : null
      }
    });
  } catch (error) {
    console.error('Error fetching notification summary:', error);
    res.status(500).json({
      error: 'Failed to fetch notification summary',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /read-all
 * Mark all notifications as read
 */
router.put('/read-all', authenticateToken as any, async (req: any, res) => {
  try {
    const userId = req.user?.id;

    const result = await UserNotificationService.markAllAsRead(userId);

    res.json({
      timestamp: new Date(),
      updated: result.updated,
      message: `Marked ${result.updated} notifications as read`
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      error: 'Failed to mark notifications as read',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /preferences
 * Update user notification preferences
 * Body: { paymentFailureEmail, paymentFailureInApp, retryUpdatesEmail, ... }
 */
router.put('/preferences', authenticateToken as any, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const updates = req.body;

    // Validate update fields
    const allowedFields = [
      'paymentFailureEmail',
      'paymentFailureInApp',
      'retryUpdatesEmail',
      'retryUpdatesInApp',
      'recoveryHintsEmail',
      'recoveryHintsInApp',
      'systemAlertsEmail',
      'systemAlertsInApp',
      'emailFrequency'
    ];

    const validUpdates: any = {};
    for (const field of allowedFields) {
      if (field in updates) {
        validUpdates[field] = updates[field];
      }
    }

    const preferences = await UserNotificationService.updateUserPreferences(userId, validUpdates);

    res.json({
      timestamp: new Date(),
      preferences,
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({
      error: 'Failed to update preferences',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /:notificationId
 * Get specific notification
 */
router.get('/:notificationId', authenticateToken as any, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const { notificationId } = req.params;

    const { notifications } = await UserNotificationService.getUserNotifications(userId, {
      limit: 1,
      offset: 0
    });

    const notification = notifications.find(n => n.id === notificationId);

    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found'
      });
    }

    res.json({
      timestamp: new Date(),
      notification
    });
  } catch (error) {
    console.error('Error fetching notification:', error);
    res.status(500).json({
      error: 'Failed to fetch notification',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /:notificationId/read
 * Mark notification as read
 */
router.put('/:notificationId/read', authenticateToken as any, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const { notificationId } = req.params;

    const notification = await UserNotificationService.markAsRead(notificationId, userId);

    res.json({
      timestamp: new Date(),
      notification,
      message: 'Notification marked as read'
    });
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    console.error('Error marking notification as read:', error);
    res.status(500).json({
      error: 'Failed to mark notification as read',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * DELETE /:notificationId
 * Delete notification
 */
router.delete('/:notificationId', authenticateToken as any, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const { notificationId } = req.params;

    await UserNotificationService.deleteNotification(notificationId, userId);

    res.json({
      timestamp: new Date(),
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    console.error('Error deleting notification:', error);
    res.status(500).json({
      error: 'Failed to delete notification',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
