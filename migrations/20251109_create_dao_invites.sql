-- Migration: Create dao_invites table for secure DAO referral/invite links
CREATE TABLE dao_invites (
  id SERIAL PRIMARY KEY,
  dao_id UUID NOT NULL,
  inviter_id UUID NOT NULL,
  token VARCHAR(128) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add referral field to dao_memberships if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='dao_memberships' AND column_name='referral'
  ) THEN
    ALTER TABLE dao_memberships ADD COLUMN referral UUID;
  END IF;
END$$;
