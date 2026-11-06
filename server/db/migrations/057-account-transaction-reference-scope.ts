import { pool } from '../../db';
import { Logger } from '../../utils/logger';

const logger = new Logger('account-transaction-reference-scope-migration');

export async function migrateAccountTransactionReferenceScope(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_index AS indexes
          JOIN pg_attribute AS reference_column
            ON reference_column.attrelid = indexes.indrelid
           AND reference_column.attname = 'reference'
           AND NOT reference_column.attisdropped
          JOIN pg_attribute AS account_column
            ON account_column.attrelid = indexes.indrelid
           AND account_column.attname = 'account_id'
           AND NOT account_column.attisdropped
          WHERE indexes.indrelid = 'public.account_transactions'::REGCLASS
            AND indexes.indexrelid = to_regclass('public.account_transactions_reference_idx')
            AND indexes.indisunique
            AND indexes.indisvalid
            AND indexes.indisready
            AND indexes.indpred IS NULL
            AND indexes.indnkeyatts = 2
            AND indexes.indnatts = 2
            AND indexes.indkey[0] = reference_column.attnum
            AND indexes.indkey[1] = account_column.attnum
        ) THEN
          DROP INDEX IF EXISTS public.account_transactions_reference_idx;
          CREATE UNIQUE INDEX account_transactions_reference_idx
            ON public.account_transactions (reference, account_id);
        END IF;
      END
      $$;
    `);
    await client.query('COMMIT');
    logger.info('Account transaction references are now unique per account');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to scope account transaction references by account', { error });
    throw error;
  } finally {
    client.release();
  }
}
