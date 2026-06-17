-- Migration: Add payment_sagas and payment_saga_events tables

CREATE TABLE IF NOT EXISTS payment_sagas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL,
  user_id VARCHAR,
  payment_id TEXT,
  amount NUMERIC(30, 6),
  currency TEXT,
  steps_completed JSONB DEFAULT '[]'::jsonb,
  current_step TEXT,
  compensation_steps JSONB DEFAULT '[]'::jsonb,
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_saga_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saga_id UUID REFERENCES payment_sagas(id) ON DELETE CASCADE,
  step TEXT,
  success BOOLEAN,
  data JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  attempt_number INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_sagas_status ON payment_sagas (status);
CREATE INDEX IF NOT EXISTS idx_payment_sagas_user_id ON payment_sagas (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_sagas_payment_id ON payment_sagas (payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_saga_events_saga_id ON payment_saga_events (saga_id);
