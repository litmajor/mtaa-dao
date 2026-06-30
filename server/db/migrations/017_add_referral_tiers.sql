-- Migration: add referral_tiers table (keeps parity with shared/schema.ts referralTiers definition)
-- Run in server/db migration pipeline

CREATE TABLE IF NOT EXISTS referral_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL,
  dao_id uuid NOT NULL,
  tier varchar NOT NULL,
  total_referrals integer DEFAULT 0,
  active_referrals integer DEFAULT 0,
  total_contribution_value numeric(18,2) DEFAULT 0,
  lifetime_earnings numeric(18,2) DEFAULT 0,
  badges jsonb DEFAULT '[]'::jsonb,
  last_ping_date timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_tiers_user_id ON referral_tiers (user_id);
CREATE INDEX IF NOT EXISTS idx_referral_tiers_dao_id ON referral_tiers (dao_id);

-- Optionally add foreign keys if tables exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'users') AND EXISTS (SELECT 1 FROM pg_class WHERE relname = 'daos') THEN
    ALTER TABLE referral_tiers
    ADD CONSTRAINT fk_referral_tiers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

    ALTER TABLE referral_tiers
    ADD CONSTRAINT fk_referral_tiers_dao FOREIGN KEY (dao_id) REFERENCES daos(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- ignore if constraint already exists
  NULL;
END$$;
