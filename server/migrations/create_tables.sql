--=============================================================================
-- MtaaDAO — COMPLETE DATABASE MIGRATION
-- 226 tables, all duplicates resolved
-- Generated from: schema.ts, accountSchema.ts, securityEnhancedSchema.ts,
--   financialEnhancedSchema.ts, transactionFlowSchema.ts, kycSchema.ts,
--   vestingSchema.ts, escrowSchema.ts, invoiceSchema.ts, onboardingSchema.ts,
--   poolShareSchema.ts, operational/schema.ts
-- messageReactionsSchema.ts merged into schema.ts definition below
-- =============================================================================
s
BEGIN;

-- =============================================================================
-- SECTION 1: CORE USER & AUTH TABLES
-- (users must come first — almost everything references it)
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
  id                          VARCHAR PRIMARY KEY,
  name                        VARCHAR,
  username                    VARCHAR UNIQUE,
  password                    VARCHAR NOT NULL,
  email                       VARCHAR UNIQUE,
  phone                       VARCHAR UNIQUE,
  email_verified              BOOLEAN DEFAULT FALSE,
  phone_verified              BOOLEAN DEFAULT FALSE,
  email_verification_token    VARCHAR,
  phone_verification_token    VARCHAR,
  email_verification_expires_at TIMESTAMP,
  phone_verification_expires_at TIMESTAMP,
  password_reset_token        VARCHAR,
  first_name                  VARCHAR,
  last_name                   VARCHAR,
  profile_image_url           VARCHAR,
  profile_picture             VARCHAR,
  referral_rewards            VARCHAR,
  wallet_address              VARCHAR,
  bio                         TEXT,
  location                    VARCHAR,
  website                     VARCHAR,
  last_login_at               TIMESTAMP,
  reputation_score            DECIMAL(10,2) DEFAULT 0,
  roles                       VARCHAR DEFAULT 'member',
  total_contributions         DECIMAL(10,2) DEFAULT 0,
  current_streak              INTEGER DEFAULT 0,
  referral_code               VARCHAR UNIQUE,
  referred_by                 VARCHAR,
  total_referrals             INTEGER DEFAULT 0,
  dark_mode                   BOOLEAN DEFAULT FALSE,
  joined_at                   TIMESTAMP DEFAULT NOW(),
  created_at                  TIMESTAMP DEFAULT NOW(),
  updated_at                  TIMESTAMP DEFAULT NOW(),
  otp                         VARCHAR(10),
  otp_expires_at              TIMESTAMP,
  is_email_verified           BOOLEAN DEFAULT FALSE,
  is_phone_verified           BOOLEAN DEFAULT FALSE,
  is_banned                   BOOLEAN DEFAULT FALSE,
  ban_reason                  TEXT,
  is_super_user               BOOLEAN DEFAULT FALSE,
  voting_token_balance        DECIMAL(10,2) DEFAULT 0,
  mtaa_token_balance          DECIMAL(10,2) DEFAULT 0,
  voting_power                DECIMAL(10,2) DEFAULT 1.0,
  telegram_id                 VARCHAR,
  telegram_chat_id            VARCHAR,
  telegram_username           VARCHAR,
  preferred_currency          VARCHAR DEFAULT 'USD',
  encrypted_wallet            TEXT,
  wallet_salt                 TEXT,
  wallet_iv                   TEXT,
  wallet_auth_tag             TEXT,
  has_backed_up_mnemonic      BOOLEAN DEFAULT FALSE,
  is_active                   BOOLEAN DEFAULT TRUE,
  enabled_beta_features       TEXT DEFAULT '[]',
  advanced_mode               BOOLEAN DEFAULT FALSE,
  reputation                  INTEGER DEFAULT 0,
  balance                     DECIMAL(20,2) DEFAULT 0,
  active_subprofile           VARCHAR DEFAULT 'okedi',
  -- NOTE: 2FA columns kept for backward compat; migrate to two_factor_auth table then drop
  two_factor_enabled          BOOLEAN DEFAULT FALSE,
  two_factor_method           VARCHAR DEFAULT 'totp',
  two_factor_secret           TEXT,
  two_factor_backup_codes     TEXT,
  two_factor_setup_at         TIMESTAMP,
  two_factor_verified_at      TIMESTAMP,
  two_factor_recovery_email   VARCHAR,
  -- Soft delete
  deleted_at                  TIMESTAMP,
  deleted_by                  VARCHAR,
  delete_reason               TEXT,
  deleted_recovery_deadline   TIMESTAMP
);

-- =============================================================================
-- SECTION 2: SESSIONS & AUTH TOKENS
-- =============================================================================

CREATE TABLE IF NOT EXISTS sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             VARCHAR NOT NULL REFERENCES users(id),
  session_token       VARCHAR UNIQUE NOT NULL,
  expires_at          TIMESTAMP NOT NULL,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW(),
  last_accessed_at    TIMESTAMP DEFAULT NOW(),
  ip_address          VARCHAR,
  user_agent          VARCHAR,
  session_data        JSONB
);

-- CANONICAL refresh_tokens (merged from schema.ts + securityEnhancedSchema.ts)
-- Includes: revoked/rotatedAt/updatedAt (schema.ts) + deviceId/revokedReason/replacedBy (security)
CREATE TABLE IF NOT EXISTS user_devices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             VARCHAR NOT NULL REFERENCES users(id),
  device_name         VARCHAR,
  device_fingerprint  TEXT NOT NULL UNIQUE,
  device_type         VARCHAR,
  browser             VARCHAR,
  os                  VARCHAR,
  trusted             BOOLEAN DEFAULT FALSE,
  last_ip_address     VARCHAR,
  last_location       JSONB,
  last_used_at        TIMESTAMP,
  trusted_at          TIMESTAMP,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash          VARCHAR NOT NULL UNIQUE,
  device_id           UUID REFERENCES user_devices(id),
  ip_address          VARCHAR NOT NULL,
  user_agent          TEXT,
  expires_at          TIMESTAMP NOT NULL,
  revoked             BOOLEAN DEFAULT FALSE,
  revoked_at          TIMESTAMP,
  revoked_reason      VARCHAR,
  rotated_at          TIMESTAMP,
  replaced_by         UUID,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS beta_access (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR NOT NULL REFERENCES users(id),
  feature_name    VARCHAR NOT NULL,
  granted_at      TIMESTAMP DEFAULT NOW(),
  revoked_at      TIMESTAMP,
  granted_by      VARCHAR REFERENCES users(id),
  revoked_by      VARCHAR REFERENCES users(id),
  reason          TEXT,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- SECTION 3: SECURITY ENHANCED TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS login_attempts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier          VARCHAR NOT NULL,
  user_id             VARCHAR REFERENCES users(id),
  ip_address          VARCHAR NOT NULL,
  user_agent          TEXT,
  attempt_result      VARCHAR NOT NULL,
  failure_reason      TEXT,
  location            JSONB,
  device_fingerprint  TEXT,
  created_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR REFERENCES users(id),
  event_type    VARCHAR NOT NULL,
  severity      VARCHAR NOT NULL,
  ip_address    VARCHAR NOT NULL,
  user_agent    TEXT,
  location      JSONB,
  details       JSONB,
  resolved      BOOLEAN DEFAULT FALSE,
  resolved_by   VARCHAR REFERENCES users(id),
  resolved_at   TIMESTAMP,
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR NOT NULL REFERENCES users(id),
  password_hash   VARCHAR NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS two_factor_auth (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR NOT NULL UNIQUE REFERENCES users(id),
  method          VARCHAR NOT NULL,
  enabled         BOOLEAN DEFAULT FALSE,
  secret          TEXT,
  backup_codes    JSONB,
  phone_number    VARCHAR,
  email           VARCHAR,
  last_used_at    TIMESTAMP,
  enabled_at      TIMESTAMP,
  disabled_at     TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_delivery_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               VARCHAR REFERENCES users(id),
  to_email              VARCHAR NOT NULL,
  subject               VARCHAR NOT NULL,
  template              VARCHAR,
  status                VARCHAR NOT NULL,
  provider              VARCHAR,
  provider_message_id   VARCHAR,
  error_message         TEXT,
  metadata              JSONB,
  sent_at               TIMESTAMP,
  delivered_at          TIMESTAMP,
  opened_at             TIMESTAMP,
  clicked_at            TIMESTAMP,
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sms_delivery_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               VARCHAR REFERENCES users(id),
  to_phone              VARCHAR NOT NULL,
  message               TEXT NOT NULL,
  template              VARCHAR,
  status                VARCHAR NOT NULL,
  provider              VARCHAR,
  provider_message_id   VARCHAR,
  cost                  VARCHAR,
  error_message         TEXT,
  metadata              JSONB,
  sent_at               TIMESTAMP,
  delivered_at          TIMESTAMP,
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_connections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             VARCHAR NOT NULL REFERENCES users(id),
  provider            VARCHAR NOT NULL,
  provider_user_id    VARCHAR NOT NULL,
  provider_email      VARCHAR,
  provider_username   VARCHAR,
  access_token        TEXT,
  refresh_token       TEXT,
  token_expires_at    TIMESTAMP,
  scope               TEXT,
  profile_data        JSONB,
  last_synced_at      TIMESTAMP,
  connected_at        TIMESTAMP DEFAULT NOW(),
  disconnected_at     TIMESTAMP,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

-- CANONICAL api_keys (merged from schema.ts + securityEnhancedSchema.ts)
-- Includes: metadata/isActive (schema.ts) + keyPrefix/lastUsedIp/revokedAt/revokedReason (security)
CREATE TABLE IF NOT EXISTS api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR NOT NULL,
  key_hash        VARCHAR NOT NULL UNIQUE,
  key_prefix      VARCHAR NOT NULL,
  permissions     JSONB DEFAULT '[]',
  rate_limit      INTEGER DEFAULT 1000,
  ip_whitelist    JSONB DEFAULT '[]',
  is_active       BOOLEAN DEFAULT TRUE,
  last_used_at    TIMESTAMP,
  last_used_ip    VARCHAR,
  expires_at      TIMESTAMP,
  revoked_at      TIMESTAMP,
  revoked_reason  TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS account_recovery (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR NOT NULL REFERENCES users(id),
  recovery_type   VARCHAR NOT NULL,
  token           VARCHAR NOT NULL UNIQUE,
  method          VARCHAR NOT NULL,
  ip_address      VARCHAR NOT NULL,
  user_agent      TEXT,
  status          VARCHAR NOT NULL DEFAULT 'pending',
  expires_at      TIMESTAMP NOT NULL,
  used_at         TIMESTAMP,
  cancelled_at    TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_audits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID,
  user_id     VARCHAR NOT NULL REFERENCES users(id),
  action      VARCHAR NOT NULL,
  ip_address  VARCHAR NOT NULL,
  user_agent  TEXT,
  location    JSONB,
  device_id   UUID REFERENCES user_devices(id),
  metadata    JSONB,
  created_at  TIMESTAMP DEFAULT NOW()
);
