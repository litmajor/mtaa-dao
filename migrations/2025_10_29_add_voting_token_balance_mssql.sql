-- Migration: Add or rename voting_token_balance column in users table (MSSQL compatible)

-- 1. Create new column (if it does not exist)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'voting_token_balance')
BEGIN
    ALTER TABLE users ADD voting_token_balance decimal(10,2) DEFAULT 0;
END

-- 2. Optionally, rename from referralCode (if you want to repurpose that column)
-- EXEC sp_rename 'users.referralCode', 'voting_token_balance', 'COLUMN';

-- 3. Optionally, rename from votingTokenBalance (if you want to preserve data)
-- EXEC sp_rename 'users.votingTokenBalance', 'voting_token_balance', 'COLUMN';

-- 4. Optionally, rename from mtaaTokenBalance (if you want to preserve data)
-- EXEC sp_rename 'users.mtaaTokenBalance', 'voting_token_balance', 'COLUMN';

-- Uncomment only ONE of the rename statements above if you want to rename instead of create.
-- If you only want to create a new column, leave only the first statement active.
