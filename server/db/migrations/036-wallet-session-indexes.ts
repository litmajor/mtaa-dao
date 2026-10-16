import { pool } from '../../db';
import { Logger } from '../../utils/logger';

const logger = new Logger('wallet-session-indexes-migration');

export async function migrateWalletSessionIndexes(): Promise<void> {
  logger.info('Applying wallet session indexes');
  try {
    await pool.query(`
      DO $$
      BEGIN
        IF to_regclass('public.wallet_sessions') IS NULL THEN
          RAISE EXCEPTION 'wallet_sessions table does not exist';
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_index AS indexes
          JOIN pg_class AS table_class ON table_class.oid = indexes.indrelid
          JOIN pg_namespace AS table_schema ON table_schema.oid = table_class.relnamespace
          JOIN pg_attribute AS token_column
            ON token_column.attrelid = table_class.oid
           AND token_column.attname = 'session_token'
           AND NOT token_column.attisdropped
          WHERE table_schema.nspname = 'public'
            AND table_class.relname = 'wallet_sessions'
            AND indexes.indisunique
            AND indexes.indisvalid
            AND indexes.indisready
            AND indexes.indpred IS NULL
            AND indexes.indnkeyatts = 1
            AND indexes.indnatts = 1
            AND indexes.indkey[0] = token_column.attnum
        ) THEN
          CREATE UNIQUE INDEX IF NOT EXISTS wallet_sessions_token_hash_idx
            ON public.wallet_sessions (session_token);
        END IF;
      END
      $$;

      CREATE INDEX IF NOT EXISTS wallet_sessions_active_lookup_idx
        ON public.wallet_sessions (user_id, wallet_id, is_active, expires_at);

      CREATE INDEX IF NOT EXISTS wallet_sessions_expiry_idx
        ON public.wallet_sessions (expires_at)
        WHERE is_active = true;
    `);
    logger.info('Wallet session indexes applied');
  } catch (error) {
    logger.error('Failed to apply wallet session indexes', error);
    throw error;
  }
}

export async function rollbackWalletSessionIndexes(): Promise<void> {
  logger.info('Rolling back wallet session indexes');
  try {
    await pool.query(`
      DROP INDEX IF EXISTS public.wallet_sessions_expiry_idx;
      DROP INDEX IF EXISTS public.wallet_sessions_active_lookup_idx;
      DROP INDEX IF EXISTS public.wallet_sessions_token_hash_idx;
    `);
    logger.info('Wallet session indexes rolled back');
  } catch (error) {
    logger.error('Failed to roll back wallet session indexes', error);
    throw error;
  }
}
