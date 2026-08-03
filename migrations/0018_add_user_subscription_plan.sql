-- Add subscription plan support to users
ALTER TABLE users ADD COLUMN plan VARCHAR(20) DEFAULT 'free';
ALTER TABLE users ADD COLUMN subscription_plan VARCHAR(20) DEFAULT 'free';
ALTER TABLE users ADD COLUMN billing_status VARCHAR(20) DEFAULT 'active';
