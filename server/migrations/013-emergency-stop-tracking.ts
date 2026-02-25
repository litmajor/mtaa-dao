import { sql } from 'drizzle-orm';

export async function up(db: any) {
  /**
   * Create emergency_stop_logs table
   * Tracks all circuit breaker events and emergency stop triggers
   */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS emergency_stop_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      
      -- Action type that triggered the event
      action_type VARCHAR(255) NOT NULL,
      
      -- Event type: CIRCUIT_BREAKER_OPENED, EMERGENCY_STOP_TRIGGERED, CIRCUIT_BREAKER_RESET, etc.
      event_type VARCHAR(100) NOT NULL,
      
      -- Who triggered the event
      actor_id VARCHAR(255) NOT NULL,
      actor_type VARCHAR(50),
      actor_role VARCHAR(100),
      
      -- Reason for the event
      reason TEXT NOT NULL,
      
      -- Additional metadata
      metadata JSONB DEFAULT '{}'::jsonb,
      
      -- Timestamps
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  /**
   * Create indexes for efficient querying
   */
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_emergency_stop_logs_action_type ON emergency_stop_logs(action_type);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_emergency_stop_logs_event_type ON emergency_stop_logs(event_type);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_emergency_stop_logs_actor_id ON emergency_stop_logs(actor_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_emergency_stop_logs_created_at ON emergency_stop_logs(created_at DESC);
  `);

  /**
   * Create alerts table for emergency stop notifications
   */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS emergency_stop_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      
      -- Reference to the emergency stop log event
      emergency_stop_log_id UUID NOT NULL REFERENCES emergency_stop_logs(id) ON DELETE CASCADE,
      
      -- Who should be notified
      recipient_id VARCHAR(255) NOT NULL,
      recipient_role VARCHAR(100),
      recipient_email VARCHAR(255),
      
      -- Alert status: PENDING, SENT, READ, ACKNOWLEDGED
      status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      
      -- Alert metadata
      alert_type VARCHAR(100) DEFAULT 'EMERGENCY_STOP',
      severity VARCHAR(50) DEFAULT 'CRITICAL',
      message TEXT,
      
      -- Response tracking
      acknowledged_at TIMESTAMP,
      acknowledged_by VARCHAR(255),
      response_comment TEXT,
      
      -- Timestamps
      sent_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  /**
   * Create indexes for alert queries
   */
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_emergency_stop_alerts_recipient ON emergency_stop_alerts(recipient_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_emergency_stop_alerts_status ON emergency_stop_alerts(status);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_emergency_stop_alerts_created_at ON emergency_stop_alerts(created_at DESC);
  `);

  /**
   * Create circuit breaker state table for distributed systems
   * Can be used to share circuit breaker state across multiple servers
   */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS circuit_breaker_states (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      
      -- Action type this breaker tracks
      action_type VARCHAR(255) NOT NULL UNIQUE,
      
      -- Breaker state
      is_open BOOLEAN NOT NULL DEFAULT FALSE,
      action_count INTEGER NOT NULL DEFAULT 0,
      threshold INTEGER NOT NULL DEFAULT 50,
      time_window_minutes INTEGER NOT NULL DEFAULT 60,
      
      -- When will it reset?
      resets_at TIMESTAMP,
      opened_reason TEXT,
      opened_by_id VARCHAR(255),
      opened_by_role VARCHAR(100),
      
      -- Timestamps
      last_opened_at TIMESTAMP,
      last_closed_at TIMESTAMP,
      last_reset_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  /**
   * Initialize circuit breaker states for common action types
   */
  await db.execute(sql`
    INSERT INTO circuit_breaker_states (action_type, threshold, time_window_minutes, is_open)
    VALUES
      ('AGENT_ACTION', 20, 60, FALSE),
      ('ADMIN_USER_OPERATION', 50, 30, FALSE),
      ('GOVERNANCE_PROPOSAL_EXECUTION', 10, 1440, FALSE),
      ('BOT_TRADE', 100, 60, FALSE),
      ('ESCROW_RELEASE', 25, 60, FALSE)
    ON CONFLICT (action_type) DO NOTHING;
  `);

  /**
   * Create index for circuit breaker state lookups
   */
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_circuit_breaker_states_action_type ON circuit_breaker_states(action_type);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_circuit_breaker_states_is_open ON circuit_breaker_states(is_open);
  `);
}

export async function down(db: any) {
  // Drop tables in reverse order of creation
  await db.execute(sql`DROP TABLE IF EXISTS circuit_breaker_states;`);
  await db.execute(sql`DROP TABLE IF EXISTS emergency_stop_alerts;`);
  await db.execute(sql`DROP TABLE IF EXISTS emergency_stop_logs;`);
}
