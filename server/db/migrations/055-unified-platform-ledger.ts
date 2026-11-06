import { pool } from '../../db';
import { Logger } from '../../utils/logger';

const logger = new Logger('unified-platform-ledger-migration');

export async function migrateUnifiedPlatformLedger(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.platform_ledger_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID UNIQUE REFERENCES public.accounts(id) ON DELETE CASCADE,
        owner_type VARCHAR(24) NOT NULL,
        owner_id VARCHAR(255) NOT NULL,
        account_code VARCHAR(48) NOT NULL,
        currency VARCHAR(16) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS platform_ledger_accounts_owner_scope_idx
        ON public.platform_ledger_accounts (owner_type, owner_id, account_code, currency);
      CREATE UNIQUE INDEX IF NOT EXISTS platform_ledger_system_account_uq
        ON public.platform_ledger_accounts (owner_type, owner_id, account_code, currency)
        WHERE account_id IS NULL;

      CREATE TABLE IF NOT EXISTS public.platform_ledger_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reference VARCHAR(255) NOT NULL UNIQUE,
        source_type VARCHAR(48) NOT NULL,
        source_id VARCHAR(255),
        description TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS platform_ledger_transactions_source_idx
        ON public.platform_ledger_transactions (source_type, source_id);

      CREATE TABLE IF NOT EXISTS public.platform_ledger_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID NOT NULL REFERENCES public.platform_ledger_transactions(id) ON DELETE RESTRICT,
        ledger_account_id UUID NOT NULL REFERENCES public.platform_ledger_accounts(id) ON DELETE RESTRICT,
        side VARCHAR(6) NOT NULL CHECK (side IN ('debit', 'credit')),
        amount NUMERIC(36, 8) NOT NULL CHECK (amount > 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (transaction_id, ledger_account_id, side)
      );
      CREATE INDEX IF NOT EXISTS platform_ledger_entries_transaction_idx
        ON public.platform_ledger_entries (transaction_id);
      CREATE INDEX IF NOT EXISTS platform_ledger_entries_account_idx
        ON public.platform_ledger_entries (ledger_account_id);

      CREATE TABLE IF NOT EXISTS public.platform_ledger_migration_conflicts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255),
        dao_id UUID,
        currency VARCHAR(16) NOT NULL,
        account_balance NUMERIC(36, 8),
        user_balance_cache NUMERIC(36, 8),
        conflict_type VARCHAR(48) NOT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS platform_ledger_migration_conflicts_open_idx
        ON public.platform_ledger_migration_conflicts (created_at)
        WHERE resolved_at IS NULL;

      ALTER TABLE public.user_balances
        ADD COLUMN IF NOT EXISTS dao_id UUID,
        ADD COLUMN IF NOT EXISTS total_balance NUMERIC(18, 8) NOT NULL DEFAULT 0;

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'user_balances'
            AND column_name = 'balance'
        ) THEN
          EXECUTE '
            UPDATE public.user_balances
            SET total_balance = balance
            WHERE total_balance = 0 AND COALESCE(balance, 0) <> 0
          ';
        END IF;
      END;
      $$;

    `);

    const conflicts = await client.query(`
      WITH account_totals AS (
        SELECT user_id, dao_id, currency, SUM(balance::numeric) AS balance
        FROM public.accounts
        GROUP BY user_id, dao_id, currency
      )
      INSERT INTO public.platform_ledger_migration_conflicts
        (user_id, dao_id, currency, account_balance, user_balance_cache, conflict_type, details)
      SELECT
        COALESCE(a.user_id, b.user_id),
        COALESCE(a.dao_id, b.dao_id),
        COALESCE(a.currency, b.currency),
        a.balance,
        b.total_balance::numeric,
        'account_vs_user_balance',
        jsonb_build_object(
          'message', 'No automatic credit was created because accounts and user_balances disagree or only one side exists.'
        )
      FROM account_totals a
      FULL OUTER JOIN public.user_balances b
        ON a.user_id = b.user_id
        AND a.currency = b.currency
        AND a.dao_id IS NOT DISTINCT FROM b.dao_id
      WHERE a.balance IS DISTINCT FROM b.total_balance::numeric
        AND NOT EXISTS (
          SELECT 1
          FROM public.platform_ledger_migration_conflicts existing
          WHERE existing.conflict_type = 'account_vs_user_balance'
            AND existing.user_id = COALESCE(a.user_id, b.user_id)
            AND existing.currency = COALESCE(a.currency, b.currency)
            AND existing.dao_id IS NOT DISTINCT FROM COALESCE(a.dao_id, b.dao_id)
            AND existing.resolved_at IS NULL
        )
    `);

    await client.query(`
      INSERT INTO public.platform_ledger_migration_conflicts
        (user_id, dao_id, currency, account_balance, conflict_type, details)
      SELECT
        user_id,
        dao_id,
        currency,
        SUM(balance::numeric),
        'duplicate_account_scope',
        jsonb_build_object(
          'account_count', COUNT(*),
          'message', 'Duplicate account scopes were retained as separate accounts; no balances were merged.'
        )
      FROM public.accounts
      GROUP BY user_id, dao_id, currency, account_type
      HAVING COUNT(*) > 1
        AND NOT EXISTS (
          SELECT 1
          FROM public.platform_ledger_migration_conflicts existing
          WHERE existing.conflict_type = 'duplicate_account_scope'
            AND existing.user_id = accounts.user_id
            AND existing.currency = accounts.currency
            AND existing.dao_id IS NOT DISTINCT FROM accounts.dao_id
            AND existing.resolved_at IS NULL
        )
    `);

    await client.query(`
      INSERT INTO public.platform_ledger_migration_conflicts
        (user_id, currency, account_balance, user_balance_cache, conflict_type, details)
      SELECT
        users.id,
        'UNSCOPED',
        NULL,
        users.balance::numeric,
        'unscoped_legacy_balance',
        jsonb_build_object(
          'message', 'users.balance has no currency/account scope and was not imported into the canonical ledger.'
        )
      FROM public.users
      WHERE COALESCE(users.balance::numeric, 0) <> 0
        AND NOT EXISTS (
          SELECT 1
          FROM public.platform_ledger_migration_conflicts existing
          WHERE existing.conflict_type = 'unscoped_legacy_balance'
            AND existing.user_id = users.id
            AND existing.resolved_at IS NULL
        )
    `);

    await client.query(`
      DO $$
      BEGIN
        IF to_regclass('public.wallet_ledger') IS NOT NULL THEN
          EXECUTE $legacy$
            INSERT INTO public.platform_ledger_migration_conflicts
              (user_id, currency, account_balance, user_balance_cache, conflict_type, details)
            SELECT
              legacy.user_id,
              'UNSCOPED',
              NULL,
              SUM(CASE WHEN legacy.type = 'credit' THEN legacy.amount ELSE -legacy.amount END),
              'unscoped_legacy_wallet_ledger',
              jsonb_build_object(
                'entry_count', COUNT(*),
                'message', 'Legacy wallet_ledger has no currency or account scope and was not imported.'
              )
            FROM public.wallet_ledger legacy
            GROUP BY legacy.user_id
            HAVING NOT EXISTS (
              SELECT 1
              FROM public.platform_ledger_migration_conflicts existing
              WHERE existing.conflict_type = 'unscoped_legacy_wallet_ledger'
                AND existing.user_id = legacy.user_id
                AND existing.resolved_at IS NULL
            )
          $legacy$;
        END IF;
      END
      $$;
    `);

    await client.query(`
      INSERT INTO public.platform_ledger_accounts
        (account_id, owner_type, owner_id, account_code, currency)
      SELECT id, 'platform_account', id::text, account_type, currency
      FROM public.accounts
      ON CONFLICT (account_id) DO NOTHING;

      INSERT INTO public.platform_ledger_accounts
        (owner_type, owner_id, account_code, currency)
      SELECT DISTINCT 'platform', 'platform', 'opening_balance', currency
      FROM public.accounts
      ON CONFLICT DO NOTHING;

      INSERT INTO public.platform_ledger_transactions
        (reference, source_type, source_id, description, metadata)
      SELECT
        'legacy-opening:' || id::text,
        'legacy_opening_balance',
        id::text,
        'Opening balance imported from canonical accounts.balance',
        jsonb_build_object('source_table', 'accounts', 'cutover_policy', 'accounts-only')
      FROM public.accounts
      WHERE COALESCE(balance::numeric, 0) <> 0
      ON CONFLICT (reference) DO NOTHING;

      INSERT INTO public.platform_ledger_entries
        (transaction_id, ledger_account_id, side, amount)
      SELECT
        transaction.id,
        account_ledger.id,
        CASE WHEN account.balance::numeric > 0 THEN 'credit' ELSE 'debit' END,
        ABS(account.balance::numeric)
      FROM public.accounts account
      JOIN public.platform_ledger_accounts account_ledger ON account_ledger.account_id = account.id
      JOIN public.platform_ledger_transactions transaction
        ON transaction.reference = 'legacy-opening:' || account.id::text
      WHERE COALESCE(account.balance::numeric, 0) <> 0
      ON CONFLICT (transaction_id, ledger_account_id, side) DO NOTHING;

      INSERT INTO public.platform_ledger_entries
        (transaction_id, ledger_account_id, side, amount)
      SELECT
        transaction.id,
        system_ledger.id,
        CASE WHEN account.balance::numeric > 0 THEN 'debit' ELSE 'credit' END,
        ABS(account.balance::numeric)
      FROM public.accounts account
      JOIN public.platform_ledger_transactions transaction
        ON transaction.reference = 'legacy-opening:' || account.id::text
      JOIN public.platform_ledger_accounts system_ledger
        ON system_ledger.account_id IS NULL
        AND system_ledger.owner_type = 'platform'
        AND system_ledger.owner_id = 'platform'
        AND system_ledger.account_code = 'opening_balance'
        AND system_ledger.currency = account.currency
      WHERE COALESCE(account.balance::numeric, 0) <> 0
      ON CONFLICT (transaction_id, ledger_account_id, side) DO NOTHING;
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION public.capture_account_balance_ledger_delta()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
        prior_balance NUMERIC(36, 8) := 0;
        delta NUMERIC(36, 8);
        account_ledger_id UUID;
        system_ledger_id UUID;
        ledger_transaction_id UUID;
      BEGIN
        IF current_setting('app.platform_ledger_skip_delta', true) = 'on' THEN
          RETURN NEW;
        END IF;

        IF TG_OP = 'UPDATE' THEN
          prior_balance := COALESCE(OLD.balance::numeric, 0);
        END IF;
        delta := COALESCE(NEW.balance::numeric, 0) - prior_balance;
        IF delta = 0 THEN
          RETURN NEW;
        END IF;

        INSERT INTO public.platform_ledger_accounts
          (account_id, owner_type, owner_id, account_code, currency)
        VALUES (NEW.id, 'platform_account', NEW.id::text, NEW.account_type, NEW.currency)
        ON CONFLICT (account_id) DO NOTHING;
        SELECT id INTO account_ledger_id
        FROM public.platform_ledger_accounts WHERE account_id = NEW.id;

        INSERT INTO public.platform_ledger_accounts
          (owner_type, owner_id, account_code, currency)
        VALUES ('platform', 'platform', 'balance_adjustment', NEW.currency)
        ON CONFLICT DO NOTHING;
        SELECT id INTO system_ledger_id
        FROM public.platform_ledger_accounts
        WHERE account_id IS NULL
          AND owner_type = 'platform'
          AND owner_id = 'platform'
          AND account_code = 'balance_adjustment'
          AND currency = NEW.currency;

        INSERT INTO public.platform_ledger_transactions
          (reference, source_type, source_id, description, metadata)
        VALUES (
          'account-delta:' || txid_current()::text || ':' || NEW.id::text || ':' || gen_random_uuid()::text,
          'account_balance_change',
          NEW.id::text,
          'Account balance change journaled atomically',
          jsonb_build_object(
            'transaction_id', txid_current(),
            'account_id', NEW.id,
            'old_balance', prior_balance,
            'new_balance', NEW.balance::numeric
          )
        )
        RETURNING id INTO ledger_transaction_id;

        INSERT INTO public.platform_ledger_entries
          (transaction_id, ledger_account_id, side, amount)
        VALUES (
          ledger_transaction_id,
          account_ledger_id,
          CASE WHEN delta > 0 THEN 'credit' ELSE 'debit' END,
          ABS(delta)
        );
        INSERT INTO public.platform_ledger_entries
          (transaction_id, ledger_account_id, side, amount)
        VALUES (
          ledger_transaction_id,
          system_ledger_id,
          CASE WHEN delta > 0 THEN 'debit' ELSE 'credit' END,
          ABS(delta)
        );

        RETURN NEW;
      END;
      $$;

      DROP TRIGGER IF EXISTS accounts_balance_ledger_delta ON public.accounts;
      CREATE TRIGGER accounts_balance_ledger_delta
        AFTER INSERT OR UPDATE OF balance ON public.accounts
        FOR EACH ROW
        EXECUTE FUNCTION public.capture_account_balance_ledger_delta();

      CREATE OR REPLACE FUNCTION public.prevent_platform_ledger_mutation()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'Platform ledger records are append-only';
      END;
      $$;

      DROP TRIGGER IF EXISTS platform_ledger_entries_immutable ON public.platform_ledger_entries;
      CREATE TRIGGER platform_ledger_entries_immutable
        BEFORE UPDATE OR DELETE ON public.platform_ledger_entries
        FOR EACH ROW EXECUTE FUNCTION public.prevent_platform_ledger_mutation();

      DROP TRIGGER IF EXISTS platform_ledger_transactions_immutable ON public.platform_ledger_transactions;
      CREATE TRIGGER platform_ledger_transactions_immutable
        BEFORE UPDATE OR DELETE ON public.platform_ledger_transactions
        FOR EACH ROW EXECUTE FUNCTION public.prevent_platform_ledger_mutation();

      CREATE OR REPLACE FUNCTION public.assert_platform_ledger_transaction_balanced()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
        invalid_currency VARCHAR(16);
        entry_count BIGINT;
      BEGIN
        SELECT COUNT(*) INTO entry_count
        FROM public.platform_ledger_entries
        WHERE transaction_id = NEW.transaction_id;
        IF entry_count < 2 THEN
          RAISE EXCEPTION 'Platform ledger transaction % has fewer than two entries',
            NEW.transaction_id;
        END IF;

        SELECT ledger_account.currency
        INTO invalid_currency
        FROM public.platform_ledger_entries entry
        JOIN public.platform_ledger_accounts ledger_account
          ON ledger_account.id = entry.ledger_account_id
        WHERE entry.transaction_id = NEW.transaction_id
        GROUP BY ledger_account.currency
        HAVING SUM(CASE WHEN entry.side = 'debit' THEN entry.amount ELSE -entry.amount END) <> 0
        LIMIT 1;

        IF invalid_currency IS NOT NULL THEN
          RAISE EXCEPTION 'Unbalanced platform ledger transaction % for currency %',
            NEW.transaction_id, invalid_currency;
        END IF;
        RETURN NULL;
      END;
      $$;

      DROP TRIGGER IF EXISTS platform_ledger_entries_balanced ON public.platform_ledger_entries;
      CREATE CONSTRAINT TRIGGER platform_ledger_entries_balanced
        AFTER INSERT ON public.platform_ledger_entries
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW
        EXECUTE FUNCTION public.assert_platform_ledger_transaction_balanced();
    `);

    await client.query('COMMIT');
    logger.info('Unified platform ledger installed and account opening balances imported', {
      projectionConflictsRecorded: conflicts.rowCount ?? 0,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Unified platform ledger migration failed', { error });
    throw error;
  } finally {
    client.release();
  }
}
