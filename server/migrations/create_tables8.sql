-- =============================================================================
-- SECTION 14: INVESTMENT POOLS & ASSET GRAPH
-- =============================================================================

CREATE TABLE IF NOT EXISTS investment_pools (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id              UUID REFERENCES daos(id) ON DELETE CASCADE,
  name                VARCHAR(255) NOT NULL,
  symbol              VARCHAR(10) NOT NULL,
  description         TEXT,
  contract_address    VARCHAR(255),
  total_value_locked  DECIMAL(18,8) DEFAULT 0,
  share_token_supply  DECIMAL(18,8) DEFAULT 0,
  share_price         DECIMAL(18,8) DEFAULT 1.0,
  performance_fee     INTEGER DEFAULT 200,
  minimum_investment  DECIMAL(18,2) DEFAULT 10.00,
  is_active           BOOLEAN DEFAULT TRUE,
  created_by          VARCHAR REFERENCES users(id),
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pool_assets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id           UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
  asset_symbol      VARCHAR(10) NOT NULL,
  asset_name        VARCHAR(100),
  token_address     VARCHAR(255),
  network           VARCHAR(50),
  target_allocation INTEGER NOT NULL,
  current_balance   DECIMAL(18,8) DEFAULT 0,
  current_value_usd DECIMAL(18,2) DEFAULT 0,
  last_price_usd    DECIMAL(18,2),
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pool_investments (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id                     UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
  user_id                     VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  investment_amount_usd       DECIMAL(18,2) NOT NULL,
  shares_minted               DECIMAL(18,8) NOT NULL,
  share_price_at_investment   DECIMAL(18,8) NOT NULL,
  payment_token               VARCHAR(50),
  transaction_hash            VARCHAR(255),
  status                      VARCHAR(50) DEFAULT 'pending',
  invested_at                 TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pool_withdrawals (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id                     UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
  user_id                     VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shares_burned               DECIMAL(18,8) NOT NULL,
  withdrawal_value_usd        DECIMAL(18,2) NOT NULL,
  share_price_at_withdrawal   DECIMAL(18,8) NOT NULL,
  fee_charged                 DECIMAL(18,2) DEFAULT 0,
  net_amount                  DECIMAL(18,2),
  transaction_hash            VARCHAR(255),
  status                      VARCHAR(50) DEFAULT 'pending',
  withdrawn_at                TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pool_rebalances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id           UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
  initiated_by      VARCHAR REFERENCES users(id),
  tvl_before        DECIMAL(18,2),
  tvl_after         DECIMAL(18,2),
  assets_changed    JSONB,
  transaction_hash  VARCHAR(255),
  reason            TEXT,
  status            VARCHAR(50) DEFAULT 'completed',
  rebalanced_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pool_performance (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id                   UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
  tvl                       DECIMAL(18,2),
  share_price               DECIMAL(18,8),
  total_return_percentage   DECIMAL(10,4),
  btc_price                 DECIMAL(18,2),
  eth_price                 DECIMAL(18,2),
  sol_price                 DECIMAL(18,2),
  bnb_price                 DECIMAL(18,2),
  xrp_price                 DECIMAL(18,2),
  ltc_price                 DECIMAL(18,2),
  volatility                DECIMAL(10,4),
  sharpe_ratio              DECIMAL(10,4),
  snapshot_at               TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(100) NOT NULL,
  description           TEXT,
  risk_level            VARCHAR(50) NOT NULL,
  target_return_annual  DECIMAL(5,2),
  is_active             BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS template_asset_allocations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id       UUID NOT NULL REFERENCES portfolio_templates(id) ON DELETE CASCADE,
  asset_symbol      VARCHAR(10) NOT NULL,
  target_allocation INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rebalancing_settings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id                   UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
  auto_rebalance_enabled    BOOLEAN DEFAULT FALSE,
  rebalance_frequency       VARCHAR(50) DEFAULT 'weekly',
  rebalance_threshold       INTEGER DEFAULT 500,
  last_rebalance_check      TIMESTAMP,
  next_rebalance_scheduled  TIMESTAMP,
  created_at                TIMESTAMP DEFAULT NOW(),
  updated_at                TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_price_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_symbol      VARCHAR(10) NOT NULL,
  price_usd         DECIMAL(18,2) NOT NULL,
  market_cap        DECIMAL(20,2),
  volume_24h        DECIMAL(20,2),
  price_change_24h  DECIMAL(10,4),
  recorded_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pool_swap_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id           UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
  rebalance_id      UUID REFERENCES pool_rebalances(id),
  from_asset        VARCHAR(10) NOT NULL,
  to_asset          VARCHAR(10) NOT NULL,
  amount_from       DECIMAL(18,8) NOT NULL,
  amount_to         DECIMAL(18,8) NOT NULL,
  exchange_rate     DECIMAL(18,8),
  dex_used          VARCHAR(50),
  transaction_hash  VARCHAR(255),
  gas_fee           DECIMAL(18,8),
  status            VARCHAR(50) DEFAULT 'pending',
  swapped_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pool_proposals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id               UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
  title                 VARCHAR(255) NOT NULL,
  description           TEXT NOT NULL,
  proposal_type         VARCHAR(50) NOT NULL,
  details               JSONB,
  total_voting_power    DECIMAL(18,8) DEFAULT 0,
  votes_for             DECIMAL(18,8) DEFAULT 0,
  votes_against         DECIMAL(18,8) DEFAULT 0,
  votes_abstain         DECIMAL(18,8) DEFAULT 0,
  quorum_required       DECIMAL(5,2) DEFAULT 30.00,
  approval_threshold    DECIMAL(5,2) DEFAULT 51.00,
  status                VARCHAR(50) DEFAULT 'active',
  created_by            VARCHAR REFERENCES users(id),
  created_at            TIMESTAMP DEFAULT NOW(),
  voting_ends_at        TIMESTAMP NOT NULL,
  executed_at           TIMESTAMP,
  execution_tx_hash     VARCHAR(255),
  execution_result      JSONB
);

CREATE TABLE IF NOT EXISTS pool_votes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id       UUID NOT NULL REFERENCES pool_proposals(id) ON DELETE CASCADE,
  user_id           VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote              VARCHAR(20) NOT NULL,
  voting_power      DECIMAL(18,8) NOT NULL,
  share_percentage  DECIMAL(10,6),
  reason            TEXT,
  voted_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pool_governance_settings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id                   UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
  default_quorum            DECIMAL(5,2) DEFAULT 30.00,
  default_approval_threshold DECIMAL(5,2) DEFAULT 51.00,
  voting_period_days        INTEGER DEFAULT 3,
  min_shares_to_propose     DECIMAL(18,8) DEFAULT 1.0,
  proposal_cooldown_hours   INTEGER DEFAULT 24,
  timelock_hours            INTEGER DEFAULT 24,
  governance_enabled        BOOLEAN DEFAULT TRUE,
  created_at                TIMESTAMP DEFAULT NOW(),
  updated_at                TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pool_vote_delegations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id           UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
  delegator_id      VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delegate_id       VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delegated_shares  DECIMAL(18,8) NOT NULL,
  is_active         BOOLEAN DEFAULT TRUE,
  delegated_at      TIMESTAMP DEFAULT NOW(),
  revoked_at        TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pool_share_listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id         UUID REFERENCES investment_pools(id) ON DELETE CASCADE,
  seller_id       VARCHAR REFERENCES users(id),
  shares          DECIMAL(18,8) NOT NULL,
  price_per_share DECIMAL(18,8) NOT NULL,
  status          VARCHAR(20) DEFAULT 'active',
  created_at      TIMESTAMP DEFAULT NOW(),
  expires_at      TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pool_share_trades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID REFERENCES pool_share_listings(id),
  pool_id         UUID REFERENCES investment_pools(id),
  buyer_id        VARCHAR REFERENCES users(id),
  seller_id       VARCHAR REFERENCES users(id),
  shares          DECIMAL(18,8) NOT NULL,
  price_per_share DECIMAL(18,8) NOT NULL,
  total_amount    DECIMAL(18,2) NOT NULL,
  status          VARCHAR(20) DEFAULT 'completed',
  traded_at       TIMESTAMP DEFAULT NOW()
);

-- Asset Graph (Market Nervous System)
CREATE TABLE IF NOT EXISTS asset_nodes (
  id          VARCHAR(255) PRIMARY KEY,
  version     INTEGER NOT NULL,
  node_data   JSONB NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS asset_nodes_version_idx    ON asset_nodes(version);
CREATE INDEX IF NOT EXISTS asset_nodes_id_version_idx ON asset_nodes(id, version);

CREATE TABLE IF NOT EXISTS asset_edges (
  id                    VARCHAR(255) PRIMARY KEY,
  version               INTEGER NOT NULL,
  source_asset_id       VARCHAR(255) NOT NULL,
  target_asset_id       VARCHAR(255) NOT NULL,
  relationship_type     VARCHAR(50) NOT NULL,
  edge_data             JSONB NOT NULL,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS asset_edges_version_idx       ON asset_edges(version);
CREATE INDEX IF NOT EXISTS asset_edges_source_idx        ON asset_edges(source_asset_id);
CREATE INDEX IF NOT EXISTS asset_edges_type_idx          ON asset_edges(relationship_type);
CREATE INDEX IF NOT EXISTS asset_edges_version_type_idx  ON asset_edges(version, relationship_type);

CREATE TABLE IF NOT EXISTS asset_graph_versions (
  version               INTEGER PRIMARY KEY NOT NULL,
  timestamp             TIMESTAMP NOT NULL DEFAULT NOW(),
  node_hash             VARCHAR(64) NOT NULL,
  edge_hash             VARCHAR(64) NOT NULL,
  node_count            INTEGER NOT NULL,
  edge_count            INTEGER NOT NULL,
  change_reason         VARCHAR(50),
  change_details        TEXT,
  edge_count_by_type    JSONB DEFAULT '{}',
  edge_count_by_chain   JSONB DEFAULT '{}',
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS asset_graph_versions_timestamp_idx  ON asset_graph_versions(timestamp);
CREATE INDEX IF NOT EXISTS asset_graph_versions_node_hash_idx  ON asset_graph_versions(node_hash);

CREATE TABLE IF NOT EXISTS correlation_matrices (
  matrix_version                    INTEGER PRIMARY KEY NOT NULL,
  timestamp                         TIMESTAMP NOT NULL DEFAULT NOW(),
  computed_against_graph_version    INTEGER NOT NULL,
  correlation_matrix                JSONB NOT NULL DEFAULT '{}',
  strong_positive_correlations      JSONB DEFAULT '[]',
  strong_negative_correlations      JSONB DEFAULT '[]',
  lookback_period                   VARCHAR(10) DEFAULT '30d',
  completeness                      INTEGER,
  created_at                        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS correlation_matrices_graph_version_idx ON correlation_matrices(computed_against_graph_version);
CREATE INDEX IF NOT EXISTS correlation_matrices_timestamp_idx     ON correlation_matrices(timestamp);

CREATE TABLE IF NOT EXISTS asset_state_snapshots (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_node_id             VARCHAR(255) NOT NULL,
  symbol                    VARCHAR(20) NOT NULL,
  timestamp                 TIMESTAMP NOT NULL DEFAULT NOW(),
  price_usd                 DECIMAL(18,8),
  price_confidence          INTEGER,
  price_sources             JSONB DEFAULT '[]',
  chain_specific_prices     JSONB DEFAULT '{}',
  technical_rsi14           DECIMAL(5,2),
  technical_macd_value      DECIMAL(18,8),
  technical_macd_signal     DECIMAL(18,8),
  technical_macd_histogram  DECIMAL(18,8),
  technical_trend           VARCHAR(30),
  technical_momentum        INTEGER,
  technical_signals         JSONB DEFAULT '{}',
  yield_data                JSONB DEFAULT '{}',
  yield_estimate_30d        DECIMAL(18,8),
  yield_estimate_1y         DECIMAL(18,8),
  risk_smart_contract_score INTEGER,
  risk_oracle_score         INTEGER,
  risk_governance_score     INTEGER,
  risk_liquidation_risk     INTEGER,
  risk_overall_score        INTEGER,
  risk_weighted_by_dao_type JSONB DEFAULT '{}',
  liquidity_depth_1pct      DECIMAL(18,2),
  liquidity_depth_5pct      DECIMAL(18,2),
  liquidity_by_chain        JSONB DEFAULT '{}',
  graph_version             INTEGER NOT NULL DEFAULT 0,
  correlation_version       INTEGER NOT NULL DEFAULT 0,
  shard_update_status       JSONB DEFAULT '{}',
  is_stale                  BOOLEAN DEFAULT FALSE,
  completeness              INTEGER,
  created_at                TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS asset_state_snapshots_asset_node_id_idx ON asset_state_snapshots(asset_node_id);
CREATE INDEX IF NOT EXISTS asset_state_snapshots_symbol_idx         ON asset_state_snapshots(symbol);
CREATE INDEX IF NOT EXISTS asset_state_snapshots_timestamp_idx      ON asset_state_snapshots(timestamp);
CREATE INDEX IF NOT EXISTS asset_state_snapshots_graph_version_idx  ON asset_state_snapshots(graph_version);

-- Stable Asset Registry & Inflow Events
CREATE TABLE IF NOT EXISTS stable_asset_registry (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain                       VARCHAR(50) NOT NULL,
  chain_id                    INTEGER NOT NULL,
  token_address               VARCHAR(255) NOT NULL,
  symbol                      VARCHAR(20) NOT NULL,
  decimals                    INTEGER NOT NULL DEFAULT 6,
  risk_score                  INTEGER NOT NULL DEFAULT 20,
  liquidity_score             INTEGER NOT NULL DEFAULT 70,
  depeg_threshold_bps         INTEGER NOT NULL DEFAULT 100,
  min_confirmations           INTEGER NOT NULL DEFAULT 3,
  max_confirmation_delay_sec  INTEGER NOT NULL DEFAULT 900,
  peg_target_usd              DECIMAL(18,8) NOT NULL DEFAULT 1.00,
  is_active                   BOOLEAN DEFAULT TRUE,
  metadata                    JSONB DEFAULT '{}',
  created_at                  TIMESTAMP DEFAULT NOW(),
  updated_at                  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stable_asset_registry_chain_token_idx ON stable_asset_registry(chain_id, token_address);
CREATE INDEX IF NOT EXISTS stable_asset_registry_symbol_idx      ON stable_asset_registry(symbol);
CREATE INDEX IF NOT EXISTS stable_asset_registry_active_idx      ON stable_asset_registry(is_active);

CREATE TABLE IF NOT EXISTS stable_inflow_events (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source                          VARCHAR(50) NOT NULL DEFAULT 'webhook',
  chain                           VARCHAR(50) NOT NULL,
  chain_id                        INTEGER NOT NULL,
  tx_hash                         VARCHAR(255) NOT NULL,
  log_index                       INTEGER NOT NULL DEFAULT 0,
  token_address                   VARCHAR(255) NOT NULL,
  token_symbol                    VARCHAR(20) NOT NULL,
  token_decimals                  INTEGER NOT NULL,
  to_address                      VARCHAR(255) NOT NULL,
  from_address                    VARCHAR(255),
  raw_amount                      NUMERIC(78,0) NOT NULL,
  normalized_token_amount         DECIMAL(38,18) NOT NULL,
  normalized_amount_usd           DECIMAL(24,8) NOT NULL,
  stable_units_microusd           NUMERIC(38,0) NOT NULL,
  confirmations                   INTEGER DEFAULT 0,
  min_confirmations               INTEGER DEFAULT 0,
  confirmation_state              VARCHAR(30) NOT NULL DEFAULT 'pending',
  delay_state                     VARCHAR(30) NOT NULL DEFAULT 'unknown',
  observed_confirmation_delay_sec INTEGER,
  peg_target_usd                  DECIMAL(18,8) DEFAULT 1.00,
  observed_price_usd              DECIMAL(24,8),
  peg_deviation_bps               INTEGER DEFAULT 0,
  risk_flags                      JSONB DEFAULT '{}',
  status                          VARCHAR(30) NOT NULL DEFAULT 'received',
  metadata                        JSONB DEFAULT '{}',
  created_at                      TIMESTAMP DEFAULT NOW(),
  updated_at                      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stable_inflow_events_idempotency_idx ON stable_inflow_events(chain_id, tx_hash, log_index, token_address, to_address);
CREATE INDEX IF NOT EXISTS stable_inflow_events_status_idx      ON stable_inflow_events(status);
CREATE INDEX IF NOT EXISTS stable_inflow_events_symbol_idx      ON stable_inflow_events(token_symbol);
CREATE INDEX IF NOT EXISTS stable_inflow_events_created_at_idx  ON stable_inflow_events(created_at);
