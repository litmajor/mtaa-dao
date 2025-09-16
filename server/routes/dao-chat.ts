
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { daoMessages, users, daos } from '../../shared/schema';
import { eq, desc, and, like } from 'drizzle-orm';
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
    
    let query = db
      .select({
        id: daoMessages.id,
        content: daoMessages.content,
        userId: daoMessages.userId,
        userName: users.username,
        userAvatar: users.avatar,
        createdAt: daoMessages.createdAt,
        updatedAt: daoMessages.updatedAt,
        messageType: daoMessages.messageType,
        replyToMessageId: daoMessages.replyToMessageId
      })
      .from(daoMessages)
      .leftJoin(users, eq(daoMessages.userId, users.id))
      .where(eq(daoMessages.daoId, daoId))
      .orderBy(desc(daoMessages.createdAt))
      .limit(parseInt(limit as string));
    
    if (search) {
      query = query.where(
        and(
          eq(daoMessages.daoId, daoId),
          like(daoMessages.content, `%${search}%`)
        )
      );
    }
    
    const messages = await query;
    
    // Simulate reactions and attachments (replace with real data when implemented)
    const enhancedMessages = messages.map(msg => ({
      ...msg,
      reactions: [],
      attachment: null,
      isPinned: false,
      replyTo: null // TODO: Fetch reply data if replyToMessageId exists
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
    const userId = req.user?.id;
    
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

// Add reaction to message
router.post('/messages/:messageId/reactions', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // TODO: Implement reactions table and logic
    // For now, just return success
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Typing indicator
router.post('/dao/:daoId/typing', async (req, res) => {
  try {
    const { daoId } = req.params;
    const { isTyping } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // TODO: Implement real-time typing indicators with WebSockets or SSE
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating typing status:', error);
    res.status(500).json({ error: 'Failed to update typing status' });
  }
});

// Get presence info (online users, typing indicators)
router.get('/dao/:daoId/presence', async (req, res) => {
  try {
    // TODO: Implement real presence tracking
    // For now, return mock data
    res.json({
      onlineUsers: ['Alice', 'Bob', 'Charlie'],
      typingUsers: []
    });
  } catch (error) {
    console.error('Error fetching presence:', error);
    res.status(500).json({ error: 'Failed to fetch presence' });
  }
});

export default router;
