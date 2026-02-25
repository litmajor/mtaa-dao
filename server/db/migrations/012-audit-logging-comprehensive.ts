import { sql } from 'drizzle-orm';

/**
 * Migration: Comprehensive Audit Logging (Day 3)
 * 
 * Creates audit_logs table for immutable audit trail of all admin actions
 * Tracks who did what, when, to what, with what result and what approval chain
 */
export async function up(db: any) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      -- Identifiers
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      
      -- Actor (WHO performed action)
      actor_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE SET NULL,
      actor_type VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (actor_type IN ('admin', 'agent', 'system')),
      actor_role VARCHAR(50),
      
      -- Action (WHAT was done)
      action_type VARCHAR(100) NOT NULL,
      action_category VARCHAR(50) NOT NULL DEFAULT 'admin' CHECK (action_category IN ('admin', 'governance', 'agent', 'system')),
      
      -- Target (TO WHAT)
      target_type VARCHAR(50) NOT NULL,
      target_id UUID NOT NULL,
      target_name VARCHAR(255),
      
      -- State Snapshots (WHAT CHANGED)
      before_state JSONB,
      after_state JSONB,
      changed_fields TEXT[],
      
      -- Result (SUCCESS or FAILURE)
      result VARCHAR(20) NOT NULL DEFAULT 'success' CHECK (result IN ('success', 'failed', 'partial')),
      result_reason TEXT,
      result_snapshot JSONB,
      
      -- Authority & Approval Chain
      authority VARCHAR(50) NOT NULL DEFAULT 'admin',
      approval_chain TEXT[],
      approval_status VARCHAR(20),
      
      -- Reversibility Metadata
      reversible BOOLEAN NOT NULL DEFAULT false,
      reversal_action_id UUID,
      reversal_type VARCHAR(50),
      reversal_deadline TIMESTAMP,
      
      -- Timestamps
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMP,
      
      -- Request Context (HOW & WHERE)
      metadata JSONB,
      
      -- Integration context
      external_id VARCHAR(255),
      related_logs TEXT[]
    );
    
    -- Create comprehensive indexes for fast lookups
    CREATE INDEX audit_logs_actor_id_idx ON audit_logs(actor_id);
    CREATE INDEX audit_logs_action_type_idx ON audit_logs(action_type);
    CREATE INDEX audit_logs_target_type_target_id_idx ON audit_logs(target_type, target_id);
    CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at);
    CREATE INDEX audit_logs_actor_created_idx ON audit_logs(actor_id, created_at);
    CREATE INDEX audit_logs_action_created_idx ON audit_logs(action_type, created_at);
    CREATE INDEX audit_logs_target_created_idx ON audit_logs(target_type, target_id, created_at);
    CREATE INDEX audit_logs_result_idx ON audit_logs(result);
    CREATE INDEX audit_logs_reversible_idx ON audit_logs(reversible, reversal_deadline);
    CREATE INDEX audit_logs_action_category_idx ON audit_logs(action_category);
  `);
  
  // Add trigger to make audit_logs immutable (optional, but recommended)
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION audit_logs_immutable() RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Audit logs are immutable and cannot be modified';
    END;
    $$ LANGUAGE plpgsql;
    
    CREATE TRIGGER audit_logs_prevent_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION audit_logs_immutable();
    
    CREATE TRIGGER audit_logs_prevent_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION audit_logs_immutable();
  `);
}

export async function down(db: any) {
  // Drop triggers
  await db.execute(sql`
    DROP TRIGGER IF EXISTS audit_logs_prevent_delete ON audit_logs;
    DROP TRIGGER IF EXISTS audit_logs_prevent_update ON audit_logs;
    DROP FUNCTION IF EXISTS audit_logs_immutable();
  `);

  // Drop indexes
  await db.execute(sql`
    DROP INDEX IF EXISTS audit_logs_action_category_idx;
    DROP INDEX IF EXISTS audit_logs_reversible_idx;
    DROP INDEX IF EXISTS audit_logs_result_idx;
    DROP INDEX IF EXISTS audit_logs_target_created_idx;
    DROP INDEX IF EXISTS audit_logs_action_created_idx;
    DROP INDEX IF EXISTS audit_logs_actor_created_idx;
    DROP INDEX IF EXISTS audit_logs_created_at_idx;
    DROP INDEX IF EXISTS audit_logs_target_type_target_id_idx;
    DROP INDEX IF EXISTS audit_logs_action_type_idx;
    DROP INDEX IF EXISTS audit_logs_actor_id_idx;
  `);

  // Drop table
  await db.execute(sql`DROP TABLE IF EXISTS audit_logs CASCADE`);
}
