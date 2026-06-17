-- ==================================================
-- SECTION 6: MESSAGING & NOTIFICATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS dao_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id              UUID NOT NULL REFERENCES daos(id),
  user_id             VARCHAR NOT NULL REFERENCES users(id),
  content             TEXT NOT NULL,
  message_type        VARCHAR DEFAULT 'text',
  reply_to_message_id UUID REFERENCES dao_messages(id),
  is_pinned           BOOLEAN DEFAULT FALSE,
  pinned_at           TIMESTAMP,
  pinned_by           VARCHAR REFERENCES users(id),
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

-- CANONICAL message_reactions (merged from schema.ts + messageReactionsSchema.ts)
-- Added: daoId (from messageReactionsSchema), unique constraint (from messageReactionsSchema)
-- Kept:  UUID PK, proper FKs with cascade (from schema.ts)
CREATE TABLE IF NOT EXISTS message_reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES dao_messages(id) ON DELETE CASCADE,
  user_id     VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dao_id      UUID REFERENCES daos(id),
  emoji       VARCHAR(10) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_reaction_idx UNIQUE (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS message_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES dao_messages(id) ON DELETE CASCADE,
  file_name   VARCHAR(255) NOT NULL,
  file_url    VARCHAR(500) NOT NULL,
  file_type   VARCHAR(50),
  file_size   INTEGER,
  uploaded_by VARCHAR REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR NOT NULL REFERENCES users(id),
  type        VARCHAR NOT NULL,
  title       VARCHAR NOT NULL,
  message     TEXT NOT NULL,
  read        BOOLEAN DEFAULT FALSE,
  priority    VARCHAR DEFAULT 'medium',
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR NOT NULL REFERENCES users(id),
  type        VARCHAR NOT NULL,
  title       VARCHAR NOT NULL,
  message     TEXT NOT NULL,
  read        BOOLEAN DEFAULT FALSE,
  metadata    JSONB,
  created_at  TIMESTAMP DEFAULT NOW(),
  read_at     TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               VARCHAR NOT NULL UNIQUE REFERENCES users(id),
  email_notifications   BOOLEAN DEFAULT TRUE,
  push_notifications    BOOLEAN DEFAULT TRUE,
  dao_updates           BOOLEAN DEFAULT TRUE,
  proposal_updates      BOOLEAN DEFAULT TRUE,
  task_updates          BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               VARCHAR NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email_notifications   BOOLEAN DEFAULT TRUE,
  push_notifications    BOOLEAN DEFAULT TRUE,
  in_app_notifications  BOOLEAN DEFAULT TRUE,
  sms_notifications     BOOLEAN DEFAULT FALSE,
  proposal_updates      BOOLEAN DEFAULT TRUE,
  treasury_updates      BOOLEAN DEFAULT TRUE,
  membership_updates    BOOLEAN DEFAULT TRUE,
  voting_reminders      BOOLEAN DEFAULT TRUE,
  dao_announcements     BOOLEAN DEFAULT TRUE,
  weekly_digest         BOOLEAN DEFAULT FALSE,
  daily_digest          BOOLEAN DEFAULT FALSE,
  unsubscribe_all       BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_metadata (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id     UUID,
  user_id             VARCHAR NOT NULL REFERENCES users(id),
  dao_id              UUID REFERENCES daos(id),
  notification_type   VARCHAR NOT NULL,
  source_entity_type  VARCHAR,
  source_entity_id    VARCHAR,
  action_url          VARCHAR(500),
  priority            VARCHAR DEFAULT 'normal',
  is_read             BOOLEAN DEFAULT FALSE,
  delivery_channels   JSONB DEFAULT '[]',
  delivery_status     JSONB DEFAULT '{}',
  custom_data         JSONB DEFAULT '{}',
  expires_at          TIMESTAMP,
  is_actioned         BOOLEAN DEFAULT FALSE,
  actioned_at         TIMESTAMP,
  action_taken        TEXT,
  read_at             TIMESTAMP,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_announcements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             VARCHAR(255) NOT NULL,
  message           TEXT NOT NULL,
  type              VARCHAR(50) DEFAULT 'info',
  priority          INTEGER DEFAULT 0,
  is_active         BOOLEAN DEFAULT TRUE,
  target_audience   VARCHAR(50) DEFAULT 'all',
  target_dao_id     UUID REFERENCES daos(id) ON DELETE CASCADE,
  link_url          VARCHAR(500),
  link_text         VARCHAR(100),
  starts_at         TIMESTAMP,
  expires_at        TIMESTAMP,
  created_by        VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_announcement_views (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES platform_announcements(id) ON DELETE CASCADE,
  viewed_at       TIMESTAMP DEFAULT NOW(),
  dismissed       BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS session_notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id        UUID NOT NULL REFERENCES wallet_sessions(id) ON DELETE CASCADE,
  notification_type VARCHAR NOT NULL,
  title             VARCHAR NOT NULL,
  message           TEXT,
  device_name       VARCHAR,
  location          VARCHAR,
  ip_address        VARCHAR,
  is_read           BOOLEAN DEFAULT FALSE,
  action_required   BOOLEAN DEFAULT FALSE,
  action_token      VARCHAR,
  action_expires_at TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW(),
  read_at           TIMESTAMP
);

-- =============================================================================
-- SECTION 7: WALLET & TRANSACTION TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS wallets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dao_id      UUID REFERENCES daos(id) ON DELETE CASCADE,
  currency    VARCHAR NOT NULL,
  address     VARCHAR NOT NULL UNIQUE,
  wallet_type VARCHAR DEFAULT 'personal',
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_balances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id         UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  balance           DECIMAL(18,8) DEFAULT 0,
  currency          VARCHAR NOT NULL,
  locked_balance    DECIMAL(18,8) DEFAULT 0,
  available_balance DECIMAL(18,8) DEFAULT 0,
  last_updated      TIMESTAMP DEFAULT NOW(),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_private_keys (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id               UUID NOT NULL UNIQUE REFERENCES wallets(id) ON DELETE CASCADE,
  encrypted_private_key   TEXT NOT NULL,
  encryption_iv           TEXT NOT NULL,
  encryption_salt         TEXT NOT NULL,
  auth_tag                TEXT NOT NULL,
  key_derivation_function VARCHAR DEFAULT 'pbkdf2',
  encryption_algorithm    VARCHAR DEFAULT 'aes-256-gcm',
  is_backed_up            BOOLEAN DEFAULT FALSE,
  backup_verified_at      TIMESTAMP,
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_seed_phrases (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id             UUID NOT NULL UNIQUE REFERENCES wallets(id) ON DELETE CASCADE,
  encrypted_seed_phrase TEXT NOT NULL,
  word_count            INTEGER DEFAULT 12,
  encryption_iv         TEXT NOT NULL,
  encryption_salt       TEXT NOT NULL,
  auth_tag              TEXT NOT NULL,
  derivation_path       VARCHAR DEFAULT 'm/44''/60''/0''/0',
  is_backed_up          BOOLEAN DEFAULT FALSE,
  backup_method         VARCHAR,
  backup_verified_at    TIMESTAMP,
  backup_location       VARCHAR,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_public_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id       UUID NOT NULL UNIQUE REFERENCES wallets(id) ON DELETE CASCADE,
  public_key      TEXT NOT NULL,
  public_key_format VARCHAR DEFAULT 'uncompressed',
  derivation_path VARCHAR DEFAULT 'm/44''/60''/0''/0',
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_security_settings (
  id                                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id                         UUID NOT NULL UNIQUE REFERENCES wallets(id) ON DELETE CASCADE,
  requires_pin                      BOOLEAN DEFAULT TRUE,
  requires_biometric                BOOLEAN DEFAULT FALSE,
  encrypted_pin                     TEXT,
  two_factor_enabled                BOOLEAN DEFAULT FALSE,
  two_factor_method                 VARCHAR,
  withdrawal_limit                  DECIMAL(18,8),
  whitelisted_addresses             JSONB DEFAULT '[]',
  requires_approval_above_threshold BOOLEAN DEFAULT TRUE,
  approval_threshold                DECIMAL(18,8),
  last_access_at                    TIMESTAMP,
  last_modified_at                  TIMESTAMP DEFAULT NOW(),
  created_at                        TIMESTAMP DEFAULT NOW(),
  updated_at                        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id             UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id               VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token         VARCHAR UNIQUE NOT NULL,
  is_active             BOOLEAN DEFAULT TRUE,
  connected_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  disconnected_at       TIMESTAMP,
  last_accessed_at      TIMESTAMP DEFAULT NOW(),
  ip_address            VARCHAR,
  user_agent            VARCHAR,
  device_id             VARCHAR,
  device_name           VARCHAR,
  expires_at            TIMESTAMP NOT NULL,
  last_activity_at      TIMESTAMP DEFAULT NOW(),
  auto_extend_enabled   BOOLEAN DEFAULT TRUE,
  warning_shown_at      TIMESTAMP,
  biometric_enabled     BOOLEAN DEFAULT FALSE,
  location              VARCHAR,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_access_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id       UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id         VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action          VARCHAR NOT NULL,
  ip_address      VARCHAR,
  user_agent      VARCHAR,
  device_id       VARCHAR,
  status          VARCHAR DEFAULT 'success',
  failure_reason  TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pin_reset_requests (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id                   UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  reset_token                 VARCHAR UNIQUE NOT NULL,
  reset_method                VARCHAR NOT NULL,
  verification_sent           TIMESTAMP DEFAULT NOW(),
  verification_code           VARCHAR,
  verification_code_expires_at TIMESTAMP,
  is_verified                 BOOLEAN DEFAULT FALSE,
  verified_at                 TIMESTAMP,
  new_pin_hash                VARCHAR,
  is_completed                BOOLEAN DEFAULT FALSE,
  completed_at                TIMESTAMP,
  expires_at                  TIMESTAMP NOT NULL,
  created_at                  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS biometric_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id           VARCHAR NOT NULL,
  device_name         VARCHAR NOT NULL,
  biometric_type      VARCHAR NOT NULL,
  biometric_public_key TEXT,
  is_enabled          BOOLEAN DEFAULT TRUE,
  last_used_at        TIMESTAMP,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id                UUID,
  from_user_id            VARCHAR REFERENCES users(id),
  to_user_id              VARCHAR REFERENCES users(id),
  wallet_address          VARCHAR NOT NULL,
  dao_id                  UUID REFERENCES daos(id),
  amount                  DECIMAL(10,2) NOT NULL,
  currency                VARCHAR DEFAULT 'cUSD',
  type                    VARCHAR NOT NULL,
  status                  VARCHAR DEFAULT 'completed',
  transaction_hash        VARCHAR,
  description             TEXT,
  disbursement_id         VARCHAR,
  stable_inflow_event_id  UUID,
  stable_units_microusd   NUMERIC(38,0),
  chain_id                INTEGER,
  token_address           VARCHAR(255),
  metadata                JSONB,
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id      VARCHAR NOT NULL REFERENCES users(id),
  to_user_id        VARCHAR REFERENCES users(id),
  to_address        VARCHAR,
  amount            DECIMAL(18,8) NOT NULL,
  currency          VARCHAR NOT NULL,
  description       TEXT,
  qr_code           TEXT,
  celo_uri          TEXT,
  status            VARCHAR DEFAULT 'pending',
  expires_at        TIMESTAMP,
  paid_at           TIMESTAMP,
  transaction_hash  VARCHAR,
  metadata          JSONB,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference   TEXT NOT NULL UNIQUE,
  type        TEXT NOT NULL,
  amount      TEXT NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'KES',
  provider    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  metadata    JSON,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_receipts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id      UUID REFERENCES wallet_transactions(id),
  payment_request_id  UUID REFERENCES payment_requests(id),
  receipt_number      VARCHAR NOT NULL UNIQUE,
  pdf_url             TEXT,
  email_sent          BOOLEAN DEFAULT FALSE,
  email_sent_at       TIMESTAMP,
  metadata            JSONB,
  created_at          TIMESTAMP DEFAULT NOW()
);

