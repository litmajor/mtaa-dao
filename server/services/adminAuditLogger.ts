import { db } from '../db';
import { sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export interface AdminActionLog {
  id: string;
  admin_user_id: string;
  action_type: string;
  resource_type: string;
  resource_id: string;
  before_state?: Record<string, any>;
  after_state?: Record<string, any>;
  reason?: string;
  created_at: Date;
  ip_address?: string;
  user_agent?: string;
}

export interface LogActionDTO {
  adminUserId: string;
  actionType: string; // 'KILL_SWITCH', 'REACTIVATE', 'APPROVE_PROPOSAL', 'REJECT_PROPOSAL'
  resourceType: string; // 'AGENT', 'PROPOSAL', 'AGENT_CONFIG'
  resourceId: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AdminAuditLogger {
  /**
   * Log an admin action
   */
  async logAction(dto: LogActionDTO): Promise<AdminActionLog> {
    const logId = uuid();
    const now = new Date();

    try {
      const result = await db.execute(sql`
        INSERT INTO admin_action_log (
          id,
          admin_user_id,
          action_type,
          resource_type,
          resource_id,
          before_state,
          after_state,
          reason,
          created_at,
          ip_address,
          user_agent
        )
        VALUES (
          ${logId},
          ${dto.adminUserId},
          ${dto.actionType},
          ${dto.resourceType},
          ${dto.resourceId},
          ${dto.beforeState ? JSON.stringify(dto.beforeState) : null},
          ${dto.afterState ? JSON.stringify(dto.afterState) : null},
          ${dto.reason || null},
          ${now},
          ${dto.ipAddress || null},
          ${dto.userAgent || null}
        )
        RETURNING *
      `);

      const log = result.rows?.[0];
      if (!log) {
        throw new Error('Failed to insert log');
      }
      return this.formatLog(log);
    } catch (error) {
      console.error('Error logging admin action:', error);
      throw error;
    }
  }

  /**
   * Get action logs for a specific admin user
   */
  async getUserActionLogs(
    adminUserId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AdminActionLog[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM admin_action_log
        WHERE admin_user_id = ${adminUserId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return (result.rows || []).map((log: any) => this.formatLog(log));
    } catch (error) {
      console.error('Error fetching user action logs:', error);
      throw error;
    }
  }

  /**
   * Get action logs for a specific resource (agent, proposal, etc.)
   */
  async getResourceActionLogs(
    resourceType: string,
    resourceId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AdminActionLog[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM admin_action_log
        WHERE resource_type = ${resourceType} AND resource_id = ${resourceId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return (result.rows || []).map((log: any) => this.formatLog(log));
    } catch (error) {
      console.error('Error fetching resource action logs:', error);
      throw error;
    }
  }

  /**
   * Get all action logs (admin dashboard)
   */
  async getAllActionLogs(
    filters?: {
      actionType?: string;
      resourceType?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<AdminActionLog[]> {
    try {
      let whereClause = '';
      const params: any[] = [];

      if (filters?.actionType) {
        whereClause += (whereClause ? ' AND ' : '') + `action_type = $${params.length + 1}`;
        params.push(filters.actionType);
      }
      if (filters?.resourceType) {
        whereClause += (whereClause ? ' AND ' : '') + `resource_type = $${params.length + 1}`;
        params.push(filters.resourceType);
      }
      if (filters?.startDate) {
        whereClause += (whereClause ? ' AND ' : '') + `created_at >= $${params.length + 1}`;
        params.push(filters.startDate);
      }
      if (filters?.endDate) {
        whereClause += (whereClause ? ' AND ' : '') + `created_at <= $${params.length + 1}`;
        params.push(filters.endDate);
      }

      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;

      let query = 'SELECT * FROM admin_action_log';
      if (whereClause) query += ' WHERE ' + whereClause;
      query += ' ORDER BY created_at DESC LIMIT ' + limit + ' OFFSET ' + offset;

      const result = await db.execute(sql.raw(query));
      return (result.rows || []).map((log: any) => this.formatLog(log));
    } catch (error) {
      console.error('Error fetching all action logs:', error);
      throw error;
    }
  }

  /**
   * Get summary stats
   */
  async getAuditStats(hours: number = 24): Promise<Record<string, number>> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const result = await db.execute(sql`
        SELECT action_type, COUNT(*) as count
        FROM admin_action_log
        WHERE created_at >= ${since}
        GROUP BY action_type
      `);

      const stats: Record<string, number> = {};
      (result.rows || []).forEach((row: any) => {
        stats[row.action_type] = parseInt(row.count, 10);
      });

      return stats;
    } catch (error) {
      console.error('Error fetching audit stats:', error);
      throw error;
    }
  }

  /**
   * Private helper: format log from DB
   */
  private formatLog(dbLog: any): AdminActionLog {
    return {
      ...dbLog,
      before_state: typeof dbLog.before_state === 'string'
        ? JSON.parse(dbLog.before_state)
        : dbLog.before_state,
      after_state: typeof dbLog.after_state === 'string'
        ? JSON.parse(dbLog.after_state)
        : dbLog.after_state,
    };
  }
}

export default new AdminAuditLogger();
