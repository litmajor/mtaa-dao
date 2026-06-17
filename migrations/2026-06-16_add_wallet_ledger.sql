-- Create wallet_ledger table for double-entry ledgering
BEGIN;

-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  transaction_id text,
  type text NOT NULL,
  amount numeric(36,8) NOT NULL,
  purpose text,
  balance_snapshot numeric(36,8) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_id ON wallet_ledger(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_ledger_transaction_id ON wallet_ledger(transaction_id) WHERE transaction_id IS NOT NULL;

COMMIT;
