
-- Transaction Limit Tracking
CREATE TABLE IF NOT EXISTS transaction_limit_tracking (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  daily_volume DECIMAL(20, 2) DEFAULT 0,
  monthly_volume DECIMAL(20, 2) DEFAULT 0,
  last_reset_daily TIMESTAMP DEFAULT NOW(),
  last_reset_monthly TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, transaction_date)
);

-- Indexes for performance
CREATE INDEX idx_limit_tracking_user ON transaction_limit_tracking(user_id);
CREATE INDEX idx_limit_tracking_date ON transaction_limit_tracking(transaction_date);

-- Transaction history for audit
CREATE TABLE IF NOT EXISTS kyc_transaction_history (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL, -- deposit, withdrawal
  amount_usd DECIMAL(20, 2) NOT NULL,
  amount_kes DECIMAL(20, 2),
  kyc_tier TEXT NOT NULL,
  daily_limit DECIMAL(20, 2) NOT NULL,
  monthly_limit DECIMAL(20, 2) NOT NULL,
  daily_used DECIMAL(20, 2) NOT NULL,
  monthly_used DECIMAL(20, 2) NOT NULL,
  status TEXT NOT NULL, -- approved, rejected
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_kyc_tx_user ON kyc_transaction_history(user_id);
CREATE INDEX idx_kyc_tx_type ON kyc_transaction_history(transaction_type);
CREATE INDEX idx_kyc_tx_status ON kyc_transaction_history(status);
