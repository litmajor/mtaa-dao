-- 019_add_recovery_workflows.sql
-- Creates recovery_workflows and manual_intervention_requests tables and ensures required columns exist

BEGIN;

-- Create recovery_workflows if missing
CREATE TABLE IF NOT EXISTS recovery_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  original_error TEXT,
  original_amount NUMERIC(20,6),
  current_amount NUMERIC(20,6),
  original_provider TEXT,
  current_provider TEXT,
  operation TEXT,
  currency TEXT,
  method TEXT,
  original_metadata JSONB DEFAULT '{}'::jsonb,
  state TEXT,
  strategy TEXT,
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt TIMESTAMPTZ,
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  recovery_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create manual_intervention_requests if missing
CREATE TABLE IF NOT EXISTS manual_intervention_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  reason TEXT,
  priority TEXT DEFAULT 'high',
  status TEXT DEFAULT 'pending',
  approved_by TEXT,
  approval_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_workflow FOREIGN KEY (workflow_id) REFERENCES recovery_workflows(id) ON DELETE CASCADE
);

-- Ensure columns exist (for older schemas)
ALTER TABLE recovery_workflows ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE recovery_workflows ADD COLUMN IF NOT EXISTS method TEXT;
ALTER TABLE recovery_workflows ADD COLUMN IF NOT EXISTS original_metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE recovery_workflows ALTER COLUMN updated_at SET DEFAULT now();

COMMIT;
