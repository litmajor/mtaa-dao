import { pool } from '../../db';

export async function migrateFinancialReconciliationRegistry(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS financial_reconciliation_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      status VARCHAR(16) NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'failed')),
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS financial_reconciliation_runs_status_started_idx
      ON financial_reconciliation_runs (status, started_at);

    CREATE TABLE IF NOT EXISTS financial_reconciliation_findings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      finding_key VARCHAR(512) NOT NULL UNIQUE,
      domain VARCHAR(64) NOT NULL,
      rule_id VARCHAR(16) NOT NULL,
      severity VARCHAR(16) NOT NULL
        CHECK (severity IN ('critical', 'high', 'medium', 'low')),
      operation_id UUID REFERENCES financial_operations(id) ON DELETE SET NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'acknowledged', 'resolved', 'reopened')),
      expected_state JSONB NOT NULL,
      observed_state JSONB NOT NULL,
      evidence_references JSONB NOT NULL DEFAULT '[]'::jsonb,
      first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      resolved_by TEXT,
      resolution_note TEXT,
      acknowledged_at TIMESTAMPTZ,
      acknowledged_by TEXT,
      last_run_id UUID REFERENCES financial_reconciliation_runs(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS financial_reconciliation_findings_status_detected_idx
      ON financial_reconciliation_findings (status, last_detected_at);
    CREATE INDEX IF NOT EXISTS financial_reconciliation_findings_rule_domain_idx
      ON financial_reconciliation_findings (rule_id, domain);
    CREATE INDEX IF NOT EXISTS financial_reconciliation_findings_operation_idx
      ON financial_reconciliation_findings (operation_id);
    CREATE INDEX IF NOT EXISTS financial_reconciliation_findings_run_idx
      ON financial_reconciliation_findings (last_run_id);

    CREATE TABLE IF NOT EXISTS financial_reconciliation_finding_events (
      id BIGSERIAL PRIMARY KEY,
      finding_id UUID NOT NULL REFERENCES financial_reconciliation_findings(id) ON DELETE RESTRICT,
      run_id UUID REFERENCES financial_reconciliation_runs(id) ON DELETE SET NULL,
      event_type VARCHAR(16) NOT NULL
        CHECK (event_type IN ('detected', 'acknowledged', 'resolved', 'reopened')),
      from_status VARCHAR(16),
      to_status VARCHAR(16),
      actor TEXT NOT NULL,
      note TEXT,
      expected_state JSONB,
      observed_state JSONB,
      evidence_references JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS financial_reconciliation_finding_events_created_idx
      ON financial_reconciliation_finding_events (finding_id, created_at);
    CREATE INDEX IF NOT EXISTS financial_reconciliation_finding_events_run_idx
      ON financial_reconciliation_finding_events (run_id);

    CREATE OR REPLACE FUNCTION prevent_financial_reconciliation_event_mutation()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'financial_reconciliation_finding_events is append-only';
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS financial_reconciliation_finding_events_immutable
      ON financial_reconciliation_finding_events;
    CREATE TRIGGER financial_reconciliation_finding_events_immutable
      BEFORE UPDATE OR DELETE ON financial_reconciliation_finding_events
      FOR EACH ROW EXECUTE FUNCTION prevent_financial_reconciliation_event_mutation();
  `);
}

export async function rollbackFinancialReconciliationRegistry(): Promise<void> {
  await pool.query(`
    DROP TRIGGER IF EXISTS financial_reconciliation_finding_events_immutable
      ON financial_reconciliation_finding_events;
    DROP FUNCTION IF EXISTS prevent_financial_reconciliation_event_mutation();
    DROP TABLE IF EXISTS financial_reconciliation_finding_events;
    DROP TABLE IF EXISTS financial_reconciliation_findings;
    DROP TABLE IF EXISTS financial_reconciliation_runs;
  `);
}
