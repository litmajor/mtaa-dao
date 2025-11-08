
-- User Subscriptions Table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  plan VARCHAR DEFAULT 'free', -- free, premium, power
  status VARCHAR DEFAULT 'active', -- active, expired, cancelled
  payment_method VARCHAR, -- mpesa, stripe, mtaa_token
  billing_cycle VARCHAR DEFAULT 'monthly', -- daily, weekly, monthly, yearly
  amount DECIMAL(10, 2),
  currency VARCHAR DEFAULT 'KES',
  start_date TIMESTAMP DEFAULT NOW(),
  end_date TIMESTAMP,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User Vault Limits Table
CREATE TABLE IF NOT EXISTS user_vault_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  free_vaults_used INTEGER DEFAULT 0,
  premium_vaults_used INTEGER DEFAULT 0,
  total_vaults_allowed INTEGER DEFAULT 1, -- based on subscription
  earned_vault_slots INTEGER DEFAULT 0, -- from achievements/activity
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User Feature Usage Tracking
CREATE TABLE IF NOT EXISTS user_feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  feature_type VARCHAR NOT NULL, -- analytics, auto_rebalance, instant_withdrawal, etc.
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  mtaa_spent DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, feature_type)
);

-- User Payment History (for micro-subscriptions)
CREATE TABLE IF NOT EXISTS user_payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR DEFAULT 'KES',
  payment_method VARCHAR NOT NULL,
  payment_type VARCHAR NOT NULL, -- subscription, feature_unlock, vault_slot
  status VARCHAR DEFAULT 'completed',
  transaction_reference VARCHAR,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_vault_limits_user_id ON user_vault_limits(user_id);
CREATE INDEX idx_user_feature_usage_user_id ON user_feature_usage(user_id);
CREATE INDEX idx_user_payment_history_user_id ON user_payment_history(user_id);
