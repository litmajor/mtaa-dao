/**
 * ⚠️  DEPRECATED - USE auditConsolidated.ts INSTEAD
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This service is being consolidated into:
 * 👉 server/services/auditConsolidated.ts
 * 
 * New code should use:
 * import { logConsolidatedAuditEvent } from '../services/auditConsolidated';
 * 
 * Existing code using this service will continue to work during transition period.
 * Migration deadline: 2026-06-01
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Audit Logging Service
 * Day 3 - Comprehensive Admin Action Audit Trail
 * 
 * POWER CHECKLIST ITEMS ADDRESSED:
 * 4. Authority Transparency: Logs who did what
 * 8. Post-Action Narrative: Complete audit trail
 * 10. Distributed Verification: All admins can query logs
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export interface AuditLogDTO {
  // Actor
  actorId: string;
  actorType?: 'admin' | 'agent' | 'system' | 'user' | 'super_admin';
  actorRole?: string;
  
  // Action
  actionType: string;
  actionCategory?: 'admin' | 'governance' | 'agent' | 'system';
  
  // Target
  targetType: string;
  targetId: string;
  targetName?: string;
  
  // State
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  changedFields?: string[];
  
  // Result
  result?: 'success' | 'failed' | 'partial';
  resultReason?: string;
  
  // Authority
  authority?: string;
  approvalChain?: string[];
  
  // Reversibility
  reversible?: boolean;
  reversalDeadline?: Date;

  // Metadata
  metadata?: Record<string, any>;

  // Context
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  sessionId?: string;
  endpoint?: string;
  
  // Relations
  revertsActionId?: string;
  relatedLogIds?: string[];
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorType: string;
  actorRole?: string;
  actionType: string;
  actionCategory: string;
  targetType: string;
  targetId: string;
  targetName?: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  changedFields?: string[];
  result: string;
  resultReason?: string;
  authority: string;
  approvalChain?: string[];
  reversible: boolean;
  reversalDeadline?: Date;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface AuditStats {
  totalActions: number;
  byActionType: Record<string, number>;
  byActor: Record<string, number>;
  byResult: Record<string, number>;
  byCategory: Record<string, number>;
  successRate: number;
  failureRate: number;
}

class AuditLoggingService {
  /**
   * Log an admin action
   */
  async logAction(dto: AuditLogDTO): Promise<AuditLog> {
    try {
      const logId = uuid();
      const now = new Date();
      const actorType = dto.actorType || 'admin';
      const actionCategory = dto.actionCategory || 'admin';
      const result = dto.result || 'success';
      const authority = dto.authority || 'admin';
      const reversible = dto.reversible !== undefined ? dto.reversible : false;

      // Build metadata
      const metadata: any = {};
      if (dto.ipAddress) metadata.ipAddress = dto.ipAddress;
      if (dto.userAgent) metadata.userAgent = dto.userAgent;
      if (dto.deviceFingerprint) metadata.deviceFingerprint = dto.deviceFingerprint;
      if (dto.sessionId) metadata.sessionId = dto.sessionId;
      if (dto.endpoint) metadata.endpoint = dto.endpoint;

      // Insert audit log
      await db.execute(sql`
        INSERT INTO audit_logs (
          id, actor_id, actor_type, actor_role, 
          action_type, action_category,
          target_type, target_id, target_name,
          before_state, after_state, changed_fields,
          result, result_reason,
          authority, approval_chain,
          reversible, reversal_deadline,
          created_at, metadata, related_logs
        ) VALUES (
          ${logId}, ${dto.actorId}, ${actorType}, ${dto.actorRole},
          ${dto.actionType}, ${actionCategory},
          ${dto.targetType}, ${dto.targetId}, ${dto.targetName},
          ${dto.beforeState ? JSON.stringify(dto.beforeState) : null},
          ${dto.afterState ? JSON.stringify(dto.afterState) : null},
          ${dto.changedFields || null},
          ${result}, ${dto.resultReason},
          ${authority}, ${dto.approvalChain || null},
          ${reversible}, ${dto.reversalDeadline},
          ${now}, ${JSON.stringify(metadata)}, ${dto.relatedLogIds || null}
        )
      `);

      return {
        id: logId,
        actorId: dto.actorId,
        actorType: actorType,
        actorRole: dto.actorRole,
        actionType: dto.actionType,
        actionCategory: actionCategory,
        targetType: dto.targetType,
        targetId: dto.targetId,
        targetName: dto.targetName,
        beforeState: dto.beforeState,
        afterState: dto.afterState,
        changedFields: dto.changedFields,
        result: result,
        resultReason: dto.resultReason,
        authority: authority,
        approvalChain: dto.approvalChain,
        reversible: reversible,
        reversalDeadline: dto.reversalDeadline,
        createdAt: now,
        metadata: metadata,
      };
    } catch (error) {
      console.error('Error logging action:', error);
      throw error;
    }
  }

  /**
   * Get all actions by a specific actor
   */
  async getActorActionLog(
    actorId: string,
    filters?: {
      actionType?: string;
      since?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<AuditLog[]> {
    try {
      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;

      let query = sql`
        SELECT * FROM audit_logs
        WHERE actor_id = ${actorId}
      `;

      if (filters?.actionType) {
        query = sql`${query} AND action_type = ${filters.actionType}`;
      }

      if (filters?.since) {
        query = sql`${query} AND created_at >= ${filters.since}`;
      }

      query = sql`${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

      const result = await db.execute(query);

      return (result.rows || []).map((row: any) => ({
        id: row.id,
        actorId: row.actor_id,
        actorType: row.actor_type,
        actorRole: row.actor_role,
        actionType: row.action_type,
        actionCategory: row.action_category,
        targetType: row.target_type,
        targetId: row.target_id,
        targetName: row.target_name,
        beforeState: row.before_state,
        afterState: row.after_state,
        changedFields: row.changed_fields,
        result: row.result,
        resultReason: row.result_reason,
        authority: row.authority,
        approvalChain: row.approval_chain,
        reversible: row.reversible,
        reversalDeadline: row.reversal_deadline,
        createdAt: new Date(row.created_at),
        metadata: row.metadata,
      }));
    } catch (error) {
      console.error('Error getting actor action log:', error);
      throw error;
    }
  }

  /**
   * Get all actions affecting a specific resource
   */
  async getResourceActionLog(
    targetType: string,
    targetId: string,
    filters?: {
      since?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<AuditLog[]> {
    try {
      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;

      let query = sql`
        SELECT * FROM audit_logs
        WHERE target_type = ${targetType} AND target_id = ${targetId}
      `;

      if (filters?.since) {
        query = sql`${query} AND created_at >= ${filters.since}`;
      }

      query = sql`${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

      const result = await db.execute(query);

      return (result.rows || []).map((row: any) => ({
        id: row.id,
        actorId: row.actor_id,
        actorType: row.actor_type,
        actorRole: row.actor_role,
        actionType: row.action_type,
        actionCategory: row.action_category,
        targetType: row.target_type,
        targetId: row.target_id,
        targetName: row.target_name,
        beforeState: row.before_state,
        afterState: row.after_state,
        changedFields: row.changed_fields,
        result: row.result,
        resultReason: row.result_reason,
        authority: row.authority,
        approvalChain: row.approval_chain,
        reversible: row.reversible,
        reversalDeadline: row.reversal_deadline,
        createdAt: new Date(row.created_at),
        metadata: row.metadata,
      }));
    } catch (error) {
      console.error('Error getting resource action log:', error);
      throw error;
    }
  }

  /**
   * Query audit logs with flexible filtering
   */
  async queryAuditLogs(filters: {
    actionType?: string[];
    actionCategory?: string[];
    targetType?: string[];
    targetId?: string;
    actorId?: string;
    result?: string;
    reversible?: boolean;
    sinceDate?: Date;
    untilDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{
    logs: AuditLog[];
    total: number;
  }> {
    try {
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      let whereConditions: string[] = [];

      if (filters.actionType && filters.actionType.length > 0) {
        whereConditions.push(`action_type IN (${filters.actionType.map(t => `'${t}'`).join(',')})`);
      }

      if (filters.actionCategory && filters.actionCategory.length > 0) {
        whereConditions.push(`action_category IN (${filters.actionCategory.map(c => `'${c}'`).join(',')})`);
      }

      if (filters.targetType && filters.targetType.length > 0) {
        whereConditions.push(`target_type IN (${filters.targetType.map(t => `'${t}'`).join(',')})`);
      }

      if (filters.targetId) {
        whereConditions.push(`target_id = '${filters.targetId}'`);
      }

      if (filters.actorId) {
        whereConditions.push(`actor_id = '${filters.actorId}'`);
      }

      if (filters.result) {
        whereConditions.push(`result = '${filters.result}'`);
      }

      if (filters.reversible !== undefined) {
        whereConditions.push(`reversible = ${filters.reversible}`);
      }

      if (filters.sinceDate) {
        whereConditions.push(`created_at >= '${filters.sinceDate.toISOString()}'`);
      }

      if (filters.untilDate) {
        whereConditions.push(`created_at <= '${filters.untilDate.toISOString()}'`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await db.execute(sql.raw(`
        SELECT COUNT(*) as total FROM audit_logs ${whereClause}
      `));

      const total = parseInt(((countResult.rows?.[0] as any)?.total || '0'), 10);

      // Get paginated results
      const queryResult = await db.execute(sql.raw(`
        SELECT * FROM audit_logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `));

      const logs = (queryResult.rows || []).map((row: any) => ({
        id: row.id,
        actorId: row.actor_id,
        actorType: row.actor_type,
        actorRole: row.actor_role,
        actionType: row.action_type,
        actionCategory: row.action_category,
        targetType: row.target_type,
        targetId: row.target_id,
        targetName: row.target_name,
        beforeState: row.before_state,
        afterState: row.after_state,
        changedFields: row.changed_fields,
        result: row.result,
        resultReason: row.result_reason,
        authority: row.authority,
        approvalChain: row.approval_chain,
        reversible: row.reversible,
        reversalDeadline: row.reversal_deadline,
        createdAt: new Date(row.created_at),
        metadata: row.metadata,
      }));

      return { logs, total };
    } catch (error) {
      console.error('Error querying audit logs:', error);
      throw error;
    }
  }

  /**
   * Get full details of a specific audit log
   */
  async getActionDetails(logId: string): Promise<AuditLog | null> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM audit_logs WHERE id = ${logId}
      `);

      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      const row = (result.rows[0] as any);

      return {
        id: row.id,
        actorId: row.actor_id,
        actorType: row.actor_type,
        actorRole: row.actor_role,
        actionType: row.action_type,
        actionCategory: row.action_category,
        targetType: row.target_type,
        targetId: row.target_id,
        targetName: row.target_name,
        beforeState: row.before_state,
        afterState: row.after_state,
        changedFields: row.changed_fields,
        result: row.result,
        resultReason: row.result_reason,
        authority: row.authority,
        approvalChain: row.approval_chain,
        reversible: row.reversible,
        reversalDeadline: row.reversal_deadline,
        createdAt: new Date(row.created_at),
        metadata: row.metadata,
      };
    } catch (error) {
      console.error('Error getting action details:', error);
      throw error;
    }
  }

  /**
   * Get audit statistics for a time period
   */
  async getAuditStats(period: {
    since: Date;
    until: Date;
  }): Promise<AuditStats> {
    try {
      const statsResult = await db.execute(sql`
        SELECT
          COUNT(*) as total_actions,
          COUNT(CASE WHEN result = 'success' THEN 1 END) as success_count,
          COUNT(CASE WHEN result = 'failed' THEN 1 END) as failed_count,
          COUNT(CASE WHEN result = 'partial' THEN 1 END) as partial_count
        FROM audit_logs
        WHERE created_at >= ${period.since} AND created_at <= ${period.until}
      `);

      const stats = (statsResult.rows?.[0] as any) || {};
      const totalActions = parseInt(stats.total_actions || '0', 10);
      const successCount = parseInt(stats.success_count || '0', 10);
      const failedCount = parseInt(stats.failed_count || '0', 10);
      const partialCount = parseInt(stats.partial_count || '0', 10);

      // Get breakdown by action type
      const actionTypeResult = await db.execute(sql`
        SELECT action_type, COUNT(*) as count
        FROM audit_logs
        WHERE created_at >= ${period.since} AND created_at <= ${period.until}
        GROUP BY action_type
      `);

      const byActionType: Record<string, number> = {};
      (actionTypeResult.rows || []).forEach((row: any) => {
        byActionType[row.action_type] = parseInt(row.count, 10);
      });

      // Get breakdown by actor
      const actorResult = await db.execute(sql`
        SELECT actor_id, COUNT(*) as count
        FROM audit_logs
        WHERE created_at >= ${period.since} AND created_at <= ${period.until}
        GROUP BY actor_id
      `);

      const byActor: Record<string, number> = {};
      (actorResult.rows || []).forEach((row: any) => {
        byActor[row.actor_id] = parseInt(row.count, 10);
      });

      // Get breakdown by category
      const categoryResult = await db.execute(sql`
        SELECT action_category, COUNT(*) as count
        FROM audit_logs
        WHERE created_at >= ${period.since} AND created_at <= ${period.until}
        GROUP BY action_category
      `);

      const byCategory: Record<string, number> = {};
      (categoryResult.rows || []).forEach((row: any) => {
        byCategory[row.action_category] = parseInt(row.count, 10);
      });

      return {
        totalActions,
        byActionType,
        byActor,
        byResult: {
          success: successCount,
          failed: failedCount,
          partial: partialCount,
        },
        byCategory,
        successRate: totalActions > 0 ? (successCount / totalActions) * 100 : 0,
        failureRate: totalActions > 0 ? (failedCount / totalActions) * 100 : 0,
      };
    } catch (error) {
      console.error('Error getting audit stats:', error);
      throw error;
    }
  }
}

export default new AuditLoggingService();
