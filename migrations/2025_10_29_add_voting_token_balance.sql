-- Migration: Add or rename voting_token_balance column in users table

-- 1. Create new column (if it does not exist)
ALTER TABLE users ADD COLUMN IF NOT EXISTS voting_token_balance numeric(10,2) DEFAULT 0;

-- 2. Optionally, rename from referralCode (if you want to repurpose that column)
-- ALTER TABLE users RENAME COLUMN referralCode TO voting_token_balance;

-- 3. Optionally, rename from votingTokenBalance (if you want to preserve data)
-- ALTER TABLE users RENAME COLUMN votingTokenBalance TO voting_token_balance;

-- 4. Optionally, rename from mtaaTokenBalance (if you want to preserve data)
-- ALTER TABLE users RENAME COLUMN mtaaTokenBalance TO voting_token_balance;

-- Uncomment only ONE of the rename statements above if you want to rename instead of create.
-- If you only want to create a new column, leave only the first statement active.
