/**
 * Database Migration: Add event_dead_letters table
 * Creates a dead letter queue table for failed event processing and manual recovery.
 */

import { pool } from '../../db';

export async function migrateEventDeadLettersTable() {
  try {
    console.log('🔄 Running event_dead_letters migration...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_dead_letters (
        id TEXT PRIMARY KEY,
        original_event_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        aggregate_type TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        payload JSONB NOT NULL,
        correlation_id TEXT,
        actor TEXT,
        failure_reason TEXT NOT NULL,
        failure_source TEXT NOT NULL,
        consumer_name TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        quarantined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        resolved_by TEXT,
        resolution_notes TEXT
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_dead_letters_unresolved
      ON event_dead_letters (quarantined_at)
      WHERE resolved_at IS NULL;
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_dead_letters_original_event
      ON event_dead_letters (original_event_id);
    `);

    console.log('✅ Event dead letters migration completed');
  } catch (error) {
    console.error('❌ Event dead letters migration failed:', error);
    throw error;
  }
}

export async function rollbackEventDeadLettersTable() {
  try {
    console.log('🔄 Rolling back event_dead_letters migration...');

    await pool.query(`
      DROP TABLE IF EXISTS event_dead_letters CASCADE;
    `);

    console.log('✅ Event dead letters rollback completed');
  } catch (error) {
    console.error('❌ Event dead letters rollback failed:', error);
    throw error;
  }
}
