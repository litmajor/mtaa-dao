-- Migration: create reward_requests table for batching MTAARewardsManager distributions
BEGIN;

CREATE TABLE IF NOT EXISTS reward_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  user_achievement_id UUID NOT NULL,
  amount_units NUMERIC(38,0) NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'pending', -- pending, processing, done, failed
  attempts INTEGER DEFAULT 0,
  idempotency_key VARCHAR NOT NULL,
  tx_hash VARCHAR,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_requests_idempotency ON reward_requests (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_reward_requests_status ON reward_requests (status);

COMMIT;
