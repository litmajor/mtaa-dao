
-- Add Telegram fields to users table
ALTER TABLE users ADD COLUMN telegram_id VARCHAR;
ALTER TABLE users ADD COLUMN telegram_chat_id VARCHAR;
ALTER TABLE users ADD COLUMN telegram_username VARCHAR;

-- Add Telegram notifications to preferences
ALTER TABLE notification_preferences ADD COLUMN telegram_notifications BOOLEAN DEFAULT false;
