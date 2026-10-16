import { pool } from '../../db';

export async function migratePoolShareIdempotency(): Promise<void> {
  await pool.query(`
    ALTER TABLE pool_investments
      ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(200);
    ALTER TABLE pool_withdrawals
      ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(200);

    CREATE UNIQUE INDEX IF NOT EXISTS pool_investments_idempotency_uq
      ON pool_investments (pool_id, user_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS pool_withdrawals_idempotency_uq
      ON pool_withdrawals (pool_id, user_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL;
  `);
}

export async function rollbackPoolShareIdempotency(): Promise<void> {
  await pool.query(`
    DROP INDEX IF EXISTS pool_withdrawals_idempotency_uq;
    DROP INDEX IF EXISTS pool_investments_idempotency_uq;
    ALTER TABLE pool_withdrawals DROP COLUMN IF EXISTS idempotency_key;
    ALTER TABLE pool_investments DROP COLUMN IF EXISTS idempotency_key;
  `);
}
