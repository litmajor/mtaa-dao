/**
 * MIGRATION: Red Team Audit Fixes - Schema Updates
 * Date: 2026-06-18
 * Purpose: Add tables for nonce allocation, sybil defense, and orphan detection
 * 
 * Run with: npm run migrate
 */

import { sql } from 'drizzle-orm';

export const up = async (db: any) => {
  // ================================================
  // TABLE 1: Nonce Allocations (Finding #1 - Nonce Collision Fix)
  // ================================================

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS nonce_allocations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      address VARCHAR(255) NOT NULL,
      allocation_id VARCHAR(255) NOT NULL UNIQUE,
      batch_size INTEGER NOT NULL,
      start_nonce INTEGER NOT NULL,
      end_nonce INTEGER NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      -- Status: 'active', 'completed', 'failed', 'corrupted', 'orphaned'
      
      failure_reason TEXT,
      allocated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMP,
      
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Indexes for efficient queries
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_nonce_address_status
    ON nonce_allocations(address, status);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_nonce_start_nonce
    ON nonce_allocations(address, start_nonce, end_nonce);
  `);

  // ================================================
  // TABLE 2: Referral Signup Context (Finding #5 - Sybil Defense)
  // ================================================

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS referral_signup_context (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      referral_id UUID NOT NULL,
      referred_user_id VARCHAR(255) NOT NULL,
      
      -- IP & Device Information
      signup_ip_address VARCHAR(45),           -- IPv4 or IPv6
      signup_country VARCHAR(2),               -- ISO 3166-1 alpha-2
      signup_device_fingerprint VARCHAR(255),
      signup_user_agent TEXT,
      
      -- Verification Status
      phone_verified BOOLEAN DEFAULT FALSE,
      phone_verified_at TIMESTAMP,
      email_verified BOOLEAN DEFAULT FALSE,
      email_verified_at TIMESTAMP,
      
      -- Activity Tracking
      first_transaction_at TIMESTAMP,
      first_transaction_amount DECIMAL(18, 8),
      
      -- Fraud Analysis
      anomaly_flags JSONB DEFAULT '[]'::jsonb,
      suspicion_score INTEGER DEFAULT 0,
      
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      
      CONSTRAINT fk_referral_signup_context_referral_id
        FOREIGN KEY (referral_id)
        REFERENCES referrals(id)
        ON DELETE CASCADE
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_referral_signup_context_user_id
    ON referral_signup_context(referred_user_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_referral_signup_context_ip
    ON referral_signup_context(signup_ip_address);
  `);

  // ================================================
  // TABLE 3: Orphan Detection Log (Finding #2 - RPC Cascade)
  // ================================================

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS orphan_detection_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payout_id UUID NOT NULL,
      transaction_hash VARCHAR(255) NOT NULL,
      
      -- Detection
      detection_type VARCHAR(50) NOT NULL,
      -- Types: 'phantom_tx', 'stuck_pending', 'reorg_detected', 'recovered'
      
      detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
      recovered_at TIMESTAMP,
      
      -- Context
      block_number INTEGER,
      original_allocated_nonce INTEGER,
      last_rpc_error TEXT,
      
      -- Resolution
      resolved BOOLEAN DEFAULT FALSE,
      resolution_action VARCHAR(50),
      resolution_notes TEXT,
      
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_orphan_detection_payout_id
    ON orphan_detection_log(payout_id);
  `);

  // ================================================
  // TABLE 4: Referrer Anomaly History (Finding #5 - Monitoring)
  // ================================================

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS referrer_anomaly_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      referrer_id VARCHAR(255) NOT NULL,
      
      -- Assessment
      risk_score INTEGER NOT NULL,
      risk_level VARCHAR(20) NOT NULL,
      -- Levels: 'low', 'medium', 'high', 'critical'
      
      flags JSONB DEFAULT '[]'::jsonb,
      recommended_action VARCHAR(50) NOT NULL,
      
      -- Context
      referral_count_at_assessment INTEGER,
      active_referral_count INTEGER,
      
      -- Resolution
      action_taken VARCHAR(50),
      action_timestamp TIMESTAMP,
      notes TEXT,
      
      assessed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_referrer_anomaly_referrer_id
    ON referrer_anomaly_history(referrer_id, assessed_at DESC);
  `);

  // ================================================
  // TABLE MODIFICATIONS: Add columns to referral_payouts
  // ================================================

  // Check if allocation_id column exists
  const allocationIdExists = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'referral_payouts'
        AND column_name = 'allocation_id'
    );
  `);

  if (!allocationIdExists.rows[0].exists) {
    await db.execute(sql`
      ALTER TABLE referral_payouts
      ADD COLUMN allocation_id VARCHAR(255),
      ADD COLUMN nonce_verified BOOLEAN DEFAULT FALSE;
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_referral_payouts_allocation_id
      ON referral_payouts(allocation_id);
    `);
  }

  // ================================================
  // TABLE MODIFICATIONS: Add columns to referrals
  // ================================================

  const isActiveVerifiedExists = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'referrals'
        AND column_name = 'is_active_verified'
    );
  `);

  if (!isActiveVerifiedExists.rows[0].exists) {
    await db.execute(sql`
      ALTER TABLE referrals
      ADD COLUMN is_active_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN verification_timestamp TIMESTAMP,
      ADD COLUMN verification_metadata JSONB;
    `);
  }

  // ================================================
  // MATERIALIZED VIEWS: Audit Reports
  // ================================================

  // View for nonce allocation audit
  await db.execute(sql`
    CREATE OR REPLACE VIEW v_nonce_allocation_audit AS
    SELECT
      address,
      COUNT(*) as total_allocations,
      COUNT(*) FILTER (WHERE status = 'active') as active_allocations,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_allocations,
      COUNT(*) FILTER (WHERE status = 'failed') as failed_allocations,
      COUNT(*) FILTER (WHERE status = 'corrupted') as corrupted_allocations,
      MAX(end_nonce) as max_nonce_used,
      MIN(start_nonce) as min_nonce_used,
      MAX(allocated_at) as last_allocation_at
    FROM nonce_allocations
    GROUP BY address;
  `);

  // View for referrer risk summary
  await db.execute(sql`
    CREATE OR REPLACE VIEW v_referrer_risk_summary AS
    SELECT
      rr.referrer_id,
      COUNT(r.id) as total_referrals,
      COUNT(r.id) FILTER (WHERE r.is_active = TRUE) as active_referrals,
      COUNT(DISTINCT rsc.signup_ip_address) as unique_ips,
      COUNT(DISTINCT SUBSTRING(u.email FROM '@(.*)')) as unique_email_domains,
      MAX(rah.risk_score) as latest_risk_score,
      MAX(rah.risk_level) as latest_risk_level,
      MAX(rah.assessed_at) as last_assessment_at
    FROM referral_rewards rr
    LEFT JOIN referrals r ON rr."userId" = r.referrer_id
    LEFT JOIN referral_signup_context rsc ON rsc.referral_id = r.id
    LEFT JOIN users u ON r.referred_user_id = u.id
    LEFT JOIN referrer_anomaly_history rah ON rah.referrer_id = rr."userId"
    WHERE rr."createdAt" > NOW() - INTERVAL '7 days'
    GROUP BY rr.referrer_id;
  `);

  // ================================================
  // MONITORING TRIGGERS
  // ================================================

  // Trigger to automatically log orphan detections
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION log_orphan_detection()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.status = 'orphaned' THEN
        INSERT INTO orphan_detection_log (
          payout_id,
          transaction_hash,
          detection_type,
          original_allocated_nonce,
          last_rpc_error
        ) VALUES (
          NEW.id,
          NEW.transaction_hash,
          'orphaned',
          CAST(NEW.nonce AS INTEGER),
          NEW.last_error
        );
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await db.execute(sql`
    DROP TRIGGER IF EXISTS trigger_log_orphan ON referral_payouts;
    CREATE TRIGGER trigger_log_orphan
    AFTER UPDATE ON referral_payouts
    FOR EACH ROW
    EXECUTE FUNCTION log_orphan_detection();
  `);

  console.log('✅ Red Team Audit schema migrations completed');
};

export const down = async (db: any) => {
  // Rollback order (reverse of creation)

  await db.execute(sql`DROP TRIGGER IF EXISTS trigger_log_orphan ON referral_payouts;`);
  await db.execute(sql`DROP FUNCTION IF EXISTS log_orphan_detection();`);

  await db.execute(sql`DROP VIEW IF EXISTS v_referrer_risk_summary;`);
  await db.execute(sql`DROP VIEW IF EXISTS v_nonce_allocation_audit;`);

  await db.execute(sql`DROP TABLE IF EXISTS referrer_anomaly_history;`);
  await db.execute(sql`DROP TABLE IF EXISTS orphan_detection_log;`);
  await db.execute(sql`DROP TABLE IF EXISTS referral_signup_context;`);
  await db.execute(sql`DROP TABLE IF EXISTS nonce_allocations;`);

  // Remove new columns
  await db.execute(sql`
    ALTER TABLE referral_payouts
    DROP COLUMN IF EXISTS allocation_id,
    DROP COLUMN IF EXISTS nonce_verified;
  `);

  await db.execute(sql`
    ALTER TABLE referrals
    DROP COLUMN IF EXISTS is_active_verified,
    DROP COLUMN IF EXISTS verification_timestamp,
    DROP COLUMN IF EXISTS verification_metadata;
  `);

  console.log('✅ Red Team Audit schema rollback completed');
};
