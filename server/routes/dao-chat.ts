
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { logger } from '../utils/logger';
import { daoMessages, users, daos, messageReactions, messageAttachments } from '../../shared/schema';
import { eq, desc, and, like, inArray, sql } from 'drizzle-orm';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// File upload configuration with enhanced validation
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create uploads directory if it doesn't exist
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(sanitizedName));
  }
});

// Enhanced file filter with security checks
const fileFilter = (req: any, file: any, cb: any) => {
  // Allowed MIME types
  const allowedMimes = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'text/plain': ['.txt'],
    'text/csv': ['.csv'],
  };

  const ext = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype.toLowerCase();

  // Check if MIME type is allowed
  const isAllowedMime = mimeType in allowedMimes;
  const isValidExt = isAllowedMime && (allowedMimes as any)[mimeType].includes(ext);

  if (!isAllowedMime || !isValidExt) {
    return cb(new Error(`Invalid file type. Allowed types: ${Object.keys(allowedMimes).join(', ')}`));
  }

  // Check file extension doesn't contain executable extensions
  const dangerousExts = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar', '.zip', '.rar', '.7z'];
  if (dangerousExts.includes(ext.toLowerCase())) {
    return cb(new Error('Executable files are not allowed'));
  }

  cb(null, true);
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only allow single file upload
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

// File upload endpoint with enhanced validation and database persistence
router.post('/dao/:daoId/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { daoId } = req.params;
    const userId = req.user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify DAO membership (optional - if needed for access control)
    // const daoMember = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
    // if (!daoMember.length) {
    //   return res.status(403).json({ error: 'Access denied: Not a member of this DAO' });
    // }

    // Validate file wasn't modified by middleware
    if (!req.file.mimetype || !req.file.size || req.file.size === 0) {
      return res.status(400).json({ error: 'Invalid file data' });
    }

    // Additional size check (backup to multer limit)
    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'File exceeds maximum size of 10MB' });
    }

    // Store attachment metadata in database
    const [attachment] = await db
      .insert(messageAttachments)
      .values({
        messageId: null, // Will be linked when message is created
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        filePath: `/uploads/${req.file.filename}`,
        uploadedBy: userId,
      })
      .returning();

    logger.info(`File uploaded: ${req.file.originalname} (${req.file.size} bytes) by user ${userId}`);

    res.json({
      success: true,
      file: {
        id: attachment.id,
        name: attachment.fileName,
        size: attachment.fileSize,
        type: attachment.fileType,
        url: attachment.filePath,
        uploadedAt: attachment.uploadedAt,
      },
    });
  } catch (error) {
    // Handle multer-specific errors
    if (error instanceof Error) {
      if (error.message.includes('LIMIT_FILE_SIZE')) {
        return res.status(413).json({ error: 'File exceeds maximum size of 10MB' });
      }
      if (error.message.includes('LIMIT_FILE_COUNT')) {
        return res.status(400).json({ error: 'Only one file can be uploaded at a time' });
      }
      if (error.message.includes('Invalid file type') || error.message.includes('Executable')) {
        return res.status(400).json({ error: error.message });
      }
    }
    
    logger.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Add/Toggle reaction to message (POST - adds or removes reaction)
router.post('/messages/:messageId/reactions', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!emoji || typeof emoji !== 'string' || emoji.trim().length === 0) {
      return res.status(400).json({ error: 'Valid emoji is required' });
    }

    // Validate message exists
    const message = await db
      .select({ id: daoMessages.id })
      .from(daoMessages)
      .where(eq(daoMessages.id, messageId))
      .limit(1);

    if (!message.length) {
      return res.status(404).json({ error: 'Message not found' });
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
      
      logger.info(`User ${userId} removed reaction ${emoji} from message ${messageId}`);
      
      res.json({ 
        success: true, 
        action: 'removed', 
        emoji,
        message: 'Reaction removed'
      });
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
      
      logger.info(`User ${userId} added reaction ${emoji} to message ${messageId}`);
      
      res.json({ 
        success: true, 
        action: 'added', 
        emoji,
        reactionId: newReaction.id,
        message: 'Reaction added'
      });
    }
  } catch (error) {
    logger.error('Error toggling reaction:', error);
    res.status(500).json({ error: 'Failed to toggle reaction' });
  }
});

// Remove reaction from message (DELETE - explicit removal)
router.delete('/messages/:messageId/reactions/:emoji', async (req, res) => {
  try {
    const { messageId, emoji: encodedEmoji } = req.params;
    const userId = req.user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const emoji = decodeURIComponent(encodedEmoji);

    if (!emoji || emoji.trim().length === 0) {
      return res.status(400).json({ error: 'Valid emoji is required' });
    }

    // Find and delete the reaction
    const reaction = await db
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

    if (!reaction.length) {
      return res.status(404).json({ error: 'Reaction not found' });
    }

    await db
      .delete(messageReactions)
      .where(eq(messageReactions.id, reaction[0].id));

    logger.info(`User ${userId} deleted reaction ${emoji} from message ${messageId}`);
    
    res.json({ 
      success: true,
      message: 'Reaction removed'
    });
  } catch (error) {
    logger.error('Error removing reaction:', error);
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

// Delete attachment
router.delete('/attachments/:attachmentId', async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const userId = req.user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get attachment to check ownership
    const attachment = await db
      .select()
      .from(messageAttachments)
      .where(eq(messageAttachments.id, attachmentId))
      .limit(1);

    if (!attachment.length) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Only allow deletion by uploader or admin
    if (attachment[0].uploadedBy !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this attachment' });
    }

    // Delete file from disk
    const filePath = path.join('uploads/', attachment[0].fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete database record
    await db
      .delete(messageAttachments)
      .where(eq(messageAttachments.id, attachmentId));

    logger.info(`Attachment ${attachmentId} deleted by user ${userId}`);

    res.json({ success: true, message: 'Attachment deleted' });
  } catch (error) {
    logger.error('Error deleting attachment:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

export default router;
