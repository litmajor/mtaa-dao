/**
 * Database Migration: Add domain_events table
 * Creates durable domain event outbox storage with OCC and publish queue indexes.
 */

import { pool } from '../../db';

export async function migrateDomainEventsTable() {
  try {
    console.log('🔄 Running domain_events migration...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS domain_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        aggregate_type TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        payload JSONB NOT NULL,
        correlation_id TEXT NOT NULL,
        causation_id TEXT,
        actor TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        published_at TIMESTAMPTZ,
        publish_attempts INTEGER NOT NULL DEFAULT 0,
        last_publish_attempt TIMESTAMPTZ,
        last_publish_error TEXT
      );
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS domain_events_occ_idx
      ON domain_events (aggregate_type, aggregate_id, version);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_domain_events_unpublished
      ON domain_events (created_at)
      WHERE published_at IS NULL;
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate
      ON domain_events (aggregate_type, aggregate_id, version);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_domain_events_type
      ON domain_events (event_type);
    `);

    console.log('✅ Domain events migration completed');
  } catch (error) {
    console.error('❌ Domain events migration failed:', error);
    throw error;
  }
}

export async function rollbackDomainEventsTable() {
  try {
    console.log('🔄 Rolling back domain_events migration...');

    await pool.query(`
      DROP TABLE IF EXISTS domain_events CASCADE;
    `);

    console.log('✅ Domain events rollback completed');
  } catch (error) {
    console.error('❌ Domain events rollback failed:', error);
    throw error;
  }
}
