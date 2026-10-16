import { pool } from '../../db';
import { Logger } from '../../utils/logger';

const logger = new Logger('wallet-registration-hardening-migration');

export async function migrateWalletRegistrationHardening(): Promise<void> {
  logger.info('Applying wallet registration constraints and label');
  try {
    await pool.query(`
      DO $$
      BEGIN
        IF to_regclass('public.wallets') IS NULL THEN
          RAISE EXCEPTION 'wallets table does not exist';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM public.wallets
          WHERE is_active = true
          GROUP BY user_id, currency, wallet_type
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION
            'Cannot create wallets_user_currency_type_active_uq: duplicate active wallet type/currency rows exist';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM public.wallets
          GROUP BY lower(address)
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION
            'Cannot create wallets_address_uq: case-insensitive duplicate wallet addresses exist';
        END IF;
      END
      $$;

      ALTER TABLE public.wallets
        ADD COLUMN IF NOT EXISTS label TEXT;

      CREATE UNIQUE INDEX IF NOT EXISTS wallets_user_currency_type_active_uq
        ON public.wallets (user_id, currency, wallet_type)
        WHERE is_active = true;

      CREATE UNIQUE INDEX IF NOT EXISTS wallets_address_uq
        ON public.wallets (lower(address));
    `);
    logger.info('Wallet registration constraints and label applied');
  } catch (error) {
    logger.error('Failed to apply wallet registration schema', error);
    throw error;
  }
}

export async function rollbackWalletRegistrationHardening(): Promise<void> {
  logger.info('Rolling back wallet registration constraints and label');
  try {
    await pool.query(`
      DROP INDEX IF EXISTS public.wallets_address_uq;
      DROP INDEX IF EXISTS public.wallets_user_currency_type_active_uq;
      ALTER TABLE public.wallets DROP COLUMN IF EXISTS label;
    `);
    logger.info('Wallet registration constraints and label rolled back');
  } catch (error) {
    logger.error('Failed to roll back wallet registration schema', error);
    throw error;
  }
}
