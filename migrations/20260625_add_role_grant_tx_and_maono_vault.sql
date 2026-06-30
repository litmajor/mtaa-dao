-- Migration: Add role-grant tx columns to vaults and maono_vault_address to daos
-- Run: psql -d your_db -f migrations/20260625_add_role_grant_tx_and_maono_vault.sql

BEGIN;

-- Add manager/rebalancer grant tx hashes to vaults
ALTER TABLE IF EXISTS vaults
  ADD COLUMN IF NOT EXISTS manager_role_grant_tx varchar;

ALTER TABLE IF EXISTS vaults
  ADD COLUMN IF NOT EXISTS rebalancer_role_grant_tx varchar;

-- Add MaonoVault address to daos (nullable)
ALTER TABLE IF EXISTS daos
  ADD COLUMN IF NOT EXISTS maono_vault_address varchar;

COMMIT;

-- Rollback (manual):
-- ALTER TABLE vaults DROP COLUMN IF EXISTS manager_role_grant_tx;
-- ALTER TABLE vaults DROP COLUMN IF EXISTS rebalancer_role_grant_tx;
-- ALTER TABLE daos DROP COLUMN IF EXISTS maono_vault_address;
