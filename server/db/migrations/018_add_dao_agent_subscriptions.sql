-- Migration: add dao_agent_subscriptions and indexer_checkpoints tables (keeps parity with shared/schema.ts)
-- Run in server/db migration pipeline

CREATE TABLE IF NOT EXISTS dao_agent_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id uuid NOT NULL,
  agent_id varchar NOT NULL,
  is_active boolean DEFAULT true,
  expires_at timestamp NOT NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_dao_agent_idx ON dao_agent_subscriptions (dao_id, agent_id);

CREATE TABLE IF NOT EXISTS indexer_checkpoints (
  id varchar PRIMARY KEY,
  last_indexed_block integer NOT NULL,
  updated_at timestamp DEFAULT now()
);

-- Add foreign key constraint if table 'daos' exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'daos') THEN
    ALTER TABLE dao_agent_subscriptions
    ADD CONSTRAINT fk_dao_agent_subscriptions_dao FOREIGN KEY (dao_id) REFERENCES daos(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- ignore if constraint already exists
  NULL;
END$$;
