
-- Bridge Transfers Table
CREATE TABLE IF NOT EXISTS bridge_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transfer_id TEXT NOT NULL UNIQUE,
  source_chain TEXT NOT NULL,
  destination_chain TEXT NOT NULL,
  token_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  bridge_fee TEXT,
  gas_fee TEXT,
  destination_address TEXT NOT NULL,
  vault_id UUID REFERENCES vaults(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed
  tx_hash_source TEXT,
  tx_hash_destination TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bridge_transfers_user_id ON bridge_transfers(user_id);
CREATE INDEX idx_bridge_transfers_status ON bridge_transfers(status);
CREATE INDEX idx_bridge_transfers_created_at ON bridge_transfers(created_at);
CREATE INDEX idx_bridge_transfers_chains ON bridge_transfers(source_chain, destination_chain);
