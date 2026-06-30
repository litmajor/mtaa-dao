-- Migration: add appPin and flags to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS app_pin varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_enabled_for_login boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_enabled_for_transfers boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_enabled_for_2fa boolean DEFAULT false;

-- Migration: add dao_tasks table
CREATE TABLE IF NOT EXISTS dao_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id uuid NOT NULL,
  title varchar NOT NULL,
  description text DEFAULT '',
  reward numeric(10, 2) DEFAULT '0',
  difficulty varchar DEFAULT 'medium',
  category varchar DEFAULT 'General',
  estimated_time varchar,
  deadline timestamp,
  status varchar DEFAULT 'open',
  created_by varchar,
  claimer varchar,
  verified_by varchar,
  cancelled_by varchar,
  claimed_at timestamp,
  completed_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'daos') THEN
    ALTER TABLE dao_tasks ADD CONSTRAINT fk_dao_tasks_dao FOREIGN KEY (dao_id) REFERENCES daos(id) ON DELETE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'users') THEN
    ALTER TABLE dao_tasks ADD CONSTRAINT fk_dao_tasks_creator FOREIGN KEY (created_by) REFERENCES users(id);
    ALTER TABLE dao_tasks ADD CONSTRAINT fk_dao_tasks_claimer FOREIGN KEY (claimer) REFERENCES users(id);
    ALTER TABLE dao_tasks ADD CONSTRAINT fk_dao_tasks_verifier FOREIGN KEY (verified_by) REFERENCES users(id);
    ALTER TABLE dao_tasks ADD CONSTRAINT fk_dao_tasks_canceller FOREIGN KEY (cancelled_by) REFERENCES users(id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END$$;

-- Migration: add dao_agent_subscriptions and indexer_checkpoints tables (keeps parity with shared/schema.ts)
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
