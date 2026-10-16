import { pool } from '../../db';
import { Logger } from '../../utils/logger';

const logger = new Logger('service-account-accounting-constraints-migration');

export async function migrateServiceAccountAccountingConstraints(): Promise<void> {
  logger.info('Applying service account accounting columns and indexes');
  try {
    await pool.query(`
      DO $$
      BEGIN
        IF to_regclass('public.chain_accounts') IS NULL THEN
          RAISE EXCEPTION 'chain_accounts table does not exist';
        END IF;
        IF to_regclass('public.cross_chain_transfers') IS NULL THEN
          RAISE EXCEPTION 'cross_chain_transfers table does not exist';
        END IF;
      END
      $$;

      ALTER TABLE public.chain_accounts
        ALTER COLUMN service_account_id TYPE TEXT
          USING service_account_id::text,
        ADD COLUMN IF NOT EXISTS balance_usd_updated_at TIMESTAMPTZ;

      ALTER TABLE public.cross_chain_transfers
        ADD COLUMN IF NOT EXISTS service_account_id TEXT;

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM public.chain_accounts
          GROUP BY service_account_id, chain, token_symbol
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION
            'Cannot create chain_accounts_svc_chain_token_uq: duplicate service-account/chain/token rows exist';
        END IF;
      END
      $$;

      CREATE UNIQUE INDEX IF NOT EXISTS chain_accounts_svc_chain_token_uq
        ON public.chain_accounts (service_account_id, chain, token_symbol);

      CREATE INDEX IF NOT EXISTS cross_chain_transfers_svc_idx
        ON public.cross_chain_transfers (service_account_id, created_at DESC);
    `);
    logger.info('Service account accounting columns and indexes applied');
  } catch (error) {
    logger.error('Failed to apply service account accounting schema', error);
    throw error;
  }
}

export async function rollbackServiceAccountAccountingConstraints(): Promise<void> {
  logger.info('Rolling back service account accounting indexes and columns');
  try {
    await pool.query(`
      DROP INDEX IF EXISTS public.cross_chain_transfers_svc_idx;
      DROP INDEX IF EXISTS public.chain_accounts_svc_chain_token_uq;
      ALTER TABLE public.cross_chain_transfers
        DROP COLUMN IF EXISTS service_account_id;
      ALTER TABLE public.chain_accounts
        DROP COLUMN IF EXISTS balance_usd_updated_at;
    `);
    logger.info('Service account accounting indexes and columns rolled back');
  } catch (error) {
    logger.error('Failed to roll back service account accounting schema', error);
    throw error;
  }
}
