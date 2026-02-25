/**
 * Low-Priority Persistence Gaps - Storage Module
 * Implements storage methods for all 10 low-priority gaps
 */

import { db } from '../db';
import { eq, and, desc, sql, inArray, or } from 'drizzle-orm';
import {
  // activityFeed tables
  activityFeed,
  // notificationHistory already in schema
  notificationHistory,
  sessionAuditLogs,
  auditLogs,
  systemLogs,
  // API Keys for Developer Integration
  apiKeys,
  // User Preferences for Different Features
  featurePreferences,
  // Users and DAOs
  users,
  daos
} from '../../shared/schema';

/**
 * Storage module for low-priority persistence gaps
 * Handles: Snapshots, activity feeds, messages, types, flags, analytics, API keys, preferences, cache, audit
 */
export class LowPriorityStorage {
  private db = db;

  // ===== GAP #1: SNAPSHOT HISTORY =====

  async createSnapshotHistory(snapshotData: any): Promise<any> {
    if (!snapshotData.daoId || !snapshotData.snapshotType || !snapshotData.dataSnapshot) {
      throw new Error('DAO ID, snapshot type, and data snapshot required');
    }
    const result = await this.db.insert(snapshotHistory).values({
      daoId: snapshotData.daoId,
      snapshotType: snapshotData.snapshotType,
      snapshotName: snapshotData.snapshotName,
      description: snapshotData.description,
      blockNumber: snapshotData.blockNumber,
      blockTimestamp: snapshotData.blockTimestamp,
      dataSnapshot: snapshotData.dataSnapshot,
      createdBy: snapshotData.createdBy,
      metadata: snapshotData.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async getSnapshotHistory(daoId: string, snapshotType?: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    if (!daoId) throw new Error('DAO ID required');
    let whereClause = eq(snapshotHistory.daoId, daoId);
    if (snapshotType) {
      whereClause = and(whereClause, eq(snapshotHistory.snapshotType, snapshotType));
    }
    return await this.db.select().from(snapshotHistory)
      .where(whereClause)
      .orderBy(desc(snapshotHistory.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getSnapshotById(snapshotId: string): Promise<any> {
    if (!snapshotId) throw new Error('Snapshot ID required');
    const result = await this.db.select().from(snapshotHistory)
      .where(eq(snapshotHistory.id, snapshotId));
    return result[0];
  }

  // ===== GAP #2: ACTIVITY FEEDS =====

  async createActivityFeed(feedData: any): Promise<any> {
    if (!feedData.userId || !feedData.activityType || !feedData.entityType || !feedData.entityId) {
      throw new Error('User ID, activity type, entity type, and entity ID required');
    }
    const result = await this.db.insert(activityFeed).values({
      userId: feedData.userId,
      daoId: feedData.daoId,
      activityType: feedData.activityType,
      entityType: feedData.entityType,
      entityId: feedData.entityId,
      entityTitle: feedData.entityTitle,
      actorId: feedData.actorId,
      description: feedData.description,
      metadata: feedData.metadata,
      isPublic: feedData.isPublic !== false,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }

  async getUserActivityFeed(userId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    if (!userId) throw new Error('User ID required');
    return await this.db.select().from(activityFeed)
      .where(eq(activityFeed.userId, userId))
      .orderBy(desc(activityFeed.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getDaoActivityFeed(daoId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    if (!daoId) throw new Error('DAO ID required');
    return await this.db.select().from(activityFeed)
      .where(eq(activityFeed.daoId, daoId))
      .orderBy(desc(activityFeed.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getActivityFeedByType(activityType: string, limit: number = 50): Promise<any[]> {
    if (!activityType) throw new Error('Activity type required');
    return await this.db.select().from(activityFeed)
      .where(eq(activityFeed.activityType, activityType))
      .orderBy(desc(activityFeed.createdAt))
      .limit(limit);
  }

  // ===== GAP #3: MESSAGE LOGS =====

  async createMessageLog(messageData: any): Promise<any> {
    if (!messageData.senderId || !messageData.recipientId || !messageData.content) {
      throw new Error('Sender ID, recipient ID, and content required');
    }
    const result = await this.db.insert(messageLogs).values({
      senderId: messageData.senderId,
      recipientId: messageData.recipientId,
      daoId: messageData.daoId,
      content: messageData.content,
      contentType: messageData.contentType || 'text',
      threadId: messageData.threadId,
      replyToId: messageData.replyToId,
      attachmentUrls: messageData.attachmentUrls,
      metadata: messageData.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async getConversation(userId1: string, userId2: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    if (!userId1 || !userId2) throw new Error('Both user IDs required');
    return await this.db.select().from(messageLogs)
      .where(and(
        or(
          and(eq(messageLogs.senderId, userId1), eq(messageLogs.recipientId, userId2)),
          and(eq(messageLogs.senderId, userId2), eq(messageLogs.recipientId, userId1))
        ),
        eq(messageLogs.isDeleted, false)
      ))
      .orderBy(desc(messageLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async markMessagesAsRead(userId: string, senderId: string): Promise<any> {
    if (!userId || !senderId) throw new Error('User ID and sender ID required');
    const result = await this.db.update(messageLogs)
      .set({
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(messageLogs.recipientId, userId),
        eq(messageLogs.senderId, senderId)
      ))
      .returning();
    return result;
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    if (!userId) throw new Error('User ID required');
    const result = await this.db.select({ count: sql<number>`count(*)` })
      .from(messageLogs)
      .where(and(
        eq(messageLogs.recipientId, userId),
        eq(messageLogs.isRead, false)
      ));
    return result[0]?.count || 0;
  }

  // ===== GAP #4: TYPE DEFINITIONS =====

  async createTypeDefinition(typeData: any): Promise<any> {
    if (!typeData.daoId || !typeData.entityType || !typeData.typeName) {
      throw new Error('DAO ID, entity type, and type name required');
    }
    const result = await this.db.insert(typeDefinitions).values({
      daoId: typeData.daoId,
      entityType: typeData.entityType,
      typeName: typeData.typeName,
      displayName: typeData.displayName,
      description: typeData.description,
      schema: typeData.schema,
      requiredFields: typeData.requiredFields,
      defaultValues: typeData.defaultValues,
      icon: typeData.icon,
      color: typeData.color,
      category: typeData.category,
      sortOrder: typeData.sortOrder || 0,
      createdBy: typeData.createdBy,
      metadata: typeData.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async getTypeDefinitions(daoId: string, entityType: string): Promise<any[]> {
    if (!daoId || !entityType) throw new Error('DAO ID and entity type required');
    return await this.db.select().from(typeDefinitions)
      .where(and(
        eq(typeDefinitions.daoId, daoId),
        eq(typeDefinitions.entityType, entityType)
      ))
      .orderBy(sql`sort_order ASC`);
  }

  async getTypeDefinitionById(typeId: string): Promise<any> {
    if (!typeId) throw new Error('Type ID required');
    const result = await this.db.select().from(typeDefinitions)
      .where(eq(typeDefinitions.id, typeId));
    return result[0];
  }

  // ===== GAP #5: FEATURE FLAGS =====

  async createFeatureFlag(flagData: any): Promise<any> {
    if (!flagData.flagName || !flagData.scope) {
      throw new Error('Flag name and scope required');
    }
    const result = await this.db.insert(featureFlags).values({
      flagName: flagData.flagName,
      displayName: flagData.displayName,
      description: flagData.description,
      scope: flagData.scope,
      daoId: flagData.daoId,
      userId: flagData.userId,
      isEnabled: flagData.isEnabled || false,
      rolloutPercentage: flagData.rolloutPercentage || 0,
      flagType: flagData.flagType || 'boolean',
      flagValue: flagData.flagValue,
      category: flagData.category,
      expiresAt: flagData.expiresAt,
      metadata: flagData.metadata,
      createdBy: flagData.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async getFeatureFlag(flagName: string, context?: { daoId?: string; userId?: string }): Promise<any> {
    if (!flagName) throw new Error('Flag name required');
    let whereClause = eq(featureFlags.flagName, flagName);
    
    // If context provided, filter by scope
    if (context?.daoId) {
      whereClause = and(whereClause, eq(featureFlags.daoId, context.daoId));
    }
    if (context?.userId) {
      whereClause = and(whereClause, eq(featureFlags.userId, context.userId));
    }

    const result = await this.db.select().from(featureFlags)
      .where(whereClause);
    return result[0];
  }

  async updateFeatureFlag(flagId: string, updates: any): Promise<any> {
    if (!flagId) throw new Error('Flag ID required');
    const result = await this.db.update(featureFlags)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(featureFlags.id, flagId))
      .returning();
    return result[0];
  }

  // ===== GAP #6: ANALYTICS EVENTS =====

  async logAnalyticsEvent(eventData: any): Promise<any> {
    if (!eventData.eventName || !eventData.eventCategory) {
      throw new Error('Event name and category required');
    }
    const result = await this.db.insert(analyticsEvents).values({
      eventName: eventData.eventName,
      eventCategory: eventData.eventCategory,
      userId: eventData.userId,
      daoId: eventData.daoId,
      sessionId: eventData.sessionId,
      eventValue: eventData.eventValue,
      eventLabel: eventData.eventLabel,
      pageUrl: eventData.pageUrl,
      referrer: eventData.referrer,
      userAgent: eventData.userAgent,
      ipAddress: eventData.ipAddress,
      properties: eventData.properties,
      metadata: eventData.metadata,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }

  async getAnalyticsEvents(filters: any, limit: number = 1000): Promise<any[]> {
    let whereClause = null;
    
    if (filters.eventName) {
      whereClause = eq(analyticsEvents.eventName, filters.eventName);
    }
    if (filters.userId) {
      whereClause = whereClause 
        ? and(whereClause, eq(analyticsEvents.userId, filters.userId))
        : eq(analyticsEvents.userId, filters.userId);
    }
    if (filters.daoId) {
      whereClause = whereClause 
        ? and(whereClause, eq(analyticsEvents.daoId, filters.daoId))
        : eq(analyticsEvents.daoId, filters.daoId);
    }

    return await this.db.select().from(analyticsEvents)
      .where(whereClause)
      .orderBy(desc(analyticsEvents.createdAt))
      .limit(limit);
  }

  // ===== GAP #7: API KEYS =====

  async createApiKey(keyData: any): Promise<any> {
    if (!keyData.userId || !keyData.keyName || !keyData.keyPrefix || !keyData.keyHash) {
      throw new Error('User ID, key name, key prefix, and key hash required');
    }
    const result = await this.db.insert(apiKeys).values({
      userId: keyData.userId,
      keyName: keyData.keyName,
      keyPrefix: keyData.keyPrefix,
      keyHash: keyData.keyHash,
      permissions: keyData.permissions,
      allowedIps: keyData.allowedIps,
      allowedOrigins: keyData.allowedOrigins,
      rateLimitRequests: keyData.rateLimitRequests,
      rateLimitWindow: keyData.rateLimitWindow || 3600,
      expiresAt: keyData.expiresAt,
      description: keyData.description,
      metadata: keyData.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async getApiKeysByUser(userId: string): Promise<any[]> {
    if (!userId) throw new Error('User ID required');
    return await this.db.select().from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async updateApiKeyUsage(keyId: string): Promise<any> {
    if (!keyId) throw new Error('Key ID required');
    const result = await this.db.update(apiKeys)
      .set({
        usageCount: sql`${apiKeys.usageCount} + 1`,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, keyId))
      .returning();
    return result[0];
  }

  // ===== GAP #8: USER PREFERENCES =====

  async createOrUpdateUserPreferences(userId: string, preferences: any): Promise<any> {
    if (!userId) throw new Error('User ID required');
    
    // Try to update first, if no rows affected, insert
    const updateResult = await this.db.update(userPreferences)
      .set({
        ...preferences,
        updatedAt: new Date(),
      })
      .where(eq(userPreferences.userId, userId))
      .returning();

    if (updateResult.length > 0) return updateResult[0];

    // If update didn't find anything, insert
    const insertResult = await this.db.insert(userPreferences).values({
      userId,
      ...preferences,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return insertResult[0];
  }

  async getUserPreferences(userId: string): Promise<any> {
    if (!userId) throw new Error('User ID required');
    const result = await this.db.select().from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    return result[0];
  }

  // ===== GAP #9: CACHING METADATA =====

  async recordCacheHit(cacheKey: string): Promise<any> {
    if (!cacheKey) throw new Error('Cache key required');
    const result = await this.db.update(cachingMetadata)
      .set({
        hitCount: sql`${cachingMetadata.hitCount} + 1`,
        lastAccessedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(cachingMetadata.cacheKey, cacheKey))
      .returning();
    return result[0];
  }

  async recordCacheMiss(cacheKey: string): Promise<any> {
    if (!cacheKey) throw new Error('Cache key required');
    const result = await this.db.update(cachingMetadata)
      .set({
        missCount: sql`${cachingMetadata.missCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(cachingMetadata.cacheKey, cacheKey))
      .returning();
    return result[0];
  }

  async invalidateCache(cacheKey: string, reason: string): Promise<any> {
    if (!cacheKey) throw new Error('Cache key required');
    const result = await this.db.update(cachingMetadata)
      .set({
        isValid: false,
        invalidatedAt: new Date(),
        invalidationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(cachingMetadata.cacheKey, cacheKey))
      .returning();
    return result[0];
  }

  async getCacheMetadata(cacheKey: string): Promise<any> {
    if (!cacheKey) throw new Error('Cache key required');
    const result = await this.db.select().from(cachingMetadata)
      .where(eq(cachingMetadata.cacheKey, cacheKey));
    return result[0];
  }

  // ===== GAP #10: AUDIT EVENTS =====

  async createAuditEvent(auditData: any): Promise<any> {
    if (!auditData.action || !auditData.resourceType) {
      throw new Error('Action and resource type required');
    }
    const result = await this.db.insert(auditEvents).values({
      actorId: auditData.actorId,
      actorRole: auditData.actorRole,
      action: auditData.action,
      resourceType: auditData.resourceType,
      resourceId: auditData.resourceId,
      daoId: auditData.daoId,
      beforeValue: auditData.beforeValue,
      afterValue: auditData.afterValue,
      changesSummary: auditData.changesSummary,
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
      sessionId: auditData.sessionId,
      status: auditData.status || 'success',
      errorMessage: auditData.errorMessage,
      severity: auditData.severity || 'info',
      requiresReview: auditData.requiresReview || false,
      metadata: auditData.metadata,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }

  async getAuditEvents(daoId?: string, filters?: any, limit: number = 100): Promise<any[]> {
    let whereClause = null;
    
    if (daoId) {
      whereClause = eq(auditEvents.daoId, daoId);
    }
    if (filters?.actorId) {
      whereClause = whereClause 
        ? and(whereClause, eq(auditEvents.actorId, filters.actorId))
        : eq(auditEvents.actorId, filters.actorId);
    }
    if (filters?.resourceType) {
      whereClause = whereClause 
        ? and(whereClause, eq(auditEvents.resourceType, filters.resourceType))
        : eq(auditEvents.resourceType, filters.resourceType);
    }
    if (filters?.severity) {
      whereClause = whereClause 
        ? and(whereClause, eq(auditEvents.severity, filters.severity))
        : eq(auditEvents.severity, filters.severity);
    }

    return await this.db.select().from(auditEvents)
      .where(whereClause)
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit);
  }

  async getCriticalAuditEvents(daoId?: string, daysBack: number = 7): Promise<any[]> {
    if (!daoId) throw new Error('DAO ID required');
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);
    
    return await this.db.select().from(auditEvents)
      .where(and(
        eq(auditEvents.daoId, daoId),
        eq(auditEvents.severity, 'critical'),
        sql`"created_at" >= ${sinceDate}`
      ))
      .orderBy(desc(auditEvents.createdAt));
  }
}

// Export singleton instance
export const lowPriorityStorage = new LowPriorityStorage();
