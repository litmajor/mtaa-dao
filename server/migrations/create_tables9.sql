-- =============================================================================
-- SECTION 15: PLATFORM METRICS, RULES ENGINE, TRADING & MISC
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_metrics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp           TIMESTAMP NOT NULL DEFAULT NOW(),
  total_daos          INTEGER NOT NULL DEFAULT 0,
  active_daos         INTEGER NOT NULL DEFAULT 0,
  total_members       INTEGER NOT NULL DEFAULT 0,
  total_vaults        INTEGER NOT NULL DEFAULT 0,
  active_vaults       INTEGER NOT NULL DEFAULT 0,
  total_tvl           NUMERIC(20,8) NOT NULL DEFAULT 0,
  total_transactions  INTEGER NOT NULL DEFAULT 0,
  total_fees          NUMERIC(20,8) NOT NULL DEFAULT 0,
  total_revenue       NUMERIC(20,8) NOT NULL DEFAULT 0,
  cpu_usage           NUMERIC(5,2) DEFAULT 0,
  memory_usage        NUMERIC(5,2) DEFAULT 0,
  disk_usage          NUMERIC(5,2) DEFAULT 0,
  network_latency     INTEGER DEFAULT 0,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS defi_protocol_metrics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_name VARCHAR NOT NULL,
  timestamp     TIMESTAMP NOT NULL DEFAULT NOW(),
  tvl           NUMERIC(20,8) DEFAULT 0,
  total_users   INTEGER DEFAULT 0,
  status        VARCHAR DEFAULT 'active',
  last_update   TIMESTAMP NOT NULL,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cefi_exchange_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_name   VARCHAR NOT NULL,
  timestamp       TIMESTAMP NOT NULL DEFAULT NOW(),
  volume_24h      NUMERIC(20,8) DEFAULT 0,
  users           INTEGER DEFAULT 0,
  status          VARCHAR DEFAULT 'active',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blockchain_health_metrics (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_name              VARCHAR NOT NULL,
  timestamp               TIMESTAMP NOT NULL DEFAULT NOW(),
  block_height            INTEGER DEFAULT 0,
  transaction_count       INTEGER DEFAULT 0,
  average_block_time      NUMERIC(10,2) DEFAULT 0,
  network_health_score    NUMERIC(5,2) DEFAULT 100,
  status                  VARCHAR DEFAULT 'healthy',
  metadata                JSONB DEFAULT '{}',
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS liquidity_pool_metrics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_address      VARCHAR NOT NULL,
  chain_id          VARCHAR NOT NULL,
  timestamp         TIMESTAMP NOT NULL DEFAULT NOW(),
  total_liquidity   NUMERIC(20,8) DEFAULT 0,
  volume_24h        NUMERIC(20,8) DEFAULT 0,
  fee_24h           NUMERIC(20,8) DEFAULT 0,
  token_a_balance   NUMERIC(20,8) DEFAULT 0,
  token_b_balance   NUMERIC(20,8) DEFAULT 0,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS revenue_metrics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                TEXT NOT NULL,
  total_revenue       NUMERIC(20,8) NOT NULL DEFAULT 0,
  transaction_fees    NUMERIC(20,8) NOT NULL DEFAULT 0,
  platform_fees       NUMERIC(20,8) NOT NULL DEFAULT 0,
  other_revenue       NUMERIC(20,8) NOT NULL DEFAULT 0,
  revenue_by_source   JSONB DEFAULT '{}',
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_provider_metrics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name       VARCHAR NOT NULL,
  timestamp           TIMESTAMP NOT NULL DEFAULT NOW(),
  success_rate        NUMERIC(5,2) DEFAULT 0,
  total_transactions  INTEGER DEFAULT 0,
  total_volume        NUMERIC(20,8) DEFAULT 0,
  status              VARCHAR DEFAULT 'active',
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_performance_metrics (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id                VARCHAR NOT NULL,
  date                    TEXT NOT NULL,
  tasks_completed         INTEGER NOT NULL DEFAULT 0,
  success_rate            NUMERIC(5,2) DEFAULT 0,
  average_response_time   NUMERIC(10,2) DEFAULT 0,
  user_satisfaction       NUMERIC(5,2) DEFAULT 0,
  metadata                JSONB DEFAULT '{}',
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_usage_metrics (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                    TEXT NOT NULL,
  total_requests          INTEGER NOT NULL DEFAULT 0,
  successful_requests     INTEGER NOT NULL DEFAULT 0,
  failed_requests         INTEGER NOT NULL DEFAULT 0,
  average_response_time   NUMERIC(10,2) DEFAULT 0,
  total_data_transferred  NUMERIC(20,8) DEFAULT 0,
  top_endpoints           JSONB DEFAULT '{}',
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_growth_metrics (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                  TEXT NOT NULL,
  new_users             INTEGER NOT NULL DEFAULT 0,
  total_users           INTEGER NOT NULL DEFAULT 0,
  user_retention        NUMERIC(5,2) DEFAULT 0,
  new_daos              INTEGER NOT NULL DEFAULT 0,
  total_daos            INTEGER NOT NULL DEFAULT 0,
  monthly_active_users  INTEGER NOT NULL DEFAULT 0,
  weekly_active_users   INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_metrics (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                        TEXT NOT NULL,
  total_referrals             INTEGER NOT NULL DEFAULT 0,
  new_referrals_today         INTEGER NOT NULL DEFAULT 0,
  referred_users_count        INTEGER NOT NULL DEFAULT 0,
  referred_users_active       INTEGER NOT NULL DEFAULT 0,
  total_referral_rewards      NUMERIC(20,8) NOT NULL DEFAULT 0,
  rewards_distributed_today   NUMERIC(20,8) NOT NULL DEFAULT 0,
  average_reward_per_referral NUMERIC(20,8) NOT NULL DEFAULT 0,
  top_referrer_count          INTEGER DEFAULT 0,
  average_referrals_per_user  NUMERIC(10,2) DEFAULT 0,
  created_at                  TIMESTAMP DEFAULT NOW(),
  updated_at                  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reward_distribution (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id        VARCHAR NOT NULL,
  reward_type         VARCHAR NOT NULL,
  date                TEXT NOT NULL,
  amount              NUMERIC(20,8) NOT NULL DEFAULT 0,
  status              VARCHAR NOT NULL DEFAULT 'pending',
  distribution_date   TIMESTAMP,
  source              VARCHAR DEFAULT 'activities',
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_ticket_metrics (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                      TEXT NOT NULL,
  total_tickets             INTEGER NOT NULL DEFAULT 0,
  open_tickets              INTEGER NOT NULL DEFAULT 0,
  resolved_tickets          INTEGER NOT NULL DEFAULT 0,
  average_resolution_time   NUMERIC(10,2) DEFAULT 0,
  customer_satisfaction     NUMERIC(5,2) DEFAULT 0,
  created_at                TIMESTAMP DEFAULT NOW(),
  updated_at                TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- SECTION 16: RULES ENGINE
-- =============================================================================

CREATE TABLE IF NOT EXISTS rule_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR NOT NULL UNIQUE,
  category    VARCHAR NOT NULL,
  description TEXT,
  rule_config JSONB NOT NULL,
  is_default  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dao_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id      UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  template_id UUID REFERENCES rule_templates(id),
  name        VARCHAR NOT NULL,
  description TEXT,
  event_type  VARCHAR NOT NULL,
  rule_config JSONB NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  priority    INTEGER DEFAULT 100,
  created_by  VARCHAR NOT NULL REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  updated_by  VARCHAR REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS rule_executions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id             UUID NOT NULL REFERENCES dao_rules(id) ON DELETE CASCADE,
  dao_id              UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  event_type          VARCHAR NOT NULL,
  context             JSONB NOT NULL,
  conditions_met      BOOLEAN NOT NULL,
  actions_executed    JSONB DEFAULT '[]',
  execution_result    VARCHAR NOT NULL,
  error_message       TEXT,
  execution_time_ms   INTEGER,
  executed_at         TIMESTAMP DEFAULT NOW(),
  executed_by         VARCHAR REFERENCES users(id)
);

-- =============================================================================
-- SECTION 17: TRADING (LIMIT ORDERS, EXECUTION METRICS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS limit_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exchange        VARCHAR(50) NOT NULL,
  order_id        VARCHAR(255) NOT NULL,
  symbol          VARCHAR(20) NOT NULL,
  side            VARCHAR(10) NOT NULL,
  amount          NUMERIC(20,8) NOT NULL,
  price           NUMERIC(20,8) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  filled_amount   NUMERIC(20,8) DEFAULT 0,
  filled_price    NUMERIC(20,8),
  fee             NUMERIC(20,8) DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW(),
  filled_at       TIMESTAMP,
  expires_at      TIMESTAMP NOT NULL,
  canceled_at     TIMESTAMP,
  last_checked_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS execution_metrics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          VARCHAR(255) NOT NULL,
  exchange          VARCHAR(50) NOT NULL,
  symbol            VARCHAR(20) NOT NULL,
  expected_price    NUMERIC(20,8) NOT NULL,
  actual_price      NUMERIC(20,8) NOT NULL,
  slippage_percent  NUMERIC(10,6) NOT NULL DEFAULT 0,
  filled            NUMERIC(20,8),
  fill_time_ms      INTEGER,
  success           BOOLEAN NOT NULL DEFAULT TRUE,
  accuracy          NUMERIC(5,2) NOT NULL DEFAULT 100,
  strategy          VARCHAR(50) DEFAULT 'unknown',
  side              VARCHAR(10),
  amount            NUMERIC(20,8),
  recorded_at       TIMESTAMP DEFAULT NOW(),
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_execution_metrics_exchange_symbol ON execution_metrics(exchange, symbol, recorded_at);
CREATE INDEX IF NOT EXISTS idx_execution_metrics_recorded_at     ON execution_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_execution_metrics_order_id        ON execution_metrics(order_id);
CREATE INDEX IF NOT EXISTS idx_execution_metrics_success         ON execution_metrics(success, recorded_at);

CREATE TABLE IF NOT EXISTS execution_statistics (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange              VARCHAR(50) NOT NULL,
  symbol                VARCHAR(20) NOT NULL,
  total_executions      INTEGER NOT NULL DEFAULT 0,
  successful_executions INTEGER NOT NULL DEFAULT 0,
  success_rate          NUMERIC(5,2) NOT NULL DEFAULT 0,
  average_slippage      NUMERIC(10,6) NOT NULL DEFAULT 0,
  min_slippage          NUMERIC(10,6),
  max_slippage          NUMERIC(10,6),
  average_fill_time_ms  INTEGER DEFAULT 0,
  average_accuracy      NUMERIC(5,2) NOT NULL DEFAULT 0,
  accuracy_trend        NUMERIC(5,2) DEFAULT 0,
  improvement_rate      NUMERIC(5,2) DEFAULT 0,
  last_updated          TIMESTAMP DEFAULT NOW(),
  window_start          DATE NOT NULL,
  window_end            DATE NOT NULL,
  CONSTRAINT execution_statistics_unique UNIQUE (exchange, symbol, window_start, window_end)
);

CREATE INDEX IF NOT EXISTS idx_execution_statistics_exchange_symbol ON execution_statistics(exchange, symbol);

CREATE TABLE IF NOT EXISTS execution_history (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 VARCHAR NOT NULL,
  order_id                VARCHAR(255) NOT NULL,
  exchange                VARCHAR(50) NOT NULL,
  symbol                  VARCHAR(20) NOT NULL,
  side                    VARCHAR(10) NOT NULL,
  amount                  NUMERIC(20,8) NOT NULL,
  expected_price          NUMERIC(20,8) NOT NULL,
  actual_price            NUMERIC(20,8),
  status                  VARCHAR(20) NOT NULL DEFAULT 'pending',
  filled_amount           NUMERIC(20,8) DEFAULT 0,
  slippage_percent        NUMERIC(10,6) DEFAULT 0,
  accuracy                NUMERIC(5,2) DEFAULT 100,
  strategy_used           VARCHAR(50),
  venue_recommendation    VARCHAR(100),
  created_at              TIMESTAMP DEFAULT NOW(),
  executed_at             TIMESTAMP,
  completed_at            TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_execution_history_user_id ON execution_history(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_execution_history_status  ON execution_history(status, created_at);
CREATE INDEX IF NOT EXISTS idx_execution_history_symbol  ON execution_history(symbol, created_at);

CREATE TABLE IF NOT EXISTS venue_performance (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_type            VARCHAR(10) NOT NULL,
  exchange              VARCHAR(50) NOT NULL,
  symbol                VARCHAR(20),
  success_rate          NUMERIC(5,2) NOT NULL DEFAULT 0,
  average_accuracy      NUMERIC(5,2) NOT NULL DEFAULT 0,
  average_slippage      NUMERIC(10,6) NOT NULL DEFAULT 0,
  average_fill_time_ms  INTEGER DEFAULT 0,
  recent_success_rate   NUMERIC(5,2) DEFAULT 0,
  recent_accuracy       NUMERIC(5,2) DEFAULT 0,
  uptrend               BOOLEAN DEFAULT FALSE,
  downtrend             BOOLEAN DEFAULT FALSE,
  volatility            NUMERIC(5,2) DEFAULT 0,
  last_execution_at     TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT NOW(),
  CONSTRAINT venue_performance_unique UNIQUE (venue_type, exchange, symbol)
);

CREATE INDEX IF NOT EXISTS idx_venue_performance_type_exchange ON venue_performance(venue_type, exchange);

CREATE TABLE IF NOT EXISTS ml_training_data (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol                VARCHAR(20) NOT NULL,
  order_size            NUMERIC(20,8) NOT NULL,
  time_of_day           VARCHAR(20),
  market_volatility     NUMERIC(5,2),
  order_queue_depth     INTEGER,
  venue_type            VARCHAR(10),
  exchange              VARCHAR(50),
  liquidity_score       NUMERIC(5,2),
  actual_slippage       NUMERIC(10,6) NOT NULL,
  actual_fill_time_ms   INTEGER NOT NULL,
  execution_success     BOOLEAN NOT NULL,
  model_version         VARCHAR(20),
  prediction_accuracy   NUMERIC(5,2),
  feature_importance    JSONB,
  recorded_at           TIMESTAMP DEFAULT NOW(),
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_training_data_symbol_time ON ml_training_data(symbol, recorded_at);
CREATE INDEX IF NOT EXISTS idx_ml_training_data_venue       ON ml_training_data(venue_type, exchange);
CREATE INDEX IF NOT EXISTS idx_ml_training_data_success     ON ml_training_data(execution_success, recorded_at);

-- =============================================================================
-- SECTION 18: MISC PLATFORM TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS referral_rewards (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id       VARCHAR NOT NULL REFERENCES users(id),
  referred_user_id  VARCHAR NOT NULL REFERENCES users(id),
  dao_id            UUID NOT NULL REFERENCES daos(id),
  reward_amount     DECIMAL(10,2) DEFAULT 0,
  reward_type       VARCHAR DEFAULT 'signup',
  status            VARCHAR DEFAULT 'pending',
  claimed           BOOLEAN DEFAULT FALSE,
  awarded_at        TIMESTAMP,
  claimed_at        TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_tiers (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   VARCHAR NOT NULL REFERENCES users(id),
  dao_id                    UUID NOT NULL REFERENCES daos(id),
  tier                      VARCHAR NOT NULL,
  total_referrals           INTEGER DEFAULT 0,
  active_referrals          INTEGER DEFAULT 0,
  total_contribution_value  DECIMAL(18,2) DEFAULT 0,
  lifetime_earnings         DECIMAL(18,2) DEFAULT 0,
  badges                    JSONB DEFAULT '[]',
  last_ping_date            TIMESTAMP,
  created_at                TIMESTAMP DEFAULT NOW(),
  updated_at                TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dao_treasury_credits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id      UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  source      VARCHAR(50) NOT NULL,
  amount      DECIMAL(18,8) NOT NULL,
  user_id     VARCHAR REFERENCES users(id),
  reason      TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mtaa_distribution_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id              UUID REFERENCES daos(id) ON DELETE CASCADE,
  action_type         VARCHAR(50) NOT NULL,
  user_percentage     INTEGER NOT NULL DEFAULT 90,
  dao_percentage      INTEGER NOT NULL DEFAULT 10,
  platform_percentage INTEGER NOT NULL DEFAULT 0,
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dao_achievement_milestones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id        UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  type          VARCHAR(50) NOT NULL,
  threshold     INTEGER NOT NULL,
  mtaa_reward   DECIMAL(18,8) NOT NULL,
  completed_at  TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_facilities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id          UUID NOT NULL REFERENCES daos(id),
  address         VARCHAR,
  stablecoin      VARCHAR,
  elder_council   VARCHAR,
  funded_amount   DECIMAL(18,8) DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           VARCHAR NOT NULL REFERENCES users(id),
  category          VARCHAR NOT NULL,
  allocated_amount  DECIMAL(10,2) NOT NULL,
  spent_amount      DECIMAL(10,2) DEFAULT 0,
  month             VARCHAR NOT NULL,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id      UUID NOT NULL REFERENCES daos(id),
  amount      DECIMAL(10,2) NOT NULL,
  currency    VARCHAR DEFAULT 'KES',
  status      VARCHAR DEFAULT 'paid',
  description TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_revenue (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id            UUID REFERENCES daos(id),
  user_id           VARCHAR REFERENCES users(id),
  amount            DECIMAL(10,2) NOT NULL,
  currency          VARCHAR DEFAULT 'KES',
  description       TEXT,
  transaction_type  VARCHAR NOT NULL,
  status            VARCHAR DEFAULT 'paid',
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR NOT NULL REFERENCES users(id),
  dao_id      UUID NOT NULL REFERENCES daos(id),
  plan        VARCHAR DEFAULT 'free',
  status      VARCHAR DEFAULT 'active',
  start_date  TIMESTAMP DEFAULT NOW(),
  end_date    TIMESTAMP,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS config (
  id          SERIAL PRIMARY KEY,
  key         VARCHAR UNIQUE NOT NULL,
  value       JSONB NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR REFERENCES users(id),
  action      TEXT NOT NULL,
  details     JSONB,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp     TIMESTAMP NOT NULL DEFAULT NOW(),
  user_id       VARCHAR REFERENCES users(id),
  user_email    VARCHAR,
  action        VARCHAR NOT NULL,
  resource      VARCHAR NOT NULL,
  resource_id   VARCHAR,
  method        VARCHAR NOT NULL,
  endpoint      VARCHAR NOT NULL,
  ip_address    VARCHAR NOT NULL,
  user_agent    VARCHAR NOT NULL,
  status        INTEGER NOT NULL,
  details       JSONB,
  severity      VARCHAR NOT NULL DEFAULT 'low',
  category      VARCHAR NOT NULL DEFAULT 'security',
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level       VARCHAR NOT NULL DEFAULT 'info',
  message     TEXT NOT NULL,
  service     VARCHAR NOT NULL DEFAULT 'api',
  metadata    JSONB,
  timestamp   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chain_info (
  id                  SERIAL PRIMARY KEY,
  chain_id            INTEGER NOT NULL,
  chain_name          VARCHAR NOT NULL,
  native_currency     JSONB NOT NULL,
  rpc_url             VARCHAR NOT NULL,
  block_explorer_url  VARCHAR,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chains (
  id                  SERIAL PRIMARY KEY,
  name                VARCHAR NOT NULL,
  chain_id            INTEGER NOT NULL,
  rpc_url             VARCHAR NOT NULL,
  block_explorer_url  VARCHAR,
  native_currency     JSONB NOT NULL,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cross_chain_proposals (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  proposal_id       TEXT NOT NULL,
  chains            TEXT[] NOT NULL,
  votes_by_chain    JSONB DEFAULT '{}',
  quorum_by_chain   JSONB DEFAULT '{}',
  execution_chain   TEXT,
  bridge_proposal_id TEXT,
  sync_status       TEXT DEFAULT 'pending',
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_splits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    VARCHAR NOT NULL,
  dao_id        UUID,
  title         VARCHAR NOT NULL,
  description   TEXT,
  total_amount  DECIMAL(18,8) NOT NULL,
  currency      VARCHAR(10) NOT NULL DEFAULT 'cUSD',
  split_method  VARCHAR(20) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_split_participants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_split_id     UUID NOT NULL REFERENCES bill_splits(id) ON DELETE CASCADE,
  user_id           VARCHAR,
  dao_id            UUID,
  wallet_address    VARCHAR,
  share_percentage  DECIMAL(5,2),
  custom_amount     DECIMAL(18,8),
  amount_owed       DECIMAL(18,8) NOT NULL,
  amount_paid       DECIMAL(18,8),
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  paid_at           TIMESTAMP,
  transaction_hash  VARCHAR,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_split_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_split_id   UUID NOT NULL REFERENCES bill_splits(id) ON DELETE CASCADE,
  payment_id      UUID REFERENCES bill_split_participants(id),
  amount          DECIMAL(18,8) NOT NULL,
  transaction_hash VARCHAR NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  confirmed_at    TIMESTAMP DEFAULT NOW(),
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bridge_transfers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_chain      VARCHAR(50) NOT NULL,
  destination_chain VARCHAR(50) NOT NULL,
  amount            DECIMAL(18,8) NOT NULL,
  token_address     VARCHAR(255) NOT NULL,
  from_address      VARCHAR(255) NOT NULL,
  to_address        VARCHAR(255) NOT NULL,
  transaction_hash  VARCHAR(255),
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number   SERIAL,
  user_id         VARCHAR REFERENCES users(id),
  name            VARCHAR NOT NULL,
  email           VARCHAR NOT NULL,
  category        VARCHAR NOT NULL,
  priority        VARCHAR DEFAULT 'medium',
  subject         TEXT NOT NULL,
  message         TEXT NOT NULL,
  status          VARCHAR DEFAULT 'open',
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS success_stories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR REFERENCES users(id),
  name          VARCHAR NOT NULL,
  email         VARCHAR NOT NULL,
  title         TEXT NOT NULL,
  story         TEXT NOT NULL,
  impact        TEXT,
  metrics       JSONB,
  status        VARCHAR DEFAULT 'pending_review',
  created_at    TIMESTAMP DEFAULT NOW(),
  published_at  TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vouchers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR UNIQUE NOT NULL,
  created_by    VARCHAR NOT NULL REFERENCES users(id),
  amount        DECIMAL(18,6) NOT NULL,
  token         VARCHAR NOT NULL,
  message       TEXT,
  expiry_date   TIMESTAMP NOT NULL,
  redeemed_by   VARCHAR REFERENCES users(id),
  redeemed_at   TIMESTAMP,
  status        VARCHAR DEFAULT 'active',
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS file_uploads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name             VARCHAR NOT NULL,
  file_type             VARCHAR NOT NULL,
  mime_type             VARCHAR NOT NULL,
  file_size             INTEGER NOT NULL,
  storage_path          VARCHAR NOT NULL,
  file_hash             VARCHAR,
  is_public             BOOLEAN DEFAULT FALSE,
  related_entity_type   VARCHAR,
  related_entity_id     VARCHAR,
  uploaded_at           TIMESTAMP DEFAULT NOW(),
  expires_at            TIMESTAMP
);

CREATE TABLE IF NOT EXISTS onboarding_progress (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           VARCHAR NOT NULL REFERENCES users(id),
  current_step      VARCHAR NOT NULL,
  completed_steps   JSONB DEFAULT '[]',
  skipped_steps     JSONB DEFAULT '[]',
  progress          INTEGER DEFAULT 0,
  is_completed      BOOLEAN DEFAULT FALSE,
  started_at        TIMESTAMP DEFAULT NOW(),
  completed_at      TIMESTAMP,
  last_activity_at  TIMESTAMP DEFAULT NOW(),
  metadata          JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS onboarding_steps (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id               VARCHAR NOT NULL UNIQUE,
  title                 VARCHAR NOT NULL,
  description           VARCHAR,
  "order"               INTEGER NOT NULL,
  is_required           BOOLEAN DEFAULT TRUE,
  category              VARCHAR DEFAULT 'general',
  estimated_minutes     INTEGER DEFAULT 5,
  icon                  VARCHAR,
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_challenges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  description       TEXT,
  challenge_type    TEXT NOT NULL,
  target_amount     TEXT,
  points_reward     INTEGER DEFAULT 50,
  is_active         BOOLEAN DEFAULT TRUE,
  valid_from        TIMESTAMP DEFAULT NOW(),
  valid_until       TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_challenges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT NOT NULL REFERENCES users(id),
  challenge_id      UUID REFERENCES daily_challenges(id),
  challenge_type    TEXT NOT NULL,
  target_amount     TEXT,
  current_progress  TEXT DEFAULT '0',
  status            TEXT DEFAULT 'in_progress',
  points_reward     INTEGER DEFAULT 50,
  reward_claimed    BOOLEAN DEFAULT FALSE,
  claimed_at        TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);
