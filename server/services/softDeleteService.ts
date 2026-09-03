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
import { apiKeys, refreshTokens } from '../../shared/schema';
import { blacklistUserTokens } from './tokenBlacklist';

interface DeletedRecord {
  id?: string;
  email?: string;
  role?: string;
  deleted_at?: string | Date | null;
  deleted_by?: string | null;
  delete_reason?: string | null;
  deleted_recovery_deadline?: string | Date | null;
}

interface CountRecord {
  count?: string | number;
}

interface ListedDeletedRecord {
  id: string;
  name: string | null;
  deleted_at: string | Date | null;
  deleted_by: string | null;
  delete_reason: string | null;
  deleted_recovery_deadline: string | Date | null;
}

export interface SoftDeletedStats {
  total: number;
  recoverable: number;
  expired: number;
  expiringSoon: number;
}

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
      const user = userResult.rows[0] as DeletedRecord;
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
      await db.update(refreshTokens)
        .set({ revokedAt: now, revokedReason: 'user_deleted' })
        .where(sql`${refreshTokens.userId} = ${dto.targetId}`);
      await db.update(apiKeys)
        .set({ enabled: false, revokedAt: now, revokedReason: 'user_deleted', updatedAt: now })
        .where(sql`${apiKeys.userId} = ${dto.targetId}`);
      await blacklistUserTokens(dto.targetId);
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
      const dao = daoResult.rows[0] as DeletedRecord;
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
      const admin = adminResult.rows[0] as DeletedRecord;
      if (admin.deleted_at) {
        throw new Error(`Admin already soft deleted: ${dto.targetId}`);
      }

      // Check if this is the last superuser
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('soft-delete:admin'))`);
        const activeSuperusers = await tx.execute(sql`
          SELECT COUNT(*) AS count FROM admin_users
          WHERE role = 'super_admin' AND deleted_at IS NULL AND id != ${dto.targetId}
        `);
        const count = Number((activeSuperusers.rows?.[0] as CountRecord | undefined)?.count || 0);
        if (admin.role === 'super_admin' && count === 0) throw new Error('Cannot delete the last superuser');

        const now = new Date();
        const recoveryDeadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const deleted = await tx.execute(sql`
          UPDATE admin_users
          SET deleted_at = ${now}, deleted_by = ${dto.deletedBy},
              delete_reason = ${dto.reason}, deleted_recovery_deadline = ${recoveryDeadline}
          WHERE id = ${dto.targetId} AND deleted_at IS NULL
          RETURNING id
        `);
        if (!deleted.rows?.length) throw new Error(`Admin already soft deleted: ${dto.targetId}`);
        await tx.execute(sql`
          UPDATE admin_sessions SET revoked_at = ${now}
          WHERE admin_user_id = ${dto.targetId} AND revoked_at IS NULL
        `);
      });
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
      const result = await db.execute(sql`
        UPDATE users
        SET deleted_at = NULL,
            deleted_by = NULL,
            delete_reason = NULL,
            deleted_recovery_deadline = NULL
        WHERE id = ${dto.targetId} AND deleted_at IS NOT NULL
          AND deleted_recovery_deadline > NOW()
        RETURNING id
      `);
      if (!result.rows?.length) throw new Error(`Recovery deadline expired or user not found: ${dto.targetId}`);
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
      const result = await db.execute(sql`
        UPDATE daos
        SET deleted_at = NULL,
            deleted_by = NULL,
            delete_reason = NULL,
            deleted_recovery_deadline = NULL
        WHERE id = ${dto.targetId} AND deleted_at IS NOT NULL
          AND deleted_recovery_deadline > NOW()
        RETURNING id
      `);
      if (!result.rows?.length) throw new Error(`Recovery deadline expired or DAO not found: ${dto.targetId}`);
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
      const result = await db.execute(sql`
        UPDATE admin_users
        SET deleted_at = NULL,
            deleted_by = NULL,
            delete_reason = NULL,
            deleted_recovery_deadline = NULL
        WHERE id = ${dto.targetId} AND deleted_at IS NOT NULL
          AND deleted_recovery_deadline > NOW()
        RETURNING id
      `);
      if (!result.rows?.length) throw new Error(`Recovery deadline expired or admin not found: ${dto.targetId}`);
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

      const item = result.rows[0] as DeletedRecord;

      const deletedAt = item.deleted_at;
      if (!deletedAt) {
        return { isDeleted: false };
      }

      const recoveryDeadline = item.deleted_recovery_deadline;
      if (!recoveryDeadline) {
        throw new Error(`Deleted resource has no recovery deadline: ${targetId}`);
      }

      const now = new Date();
      const deadline = new Date(recoveryDeadline);
      const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        isDeleted: true,
        deletedAt: new Date(deletedAt),
        deletedBy: item.deleted_by ?? undefined,
        reason: item.delete_reason ?? undefined,
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
  async listSoftDeleted(targetType: string, limit: number = 50, offset: number = 0, includeExpired: boolean = false): Promise<SoftDeletedItem[]> {
    try {
      if (!['user', 'dao', 'admin'].includes(targetType)) {
        throw new Error(`Invalid target type: ${targetType}`);
      }

      const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 50));
      const safeOffset = Math.max(0, Number(offset) || 0);

      const expiryCondition = includeExpired ? sql`` : sql`AND deleted_recovery_deadline > NOW()`;
      const query = targetType === 'user'
        ? sql`SELECT id, email AS name, deleted_at, deleted_by, delete_reason, deleted_recovery_deadline FROM users WHERE deleted_at IS NOT NULL ${expiryCondition} ORDER BY deleted_recovery_deadline ASC LIMIT ${safeLimit} OFFSET ${safeOffset}`
        : targetType === 'dao'
          ? sql`SELECT id, name, deleted_at, deleted_by, delete_reason, deleted_recovery_deadline FROM daos WHERE deleted_at IS NOT NULL ${expiryCondition} ORDER BY deleted_recovery_deadline ASC LIMIT ${safeLimit} OFFSET ${safeOffset}`
          : sql`SELECT id, name, deleted_at, deleted_by, delete_reason, deleted_recovery_deadline FROM admin_users WHERE deleted_at IS NOT NULL ${expiryCondition} ORDER BY deleted_recovery_deadline ASC LIMIT ${safeLimit} OFFSET ${safeOffset}`;
      const result = await db.execute(query);

      if (!result.rows) return [];

      const rows = result.rows as unknown[];
      return rows.map((rawItem) => {
        const item = rawItem as ListedDeletedRecord;
        const deletedAt = item.deleted_at;
        const recoveryDeadline = item.deleted_recovery_deadline;
        if (!deletedAt || !recoveryDeadline) {
          throw new Error(`Soft-deleted resource has incomplete recovery metadata: ${item.id}`);
        }
        const now = new Date();
        const deadline = new Date(recoveryDeadline);
        const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: item.id,
          name: item.name ?? item.id,
          type: targetType as 'user' | 'dao' | 'admin',
          deletedAt: new Date(deletedAt),
          deletedBy: item.deleted_by ?? 'unknown',
          reason: item.delete_reason ?? 'No reason recorded',
          recoveryDeadline: deadline,
          daysRemaining: includeExpired ? daysRemaining : Math.max(0, daysRemaining),
        };
      });
    } catch (error) {
      console.error('Error listing soft-deleted items:', error);
      throw error;
    }
  }

  async listAllSoftDeleted(limit: number = 50, offset: number = 0): Promise<SoftDeletedItem[]> {
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const result = await db.execute(sql`
      SELECT id, email AS name, 'user' AS type, deleted_at, deleted_by, delete_reason, deleted_recovery_deadline
      FROM users WHERE deleted_at IS NOT NULL AND deleted_recovery_deadline > NOW()
      UNION ALL
      SELECT id, name, 'dao' AS type, deleted_at, deleted_by, delete_reason, deleted_recovery_deadline
      FROM daos WHERE deleted_at IS NOT NULL AND deleted_recovery_deadline > NOW()
      UNION ALL
      SELECT id, name, 'admin' AS type, deleted_at, deleted_by, delete_reason, deleted_recovery_deadline
      FROM admin_users WHERE deleted_at IS NOT NULL AND deleted_recovery_deadline > NOW()
      ORDER BY deleted_recovery_deadline ASC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `);
    const rows = result.rows as unknown[];
    return rows.map((rawItem) => {
      const item = rawItem as ListedDeletedRecord & { type: 'user' | 'dao' | 'admin' };
      if (!item.id || !item.deleted_at || !item.deleted_recovery_deadline) {
        throw new Error(`Soft-deleted resource has incomplete recovery metadata: ${item.id || 'unknown'}`);
      }
      const deadline = new Date(item.deleted_recovery_deadline);
      const daysRemaining = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return {
        id: item.id,
        name: item.name ?? item.id,
        type: item.type,
        deletedAt: new Date(item.deleted_at),
        deletedBy: item.deleted_by ?? 'unknown',
        reason: item.delete_reason ?? 'No reason recorded',
        recoveryDeadline: deadline,
        daysRemaining,
      };
    });
  }

  async getSoftDeletedStats(): Promise<Record<'user' | 'dao' | 'admin', SoftDeletedStats>> {
    const getStats = async (targetType: 'user' | 'dao' | 'admin'): Promise<SoftDeletedStats> => {
      const result = targetType === 'user'
        ? await db.execute(sql`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE deleted_recovery_deadline > NOW()) AS recoverable, COUNT(*) FILTER (WHERE deleted_recovery_deadline <= NOW()) AS expired, COUNT(*) FILTER (WHERE deleted_recovery_deadline > NOW() AND deleted_recovery_deadline <= NOW() + INTERVAL '3 days') AS "expiringSoon" FROM users WHERE deleted_at IS NOT NULL`)
        : targetType === 'dao'
          ? await db.execute(sql`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE deleted_recovery_deadline > NOW()) AS recoverable, COUNT(*) FILTER (WHERE deleted_recovery_deadline <= NOW()) AS expired, COUNT(*) FILTER (WHERE deleted_recovery_deadline > NOW() AND deleted_recovery_deadline <= NOW() + INTERVAL '3 days') AS "expiringSoon" FROM daos WHERE deleted_at IS NOT NULL`)
          : await db.execute(sql`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE deleted_recovery_deadline > NOW()) AS recoverable, COUNT(*) FILTER (WHERE deleted_recovery_deadline <= NOW()) AS expired, COUNT(*) FILTER (WHERE deleted_recovery_deadline > NOW() AND deleted_recovery_deadline <= NOW() + INTERVAL '3 days') AS "expiringSoon" FROM admin_users WHERE deleted_at IS NOT NULL`);
      const row = result.rows?.[0] as CountRecord & { total?: string | number; recoverable?: string | number; expired?: string | number; expiringSoon?: string | number } | undefined;
      return {
        total: Number(row?.total || 0),
        recoverable: Number(row?.recoverable || 0),
        expired: Number(row?.expired || 0),
        expiringSoon: Number(row?.expiringSoon || 0),
      };
    };
    const [user, dao, admin] = await Promise.all([getStats('user'), getStats('dao'), getStats('admin')]);
    return { user, dao, admin };
  }

  /**
   * Permanently delete an expired soft-deleted item (only after 30 days)
   */
  async permanentlyDelete(targetId: string, targetType: string, reason: string): Promise<void> {
    const tableMap: Record<string, string> = { user: 'users', dao: 'daos', admin: 'admin_users' };
    const table = tableMap[targetType];
    if (!table) throw new Error(`Invalid target type: ${targetType}`);

    try {
      await db.transaction(async (tx) => {
        if (targetType === 'admin') {
          // Serialize admin purges so two requests cannot both remove the last superuser.
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('soft-delete:admin-purge'))`);
          const admin = await tx.execute(sql`
            SELECT role FROM admin_users
            WHERE id = ${targetId} AND deleted_at IS NOT NULL
              AND deleted_recovery_deadline <= NOW()
            FOR UPDATE
          `);
          if (!admin.rows?.length) throw new Error(`Resource not found, not soft deleted, or recovery window is open: ${targetId}`);
          if ((admin.rows[0] as { role?: string }).role === 'super_admin') {
            const superusers = await tx.execute(sql`
              SELECT COUNT(*) AS count FROM admin_users
              WHERE role = 'super_admin' AND deleted_at IS NULL AND id <> ${targetId}
            `);
            if (Number((superusers.rows?.[0] as { count?: string })?.count || 0) === 0) {
              throw new Error('Cannot permanently delete the last superuser');
            }
          }
        }

        const deleted = targetType === 'user'
          ? await tx.execute(sql`DELETE FROM users WHERE id = ${targetId} AND deleted_at IS NOT NULL AND deleted_recovery_deadline <= NOW() RETURNING id`)
          : targetType === 'dao'
            ? await tx.execute(sql`DELETE FROM daos WHERE id = ${targetId} AND deleted_at IS NOT NULL AND deleted_recovery_deadline <= NOW() RETURNING id`)
            : await tx.execute(sql`DELETE FROM admin_users WHERE id = ${targetId} AND deleted_at IS NOT NULL AND deleted_recovery_deadline <= NOW() RETURNING id`);
        if (!deleted.rows?.length) throw new Error(`Resource not found, not soft deleted, or recovery window is open: ${targetId}`);
      });
    } catch (error) {
      console.error('Error permanently deleting:', error);
      throw error;
    }
  }
}

export default new SoftDeleteService();
