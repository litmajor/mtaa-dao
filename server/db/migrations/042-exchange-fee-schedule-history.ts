import { pool } from '../../db';

export async function migrateExchangeFeeScheduleHistory(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS exchange_fee_schedule_history (
      id BIGSERIAL PRIMARY KEY,
      exchange TEXT NOT NULL,
      user_id TEXT,
      effective_from TIMESTAMPTZ NOT NULL,
      effective_to TIMESTAMPTZ,
      source_type TEXT NOT NULL CHECK (source_type IN ('bootstrap', 'manual', 'api-sync')),
      reason TEXT,
      changed_by TEXT,
      schedule_info JSONB NOT NULL,
      last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT exchange_fee_schedule_history_valid_dates
        CHECK (effective_to IS NULL OR effective_to > effective_from)
    )
  `);
  await pool.query(`
    ALTER TABLE exchange_fee_schedule_history
    ADD COLUMN IF NOT EXISTS user_id TEXT
  `);
  await pool.query(`
    ALTER TABLE exchange_fee_schedule_history
    ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await pool.query(`
    DROP INDEX IF EXISTS exchange_fee_schedule_history_one_current
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS exchange_fee_schedule_history_one_current
    ON exchange_fee_schedule_history (exchange, COALESCE(user_id, ''))
    WHERE effective_to IS NULL
  `);
  await pool.query(`
    DROP INDEX IF EXISTS exchange_fee_schedule_history_timeline
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS exchange_fee_schedule_history_timeline
    ON exchange_fee_schedule_history (exchange, user_id, effective_from DESC)
  `);
  console.log('✅ Exchange fee schedule history table created');
}

export async function rollbackExchangeFeeScheduleHistory(): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS exchange_fee_schedule_history');
  console.log('✅ Exchange fee schedule history table dropped');
}
