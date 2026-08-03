/**
 * Database Migration: Add Payment System Supporting Tables
 * Creates circuit_breaker_states, reversible_actions, and related tables
 * for multi-node circuit breaker safety, action reversibility, and manual intervention tracking.
 */

import { pool } from '../../db';

export async function migratePaymentSystemTables() {
  try {
    console.log('🔄 Running payment system supporting tables migration...');
    console.log('[MIGRATION] DATABASE_URL present:', !!process.env.DATABASE_URL);

    // Create circuit_breaker_states for multi-node safe circuit breaker persistence
    console.log('[MIGRATION] Beginning circuit_breaker_states CREATE TABLE IF NOT EXISTS');
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

    // Create provider_fallbacks for payment recovery fallback ordering
    await pool.query(`
      CREATE TABLE IF NOT EXISTS provider_fallbacks (
        operation TEXT NOT NULL,
        provider TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 0,
        is_available BOOLEAN NOT NULL DEFAULT TRUE,
        failure_rate NUMERIC(10,6) NOT NULL DEFAULT 0,
        average_latency INTEGER NOT NULL DEFAULT 0,
        last_used TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (operation, provider)
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_provider_fallbacks_operation_priority ON provider_fallbacks(operation, priority);
    `);
    console.log('✅ Created provider_fallbacks table');

    // Extend manual_intervention_requests with resolution tracking
    await pool.query(`
      ALTER TABLE manual_intervention_requests 
        ADD COLUMN IF NOT EXISTS resolution_type TEXT,
        ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
        ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS resolved_by TEXT;
    `);
    console.log('✅ Extended manual_intervention_requests table');

    // Extend recovery_workflows with consent and metadata columns
    await pool.query(`
      ALTER TABLE recovery_workflows 
        ADD COLUMN IF NOT EXISTS requires_user_consent BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS user_consent_granted BOOLEAN DEFAULT FALSE;
    `);
    console.log('✅ Extended recovery_workflows table');

    // Create reversible_actions for payment action reversibility
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

    // Create action_reversals tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS action_reversals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action_id UUID REFERENCES reversible_actions(id),
        reversed_by JSONB,
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ Created action_reversals table');

    // Create action_approvals tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS action_approvals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action_id UUID REFERENCES reversible_actions(id),
        approver_id TEXT NOT NULL,
        approver_role TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ Created action_approvals table');

    // Extend payment_sagas with blockchain and vault tracking
    await pool.query(`
      ALTER TABLE payment_sagas 
        ADD COLUMN IF NOT EXISTS wallet_from TEXT,
        ADD COLUMN IF NOT EXISTS wallet_to TEXT,
        ADD COLUMN IF NOT EXISTS vault_id TEXT,
        ADD COLUMN IF NOT EXISTS metadata JSONB;
    `);
    console.log('✅ Extended payment_sagas table');

    // Create blockchain_transactions for on-chain transaction tracking
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

    // Create index for efficient blockchain transaction lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_blockchain_saga ON blockchain_transactions(saga_id);
    `);
    console.log('✅ Created index on blockchain_transactions');

    console.log('✅ Payment system supporting tables migration completed');
  } catch (error) {
    console.error('❌ Payment system tables migration failed:', error);
    throw error;
  }
}

export async function rollbackPaymentSystemTables() {
  try {
    console.log('🔄 Rolling back payment system supporting tables...');

    await pool.query(`
      DROP TABLE IF EXISTS action_approvals CASCADE;
    `);
    await pool.query(`
      DROP TABLE IF EXISTS action_reversals CASCADE;
    `);
    await pool.query(`
      DROP TABLE IF EXISTS reversible_actions CASCADE;
    `);
    await pool.query(`
      DROP TABLE IF EXISTS blockchain_transactions CASCADE;
    `);
    await pool.query(`
      DROP TABLE IF EXISTS provider_fallbacks CASCADE;
    `);
    await pool.query(`
      DROP TABLE IF EXISTS circuit_breaker_states CASCADE;
    `);

    // Note: We don't drop columns from existing tables in rollback for safety
    // Manual reversal of ALTER TABLE ADD COLUMN can be done separately if needed

    console.log('✅ Payment system supporting tables rollback completed');
  } catch (error) {
    console.error('❌ Payment system tables rollback failed:', error);
    throw error;
  }
}
