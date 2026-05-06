-- ════════════════════════════════════════════════════════════════════════════════
-- Migration: Add Vault Ownership Model and Treasury Linking
-- Phase 4B: Replace mock vault endpoints with real config/DB calls
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. Add new columns to vaults table for ownership model and treasury linking
ALTER TABLE vaults 
  ADD COLUMN IF NOT EXISTS owner_type VARCHAR(50), -- 'user' | 'dao'
  ADD COLUMN IF NOT EXISTS owner_id UUID, -- userId or daoId depending on owner_type
  ADD COLUMN IF NOT EXISTS treasury_id UUID REFERENCES daos(id), -- link to DAO treasury
  ADD COLUMN IF NOT EXISTS vault_config JSONB; -- type-specific settings (lockDuration, etc)

-- 2. Create index for efficient ownership queries
CREATE INDEX IF NOT EXISTS idx_vaults_owner_type_id ON vaults(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_vaults_treasury_id ON vaults(treasury_id);

-- ════════════════════════════════════════════════════════════════════════════════
-- BACKFILL: Migrate existing vault records to new ownership model
-- ════════════════════════════════════════════════════════════════════════════════

-- 3. Set owner_type and owner_id for personal (user) vaults
-- Personal vaults have userId populated but daoId is NULL
UPDATE vaults 
  SET 
    owner_type = 'user',
    owner_id = CAST(user_id AS UUID)
  WHERE 
    user_id IS NOT NULL 
    AND dao_id IS NULL 
    AND owner_type IS NULL;

-- 4. Set owner_type and owner_id for DAO vaults
-- DAO vaults have daoId populated but userId is NULL (or is the creator)
UPDATE vaults 
  SET 
    owner_type = 'dao',
    owner_id = dao_id
  WHERE 
    dao_id IS NOT NULL 
    AND owner_type IS NULL;

-- 5. Link DAO vaults to their treasury (treasury_id = daoId for now)
UPDATE vaults 
  SET treasury_id = dao_id 
  WHERE 
    owner_type = 'dao' 
    AND treasury_id IS NULL;

-- ════════════════════════════════════════════════════════════════════════════════
-- BACKFILL: Classify existing vaults to new 7-type system
-- Old types: regular, savings, locked_savings, yield, dao_treasury
-- New types: savings, investment, strategy, investment-pool, escrow, deployment, custom
-- ════════════════════════════════════════════════════════════════════════════════

-- 6. Map old vault types to new types
-- UPDATE vaults 
--   SET vault_type = 'savings' 
--   WHERE vault_type IN ('savings', 'locked_savings') AND vault_type NOT IN ('savings', 'investment', 'strategy', 'investment-pool', 'escrow', 'deployment', 'custom');

-- UPDATE vaults 
--   SET vault_type = 'investment' 
--   WHERE vault_type = 'yield' AND vault_type NOT IN ('savings', 'investment', 'strategy', 'investment-pool', 'escrow', 'deployment', 'custom');

-- UPDATE vaults 
--   SET vault_type = 'escrow' 
--   WHERE vault_type = 'dao_treasury' AND vault_type NOT IN ('savings', 'investment', 'strategy', 'investment-pool', 'escrow', 'deployment', 'custom');

-- UPDATE vaults 
--   SET vault_type = 'custom' 
--   WHERE vault_type = 'regular' AND vault_type NOT IN ('savings', 'investment', 'strategy', 'investment-pool', 'escrow', 'deployment', 'custom');

-- 7. Initialize vault_config for savings vaults with configurable lock duration
-- Default: 30 days, Max: 365 days, configurable per instance
-- UPDATE vaults 
--   SET vault_config = jsonb_build_object(
--     'lockDurationMs', COALESCE(lock_duration * 1000, 30 * 24 * 60 * 60 * 1000),
--     'minLockDurationMs', 1 * 24 * 60 * 60 * 1000,
--     'maxLockDurationMs', 365 * 24 * 60 * 60 * 1000
--   )
--   WHERE vault_type = 'savings' AND vault_config IS NULL;

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (run after migration)
-- ════════════════════════════════════════════════════════════════════════════════

-- Count vaults by ownership type
-- SELECT owner_type, COUNT(*) as count FROM vaults WHERE owner_type IS NOT NULL GROUP BY owner_type;

-- List personal vaults
-- SELECT id, name, owner_type, owner_id, vault_type FROM vaults WHERE owner_type = 'user' LIMIT 10;

-- List DAO vaults linked to treasury
-- SELECT id, name, owner_type, owner_id, treasury_id, vault_type FROM vaults WHERE owner_type = 'dao' LIMIT 10;

-- Show vault_config for savings vaults
-- SELECT id, name, vault_type, vault_config FROM vaults WHERE vault_type = 'savings' AND vault_config IS NOT NULL LIMIT 5;
