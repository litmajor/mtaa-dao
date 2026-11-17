import { pool } from '../../db';

export async function migrateTransactionalOutboxLeases(): Promise<void> {
  await pool.query(`
    ALTER TABLE domain_events
      ADD COLUMN IF NOT EXISTS claim_token TEXT,
      ADD COLUMN IF NOT EXISTS claim_until TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_domain_events_claimable
      ON domain_events (claim_until, created_at)
      WHERE published_at IS NULL AND quarantined_at IS NULL;
  `);
}

export async function rollbackTransactionalOutboxLeases(): Promise<void> {
  await pool.query(`
    DROP INDEX IF EXISTS idx_domain_events_claimable;
    ALTER TABLE domain_events
      DROP COLUMN IF EXISTS claim_token,
      DROP COLUMN IF EXISTS claim_until,
      DROP COLUMN IF EXISTS quarantined_at;
  `);
}
