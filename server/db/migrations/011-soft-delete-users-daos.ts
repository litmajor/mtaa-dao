import { sql } from 'drizzle-orm';

/**
 * Migration: Soft Delete Support for Users, DAOs, and Admins (Day 3)
 * 
 * Adds soft delete columns to users, daos, and admin_users tables
 * Enables 30-day recovery window before permanent deletion
 * Tracks who deleted and why for audit trail
 */
export async function up(db: any) {
  // Add soft delete columns to users table
  await db.execute(sql`
    ALTER TABLE users
    ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN deleted_by UUID NULL REFERENCES admin_users(id) ON DELETE SET NULL,
    ADD COLUMN delete_reason TEXT NULL,
    ADD COLUMN deleted_recovery_deadline TIMESTAMP NULL DEFAULT NULL
  `);

  // Add soft delete columns to daos table
  await db.execute(sql`
    ALTER TABLE daos
    ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN deleted_by UUID NULL REFERENCES admin_users(id) ON DELETE SET NULL,
    ADD COLUMN delete_reason TEXT NULL,
    ADD COLUMN deleted_recovery_deadline TIMESTAMP NULL DEFAULT NULL
  `);

  // Add soft delete columns to admin_users table
  await db.execute(sql`
    ALTER TABLE admin_users
    ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN deleted_by UUID NULL REFERENCES admin_users(id) ON DELETE SET NULL,
    ADD COLUMN delete_reason TEXT NULL,
    ADD COLUMN deleted_recovery_deadline TIMESTAMP NULL DEFAULT NULL
  `);

  // Create indexes for soft-deleted item queries
  await db.execute(sql`
    CREATE INDEX users_deleted_at_idx ON users(deleted_at);
    CREATE INDEX users_deleted_recovery_idx ON users(deleted_recovery_deadline) WHERE deleted_at IS NOT NULL;
    
    CREATE INDEX daos_deleted_at_idx ON daos(deleted_at);
    CREATE INDEX daos_deleted_recovery_idx ON daos(deleted_recovery_deadline) WHERE deleted_at IS NOT NULL;
    
    CREATE INDEX admin_users_deleted_at_idx ON admin_users(deleted_at);
    CREATE INDEX admin_users_deleted_recovery_idx ON admin_users(deleted_recovery_deadline) WHERE deleted_at IS NOT NULL;
  `);
}

export async function down(db: any) {
  // Drop indexes
  await db.execute(sql`
    DROP INDEX IF EXISTS admin_users_deleted_recovery_idx;
    DROP INDEX IF EXISTS admin_users_deleted_at_idx;
    DROP INDEX IF EXISTS daos_deleted_recovery_idx;
    DROP INDEX IF EXISTS daos_deleted_at_idx;
    DROP INDEX IF EXISTS users_deleted_recovery_idx;
    DROP INDEX IF EXISTS users_deleted_at_idx;
  `);

  // Drop columns from admin_users
  await db.execute(sql`
    ALTER TABLE admin_users
    DROP COLUMN IF EXISTS deleted_recovery_deadline CASCADE,
    DROP COLUMN IF EXISTS delete_reason CASCADE,
    DROP COLUMN IF EXISTS deleted_by CASCADE,
    DROP COLUMN IF EXISTS deleted_at CASCADE
  `);

  // Drop columns from daos
  await db.execute(sql`
    ALTER TABLE daos
    DROP COLUMN IF EXISTS deleted_recovery_deadline CASCADE,
    DROP COLUMN IF EXISTS delete_reason CASCADE,
    DROP COLUMN IF EXISTS deleted_by CASCADE,
    DROP COLUMN IF EXISTS deleted_at CASCADE
  `);

  // Drop columns from users
  await db.execute(sql`
    ALTER TABLE users
    DROP COLUMN IF EXISTS deleted_recovery_deadline CASCADE,
    DROP COLUMN IF EXISTS delete_reason CASCADE,
    DROP COLUMN IF EXISTS deleted_by CASCADE,
    DROP COLUMN IF EXISTS deleted_at CASCADE
  `);
}
