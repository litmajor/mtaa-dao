
-- Migration to add governance security features
-- Ensures all existing DAOs have proper delegation caps and execution delays

-- Update existing DAOs without maxDelegationPercentage
UPDATE daos 
SET max_delegation_percentage = 10 
WHERE max_delegation_percentage IS NULL;

-- Update existing DAOs without executionDelay or with delay < 24 hours
UPDATE daos 
SET execution_delay = 48 
WHERE execution_delay IS NULL OR execution_delay < 24;

-- Add index for delegation cap checks
CREATE INDEX IF NOT EXISTS idx_vote_delegations_delegate_active 
ON vote_delegations(dao_id, delegate_id, is_active) 
WHERE is_active = true;

-- Add comments for documentation
COMMENT ON COLUMN daos.max_delegation_percentage IS 'Maximum percentage of voting power a single delegate can hold (default 10% to prevent centralization)';
COMMENT ON COLUMN daos.execution_delay IS 'Hours to wait before executing approved proposals (minimum 24h, default 48h for security)';
