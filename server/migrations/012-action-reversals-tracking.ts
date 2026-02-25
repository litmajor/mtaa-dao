import { sql } from 'drizzle-orm';

export async function up(db: any) {
  /**
   * Create action_reversals table
   * Tracks all reversible high-power actions and their lifecycle
   */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS action_reversals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      
      -- Action identification
      action_type VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      severity VARCHAR(50) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
      
      -- Current status in state machine
      status VARCHAR(50) NOT NULL CHECK (status IN (
        'INITIATED', 'PENDING_CONFIRMATION', 'GRACE_PERIOD', 'REVERSIBLE_UNTIL', 
        'EXECUTED', 'IRREVERSIBLE', 'REVERSED', 'EMERGENCY_STOPPED'
      )),
      
      -- Initiator information
      initiator_id VARCHAR(255) NOT NULL,
      initiator_type VARCHAR(50) NOT NULL CHECK (initiator_type IN ('USER', 'AGENT', 'SYSTEM', 'ADMIN', 'DAO_GOVERNANCE')),
      initiator_role VARCHAR(100),
      initiator_email VARCHAR(255),
      
      -- Affected entity
      affected_entity_type VARCHAR(100) NOT NULL,
      affected_entity_id VARCHAR(255) NOT NULL,
      affected_entity_name VARCHAR(255),
      
      -- Action payload
      action_payload JSONB NOT NULL,
      before_state JSONB NOT NULL,
      after_state JSONB NOT NULL,
      
      -- Confirmation requirements
      confirmation_type VARCHAR(50) NOT NULL DEFAULT 'NONE' 
        CHECK (confirmation_type IN ('NONE', 'EMAIL', 'PIN', 'APPROVAL_BOARD', 'MULTI_SIG', 'DAO_VOTE')),
      required_approvals INTEGER,
      approver_roles TEXT[],
      confirmation_timeout_minutes INTEGER NOT NULL DEFAULT 1440,
      
      -- Grace period
      grace_period_duration_hours INTEGER NOT NULL,
      grace_period_reminder_hours INTEGER[] NOT NULL DEFAULT ARRAY[24, 6, 1],
      user_can_accelerate BOOLEAN NOT NULL DEFAULT FALSE,
      auto_execute_at_deadline BOOLEAN NOT NULL DEFAULT FALSE,
      
      -- Reversibility scope
      reversible_fields TEXT[] NOT NULL,
      initiator_can_reverse BOOLEAN NOT NULL DEFAULT TRUE,
      admin_can_reverse BOOLEAN NOT NULL DEFAULT TRUE,
      governance_can_reverse BOOLEAN NOT NULL DEFAULT FALSE,
      minimum_role_to_reverse VARCHAR(100),
      reversal_deadline_hours INTEGER,
      partial_reversal_allowed BOOLEAN NOT NULL DEFAULT FALSE,
      
      -- Emergency stop config
      emergency_stop_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      emergency_stop_allowed_actors TEXT[] DEFAULT ARRAY['SUPERUSER', 'GOVERNANCE'],
      emergency_stop_requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
      emergency_stop_duration_hours INTEGER DEFAULT 24,
      emergency_stop_action VARCHAR(50) DEFAULT 'PAUSE' CHECK (emergency_stop_action IN ('PAUSE', 'CANCEL', 'ROLLBACK')),
      emergency_stop_appealable BOOLEAN NOT NULL DEFAULT TRUE,
      
      -- Circuit breaker tracking
      circuit_breaker_action_count INTEGER DEFAULT 0,
      circuit_breaker_threshold INTEGER,
      circuit_breaker_window_minutes INTEGER DEFAULT 60,
      circuit_breaker_open BOOLEAN DEFAULT FALSE,
      circuit_breaker_reset_at TIMESTAMP,
      
      -- Timestamps
      initiated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      confirmed_at TIMESTAMP,
      grace_period_starts_at TIMESTAMP,
      grace_period_ends_at TIMESTAMP,
      executed_at TIMESTAMP,
      reversed_at TIMESTAMP,
      irreversible_at TIMESTAMP,
      
      -- Execution result
      execution_success BOOLEAN,
      execution_error TEXT,
      execution_transaction_hash VARCHAR(255),
      execution_block_number INTEGER,
      
      -- Reversal details
      reversal_reason VARCHAR(100),
      reversed_by_id VARCHAR(255),
      reversed_by_type VARCHAR(50),
      reversed_by_role VARCHAR(100),
      reversal_reason_text TEXT,
      reversal_payload JSONB,
      reversal_transaction_hash VARCHAR(255),
      
      -- Metadata
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  /**
   * Create approvals junction table for multi-signature tracking
   */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS action_approvals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action_reversal_id UUID NOT NULL REFERENCES action_reversals(id) ON DELETE CASCADE,
      
      approver_id VARCHAR(255) NOT NULL,
      approver_role VARCHAR(100) NOT NULL,
      approved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      comment TEXT,
      
      -- For multi-sig tracking
      signature VARCHAR(255),
      hash VARCHAR(255),
      
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  /**
   * Create status timeline table for audit trail
   */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS action_status_timeline (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action_reversal_id UUID NOT NULL REFERENCES action_reversals(id) ON DELETE CASCADE,
      
      previous_status VARCHAR(50),
      new_status VARCHAR(50) NOT NULL,
      changed_by_id VARCHAR(255),
      changed_by_role VARCHAR(100),
      reason TEXT,
      metadata JSONB,
      
      changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  /**
   * Create indexes for common queries
   */
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_action_reversals_status ON action_reversals(status);
  `);
  
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_action_reversals_action_type ON action_reversals(action_type);
  `);
  
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_action_reversals_initiator ON action_reversals(initiator_id, initiator_type);
  `);
  
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_action_reversals_affected_entity 
    ON action_reversals(affected_entity_type, affected_entity_id);
  `);
  
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_action_reversals_grace_period_ends 
    ON action_reversals(grace_period_ends_at) WHERE status = 'GRACE_PERIOD';
  `);
  
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_action_reversals_created_at ON action_reversals(created_at DESC);
  `);
  
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_action_approvals_action_id ON action_approvals(action_reversal_id);
  `);

  /**
   * Create trigger to update updated_at timestamp
   */
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION update_action_reversals_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await db.execute(sql`
    CREATE TRIGGER update_action_reversals_timestamp_trigger
    BEFORE UPDATE ON action_reversals
    FOR EACH ROW
    EXECUTE FUNCTION update_action_reversals_timestamp();
  `);

  /**
   * Create trigger to log status changes to timeline
   */
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION log_action_status_change()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.status != OLD.status THEN
        INSERT INTO action_status_timeline(
          action_reversal_id, 
          previous_status, 
          new_status,
          changed_at
        ) VALUES (
          NEW.id,
          OLD.status,
          NEW.status,
          CURRENT_TIMESTAMP
        );
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await db.execute(sql`
    CREATE TRIGGER log_action_status_change_trigger
    AFTER UPDATE ON action_reversals
    FOR EACH ROW
    EXECUTE FUNCTION log_action_status_change();
  `);
}

export async function down(db: any) {
  // Drop triggers and functions
  await db.execute(sql`DROP TRIGGER IF EXISTS log_action_status_change_trigger ON action_reversals;`);
  await db.execute(sql`DROP FUNCTION IF EXISTS log_action_status_change();`);
  await db.execute(sql`DROP TRIGGER IF EXISTS update_action_reversals_timestamp_trigger ON action_reversals;`);
  await db.execute(sql`DROP FUNCTION IF EXISTS update_action_reversals_timestamp();`);
  
  // Drop tables
  await db.execute(sql`DROP TABLE IF EXISTS action_status_timeline;`);
  await db.execute(sql`DROP TABLE IF EXISTS action_approvals;`);
  await db.execute(sql`DROP TABLE IF EXISTS action_reversals;`);
}
