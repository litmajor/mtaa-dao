-- Make multisig_signers.user_id nullable so signers can be recorded without requiring a placeholder user
ALTER TABLE multisig_signers
  ALTER COLUMN user_id DROP NOT NULL;

-- Ensure there are no unexpected violations
-- (No further action required; FK remains enforced when user_id is set)
