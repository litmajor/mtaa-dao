-- Migration: add PIN lockout tracking to wallet security settings
-- Adds support for failed PIN attempt counting and lockout timestamps.
-- Existing legacy PIN records that were stored without a salt will fail verification until the user resets their PIN.

BEGIN;

ALTER TABLE IF EXISTS wallet_security_settings
  ADD COLUMN IF NOT EXISTS failed_pin_attempts integer NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS wallet_security_settings
  ADD COLUMN IF NOT EXISTS pin_locked_until timestamptz;

COMMIT;
