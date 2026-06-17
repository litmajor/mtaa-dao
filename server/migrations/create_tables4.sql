
-- =============================================================================
-- SECTION 8: VAULTS & TREASURY
-- =============================================================================

CREATE TABLE IF NOT EXISTS vaults (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             VARCHAR REFERENCES users(id),
  dao_id              UUID REFERENCES daos(id),
  creator_id          VARCHAR REFERENCES users(id),
  name                VARCHAR DEFAULT 'Personal Vault',
  description         TEXT,
  currency            VARCHAR NOT NULL,
  address             VARCHAR,
  balance             DECIMAL(18,8) DEFAULT 0,
  monthly_goal        DECIMAL(18,8) DEFAULT 0,
  vault_type          VARCHAR DEFAULT 'regular',
  lock_duration       INTEGER,
  locked_until        TIMESTAMP,
  interest_rate       DECIMAL(5,4) DEFAULT 0,
  is_active           BOOLEAN DEFAULT TRUE,
  risk_level          VARCHAR DEFAULT 'low',
  min_deposit         DECIMAL(18,8) DEFAULT 0,
  max_deposit         DECIMAL(18,8),
  total_value_locked  DECIMAL(18,8) DEFAULT 0,
  yield_generated     DECIMAL(18,8) DEFAULT 0,
  yield_strategy      VARCHAR,
  performance_fee     DECIMAL(5,4) DEFAULT 0.1,
  management_fee      DECIMAL(5,4) DEFAULT 0.02,
  owner_type          VARCHAR,
  owner_id            UUID,
  treasury_id         UUID REFERENCES daos(id),
  vault_config        JSONB,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

-- Add FK from wallet_transactions now that vaults exists
ALTER TABLE wallet_transactions
  ADD CONSTRAINT IF NOT EXISTS wallet_transactions_vault_id_fkey
  FOREIGN KEY (vault_id) REFERENCES vaults(id);

CREATE TABLE IF NOT EXISTS vault_token_holdings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id            UUID NOT NULL REFERENCES vaults(id),
  token_symbol        VARCHAR NOT NULL,
  balance             DECIMAL(18,8) NOT NULL,
  value_usd           DECIMAL(18,8) DEFAULT 0,
  last_price_update   TIMESTAMP DEFAULT NOW(),
  average_entry_price DECIMAL(18,8),
  total_deposited     DECIMAL(18,8) DEFAULT 0,
  total_withdrawn     DECIMAL(18,8) DEFAULT 0,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vault_performance (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id          UUID NOT NULL REFERENCES vaults(id),
  period            VARCHAR NOT NULL,
  period_start      TIMESTAMP NOT NULL,
  period_end        TIMESTAMP NOT NULL,
  starting_value    DECIMAL(18,8) NOT NULL,
  ending_value      DECIMAL(18,8) NOT NULL,
  yield             DECIMAL(18,8) DEFAULT 0,
  yield_percentage  DECIMAL(8,4) DEFAULT 0,
  fees_collected    DECIMAL(18,8) DEFAULT 0,
  deposits          DECIMAL(18,8) DEFAULT 0,
  withdrawals       DECIMAL(18,8) DEFAULT 0,
  sharpe_ratio      DECIMAL(8,4),
  max_drawdown      DECIMAL(8,4),
  volatility        DECIMAL(8,4),
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vault_strategy_allocations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id              UUID NOT NULL REFERENCES vaults(id),
  strategy_id           VARCHAR NOT NULL,
  token_symbol          VARCHAR NOT NULL,
  allocated_amount      DECIMAL(18,8) NOT NULL,
  allocation_percentage DECIMAL(5,2) NOT NULL,
  current_value         DECIMAL(18,8) DEFAULT 0,
  yield_earned          DECIMAL(18,8) DEFAULT 0,
  last_rebalance        TIMESTAMP DEFAULT NOW(),
  is_active             BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vault_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id          UUID NOT NULL REFERENCES vaults(id),
  user_id           VARCHAR NOT NULL REFERENCES users(id),
  transaction_type  VARCHAR NOT NULL,
  token_symbol      VARCHAR NOT NULL,
  amount            DECIMAL(18,8) NOT NULL,
  value_usd         DECIMAL(18,8) DEFAULT 0,
  transaction_hash  VARCHAR,
  block_number      INTEGER,
  gas_used          DECIMAL(18,8),
  gas_fee           DECIMAL(18,8),
  status            VARCHAR DEFAULT 'completed',
  strategy_id       VARCHAR,
  shares_minted     DECIMAL(18,8),
  shares_burned     DECIMAL(18,8),
  metadata          JSONB,
  provider          VARCHAR DEFAULT 'unknown',
  from_address      VARCHAR,
  timestamp         TIMESTAMP DEFAULT NOW(),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vault_risk_assessments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id              UUID NOT NULL REFERENCES vaults(id),
  assessment_date       TIMESTAMP DEFAULT NOW(),
  overall_risk_score    INTEGER NOT NULL,
  liquidity_risk        INTEGER DEFAULT 0,
  smart_contract_risk   INTEGER DEFAULT 0,
  market_risk           INTEGER DEFAULT 0,
  concentration_risk    INTEGER DEFAULT 0,
  protocol_risk         INTEGER DEFAULT 0,
  risk_factors          JSONB,
  recommendations       JSONB,
  next_assessment_due   TIMESTAMP,
  assessed_by           VARCHAR REFERENCES users(id),
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vault_governance_proposals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id            UUID NOT NULL REFERENCES vaults(id),
  dao_id              UUID NOT NULL REFERENCES daos(id),
  proposal_id         UUID REFERENCES proposals(id),
  governance_type     VARCHAR NOT NULL,
  proposed_changes    JSONB NOT NULL,
  current_parameters  JSONB,
  required_quorum     INTEGER DEFAULT 50,
  voting_deadline     TIMESTAMP NOT NULL,
  status              VARCHAR DEFAULT 'active',
  executed_at         TIMESTAMP,
  execution_tx_hash   VARCHAR,
  created_by          VARCHAR NOT NULL REFERENCES users(id),
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vault_withdrawal_tracking (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id              UUID NOT NULL REFERENCES vaults(id),
  date                  DATE NOT NULL,
  daily_total_withdrawn DECIMAL(25,8) NOT NULL DEFAULT 0,
  withdrawal_count      INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_vault_date UNIQUE (vault_id, date)
);

CREATE TABLE IF NOT EXISTS pending_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id          UUID REFERENCES vaults(id),
  user_id           VARCHAR NOT NULL REFERENCES users(id),
  transaction_type  VARCHAR NOT NULL,
  amount            DECIMAL(18,8),
  token_symbol      VARCHAR,
  status            VARCHAR DEFAULT 'pending',
  retry_count       INTEGER DEFAULT 0,
  max_retries       INTEGER DEFAULT 5,
  tx_hash           VARCHAR,
  error_message     TEXT,
  metadata          JSONB,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locked_savings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR NOT NULL REFERENCES users(id),
  vault_id        UUID NOT NULL REFERENCES vaults(id),
  amount          DECIMAL(10,2) NOT NULL,
  currency        VARCHAR DEFAULT 'cUSD',
  lock_period     INTEGER NOT NULL,
  interest_rate   DECIMAL(5,4) DEFAULT 0.05,
  locked_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  unlocks_at      TIMESTAMP NOT NULL,
  status          VARCHAR DEFAULT 'locked',
  penalty         DECIMAL(10,2) DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR NOT NULL REFERENCES users(id),
  title           VARCHAR NOT NULL,
  description     TEXT,
  target_amount   DECIMAL(10,2) NOT NULL,
  current_amount  DECIMAL(10,2) DEFAULT 0,
  currency        VARCHAR DEFAULT 'KES',
  target_date     TIMESTAMP,
  category        VARCHAR DEFAULT 'general',
  is_completed    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- SECTION 9: TREASURY MANAGEMENT
-- =============================================================================

CREATE TABLE IF NOT EXISTS treasury_positions (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id                          UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  treasury_vault_id               UUID REFERENCES vaults(id) ON DELETE SET NULL,
  asset_node_id                   VARCHAR NOT NULL,
  symbol                          VARCHAR(20) NOT NULL,
  chain                           VARCHAR(20) NOT NULL,
  contract_address                VARCHAR(255) NOT NULL,
  balance                         DECIMAL(18,8) NOT NULL DEFAULT 0,
  balance_usd                     DECIMAL(18,2),
  cost_basis                      DECIMAL(18,2),
  acquisition_timestamp           TIMESTAMP,
  last_rebalance_timestamp        TIMESTAMP,
  asset_class                     VARCHAR(30),
  risk_level                      VARCHAR(20),
  dao_type                        VARCHAR(30),
  treasury_mode                   VARCHAR(30),
  treasury_size                   VARCHAR(30),
  risk_profile                    VARCHAR(30),
  next_distribution_window        TIMESTAMP,
  needs_liquidity_by              TIMESTAMP,
  yield_earned                    DECIMAL(18,8) DEFAULT 0,
  yield_strategy                  VARCHAR(50),
  exit_liquidity                  VARCHAR(20),
  exit_time_at_5_percent_slippage INTEGER,
  bridge_cost_if_moving           DECIMAL(5,2),
  rebalance_deviation             DECIMAL(5,2),
  is_locked_until                 TIMESTAMP,
  metadata                        JSONB DEFAULT '{}',
  created_at                      TIMESTAMP DEFAULT NOW(),
  updated_at                      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS treasury_positions_dao_id_idx ON treasury_positions(dao_id);
CREATE INDEX IF NOT EXISTS treasury_positions_symbol_idx ON treasury_positions(symbol);
CREATE INDEX IF NOT EXISTS treasury_positions_chain_idx ON treasury_positions(chain);
CREATE INDEX IF NOT EXISTS treasury_positions_dao_type_idx ON treasury_positions(dao_type);
CREATE INDEX IF NOT EXISTS treasury_positions_next_distribution_idx ON treasury_positions(next_distribution_window);

CREATE TABLE IF NOT EXISTS treasury_multisig_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id                UUID NOT NULL REFERENCES daos(id),
  multisig_wallet_id    UUID NOT NULL,
  proposed_by           VARCHAR NOT NULL REFERENCES users(id),
  transaction_type      VARCHAR NOT NULL,
  amount                DECIMAL(18,2) NOT NULL,
  currency              VARCHAR DEFAULT 'cUSD',
  recipient             VARCHAR,
  purpose               TEXT NOT NULL,
  contract_function     VARCHAR,
  params                JSONB,
  required_signatures   INTEGER NOT NULL,
  current_signatures    INTEGER DEFAULT 0,
  signers               JSONB DEFAULT '[]',
  status                VARCHAR DEFAULT 'pending',
  approved_at           TIMESTAMP,
  submitted_at          TIMESTAMP,
  submitted_tx_hash     VARCHAR,
  executed_at           TIMESTAMP,
  execution_tx_hash     VARCHAR,
  expires_at            TIMESTAMP NOT NULL,
  metadata              JSONB,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS treasury_withdrawal_approvals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id      UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  withdrawal_id UUID NOT NULL REFERENCES wallet_transactions(id) ON DELETE CASCADE,
  approver_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approved    BOOLEAN NOT NULL,
  voted_at    TIMESTAMP DEFAULT NOW(),
  comment     TEXT
);

CREATE TABLE IF NOT EXISTS treasury_budget_allocations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id            UUID NOT NULL REFERENCES daos(id),
  category          VARCHAR NOT NULL,
  allocated_amount  DECIMAL(18,2) NOT NULL,
  spent_amount      DECIMAL(18,2) DEFAULT 0,
  remaining_amount  DECIMAL(18,2) NOT NULL,
  period            VARCHAR NOT NULL,
  period_start      TIMESTAMP NOT NULL,
  period_end        TIMESTAMP NOT NULL,
  is_active         BOOLEAN DEFAULT TRUE,
  created_by        VARCHAR NOT NULL REFERENCES users(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS treasury_audit_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id            UUID NOT NULL REFERENCES daos(id),
  actor_id          VARCHAR NOT NULL REFERENCES users(id),
  action            VARCHAR NOT NULL,
  amount            DECIMAL(18,2),
  previous_balance  DECIMAL(18,2),
  new_balance       DECIMAL(18,2),
  category          VARCHAR,
  reason            TEXT NOT NULL,
  multisig_tx_id    UUID REFERENCES treasury_multisig_transactions(id),
  transaction_hash  VARCHAR,
  ip_address        VARCHAR,
  metadata          JSONB,
  severity          VARCHAR DEFAULT 'medium',
  timestamp         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS treasury_reconciliation_audits (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_type     VARCHAR NOT NULL,
  entity_id               UUID NOT NULL,
  computed_value          DECIMAL(20,8) NOT NULL,
  on_chain_value          DECIMAL(20,8) NOT NULL,
  discrepancy             DECIMAL(20,8) NOT NULL,
  discrepancy_percent     DECIMAL(5,4) NOT NULL,
  reconciliation_status   VARCHAR NOT NULL DEFAULT 'matched',
  last_on_chain_check     TIMESTAMP NOT NULL,
  notes                   TEXT,
  created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS treasury_health_history (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id                    UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  health_status             VARCHAR(20) NOT NULL,
  health_score              INTEGER NOT NULL,
  asset_count               INTEGER DEFAULT 0,
  total_value_usd           DECIMAL(18,2),
  stable_exposure_percent   DECIMAL(5,2),
  volatile_exposure_percent DECIMAL(5,2),
  yield_exposure_percent    DECIMAL(5,2),
  asset_concentration       DECIMAL(5,4),
  chain_concentration       DECIMAL(5,4),
  chain_count               INTEGER DEFAULT 1,
  alert_count               INTEGER DEFAULT 0,
  recommendation_count      INTEGER DEFAULT 0,
  snapshot_reason           VARCHAR(50),
  metadata                  JSONB DEFAULT '{}',
  recorded_at               TIMESTAMP DEFAULT NOW(),
  created_at                TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS treasury_whitelist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id          UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  wallet_address  VARCHAR(42) NOT NULL,
  category        VARCHAR(20) NOT NULL,
  recipient_name  TEXT,
  description     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  approved_by     VARCHAR REFERENCES users(id),
  approved_at     TIMESTAMP,
  expires_at      TIMESTAMP,
  requested_by    VARCHAR NOT NULL REFERENCES users(id),
  rejection_reason TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  CONSTRAINT treasury_whitelist_dao_wallet_unique UNIQUE (dao_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS treasury_whitelist_dao_id_idx ON treasury_whitelist(dao_id);
CREATE INDEX IF NOT EXISTS treasury_whitelist_status_idx ON treasury_whitelist(status);

CREATE TABLE IF NOT EXISTS treasury_limits (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id                      UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  daily_cap_percentage        DECIMAL(5,2) NOT NULL DEFAULT 10,
  single_transfer_max_percentage DECIMAL(5,2) NOT NULL DEFAULT 20,
  multisig_threshold_usd      DECIMAL(18,2) NOT NULL DEFAULT 10000,
  multisig_required_signatures INTEGER NOT NULL DEFAULT 2,
  multisig_window_days        INTEGER NOT NULL DEFAULT 7,
  updated_by                  VARCHAR REFERENCES users(id),
  updated_at                  TIMESTAMP DEFAULT NOW(),
  created_at                  TIMESTAMP DEFAULT NOW(),
  CONSTRAINT treasury_limits_dao_unique UNIQUE (dao_id)
);

CREATE TABLE IF NOT EXISTS treasury_approvals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id              UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  transaction_id      VARCHAR,
  recipient_address   VARCHAR(42) NOT NULL,
  amount              DECIMAL(18,8) NOT NULL,
  amount_usd          DECIMAL(18,2) NOT NULL,
  description         TEXT,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending',
  required_signatures INTEGER NOT NULL,
  signatures          JSONB DEFAULT '[]',
  rejection_reason    TEXT,
  rejected_by         VARCHAR REFERENCES users(id),
  rejected_at         TIMESTAMP,
  executed_at         TIMESTAMP,
  executed_by         VARCHAR REFERENCES users(id),
  expires_at          TIMESTAMP NOT NULL,
  created_by          VARCHAR NOT NULL REFERENCES users(id),
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS treasury_approvals_dao_id_idx   ON treasury_approvals(dao_id);
CREATE INDEX IF NOT EXISTS treasury_approvals_status_idx   ON treasury_approvals(status);
CREATE INDEX IF NOT EXISTS treasury_approvals_expires_at_idx ON treasury_approvals(expires_at);

CREATE TABLE IF NOT EXISTS treasury_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id              UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  transaction_id      VARCHAR,
  recipient_address   VARCHAR(42) NOT NULL,
  amount              DECIMAL(18,8) NOT NULL,
  amount_usd          DECIMAL(18,2),
  description         TEXT,
  status              VARCHAR(20) NOT NULL,
  whitelist_approved  BOOLEAN NOT NULL DEFAULT FALSE,
  amount_validated    BOOLEAN NOT NULL DEFAULT FALSE,
  multisig_required   BOOLEAN NOT NULL DEFAULT FALSE,
  multisig_approved   BOOLEAN NOT NULL DEFAULT FALSE,
  executor_user_id    VARCHAR REFERENCES users(id),
  executor_role       VARCHAR,
  approval_id         UUID REFERENCES treasury_approvals(id),
  error_message       TEXT,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS treasury_transactions_dao_id_idx    ON treasury_transactions(dao_id);
CREATE INDEX IF NOT EXISTS treasury_transactions_status_idx    ON treasury_transactions(status);
CREATE INDEX IF NOT EXISTS treasury_transactions_created_at_idx ON treasury_transactions(created_at);

-- Withdrawal approvals (Phase 4B)
CREATE TABLE IF NOT EXISTS withdrawal_approvals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id            UUID NOT NULL REFERENCES vaults(id),
  dao_id              UUID NOT NULL REFERENCES daos(id),
  user_id             VARCHAR NOT NULL REFERENCES users(id),
  amount              DECIMAL(25,8) NOT NULL,
  destination         VARCHAR NOT NULL,
  status              VARCHAR NOT NULL DEFAULT 'pending',
  required_signatures INTEGER NOT NULL,
  current_signatures  INTEGER NOT NULL DEFAULT 0,
  signers             JSONB NOT NULL DEFAULT '[]',
  expires_at          TIMESTAMP NOT NULL,
  executed_at         TIMESTAMP,
  executed_by         VARCHAR REFERENCES users(id),
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS multisig_signatures (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id         UUID NOT NULL REFERENCES withdrawal_approvals(id),
  signer_id           VARCHAR NOT NULL REFERENCES users(id),
  signer_role         VARCHAR NOT NULL,
  signature           TEXT NOT NULL,
  signed_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_address          VARCHAR,
  is_valid            BOOLEAN NOT NULL DEFAULT TRUE,
  verification_error  TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);
