import os
from dotenv import load_dotenv
from pg import Connection

load_dotenv('.env')
url = os.getenv('DATABASE_URL')
if not url:
    raise SystemExit('DATABASE_URL is not set')

print('Using DATABASE_URL=', url)

# Connect and create required tables
conn = Connection(url)
conn.execute('CREATE EXTENSION IF NOT EXISTS pgcrypto;')
conn.execute("""
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);
""")
conn.execute('CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);')
conn.execute("""
CREATE TABLE IF NOT EXISTS action_reversals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(50) NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  status VARCHAR(50) NOT NULL CHECK (status IN ('INITIATED','PENDING_CONFIRMATION','GRACE_PERIOD','REVERSIBLE_UNTIL','EXECUTED','IRREVERSIBLE','REVERSED','EMERGENCY_STOPPED')),
  initiator_id VARCHAR(255) NOT NULL,
  initiator_type VARCHAR(50) NOT NULL CHECK (initiator_type IN ('USER','AGENT','SYSTEM','ADMIN','DAO_GOVERNANCE')),
  initiator_role VARCHAR(100),
  initiator_email VARCHAR(255),
  affected_entity_type VARCHAR(100) NOT NULL,
  affected_entity_id VARCHAR(255) NOT NULL,
  affected_entity_name VARCHAR(255),
  action_payload JSONB NOT NULL,
  before_state JSONB NOT NULL,
  after_state JSONB NOT NULL,
  confirmation_type VARCHAR(50) NOT NULL DEFAULT 'NONE' CHECK (confirmation_type IN ('NONE','EMAIL','PIN','APPROVAL_BOARD','MULTI_SIG','DAO_VOTE')),
  required_approvals INTEGER,
  approver_roles TEXT[],
  confirmation_timeout_minutes INTEGER NOT NULL DEFAULT 1440,
  grace_period_duration_hours INTEGER NOT NULL,
  grace_period_reminder_hours INTEGER[] NOT NULL DEFAULT ARRAY[24,6,1],
  user_can_accelerate BOOLEAN NOT NULL DEFAULT FALSE,
  auto_execute_at_deadline BOOLEAN NOT NULL DEFAULT FALSE,
  reversible_fields TEXT[] NOT NULL,
  initiator_can_reverse BOOLEAN NOT NULL DEFAULT TRUE,
  admin_can_reverse BOOLEAN NOT NULL DEFAULT TRUE,
  governance_can_reverse BOOLEAN NOT NULL DEFAULT FALSE,
  minimum_role_to_reverse VARCHAR(100),
  reversal_deadline_hours INTEGER,
  partial_reversal_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  emergency_stop_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  emergency_stop_allowed_actors TEXT[] DEFAULT ARRAY['SUPERUSER','GOVERNANCE'],
  emergency_stop_requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  emergency_stop_duration_hours INTEGER DEFAULT 24,
  emergency_stop_action VARCHAR(50) DEFAULT 'PAUSE' CHECK (emergency_stop_action IN ('PAUSE','CANCEL','ROLLBACK')),
  emergency_stop_appealable BOOLEAN NOT NULL DEFAULT TRUE,
  circuit_breaker_action_count INTEGER DEFAULT 0,
  circuit_breaker_threshold INTEGER,
  circuit_breaker_window_minutes INTEGER DEFAULT 60,
  circuit_breaker_open BOOLEAN DEFAULT FALSE,
  circuit_breaker_reset_at TIMESTAMP,
  initiated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP,
  grace_period_starts_at TIMESTAMP,
  grace_period_ends_at TIMESTAMP,
  executed_at TIMESTAMP,
  reversed_at TIMESTAMP,
  irreversible_at TIMESTAMP,
  execution_success BOOLEAN,
  execution_error TEXT,
  execution_transaction_hash VARCHAR(255),
  execution_block_number INTEGER,
  reversal_reason VARCHAR(100),
  reversed_by_id VARCHAR(255),
  reversed_by_type VARCHAR(50),
  reversed_by_role VARCHAR(100),
  reversal_reason_text TEXT,
  reversal_payload JSONB,
  reversal_transaction_hash VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
""")
conn.execute('CREATE INDEX IF NOT EXISTS idx_action_reversals_status ON action_reversals(status);')
conn.execute('CREATE INDEX IF NOT EXISTS idx_action_reversals_action_type ON action_reversals(action_type);')
conn.execute('CREATE INDEX IF NOT EXISTS idx_action_reversals_initiator ON action_reversals(initiator_id, initiator_type);')
conn.execute('CREATE INDEX IF NOT EXISTS idx_action_reversals_affected_entity ON action_reversals(affected_entity_type, affected_entity_id);')
conn.execute("CREATE INDEX IF NOT EXISTS idx_action_reversals_grace_period_ends ON action_reversals(grace_period_ends_at) WHERE status = 'GRACE_PERIOD';")
conn.execute('CREATE INDEX IF NOT EXISTS idx_action_reversals_created_at ON action_reversals(created_at DESC);')
print('Created missing tables and indexes successfully')
conn.close()
