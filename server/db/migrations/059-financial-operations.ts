import { pool } from "../../db";

export async function migrateFinancialOperations(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS financial_operations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      operation_type VARCHAR(32) NOT NULL
        CHECK (operation_type IN ('deposit', 'withdrawal', 'transfer', 'dao_contribution', 'disbursement')),
      source_domain VARCHAR(64) NOT NULL,
      destination_domain VARCHAR(64) NOT NULL,
      asset VARCHAR(128) NOT NULL,
      amount NUMERIC(78, 36) NOT NULL CHECK (amount > 0),
      status VARCHAR(32) NOT NULL DEFAULT 'initiated'
        CHECK (status IN (
          'initiated', 'awaiting_authorization', 'authorized', 'settlement_pending',
          'settled', 'accounting_pending', 'completed', 'failed', 'reconciliation_required'
        )),
      idempotency_key VARCHAR(200) NOT NULL UNIQUE,
      external_reference TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (external_reference IS NULL OR length(btrim(external_reference)) > 0)
    );

    CREATE INDEX IF NOT EXISTS financial_operations_status_created_idx
      ON financial_operations (status, created_at);

    CREATE TABLE IF NOT EXISTS financial_operation_events (
      id BIGSERIAL PRIMARY KEY,
      operation_id UUID NOT NULL REFERENCES financial_operations(id) ON DELETE RESTRICT,
      event_type VARCHAR(40) NOT NULL,
      from_status VARCHAR(32),
      to_status VARCHAR(32),
      actor TEXT NOT NULL DEFAULT 'system',
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS financial_operation_events_operation_created_idx
      ON financial_operation_events (operation_id, created_at);

    CREATE TABLE IF NOT EXISTS financial_operation_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      operation_id UUID NOT NULL REFERENCES financial_operations(id) ON DELETE RESTRICT,
      record_type VARCHAR(40) NOT NULL
        CHECK (record_type IN (
          'payment_transaction', 'dao_contribution', 'proposal', 'wallet_transaction',
          'account_transaction', 'vault_transaction', 'blockchain_transaction',
          'stable_inflow_event', 'dao_rotation_payout'
        )),
      record_id TEXT NOT NULL CHECK (length(btrim(record_id)) > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (record_type, record_id)
    );

    CREATE INDEX IF NOT EXISTS financial_operation_links_operation_idx
      ON financial_operation_links (operation_id);

    CREATE OR REPLACE FUNCTION append_financial_operation_event(
      p_operation_id UUID,
      p_event_type VARCHAR,
      p_from_status VARCHAR,
      p_to_status VARCHAR,
      p_details JSONB DEFAULT '{}'::jsonb
    ) RETURNS VOID
    LANGUAGE plpgsql
    AS $$
    DECLARE
      event_actor TEXT;
      event_details JSONB;
    BEGIN
      event_actor := COALESCE(
        NULLIF(current_setting('app.financial_operation_actor', true), ''),
        'system'
      );
      event_details := COALESCE(p_details, '{}'::jsonb);
      INSERT INTO financial_operation_events
        (operation_id, event_type, from_status, to_status, actor, details)
      VALUES
        (p_operation_id, p_event_type, p_from_status, p_to_status, event_actor, event_details);
    END;
    $$;

    CREATE OR REPLACE FUNCTION guard_financial_operation_mutation()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    DECLARE
      event_details JSONB;
      transition_details JSONB;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'financial operations cannot be deleted; use a reversal operation';
      END IF;

      IF current_setting('app.financial_operation_service', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'financial operations must be changed through FinancialOperationService';
      END IF;

      IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'initiated' THEN
          RAISE EXCEPTION 'financial operations must be created in initiated status';
        END IF;
        RETURN NEW;
      END IF;

      IF NEW.id IS DISTINCT FROM OLD.id
        OR NEW.operation_type IS DISTINCT FROM OLD.operation_type
        OR NEW.source_domain IS DISTINCT FROM OLD.source_domain
        OR NEW.destination_domain IS DISTINCT FROM OLD.destination_domain
        OR NEW.asset IS DISTINCT FROM OLD.asset
        OR NEW.amount IS DISTINCT FROM OLD.amount
        OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
        OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'financial operation identity fields are immutable';
      END IF;

      IF OLD.external_reference IS NOT NULL
        AND NEW.external_reference IS DISTINCT FROM OLD.external_reference THEN
        RAISE EXCEPTION 'financial operation external reference cannot be replaced';
      END IF;
      IF OLD.status IN ('completed', 'failed')
        AND NEW.external_reference IS DISTINCT FROM OLD.external_reference THEN
        RAISE EXCEPTION 'terminal financial operations cannot be changed';
      END IF;
      IF NEW.external_reference IS NOT NULL AND length(btrim(NEW.external_reference)) = 0 THEN
        RAISE EXCEPTION 'financial operation external reference cannot be blank';
      END IF;

      IF NEW.status IS DISTINCT FROM OLD.status THEN
        transition_details := COALESCE(
          NULLIF(current_setting('app.financial_operation_details', true), '')::jsonb,
          '{}'::jsonb
        );
        IF NEW.status = 'settled' AND (
          COALESCE(transition_details->>'evidenceType', '') NOT IN ('provider', 'blockchain', 'manual', 'internal_ledger')
          OR length(btrim(COALESCE(transition_details->>'evidenceReference', ''))) = 0
        ) THEN
          RAISE EXCEPTION 'settled requires settlement evidence type and reference';
        END IF;
        IF NEW.status = 'completed' AND NOT EXISTS (
          SELECT 1
          FROM financial_operation_links
          WHERE operation_id = NEW.id
            AND record_type IN ('wallet_transaction', 'account_transaction', 'dao_contribution', 'vault_transaction')
        ) THEN
          RAISE EXCEPTION 'completed requires a linked authoritative accounting record';
        END IF;
        IF NOT (
          (OLD.status = 'initiated' AND NEW.status IN ('awaiting_authorization', 'authorized', 'settlement_pending', 'failed', 'reconciliation_required'))
          OR (OLD.status = 'awaiting_authorization' AND NEW.status IN ('authorized', 'failed', 'reconciliation_required'))
          OR (OLD.status = 'authorized' AND NEW.status IN ('settlement_pending', 'failed', 'reconciliation_required'))
          OR (OLD.status = 'settlement_pending' AND NEW.status IN ('settled', 'failed', 'reconciliation_required'))
          OR (OLD.status = 'settled' AND NEW.status IN ('accounting_pending', 'reconciliation_required'))
          OR (OLD.status = 'accounting_pending' AND NEW.status IN ('completed', 'failed', 'reconciliation_required'))
          OR (OLD.status = 'reconciliation_required' AND NEW.status IN ('settlement_pending', 'settled', 'accounting_pending', 'failed'))
        ) THEN
          RAISE EXCEPTION 'invalid financial operation transition: % -> %', OLD.status, NEW.status;
        END IF;
      ELSIF NEW.external_reference IS NOT DISTINCT FROM OLD.external_reference THEN
        RAISE EXCEPTION 'financial operation update must change status or set an external reference';
      END IF;

      NEW.updated_at := NOW();
      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION record_financial_operation_change()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    DECLARE
      transition_details JSONB;
    BEGIN
      IF TG_OP = 'INSERT' THEN
        PERFORM append_financial_operation_event(
          NEW.id,
          'operation_created',
          NULL,
          NEW.status,
          jsonb_build_object(
            'operationType', NEW.operation_type,
            'sourceDomain', NEW.source_domain,
            'destinationDomain', NEW.destination_domain,
            'asset', NEW.asset,
            'amount', NEW.amount::text,
            'idempotencyKey', NEW.idempotency_key
          )
        );
        IF NEW.external_reference IS NOT NULL THEN
          PERFORM append_financial_operation_event(
            NEW.id,
            'external_reference_recorded',
            NULL,
            NEW.status,
            jsonb_build_object('externalReference', NEW.external_reference)
          );
        END IF;
        RETURN NEW;
      END IF;

      IF NEW.status IS DISTINCT FROM OLD.status THEN
        transition_details := COALESCE(
          NULLIF(current_setting('app.financial_operation_details', true), '')::jsonb,
          '{}'::jsonb
        );
        PERFORM append_financial_operation_event(
          NEW.id,
          'status_changed',
          OLD.status,
          NEW.status,
          transition_details
        );
      END IF;

      IF NEW.external_reference IS DISTINCT FROM OLD.external_reference THEN
        PERFORM append_financial_operation_event(
          NEW.id,
          'external_reference_recorded',
          OLD.status,
          NEW.status,
          jsonb_build_object('externalReference', NEW.external_reference)
        );
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION guard_financial_operation_event_mutation()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'financial operation events are append-only';
      END IF;
      IF current_setting('app.financial_operation_service', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'financial operation events must be written through FinancialOperationService';
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION guard_financial_operation_link_mutation()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'financial operation links are append-only';
      END IF;
      IF current_setting('app.financial_operation_service', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'financial operation links must be created through FinancialOperationService';
      END IF;
      IF EXISTS (
        SELECT 1
        FROM financial_operations
        WHERE id = NEW.operation_id
          AND status = 'completed'
      ) THEN
        RAISE EXCEPTION 'completed operations cannot receive new links';
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION record_financial_operation_link()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      PERFORM append_financial_operation_event(
        NEW.operation_id,
        'record_linked',
        NULL,
        NULL,
        jsonb_build_object('recordType', NEW.record_type, 'recordId', NEW.record_id)
      );
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS financial_operations_guard_mutation ON financial_operations;
    CREATE TRIGGER financial_operations_guard_mutation
      BEFORE INSERT OR UPDATE OR DELETE ON financial_operations
      FOR EACH ROW EXECUTE FUNCTION guard_financial_operation_mutation();

    DROP TRIGGER IF EXISTS financial_operations_record_change ON financial_operations;
    CREATE TRIGGER financial_operations_record_change
      AFTER INSERT OR UPDATE ON financial_operations
      FOR EACH ROW EXECUTE FUNCTION record_financial_operation_change();

    DROP TRIGGER IF EXISTS financial_operation_events_append_only ON financial_operation_events;
    CREATE TRIGGER financial_operation_events_append_only
      BEFORE INSERT OR UPDATE OR DELETE ON financial_operation_events
      FOR EACH ROW EXECUTE FUNCTION guard_financial_operation_event_mutation();

    DROP TRIGGER IF EXISTS financial_operation_links_append_only ON financial_operation_links;
    CREATE TRIGGER financial_operation_links_append_only
      BEFORE INSERT OR UPDATE OR DELETE ON financial_operation_links
      FOR EACH ROW EXECUTE FUNCTION guard_financial_operation_link_mutation();

    DROP TRIGGER IF EXISTS financial_operation_links_record_link ON financial_operation_links;
    CREATE TRIGGER financial_operation_links_record_link
      AFTER INSERT ON financial_operation_links
      FOR EACH ROW EXECUTE FUNCTION record_financial_operation_link();
  `);
}

export async function rollbackFinancialOperations(): Promise<void> {
  await pool.query(`
    DROP TABLE IF EXISTS financial_operation_links;
    DROP TABLE IF EXISTS financial_operation_events;
    DROP TABLE IF EXISTS financial_operations;
    DROP FUNCTION IF EXISTS record_financial_operation_link();
    DROP FUNCTION IF EXISTS guard_financial_operation_link_mutation();
    DROP FUNCTION IF EXISTS guard_financial_operation_event_mutation();
    DROP FUNCTION IF EXISTS record_financial_operation_change();
    DROP FUNCTION IF EXISTS guard_financial_operation_mutation();
    DROP FUNCTION IF EXISTS append_financial_operation_event(UUID, VARCHAR, VARCHAR, VARCHAR, JSONB);
  `);
}
