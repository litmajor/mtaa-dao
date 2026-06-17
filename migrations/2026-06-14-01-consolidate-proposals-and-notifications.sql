-- Migration: consolidate proposals proposer columns and merge notification preferences
-- 1) Ensure proposerId is populated from proposer/userId where needed
-- 2) Drop duplicate proposer/userId/proposer columns after verification
-- 3) Copy data from notification_preferences into user_notification_preferences (superset)
-- NOTE: Run on a maintenance window. This migration is designed to be idempotent where possible.

BEGIN;

-- 1) Fill proposer_id from existing columns where NULL
UPDATE proposals
SET proposer_id = COALESCE(proposer_id, user_id, proposer)
WHERE proposer_id IS NULL AND (proposer IS NOT NULL OR user_id IS NOT NULL);

-- 2) Add a unique temporary constraint to detect mismatches (do not fail silently)
-- This helps surface rows where columns disagree
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM proposals WHERE (proposer IS NOT NULL AND proposer_id IS NOT NULL AND proposer <> proposer_id) OR (user_id IS NOT NULL AND proposer_id IS NOT NULL AND user_id <> proposer_id) LIMIT 1) THEN
    RAISE NOTICE 'Proposal rows with conflicting proposer values exist. Review before dropping columns.';
  END IF;
END$$;

-- 3) Drop legacy columns after manual review if safe
-- ALTER TABLE proposals DROP COLUMN IF EXISTS proposer;
-- ALTER TABLE proposals DROP COLUMN IF EXISTS user_id;

-- 4) Merge notification_preferences into user_notification_preferences
-- Create any missing columns in user_notification_preferences
ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS daoUpdates boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS taskUpdates boolean DEFAULT true;

-- Copy rows from notification_preferences to user_notification_preferences, but do not overwrite existing richer rows
INSERT INTO user_notification_preferences (user_id, email_notifications, push_notifications, in_app_notifications, sms_notifications, proposal_updates, treasury_updates, membership_updates, voting_reminders, dao_announcements, weekly_digest, daily_digest, unsubscribe_all, created_at, updated_at)
SELECT np.user_id, np.email_notifications, np.push_notifications, true, false, np.proposal_updates, false, false, false, false, false, false, false, np.created_at, np.updated_at
FROM notification_preferences np
LEFT JOIN user_notification_preferences unp ON unp.user_id = np.user_id
WHERE unp.user_id IS NULL;

-- Optionally: drop the old table (manual step)
-- DROP TABLE IF EXISTS notification_preferences;

COMMIT;
