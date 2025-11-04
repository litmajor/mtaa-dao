
-- Platform Revenue Tracking
CREATE TABLE IF NOT EXISTS platform_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revenue_stream VARCHAR NOT NULL, -- 'user_subscription', 'dao_subscription', 'on_ramp_fee', 'off_ramp_fee', 'swap_fee', 'affiliate_yield', 'mtaa_marketplace'
  user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  dao_id UUID REFERENCES daos(id) ON DELETE SET NULL,
  amount_usd DECIMAL(18, 2) NOT NULL,
  amount_kes DECIMAL(18, 2),
  amount_mtaa DECIMAL(18, 2),
  currency VARCHAR DEFAULT 'USD',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- DAO Growth Tracking (for pay-as-you-grow)
CREATE TABLE IF NOT EXISTS dao_growth_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id UUID REFERENCES daos(id) ON DELETE CASCADE NOT NULL,
  member_count INTEGER DEFAULT 0,
  vault_tvl_usd DECIMAL(18, 2) DEFAULT 0,
  monthly_transaction_volume DECIMAL(18, 2) DEFAULT 0,
  should_upgrade BOOLEAN DEFAULT false,
  recommended_tier VARCHAR,
  snapshot_date TIMESTAMP DEFAULT NOW()
);

-- Marketplace Transactions (MTAA spending)
CREATE TABLE IF NOT EXISTS mtaa_marketplace_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  item_type VARCHAR NOT NULL, -- 'vault_slot', 'achievement_nft', 'profile_theme', 'task_priority', 'proposal_highlight'
  item_id VARCHAR,
  mtaa_spent DECIMAL(18, 2) NOT NULL,
  platform_fee DECIMAL(18, 2) DEFAULT 0, -- Platform takes a cut
  status VARCHAR DEFAULT 'completed',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_platform_revenue_stream ON platform_revenue(revenue_stream);
CREATE INDEX idx_platform_revenue_created_at ON platform_revenue(created_at);
CREATE INDEX idx_dao_growth_snapshots_dao_id ON dao_growth_snapshots(dao_id);
CREATE INDEX idx_mtaa_marketplace_user_id ON mtaa_marketplace_transactions(user_id);
