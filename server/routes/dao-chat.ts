
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { logger } from '../utils/logger';
import { daoMessages, users, daos, messageReactions, messageAttachments } from '../../shared/schema';
import { eq, desc, and, like, inArray, sql } from 'drizzle-orm';
import multer from 'multer';
import path from 'path';

const router = Router();

// File upload configuration
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Get DAO messages
router.get('/dao/:daoId/messages', async (req, res) => {
  try {
    const { daoId } = req.params;
    const { limit = 50, search } = req.query;
    
    // Build where condition
    let whereCondition: any = eq(daoMessages.daoId, daoId);
    let searchStr: string | undefined = undefined;
    if (typeof search === 'string' && search.trim().length > 0) {
      searchStr = search;
      whereCondition = and(whereCondition, like(daoMessages.content, `%${searchStr}%`));
    } else if (Array.isArray(search) && typeof search[0] === 'string' && search[0].trim().length > 0) {
      searchStr = search[0];
      whereCondition = and(whereCondition, like(daoMessages.content, `%${searchStr}%`));
    }

    const messages = await db
      .select({
        id: daoMessages.id,
        content: daoMessages.content,
        userId: daoMessages.userId,
        userName: users.username,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        createdAt: daoMessages.createdAt,
        updatedAt: daoMessages.updatedAt,
        messageType: daoMessages.messageType,
        replyToMessageId: daoMessages.replyToMessageId,
        isPinned: daoMessages.isPinned,
        pinnedAt: daoMessages.pinnedAt,
        pinnedBy: daoMessages.pinnedBy,
      })
      .from(daoMessages)
      .leftJoin(users, eq(daoMessages.userId, users.id))
      .where(whereCondition)
      .orderBy(desc(daoMessages.createdAt))
      .limit(parseInt(limit as string));
    
    // Fetch reactions for all messages
    const messageIds = messages.map(m => m.id);
    const reactions = messageIds.length > 0 ? await db
      .select({
        messageId: messageReactions.messageId,
        emoji: messageReactions.emoji,
        userId: messageReactions.userId,
        userName: users.username,
      })
      .from(messageReactions)
      .leftJoin(users, eq(messageReactions.userId, users.id))
      .where(inArray(messageReactions.messageId, messageIds)) : [];
    
    // Fetch attachments for all messages
    const attachments = messageIds.length > 0 ? await db
      .select()
      .from(messageAttachments)
      .where(inArray(messageAttachments.messageId, messageIds)) : [];
    
    // Fetch reply-to messages
    const replyToMessageIds = messages
      .filter(m => m.replyToMessageId)
      .map(m => m.replyToMessageId as string);
    
    const replyToMessages = replyToMessageIds.length > 0 ? await db
      .select({
        id: daoMessages.id,
        content: daoMessages.content,
        userName: users.username,
      })
      .from(daoMessages)
      .leftJoin(users, eq(daoMessages.userId, users.id))
      .where(inArray(daoMessages.id, replyToMessageIds)) : [];
    
    // Build reaction groups for each message
    const reactionGroups = reactions.reduce((acc, r) => {
      if (!acc[r.messageId]) acc[r.messageId] = {};
      if (!acc[r.messageId][r.emoji]) {
        acc[r.messageId][r.emoji] = { count: 0, users: [] };
      }
      acc[r.messageId][r.emoji].count++;
      acc[r.messageId][r.emoji].users.push({
        id: r.userId,
        name: r.userName || 'Unknown',
      });
      return acc;
    }, {} as Record<string, Record<string, { count: number; users: any[] }>>);
    
    // Enhance messages with real data
    const enhancedMessages = messages.map(msg => ({
      ...msg,
      userName: msg.userName || `${msg.userFirstName || ''} ${msg.userLastName || ''}`.trim() || 'Anonymous',
      reactions: reactionGroups[msg.id] || {},
      attachment: attachments.find(a => a.messageId === msg.id) || null,
      isPinned: msg.isPinned || false,
      replyTo: msg.replyToMessageId
        ? replyToMessages.find(r => r.id === msg.replyToMessageId) || null
        : null,
    }));
    
    res.json({ messages: enhancedMessages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Create message
router.post('/dao/:daoId/messages', async (req, res) => {
  try {
    const { daoId } = req.params;
    const { content, messageType = 'text', replyTo } = req.body;
  const userId = req.user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const [newMessage] = await db.insert(daoMessages).values({
      daoId,
      userId,
      content,
      messageType,
      replyToMessageId: replyTo?.id || null
    }).returning();
    
    res.json({ message: newMessage });
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// File upload endpoint
router.post('/dao/:daoId/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileData = {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      url: `/uploads/${req.file.filename}`
    };
    
    res.json(fileData);
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Add/Toggle reaction to message
router.post('/messages/:messageId/reactions', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!emoji || typeof emoji !== 'string') {
      return res.status(400).json({ error: 'Emoji is required' });
    }
    
    // Check if user already reacted with this emoji
    const existingReaction = await db
      .select()
      .from(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.userId, userId),
          eq(messageReactions.emoji, emoji)
        )
      )
      .limit(1);
    
    if (existingReaction.length > 0) {
      // Remove reaction (toggle off)
      await db
        .delete(messageReactions)
        .where(eq(messageReactions.id, existingReaction[0].id));
      
      res.json({ success: true, action: 'removed', emoji });
    } else {
      // Add reaction
      const [newReaction] = await db
        .insert(messageReactions)
        .values({
          messageId,
          userId,
          emoji,
        })
        .returning();
      
      res.json({ success: true, action: 'added', emoji, reaction: newReaction });
    }
  } catch (error) {
    console.error('Error toggling reaction:', error);
    res.status(500).json({ error: 'Failed to toggle reaction' });
  }
});

// Remove reaction from message
router.delete('/messages/:messageId/reactions/:emoji', async (req, res) => {
  try {
    const { messageId, emoji } = req.params;
    const userId = req.user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    await db
      .delete(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.userId, userId),
          eq(messageReactions.emoji, decodeURIComponent(emoji))
        )
      );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing reaction:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

// Pin/Unpin message
router.post('/messages/:messageId/pin', async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Get the message to check DAO membership
    const message = await db
      .select({ daoId: daoMessages.daoId, isPinned: daoMessages.isPinned })
      .from(daoMessages)
      .where(eq(daoMessages.id, messageId))
      .limit(1);
    
    if (!message.length) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Toggle pin status
    const newPinStatus = !message[0].isPinned;
    
    await db
      .update(daoMessages)
      .set({
        isPinned: newPinStatus,
        pinnedAt: newPinStatus ? new Date() : null,
        pinnedBy: newPinStatus ? userId : null,
      })
      .where(eq(daoMessages.id, messageId));
    
    res.json({ 
      success: true, 
      isPinned: newPinStatus,
      message: newPinStatus ? 'Message pinned' : 'Message unpinned'
    });
  } catch (error) {
    logger.error('Error pinning message:', error);
    res.status(500).json({ error: 'Failed to pin message' });
  }
});

// Typing indicator
router.post('/dao/:daoId/typing', async (req, res) => {
  try {
    const { daoId } = req.params;
    const { isTyping } = req.body;
    const userId = req.user?.claims?.sub;
    let userName = 'Anonymous';
    if (userId) {
      const [user] = await db.select({
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName
      }).from(users).where(eq(users.id, userId));
      if (user) {
        userName = user.username || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Anonymous';
      }
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Update typing status via WebSocket
    const webSocketService = req.app.locals.webSocketService;
    webSocketService.handleTyping({
      daoId,
      userId,
      userName,
      isTyping
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating typing status:', error);
    res.status(500).json({ error: 'Failed to update typing status' });
  }
});

// Get presence info (online users, typing indicators)
router.get('/dao/:daoId/presence', async (req, res) => {
  try {
    const { daoId } = req.params;
    const webSocketService = req.app.locals.webSocketService;

    // Get real-time presence data
    // Use inArray for Drizzle ORM
    const onlineUserIds = webSocketService.getOnlineUsers(daoId);
    const typingUserIds = webSocketService.getTypingUsers(daoId);

    const onlineUsers = await db
      .select({
        userId: users.id,
        userName: users.username,
      })
      .from(users)
      .where(inArray(users.id, onlineUserIds));

    const typingUsers = await db
      .select({
        userId: users.id,
        userName: users.username,
      })
      .from(users)
      .where(inArray(users.id, typingUserIds));

    res.json({
      onlineUsers: onlineUsers.map(u => ({
        id: u.userId,
        name: u.userName
      })),
      typingUsers: typingUsers.map(u => ({
        id: u.userId,
        name: u.userName
      }))
    });
  } catch (error) {
    logger.error('Error fetching presence:', error);
    res.status(500).json({ error: 'Failed to fetch presence' });
  }
});

export default router;
