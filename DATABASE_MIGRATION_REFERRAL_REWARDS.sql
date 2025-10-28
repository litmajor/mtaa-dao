-- Migration: Add Referral Rewards Tables
-- Description: Tables for tracking and managing weekly referral rewards in MTAA tokens
-- Date: 2025-10-23

-- Create referral_rewards table
CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "weekEnding" DATE NOT NULL,
  rank INTEGER NOT NULL,
  "baseReward" DECIMAL(18, 8) NOT NULL,
  "qualityMultiplier" DECIMAL(4, 2) DEFAULT 1.00,
  "bonusAmount" DECIMAL(18, 8) DEFAULT 0,
  "totalReward" DECIMAL(18, 8) NOT NULL,
  "claimedAmount" DECIMAL(18, 8) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- pending, vesting, claimed
  "vestingSchedule" JSONB,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Create reward_claims table
CREATE TABLE IF NOT EXISTS reward_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "rewardId" UUID NOT NULL REFERENCES referral_rewards(id) ON DELETE CASCADE,
  amount DECIMAL(18, 8) NOT NULL,
  "claimedAt" TIMESTAMP DEFAULT NOW(),
  "transactionHash" VARCHAR(255)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_referral_rewards_user_id ON referral_rewards("userId");
CREATE INDEX IF NOT EXISTS idx_referral_rewards_week_ending ON referral_rewards("weekEnding");
CREATE INDEX IF NOT EXISTS idx_referral_rewards_status ON referral_rewards(status);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_rank ON referral_rewards(rank);
CREATE INDEX IF NOT EXISTS idx_reward_claims_reward_id ON reward_claims("rewardId");

-- Add unique constraint to prevent duplicate rewards for same week
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_week ON referral_rewards("userId", "weekEnding");

-- Create referrals table if not exists (for tracking referrals)
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "referrerId" VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "referredUserId" VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "referralCode" VARCHAR(50),
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Create indexes for referrals
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals("referrerId");
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON referrals("referredUserId");
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals("referralCode");
CREATE INDEX IF NOT EXISTS idx_referrals_is_active ON referrals("isActive");
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON referrals("createdAt");

-- Prevent duplicate referrals
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_referral ON referrals("referredUserId");

-- Add referralCode to users table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='users' AND column_name='referralCode') THEN
    ALTER TABLE users ADD COLUMN "referralCode" VARCHAR(50) UNIQUE;
  END IF;
END $$;

-- Add votingTokenBalance to users table if not exists  
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='users' AND column_name='votingTokenBalance') THEN
    ALTER TABLE users ADD COLUMN "votingTokenBalance" DECIMAL(18, 8) DEFAULT 0;
  END IF;
END $$;

-- Add mtaaTokenBalance to users table for tracking reward tokens
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='users' AND column_name='mtaaTokenBalance') THEN
    ALTER TABLE users ADD COLUMN "mtaaTokenBalance" DECIMAL(18, 8) DEFAULT 0;
  END IF;
END $$;

-- Create function to update user's MTAA balance when reward is claimed
CREATE OR REPLACE FUNCTION update_user_mtaa_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users 
  SET "mtaaTokenBalance" = "mtaaTokenBalance" + NEW.amount,
      "updatedAt" = NOW()
  WHERE id = (
    SELECT "userId" FROM referral_rewards WHERE id = NEW."rewardId"
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update balance on claim
DROP TRIGGER IF EXISTS trigger_update_mtaa_balance ON reward_claims;
CREATE TRIGGER trigger_update_mtaa_balance
  AFTER INSERT ON reward_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_user_mtaa_balance();

-- Seed sample referral codes for existing users (optional)
UPDATE users 
SET "referralCode" = 'MTAA-' || UPPER(SUBSTRING(id FROM 1 FOR 6))
WHERE "referralCode" IS NULL;

-- Create view for weekly leaderboard analytics
CREATE OR REPLACE VIEW weekly_referral_leaderboard AS
SELECT 
  u.id as "userId",
  u."firstName",
  u."lastName",
  DATE_TRUNC('week', r."createdAt")::date as "weekStart",
  COUNT(DISTINCT r.id) as "referralCount",
  COUNT(DISTINCT CASE WHEN r."isActive" = true THEN r.id END) as "activeReferrals",
  (COUNT(DISTINCT CASE WHEN r."isActive" = true THEN r.id END)::float / 
   NULLIF(COUNT(DISTINCT r.id), 0)) * 100 as "qualityScore"
FROM users u
LEFT JOIN referrals r ON u.id = r."referrerId"
WHERE r."createdAt" IS NOT NULL
GROUP BY u.id, u."firstName", u."lastName", DATE_TRUNC('week', r."createdAt")
HAVING COUNT(DISTINCT r.id) >= 1
ORDER BY "weekStart" DESC, "referralCount" DESC;

-- Comment the tables
COMMENT ON TABLE referral_rewards IS 'Tracks weekly MTAA token rewards for top referrers';
COMMENT ON TABLE reward_claims IS 'Records individual reward claim transactions';
COMMENT ON TABLE referrals IS 'Tracks user referral relationships and activity';
COMMENT ON COLUMN referral_rewards."vestingSchedule" IS 'JSON object defining vesting milestones: {"immediate": 25, "30d": 25, "60d": 25, "90d": 25}';
COMMENT ON COLUMN referrals."isActive" IS 'True if referred user has completed onboarding and made transactions';

-- Grant permissions (adjust based on your database roles)
-- GRANT SELECT, INSERT, UPDATE ON referral_rewards TO your_app_role;
-- GRANT SELECT, INSERT ON reward_claims TO your_app_role;
-- GRANT SELECT, INSERT, UPDATE ON referrals TO your_app_role;

-- Migration complete
COMMENT ON SCHEMA public IS 'Referral rewards system migration completed on 2025-10-23';

