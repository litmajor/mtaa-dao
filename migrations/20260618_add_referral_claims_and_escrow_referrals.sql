-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create reward_claims table for recording user claims (audit trail)
CREATE TABLE IF NOT EXISTS reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id uuid NOT NULL,
  amount numeric(18,8) NOT NULL,
  transaction_hash varchar,
  claimed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  CONSTRAINT fk_reward FOREIGN KEY (reward_id) REFERENCES referral_rewards (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reward_claims_reward_id ON reward_claims (reward_id);

-- Create escrow_referrals table for local tracking of escrow invites/referrals
CREATE TABLE IF NOT EXISTS escrow_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id varchar NOT NULL,
  referred_user_id varchar NOT NULL,
  escrow_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  CONSTRAINT fk_escrow_referrer FOREIGN KEY (referrer_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_escrow_referred FOREIGN KEY (referred_user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_escrow_referrals_referrer_id ON escrow_referrals (referrer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_referrals_referred_user_id ON escrow_referrals (referred_user_id);

-- Alter referral_payouts to ensure saga/ledger columns exist
ALTER TABLE referral_payouts
  ADD COLUMN IF NOT EXISTS request_id uuid,
  ADD COLUMN IF NOT EXISTS transaction_hash varchar,
  ADD COLUMN IF NOT EXISTS nonce varchar,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;

-- Add useful indexes
CREATE INDEX IF NOT EXISTS idx_referral_payouts_request_id ON referral_payouts (request_id);
CREATE INDEX IF NOT EXISTS idx_referral_payouts_status ON referral_payouts (status);

-- Ensure referential integrity for existing columns if possible (best-effort)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_referral_payouts_referral_reward'
  ) THEN
    BEGIN
      -- Try to add constraint (silent fail if referral_rewards doesn't exist yet)
      ALTER TABLE referral_payouts
        ADD CONSTRAINT fk_referral_payouts_referral_reward FOREIGN KEY (referral_reward_id) REFERENCES referral_rewards (id) ON DELETE CASCADE;
    EXCEPTION WHEN undefined_table THEN
      -- ignore
      RAISE NOTICE 'referral_rewards table missing; skipping foreign key creation for referral_payouts';
    END;
  END IF;
END$$;
