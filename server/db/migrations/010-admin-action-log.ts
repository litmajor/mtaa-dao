import { sql } from 'drizzle-orm';
import type { PostgresDB } from 'drizzle-orm/postgres-js';

/**
 * Migration: Admin Action Log - Immutable Audit Trail (Day 2)
 * 
 * Creates table for:
 * - admin_action_log: Immutable record of all high-power admin actions
 *   Includes state snapshots, actor info, and comprehensive audit trail
 */
export async function up(db: PostgresDB) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS admin_action_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_user_id VARCHAR(255) NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      
      action_type VARCHAR(100) NOT NULL,
      resource_type VARCHAR(50) NOT NULL,
      resource_id UUID NOT NULL,
      
      before_state JSONB,
      after_state JSONB,
      
      reason TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      ip_address VARCHAR(255),
      user_agent VARCHAR(500)
    );
    
    CREATE INDEX admin_action_log_admin_user_id_idx ON admin_action_log(admin_user_id);
    CREATE INDEX admin_action_log_action_type_idx ON admin_action_log(action_type);
    CREATE INDEX admin_action_log_resource_type_idx ON admin_action_log(resource_type);
    CREATE INDEX admin_action_log_resource_id_idx ON admin_action_log(resource_id);
    CREATE INDEX admin_action_log_created_at_idx ON admin_action_log(created_at);
    CREATE INDEX admin_action_log_admin_created_idx ON admin_action_log(admin_user_id, created_at);
    CREATE INDEX admin_action_log_action_resource_idx ON admin_action_log(action_type, resource_type);
  `);
}

export async function down(db: PostgresDB) {
  await db.execute(sql`DROP TABLE IF EXISTS admin_action_log CASCADE`);
}
