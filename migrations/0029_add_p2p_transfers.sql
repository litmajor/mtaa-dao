
-- P2P Transfer Transactions
CREATE TABLE IF NOT EXISTS p2p_transfers (
  id SERIAL PRIMARY KEY,
  transfer_id TEXT UNIQUE NOT NULL,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  amount_usd DECIMAL(20, 2) NOT NULL,
  amount_kes DECIMAL(20, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'cUSD',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed, cancelled
  sender_kyc_tier TEXT NOT NULL,
  receiver_kyc_tier TEXT NOT NULL,
  sender_daily_limit DECIMAL(20, 2) NOT NULL,
  sender_monthly_limit DECIMAL(20, 2) NOT NULL,
  sender_daily_used DECIMAL(20, 2) NOT NULL,
  sender_monthly_used DECIMAL(20, 2) NOT NULL,
  reference TEXT,
  metadata JSONB,
  completed_at TIMESTAMP,
  failed_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_p2p_sender ON p2p_transfers(sender_id);
CREATE INDEX idx_p2p_receiver ON p2p_transfers(receiver_id);
CREATE INDEX idx_p2p_status ON p2p_transfers(status);
CREATE INDEX idx_p2p_created ON p2p_transfers(created_at);

-- Unified Transaction Limits (replaces transaction_limit_tracking)
CREATE TABLE IF NOT EXISTS unified_transaction_limits (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  daily_deposit_volume DECIMAL(20, 2) DEFAULT 0,
  daily_withdrawal_volume DECIMAL(20, 2) DEFAULT 0,
  daily_p2p_sent_volume DECIMAL(20, 2) DEFAULT 0,
  daily_total_volume DECIMAL(20, 2) DEFAULT 0,
  monthly_deposit_volume DECIMAL(20, 2) DEFAULT 0,
  monthly_withdrawal_volume DECIMAL(20, 2) DEFAULT 0,
  monthly_p2p_sent_volume DECIMAL(20, 2) DEFAULT 0,
  monthly_total_volume DECIMAL(20, 2) DEFAULT 0,
  last_reset_daily TIMESTAMP DEFAULT NOW(),
  last_reset_monthly TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, transaction_date)
);

CREATE INDEX idx_unified_limits_user ON unified_transaction_limits(user_id);
CREATE INDEX idx_unified_limits_date ON unified_transaction_limits(transaction_date);
