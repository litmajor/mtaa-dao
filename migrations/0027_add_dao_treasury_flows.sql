
-- DAO Treasury Credits - Track all MTAA flowing into DAO treasuries
CREATE TABLE IF NOT EXISTS dao_treasury_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  source VARCHAR(50) NOT NULL, -- 'earnings_rake', 'achievement', 'task_pool', 'referral_kickback'
  amount DECIMAL(18, 8) NOT NULL,
  user_id VARCHAR REFERENCES users(id), -- User who triggered this credit (if applicable)
  reason TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- MTAA Distribution Rules - Configure how MTAA is split
CREATE TABLE IF NOT EXISTS mtaa_distribution_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id UUID REFERENCES daos(id) ON DELETE CASCADE, -- NULL = global default
  action_type VARCHAR(50) NOT NULL, -- 'contribution', 'referral', 'task', 'vote', 'achievement'
  user_percentage INTEGER NOT NULL DEFAULT 90, -- User gets 90%
  dao_percentage INTEGER NOT NULL DEFAULT 10, -- DAO gets 10%
  platform_percentage INTEGER NOT NULL DEFAULT 0, -- Platform cut (future use)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT percentages_sum_100 CHECK (user_percentage + dao_percentage + platform_percentage = 100)
);

-- DAO Achievement Milestones - DAO-level rewards
CREATE TABLE IF NOT EXISTS dao_achievement_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'member_count', 'treasury_value', 'proposal_success', 'contribution_count'
  threshold INTEGER NOT NULL, -- e.g., 50 members, $10K treasury
  mtaa_reward DECIMAL(18, 8) NOT NULL,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_dao_treasury_credits_dao ON dao_treasury_credits(dao_id);
CREATE INDEX idx_dao_treasury_credits_source ON dao_treasury_credits(source);
CREATE INDEX idx_dao_treasury_credits_created ON dao_treasury_credits(created_at);
CREATE INDEX idx_mtaa_distribution_rules_dao ON mtaa_distribution_rules(dao_id);
CREATE INDEX idx_mtaa_distribution_rules_type ON mtaa_distribution_rules(action_type);
CREATE INDEX idx_dao_achievement_milestones_dao ON dao_achievement_milestones(dao_id);
CREATE INDEX idx_dao_achievement_milestones_completed ON dao_achievement_milestones(completed_at);

-- Insert default global distribution rules (10% rake on earnings)
INSERT INTO mtaa_distribution_rules (action_type, user_percentage, dao_percentage, platform_percentage) VALUES
('contribution', 90, 10, 0),
('task_completion', 80, 20, 0),
('referral_kickback', 95, 5, 0),
('vote', 100, 0, 0); -- No rake on voting for now
