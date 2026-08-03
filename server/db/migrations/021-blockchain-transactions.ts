/**
 * Database Migration: Add Blockchain Transactions Support
 * Adds blockchain transaction tracking columns to payment_sagas
 * and creates blockchain_transactions table for on-chain transaction recording.
 */

import { pool } from '../../db';

export async function migrateBlockchainTransactions() {
  try {
    console.log('🔄 Running blockchain transactions migration...');

    // Add columns to payment_sagas for wallet and vault tracking
    await pool.query(`
      ALTER TABLE payment_sagas ADD COLUMN IF NOT EXISTS wallet_from TEXT;
    `);
    await pool.query(`
      ALTER TABLE payment_sagas ADD COLUMN IF NOT EXISTS wallet_to TEXT;
    `);
    await pool.query(`
      ALTER TABLE payment_sagas ADD COLUMN IF NOT EXISTS vault_id TEXT;
    `);
    await pool.query(`
      ALTER TABLE payment_sagas ADD COLUMN IF NOT EXISTS metadata JSONB;
    `);
    console.log('✅ Added columns to payment_sagas table');

    // Create blockchain_transactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blockchain_transactions (
        id SERIAL PRIMARY KEY,
        saga_id UUID REFERENCES payment_sagas(id),
        tx_hash TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        chain_id TEXT,
        amount NUMERIC,
        currency TEXT,
        block_number INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ Created blockchain_transactions table');

    // Create index for efficient saga lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_blockchain_saga ON blockchain_transactions(saga_id);
    `);
    console.log('✅ Created index on blockchain_transactions(saga_id)');

    console.log('✅ Blockchain transactions migration completed');
  } catch (error) {
    console.error('❌ Blockchain transactions migration failed:', error);
    throw error;
  }
}

export async function rollbackBlockchainTransactions() {
  try {
    console.log('🔄 Rolling back blockchain transactions...');

    await pool.query(`
      DROP TABLE IF EXISTS blockchain_transactions CASCADE;
    `);
    await pool.query(`
      ALTER TABLE payment_sagas DROP COLUMN IF EXISTS wallet_from;
    `);
    await pool.query(`
      ALTER TABLE payment_sagas DROP COLUMN IF EXISTS wallet_to;
    `);
    await pool.query(`
      ALTER TABLE payment_sagas DROP COLUMN IF EXISTS vault_id;
    `);
    await pool.query(`
      ALTER TABLE payment_sagas DROP COLUMN IF EXISTS metadata;
    `);

    console.log('✅ Blockchain transactions rollback completed');
  } catch (error) {
    console.error('❌ Blockchain transactions rollback failed:', error);
    throw error;
  }
}
