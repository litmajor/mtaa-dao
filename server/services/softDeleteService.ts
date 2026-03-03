/**
 * Soft Delete Service
 * Day 3 - Audit Logging & Reversibility
 * 
 * POWER CHECKLIST ITEMS ADDRESSED:
 * 7. Reversibility: 30-day recovery window for deleted items
 * 8. Post-Action Narrative: Tracks deletion history
 * 9. Emotional Safety: Soft delete instead of permanent destruction
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export interface SoftDeleteDTO {
  targetId: string;
  targetType: 'user' | 'dao' | 'admin';
  deletedBy: string;
  reason: string;
  auditLogId?: string;
}

export interface RestoreDTO {
  targetId: string;
  targetType: 'user' | 'dao' | 'admin';
  restoredBy: string;
  reason: string;
  auditLogId?: string;
}

export interface RecoveryStatus {
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  reason?: string;
  recoveryDeadline?: Date;
  daysRemaining?: number;
}

export interface SoftDeletedItem {
  id: string;
  name: string;
  type: 'user' | 'dao' | 'admin';
  deletedAt: Date;
  deletedBy: string;
  reason: string;
  recoveryDeadline: Date;
  daysRemaining: number;
}

class SoftDeleteService {
  /**
   * Soft delete a user
   */
  async softDeleteUser(dto: SoftDeleteDTO): Promise<void> {
    try {
      // Check if user exists
      const userResult = await db.execute(sql`
        SELECT id, email FROM users WHERE id = ${dto.targetId}
      `);

      if (!userResult.rows || userResult.rows.length === 0) {
        throw new Error(`User not found: ${dto.targetId}`);
      }

      // Check if already soft deleted
      const user = (userResult.rows[0] as any);
      if (user.deleted_at) {
        throw new Error(`User already soft deleted: ${dto.targetId}`);
      }

      // Calculate 30-day recovery deadline
      const now = new Date();
      const recoveryDeadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Soft delete user
      await db.execute(sql`
        UPDATE users
        SET deleted_at = ${now},
            deleted_by = ${dto.deletedBy},
            delete_reason = ${dto.reason},
            deleted_recovery_deadline = ${recoveryDeadline}
        WHERE id = ${dto.targetId}
      `);

      // Revoke all sessions
      await db.execute(sql`
        UPDATE user_sessions
        SET revoked_at = ${now}
        WHERE user_id = ${dto.targetId} AND revoked_at IS NULL
      `);
    } catch (error) {
      console.error('Error soft deleting user:', error);
      throw error;
    }
  }

  /**
   * Soft delete a DAO
   */
  async softDeleteDAO(dto: SoftDeleteDTO): Promise<void> {
    try {
      // Check if DAO exists
      const daoResult = await db.execute(sql`
        SELECT id, name FROM daos WHERE id = ${dto.targetId}
      `);

      if (!daoResult.rows || daoResult.rows.length === 0) {
        throw new Error(`DAO not found: ${dto.targetId}`);
      }

      // Check if already soft deleted
      const dao = (daoResult.rows[0] as any);
      if (dao.deleted_at) {
        throw new Error(`DAO already soft deleted: ${dto.targetId}`);
      }

      // Calculate 30-day recovery deadline
      const now = new Date();
      const recoveryDeadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Soft delete DAO
      await db.execute(sql`
        UPDATE daos
        SET deleted_at = ${now},
            deleted_by = ${dto.deletedBy},
            delete_reason = ${dto.reason},
            deleted_recovery_deadline = ${recoveryDeadline}
        WHERE id = ${dto.targetId}
      `);
    } catch (error) {
      console.error('Error soft deleting DAO:', error);
      throw error;
    }
  }

  /**
   * Soft delete an admin user
   */
  async softDeleteAdmin(dto: SoftDeleteDTO): Promise<void> {
    try {
      // Check if admin exists
      const adminResult = await db.execute(sql`
        SELECT id, email FROM admin_users WHERE id = ${dto.targetId}
      `);

      if (!adminResult.rows || adminResult.rows.length === 0) {
        throw new Error(`Admin not found: ${dto.targetId}`);
      }

      // Check if already soft deleted
      const admin = (adminResult.rows[0] as any);
      if (admin.deleted_at) {
        throw new Error(`Admin already soft deleted: ${dto.targetId}`);
      }

      // Check if this is the last superuser
      const superuserCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM admin_users
        WHERE role = 'super_admin' AND deleted_at IS NULL AND id != ${dto.targetId}
      `);

      const count = parseInt(((superuserCount.rows?.[0] as any)?.count || '0'), 10);
      if (count === 0) {
        throw new Error('Cannot delete the last superuser');
      }

      // Calculate 30-day recovery deadline
      const now = new Date();
      const recoveryDeadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Soft delete admin
      await db.execute(sql`
        UPDATE admin_users
        SET deleted_at = ${now},
            deleted_by = ${dto.deletedBy},
            delete_reason = ${dto.reason},
            deleted_recovery_deadline = ${recoveryDeadline}
        WHERE id = ${dto.targetId}
      `);

      // Revoke all sessions
      await db.execute(sql`
        UPDATE admin_sessions
        SET revoked_at = ${now}
        WHERE admin_user_id = ${dto.targetId} AND revoked_at IS NULL
      `);
    } catch (error) {
      console.error('Error soft deleting admin:', error);
      throw error;
    }
  }

  /**
   * Restore a soft-deleted user
   */
  async restoreUser(dto: RestoreDTO): Promise<void> {
    try {
      const userResult = await db.execute(sql`
        SELECT deleted_at, deleted_recovery_deadline FROM users
        WHERE id = ${dto.targetId} AND deleted_at IS NOT NULL
      `);

      if (!userResult.rows || userResult.rows.length === 0) {
        throw new Error(`User not found or not soft deleted: ${dto.targetId}`);
      }

      const user = (userResult.rows[0] as any);

      // Check if within recovery deadline
      if (new Date() > new Date(user.deleted_recovery_deadline)) {
        throw new Error(`Recovery deadline expired for user: ${dto.targetId}`);
      }

      // Restore user
      await db.execute(sql`
        UPDATE users
        SET deleted_at = NULL,
            deleted_by = NULL,
            delete_reason = NULL,
            deleted_recovery_deadline = NULL
        WHERE id = ${dto.targetId}
      `);
    } catch (error) {
      console.error('Error restoring user:', error);
      throw error;
    }
  }

  /**
   * Restore a soft-deleted DAO
   */
  async restoreDAO(dto: RestoreDTO): Promise<void> {
    try {
      const daoResult = await db.execute(sql`
        SELECT deleted_at, deleted_recovery_deadline FROM daos
        WHERE id = ${dto.targetId} AND deleted_at IS NOT NULL
      `);

      if (!daoResult.rows || daoResult.rows.length === 0) {
        throw new Error(`DAO not found or not soft deleted: ${dto.targetId}`);
      }

      const dao = (daoResult.rows[0] as any);

      // Check if within recovery deadline
      if (new Date() > new Date(dao.deleted_recovery_deadline)) {
        throw new Error(`Recovery deadline expired for DAO: ${dto.targetId}`);
      }

      // Restore DAO
      await db.execute(sql`
        UPDATE daos
        SET deleted_at = NULL,
            deleted_by = NULL,
            delete_reason = NULL,
            deleted_recovery_deadline = NULL
        WHERE id = ${dto.targetId}
      `);
    } catch (error) {
      console.error('Error restoring DAO:', error);
      throw error;
    }
  }

  /**
   * Restore a soft-deleted admin
   */
  async restoreAdmin(dto: RestoreDTO): Promise<void> {
    try {
      const adminResult = await db.execute(sql`
        SELECT deleted_at, deleted_recovery_deadline FROM admin_users
        WHERE id = ${dto.targetId} AND deleted_at IS NOT NULL
      `);

      if (!adminResult.rows || adminResult.rows.length === 0) {
        throw new Error(`Admin not found or not soft deleted: ${dto.targetId}`);
      }

      const admin = (adminResult.rows[0] as any);

      // Check if within recovery deadline
      if (new Date() > new Date(admin.deleted_recovery_deadline)) {
        throw new Error(`Recovery deadline expired for admin: ${dto.targetId}`);
      }

      // Restore admin
      await db.execute(sql`
        UPDATE admin_users
        SET deleted_at = NULL,
            deleted_by = NULL,
            delete_reason = NULL,
            deleted_recovery_deadline = NULL
        WHERE id = ${dto.targetId}
      `);
    } catch (error) {
      console.error('Error restoring admin:', error);
      throw error;
    }
  }

  /**
   * Check recovery status of a resource
   */
  async getRecoveryStatus(targetId: string, targetType: string): Promise<RecoveryStatus> {
    try {
      const query = targetType === 'user'
        ? sql`SELECT deleted_at, deleted_by, delete_reason, deleted_recovery_deadline FROM users WHERE id = ${targetId}`
        : targetType === 'dao'
        ? sql`SELECT deleted_at, deleted_by, delete_reason, deleted_recovery_deadline FROM daos WHERE id = ${targetId}`
        : sql`SELECT deleted_at, deleted_by, delete_reason, deleted_recovery_deadline FROM admin_users WHERE id = ${targetId}`;

      const result = await db.execute(query);

      if (!result.rows || result.rows.length === 0) {
        throw new Error(`Resource not found: ${targetId}`);
      }

      const item = (result.rows[0] as any);

      if (!item.deleted_at) {
        return { isDeleted: false };
      }

      const now = new Date();
      const deadline = new Date(item.deleted_recovery_deadline);
      const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        isDeleted: true,
        deletedAt: new Date(item.deleted_at),
        deletedBy: item.deleted_by,
        reason: item.delete_reason,
        recoveryDeadline: deadline,
        daysRemaining: Math.max(0, daysRemaining),
      };
    } catch (error) {
      console.error('Error checking recovery status:', error);
      throw error;
    }
  }

  /**
   * List all soft-deleted items of a given type
   */
  async listSoftDeleted(targetType: string, limit: number = 50, offset: number = 0): Promise<SoftDeletedItem[]> {
    try {
      const table = targetType === 'user' ? 'users' : targetType === 'dao' ? 'daos' : 'admin_users';
      const nameColumn = targetType === 'user' ? 'email' : 'name';

      const result = await db.execute(sql.raw(`
        SELECT 
          id, ${nameColumn} as name, deleted_at, deleted_by, delete_reason, deleted_recovery_deadline
        FROM ${table}
        WHERE deleted_at IS NOT NULL AND deleted_recovery_deadline > NOW()
        ORDER BY deleted_recovery_deadline ASC
        LIMIT ${limit} OFFSET ${offset}
      `));

      if (!result.rows) return [];

      return (result.rows as any[]).map((item) => {
        const now = new Date();
        const deadline = new Date(item.deleted_recovery_deadline);
        const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: item.id,
          name: item.name,
          type: targetType as 'user' | 'dao' | 'admin',
          deletedAt: new Date(item.deleted_at),
          deletedBy: item.deleted_by,
          reason: item.delete_reason,
          recoveryDeadline: deadline,
          daysRemaining: Math.max(0, daysRemaining),
        };
      });
    } catch (error) {
      console.error('Error listing soft-deleted items:', error);
      throw error;
    }
  }

  /**
   * Permanently delete an expired soft-deleted item (only after 30 days)
   */
  async permanentlyDelete(targetId: string, targetType: string, reason: string): Promise<void> {
    try {
      const table = targetType === 'user' ? 'users' : targetType === 'dao' ? 'daos' : 'admin_users';

      // Check if 30-day period has passed
      const result = await db.execute(sql.raw(`
        SELECT deleted_recovery_deadline FROM ${table}
        WHERE id = '${targetId}' AND deleted_at IS NOT NULL
      `));

      if (!result.rows || result.rows.length === 0) {
        throw new Error(`Resource not found or not soft deleted: ${targetId}`);
      }

      const item = (result.rows[0] as any);
      if (new Date() < new Date(item.deleted_recovery_deadline)) {
        throw new Error(`Cannot permanently delete yet. Recovery deadline: ${item.deleted_recovery_deadline}`);
      }

      // Permanently delete
      await db.execute(sql.raw(`
        DELETE FROM ${table} WHERE id = '${targetId}'
      `));
    } catch (error) {
      console.error('Error permanently deleting:', error);
      throw error;
    }
  }
}

export default new SoftDeleteService();
