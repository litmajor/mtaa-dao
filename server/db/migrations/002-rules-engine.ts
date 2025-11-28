import { sql } from 'drizzle-orm';
import type { Database } from 'better-sqlite3';

export async function up(db: Database) {
  // Rules templates (pre-built rule definitions)
  db.exec(`
    CREATE TABLE rule_templates (
      id TEXT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(50) NOT NULL,
      description TEXT,
      icon VARCHAR(255),
      default_config JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX idx_rule_templates_category 
      ON rule_templates(category);
  `);

  // DAO-specific rules
  db.exec(`
    CREATE TABLE dao_rules (
      id TEXT PRIMARY KEY,
      dao_id TEXT NOT NULL,
      template_id TEXT REFERENCES rule_templates(id),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      enabled BOOLEAN DEFAULT true,
      rule_config JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dao_id) REFERENCES daos(id) ON DELETE CASCADE
    );
    
    CREATE INDEX idx_dao_rules_dao_id ON dao_rules(dao_id);
    CREATE INDEX idx_dao_rules_enabled ON dao_rules(enabled);
  `);

  // Rule execution history
  db.exec(`
    CREATE TABLE rule_executions (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      context JSONB NOT NULL,
      result VARCHAR(50) NOT NULL,
      reason TEXT,
      FOREIGN KEY (rule_id) REFERENCES dao_rules(id) ON DELETE CASCADE
    );
    
    CREATE INDEX idx_rule_executions_rule_id 
      ON rule_executions(rule_id);
    CREATE INDEX idx_rule_executions_executed_at 
      ON rule_executions(executed_at);
    CREATE INDEX idx_rule_executions_result 
      ON rule_executions(result);
  `);

  // Seed default templates
  const templates = [
    {
      id: 'entry_open',
      name: 'Open Entry',
      category: 'entry',
      description: 'Allow anyone to join automatically',
      icon: '🎫',
      defaultConfig: { requiresApproval: false, minContribution: 0 }
    },
    {
      id: 'entry_min_contribution',
      name: 'Minimum Contribution',
      category: 'entry',
      description: 'Require minimum contribution to join',
      icon: '💰',
      defaultConfig: { requiresApproval: false, minContribution: 100 }
    },
    {
      id: 'entry_elder_approval',
      name: 'Elder Approval Required',
      category: 'entry',
      description: 'Elders must approve new members',
      icon: '👵',
      defaultConfig: { requiresApproval: true, approver: 'elder' }
    },
    {
      id: 'withdrawal_any_time',
      name: 'Anytime Withdrawal',
      category: 'withdrawal',
      description: 'Members can withdraw anytime',
      icon: '💳',
      defaultConfig: { fixedDays: [], maxPerCycle: null }
    },
    {
      id: 'withdrawal_fixed_days',
      name: 'Fixed Withdrawal Days',
      category: 'withdrawal',
      description: 'Withdrawals only on specific days',
      icon: '📅',
      defaultConfig: { fixedDays: [5], maxPerCycle: null }
    },
    {
      id: 'withdrawal_max_per_cycle',
      name: 'Max Per Cycle',
      category: 'withdrawal',
      description: 'Limit withdrawal amount per cycle',
      icon: '📊',
      defaultConfig: { fixedDays: [], maxPerCycle: 1000 }
    },
    {
      id: 'rotation_monthly',
      name: 'Monthly Rotation',
      category: 'rotation',
      description: 'Rotate leadership monthly',
      icon: '🔄',
      defaultConfig: { frequency: 'monthly', distributionMethod: 'equal' }
    },
    {
      id: 'rotation_quarterly',
      name: 'Quarterly Rotation',
      category: 'rotation',
      description: 'Rotate leadership quarterly',
      icon: '📆',
      defaultConfig: { frequency: 'quarterly', distributionMethod: 'equal' }
    },
    {
      id: 'financial_interest',
      name: 'Interest Accrual',
      category: 'financial',
      description: 'Apply interest to holdings',
      icon: '📈',
      defaultConfig: { interestRate: 0.02, compounding: 'monthly' }
    },
    {
      id: 'financial_fee_flat',
      name: 'Flat Fee',
      category: 'financial',
      description: 'Apply flat fee to transactions',
      icon: '🏷️',
      defaultConfig: { feeAmount: 0.5, feeType: 'flat' }
    },
    {
      id: 'governance_vote_threshold',
      name: 'Vote Threshold',
      category: 'governance',
      description: 'Require minimum voting threshold',
      icon: '🗳️',
      defaultConfig: { votingThreshold: 0.75 }
    },
    {
      id: 'governance_quorum',
      name: 'Quorum Requirement',
      category: 'governance',
      description: 'Require minimum quorum for votes',
      icon: '👥',
      defaultConfig: { quorumPercentage: 0.5 }
    }
  ];

  for (const template of templates) {
    db.exec(`
      INSERT INTO rule_templates (id, name, category, description, icon, default_config)
      VALUES (
        '${template.id}',
        '${template.name}',
        '${template.category}',
        '${template.description}',
        '${template.icon}',
        '${JSON.stringify(template.defaultConfig).replace(/'/g, "''")}'
      )
    `);
  }
}

export async function down(db: Database) {
  db.exec('DROP TABLE IF EXISTS rule_executions');
  db.exec('DROP TABLE IF EXISTS dao_rules');
  db.exec('DROP TABLE IF EXISTS rule_templates');
}
