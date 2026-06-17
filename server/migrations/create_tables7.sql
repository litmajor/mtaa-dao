-- =============================================================================
-- SECTION 13: ACCOUNTS & TRANSACTION FLOW (accountSchema + transactionFlowSchema)
-- =============================================================================

CREATE TABLE IF NOT EXISTS accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           VARCHAR NOT NULL,
  account_type      TEXT NOT NULL DEFAULT 'wallet',
  account_number    VARCHAR UNIQUE,
  balance           DECIMAL(18,8) NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'USDC',
  status            TEXT NOT NULL DEFAULT 'active',
  locked            DECIMAL(18,8) NOT NULL DEFAULT 0,
  total_deposited   DECIMAL(18,8) NOT NULL DEFAULT 0,
  total_withdrawn   DECIMAL(18,8) NOT NULL DEFAULT 0,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  daily_limit       DECIMAL(18,8),
  monthly_limit     DECIMAL(18,8),
  max_balance       DECIMAL(18,8),
  dao_id            UUID REFERENCES daos(id),
  last_activity_at  TIMESTAMP,
  is_verified       BOOLEAN DEFAULT FALSE,
  kyc_status        VARCHAR DEFAULT 'pending',
  verified_at       TIMESTAMP,
  is_blocked        BOOLEAN DEFAULT FALSE,
  closed_at         TIMESTAMP,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_account_type ON accounts(user_id, account_type, currency);
CREATE INDEX IF NOT EXISTS idx_user_balance       ON accounts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_account_status     ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_account_number     ON accounts(account_number);

CREATE TABLE IF NOT EXISTS account_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  transaction_type  VARCHAR NOT NULL,
  amount            DECIMAL(18,8) NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'USDC',
  description       TEXT,
  reference         VARCHAR,
  from_account_id   UUID REFERENCES accounts(id),
  to_account_id     UUID REFERENCES accounts(id),
  from_user_id      VARCHAR,
  to_user_id        VARCHAR,
  status            VARCHAR NOT NULL DEFAULT 'completed',
  balance_before    DECIMAL(18,8),
  balance_after     DECIMAL(18,8),
  transaction_hash  VARCHAR,
  chain_id          INTEGER,
  metadata          TEXT,
  ip_address        VARCHAR,
  user_agent        TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_tx_account_id ON account_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_account_tx_type        ON account_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_account_tx_created     ON account_transactions(created_at);

CREATE TABLE IF NOT EXISTS account_settings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id              UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  auto_withdraw           BOOLEAN DEFAULT FALSE,
  auto_compound           BOOLEAN DEFAULT FALSE,
  notifications_enabled   BOOLEAN DEFAULT TRUE,
  preferred_language      VARCHAR DEFAULT 'en',
  timezone                VARCHAR,
  theme                   VARCHAR DEFAULT 'light',
  metadata                TEXT,
  created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS account_statements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  statement_period  VARCHAR NOT NULL,
  period_start      TIMESTAMP NOT NULL,
  period_end        TIMESTAMP NOT NULL,
  opening_balance   DECIMAL(18,8) NOT NULL,
  closing_balance   DECIMAL(18,8) NOT NULL,
  total_deposits    DECIMAL(18,8) DEFAULT 0,
  total_withdrawals DECIMAL(18,8) DEFAULT 0,
  total_transfers   DECIMAL(18,8) DEFAULT 0,
  total_fees        DECIMAL(18,8) DEFAULT 0,
  total_interest    DECIMAL(18,8) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  generated_at      TIMESTAMP DEFAULT NOW(),
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stmt_account_id ON account_statements(account_id);
CREATE INDEX IF NOT EXISTS idx_stmt_period      ON account_statements(period_start, period_end);

CREATE TABLE IF NOT EXISTS account_access_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id         VARCHAR,
  action          VARCHAR NOT NULL,
  resource_type   VARCHAR,
  resource_id     VARCHAR,
  status          VARCHAR NOT NULL DEFAULT 'success',
  error_message   TEXT,
  ip_address      VARCHAR,
  user_agent      TEXT,
  metadata        TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chain_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_account_id  UUID NOT NULL,
  chain               VARCHAR NOT NULL,
  wallet_address      VARCHAR NOT NULL,
  balance             DECIMAL(36,18) NOT NULL DEFAULT 0,
  balance_usd         DECIMAL(18,6) NOT NULL DEFAULT 0,
  token_symbol        VARCHAR NOT NULL,
  token_address       VARCHAR NOT NULL,
  token_balance       DECIMAL(36,18) NOT NULL DEFAULT 0,
  rpc_url             VARCHAR,
  block_explorer_url  VARCHAR,
  last_sync           TIMESTAMP,
  sync_status         VARCHAR DEFAULT 'pending',
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chain_account  ON chain_accounts(service_account_id, chain);
CREATE INDEX IF NOT EXISTS idx_wallet_address ON chain_accounts(wallet_address);

-- CANONICAL cross_chain_transfers (accountSchema.ts version — authoritative)
-- The schema.ts version is removed; this one has full bridge/fee tracking
CREATE TABLE IF NOT EXISTS cross_chain_transfers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id         UUID NOT NULL,
  source_chain          VARCHAR NOT NULL,
  source_token          VARCHAR NOT NULL,
  source_amount         DECIMAL(36,18) NOT NULL,
  source_tx_hash        VARCHAR,
  target_chain          VARCHAR NOT NULL,
  target_token          VARCHAR NOT NULL,
  target_amount         DECIMAL(36,18) NOT NULL,
  target_tx_hash        VARCHAR,
  recipient_address     VARCHAR NOT NULL,
  bridge_protocol       VARCHAR NOT NULL DEFAULT 'none',
  bridge_tx_hash        VARCHAR,
  status                VARCHAR NOT NULL DEFAULT 'pending',
  status_reason         TEXT,
  gas_fee_source        DECIMAL(18,6) NOT NULL DEFAULT 0,
  gas_fee_target        DECIMAL(18,6) NOT NULL DEFAULT 0,
  bridge_fee            DECIMAL(18,6) NOT NULL DEFAULT 0,
  swap_slippage         DECIMAL(18,6) DEFAULT 0,
  total_cost_usd        DECIMAL(18,6) NOT NULL DEFAULT 0,
  estimated_time        INTEGER,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  bridge_initiated_at   TIMESTAMP,
  confirmed_at          TIMESTAMP,
  completed_at          TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_id ON cross_chain_transfers(withdrawal_id);
CREATE INDEX IF NOT EXISTS idx_transfer_status ON cross_chain_transfers(status);

CREATE TABLE IF NOT EXISTS chain_metrics (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain                   VARCHAR NOT NULL,
  gas_price_low           DECIMAL(18,9) NOT NULL,
  gas_price_standard      DECIMAL(18,9) NOT NULL,
  gas_price_fast          DECIMAL(18,9) NOT NULL,
  base_fee                DECIMAL(18,9),
  priority_fee            DECIMAL(18,9),
  congestion_level        VARCHAR NOT NULL DEFAULT 'low',
  mempool_size            INTEGER,
  pending_transactions    INTEGER,
  avg_block_time          DECIMAL(10,3) NOT NULL,
  bridge_latency_seconds  INTEGER,
  failed_bridges          INTEGER DEFAULT 0,
  native_token_price_usd  DECIMAL(18,6) NOT NULL,
  liquidity_index         DECIMAL(10,2) DEFAULT 0,
  rpc_health              VARCHAR DEFAULT 'unknown',
  is_maintenance_mode     BOOLEAN DEFAULT FALSE,
  recorded_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Deposits / Withdrawals / Internal Transfers
CREATE TABLE IF NOT EXISTS deposits (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL,
  to_account_id           UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source                  VARCHAR(50) NOT NULL,
  source_identifier       VARCHAR(255),
  amount                  DECIMAL(18,8) NOT NULL,
  currency                VARCHAR(10) NOT NULL DEFAULT 'USDC',
  fee_amount              DECIMAL(18,8) DEFAULT 0,
  stable_inflow_event_id  UUID,
  normalized_amount_usd   DECIMAL(24,8),
  stable_units_microusd   NUMERIC(38,0),
  chain_id                INTEGER,
  token_address           VARCHAR(255),
  status                  VARCHAR(20) NOT NULL DEFAULT 'pending',
  transaction_hash        VARCHAR(255),
  external_reference      VARCHAR(255),
  metadata                TEXT,
  created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at            TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deposits_user_id        ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status         ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_source         ON deposits(source);
CREATE INDEX IF NOT EXISTS idx_deposits_created_at     ON deposits(created_at);
CREATE INDEX IF NOT EXISTS idx_deposits_stable_inflow  ON deposits(stable_inflow_event_id);

CREATE TABLE IF NOT EXISTS withdrawals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL,
  from_account_id       UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  destination           VARCHAR(50) NOT NULL,
  destination_address   VARCHAR(255),
  amount                DECIMAL(18,8) NOT NULL,
  currency              VARCHAR(10) NOT NULL DEFAULT 'USDC',
  fee_amount            DECIMAL(18,8) DEFAULT 0,
  status                VARCHAR(20) NOT NULL DEFAULT 'pending',
  transaction_hash      VARCHAR(255),
  external_reference    VARCHAR(255),
  micro_withdrawal_id   UUID,
  metadata              TEXT,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id     ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status      ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at  ON withdrawals(created_at);

CREATE TABLE IF NOT EXISTS internal_transfers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  from_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id   UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount          DECIMAL(18,8) NOT NULL,
  currency        VARCHAR(10) NOT NULL DEFAULT 'USDC',
  reason          VARCHAR(50),
  status          VARCHAR(20) NOT NULL DEFAULT 'completed',
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_user_id    ON internal_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_created_at ON internal_transfers(created_at);
