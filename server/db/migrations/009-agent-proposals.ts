import { sql } from 'drizzle-orm';

/**
 * Migration: Agent Proposals - Safe Mode (Day 2)
 * 
 * Creates table for:
 * - agent_proposals: Proposal submissions for high-power agent actions
 *   Includes risk analysis, approval workflow, and audit trail
 */
export async function up(db: any) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agent_proposals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      
      action_type VARCHAR(50) NOT NULL,
      proposed_args JSONB NOT NULL,
      
      risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
      risk_category VARCHAR(20) NOT NULL DEFAULT 'LOW' CHECK (risk_category IN ('LOW', 'MEDIUM', 'HIGH')),
      risk_breakdown JSONB,
      
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'EXPIRED')),
      
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL,
      
      approved_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
      approved_at TIMESTAMP,
      
      rejected_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
      rejection_reason VARCHAR(500),
      rejected_at TIMESTAMP,
      
      executed_at TIMESTAMP,
      execution_hash VARCHAR(255),
      
      ip_address VARCHAR(255),
      user_agent VARCHAR(500),
      
      reason TEXT
    );
    
    CREATE INDEX agent_proposals_agent_id_idx ON agent_proposals(agent_id);
    CREATE INDEX agent_proposals_status_idx ON agent_proposals(status);
    CREATE INDEX agent_proposals_created_at_idx ON agent_proposals(created_at);
    CREATE INDEX agent_proposals_expires_at_idx ON agent_proposals(expires_at);
    CREATE INDEX agent_proposals_agent_status_idx ON agent_proposals(agent_id, status);
    CREATE INDEX agent_proposals_status_expires_idx ON agent_proposals(status, expires_at);
  `);
}

export async function down(db: any) {
  await db.execute(sql`DROP TABLE IF EXISTS agent_proposals CASCADE`);
}
