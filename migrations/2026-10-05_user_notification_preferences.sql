-- Persist the granular preferences exposed by the legacy user notifications API.
ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS payment_failure_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_failure_in_app boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS retry_updates_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS retry_updates_in_app boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS recovery_hints_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS recovery_hints_in_app boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS system_alerts_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS system_alerts_in_app boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_frequency varchar NOT NULL DEFAULT 'immediate';
