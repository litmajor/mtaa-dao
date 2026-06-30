-- Create Table: dao_agent_subscriptions
CREATE TABLE IF NOT EXISTS dao_agent_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  agent_id VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create Table: indexer_checkpoints
CREATE TABLE IF NOT EXISTS indexer_checkpoints (
  id VARCHAR(255) PRIMARY KEY,
  last_indexed_block INTEGER NOT NULL,
  updated_at TIMESTAMP DEFAULT now()
);

-- Indexes for performance & uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS unique_dao_agent_idx ON dao_agent_subscriptions (dao_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_dao_agent_subscriptions_dao ON dao_agent_subscriptions (dao_id);
CREATE INDEX IF NOT EXISTS idx_dao_agent_subscriptions_agent ON dao_agent_subscriptions (agent_id);
