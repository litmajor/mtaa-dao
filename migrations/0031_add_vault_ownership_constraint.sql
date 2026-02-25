-- PRIORITY 2 Issue #3: Add Vault Ownership Constraint
-- Migration: Add CHECK constraint to ensure vaults belong to either user OR DAO, but not both/neither
-- Date: January 14, 2026

-- ============================================================================
-- CONSTRAINT: Vault Ownership Validation
-- ============================================================================
-- Ensures every vault belongs to exactly one owner:
--   - Personal vaults: user_id is NOT NULL, dao_id is NULL
--   - DAO vaults: dao_id is NOT NULL, user_id is NULL
--   - Invalid states prevented: both NULL, both NOT NULL
--
-- This maintains clean separation between personal and DAO vaults
-- ============================================================================

ALTER TABLE vaults
ADD CONSTRAINT vault_owner_check 
CHECK (
  (user_id IS NOT NULL AND dao_id IS NULL) 
  OR 
  (user_id IS NULL AND dao_id IS NOT NULL)
);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these queries to verify the constraint was applied successfully:
--
-- 1. Check constraint exists:
--    SELECT constraint_name FROM information_schema.table_constraints
--    WHERE table_name = 'vaults' AND constraint_name = 'vault_owner_check';
--
-- 2. View all constraints on vaults table:
--    SELECT constraint_name, constraint_type 
--    FROM information_schema.table_constraints
--    WHERE table_name = 'vaults';
--
-- 3. Count vaults by type:
--    SELECT 
--      CASE 
--        WHEN user_id IS NOT NULL THEN 'Personal Vault'
--        WHEN dao_id IS NOT NULL THEN 'DAO Vault'
--      END as vault_type,
--      COUNT(*) as count
--    FROM vaults
--    GROUP BY vault_type;
--
-- 4. Check for any orphaned vaults (should return 0):
--    SELECT COUNT(*) FROM vaults 
--    WHERE (user_id IS NULL AND dao_id IS NULL)
--    OR (user_id IS NOT NULL AND dao_id IS NOT NULL);
--
-- ============================================================================
-- ROLLBACK COMMAND (if needed)
-- ============================================================================
-- ALTER TABLE vaults DROP CONSTRAINT vault_owner_check;
--
-- ============================================================================
