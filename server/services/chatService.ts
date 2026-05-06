import { db } from '../db';
import { logger } from '../utils/logger';
import {
  daoMessages,
  messageReactions,
  messageAttachments,
  daoMemberships,
  users,
} from '../../shared/schema';
import { eq, and, desc, like, inArray, sql } from 'drizzle-orm';

export interface MessageFilter {
  daoId: string;
  limit?: number;
  search?: string;
}

export interface MessageWithDetails {
  id: string;
  content: string;
  userId: string;
  userName: string;
  userFirstName?: string;
  userLastName?: string;
  createdAt: Date;
  updatedAt: Date;
  messageType: string;
  replyToMessageId: string | null;
  isPinned: boolean;
  pinnedAt: Date | null;
  pinnedBy: string | null;
  reactions: Record<string, { count: number; users: any[] }>;
  attachment: any;
  replyTo: any;
}

export class ChatService {
  /**
   * Verify user is a member of the DAO
   * @throws Error if user is not a member of the DAO
   */
  async verifyDAOMembership(daoId: string, userId: string): Promise<void> {
    const membership = await db
      .select({ id: daoMemberships.id })
      .from(daoMemberships)
      .where(
        and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, userId)
        )
      )
      .limit(1);

    if (!membership.length) {
      throw new Error('User is not a member of this DAO');
    }
  }

  /**
   * Get messages for a DAO with full details including reactions, attachments, and replies
   */
  async getDAOMessages(filter: MessageFilter): Promise<MessageWithDetails[]> {
    const { daoId, limit = 50, search } = filter;

    let whereCondition: any = eq(daoMessages.daoId, daoId);

    if (search && search.trim().length > 0) {
      whereCondition = and(whereCondition, like(daoMessages.content, `%${search}%`));
    }

    // Parse limit and ensure it doesn't exceed max
    const parsedLimit = Math.min(Math.max(1, parseInt(limit as any) || 50), 1000);

    // Fetch messages
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
      .limit(parsedLimit);

    if (messages.length === 0) {
      return [];
    }

    // Fetch reactions for all messages
    const messageIds = messages.map((m) => m.id);
    const reactions = await db
      .select({
        messageId: messageReactions.messageId,
        emoji: messageReactions.emoji,
        userId: messageReactions.userId,
        userName: users.username,
      })
      .from(messageReactions)
      .leftJoin(users, eq(messageReactions.userId, users.id))
      .where(inArray(messageReactions.messageId, messageIds));

    // Fetch attachments for all messages
    const attachments = await db
      .select()
      .from(messageAttachments)
      .where(inArray(messageAttachments.messageId, messageIds));

    // Fetch reply-to messages
    const replyToMessageIds = messages
      .filter((m) => m.replyToMessageId)
      .map((m) => m.replyToMessageId as string);

    const replyToMessages =
      replyToMessageIds.length > 0
        ? await db
            .select({
              id: daoMessages.id,
              content: daoMessages.content,
              userName: users.username,
            })
            .from(daoMessages)
            .leftJoin(users, eq(daoMessages.userId, users.id))
            .where(inArray(daoMessages.id, replyToMessageIds))
        : [];

    // Build reaction groups
    const reactionGroups = reactions.reduce(
      (acc, r) => {
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
      },
      {} as Record<string, Record<string, { count: number; users: any[] }>>
    );

    // Enhance messages with related data
    return messages.map((msg) => ({
      ...msg,
      userName: msg.userName || `${msg.userFirstName || ''} ${msg.userLastName || ''}`.trim() || 'Anonymous',
      userFirstName: msg.userFirstName || undefined,
      userLastName: msg.userLastName || undefined,
      reactions: reactionGroups[msg.id] || {},
      attachment: attachments.find((a) => a.messageId === msg.id) || null,
      isPinned: msg.isPinned || false,
      replyTo: msg.replyToMessageId
        ? replyToMessages.find((r) => r.id === msg.replyToMessageId) || null
        : null,
    })) as MessageWithDetails[];
  }

  /**
   * Create a new message in a DAO
   * @throws Error if user is not a DAO member or validation fails
   */
  async createMessage(
    daoId: string,
    userId: string,
    content: string,
    messageType: string = 'text',
    replyToMessageId?: string
  ): Promise<any> {
    // Verify DAO membership
    await this.verifyDAOMembership(daoId, userId);

    // Validate content
    if (!content || content.trim().length === 0) {
      throw new Error('Message content cannot be empty');
    }

    if (content.length > 5000) {
      throw new Error('Message exceeds maximum length of 5000 characters');
    }

    // Validate replyToMessageId if provided
    if (replyToMessageId) {
      const replyToMessage = await db
        .select({ id: daoMessages.id })
        .from(daoMessages)
        .where(
          and(
            eq(daoMessages.id, replyToMessageId),
            eq(daoMessages.daoId, daoId)
          )
        )
        .limit(1);

      if (!replyToMessage.length) {
        throw new Error('Reply-to message not found in this DAO');
      }
    }

    // Create message
    const [newMessage] = await db
      .insert(daoMessages)
      .values({
        daoId,
        userId,
        content: content.trim(),
        messageType,
        replyToMessageId: replyToMessageId || null,
      })
      .returning();

    return newMessage;
  }

  /**
   * Delete a message (only by creator or DAO admin)
   */
  async deleteMessage(daoId: string, messageId: string, userId: string): Promise<void> {
    // Get the message
    const message = await db
      .select({ userId: daoMessages.userId, daoId: daoMessages.daoId })
      .from(daoMessages)
      .where(
        and(
          eq(daoMessages.id, messageId),
          eq(daoMessages.daoId, daoId)
        )
      )
      .limit(1);

    if (!message.length) {
      throw new Error('Message not found');
    }

    // Only author can delete (TODO: add admin override)
    if (message[0].userId !== userId) {
      throw new Error('Not authorized to delete this message');
    }

    // Delete message (which cascades to reactions and attachments)
    await db.delete(daoMessages).where(eq(daoMessages.id, messageId));
  }

  /**
   * Update (edit) a message
   */
  async editMessage(daoId: string, messageId: string, userId: string, newContent: string): Promise<any> {
    // Validate new content
    if (!newContent || newContent.trim().length === 0) {
      throw new Error('Message content cannot be empty');
    }

    if (newContent.length > 5000) {
      throw new Error('Message exceeds maximum length of 5000 characters');
    }

    // Get the message
    const message = await db
      .select({ userId: daoMessages.userId, daoId: daoMessages.daoId })
      .from(daoMessages)
      .where(
        and(
          eq(daoMessages.id, messageId),
          eq(daoMessages.daoId, daoId)
        )
      )
      .limit(1);

    if (!message.length) {
      throw new Error('Message not found');
    }

    // Only author can edit
    if (message[0].userId !== userId) {
      throw new Error('Not authorized to edit this message');
    }

    // Update message
    await db
      .update(daoMessages)
      .set({
        content: newContent.trim(),
        updatedAt: new Date(),
      })
      .where(eq(daoMessages.id, messageId));

    // Return updated message
    return db
      .select()
      .from(daoMessages)
      .where(eq(daoMessages.id, messageId))
      .limit(1);
  }

  /**
   * Add or remove (toggle) a reaction to a message
   */
  async toggleReaction(daoId: string, messageId: string, userId: string, emoji: string): Promise<any> {
    // Validate emoji
    if (!emoji || emoji.trim().length === 0) {
      throw new Error('Valid emoji is required');
    }

    // Verify message exists in this DAO
    const message = await db
      .select({ id: daoMessages.id })
      .from(daoMessages)
      .where(
        and(
          eq(daoMessages.id, messageId),
          eq(daoMessages.daoId, daoId)
        )
      )
      .limit(1);

    if (!message.length) {
      throw new Error('Message not found in this DAO');
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
      return {
        success: true,
        action: 'removed',
        emoji,
      };
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
      return {
        success: true,
        action: 'added',
        emoji,
        reactionId: newReaction.id,
      };
    }
  }

  /**
   * Remove a reaction from a message
   */
  async removeReaction(daoId: string, messageId: string, userId: string, emoji: string): Promise<void> {
    // Validate emoji
    if (!emoji || emoji.trim().length === 0) {
      throw new Error('Valid emoji is required');
    }

    // Verify message exists in this DAO
    const message = await db
      .select({ id: daoMessages.id })
      .from(daoMessages)
      .where(
        and(
          eq(daoMessages.id, messageId),
          eq(daoMessages.daoId, daoId)
        )
      )
      .limit(1);

    if (!message.length) {
      throw new Error('Message not found in this DAO');
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
      throw new Error('Reaction not found');
    }

    await db
      .delete(messageReactions)
      .where(eq(messageReactions.id, reaction[0].id));

    logger.info(`User ${userId} deleted reaction ${emoji} from message ${messageId}`);
  }

  /**
   * Pin or unpin a message
   */
  async togglePinMessage(daoId: string, messageId: string, userId: string): Promise<any> {
    // Get the message
    const message = await db
      .select({
        id: daoMessages.id,
        daoId: daoMessages.daoId,
        isPinned: daoMessages.isPinned,
      })
      .from(daoMessages)
      .where(
        and(
          eq(daoMessages.id, messageId),
          eq(daoMessages.daoId, daoId)
        )
      )
      .limit(1);

    if (!message.length) {
      throw new Error('Message not found in this DAO');
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

    logger.info(`User ${userId} ${newPinStatus ? 'pinned' : 'unpinned'} message ${messageId}`);

    return {
      success: true,
      isPinned: newPinStatus,
    };
  }

  /**
   * Get attachment metadata
   */
  async getAttachment(attachmentId: string, daoId?: string): Promise<any> {
    const query = db
      .select()
      .from(messageAttachments)
      .where(eq(messageAttachments.id, attachmentId));

    const attachment = await query.limit(1);

    if (!attachment.length) {
      throw new Error('Attachment not found');
    }

    return attachment[0];
  }

  /**
   * Create attachment record
   */
  async createAttachment(
    fileName: string,
    fileSize: number,
    fileType: string,
    fileUrl: string,
    uploadedBy: string,
    messageId?: string
  ): Promise<any> {
    const valueObj: any = {
      fileName,
      fileSize,
      fileType,
      fileUrl,
      uploadedBy,
    };
    
    // Only include messageId if provided
    if (messageId) {
      valueObj.messageId = messageId;
    }

    const [attachment] = await db
      .insert(messageAttachments)
      .values(valueObj)
      .returning();

    return attachment;
  }

  /**
   * Delete attachment
   */
  async deleteAttachment(attachmentId: string, userId: string): Promise<void> {
    // Get attachment
    const attachment = await this.getAttachment(attachmentId);

    // Only allow deletion by uploader (TODO: add admin override)
    if (attachment.uploadedBy !== userId) {
      throw new Error('Not authorized to delete this attachment');
    }

    // Delete database record
    await db
      .delete(messageAttachments)
      .where(eq(messageAttachments.id, attachmentId));

    logger.info(`Attachment ${attachmentId} deleted by user ${userId}`);
  }

  /**
   * Link attachment to a message
   */
  async linkAttachmentToMessage(attachmentId: string, messageId: string, daoId: string): Promise<void> {
    // Verify message exists in this DAO
    const message = await db
      .select({ id: daoMessages.id })
      .from(daoMessages)
      .where(
        and(
          eq(daoMessages.id, messageId),
          eq(daoMessages.daoId, daoId)
        )
      )
      .limit(1);

    if (!message.length) {
      throw new Error('Message not found in this DAO');
    }

    // Update attachment with message ID
    await db
      .update(messageAttachments)
      .set({ messageId })
      .where(eq(messageAttachments.id, attachmentId));

    logger.info(`Attachment ${attachmentId} linked to message ${messageId}`);
  }
}

export const chatService = new ChatService();
