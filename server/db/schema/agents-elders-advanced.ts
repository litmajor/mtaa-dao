import { pgTable, text, timestamp, jsonb, varchar, uuid, integer, boolean, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { elders, agents } from './agents-elders';

// ============================================================================
// CONFIGURATION HISTORY TABLE
// ============================================================================

export const configurationHistory = pgTable(
  'configuration_history',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    entityType: varchar('entity_type', { length: 50 }).notNull(), // 'elder' or 'agent'
    entityId: varchar('entity_id', { length: 100 }).notNull(),
    versionNumber: integer('version_number').notNull(),
    configuration: jsonb('configuration').notNull(), // Current configuration
    previousConfiguration: jsonb('previous_configuration'), // Previous configuration
    changedFields: text('changed_fields').array(), // Array of field names that changed
    changeReason: varchar('change_reason', { length: 500 }), // Why the change was made
    changedBy: varchar('changed_by', { length: 100 }).notNull(), // Admin ID who made change
    changedAt: timestamp('changed_at').notNull().default(sql`now()`),
    createdAt: timestamp('created_at').notNull().default(sql`now()`),
  },
  (table) => [
    index('idx_config_history_entity').on(table.entityType, table.entityId),
    index('idx_config_history_entity_version').on(table.entityType, table.entityId, table.versionNumber),
    index('idx_config_history_changed_by').on(table.changedBy),
    index('idx_config_history_changed_at').on(table.changedAt),
  ]
);

// ============================================================================
// CONFIGURATION TEMPLATES TABLE
// ============================================================================

export const configurationTemplates = pgTable(
  'configuration_templates',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    entityType: varchar('entity_type', { length: 50 }).notNull(), // 'elder' or 'agent'
    specificType: varchar('specific_type', { length: 50 }), // KAIZEN, SCRY, Analyzer, etc.
    configuration: jsonb('configuration').notNull(), // Template configuration
    category: varchar('category', { length: 50 }), // production, development, performance, security, custom
    isPublic: boolean('is_public').default(true), // Public or private template
    createdBy: varchar('created_by', { length: 100 }).notNull(),
    usageCount: integer('usage_count').default(0), // Track how many times template used
    tags: text('tags').array(), // Array of tags for searching
    createdAt: timestamp('created_at').notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at').notNull().default(sql`now()`),
  },
  (table) => [
    index('idx_templates_entity_type').on(table.entityType),
    index('idx_templates_category').on(table.category),
    index('idx_templates_public').on(table.isPublic),
    index('idx_templates_created_by').on(table.createdBy),
  ]
);

// ============================================================================
// SCHEDULED CHANGES TABLE
// ============================================================================

export const scheduledChanges = pgTable(
  'scheduled_changes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: varchar('entity_id', { length: 100 }).notNull(),
    configuration: jsonb('configuration').notNull(), // Configuration to apply
    scheduledFor: timestamp('scheduled_for').notNull(), // When to apply change
    schedule: text('schedule'), // Cron-like schedule for recurring changes
    status: varchar('status', { length: 50 }).default('pending'), // pending, approved, executed, cancelled, failed
    changeReason: varchar('change_reason', { length: 500 }),
    executedAt: timestamp('executed_at'), // When the change was executed
    executionResult: jsonb('execution_result'), // Result of execution (success/error details)
    createdBy: varchar('created_by', { length: 100 }).notNull(),
    approvedBy: varchar('approved_by', { length: 100 }), // For approval workflow
    approvedAt: timestamp('approved_at'),
    createdAt: timestamp('created_at').notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at').notNull().default(sql`now()`),
  },
  (table) => [
    index('idx_scheduled_entity').on(table.entityType, table.entityId),
    index('idx_scheduled_for').on(table.scheduledFor),
    index('idx_scheduled_status').on(table.status),
    index('idx_scheduled_created_by').on(table.createdBy),
  ]
);

// ============================================================================
// CONFIGURATION ALERTS TABLE
// ============================================================================

export const configurationAlerts = pgTable(
  'configuration_alerts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: varchar('entity_id', { length: 100 }).notNull(),
    alertType: varchar('alert_type', { length: 100 }).notNull(), // config_changed, threshold_exceeded, status_changed, error, performance_degradation
    message: text('message').notNull(),
    details: jsonb('details'), // Additional alert details
    severity: varchar('severity', { length: 50 }).default('info'), // critical, high, medium, low, info
    isResolved: boolean('is_resolved').default(false),
    resolvedAt: timestamp('resolved_at'),
    resolvedBy: varchar('resolved_by', { length: 100 }), // Who resolved the alert
    notificationsSent: boolean('notifications_sent').default(true), // Was notification sent?
    createdAt: timestamp('created_at').notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at').notNull().default(sql`now()`),
  },
  (table) => [
    index('idx_alerts_entity').on(table.entityType, table.entityId),
    index('idx_alerts_type').on(table.alertType),
    index('idx_alerts_severity').on(table.severity),
    index('idx_alerts_resolved').on(table.isResolved),
    index('idx_alerts_created_at').on(table.createdAt),
  ]
);

// ============================================================================
// SEARCH PROFILES TABLE (For saved searches)
// ============================================================================

export const searchProfiles = pgTable(
  'search_profiles',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    query: text('query').notNull(), // Search query
    filters: jsonb('filters'), // Filter configuration
    isPublic: boolean('is_public').default(false),
    createdBy: varchar('created_by', { length: 100 }).notNull(),
    usageCount: integer('usage_count').default(0),
    lastUsedAt: timestamp('last_used_at'),
    createdAt: timestamp('created_at').notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at').notNull().default(sql`now()`),
  },
  (table) => [
    index('idx_search_profiles_created_by').on(table.createdBy),
    index('idx_search_profiles_public').on(table.isPublic),
  ]
);

// ============================================================================
// PERFORMANCE SNAPSHOTS TABLE (For historical analytics)
// ============================================================================

export const performanceSnapshots = pgTable(
  'performance_snapshots',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: varchar('entity_id', { length: 100 }).notNull(),
    metrics: jsonb('metrics').notNull(), // Performance metrics snapshot
    timestamp: timestamp('timestamp').notNull().default(sql`now()`),
    period: varchar('period', { length: 50 }), // hourly, daily, weekly, monthly
  },
  (table) => [
    index('idx_performance_entity').on(table.entityType, table.entityId),
    index('idx_performance_timestamp').on(table.timestamp),
    index('idx_performance_period').on(table.period),
  ]
);

// ============================================================================
// ALERT RULES TABLE (For configurable alert rules)
// ============================================================================

export const alertRules = pgTable(
  'alert_rules',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    entityType: varchar('entity_type', { length: 50 }), // Apply to all or specific type
    entityId: varchar('entity_id', { length: 100 }), // Apply to specific entity or null for all
    alertType: varchar('alert_type', { length: 100 }).notNull(),
    condition: jsonb('condition').notNull(), // Alert condition definition
    threshold: jsonb('threshold'), // Threshold values
    severity: varchar('severity', { length: 50 }).default('info'),
    isEnabled: boolean('is_enabled').default(true),
    notificationChannels: text('notification_channels').array(), // email, webhook, slack, etc.
    createdBy: varchar('created_by', { length: 100 }).notNull(),
    createdAt: timestamp('created_at').notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at').notNull().default(sql`now()`),
  },
  (table) => [
    index('idx_alert_rules_entity').on(table.entityType, table.entityId),
    index('idx_alert_rules_type').on(table.alertType),
    index('idx_alert_rules_enabled').on(table.isEnabled),
  ]
);
