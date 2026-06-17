
-- =============================================================================
-- SECTION 12: FINANCIAL ENHANCED — REPUTATION, VESTING, KYC, ESCROW, INVOICE
-- =============================================================================

CREATE TABLE IF NOT EXISTS msiamo_points (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR NOT NULL REFERENCES users(id),
  dao_id        UUID REFERENCES daos(id),
  points        INTEGER NOT NULL,
  action        VARCHAR NOT NULL,
  description   VARCHAR,
  multiplier    DECIMAL(3,2) DEFAULT 1.0,
  verifiable    BOOLEAN DEFAULT TRUE,
  proof_hash    VARCHAR,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contribution_graph (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               VARCHAR NOT NULL REFERENCES users(id),
  contribution_type     VARCHAR NOT NULL,
  dao_id                UUID REFERENCES daos(id),
  value                 DECIMAL(18,8),
  reputation_weight     INTEGER NOT NULL,
  impact_score          INTEGER DEFAULT 0,
  verified              BOOLEAN DEFAULT FALSE,
  verified_by           VARCHAR REFERENCES users(id),
  verified_at           TIMESTAMP,
  proof_data            JSONB,
  on_chain_tx_hash      VARCHAR,
  metadata              JSONB,
  related_entity_id     UUID,
  related_entity_type   VARCHAR,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reputation_badges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           VARCHAR NOT NULL REFERENCES users(id),
  badge_type        VARCHAR NOT NULL,
  badge_tier        VARCHAR NOT NULL,
  name              VARCHAR NOT NULL,
  description       TEXT,
  image_url         VARCHAR,
  category          VARCHAR NOT NULL,
  criteria_type     VARCHAR NOT NULL,
  criteria_value    INTEGER,
  token_id          VARCHAR UNIQUE,
  contract_address  VARCHAR,
  chain_id          INTEGER DEFAULT 44787,
  is_soulbound      BOOLEAN DEFAULT TRUE,
  is_active         BOOLEAN DEFAULT TRUE,
  expires_at        TIMESTAMP,
  metadata          JSONB,
  earned_at         TIMESTAMP DEFAULT NOW(),
  revoked_at        TIMESTAMP,
  revoked_reason    TEXT
);

CREATE TABLE IF NOT EXISTS economic_identity (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 VARCHAR NOT NULL UNIQUE REFERENCES users(id),
  phone_number            VARCHAR,
  contribution_score      INTEGER DEFAULT 0,
  liquidity_score         INTEGER DEFAULT 0,
  governance_score        INTEGER DEFAULT 0,
  social_score            INTEGER DEFAULT 0,
  reliability_score       INTEGER DEFAULT 0,
  total_score             INTEGER DEFAULT 0,
  credit_limit            DECIMAL(18,2) DEFAULT 0,
  default_risk            VARCHAR DEFAULT 'unknown',
  loan_count              INTEGER DEFAULT 0,
  loan_default_count      INTEGER DEFAULT 0,
  active_days             INTEGER DEFAULT 0,
  last_active_date        TIMESTAMP,
  longest_streak          INTEGER DEFAULT 0,
  current_streak          INTEGER DEFAULT 0,
  phone_verified          BOOLEAN DEFAULT FALSE,
  kyc_verified            BOOLEAN DEFAULT FALSE,
  address_verified        BOOLEAN DEFAULT FALSE,
  verification_metadata   JSONB,
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skill_verifications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               VARCHAR NOT NULL REFERENCES users(id),
  skill_name            VARCHAR NOT NULL,
  skill_category        VARCHAR NOT NULL,
  verified              BOOLEAN DEFAULT FALSE,
  verified_by           VARCHAR REFERENCES users(id),
  verification_method   VARCHAR,
  verification_proof    JSONB,
  proficiency_level     VARCHAR NOT NULL,
  endorsement_count     INTEGER DEFAULT 0,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS msiamo_conversions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           VARCHAR NOT NULL REFERENCES users(id),
  points_converted  INTEGER NOT NULL,
  tokens_received   DECIMAL(18,8) NOT NULL,
  conversion_rate   DECIMAL(10,4) NOT NULL,
  transaction_hash  VARCHAR,
  status            VARCHAR DEFAULT 'pending',
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS airdrop_eligibility (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           VARCHAR NOT NULL REFERENCES users(id),
  airdrop_id        VARCHAR NOT NULL,
  eligible_amount   DECIMAL(18,8) NOT NULL,
  minimum_reputation INTEGER NOT NULL,
  user_reputation   INTEGER NOT NULL,
  claimed           BOOLEAN DEFAULT FALSE,
  claimed_at        TIMESTAMP,
  transaction_hash  VARCHAR,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Micro-withdrawals
CREATE TABLE IF NOT EXISTS micro_withdrawal_batches (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_count     INTEGER NOT NULL,
  total_amount      DECIMAL(18,2) NOT NULL,
  currency          VARCHAR(10) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  estimated_gas_fee DECIMAL(18,8),
  actual_gas_fee    DECIMAL(18,8),
  transaction_hash  VARCHAR(255),
  failure_reason    TEXT,
  triggered_by      VARCHAR(50) NOT NULL,
  processed_at      TIMESTAMP,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT batch_valid_status CHECK (status IN ('pending','processing','processed','failed')),
  CONSTRAINT valid_trigger CHECK (triggered_by IN ('count','amount','time','manual','api'))
);

CREATE TABLE IF NOT EXISTS micro_withdrawals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount              DECIMAL(10,2) NOT NULL,
  currency            VARCHAR(10) NOT NULL,
  to_address          VARCHAR(255) NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending',
  batch_id            UUID REFERENCES micro_withdrawal_batches(id) ON DELETE SET NULL,
  estimated_gas_fee   DECIMAL(18,8),
  actual_gas_fee      DECIMAL(18,8),
  transaction_hash    VARCHAR(255),
  cancelled_at        TIMESTAMP,
  cancelled_reason    TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at        TIMESTAMP,
  CONSTRAINT amount_range CHECK (amount >= 0.50 AND amount <= 10.00),
  CONSTRAINT valid_address CHECK (to_address ~ '^0x[a-fA-F0-9]{40}$'),
  CONSTRAINT valid_currency CHECK (currency IN ('USDC','USDT','cUSD','ETH')),
  CONSTRAINT valid_status CHECK (status IN ('pending','batched','processed','failed','cancelled'))
);

CREATE INDEX IF NOT EXISTS micro_withdrawals_user_id_idx    ON micro_withdrawals(user_id);
CREATE INDEX IF NOT EXISTS micro_withdrawals_status_idx     ON micro_withdrawals(status);
CREATE INDEX IF NOT EXISTS micro_withdrawals_batch_id_idx   ON micro_withdrawals(batch_id);
CREATE INDEX IF NOT EXISTS micro_withdrawal_batches_status_idx ON micro_withdrawal_batches(status);

-- Vesting
CREATE TABLE IF NOT EXISTS vesting_schedules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           VARCHAR NOT NULL REFERENCES users(id),
  schedule_type     VARCHAR NOT NULL,
  total_tokens      DECIMAL(18,8) NOT NULL,
  vested_tokens     DECIMAL(18,8) DEFAULT 0,
  claimed_tokens    DECIMAL(18,8) DEFAULT 0,
  start_date        TIMESTAMP NOT NULL,
  end_date          TIMESTAMP NOT NULL,
  cliff_duration    INTEGER DEFAULT 0,
  vesting_duration  INTEGER NOT NULL,
  vesting_interval  INTEGER DEFAULT 1,
  is_active         BOOLEAN DEFAULT TRUE,
  reason            VARCHAR,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vesting_claims (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id       UUID NOT NULL REFERENCES vesting_schedules(id),
  user_id           VARCHAR NOT NULL REFERENCES users(id),
  claimed_amount    DECIMAL(18,8) NOT NULL,
  transaction_hash  VARCHAR,
  claimed_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vesting_milestones (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id       UUID NOT NULL REFERENCES vesting_schedules(id),
  milestone_type    VARCHAR NOT NULL,
  description       VARCHAR,
  target_value      DECIMAL(18,8) NOT NULL,
  current_value     DECIMAL(18,8) DEFAULT 0,
  tokens_to_release DECIMAL(18,8) NOT NULL,
  is_completed      BOOLEAN DEFAULT FALSE,
  completed_at      TIMESTAMP
);

-- KYC (compliance-grade, separate from user_kyc)
CREATE TABLE IF NOT EXISTS kyc_verifications (
  id                          SERIAL PRIMARY KEY,
  user_id                     TEXT NOT NULL,
  tier                        TEXT NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'pending',
  email                       TEXT,
  email_verified              BOOLEAN DEFAULT FALSE,
  phone                       TEXT,
  phone_verified              BOOLEAN DEFAULT FALSE,
  id_document_type            TEXT,
  id_document_number          TEXT,
  id_document_front_url       TEXT,
  id_document_back_url        TEXT,
  id_verification_status      TEXT,
  proof_of_address_type       TEXT,
  proof_of_address_url        TEXT,
  address_verification_status TEXT,
  first_name                  TEXT,
  last_name                   TEXT,
  date_of_birth               TEXT,
  nationality                 TEXT,
  address                     TEXT,
  city                        TEXT,
  state                       TEXT,
  postal_code                 TEXT,
  country                     TEXT,
  verification_provider       TEXT,
  verification_reference      TEXT,
  verification_data           JSONB,
  aml_screening_status        TEXT,
  aml_screening_provider      TEXT,
  aml_screening_reference     TEXT,
  aml_screening_data          JSONB,
  daily_limit                 INTEGER DEFAULT 100,
  monthly_limit               INTEGER DEFAULT 3000,
  annual_limit                INTEGER DEFAULT 10000,
  reviewed_by                 TEXT,
  reviewed_at                 TIMESTAMP,
  rejection_reason            TEXT,
  notes                       TEXT,
  submitted_at                TIMESTAMP,
  approved_at                 TIMESTAMP,
  expires_at                  TIMESTAMP,
  created_at                  TIMESTAMP DEFAULT NOW(),
  updated_at                  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance_audit_logs (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  event_data  JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  severity    TEXT,
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suspicious_activities (
  id                      SERIAL PRIMARY KEY,
  user_id                 TEXT NOT NULL,
  activity_type           TEXT NOT NULL,
  description             TEXT NOT NULL,
  severity                TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'pending',
  detected_by             TEXT,
  detection_rules         JSONB,
  related_transactions    JSONB,
  investigated_by         TEXT,
  investigation_notes     TEXT,
  investigated_at         TIMESTAMP,
  resolution              TEXT,
  resolved_by             TEXT,
  resolved_at             TIMESTAMP,
  reported_to_authorities BOOLEAN DEFAULT FALSE,
  report_reference        TEXT,
  reported_at             TIMESTAMP,
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW()
);

-- Escrow
CREATE TABLE IF NOT EXISTS escrow_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id               UUID REFERENCES tasks(id),
  payer_id              VARCHAR NOT NULL REFERENCES users(id),
  payee_id              VARCHAR NOT NULL REFERENCES users(id),
  amount                DECIMAL(18,8) NOT NULL,
  currency              VARCHAR NOT NULL DEFAULT 'cUSD',
  status                VARCHAR NOT NULL DEFAULT 'pending',
  milestones            JSONB DEFAULT '[]',
  current_milestone     VARCHAR DEFAULT '0',
  funded_at             TIMESTAMP,
  released_at           TIMESTAMP,
  refunded_at           TIMESTAMP,
  dispute_reason        TEXT,
  disputed_at           TIMESTAMP,
  resolved_at           TIMESTAMP,
  transaction_hash      VARCHAR,
  dao_id                UUID REFERENCES daos(id),
  mediator_id           VARCHAR REFERENCES users(id),
  mediator_approved_at  TIMESTAMP,
  dispute_winner        VARCHAR,
  dispute_percentages   JSONB DEFAULT '{"payer":0,"payee":100}',
  guardians             JSONB DEFAULT '[]',
  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS escrow_milestones (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id         UUID NOT NULL REFERENCES escrow_accounts(id),
  milestone_number  VARCHAR NOT NULL,
  description       TEXT NOT NULL,
  amount            DECIMAL(18,8) NOT NULL,
  status            VARCHAR NOT NULL DEFAULT 'pending',
  approved_by       VARCHAR REFERENCES users(id),
  approved_at       TIMESTAMP,
  released_at       TIMESTAMP,
  proof_url         TEXT,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS escrow_disputes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id   UUID NOT NULL REFERENCES escrow_accounts(id),
  raised_by   VARCHAR NOT NULL REFERENCES users(id),
  reason      TEXT NOT NULL,
  evidence    JSONB DEFAULT '[]',
  status      VARCHAR NOT NULL DEFAULT 'open',
  resolution  TEXT,
  resolved_by VARCHAR REFERENCES users(id),
  resolved_at TIMESTAMP,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number        VARCHAR NOT NULL UNIQUE,
  from_user_id          VARCHAR NOT NULL REFERENCES users(id),
  to_user_id            VARCHAR REFERENCES users(id),
  dao_id                UUID REFERENCES daos(id),
  recipient_email       VARCHAR,
  recipient_name        VARCHAR,
  amount                DECIMAL(18,8) NOT NULL,
  currency              VARCHAR NOT NULL DEFAULT 'cUSD',
  description           TEXT NOT NULL,
  line_items            JSONB DEFAULT '[]',
  subtotal              DECIMAL(18,8) DEFAULT 0,
  tax                   DECIMAL(18,8) DEFAULT 0,
  total                 DECIMAL(18,8),
  status                VARCHAR NOT NULL DEFAULT 'draft',
  due_date              TIMESTAMP,
  sent_at               TIMESTAMP,
  paid_at               TIMESTAMP,
  payment_method        VARCHAR,
  transaction_hash      VARCHAR,
  notes                 TEXT,
  terms_and_conditions  TEXT,
  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID NOT NULL REFERENCES invoices(id),
  payer_id          VARCHAR NOT NULL REFERENCES users(id),
  amount            DECIMAL(18,8) NOT NULL,
  currency          VARCHAR NOT NULL,
  payment_method    VARCHAR NOT NULL,
  transaction_hash  VARCHAR,
  status            VARCHAR NOT NULL DEFAULT 'pending',
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMP DEFAULT NOW()
);
