/**
 * Database Migration: Add processed_events table
 * Adds consumer-level event processing state storage.
 */

import { pool } from '../../db';

export async function migrateProcessedEventsTable() {
  try {
    console.log('🔄 Running processed_events migration...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS processed_events (
        event_id TEXT NOT NULL,
        consumer_name TEXT NOT NULL,
        status TEXT NOT NULL,
        stream_message_id TEXT,
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processing_started_at TIMESTAMPTZ,
        processed_at TIMESTAMPTZ,
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      );
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS processed_events_pk
      ON processed_events (event_id, consumer_name);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_processed_events_stalled
      ON processed_events (status, processing_started_at);
    `);

    console.log('✅ Processed events migration completed');
  } catch (error) {
    console.error('❌ Processed events migration failed:', error);
    throw error;
  }
}

export async function rollbackProcessedEventsTable() {
  try {
    console.log('🔄 Rolling back processed_events migration...');

    await pool.query(`
      DROP TABLE IF EXISTS processed_events CASCADE;
    `);

    console.log('✅ Processed events rollback completed');
  } catch (error) {
    console.error('❌ Processed events rollback failed:', error);
    throw error;
  }
}
