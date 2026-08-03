/**
 * Database Migration: Add command_log table
 * Creates audit trail storage for command execution and replay recovery.
 */

import { pool } from '../../db';

export async function migrateCommandLogTable() {
  try {
    console.log('🔄 Running command_log migration...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS command_log (
        command_id TEXT PRIMARY KEY,
        command_type TEXT NOT NULL,
        actor TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        payload JSONB NOT NULL,
        result JSONB,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        error TEXT
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_command_log_actor
      ON command_log (actor);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_command_log_correlation
      ON command_log (correlation_id);
    `);

    console.log('✅ Command log migration completed');
  } catch (error) {
    console.error('❌ Command log migration failed:', error);
    throw error;
  }
}

export async function rollbackCommandLogTable() {
  try {
    console.log('🔄 Rolling back command_log migration...');

    await pool.query(`
      DROP TABLE IF EXISTS command_log CASCADE;
    `);

    console.log('✅ Command log rollback completed');
  } catch (error) {
    console.error('❌ Command log rollback failed:', error);
    throw error;
  }
}
