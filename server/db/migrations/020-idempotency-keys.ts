/**
 * Database Migration: Add Idempotency Keys Table
 * Creates idempotency_keys table for cross-service duplicate-request prevention
 * with row-level locking and TTL-based expiration.
 */

import { pool } from '../../db';

export async function migrateIdempotencyKeysTable() {
  try {
    console.log('🔄 Running idempotency keys table migration...');

    // Create idempotency_keys table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
        response JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
      );
    `);
    console.log('✅ Created idempotency_keys table');

    // Create index on expires_at for efficient cleanup of expired keys
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);
    `);
    console.log('✅ Created index on expires_at');

    console.log('✅ Idempotency keys table migration completed');
  } catch (error) {
    console.error('❌ Idempotency keys table migration failed:', error);
    throw error;
  }
}

export async function rollbackIdempotencyKeysTable() {
  try {
    console.log('🔄 Rolling back idempotency keys table...');

    await pool.query(`
      DROP TABLE IF EXISTS idempotency_keys CASCADE;
    `);

    console.log('✅ Idempotency keys table rollback completed');
  } catch (error) {
    console.error('❌ Idempotency keys table rollback failed:', error);
    throw error;
  }
}
