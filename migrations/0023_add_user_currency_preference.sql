
-- Migration: Add preferred currency to users table
-- Description: Allow users to select their default currency (cUSD, cKES, cEUR, etc.)

ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(10) DEFAULT 'cUSD';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_preferred_currency ON users(preferred_currency);

-- Add comment
COMMENT ON COLUMN users.preferred_currency IS 'User preferred display currency: cUSD, cKES, cEUR, etc.';
