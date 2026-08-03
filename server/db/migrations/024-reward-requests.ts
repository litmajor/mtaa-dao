import { pool } from '../../db';

export async function migrateRewardRequestsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reward_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL,
      user_achievement_id UUID NOT NULL,
      amount_units NUMERIC(38,0) NOT NULL,
      status VARCHAR NOT NULL DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      idempotency_key VARCHAR NOT NULL,
      tx_hash VARCHAR,
      last_attempt_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    );

    ALTER TABLE reward_requests ADD COLUMN IF NOT EXISTS user_id VARCHAR;
    ALTER TABLE reward_requests ADD COLUMN IF NOT EXISTS user_achievement_id UUID;
    ALTER TABLE reward_requests ADD COLUMN IF NOT EXISTS amount_units NUMERIC(38,0);
    ALTER TABLE reward_requests ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'pending';
    ALTER TABLE reward_requests ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
    ALTER TABLE reward_requests ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR;
    ALTER TABLE reward_requests ADD COLUMN IF NOT EXISTS tx_hash VARCHAR;
    ALTER TABLE reward_requests ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
    ALTER TABLE reward_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE reward_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE reward_requests ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_requests_idempotency ON reward_requests (idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_reward_requests_status ON reward_requests (status);
  `);
}

export async function rollbackRewardRequestsTable(): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS reward_requests CASCADE');
}
