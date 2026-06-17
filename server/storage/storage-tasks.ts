import { db } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { tasks, notifications, notificationPreferences, notificationHistory, taskAttachments, notificationMetadata } from '../../shared/schema';

// Type aliases
type Task = typeof tasks.$inferSelect;
type InsertTask = typeof tasks.$inferInsert;

/**
 * Storage module for tasks and notifications
 * Handles: Task CRUD, claiming, notifications, preferences, history
 */
export class TaskStorage {
  private db = db;

  /**
   * Get tasks with optional filtering
   * ⚠️ PERSISTENCE GAP: No task dependencies or attachment support
   */
  async getTasks(daoId?: string, status?: string): Promise<any> {
    let whereClause;
    
    if (daoId && status) {
      whereClause = and(eq(tasks.daoId, daoId), eq(tasks.status, status));
    } else if (daoId) {
      whereClause = eq(tasks.daoId, daoId);
    } else if (status) {
      whereClause = eq(tasks.status, status);
    }

    if (whereClause) {
      return await this.db.select().from(tasks)
        .where(whereClause)
        .orderBy(desc(tasks.createdAt));
    }
    
    return await this.db.select().from(tasks)
      .orderBy(desc(tasks.createdAt));
  }

  /**
   * Create a new task
   */
  async createTask(task: any): Promise<any> {
    if (!task.title || !task.daoId) {
      throw new Error('Task must have title and daoId');
    }
    task.createdAt = new Date();
    task.updatedAt = new Date();
    const result = await this.db.insert(tasks)
      .values(task)
      .returning();
    if (!result[0]) throw new Error('Failed to create task');
    return result[0];
  }

  /**
   * Update a task
   */
  async updateTask(id: string, data: any, userId: string): Promise<Task> {
    const task = await this.db.select().from(tasks)
      .where(eq(tasks.id, id));
    
    if (!task[0]) throw new Error('Task not found');
    
    // Note: Would need getDaoMembership for proper admin check
    // For now, just update
    const result = await this.db.update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    
    if (!result[0]) throw new Error('Failed to update task');
    return result[0];
  }

  /**
   * Claim a task
   */
  async claimTask(taskId: string, userId: string): Promise<any> {
    if (!taskId || !userId) {
      throw new Error('Task ID and User ID required');
    }
    
    const task = await this.db.select().from(tasks)
      .where(eq(tasks.id, taskId));
    
    if (!task[0]) throw new Error('Task not found');
    if (task[0].claimedBy) throw new Error('Task already claimed');
    
    const result = await this.db.update(tasks)
      .set({ claimedBy: userId, status: 'claimed', updatedAt: new Date() })
      .where(eq(tasks.id, taskId))
      .returning();
    
    if (!result[0]) throw new Error('Failed to claim task');
    return result[0];
  }

  /**
   * Count tasks in a DAO with optional status filter
   */
  async getTaskCount(daoId: string, status?: string): Promise<number> {
    if (!daoId) throw new Error('DAO ID required');
    
    let whereClause;
    if (status) {
      whereClause = and(eq(tasks.daoId, daoId), eq(tasks.status, status));
    } else {
      whereClause = eq(tasks.daoId, daoId);
    }
    
    const result = await this.db.select().from(tasks)
      .where(whereClause);
    return result.length;
  }

  /**
   * Create a notification
   */
  async createNotification(data: any): Promise<any> {
    try {
      const [notification] = await this.db.insert(notifications).values({
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        priority: data.priority || 'medium',
        metadata: data.metadata || {},
        read: false,
      }).returning();

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Create multiple notifications in bulk
   */
  async createBulkNotifications(
    userIds: string[], 
    notificationData: any
  ): Promise<any[]> {
    try {
      const notificationsToInsert = userIds.map(userId => ({
        userId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        priority: notificationData.priority || 'medium',
        metadata: notificationData.metadata || {},
        read: false,
      }));

      return await this.db.insert(notifications)
        .values(notificationsToInsert)
        .returning();
    } catch (error) {
      console.error('Error creating bulk notifications:', error);
      throw error;
    }
  }

  /**
   * Get user's notifications
   * ⚠️ PERSISTENCE GAP: Metadata is JSON blob, no structured fields
   */
  async getUserNotifications(
    userId: string, 
    read?: boolean, 
    limit = 20, 
    offset = 0, 
    type?: string
  ): Promise<any[]> {
    try {
      let whereClause: any = eq(notifications.userId, userId);
      if (read !== undefined) {
        whereClause = and(whereClause, eq(notifications.read, read));
      }
      if (type) {
        whereClause = and(whereClause, eq(notifications.type, type));
      }
      
      return await this.db.select().from(notifications)
        .where(whereClause)
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      console.error('Error fetching user notifications:', error);
      return [];
    }
  }

  /**
   * Get count of unread notifications
   */
  async getUnreadNotificationCount(userId: string): Promise<number> {
    try {
      const result = await this.db.select({ count: sql`count(*)` })
        .from(notifications)
        .where(and(
          eq(notifications.userId, userId),
          eq(notifications.read, false)
        ));

      return Number(result[0]?.count) || 0;
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      return 0;
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string, userId: string): Promise<any> {
    try {
      const [notification] = await this.db.update(notifications)
        .set({ read: true, updatedAt: new Date() })
        .where(and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        ))
        .returning();

      return notification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return null;
    }
  }

  /**
   * Mark all user notifications as read
   */
  async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      await this.db.update(notifications)
        .set({ read: true, updatedAt: new Date() })
        .where(and(
          eq(notifications.userId, userId),
          eq(notifications.read, false)
        ));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.db.delete(notifications)
        .where(and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        ));
      return !!result;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserNotificationPreferences(userId: string): Promise<any> {
    try {
      const [preferences] = await this.db.select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId));

      if (!preferences) {
        const [newPreferences] = await this.db.insert(notificationPreferences)
          .values({
            userId,
            emailNotifications: true,
            pushNotifications: true,
            daoUpdates: true,
            proposalUpdates: true,
            taskUpdates: true,
          })
          .returning();

        return newPreferences;
      }

      return preferences;
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      throw error;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserNotificationPreferences(userId: string, updates: any): Promise<any> {
    try {
      const [preferences] = await this.db.update(notificationPreferences)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(notificationPreferences.userId, userId))
        .returning();

      return preferences;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  /**
   * Create notification history entry
   */
  async createNotificationHistory(
    userId: string, 
    type: string, 
    title: string, 
    message: string, 
    metadata?: any
  ): Promise<any> {
    const result = await this.db.insert(notificationHistory).values({
      userId,
      type,
      title,
      message,
      metadata,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }

  /**
   * Get user notification history
   */
  async getUserNotificationHistory(
    userId: string, 
    { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {}
  ): Promise<any[]> {
    return await this.db.select()
      .from(notificationHistory)
      .where(eq(notificationHistory.userId, userId))
      .orderBy(desc(notificationHistory.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Attach file to task (Gap #2: Task attachments persistence)
   */
  async attachFileToTask(taskId: string, fileData: any): Promise<any> {
    if (!taskId || !fileData.fileUrl || !fileData.fileName) {
      throw new Error('Task ID, file URL, and file name required');
    }
    const result = await this.db.insert(taskAttachments).values({
      taskId,
      fileUrl: fileData.fileUrl,
      fileName: fileData.fileName,
      mimeType: fileData.mimeType,
      fileSize: fileData.fileSize,
      uploadedBy: fileData.uploadedBy,
      attachmentType: fileData.attachmentType || 'document',
      isProof: fileData.isProof || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  /**
   * Get task attachments
   */
  async getTaskAttachments(taskId: string): Promise<any[]> {
    if (!taskId) throw new Error('Task ID required');
    return await this.db.select().from(taskAttachments)
      .where(eq(taskAttachments.taskId, taskId))
      .orderBy(desc(taskAttachments.createdAt));
  }

  /**
   * Delete task attachment
   */
  async deleteTaskAttachment(attachmentId: string): Promise<boolean> {
    if (!attachmentId) throw new Error('Attachment ID required');
    const result = await this.db.delete(taskAttachments)
      .where(eq(taskAttachments.id, attachmentId));
    return (result?.rowCount ?? 0) > 0;
  }

  /**
   * Update attachment verification status
   */
  async updateAttachmentStatus(attachmentId: string, verificationStatus: string): Promise<any> {
    if (!attachmentId || !verificationStatus) throw new Error('Attachment ID and status required');
    const result = await this.db.update(taskAttachments)
      .set({ verificationStatus, updatedAt: new Date() })
      .where(eq(taskAttachments.id, attachmentId))
      .returning();
    return result[0];
  }

  /**
   * Create notification metadata (Medium Gap #4: Notification metadata)
   */
  async createNotificationMetadata(metadataData: any): Promise<any> {
    if (!metadataData.userId || !metadataData.notificationType) {
      throw new Error('User ID and notification type required');
    }
    const result = await this.db.insert(notificationMetadata).values({
      notificationId: metadataData.notificationId,
      userId: metadataData.userId,
      daoId: metadataData.daoId,
      notificationType: metadataData.notificationType,
      sourceEntityType: metadataData.sourceEntityType,
      sourceEntityId: metadataData.sourceEntityId,
      actionUrl: metadataData.actionUrl,
      priority: metadataData.priority || 'normal',
      isRead: false,
      deliveryChannels: metadataData.deliveryChannels || [],
      deliveryStatus: metadataData.deliveryStatus || {},
      customData: metadataData.customData,
      expiresAt: metadataData.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  /**
   * Get notification metadata
   */
  async getNotificationMetadata(userId: string, options: any = {}): Promise<any[]> {
    if (!userId) throw new Error('User ID required');
    const { limit = 50, offset = 0, notificationType } = options;
    
    let whereClause = eq(notificationMetadata.userId, userId);
    if (notificationType) {
      whereClause = and(whereClause, eq(notificationMetadata.notificationType, notificationType));
    }

    return await this.db.select().from(notificationMetadata)
      .where(whereClause)
      .orderBy(desc(notificationMetadata.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Mark notification metadata as read
   */
  async markNotificationMetadataAsRead(metadataId: string): Promise<any> {
    if (!metadataId) throw new Error('Metadata ID required');
    const result = await this.db.update(notificationMetadata)
      .set({
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(notificationMetadata.id, metadataId))
      .returning();
    return result[0];
  }

  /**
   * Record notification action
   */
  async recordNotificationAction(metadataId: string, actionTaken: string): Promise<any> {
    if (!metadataId || !actionTaken) throw new Error('Metadata ID and action required');
    const result = await this.db.update(notificationMetadata)
      .set({
        isActioned: true,
        actionedAt: new Date(),
        actionTaken,
        updatedAt: new Date(),
      })
      .where(eq(notificationMetadata.id, metadataId))
      .returning();
    return result[0];
  }

  /**
   * Get high-priority notifications
   */
  async getHighPriorityNotifications(userId: string): Promise<any[]> {
    if (!userId) throw new Error('User ID required');
    return await this.db.select().from(notificationMetadata)
      .where(and(
        eq(notificationMetadata.userId, userId),
        eq(notificationMetadata.priority, 'urgent')
      ))
      .orderBy(desc(notificationMetadata.createdAt));
  }

  /**
   * Get unactioned notifications
   */
  async getUnactionedNotifications(userId: string): Promise<any[]> {
    if (!userId) throw new Error('User ID required');
    return await this.db.select().from(notificationMetadata)
      .where(and(
        eq(notificationMetadata.userId, userId),
        eq(notificationMetadata.isActioned, false)
      ))
      .orderBy(desc(notificationMetadata.priority));
  }
}

// Export singleton instance
export const taskStorage = new TaskStorage();
