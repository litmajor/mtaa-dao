import { pool } from '../../db';
import { Logger } from '../../utils/logger';

const logger = new Logger('payment-idempotency-constraints-migration');

export async function migratePaymentIdempotencyConstraints(): Promise<void> {
  logger.info('Applying payment idempotency constraints');
  try {
    await pool.query(`
    DO $$
    DECLARE
      approvals_table_oid REGCLASS := to_regclass('public.action_approvals');
      approvals_action_column TEXT;
      approvals_approver_attnum SMALLINT;
      approvals_action_attnum SMALLINT;
    BEGIN
      IF approvals_table_oid IS NULL THEN
        RAISE EXCEPTION 'action_approvals table does not exist';
      END IF;

      IF EXISTS (
        SELECT 1 FROM pg_attribute
        WHERE attrelid = approvals_table_oid
          AND attname = 'action_id'
          AND NOT attisdropped
      ) THEN
        approvals_action_column := 'action_id';
      ELSIF EXISTS (
        SELECT 1 FROM pg_attribute
        WHERE attrelid = approvals_table_oid
          AND attname = 'action_reversal_id'
          AND NOT attisdropped
      ) THEN
        approvals_action_column := 'action_reversal_id';
      ELSE
        RAISE EXCEPTION 'action_approvals has neither action_id nor action_reversal_id';
      END IF;

      SELECT attnum INTO approvals_action_attnum
      FROM pg_attribute
      WHERE attrelid = approvals_table_oid
        AND attname = approvals_action_column
        AND NOT attisdropped;

      SELECT attnum INTO approvals_approver_attnum
      FROM pg_attribute
      WHERE attrelid = approvals_table_oid
        AND attname = 'approver_id'
        AND NOT attisdropped;

      IF approvals_approver_attnum IS NULL THEN
        RAISE EXCEPTION 'action_approvals table does not have an approver_id column';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_index AS indexes
        JOIN pg_class AS index_class ON index_class.oid = indexes.indexrelid
        WHERE indexes.indrelid = approvals_table_oid
          AND index_class.relname = 'action_approvals_unique_approver'
          AND indexes.indisunique
          AND indexes.indisvalid
          AND indexes.indisready
          AND indexes.indpred IS NULL
          AND indexes.indnkeyatts = 2
          AND indexes.indnatts = 2
          AND indexes.indkey[0] = approvals_action_attnum
          AND indexes.indkey[1] = approvals_approver_attnum
      ) THEN
        DROP INDEX IF EXISTS public.action_approvals_unique_approver;
        EXECUTE format(
          'CREATE UNIQUE INDEX action_approvals_unique_approver ON public.action_approvals (%I, approver_id)',
          approvals_action_column
        );
      END IF;

      IF to_regclass('public.account_transactions') IS NULL THEN
        RAISE EXCEPTION 'account_transactions table does not exist';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_attribute
        WHERE attrelid = 'public.account_transactions'::REGCLASS
          AND attname = 'reference'
          AND NOT attisdropped
      ) THEN
        RAISE EXCEPTION 'account_transactions table does not have a reference column';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_index AS indexes
        JOIN pg_class AS index_class ON index_class.oid = indexes.indexrelid
        JOIN pg_attribute AS reference_column
          ON reference_column.attrelid = indexes.indrelid
         AND reference_column.attname = 'reference'
         AND NOT reference_column.attisdropped
        WHERE indexes.indrelid = 'public.account_transactions'::REGCLASS
          AND index_class.relname = 'account_transactions_reference_idx'
          AND indexes.indisunique
          AND indexes.indisvalid
          AND indexes.indisready
          AND indexes.indpred IS NULL
          AND indexes.indnkeyatts = 1
          AND indexes.indnatts = 1
          AND indexes.indkey[0] = reference_column.attnum
      ) THEN
        DROP INDEX IF EXISTS public.account_transactions_reference_idx;
        CREATE UNIQUE INDEX account_transactions_reference_idx
          ON public.account_transactions (reference);
      END IF;
    END
    $$;
    `);
    logger.info('Payment idempotency constraints applied');
  } catch (error) {
    logger.error('Failed to apply payment idempotency constraints', error);
    throw error;
  }
}

export async function rollbackPaymentIdempotencyConstraints(): Promise<void> {
  logger.info('Rolling back payment idempotency constraints');
  try {
    await pool.query(`
      DROP INDEX IF EXISTS public.account_transactions_reference_idx;
      DROP INDEX IF EXISTS public.action_approvals_unique_approver;
    `);
    logger.info('Payment idempotency constraints rolled back');
  } catch (error) {
    logger.error('Failed to roll back payment idempotency constraints', error);
    throw error;
  }
}
