import express, { Request, Response } from 'express';
import { isAuthenticated } from '../nextAuthMiddleware';
import { db } from '../db';
import { messages, users } from '../../shared/schema';
import { eq, and, or, desc, lt } from 'drizzle-orm';

const router = express.Router();

// Feature flag check
const isMessagingEnabled = process.env.ENABLE_MESSAGING === 'true' || true;

// Send a message
router.post('/send', isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!isMessagingEnabled) {
      return res.status(403).json({ error: 'Messaging feature is disabled' });
    }

    const { recipientId, content, daoId } = req.body;
    const senderId = (req.user as any)?.id;

    if (!senderId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!recipientId || !content) {
      return res.status(400).json({ error: 'Missing recipientId or content' });
    }

    if (senderId === recipientId) {
      return res.status(400).json({ error: 'Cannot message yourself' });
    }

    // Validate recipient exists
    const recipient = await db.query.users.findFirst({
      where: eq(users.id, recipientId),
    });

    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    // Create message
    const message = await db.insert(messages).values({
      senderId,
      recipientId,
      content: content.trim().substring(0, 5000), // Max 5000 chars
      daoId: daoId || null,
      isRead: false,
    }).returning();

    res.json({ success: true, message: message[0] });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get conversation with a user (paginated)
router.get('/conversation/:userId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!isMessagingEnabled) {
      return res.status(403).json({ error: 'Messaging feature is disabled' });
    }

    const { userId } = req.params;
    const currentUserId = (req.user as any)?.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!currentUserId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get messages between two users, ordered by newest first
    const conversation = await db.query.messages.findMany({
      where: or(
        and(eq(messages.senderId, currentUserId), eq(messages.recipientId, userId)),
        and(eq(messages.senderId, userId), eq(messages.recipientId, currentUserId))
      ),
      orderBy: desc(messages.createdAt),
      limit,
      offset,
      with: {
        sender: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profileImageUrl: true,
          },
        },
      },
    });

    // Mark messages as read
    await db.update(messages)
      .set({ isRead: true })
      .where(
        and(
          eq(messages.recipientId, currentUserId),
          eq(messages.senderId, userId)
        )
      );

    // Return in chronological order (oldest first)
    res.json({ success: true, messages: conversation.reverse() });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Get all conversations (list of unique users with last message)
router.get('/conversations', isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!isMessagingEnabled) {
      return res.status(403).json({ error: 'Messaging feature is disabled' });
    }

    const currentUserId = (req.user as any)?.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    if (!currentUserId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get all messages for current user
    const userMessages = await db.query.messages.findMany({
      where: or(
        eq(messages.senderId, currentUserId),
        eq(messages.recipientId, currentUserId)
      ),
      orderBy: desc(messages.createdAt),
      with: {
        sender: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profileImageUrl: true,
          },
        },
        recipient: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profileImageUrl: true,
          },
        },
      },
    });

    // Group by conversation partner
    const conversationMap = new Map<string, any>();
    
    for (const msg of userMessages) {
      const partnerId = msg.senderId === currentUserId ? msg.recipientId : msg.senderId;
      
      if (!conversationMap.has(partnerId)) {
        const partner = msg.senderId === currentUserId ? msg.recipient : msg.sender;
        conversationMap.set(partnerId, {
          userId: partnerId,
          user: partner,
          lastMessage: msg.content.substring(0, 100),
          lastMessageTime: msg.createdAt,
          unreadCount: msg.senderId === currentUserId ? 0 : msg.isRead ? 0 : 1,
        });
      } else if (!msg.isRead && msg.recipientId === currentUserId) {
        const conv = conversationMap.get(partnerId);
        conv.unreadCount += 1;
      }
    }

    const conversations = Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime())
      .slice(0, limit);

    res.json({ success: true, conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get unread message count
router.get('/unread-count', isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!isMessagingEnabled) {
      return res.status(403).json({ error: 'Messaging feature is disabled' });
    }

    const currentUserId = (req.user as any)?.id;

    if (!currentUserId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const unreadMessages = await db.query.messages.findMany({
      where: and(
        eq(messages.recipientId, currentUserId),
        eq(messages.isRead, false)
      ),
    });

    res.json({ success: true, unreadCount: unreadMessages.length });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Delete a message (soft delete - just mark as deleted)
router.delete('/:messageId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!isMessagingEnabled) {
      return res.status(403).json({ error: 'Messaging feature is disabled' });
    }

    const { messageId } = req.params;
    const currentUserId = (req.user as any)?.id;

    if (!currentUserId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Find message and verify ownership
    const message = await db.query.messages.findFirst({
      where: eq(messages.id, messageId),
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.senderId !== currentUserId) {
      return res.status(403).json({ error: 'Can only delete your own messages' });
    }

    // Soft delete (set content to empty/deleted marker)
    await db.update(messages)
      .set({ content: '[deleted]' })
      .where(eq(messages.id, messageId));

    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;
