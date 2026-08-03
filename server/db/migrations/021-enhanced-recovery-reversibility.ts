/**
 * Database Migration: Add Circuit Breaker, Enhanced Intervention, and Reversibility Tables
 * Creates/enhances tables for:
 * - Circuit breaker state persistence (multi-node safe)
 * - Manual intervention resolution tracking
 * - Reversible actions and approvals (for grace-period and reversible operations)
 */

import { pool } from '../../db';

export async function migrateEnhancedRecoveryAndReversibility() {
  try {
    console.log('🔄 Running enhanced recovery and reversibility migration...');

    // Create circuit_breaker_states table for multi-node safe state management
    await pool.query(`
      CREATE TABLE IF NOT EXISTS circuit_breaker_states (
        provider TEXT PRIMARY KEY,
        state TEXT NOT NULL CHECK (state IN ('closed','open','half_open')),
        failure_count INTEGER NOT NULL DEFAULT 0,
        success_count INTEGER NOT NULL DEFAULT 0,
        last_state_change TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reset_time TIMESTAMPTZ,
        failure_threshold INTEGER NOT NULL DEFAULT 5,
        success_threshold INTEGER NOT NULL DEFAULT 2,
        timeout_ms INTEGER NOT NULL DEFAULT 60000,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ Created circuit_breaker_states table');

    // Enhance manual_intervention_requests with resolution tracking
    await pool.query(`
      ALTER TABLE manual_intervention_requests 
        ADD COLUMN IF NOT EXISTS resolution_type TEXT,
        ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
        ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS resolved_by TEXT;
    `);
    console.log('✅ Enhanced manual_intervention_requests with resolution tracking');

    // Ensure recovery_workflows has all required columns
    await pool.query(`
      ALTER TABLE recovery_workflows 
        ADD COLUMN IF NOT EXISTS currency TEXT,
        ADD COLUMN IF NOT EXISTS method TEXT,
        ADD COLUMN IF NOT EXISTS original_metadata JSONB,
        ADD COLUMN IF NOT EXISTS requires_user_consent BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS user_consent_granted BOOLEAN DEFAULT FALSE;
    `);
    console.log('✅ Enhanced recovery_workflows with consent and metadata tracking');

    // Create reversible_actions table for grace-period and reversible operations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reversible_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'INITIATED',
        user_id TEXT NOT NULL,
        severity TEXT,
        initiator JSONB,
        affected_entity JSONB,
        action_payload JSONB,
        before_state JSONB,
        after_state JSONB,
        confirmation_requirement JSONB,
        grace_period_config JSONB,
        grace_period_ends_at TIMESTAMPTZ,
        reversibility_scope JSONB,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ Created reversible_actions table');

    // Create action_reversals table for tracking reversals
    await pool.query(`
      CREATE TABLE IF NOT EXISTS action_reversals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action_id UUID REFERENCES reversible_actions(id) ON DELETE CASCADE,
        reversed_by JSONB,
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ Created action_reversals table');

    // Create action_approvals table for multi-sig and approval tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS action_approvals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action_id UUID REFERENCES reversible_actions(id) ON DELETE CASCADE,
        approver_id TEXT NOT NULL,
        approver_role TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ Created action_approvals table');

    // Create indexes for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_reversible_actions_user ON reversible_actions(user_id);
      CREATE INDEX IF NOT EXISTS idx_reversible_actions_status ON reversible_actions(status);
      CREATE INDEX IF NOT EXISTS idx_reversible_actions_type ON reversible_actions(action_type);
      CREATE INDEX IF NOT EXISTS idx_reversible_actions_grace_period ON reversible_actions(grace_period_ends_at);
      CREATE INDEX IF NOT EXISTS idx_action_reversals_action ON action_reversals(action_id);
      CREATE INDEX IF NOT EXISTS idx_action_approvals_action ON action_approvals(action_id);
    `);
    console.log('✅ Created performance indexes');

    console.log('✅ Enhanced recovery and reversibility migration completed');
  } catch (error) {
    console.error('❌ Enhanced recovery and reversibility migration failed:', error);
    throw error;
  }
}

export async function rollbackEnhancedRecoveryAndReversibility() {
  try {
    console.log('🔄 Rolling back enhanced recovery and reversibility...');

    await pool.query(`
      DROP TABLE IF EXISTS action_approvals CASCADE;
      DROP TABLE IF EXISTS action_reversals CASCADE;
      DROP TABLE IF EXISTS reversible_actions CASCADE;
      DROP TABLE IF EXISTS circuit_breaker_states CASCADE;
    `);

    console.log('✅ Enhanced recovery and reversibility rollback completed');
  } catch (error) {
    console.error('❌ Enhanced recovery and reversibility rollback failed:', error);
    throw error;
  }
}
