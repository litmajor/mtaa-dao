-- Migration: Add address column to vaults table
ALTER TABLE vaults ADD COLUMN address VARCHAR;
