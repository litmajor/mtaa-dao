
-- =============================================================================
-- SECTION 10: MULTISIG WALLETS
-- =============================================================================

CREATE TABLE IF NOT EXISTS multisig_wallets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id             UUID NOT NULL UNIQUE REFERENCES wallets(id) ON DELETE CASCADE,
  dao_id                UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  contract_address      VARCHAR NOT NULL UNIQUE,
  chain                 VARCHAR NOT NULL,
  chain_id              INTEGER NOT NULL,
  required_signatures   INTEGER NOT NULL,
  total_signers         INTEGER NOT NULL,
  wallet_standard       VARCHAR DEFAULT 'gnosis',
  deployed_at           TIMESTAMP,
  deployment_tx_hash    VARCHAR,
  is_active             BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

-- Now add FK for treasury_multisig_transactions.multisig_wallet_id
ALTER TABLE treasury_multisig_transactions
  ADD CONSTRAINT IF NOT EXISTS treasury_multisig_wallet_fkey
  FOREIGN KEY (multisig_wallet_id) REFERENCES multisig_wallets(id);

CREATE TABLE IF NOT EXISTS multisig_signers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  multisig_wallet_id  UUID NOT NULL REFERENCES multisig_wallets(id) ON DELETE CASCADE,
  user_id             VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signer_address      VARCHAR NOT NULL,
  signer_index        INTEGER NOT NULL,
  role                VARCHAR DEFAULT 'signer',
  is_active           BOOLEAN DEFAULT TRUE,
  joined_at           TIMESTAMP DEFAULT NOW(),
  removed_at          TIMESTAMP,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS multisig_signer_keys (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  multisig_signer_id        UUID NOT NULL UNIQUE REFERENCES multisig_signers(id) ON DELETE CASCADE,
  key_storage_location      VARCHAR NOT NULL,
  key_management_provider   VARCHAR,
  public_key_hash           VARCHAR NOT NULL,
  can_sign                  BOOLEAN DEFAULT TRUE,
  last_signed_at            TIMESTAMP,
  created_at                TIMESTAMP DEFAULT NOW(),
  updated_at                TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS multisig_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  multisig_wallet_id    UUID NOT NULL REFERENCES multisig_wallets(id) ON DELETE CASCADE,
  transaction_hash      VARCHAR,
  recipient             VARCHAR NOT NULL,
  amount                DECIMAL(18,8) NOT NULL,
  currency              VARCHAR NOT NULL,
  data                  TEXT,
  status                VARCHAR DEFAULT 'pending',
  current_signatures    INTEGER DEFAULT 0,
  required_signatures   INTEGER NOT NULL,
  proposed_by           VARCHAR NOT NULL REFERENCES users(id),
  proposed_at           TIMESTAMP DEFAULT NOW(),
  expires_at            TIMESTAMP,
  executed_at           TIMESTAMP,
  executed_by           VARCHAR REFERENCES users(id),
  rejected_at           TIMESTAMP,
  rejected_by           VARCHAR REFERENCES users(id),
  rejection_reason      TEXT,
  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS multisig_transaction_signatures (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  multisig_transaction_id   UUID NOT NULL REFERENCES multisig_transactions(id) ON DELETE CASCADE,
  multisig_signer_id        UUID NOT NULL REFERENCES multisig_signers(id) ON DELETE CASCADE,
  signature                 TEXT NOT NULL,
  signed_at                 TIMESTAMP DEFAULT NOW(),
  signature_valid           BOOLEAN DEFAULT TRUE,
  created_at                TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS multisig_creation_jobs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                VARCHAR NOT NULL UNIQUE,
  dao_id                UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  signers               JSONB DEFAULT '[]',
  required_signatures   INTEGER NOT NULL,
  chain_id              INTEGER,
  payload               JSONB DEFAULT '{}',
  status                VARCHAR DEFAULT 'queued',
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- SECTION 11: CONTRIBUTIONS, TASKS & REPUTATION
-- =============================================================================

CREATE TABLE IF NOT EXISTS contributions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           VARCHAR NOT NULL REFERENCES users(id),
  proposal_id       UUID REFERENCES proposals(id),
  dao_id            UUID NOT NULL REFERENCES daos(id),
  amount            DECIMAL(10,2) NOT NULL,
  currency          VARCHAR DEFAULT 'cUSD',
  purpose           VARCHAR DEFAULT 'general',
  is_anonymous      BOOLEAN DEFAULT FALSE,
  transaction_hash  VARCHAR,
  vault             BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dao_contribution_types (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id              UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  name                VARCHAR(50) NOT NULL,
  description         TEXT,
  minimum_amount      DECIMAL(18,2) DEFAULT 0,
  maximum_amount      DECIMAL(18,2),
  requires_approval   BOOLEAN DEFAULT FALSE,
  approvals_needed    INTEGER DEFAULT 1,
  allow_recurring     BOOLEAN DEFAULT FALSE,
  track_equity        BOOLEAN DEFAULT FALSE,
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dao_contributions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id                UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  contributor_id        VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contribution_type_id  UUID NOT NULL REFERENCES dao_contribution_types(id) ON DELETE CASCADE,
  amount                DECIMAL(18,2) NOT NULL,
  currency              VARCHAR DEFAULT 'cUSD',
  status                VARCHAR DEFAULT 'pending',
  approval_status       VARCHAR DEFAULT 'awaiting',
  approvals_count       INTEGER DEFAULT 0,
  required_approvals    INTEGER NOT NULL,
  rejection_reason      TEXT,
  completed_at          TIMESTAMP,
  description           TEXT,
  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dao_contribution_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id          UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  contribution_id UUID NOT NULL REFERENCES dao_contributions(id) ON DELETE CASCADE,
  approver_id     VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approved        BOOLEAN NOT NULL,
  comment         TEXT,
  approved_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dao_multisig_config (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id                    UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  required_approvals        INTEGER NOT NULL DEFAULT 2,
  total_signers             INTEGER NOT NULL,
  signer_addresses          JSONB DEFAULT '[]',
  withdrawal_threshold      DECIMAL(18,2) DEFAULT 1000.00,
  roles_allowed_to_approve  JSONB DEFAULT '["admin","elder"]',
  auto_complete_on_threshold BOOLEAN DEFAULT TRUE,
  created_at                TIMESTAMP DEFAULT NOW(),
  updated_at                TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id                  UUID NOT NULL REFERENCES daos(id),
  creator_id              VARCHAR NOT NULL REFERENCES users(id),
  title                   TEXT NOT NULL,
  description             TEXT NOT NULL,
  reward                  DECIMAL(10,2) NOT NULL,
  status                  VARCHAR DEFAULT 'open',
  claimer_id              VARCHAR REFERENCES users(id),
  claimed_by              VARCHAR REFERENCES users(id),
  category                VARCHAR NOT NULL,
  difficulty              VARCHAR NOT NULL,
  estimated_time          VARCHAR,
  deadline                TIMESTAMP,
  requires_verification   BOOLEAN DEFAULT FALSE,
  proof_url               TEXT,
  verification_notes      TEXT,
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               VARCHAR NOT NULL,
  description         TEXT NOT NULL,
  category            VARCHAR NOT NULL,
  difficulty          VARCHAR NOT NULL,
  estimated_hours     INTEGER DEFAULT 1,
  required_skills     JSONB DEFAULT '[]',
  bounty_amount       DECIMAL(10,2) DEFAULT 0,
  deliverables        JSONB DEFAULT '[]',
  acceptance_criteria JSONB DEFAULT '[]',
  created_by          VARCHAR NOT NULL REFERENCES users(id),
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_attachments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id             UUID NOT NULL REFERENCES tasks(id),
  file_url            VARCHAR(500) NOT NULL,
  file_name           VARCHAR(255) NOT NULL,
  mime_type           VARCHAR(100),
  file_size           INTEGER,
  uploaded_by         VARCHAR REFERENCES users(id),
  attachment_type     VARCHAR(50) DEFAULT 'document',
  is_proof            BOOLEAN DEFAULT FALSE,
  verification_status VARCHAR(50),
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id),
  user_id     VARCHAR REFERENCES users(id),
  action      VARCHAR NOT NULL,
  details     JSONB,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_reputation (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             VARCHAR NOT NULL REFERENCES users(id),
  dao_id              UUID REFERENCES daos(id),
  total_score         INTEGER DEFAULT 0,
  proposal_score      INTEGER DEFAULT 0,
  vote_score          INTEGER DEFAULT 0,
  contribution_score  INTEGER DEFAULT 0,
  last_updated        TIMESTAMP DEFAULT NOW(),
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

-- RENAMED from user_reputation in financialEnhancedSchema — gamification layer
CREATE TABLE IF NOT EXISTS user_gamification (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           VARCHAR NOT NULL UNIQUE REFERENCES users(id),
  total_points      INTEGER DEFAULT 0,
  weekly_points     INTEGER DEFAULT 0,
  monthly_points    INTEGER DEFAULT 0,
  current_streak    INTEGER DEFAULT 0,
  longest_streak    INTEGER DEFAULT 0,
  last_activity     TIMESTAMP DEFAULT NOW(),
  badge             VARCHAR DEFAULT 'Bronze',
  level             INTEGER DEFAULT 1,
  next_level_points INTEGER DEFAULT 100,
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_type    VARCHAR NOT NULL,
  badge_name    VARCHAR NOT NULL,
  description   TEXT,
  icon_url      VARCHAR,
  unlocked_at   TIMESTAMP DEFAULT NOW(),
  rarity        VARCHAR DEFAULT 'common',
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_type  VARCHAR NOT NULL,
  achievement_name  VARCHAR NOT NULL,
  description       TEXT,
  progress          INTEGER DEFAULT 0,
  target_progress   INTEGER NOT NULL,
  is_completed      BOOLEAN DEFAULT FALSE,
  completed_at      TIMESTAMP,
  reward_amount     DECIMAL(10,2) DEFAULT 0,
  reward_currency   VARCHAR DEFAULT 'MTAA',
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leaderboards (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leaderboard_type    VARCHAR NOT NULL,
  rank                INTEGER,
  score               DECIMAL(18,2) NOT NULL,
  period              VARCHAR DEFAULT 'all_time',
  period_start_date   TIMESTAMP,
  period_end_date     TIMESTAMP,
  previous_rank       INTEGER,
  movement_indicator  INTEGER,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leaderboard_rankings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR NOT NULL,
  ranking_type  VARCHAR NOT NULL,
  date          TEXT NOT NULL,
  rank          INTEGER NOT NULL,
  score         NUMERIC(20,8) NOT NULL DEFAULT 0,
  previous_rank INTEGER DEFAULT 0,
  rank_change   INTEGER DEFAULT 0,
  metric_value  NUMERIC(20,8) DEFAULT 0,
  tier          VARCHAR DEFAULT 'bronze',
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_follows (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id       VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id      VARCHAR REFERENCES users(id) ON DELETE CASCADE,
  following_dao_id  UUID REFERENCES daos(id) ON DELETE CASCADE,
  follow_type       VARCHAR DEFAULT 'user',
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_feed (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dao_id                UUID REFERENCES daos(id) ON DELETE CASCADE,
  activity_type         VARCHAR NOT NULL,
  actor_id              VARCHAR REFERENCES users(id),
  related_entity_type   VARCHAR,
  related_entity_id     VARCHAR,
  description           TEXT,
  metadata              JSONB DEFAULT '{}',
  visibility            VARCHAR DEFAULT 'public',
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR NOT NULL REFERENCES users(id),
  dao_id        UUID REFERENCES daos(id),
  type          VARCHAR NOT NULL,
  activity_type VARCHAR,
  description   TEXT,
  metadata      JSONB,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_identities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           VARCHAR NOT NULL REFERENCES users(id),
  provider          VARCHAR(50) NOT NULL,
  provider_user_id  VARCHAR NOT NULL,
  profile           JSONB DEFAULT '{}',
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  CONSTRAINT user_identities_provider_user_idx UNIQUE (provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS user_contexts (
  user_id             VARCHAR NOT NULL REFERENCES users(id),
  dao_id              UUID NOT NULL REFERENCES daos(id),
  role                VARCHAR NOT NULL,
  wallet_address      VARCHAR,
  contribution_score  DECIMAL(10,2) DEFAULT 0,
  last_interaction    TIMESTAMP DEFAULT NOW(),
  context             JSONB NOT NULL,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, dao_id)
);

CREATE INDEX IF NOT EXISTS user_contexts_dao_id_idx            ON user_contexts(dao_id);
CREATE INDEX IF NOT EXISTS user_contexts_last_interaction_idx  ON user_contexts(last_interaction);

CREATE TABLE IF NOT EXISTS content_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id       VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type      VARCHAR NOT NULL,
  content_id        UUID NOT NULL,
  reason            VARCHAR NOT NULL,
  description       TEXT,
  severity          VARCHAR DEFAULT 'medium',
  status            VARCHAR DEFAULT 'pending',
  moderator_id      VARCHAR REFERENCES users(id),
  moderator_action  VARCHAR,
  moderator_notes   TEXT,
  resolved_at       TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_moderation_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action        VARCHAR NOT NULL,
  reason        TEXT NOT NULL,
  severity      VARCHAR DEFAULT 'medium',
  duration      INTEGER,
  expires_at    TIMESTAMP,
  moderator_id  VARCHAR NOT NULL REFERENCES users(id),
  notes         TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  revoked_at    TIMESTAMP,
  revoked_by    VARCHAR REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_kyc (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 VARCHAR NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name               VARCHAR,
  date_of_birth           VARCHAR,
  national_id             VARCHAR,
  national_id_type        VARCHAR,
  country                 VARCHAR,
  address                 TEXT,
  city                    VARCHAR,
  postal_code             VARCHAR,
  verification_status     VARCHAR DEFAULT 'pending',
  document_hash           VARCHAR,
  risk_level              VARCHAR DEFAULT 'low',
  aml_screening_status    VARCHAR,
  verified_at             TIMESTAMP,
  verified_by             VARCHAR REFERENCES users(id),
  rejection_reason        TEXT,
  metadata                JSONB DEFAULT '{}',
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW()
);
