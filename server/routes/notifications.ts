
import express, { Request, Response } from 'express';
import { isAuthenticated } from '../nextAuthMiddleware';
import { storage } from '../storage';
import { z } from 'zod';
import { insertNotificationSchema } from '../../shared/schema';

const router = express.Router();

// Get user notifications
router.get('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { limit = 20, offset = 0, read, type } = req.query;
    const userId = (req.user as any).claims.sub;
    
    const notifications = await storage.getUserNotifications(
      userId,
      read === 'true' ? true : read === 'false' ? false : undefined,
      Number(limit),
      Number(offset),
      type as string
    );
    
    const unreadCount = await storage.getUnreadNotificationCount(userId);
    
    res.json({ 
      notifications, 
      total: notifications.length,
      unreadCount 
    });
  } catch (err) {
    res.status(500).json({ 
      error: 'Failed to fetch notifications',
      message: err instanceof Error ? err.message : String(err)
    });
  }
});

// Mark notification as read
router.patch('/:notificationId/read', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const userId = (req.user as any).claims.sub;
    
    const notification = await storage.markNotificationAsRead(notificationId, userId);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json(notification);
  } catch (err) {
    res.status(500).json({ 
      error: 'Failed to mark notification as read',
      message: err instanceof Error ? err.message : String(err)
    });
  }
});

// Mark all notifications as read
router.patch('/mark-all-read', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims.sub;
    
    await storage.markAllNotificationsAsRead(userId);
    
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ 
      error: 'Failed to mark all notifications as read',
      message: err instanceof Error ? err.message : String(err)
    });
  }
});

// Delete notification
router.delete('/:notificationId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const userId = (req.user as any).claims.sub;
    
    const deleted = await storage.deleteNotification(notificationId, userId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ 
      error: 'Failed to delete notification',
      message: err instanceof Error ? err.message : String(err)
    });
  }
});

// Get notification preferences
router.get('/preferences', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims.sub;
    
    const preferences = await storage.getUserNotificationPreferences(userId);
    
    res.json(preferences);
  } catch (err) {
    res.status(500).json({ 
      error: 'Failed to fetch notification preferences',
      message: err instanceof Error ? err.message : String(err)
    });
  }
});

// Update notification preferences
router.put('/preferences', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims.sub;
    const { emailNotifications, pushNotifications, daoUpdates, proposalUpdates, taskUpdates } = req.body;
    
    const preferences = await storage.updateUserNotificationPreferences(userId, {
      emailNotifications: emailNotifications ?? true,
      pushNotifications: pushNotifications ?? true,
      daoUpdates: daoUpdates ?? true,
      proposalUpdates: proposalUpdates ?? true,
      taskUpdates: taskUpdates ?? true,
    });
    
    res.json(preferences);
  } catch (err) {
    res.status(500).json({ 
      error: 'Failed to update notification preferences',
      message: err instanceof Error ? err.message : String(err)
    });
  }
});

// Admin: Send notification to user(s)
router.post('/send', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const senderId = (req.user as any).claims.sub;
    const { userIds, type, message, title, metadata } = req.body;
    
    // Check if user has permission to send notifications (admin/moderator)
    const senderRole = (req.user as any).role;
    if (senderRole !== 'admin' && senderRole !== 'superuser' && senderRole !== 'moderator') {
      return res.status(403).json({ error: 'Insufficient permissions to send notifications' });
    }
    
    const notifications = await storage.createBulkNotifications(userIds, {
      type,
      message,
      title,
      metadata,
      senderId
    });
    
    res.status(201).json({ 
      message: 'Notifications sent successfully',
      count: notifications.length 
    });
  } catch (err) {
    res.status(500).json({ 
      error: 'Failed to send notifications',
      message: err instanceof Error ? err.message : String(err)
    });
  }
});

export default router;
