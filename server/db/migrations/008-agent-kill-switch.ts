/**
 * Migration: Agent Kill-Switch & Circuit Breaker Support
 * Day 1 Emergency Response - Power Checklist Compliance
 */

import { sql } from 'drizzle-orm';

export async function up(db: any) {
  // ============================================================================
  // STEP 1: Alter agents table - Add kill-switch and circuit breaker columns
  // ============================================================================
  
  await db.execute(sql`
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP DEFAULT NULL;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP DEFAULT NULL;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS deactivation_reason TEXT DEFAULT NULL;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS deactivated_by VARCHAR(64) DEFAULT NULL;
    
    -- Circuit breaker fields
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS execution_count_1h INTEGER DEFAULT 0;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS circuit_breaker_threshold INTEGER DEFAULT 20;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS circuit_breaker_triggered BOOLEAN DEFAULT false;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS circuit_breaker_triggered_at TIMESTAMP DEFAULT NULL;
    ALTER TABLE agents ADD COLUMN IF NOT EXISTS circuit_breaker_trigger_reason TEXT DEFAULT NULL;
  `);

  // Create indexes for performance
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_agents_is_active ON agents(is_active);
    CREATE INDEX IF NOT EXISTS idx_agents_deactivated_at ON agents(deactivated_at);
    CREATE INDEX IF NOT EXISTS idx_agents_circuit_breaker ON agents(circuit_breaker_triggered);
  `);

  // ============================================================================
  // STEP 2: Create agent_state_history table for full audit trail
  // ============================================================================
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agent_state_history (
      id VARCHAR(64) PRIMARY KEY,
      agent_id VARCHAR(64) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      dao_id VARCHAR(64) NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
      
      -- Action type and metadata
      action_type VARCHAR(64) NOT NULL,
      action_metadata JSON DEFAULT NULL,
      
      -- State snapshots (before and after)
      state_before JSON DEFAULT NULL,
      state_after JSON DEFAULT NULL,
      
      -- Authority information
      initiated_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
      authority_type VARCHAR(64) DEFAULT 'superuser',
      approvals JSON DEFAULT NULL,
      
      -- Reversibility information
      is_reversible BOOLEAN DEFAULT true,
      reversal_deadline TIMESTAMP DEFAULT NULL,
      reversal_action_id VARCHAR(64) DEFAULT NULL,
      
      -- Audit trail meta
      actor_ip_address VARCHAR(45) DEFAULT NULL,
      actor_user_agent TEXT DEFAULT NULL,
      timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
      
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    
    -- Indexes for querying
    CREATE INDEX IF NOT EXISTS idx_agent_state_history_agent_time 
      ON agent_state_history(agent_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_state_history_action_type ON agent_state_history(action_type);
    CREATE INDEX IF NOT EXISTS idx_agent_state_history_initiated_by ON agent_state_history(initiated_by);
    CREATE INDEX IF NOT EXISTS idx_agent_state_history_reversible ON agent_state_history(is_reversible);
    CREATE INDEX IF NOT EXISTS idx_agent_state_history_dao ON agent_state_history(dao_id);
  `);

  console.log('✅ Migration 008: Agent kill-switch schema created successfully');
}

export async function down(db: any) {
  // Drop state history table
  await db.execute(sql`DROP TABLE IF EXISTS agent_state_history CASCADE;`);
  
  // Drop columns from agents table
  await db.execute(sql`
    ALTER TABLE agents DROP COLUMN IF EXISTS is_active;
    ALTER TABLE agents DROP COLUMN IF EXISTS activated_at;
    ALTER TABLE agents DROP COLUMN IF EXISTS deactivated_at;
    ALTER TABLE agents DROP COLUMN IF EXISTS deactivation_reason;
    ALTER TABLE agents DROP COLUMN IF EXISTS deactivated_by;
    ALTER TABLE agents DROP COLUMN IF EXISTS execution_count_1h;
    ALTER TABLE agents DROP COLUMN IF EXISTS circuit_breaker_threshold;
    ALTER TABLE agents DROP COLUMN IF EXISTS circuit_breaker_triggered;
    ALTER TABLE agents DROP COLUMN IF EXISTS circuit_breaker_triggered_at;
    ALTER TABLE agents DROP COLUMN IF EXISTS circuit_breaker_trigger_reason;
  `);
  
  console.log('⬇️  Migration 008: Rollback complete');
}
