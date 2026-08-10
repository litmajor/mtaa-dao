
import express from 'express'
import type { Request, Response } from 'express';
import { isAuthenticated } from '../auth';
import { storage, type Notification } from '../storage';
import { z } from 'zod';
import { insertNotificationSchema } from '../../shared/schema';
import { notificationService } from '../notificationService';

const router = express.Router();

const sendNotificationBodySchema = z.object({
  userIds: z.array(z.string().min(1)).min(1),
  type: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

const notificationInsertSchema = insertNotificationSchema.pick({
  userId: true,
  type: true,
  title: true,
  message: true,
  priority: true,
  metadata: true,
});

const getAuthenticatedUserId = (req: Request): string | undefined => req.user?.claims?.sub;

// Get user notifications
router.get('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { limit = 20, offset = 0, read, type } = req.query;
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const notifications = await storage.getUserNotifications(
      userId,
      read === 'true' ? true : read === 'false' ? false : undefined,
      Number(limit),
      Number(offset),
      typeof type === 'string' ? type : undefined
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
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

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
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

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
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

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
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

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
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { emailNotifications, pushNotifications, telegramNotifications, daoUpdates, proposalUpdates, taskUpdates } = req.body;
    
    const updates: {
      emailNotifications?: boolean;
      pushNotifications?: boolean;
      telegramNotifications?: boolean;
      daoUpdates?: boolean;
      proposalUpdates?: boolean;
      taskUpdates?: boolean;
    } = {
      emailNotifications: emailNotifications ?? true,
      pushNotifications: pushNotifications ?? true,
      telegramNotifications: telegramNotifications ?? false,
      daoUpdates: daoUpdates ?? true,
      proposalUpdates: proposalUpdates ?? true,
      taskUpdates: taskUpdates ?? true,
    };

    const preferences = await storage.updateUserNotificationPreferences(userId, updates);
    res.json(preferences);
  } catch (err) {
    res.status(500).json({ 
      error: 'Failed to update notification preferences',
      message: err instanceof Error ? err.message : String(err)
    });
  }
});

// Link Telegram account
router.post('/telegram/link', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { telegramId, chatId, username } = req.body;
    
    await storage.updateUserTelegramInfo(userId, { telegramId, chatId, username });
    
    res.json({ message: 'Telegram account linked successfully' });
  } catch (err) {
    res.status(500).json({ 
      error: 'Failed to link Telegram account',
      message: err instanceof Error ? err.message : String(err)
    });
  }
});

// Get Telegram bot info
router.get('/telegram/bot-info', async (req: Request, res: Response) => {
  try {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'mtaadao_bot';
    const currentUserId = getAuthenticatedUserId(req) || 'USER_ID';
    
    res.json({ 
      botUsername,
      linkInstructions: `To link your Telegram account, send a message to @${botUsername} with the command: /link ${currentUserId}`
    });
  } catch (err) {
    res.status(500).json({ 
      error: 'Failed to get bot info',
      message: err instanceof Error ? err.message : String(err)
    });
  }
});

// Admin: Send notification to user(s)
router.post('/send', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const senderId = getAuthenticatedUserId(req);
    if (!senderId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const parsedBody = sendNotificationBodySchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({
        error: 'Invalid notification payload',
        details: parsedBody.error.flatten(),
      });
    }

    const { userIds, type, message, title, metadata } = parsedBody.data;

    // Check if user has permission to send notifications (admin/moderator)
    const senderRole = (req.user as any).role;
    if (senderRole !== 'admin' && senderRole !== 'superuser' && senderRole !== 'moderator') {
      return res.status(403).json({ error: 'Insufficient permissions to send notifications' });
    }

    const createdNotifications: Notification[] = [];

    for (const userId of userIds) {
      const payload = notificationInsertSchema.parse({
        userId,
        type,
        title,
        message,
        priority: 'medium',
        metadata: metadata ?? {},
      });

      const createdNotification = await storage.createNotification(payload);
      if (createdNotification) {
        createdNotifications.push(createdNotification);
      }

      await notificationService.createNotification({
        userId,
        type,
        title,
        message,
        priority: 'medium',
        metadata: metadata ?? {},
        persist: false,
      });
    }

    res.status(201).json({
      message: 'Notifications sent successfully',
      count: createdNotifications.length,
      preview: createdNotifications.slice(0, 3),
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to send notifications',
      message: err instanceof Error ? err.message : String(err)
    });
  }
});

// Search notifications
router.get('/search', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query;
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const notifications = await storage.getUserNotifications(
      userId,
      undefined,
      Number(limit),
      Number(offset),
      q as string
    );
    
    res.json({ 
      notifications, 
      total: notifications.length,
      query: q
    });
  } catch (err) {
    res.status(500).json({ 
      error: 'Failed to search notifications',
      message: err instanceof Error ? err.message : String(err)
    });
  }
});

export default router;


