
-- MetaDAO Core Tables
CREATE TABLE IF NOT EXISTS "meta_daos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar NOT NULL,
  "description" text,
  "meta_dao_type" varchar NOT NULL, -- 'geographic', 'sectoral', 'purpose', 'supply_chain'
  "governance_model" varchar DEFAULT 'quadratic_voting',
  "quorum_percentage" integer DEFAULT 70,
  "voting_period_hours" integer DEFAULT 168, -- 7 days
  "min_member_daos" integer DEFAULT 3,
  "max_member_daos" integer DEFAULT 100,
  "treasury_balance" numeric DEFAULT 0,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- DAO Membership in MetaDAOs
CREATE TABLE IF NOT EXISTS "meta_dao_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "meta_dao_id" uuid NOT NULL REFERENCES "meta_daos"("id") ON DELETE CASCADE,
  "dao_id" varchar NOT NULL REFERENCES "daos"("id") ON DELETE CASCADE,
  "joined_at" timestamp DEFAULT now(),
  "voting_power" numeric DEFAULT 0, -- Calculated via quadratic formula
  "contribution_percentage" numeric DEFAULT 0, -- % of treasury contributed
  "status" varchar DEFAULT 'active', -- 'active', 'suspended', 'exited'
  "representative_user_id" varchar REFERENCES "users"("id"), -- DAO's rep in MetaDAO
  UNIQUE("meta_dao_id", "dao_id")
);

-- Cross-DAO Proposals
CREATE TABLE IF NOT EXISTS "meta_dao_proposals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "meta_dao_id" uuid NOT NULL REFERENCES "meta_daos"("id") ON DELETE CASCADE,
  "proposer_dao_id" varchar NOT NULL REFERENCES "daos"("id"),
  "title" varchar NOT NULL,
  "description" text NOT NULL,
  "proposal_type" varchar NOT NULL, -- 'treasury', 'governance', 'membership', 'bulk_purchase'
  "budget" numeric DEFAULT 0,
  "beneficiary_daos" jsonb DEFAULT '[]'::jsonb, -- Array of DAO IDs
  "voting_start" timestamp DEFAULT now(),
  "voting_end" timestamp,
  "quorum_met" boolean DEFAULT false,
  "status" varchar DEFAULT 'active',
  "created_at" timestamp DEFAULT now()
);

-- MetaDAO Voting Records
CREATE TABLE IF NOT EXISTS "meta_dao_votes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "proposal_id" uuid NOT NULL REFERENCES "meta_dao_proposals"("id") ON DELETE CASCADE,
  "dao_id" varchar NOT NULL REFERENCES "daos"("id"),
  "vote" varchar NOT NULL, -- 'yes', 'no', 'abstain'
  "voting_power" numeric NOT NULL,
  "voted_at" timestamp DEFAULT now(),
  UNIQUE("proposal_id", "dao_id")
);

-- MetaDAO Treasury Transactions
CREATE TABLE IF NOT EXISTS "meta_dao_treasury_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "meta_dao_id" uuid NOT NULL REFERENCES "meta_daos"("id"),
  "from_dao_id" varchar REFERENCES "daos"("id"),
  "to_dao_id" varchar REFERENCES "daos"("id"),
  "transaction_type" varchar NOT NULL, -- 'contribution', 'disbursement', 'bulk_purchase'
  "amount" numeric NOT NULL,
  "currency" varchar DEFAULT 'cUSD',
  "proposal_id" uuid REFERENCES "meta_dao_proposals"("id"),
  "transaction_hash" varchar,
  "created_at" timestamp DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_meta_dao_memberships_meta_dao ON meta_dao_memberships(meta_dao_id);
CREATE INDEX idx_meta_dao_memberships_dao ON meta_dao_memberships(dao_id);
CREATE INDEX idx_meta_dao_proposals_meta_dao ON meta_dao_proposals(meta_dao_id);
CREATE INDEX idx_meta_dao_votes_proposal ON meta_dao_votes(proposal_id);
CREATE INDEX idx_meta_dao_treasury_meta_dao ON meta_dao_treasury_transactions(meta_dao_id);
