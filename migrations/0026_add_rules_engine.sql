-- Rules Engine Core Tables

-- Rule Templates Table
CREATE TABLE IF NOT EXISTS "rule_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar NOT NULL UNIQUE,
  "category" varchar NOT NULL, -- 'entry', 'withdrawal', 'rotation', 'financial', 'governance'
  "description" text,
  "rule_config" jsonb NOT NULL, -- Contains conditions and actions
  "is_default" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- DAO Rules Table
CREATE TABLE IF NOT EXISTS "dao_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dao_id" varchar NOT NULL REFERENCES "daos"("id") ON DELETE CASCADE,
  "template_id" uuid REFERENCES "rule_templates"("id"),
  "name" varchar NOT NULL,
  "description" text,
  "event_type" varchar NOT NULL, -- 'member_entry', 'member_exit', 'proposal', 'contribution', 'rotation', 'withdrawal'
  "rule_config" jsonb NOT NULL, -- Contains conditions and actions
  "is_active" boolean DEFAULT true,
  "priority" integer DEFAULT 100, -- Higher number = higher priority
  "created_by" varchar NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  "updated_by" varchar REFERENCES "users"("id"),
  UNIQUE("dao_id", "name")
);

-- Rule Executions History Table
CREATE TABLE IF NOT EXISTS "rule_executions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "rule_id" uuid NOT NULL REFERENCES "dao_rules"("id") ON DELETE CASCADE,
  "dao_id" varchar NOT NULL REFERENCES "daos"("id") ON DELETE CASCADE,
  "event_type" varchar NOT NULL, -- 'member_entry', 'member_exit', etc.
  "context" jsonb NOT NULL, -- The data that triggered the rule
  "conditions_met" boolean NOT NULL,
  "actions_executed" jsonb DEFAULT '[]'::jsonb, -- Array of executed actions
  "execution_result" varchar NOT NULL, -- 'success', 'failed', 'partial'
  "error_message" text,
  "execution_time_ms" integer,
  "executed_at" timestamp DEFAULT now(),
  "executed_by" varchar REFERENCES "users"("id")
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_rule_templates_category" ON "rule_templates"("category");
CREATE INDEX IF NOT EXISTS "idx_rule_templates_is_default" ON "rule_templates"("is_default");

CREATE INDEX IF NOT EXISTS "idx_dao_rules_dao_id" ON "dao_rules"("dao_id");
CREATE INDEX IF NOT EXISTS "idx_dao_rules_event_type" ON "dao_rules"("event_type");
CREATE INDEX IF NOT EXISTS "idx_dao_rules_is_active" ON "dao_rules"("is_active");
CREATE INDEX IF NOT EXISTS "idx_dao_rules_dao_event" ON "dao_rules"("dao_id", "event_type");

CREATE INDEX IF NOT EXISTS "idx_rule_executions_rule_id" ON "rule_executions"("rule_id");
CREATE INDEX IF NOT EXISTS "idx_rule_executions_dao_id" ON "rule_executions"("dao_id");
CREATE INDEX IF NOT EXISTS "idx_rule_executions_executed_at" ON "rule_executions"("executed_at");
CREATE INDEX IF NOT EXISTS "idx_rule_executions_dao_executed" ON "rule_executions"("dao_id", "executed_at");

-- Insert default rule templates
INSERT INTO "rule_templates" ("name", "category", "description", "rule_config", "is_default") VALUES
(
  'Entry: Minimum Contribution',
  'entry',
  'Require minimum contribution amount for new members',
  '{
    "name": "Entry: Minimum Contribution",
    "conditions": [
      {
        "field": "contribution_amount",
        "operator": "gte",
        "value": 100,
        "description": "Member contribution >= $100"
      }
    ],
    "operator": "AND",
    "actions": [
      {
        "type": "approve",
        "description": "Approve member entry"
      }
    ]
  }',
  true
),
(
  'Entry: Reputation Check',
  'entry',
  'Require minimum reputation score for new members',
  '{
    "name": "Entry: Reputation Check",
    "conditions": [
      {
        "field": "reputation_score",
        "operator": "gte",
        "value": 50,
        "description": "Member reputation >= 50"
      }
    ],
    "operator": "AND",
    "actions": [
      {
        "type": "approve",
        "description": "Approve member entry"
      }
    ]
  }',
  true
),
(
  'Withdrawal: Maximum Amount',
  'withdrawal',
  'Limit maximum withdrawal amount per transaction',
  '{
    "name": "Withdrawal: Maximum Amount",
    "conditions": [
      {
        "field": "withdrawal_amount",
        "operator": "lte",
        "value": 5000,
        "description": "Withdrawal amount <= $5000"
      }
    ],
    "operator": "AND",
    "actions": [
      {
        "type": "approve",
        "description": "Approve withdrawal"
      }
    ]
  }',
  true
),
(
  'Withdrawal: Cooldown Period',
  'withdrawal',
  'Enforce cooldown period between withdrawals',
  '{
    "name": "Withdrawal: Cooldown Period",
    "conditions": [
      {
        "field": "days_since_last_withdrawal",
        "operator": "gte",
        "value": 7,
        "description": "At least 7 days since last withdrawal"
      }
    ],
    "operator": "AND",
    "actions": [
      {
        "type": "approve",
        "description": "Approve withdrawal"
      },
      {
        "type": "notify",
        "target": "user",
        "description": "Notify member of cooldown status"
      }
    ]
  }',
  true
),
(
  'Rotation: Age Requirement',
  'rotation',
  'Require minimum tenure for member to vote on rotations',
  '{
    "name": "Rotation: Age Requirement",
    "conditions": [
      {
        "field": "member_tenure_days",
        "operator": "gte",
        "value": 30,
        "description": "Member has been in DAO >= 30 days"
      }
    ],
    "operator": "AND",
    "actions": [
      {
        "type": "approve",
        "description": "Allow member to vote on rotation"
      }
    ]
  }',
  true
),
(
  'Financial: Large Transaction Alert',
  'financial',
  'Alert admins for large transactions',
  '{
    "name": "Financial: Large Transaction Alert",
    "conditions": [
      {
        "field": "transaction_amount",
        "operator": "gte",
        "value": 10000,
        "description": "Transaction >= $10,000"
      }
    ],
    "operator": "AND",
    "actions": [
      {
        "type": "notify",
        "target": "admins",
        "description": "Alert admins of large transaction"
      },
      {
        "type": "trigger_vote",
        "description": "Require governance vote"
      }
    ]
  }',
  true
),
(
  'Governance: Quorum Check',
  'governance',
  'Ensure proposals meet quorum requirements',
  '{
    "name": "Governance: Quorum Check",
    "conditions": [
      {
        "field": "participation_percentage",
        "operator": "gte",
        "value": 50,
        "description": "Participation >= 50%"
      }
    ],
    "operator": "AND",
    "actions": [
      {
        "type": "approve",
        "description": "Approve proposal execution"
      }
    ]
  }',
  true
),
(
  'Proposal: Minimum Duration',
  'governance',
  'Require minimum voting period for proposals',
  '{
    "name": "Proposal: Minimum Duration",
    "conditions": [
      {
        "field": "voting_period_hours",
        "operator": "gte",
        "value": 24,
        "description": "Voting period >= 24 hours"
      }
    ],
    "operator": "AND",
    "actions": [
      {
        "type": "approve",
        "description": "Allow proposal creation"
      }
    ]
  }',
  true
),
(
  'Member: Inactivity Removal',
  'rotation',
  'Remove members inactive for extended period',
  '{
    "name": "Member: Inactivity Removal",
    "conditions": [
      {
        "field": "days_since_last_activity",
        "operator": "gte",
        "value": 90,
        "description": "No activity for >= 90 days"
      }
    ],
    "operator": "AND",
    "actions": [
      {
        "type": "trigger_vote",
        "description": "Trigger removal vote"
      },
      {
        "type": "notify",
        "target": "user",
        "description": "Warn member of inactivity"
      }
    ]
  }',
  true
);
