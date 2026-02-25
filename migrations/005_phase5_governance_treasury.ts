/**
 * Phase 5: Governance & Treasury Management Migration
 * Note: Most governance tables (daos, proposals, votes, voteDelegations, treasuryMultisigTransactions, 
 * treasuryBudgetAllocations, treasuryAuditLog, budgetPlans) already exist from earlier phases.
 * This migration extends existing schemas with Phase 5 enhancements:
 * - Adds new reporting and analytics tables
 * - Adds governance event tracking
 * - Adds member activity scoring
 * - Adds governance parameter management
 * - Extends existing tables with new columns for advanced features
 */

export async function up() {
  return `
    -- Add Phase 5 columns to existing daos table (if not already present)
    ALTER TABLE daos
    ADD COLUMN IF NOT EXISTS governance_health_score NUMERIC(5,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_health_score_update TIMESTAMP,
    ADD COLUMN IF NOT EXISTS governance_token_address VARCHAR(255),
    ADD COLUMN IF NOT EXISTS proposal_execution_enabled BOOLEAN DEFAULT TRUE;

    -- Add Phase 5 columns to existing proposals table (if not already present)
    ALTER TABLE proposals
    ADD COLUMN IF NOT EXISTS proposal_ipfs_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS execution_transaction_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS voting_participation_rate NUMERIC(5,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS final_approval_rate NUMERIC(5,2) DEFAULT 0;

    -- Add Phase 5 columns to existing votes table (if not already present)
    ALTER TABLE votes
    ADD COLUMN IF NOT EXISTS vote_reasoning TEXT,
    ADD COLUMN IF NOT EXISTS voting_power_percent NUMERIC(5,2) DEFAULT 0;

    -- Add Phase 5 columns to existing budget_plans table (if not already present)
    ALTER TABLE budget_plans
    ADD COLUMN IF NOT EXISTS quarterly_budget NUMERIC(20,8),
    ADD COLUMN IF NOT EXISTS annual_budget NUMERIC(20,8),
    ADD COLUMN IF NOT EXISTS spent_this_quarter NUMERIC(20,8) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS spent_this_year NUMERIC(20,8) DEFAULT 0;

    -- NEW: Governance Events & Audit Trail
    CREATE TABLE IF NOT EXISTS governance_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dao_id UUID NOT NULL,
      event_type VARCHAR(100) NOT NULL,
      event_description TEXT NOT NULL,
      triggered_by VARCHAR(50),
      related_proposal_id UUID,
      related_member_id UUID,
      event_metadata JSONB,
      transaction_hash VARCHAR(255),
      event_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (dao_id) REFERENCES daos(id) ON DELETE CASCADE
    );

    -- NEW: Member Activity Log for Reputation Scoring
    CREATE TABLE IF NOT EXISTS member_activity_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dao_id UUID NOT NULL,
      user_id VARCHAR(50) NOT NULL,
      activity_type VARCHAR(100) NOT NULL,
      activity_description TEXT,
      activity_points NUMERIC(10,2) NOT NULL DEFAULT 0,
      related_proposal_id UUID,
      activity_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (dao_id) REFERENCES daos(id) ON DELETE CASCADE
    );

    -- NEW: Governance Reports & Analytics
    CREATE TABLE IF NOT EXISTS governance_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dao_id UUID NOT NULL,
      report_period VARCHAR(50) NOT NULL,
      period_start_date TIMESTAMP NOT NULL,
      period_end_date TIMESTAMP NOT NULL,
      total_proposals INTEGER NOT NULL DEFAULT 0,
      approved_proposals INTEGER NOT NULL DEFAULT 0,
      rejected_proposals INTEGER NOT NULL DEFAULT 0,
      average_participation_rate NUMERIC(5,2) NOT NULL,
      average_approval_rate NUMERIC(5,2) NOT NULL,
      active_members INTEGER NOT NULL DEFAULT 0,
      new_members INTEGER NOT NULL DEFAULT 0,
      total_votes_cast INTEGER NOT NULL DEFAULT 0,
      treasury_inflows_usd NUMERIC(20,8) NOT NULL DEFAULT 0,
      treasury_outflows_usd NUMERIC(20,8) NOT NULL DEFAULT 0,
      net_treasury_change_usd NUMERIC(20,8) NOT NULL,
      governance_health_score NUMERIC(5,2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (dao_id) REFERENCES daos(id) ON DELETE CASCADE
    );

    -- NEW: Governance Parameters Management
    CREATE TABLE IF NOT EXISTS governance_parameters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dao_id UUID NOT NULL,
      parameter_name VARCHAR(255) NOT NULL,
      parameter_category VARCHAR(50) NOT NULL,
      current_value VARCHAR(255) NOT NULL,
      previous_value VARCHAR(255),
      min_value VARCHAR(255),
      max_value VARCHAR(255),
      unit VARCHAR(50),
      description TEXT,
      last_changed_by VARCHAR(50),
      last_changed_at TIMESTAMP,
      change_proposal_id UUID,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (dao_id) REFERENCES daos(id) ON DELETE CASCADE
    );

    -- NEW: Governance Extensions for Advanced Features
    CREATE TABLE IF NOT EXISTS governance_extensions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dao_id UUID NOT NULL UNIQUE,
      multi_sig_minimum_signers INTEGER DEFAULT 3,
      multi_sig_maximum_signers INTEGER DEFAULT 7,
      token_delegation_enabled BOOLEAN DEFAULT TRUE,
      proposal_execution_delay_hours INTEGER DEFAULT 24,
      emergency_pause_enabled BOOLEAN DEFAULT TRUE,
      emergency_council_members JSONB DEFAULT '[]',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (dao_id) REFERENCES daos(id) ON DELETE CASCADE
    );

    -- Create indexes for Phase 5 performance
    CREATE INDEX IF NOT EXISTS idx_governance_events_dao ON governance_events(dao_id);
    CREATE INDEX IF NOT EXISTS idx_governance_events_type ON governance_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_governance_events_timestamp ON governance_events(event_timestamp);
    
    CREATE INDEX IF NOT EXISTS idx_member_activity_dao ON member_activity_log(dao_id);
    CREATE INDEX IF NOT EXISTS idx_member_activity_user ON member_activity_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_member_activity_type ON member_activity_log(activity_type);
    CREATE INDEX IF NOT EXISTS idx_member_activity_timestamp ON member_activity_log(activity_timestamp);
    
    CREATE INDEX IF NOT EXISTS idx_governance_reports_dao ON governance_reports(dao_id);
    CREATE INDEX IF NOT EXISTS idx_governance_reports_period ON governance_reports(report_period);
    
    CREATE INDEX IF NOT EXISTS idx_governance_parameters_dao ON governance_parameters(dao_id);
    CREATE INDEX IF NOT EXISTS idx_governance_parameters_category ON governance_parameters(parameter_category);
    
    CREATE INDEX IF NOT EXISTS idx_governance_extensions_dao ON governance_extensions(dao_id);
  `;
}

export async function down() {
  return `
    -- Drop Phase 5 new tables
    DROP TABLE IF EXISTS governance_extensions CASCADE;
    DROP TABLE IF EXISTS governance_parameters CASCADE;
    DROP TABLE IF EXISTS governance_reports CASCADE;
    DROP TABLE IF EXISTS member_activity_log CASCADE;
    DROP TABLE IF EXISTS governance_events CASCADE;

    -- Drop Phase 5 added columns (would need to recreate tables, so commenting out)
    -- ALTER TABLE daos DROP COLUMN IF EXISTS governance_health_score;
    -- ALTER TABLE daos DROP COLUMN IF EXISTS last_health_score_update;
    -- ALTER TABLE daos DROP COLUMN IF EXISTS governance_token_address;
    -- ALTER TABLE daos DROP COLUMN IF EXISTS proposal_execution_enabled;
    -- ... (other column drops)
  `;
}
