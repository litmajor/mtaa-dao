/**
 * Database Migration: Add Payment Recovery Workflows
 * Creates recovery_workflows and manual_intervention_requests tables
 * for payment retry/recovery workflows and manual intervention tracking.
 */

import { pool } from '../../db';

export async function migrateRecoveryWorkflows() {
  try {
    console.log('🔄 Running payment recovery workflows migration...');

    // Create recovery_workflows table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recovery_workflows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        original_error TEXT,
        original_amount NUMERIC(20,6),
        current_amount NUMERIC(20,6),
        original_provider TEXT,
        current_provider TEXT,
        operation TEXT,
        currency TEXT,
        method TEXT,
        original_metadata JSONB DEFAULT '{}'::jsonb,
        state TEXT,
        strategy TEXT,
        attempt_count INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        last_attempt TIMESTAMPTZ,
        last_error TEXT,
        completed_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        cancel_reason TEXT,
        recovery_data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log('✅ Created recovery_workflows table');

    // Create manual_intervention_requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS manual_intervention_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID NOT NULL,
        user_id TEXT NOT NULL,
        transaction_id TEXT NOT NULL,
        reason TEXT,
        priority TEXT DEFAULT 'high',
        status TEXT DEFAULT 'pending',
        approved_by TEXT,
        approval_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT fk_workflow FOREIGN KEY (workflow_id) REFERENCES recovery_workflows(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ Created manual_intervention_requests table');

    // Ensure new columns exist on recovery_workflows (for older schemas)
    await pool.query(`
      ALTER TABLE recovery_workflows ADD COLUMN IF NOT EXISTS currency TEXT;
    `);
    await pool.query(`
      ALTER TABLE recovery_workflows ADD COLUMN IF NOT EXISTS method TEXT;
    `);
    await pool.query(`
      ALTER TABLE recovery_workflows ADD COLUMN IF NOT EXISTS original_metadata JSONB DEFAULT '{}'::jsonb;
    `);
    console.log('✅ Ensured recovery_workflows has all required columns');

    console.log('✅ Payment recovery workflows migration completed');
  } catch (error) {
    console.error('❌ Payment recovery workflows migration failed:', error);
    throw error;
  }
}

export async function rollbackRecoveryWorkflows() {
  try {
    console.log('🔄 Rolling back payment recovery workflows...');

    await pool.query(`
      DROP TABLE IF EXISTS manual_intervention_requests CASCADE;
    `);
    await pool.query(`
      DROP TABLE IF EXISTS recovery_workflows CASCADE;
    `);

    console.log('✅ Payment recovery workflows rollback completed');
  } catch (error) {
    console.error('❌ Payment recovery workflows rollback failed:', error);
    throw error;
  }
}
