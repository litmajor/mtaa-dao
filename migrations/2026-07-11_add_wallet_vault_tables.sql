CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS wallet_vault_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  encrypted_blob TEXT NOT NULL,
  keystore_version INTEGER NOT NULL DEFAULT 3,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_backup_wallet ON wallet_vault_backups (wallet_id);
CREATE INDEX IF NOT EXISTS idx_vault_backup_user ON wallet_vault_backups (user_id);

CREATE TABLE IF NOT EXISTS wallet_vault_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_log_wallet ON wallet_vault_access_logs (wallet_id);
CREATE INDEX IF NOT EXISTS idx_vault_log_user ON wallet_vault_access_logs (user_id);
