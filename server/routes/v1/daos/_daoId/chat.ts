/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * V1 DAO Chat Router
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * DAO-scoped chat messaging with:
 * - Message CRUD (create, read, edit, delete)
 * - Reactions (emoji)
 * - Message pinning
 * - File attachments
 * - Typing indicators & presence
 *
 * Base Path: /api/v1/daos/:daoId/chat
 * Parent ensures: isAuthenticated, validateDaoId
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express, { Request, Response, Router } from 'express';
import { chatService } from '../../../../services/chatService';
import { logger } from '../../../../utils/logger';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

interface ChatParams {
  daoId: string;
  messageId?: string;
  attachmentId?: string;
  emoji?: string;
}

// Helper function for userId extraction with proper type narrowing
function getUserId(req: Request): string {
  const userId = (req.user as any)?.claims?.sub;
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid or missing userId');
  }
  return userId;
}

// Helper to get daoId from params
function getDaoId(req: Request): string {
  return (req as any).params?.daoId || '';
}

const router: Router = express.Router({ mergeParams: true });

// File upload config (same as main dao-chat.ts)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(sanitizedName));
  },
});

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedMimes: Record<string, string[]> = {
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
  const isAllowedMime = mimeType in allowedMimes;
  const isValidExt = isAllowedMime && allowedMimes[mimeType].includes(ext);

  if (!isAllowedMime || !isValidExt) {
    return cb(new Error(`Invalid file type. Allowed types: ${Object.keys(allowedMimes).join(', ')}`));
  }

  const dangerousExts = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar', '.zip', '.rar', '.7z'];
  if (dangerousExts.includes(ext.toLowerCase())) {
    return cb(new Error('Executable files are not allowed'));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/daos/:daoId/chat/messages
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/messages', async (req: Request, res: Response) => {
  try {
    const daoId = getDaoId(req);
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

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/v1/daos/:daoId/chat/messages
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/messages', async (req: Request, res: Response) => {
  try {
    const daoId = getDaoId(req);
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

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/v1/daos/:daoId/chat/messages/:messageId
// ═══════════════════════════════════════════════════════════════════════════════
router.patch('/messages/:messageId', async (req: Request, res: Response) => {
  try {
    const daoId = getDaoId(req);
    const { messageId } = (req as any).params;
    const { content } = req.body;
    
    const userId = getUserId(req);

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

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/v1/daos/:daoId/chat/messages/:messageId
// ═══════════════════════════════════════════════════════════════════════════════
router.delete('/messages/:messageId', async (req: Request, res: Response) => {
  try {
    const daoId = getDaoId(req);
    const { messageId } = (req as any).params;
    
    const userId = getUserId(req);

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

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/v1/daos/:daoId/chat/messages/:messageId/pin
// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/v1/daos/:daoId/chat/messages/:messageId/pin
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/messages/:messageId/pin', async (req: Request, res: Response) => {
  try {
    const daoId = getDaoId(req);
    const { messageId } = (req as any).params;
    
    const userId = getUserId(req);

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

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/v1/daos/:daoId/chat/messages/:messageId/reactions
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/messages/:messageId/reactions', async (req: Request, res: Response) => {
  try {
    const daoId = getDaoId(req);
    const { messageId } = (req as any).params;
    const { emoji } = req.body;
    
    const userId = getUserId(req);

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

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/v1/daos/:daoId/chat/messages/:messageId/reactions/:emoji
// ═══════════════════════════════════════════════════════════════════════════════
router.delete('/messages/:messageId/reactions/:emoji', async (req: Request, res: Response) => {
  try {
    const daoId = getDaoId(req);
    const { messageId, emoji: encodedEmoji } = (req as any).params;
    
    const userId = getUserId(req);

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

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/v1/daos/:daoId/chat/upload
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/upload', upload.single('file'), async (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { daoId } = req.params as ChatParams;
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

    if (!req.file.mimetype || !req.file.size || req.file.size === 0) {
      return res.status(400).json({ error: 'Invalid file data' });
    }

    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'File exceeds maximum size of 10MB' });
    }

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

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/v1/daos/:daoId/chat/attachments/:attachmentId
// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/v1/daos/:daoId/chat/attachments/:attachmentId
// ═══════════════════════════════════════════════════════════════════════════════
router.delete('/attachments/:attachmentId', async (req: Request, res: Response) => {
  try {
    const daoId = getDaoId(req);
    const { attachmentId } = (req as any).params;
    
    const userId = getUserId(req);

    await chatService.deleteAttachment(attachmentId, userId);

    // Delete file from disk (async, non-blocking)
    const attachment = await chatService.getAttachment(attachmentId!);
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

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/v1/daos/:daoId/chat/typing
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/typing', async (req: Request, res: Response) => {
  try {
    const daoId = getDaoId(req);
    const { isTyping } = req.body;
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Broadcast typing indicator via WebSocket
    const webSocketService = req.app?.locals?.webSocketService;
    if (webSocketService) {
      webSocketService.handleTyping({
        daoId,
        userId,
        isTyping,
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating typing status:', error);
    res.status(500).json({ error: 'Failed to update typing status' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/daos/:daoId/chat/presence
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/presence', async (req: Request, res: Response) => {
  try {
    const daoId = getDaoId(req);
    const webSocketService = req.app?.locals?.webSocketService;

    const onlineUserIds = webSocketService?.getOnlineUsers(daoId) || [];
    const typingUserIds = webSocketService?.getTypingUsers(daoId) || [];

    res.json({
      onlineUsers: onlineUserIds.map((id: string) => ({ id })),
      typingUsers: typingUserIds.map((id: string) => ({ id })),
    });
  } catch (error) {
    logger.error('Error fetching presence:', error);
    res.status(500).json({ error: 'Failed to fetch presence' });
  }
});

export default router;
