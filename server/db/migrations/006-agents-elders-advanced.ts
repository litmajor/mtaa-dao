import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/**
 * Migration 006: Phase 5.3 Advanced Features (Configuration History, Templates, Alerts)
 * Creates tables for:
 * - Configuration history and version control
 * - Configuration templates
 * - Scheduled configuration changes
 * - Configuration alerts and rules
 * - Search profiles
 * - Performance snapshots for analytics
 */

export async function up(db: NodePgDatabase<any>) {
  console.log('Running migration 006: Phase 5.3 Advanced Features...');

  // Create configuration_history table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS configuration_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(100) NOT NULL,
      version_number INTEGER NOT NULL,
      configuration JSONB NOT NULL,
      previous_configuration JSONB,
      changed_fields TEXT[],
      change_reason VARCHAR(500),
      changed_by VARCHAR(100) NOT NULL,
      changed_at TIMESTAMP NOT NULL DEFAULT now(),
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `);

  // Create indexes for configuration_history
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_config_history_entity 
    ON configuration_history(entity_type, entity_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_config_history_entity_version 
    ON configuration_history(entity_type, entity_id, version_number);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_config_history_changed_by 
    ON configuration_history(changed_by);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_config_history_changed_at 
    ON configuration_history(changed_at);
  `);

  // Create configuration_templates table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS configuration_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      description TEXT,
      entity_type VARCHAR(50) NOT NULL,
      specific_type VARCHAR(50),
      configuration JSONB NOT NULL,
      category VARCHAR(50),
      is_public BOOLEAN DEFAULT true,
      created_by VARCHAR(100) NOT NULL,
      usage_count INTEGER DEFAULT 0,
      tags TEXT[],
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      updated_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `);

  // Create indexes for configuration_templates
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_templates_entity_type 
    ON configuration_templates(entity_type);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_templates_category 
    ON configuration_templates(category);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_templates_public 
    ON configuration_templates(is_public);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_templates_created_by 
    ON configuration_templates(created_by);
  `);

  // Create scheduled_changes table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS scheduled_changes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(100) NOT NULL,
      configuration JSONB NOT NULL,
      scheduled_for TIMESTAMP NOT NULL,
      schedule TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      change_reason VARCHAR(500),
      executed_at TIMESTAMP,
      execution_result JSONB,
      created_by VARCHAR(100) NOT NULL,
      approved_by VARCHAR(100),
      approved_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      updated_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `);

  // Create indexes for scheduled_changes
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_scheduled_entity 
    ON scheduled_changes(entity_type, entity_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_scheduled_for 
    ON scheduled_changes(scheduled_for);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_scheduled_status 
    ON scheduled_changes(status);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_scheduled_created_by 
    ON scheduled_changes(created_by);
  `);

  // Create configuration_alerts table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS configuration_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(100) NOT NULL,
      alert_type VARCHAR(100) NOT NULL,
      message TEXT NOT NULL,
      details JSONB,
      severity VARCHAR(50) DEFAULT 'info',
      is_resolved BOOLEAN DEFAULT false,
      resolved_at TIMESTAMP,
      resolved_by VARCHAR(100),
      notifications_sent BOOLEAN DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      updated_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `);

  // Create indexes for configuration_alerts
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_alerts_entity 
    ON configuration_alerts(entity_type, entity_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_alerts_type 
    ON configuration_alerts(alert_type);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_alerts_severity 
    ON configuration_alerts(severity);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_alerts_resolved 
    ON configuration_alerts(is_resolved);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_alerts_created_at 
    ON configuration_alerts(created_at);
  `);

  // Create search_profiles table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS search_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      description TEXT,
      query TEXT NOT NULL,
      filters JSONB,
      is_public BOOLEAN DEFAULT false,
      created_by VARCHAR(100) NOT NULL,
      usage_count INTEGER DEFAULT 0,
      last_used_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      updated_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `);

  // Create indexes for search_profiles
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_search_profiles_created_by 
    ON search_profiles(created_by);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_search_profiles_public 
    ON search_profiles(is_public);
  `);

  // Create performance_snapshots table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS performance_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(100) NOT NULL,
      metrics JSONB NOT NULL,
      timestamp TIMESTAMP NOT NULL DEFAULT now(),
      period VARCHAR(50)
    );
  `);

  // Create indexes for performance_snapshots
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_performance_entity 
    ON performance_snapshots(entity_type, entity_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_performance_timestamp 
    ON performance_snapshots(timestamp);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_performance_period 
    ON performance_snapshots(period);
  `);

  // Create alert_rules table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS alert_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      description TEXT,
      entity_type VARCHAR(50),
      entity_id VARCHAR(100),
      alert_type VARCHAR(100) NOT NULL,
      condition JSONB NOT NULL,
      threshold JSONB,
      severity VARCHAR(50) DEFAULT 'info',
      is_enabled BOOLEAN DEFAULT true,
      notification_channels TEXT[],
      created_by VARCHAR(100) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      updated_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `);

  // Create indexes for alert_rules
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_alert_rules_entity 
    ON alert_rules(entity_type, entity_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_alert_rules_type 
    ON alert_rules(alert_type);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled 
    ON alert_rules(is_enabled);
  `);

  console.log('Migration 006 completed successfully!');
}

export async function down(db: NodePgDatabase<any>) {
  console.log('Rolling back migration 006: Phase 5.3 Advanced Features...');

  // Drop tables in reverse order
  await db.execute(sql`DROP TABLE IF EXISTS alert_rules CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS performance_snapshots CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS search_profiles CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS configuration_alerts CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS scheduled_changes CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS configuration_templates CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS configuration_history CASCADE;`);

  console.log('Migration 006 rollback completed!');
}
