
-- Add governance features to existing schema

-- Add voting power to users
ALTER TABLE users ADD COLUMN voting_power DECIMAL(10, 2) DEFAULT 1.0;

-- Add governance settings to DAOs
ALTER TABLE daos ADD COLUMN quorum_percentage INTEGER DEFAULT 20;
ALTER TABLE daos ADD COLUMN voting_period INTEGER DEFAULT 72;
ALTER TABLE daos ADD COLUMN execution_delay INTEGER DEFAULT 24;

-- Add last active tracking for quorum calculations
ALTER TABLE dao_memberships ADD COLUMN last_active TIMESTAMP DEFAULT NOW();

-- Add execution fields to proposals
ALTER TABLE proposals ADD COLUMN template_id UUID REFERENCES proposal_templates(id);
ALTER TABLE proposals ADD COLUMN total_voting_power DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE proposals ADD COLUMN execution_data JSONB;
ALTER TABLE proposals ADD COLUMN executed_at TIMESTAMP;
ALTER TABLE proposals ADD COLUMN executed_by VARCHAR REFERENCES users(id);
ALTER TABLE proposals ADD COLUMN execution_tx_hash VARCHAR;

-- Add delegation fields to votes
ALTER TABLE votes ADD COLUMN voting_power DECIMAL(10, 2) DEFAULT 1.0;
ALTER TABLE votes ADD COLUMN is_delegated BOOLEAN DEFAULT FALSE;
ALTER TABLE votes ADD COLUMN delegated_by VARCHAR REFERENCES users(id);

-- Create proposal templates table
CREATE TABLE proposal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id UUID REFERENCES daos(id),
  name VARCHAR NOT NULL,
  category VARCHAR NOT NULL,
  description TEXT NOT NULL,
  title_template TEXT NOT NULL,
  description_template TEXT NOT NULL,
  required_fields JSONB DEFAULT '[]',
  voting_period INTEGER DEFAULT 72,
  quorum_override INTEGER,
  is_global BOOLEAN DEFAULT FALSE,
  created_by VARCHAR REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create vote delegations table
CREATE TABLE vote_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_id VARCHAR REFERENCES users(id) NOT NULL,
  delegate_id VARCHAR REFERENCES users(id) NOT NULL,
  dao_id UUID REFERENCES daos(id) NOT NULL,
  scope VARCHAR DEFAULT 'all',
  category VARCHAR,
  proposal_id UUID REFERENCES proposals(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create quorum history table
CREATE TABLE quorum_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id UUID REFERENCES daos(id) NOT NULL,
  proposal_id UUID REFERENCES proposals(id),
  active_member_count INTEGER NOT NULL,
  required_quorum INTEGER NOT NULL,
  achieved_quorum INTEGER DEFAULT 0,
  quorum_met BOOLEAN DEFAULT FALSE,
  calculated_at TIMESTAMP DEFAULT NOW()
);

-- Create proposal execution queue table
CREATE TABLE proposal_execution_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES proposals(id) NOT NULL,
  dao_id UUID REFERENCES daos(id) NOT NULL,
  scheduled_for TIMESTAMP NOT NULL,
  execution_type VARCHAR NOT NULL,
  execution_data JSONB NOT NULL,
  status VARCHAR DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_attempt TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_vote_delegations_active ON vote_delegations(dao_id, is_active);
CREATE INDEX idx_execution_queue_pending ON proposal_execution_queue(status, scheduled_for);
CREATE INDEX idx_dao_memberships_active ON dao_memberships(dao_id, last_active);
CREATE INDEX idx_proposal_templates_dao ON proposal_templates(dao_id, category);
