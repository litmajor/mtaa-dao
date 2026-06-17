cat > /home/claude/migration_part2.sql << 'SQLEOF'
-- =============================================================================
-- SECTION 4: DAOs & MEMBERSHIPS
-- =============================================================================

CREATE TABLE IF NOT EXISTS daos (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                          VARCHAR NOT NULL,
  description                   TEXT,
  access                        VARCHAR DEFAULT 'public',
  invite_only                   BOOLEAN DEFAULT FALSE,
  invite_code                   VARCHAR,
  creator_id                    VARCHAR NOT NULL REFERENCES users(id),
  is_public                     BOOLEAN DEFAULT TRUE,
  member_count                  INTEGER DEFAULT 1,
  treasury_balance              DECIMAL(10,2) DEFAULT 0,
  plan                          VARCHAR DEFAULT 'free',
  dao_type                      VARCHAR DEFAULT 'free',
  plan_expires_at               TIMESTAMP,
  billing_status                VARCHAR DEFAULT 'active',
  next_billing_date             TIMESTAMP,
  extension_count               INTEGER DEFAULT 0,
  original_duration             INTEGER,
  current_extension_duration    INTEGER,
  created_at                    TIMESTAMP DEFAULT NOW(),
  updated_at                    TIMESTAMP DEFAULT NOW(),
  image_url                     VARCHAR,
  banner_url                    VARCHAR,
  is_archived                   BOOLEAN DEFAULT FALSE,
  archived_at                   TIMESTAMP,
  archived_by                   VARCHAR REFERENCES users(id),
  is_featured                   BOOLEAN DEFAULT FALSE,
  feature_order                 INTEGER DEFAULT 0,
  quorum_percentage             INTEGER DEFAULT 20,
  voting_period                 INTEGER DEFAULT 72,
  execution_delay               INTEGER DEFAULT 24,
  token_holdings                BOOLEAN DEFAULT FALSE,
  status                        VARCHAR DEFAULT 'active',
  subscription_plan             VARCHAR DEFAULT 'free',
  founder_id                    VARCHAR,
  max_delegation_percentage     INTEGER DEFAULT 10,
  treasury_multisig_enabled     BOOLEAN DEFAULT TRUE,
  treasury_required_signatures  INTEGER DEFAULT 3,
  treasury_signers              JSONB DEFAULT '[]',
  treasury_withdrawal_threshold DECIMAL(18,2) DEFAULT 1000.00,
  treasury_daily_limit          DECIMAL(18,2) DEFAULT 10000.00,
  treasury_monthly_budget       DECIMAL(18,2),
  withdrawal_mode               VARCHAR DEFAULT 'multisig',
  duration_model                VARCHAR DEFAULT 'time',
  rotation_frequency            VARCHAR,
  rotation_selection_method     VARCHAR DEFAULT 'sequential',
  next_rotation_date            TIMESTAMP,
  current_rotation_cycle        INTEGER DEFAULT 0,
  total_rotation_cycles         INTEGER,
  estimated_cycle_duration      INTEGER,
  min_elders                    INTEGER DEFAULT 2,
  max_elders                    INTEGER DEFAULT 5,
  primary_cause                 VARCHAR,
  cause_tags                    JSONB DEFAULT '[]',
  -- Soft delete
  deleted_at                    TIMESTAMP,
  deleted_by                    VARCHAR,
  delete_reason                 TEXT,
  deleted_recovery_deadline     TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dao_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id          UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  setting_key     VARCHAR(100) NOT NULL,
  setting_value   JSONB,
  setting_type    VARCHAR(50),
  category        VARCHAR(50),
  description     TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dao_memberships (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   VARCHAR NOT NULL REFERENCES users(id),
  dao_id                    UUID NOT NULL REFERENCES daos(id),
  role                      VARCHAR DEFAULT 'member',
  status                    VARCHAR DEFAULT 'approved',
  joined_at                 TIMESTAMP DEFAULT NOW(),
  created_at                TIMESTAMP DEFAULT NOW(),
  updated_at                TIMESTAMP DEFAULT NOW(),
  is_banned                 BOOLEAN DEFAULT FALSE,
  ban_reason                TEXT,
  is_elder                  BOOLEAN DEFAULT FALSE,
  is_admin                  BOOLEAN DEFAULT FALSE,
  last_active               TIMESTAMP DEFAULT NOW(),
  can_initiate_withdrawal   BOOLEAN DEFAULT FALSE,
  can_approve_withdrawal    BOOLEAN DEFAULT FALSE,
  is_rotation_recipient     BOOLEAN DEFAULT FALSE,
  rotation_recipient_date   TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dao_invitations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id                  UUID NOT NULL REFERENCES daos(id),
  invited_by              VARCHAR REFERENCES users(id),
  referrer_id             VARCHAR REFERENCES users(id),
  invited_email           VARCHAR,
  invited_phone           VARCHAR,
  recipient_user_id       VARCHAR REFERENCES users(id),
  role                    VARCHAR DEFAULT 'member',
  invite_link             VARCHAR UNIQUE NOT NULL,
  status                  VARCHAR DEFAULT 'pending',
  expires_at              TIMESTAMP,
  invitation_sent_at      TIMESTAMP,
  accepted_at             TIMESTAMP,
  rejected_at             TIMESTAMP,
  rejection_reason        TEXT,
  user_existed_at_invite  BOOLEAN DEFAULT FALSE,
  is_peer_invite          BOOLEAN DEFAULT FALSE,
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dao_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id      UUID NOT NULL REFERENCES daos(id),
  inviter_id  VARCHAR NOT NULL REFERENCES users(id),
  token       VARCHAR(64) NOT NULL UNIQUE,
  expires_at  TIMESTAMP NOT NULL,
  used        BOOLEAN DEFAULT FALSE,
  accepted_by VARCHAR REFERENCES users(id),
  accepted_at TIMESTAMP,
  revoked     BOOLEAN DEFAULT FALSE,
  revoked_at  TIMESTAMP,
  revoked_by  VARCHAR REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dao_creation_tracker (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dao_id                UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  created_at            TIMESTAMP DEFAULT NOW(),
  verification_method   VARCHAR NOT NULL,
  verification_data     JSONB DEFAULT '{}',
  is_verified           BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS dao_social_verifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id            UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  verifier_user_id  VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verified_at       TIMESTAMP DEFAULT NOW(),
  verification_type VARCHAR DEFAULT 'member_invite',
  metadata          JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS dao_identity_nfts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id              UUID NOT NULL UNIQUE REFERENCES daos(id) ON DELETE CASCADE,
  nft_token_id        VARCHAR,
  nft_contract_address VARCHAR,
  minted_at           TIMESTAMP DEFAULT NOW(),
  mint_cost_mtaa      NUMERIC DEFAULT 10,
  is_verified         BOOLEAN DEFAULT FALSE,
  metadata_uri        VARCHAR
);

CREATE TABLE IF NOT EXISTS dao_rotation_cycles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id              UUID NOT NULL REFERENCES daos(id),
  cycle_number        INTEGER NOT NULL,
  recipient_user_id   VARCHAR NOT NULL REFERENCES users(id),
  status              VARCHAR DEFAULT 'pending',
  start_date          TIMESTAMP NOT NULL,
  end_date            TIMESTAMP,
  amount_distributed  DECIMAL(18,8) DEFAULT 0,
  transaction_hash    VARCHAR,
  distributed_at      TIMESTAMP,
  notes               TEXT,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dao_of_the_week (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id            UUID NOT NULL UNIQUE REFERENCES daos(id) ON DELETE CASCADE,
  week_start_date   TIMESTAMP NOT NULL,
  week_end_date     TIMESTAMP NOT NULL,
  rank              INTEGER DEFAULT 1,
  reasons           TEXT,
  engagement_score  DECIMAL(10,2),
  member_growth     INTEGER,
  proposal_count    INTEGER,
  transaction_volume DECIMAL(18,2),
  is_current        BOOLEAN DEFAULT FALSE,
  featured_at       TIMESTAMP DEFAULT NOW(),
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dao_engagement_metrics (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id                UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  period                VARCHAR NOT NULL,
  period_date           TIMESTAMP NOT NULL,
  active_members        INTEGER DEFAULT 0,
  new_members           INTEGER DEFAULT 0,
  proposals_created     INTEGER DEFAULT 0,
  proposals_passed      INTEGER DEFAULT 0,
  votes_participation   DECIMAL(5,2) DEFAULT 0,
  transaction_count     INTEGER DEFAULT 0,
  transaction_volume    DECIMAL(18,2) DEFAULT 0,
  treasury_balance      DECIMAL(18,2) DEFAULT 0,
  engagement_score      DECIMAL(10,2) DEFAULT 0,
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dao_content (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id        UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  author_id     VARCHAR NOT NULL REFERENCES users(id),
  content_type  VARCHAR NOT NULL,
  title         VARCHAR NOT NULL,
  slug          VARCHAR UNIQUE,
  content       TEXT NOT NULL,
  excerpt       TEXT,
  cover_image   VARCHAR,
  tags          JSONB DEFAULT '[]',
  status        VARCHAR DEFAULT 'draft',
  view_count    INTEGER DEFAULT 0,
  like_count    INTEGER DEFAULT 0,
  published_at  TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dao_ratings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id            UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  user_id           VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating            INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_title      VARCHAR,
  review_content    TEXT,
  aspects           JSONB DEFAULT '{}',
  is_verified_member BOOLEAN DEFAULT FALSE,
  helpful_count     INTEGER DEFAULT 0,
  status            VARCHAR DEFAULT 'published',
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dao_analytics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id              UUID NOT NULL REFERENCES daos(id),
  date                TEXT NOT NULL,
  total_members       INTEGER NOT NULL DEFAULT 0,
  new_members_today   INTEGER NOT NULL DEFAULT 0,
  active_members      INTEGER NOT NULL DEFAULT 0,
  members_by_tier     JSONB DEFAULT '{}',
  total_proposals     INTEGER NOT NULL DEFAULT 0,
  active_proposals    INTEGER NOT NULL DEFAULT 0,
  total_votes         INTEGER NOT NULL DEFAULT 0,
  average_participation DECIMAL(5,2) DEFAULT 0,
  treasury_balance    NUMERIC(20,8) NOT NULL DEFAULT 0,
  inflows             NUMERIC(20,8) NOT NULL DEFAULT 0,
  outflows            NUMERIC(20,8) NOT NULL DEFAULT 0,
  net_flow            NUMERIC(20,8) NOT NULL DEFAULT 0,
  dao_type            VARCHAR,
  region              VARCHAR,
  cause_category      VARCHAR,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- SECTION 5: PROPOSALS & GOVERNANCE
-- =============================================================================

CREATE TABLE IF NOT EXISTS proposal_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id                UUID REFERENCES daos(id),
  name                  VARCHAR NOT NULL,
  category              VARCHAR NOT NULL,
  description           TEXT NOT NULL,
  title_template        TEXT NOT NULL,
  description_template  TEXT NOT NULL,
  required_fields       JSONB DEFAULT '[]',
  voting_period         INTEGER DEFAULT 72,
  quorum_override       INTEGER,
  is_global             BOOLEAN DEFAULT FALSE,
  created_by            VARCHAR NOT NULL REFERENCES users(id),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proposals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT NOT NULL,
  description         TEXT NOT NULL,
  proposal_type       VARCHAR DEFAULT 'general',
  template_id         UUID REFERENCES proposal_templates(id),
  tags                JSONB DEFAULT '[]',
  image_url           VARCHAR,
  poll_options        JSONB DEFAULT '[]',
  allow_multiple_choices BOOLEAN DEFAULT FALSE,
  proposer            VARCHAR NOT NULL REFERENCES users(id),
  proposer_id         VARCHAR NOT NULL REFERENCES users(id),
  user_id             VARCHAR NOT NULL REFERENCES users(id),
  dao_id              UUID NOT NULL REFERENCES daos(id),
  status              VARCHAR DEFAULT 'active',
  is_draft            BOOLEAN DEFAULT FALSE,
  vote_start_time     TIMESTAMP DEFAULT NOW(),
  vote_end_time       TIMESTAMP NOT NULL,
  quorum_required     INTEGER DEFAULT 100,
  yes_votes           INTEGER DEFAULT 0,
  no_votes            INTEGER DEFAULT 0,
  abstain_votes       INTEGER DEFAULT 0,
  for_votes           INTEGER DEFAULT 0,
  against_votes       INTEGER DEFAULT 0,
  metadata            JSONB,
  total_voting_power  DECIMAL(10,2) DEFAULT 0,
  execution_data      JSONB,
  executed_at         TIMESTAMP,
  executed_by         VARCHAR REFERENCES users(id),
  execution_tx_hash   VARCHAR,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW(),
  is_featured         BOOLEAN DEFAULT FALSE,
  likes_count         INTEGER DEFAULT 0,
  comments_count      INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS votes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id   UUID NOT NULL REFERENCES proposals(id),
  user_id       VARCHAR NOT NULL REFERENCES users(id),
  dao_id        UUID NOT NULL REFERENCES daos(id),
  vote_type     VARCHAR NOT NULL,
  weight        DECIMAL(3,2) DEFAULT 1.0,
  voting_power  DECIMAL(10,2) DEFAULT 1.0,
  is_delegated  BOOLEAN DEFAULT FALSE,
  delegated_by  VARCHAR REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vote_delegations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_id  VARCHAR NOT NULL REFERENCES users(id),
  delegate_id   VARCHAR NOT NULL REFERENCES users(id),
  dao_id        UUID NOT NULL REFERENCES daos(id),
  scope         VARCHAR DEFAULT 'all',
  category      VARCHAR,
  proposal_id   UUID REFERENCES proposals(id),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quorum_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id              UUID NOT NULL REFERENCES daos(id),
  proposal_id         UUID REFERENCES proposals(id),
  active_member_count INTEGER NOT NULL,
  required_quorum     INTEGER NOT NULL,
  achieved_quorum     INTEGER DEFAULT 0,
  quorum_met          BOOLEAN DEFAULT FALSE,
  calculated_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proposal_execution_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     UUID NOT NULL REFERENCES proposals(id),
  dao_id          UUID NOT NULL REFERENCES daos(id),
  scheduled_for   TIMESTAMP NOT NULL,
  execution_type  VARCHAR NOT NULL,
  execution_data  JSONB NOT NULL,
  status          VARCHAR DEFAULT 'pending',
  attempts        INTEGER DEFAULT 0,
  last_attempt    TIMESTAMP,
  error_message   TEXT,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proposal_comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id       UUID NOT NULL REFERENCES proposals(id),
  user_id           VARCHAR NOT NULL REFERENCES users(id),
  dao_id            UUID NOT NULL REFERENCES daos(id),
  content           TEXT NOT NULL,
  parent_comment_id UUID REFERENCES proposal_comments(id),
  is_edited         BOOLEAN DEFAULT FALSE,
  edit_history      JSONB DEFAULT '[]',
  last_edited_at    TIMESTAMP,
  last_edited_by    VARCHAR,
  likes_count       INTEGER DEFAULT 0,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proposal_likes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id),
  user_id     VARCHAR NOT NULL REFERENCES users(id),
  dao_id      UUID NOT NULL REFERENCES daos(id),
  created_at  TIMESTAMP DEFAULT NOW(),
  CONSTRAINT proposal_likes_unique UNIQUE (proposal_id, user_id)
);

CREATE TABLE IF NOT EXISTS comment_likes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  UUID NOT NULL REFERENCES proposal_comments(id),
  user_id     VARCHAR NOT NULL REFERENCES users(id),
  dao_id      UUID NOT NULL REFERENCES daos(id),
  created_at  TIMESTAMP DEFAULT NOW(),
  CONSTRAINT comment_likes_unique UNIQUE (comment_id, user_id)
);
