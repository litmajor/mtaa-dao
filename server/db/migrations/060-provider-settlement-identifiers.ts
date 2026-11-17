import { pool } from '../../db';

export async function migrateProviderSettlementIdentifiers() {
  await pool.query(`
    ALTER TABLE payment_transactions
      ADD COLUMN IF NOT EXISTS provider_reference TEXT;

    CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_reference_uq
      ON payment_transactions (provider, provider_reference)
      WHERE provider_reference IS NOT NULL;
  `);
}

export async function rollbackProviderSettlementIdentifiers() {
  await pool.query(`
    DROP INDEX IF EXISTS payment_transactions_provider_reference_uq;
    ALTER TABLE payment_transactions
      DROP COLUMN IF EXISTS provider_reference;
  `);
}
