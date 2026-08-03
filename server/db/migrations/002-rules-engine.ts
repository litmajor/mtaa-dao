import { pool } from '../../db';

export async function migrateRulesEngine() {
  // Rules templates (pre-built rule definitions)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rule_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL UNIQUE,
      category VARCHAR(50) NOT NULL,
      description TEXT,
      icon VARCHAR(255),
      rule_config JSONB NOT NULL DEFAULT '{}'::jsonb,
      default_config JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE rule_templates
      ADD COLUMN IF NOT EXISTS icon VARCHAR(255),
      ADD COLUMN IF NOT EXISTS rule_config JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS default_config JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_rule_templates_name ON rule_templates(name);
    CREATE INDEX IF NOT EXISTS idx_rule_templates_category ON rule_templates(category);

    UPDATE rule_templates
      SET rule_config = default_config
      WHERE (rule_config IS NULL OR rule_config = '{}'::jsonb)
        AND default_config IS NOT NULL;
  `);

  // DAO-specific rules
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dao_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dao_id UUID NOT NULL,
      template_id UUID REFERENCES rule_templates(id),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      event_type VARCHAR(50) NOT NULL,
      rule_config JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_active BOOLEAN DEFAULT true,
      priority INTEGER DEFAULT 100,
      created_by VARCHAR(100),
      updated_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dao_id) REFERENCES daos(id) ON DELETE CASCADE
    );

    ALTER TABLE dao_rules
      ADD COLUMN IF NOT EXISTS dao_id UUID,
      ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES rule_templates(id),
      ADD COLUMN IF NOT EXISTS name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS event_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS rule_config JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 100,
      ADD COLUMN IF NOT EXISTS created_by VARCHAR(100),
      ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100),
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    CREATE INDEX IF NOT EXISTS idx_dao_rules_dao_id ON dao_rules(dao_id);
    CREATE INDEX IF NOT EXISTS idx_dao_rules_enabled ON dao_rules(is_active);
  `);

  // Rule execution history
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rule_executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_id UUID NOT NULL,
      dao_id UUID NOT NULL,
      event_type VARCHAR(50) NOT NULL,
      context JSONB NOT NULL,
      conditions_met BOOLEAN NOT NULL,
      actions_executed JSONB DEFAULT '[]'::jsonb,
      execution_result VARCHAR(50) NOT NULL,
      error_message TEXT,
      execution_time_ms INTEGER,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      executed_by VARCHAR(100),
      FOREIGN KEY (rule_id) REFERENCES dao_rules(id) ON DELETE CASCADE,
      FOREIGN KEY (dao_id) REFERENCES daos(id) ON DELETE CASCADE
    );

    ALTER TABLE rule_executions
      ADD COLUMN IF NOT EXISTS rule_id UUID,
      ADD COLUMN IF NOT EXISTS dao_id UUID,
      ADD COLUMN IF NOT EXISTS event_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS context JSONB,
      ADD COLUMN IF NOT EXISTS conditions_met BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS actions_executed JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS execution_result VARCHAR(50),
      ADD COLUMN IF NOT EXISTS error_message TEXT,
      ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER,
      ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS executed_by VARCHAR(100);

    CREATE INDEX IF NOT EXISTS idx_rule_executions_rule_id 
      ON rule_executions(rule_id);
    CREATE INDEX IF NOT EXISTS idx_rule_executions_executed_at 
      ON rule_executions(executed_at);
    CREATE INDEX IF NOT EXISTS idx_rule_executions_result 
      ON rule_executions(execution_result);
  `);

  // Seed default templates using parameterized queries
  const templates = [
    { name: 'Open Entry', category: 'entry', description: 'Allow anyone to join automatically', icon: '🎫', defaultConfig: { requiresApproval: false, minContribution: 0 } },
    { name: 'Minimum Contribution', category: 'entry', description: 'Require minimum contribution to join', icon: '💰', defaultConfig: { requiresApproval: false, minContribution: 100 } },
    { name: 'Elder Approval Required', category: 'entry', description: 'Elders must approve new members', icon: '👵', defaultConfig: { requiresApproval: true, approver: 'elder' } },
    { name: 'Anytime Withdrawal', category: 'withdrawal', description: 'Members can withdraw anytime', icon: '💳', defaultConfig: { fixedDays: [], maxPerCycle: null } },
    { name: 'Fixed Withdrawal Days', category: 'withdrawal', description: 'Withdrawals only on specific days', icon: '📅', defaultConfig: { fixedDays: [5], maxPerCycle: null } },
    { name: 'Max Per Cycle', category: 'withdrawal', description: 'Limit withdrawal amount per cycle', icon: '📊', defaultConfig: { fixedDays: [], maxPerCycle: 1000 } },
    { name: 'Monthly Rotation', category: 'rotation', description: 'Rotate leadership monthly', icon: '🔄', defaultConfig: { frequency: 'monthly', distributionMethod: 'equal' } },
    { name: 'Quarterly Rotation', category: 'rotation', description: 'Rotate leadership quarterly', icon: '📆', defaultConfig: { frequency: 'quarterly', distributionMethod: 'equal' } },
    { name: 'Interest Accrual', category: 'financial', description: 'Apply interest to holdings', icon: '📈', defaultConfig: { interestRate: 0.02, compounding: 'monthly' } },
    { name: 'Flat Fee', category: 'financial', description: 'Apply flat fee to transactions', icon: '🏷️', defaultConfig: { feeAmount: 0.5, feeType: 'flat' } },
    { name: 'Vote Threshold', category: 'governance', description: 'Require minimum voting threshold', icon: '🗳️', defaultConfig: { votingThreshold: 0.75 } },
    { name: 'Quorum Requirement', category: 'governance', description: 'Require minimum quorum for votes', icon: '👥', defaultConfig: { quorumPercentage: 0.5 } }
  ];

  for (const t of templates) {
    try {
      await pool.query(
        `INSERT INTO rule_templates (name, category, description, icon, rule_config, default_config)
         VALUES ($1, $2, $3, $4, $5::jsonb, $5::jsonb)
         ON CONFLICT (name) DO NOTHING`,
        [t.name, t.category, t.description, t.icon, JSON.stringify(t.defaultConfig)]
      );
    } catch (e) {
      // Non-fatal: template insert failure should not block migrations
      console.warn('Warning: failed to insert rule template', t.name, e instanceof Error ? e.message : e);
    }
  }
}

export async function rollbackRulesEngine() {
  await pool.query('DROP TABLE IF EXISTS rule_executions CASCADE');
  await pool.query('DROP TABLE IF EXISTS dao_rules CASCADE');
  await pool.query('DROP TABLE IF EXISTS rule_templates CASCADE');
}
