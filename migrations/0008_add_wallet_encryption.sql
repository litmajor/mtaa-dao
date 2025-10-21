
-- Add encrypted wallet storage fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_wallet TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_salt TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_iv TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_auth_tag TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_backed_up_mnemonic BOOLEAN DEFAULT FALSE;
