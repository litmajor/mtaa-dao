import { pool } from '../../db';

export async function migrateNavOracleState(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS nav_oracle_state (
      vault_id TEXT PRIMARY KEY,
      nonce BIGINT NOT NULL DEFAULT 0 CHECK (nonce >= 0),
      last_nav JSONB,
      last_nav_timestamp BIGINT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (last_nav_timestamp IS NULL OR last_nav_timestamp >= 0)
    )
  `);
  console.log('✅ NAV oracle durable state table created');
}

export async function rollbackNavOracleState(): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS nav_oracle_state');
  console.log('✅ NAV oracle durable state table dropped');
}
