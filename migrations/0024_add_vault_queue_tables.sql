
-- Add vault rebalance queue table
CREATE TABLE IF NOT EXISTS vault_rebalance_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR DEFAULT 'pending',
  expires_at TIMESTAMP NOT NULL,
  approved_by VARCHAR REFERENCES users(id),
  approved_at TIMESTAMP,
  rejected_by VARCHAR REFERENCES users(id),
  rejected_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_vault_rebalance_queue_vault_id ON vault_rebalance_queue(vault_id);
CREATE INDEX idx_vault_rebalance_queue_status ON vault_rebalance_queue(status);
CREATE INDEX idx_vault_rebalance_queue_expires_at ON vault_rebalance_queue(expires_at);

-- Add pending transactions table
CREATE TABLE IF NOT EXISTS pending_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID REFERENCES vaults(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type VARCHAR NOT NULL,
  amount DECIMAL(18, 8),
  token_symbol VARCHAR,
  status VARCHAR DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  tx_hash VARCHAR,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pending_transactions_vault_id ON pending_transactions(vault_id);
CREATE INDEX idx_pending_transactions_user_id ON pending_transactions(user_id);
CREATE INDEX idx_pending_transactions_status ON pending_transactions(status);
CREATE INDEX idx_pending_transactions_created_at ON pending_transactions(created_at);
