
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { logger } from '../utils/logger';
import { daoMessages, users, daos, messageReactions, messageAttachments } from '../../shared/schema';
import { eq, desc, and, like, inArray, sql } from 'drizzle-orm';
import { chatService } from '../services/chatService';
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

    const messages = await chatService.getDAOMessages({
      daoId,
      limit: parseInt(limit as string),
      search: (search as string) || undefined,
    });

    res.json({ messages });
  } catch (error) {
    logger.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Create message
router.post('/dao/:daoId/messages', async (req: any, res) => {
  try {
    const { daoId } = req.params;
    const { content, messageType = 'text', replyToMessageId } = req.body;
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const newMessage = await chatService.createMessage(
      daoId,
      userId,
      content,
      messageType,
      replyToMessageId
    );

    res.status(201).json({ message: newMessage });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to create message';
    logger.error('Error creating message:', error);

    if (errorMsg.includes('not a member')) {
      return res.status(403).json({ error: errorMsg });
    }
    if (errorMsg.includes('not found') || errorMsg.includes('empty') || errorMsg.includes('exceeds')) {
      return res.status(400).json({ error: errorMsg });
    }
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// Delete message
router.delete('/dao/:daoId/messages/:messageId', async (req: any, res) => {
  try {
    const { daoId, messageId } = req.params;
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    await chatService.deleteMessage(daoId, messageId, userId);

    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to delete message';
    logger.error('Error deleting message:', error);

    if (errorMsg.includes('Not authorized')) {
      return res.status(403).json({ error: errorMsg });
    }
    if (errorMsg.includes('not found')) {
      return res.status(404).json({ error: errorMsg });
    }
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Edit message
router.patch('/dao/:daoId/messages/:messageId', async (req: any, res) => {
  try {
    const { daoId, messageId } = req.params;
    const { content } = req.body;
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const updatedMessage = await chatService.editMessage(daoId, messageId, userId, content);

    res.json({ message: updatedMessage[0] });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to edit message';
    logger.error('Error editing message:', error);

    if (errorMsg.includes('Not authorized')) {
      return res.status(403).json({ error: errorMsg });
    }
    if (errorMsg.includes('not found') || errorMsg.includes('empty') || errorMsg.includes('exceeds')) {
      return res.status(400).json({ error: errorMsg });
    }
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// File upload endpoint with enhanced validation and database persistence
router.post('/dao/:daoId/upload', upload.single('file'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { daoId } = req.params;
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify DAO membership
    try {
      await chatService.verifyDAOMembership(daoId, userId);
    } catch (error) {
      return res.status(403).json({ error: 'Access denied: Not a member of this DAO' });
    }

    // Validate file wasn't modified by middleware
    if (!req.file.mimetype || !req.file.size || req.file.size === 0) {
      return res.status(400).json({ error: 'Invalid file data' });
    }

    // Additional size check (backup to multer limit)
    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'File exceeds maximum size of 10MB' });
    }

    // Store attachment metadata in database
    const attachment = await chatService.createAttachment(
      req.file.originalname,
      req.file.size,
      req.file.mimetype,
      `/uploads/${req.file.filename}`,
      userId
    );

    logger.info(`File uploaded: ${req.file.originalname} (${req.file.size} bytes) by user ${userId} to DAO ${daoId}`);

    res.status(201).json({
      success: true,
      file: {
        id: attachment.id,
        name: attachment.fileName,
        size: attachment.fileSize,
        type: attachment.fileType,
        url: attachment.fileUrl,
        uploadedAt: attachment.createdAt,
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
router.post('/dao/:daoId/messages/:messageId/reactions', async (req: any, res) => {
  try {
    const { daoId, messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await chatService.toggleReaction(daoId, messageId, userId, emoji);
    res.json(result);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to toggle reaction';
    logger.error('Error toggling reaction:', error);

    if (errorMsg.includes('not found') || errorMsg.includes('emoji')) {
      return res.status(400).json({ error: errorMsg });
    }
    res.status(500).json({ error: 'Failed to toggle reaction' });
  }
});

// Remove reaction from message (DELETE - explicit removal)
router.delete('/dao/:daoId/messages/:messageId/reactions/:emoji', async (req: any, res) => {
  try {
    const { daoId, messageId, emoji: encodedEmoji } = req.params;
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const emoji = decodeURIComponent(encodedEmoji);

    await chatService.removeReaction(daoId, messageId, userId, emoji);

    res.json({
      success: true,
      message: 'Reaction removed',
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to remove reaction';
    logger.error('Error removing reaction:', error);

    if (errorMsg.includes('not found') || errorMsg.includes('emoji')) {
      return res.status(400).json({ error: errorMsg });
    }
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

// Pin/Unpin message
router.post('/dao/:daoId/messages/:messageId/pin', async (req: any, res) => {
  try {
    const { daoId, messageId } = req.params;
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await chatService.togglePinMessage(daoId, messageId, userId);
    res.json({
      success: result.success,
      isPinned: result.isPinned,
      message: result.isPinned ? 'Message pinned' : 'Message unpinned',
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to pin message';
    logger.error('Error pinning message:', error);

    if (errorMsg.includes('not found')) {
      return res.status(404).json({ error: errorMsg });
    }
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
router.delete('/dao/:daoId/attachments/:attachmentId', async (req, res) => {
  try {
    const { daoId, attachmentId } = req.params;
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    await chatService.deleteAttachment(attachmentId, userId);

    // Delete file from disk (async, non-blocking)
    const attachment = await chatService.getAttachment(attachmentId);
    if (attachment && attachment.fileUrl) {
      const filePath = path.join('uploads/', path.basename(attachment.fileUrl));
      setImmediate(() => {
        if (fs.existsSync(filePath)) {
          fs.unlink(filePath, (err) => {
            if (err) {
              logger.error(`Error deleting file ${filePath}:`, err);
            }
          });
        }
      });
    }

    res.json({ success: true, message: 'Attachment deleted' });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to delete attachment';
    logger.error('Error deleting attachment:', error);

    if (errorMsg.includes('Not authorized')) {
      return res.status(403).json({ error: errorMsg });
    }
    if (errorMsg.includes('not found')) {
      return res.status(404).json({ error: errorMsg });
    }
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

export default router;
