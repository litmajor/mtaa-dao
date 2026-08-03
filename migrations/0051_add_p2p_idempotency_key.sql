-- Migration: Add idempotency key to p2p_transfers table
-- Purpose: Prevent duplicate transfers when client retries on timeout (idempotent requests)
-- FIX #3: Add unique idempotency_key field with constraint

ALTER TABLE p2p_transfers
ADD COLUMN IF NOT EXISTS idempotency_key TEXT NOT NULL;

-- Create unique index on idempotency_key to enforce uniqueness and enable fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_p2p_transfers_idempotency_key
ON p2p_transfers(idempotency_key);

-- Create composite index for faster lookups by sender + idempotency key
CREATE INDEX IF NOT EXISTS idx_p2p_transfers_sender_idempotency
ON p2p_transfers(sender_id, idempotency_key);
