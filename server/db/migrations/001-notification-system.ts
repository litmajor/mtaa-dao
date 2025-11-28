/**
 * Database Migration: Add notification system tables
 * Run this migration to set up notification preferences and audit logging
 */

import { db } from '../db';

export async function migrateNotificationTables() {
  try {
    console.log('🔄 Running notification table migrations...');

    // Create notification preferences table
    await db.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL UNIQUE,
        email_enabled BOOLEAN DEFAULT true,
        sms_enabled BOOLEAN DEFAULT false,
        email_escrow_created BOOLEAN DEFAULT true,
        email_escrow_accepted BOOLEAN DEFAULT true,
        email_milestone_pending BOOLEAN DEFAULT true,
        email_milestone_approved BOOLEAN DEFAULT true,
        email_dispute BOOLEAN DEFAULT true,
        sms_escrow_created BOOLEAN DEFAULT false,
        sms_escrow_accepted BOOLEAN DEFAULT false,
        sms_milestone_pending BOOLEAN DEFAULT false,
        sms_milestone_approved BOOLEAN DEFAULT true,
        sms_dispute BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ Created notification_preferences table');

    // Create notifications log table (audit trail)
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications_log (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        type VARCHAR(50) NOT NULL,
        channel VARCHAR(20) NOT NULL,
        target VARCHAR(255) NOT NULL,
        escrow_id UUID,
        status VARCHAR(20) DEFAULT 'sent',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (escrow_id) REFERENCES escrow_accounts(id) ON DELETE SET NULL
      );
    `);
    console.log('✅ Created notifications_log table');

    // Create escrow events table (detailed event tracking)
    await db.query(`
      CREATE TABLE IF NOT EXISTS escrow_events (
        id SERIAL PRIMARY KEY,
        escrow_id UUID NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        triggered_by UUID NOT NULL,
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (escrow_id) REFERENCES escrow_accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (triggered_by) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    console.log('✅ Created escrow_events table');

    // Create indices for better query performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_prefs_user 
      ON notification_preferences(user_id);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_log_user 
      ON notifications_log(user_id);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_log_escrow 
      ON notifications_log(escrow_id);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_escrow_events_escrow 
      ON escrow_events(escrow_id);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_escrow_events_created 
      ON escrow_events(created_at);
    `);

    console.log('✅ Created database indices');
    console.log('✅ All notification tables created successfully');

    return true;
  } catch (error) {
    console.error('❌ Error running migrations:', error);
    throw error;
  }
}

export async function rollbackNotificationTables() {
  try {
    console.log('🔄 Rolling back notification tables...');

    await db.query('DROP TABLE IF EXISTS escrow_events CASCADE;');
    await db.query('DROP TABLE IF EXISTS notifications_log CASCADE;');
    await db.query('DROP TABLE IF EXISTS notification_preferences CASCADE;');

    console.log('✅ Rollback completed');
    return true;
  } catch (error) {
    console.error('❌ Error rolling back:', error);
    throw error;
  }
}
