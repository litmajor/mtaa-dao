/**
 * Elders & Agents Database Schema
 * Drizzle ORM schema for Phase 5 Agents and Elders management
 */

import {
  pgTable,
  text,
  varchar,
  numeric,
  boolean,
  timestamp,
  json,
  integer,
  index,
  foreignKey,
  unique,
  sql,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Elders Table
 * Stores information about the three specialized Elders: KAIZEN, SCRY, LUMEN
 */
export const elders = pgTable(
  'elders',
  {
    id: varchar('id', { length: 64 }).primaryKey(), // e.g., 'eld-kaizen'
    name: varchar('name', { length: 255 }).notNull().unique(), // e.g., 'KAIZEN'
    emoji: varchar('emoji', { length: 10 }).notNull(), // e.g., '⚙️'
    role: varchar('role', { length: 255 }).notNull(), // e.g., 'Process Optimization'
    description: text('description').notNull(),
    
    // Capabilities stored as JSON array
    capabilities: json('capabilities').notNull().default(sql`'[]'::json`),
    
    // Status
    status: varchar('status', { length: 20 }).notNull().default('active'), // 'active', 'inactive', 'maintenance'
    uptime: numeric('uptime', { precision: 5, scale: 4 }).notNull().default('0.99'), // 0-1 decimal
    lastHeartbeat: timestamp('last_heartbeat').defaultNow().notNull(),
    
    // Statistics - specific per Elder
    // For KAIZEN (Optimization)
    proposalsAnalyzed: integer('proposals_analyzed').default(0),
    optimizationsSuggested: integer('optimizations_suggested').default(0),
    implementationRate: numeric('implementation_rate', { precision: 5, scale: 4 }).default('0.72'),
    
    // For SCRY (Security)
    threatsDetected: integer('threats_detected').default(0),
    risksIdentified: integer('risks_identified').default(0),
    complianceIssues: integer('compliance_issues').default(0),
    
    // For LUMEN (Ethics)
    proposalsReviewed: integer('proposals_reviewed').default(0),
    ethicalConcerns: integer('ethical_concerns').default(0),
    approvalRate: numeric('approval_rate', { precision: 5, scale: 4 }).default('0.91'),
    
    // Color for UI
    color: varchar('color', { length: 7 }).notNull(), // e.g., '#667eea'
    
    // Configuration
    configuration: json('configuration').notNull().default(sql`'{}'::json`),
    
    // Metadata
    tags: json('tags').default(sql`'[]'::json`),
    metadata: json('metadata').default(sql`'{}'::json`),
    
    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_elders_status').on(table.status),
    index('idx_elders_lastHeartbeat').on(table.lastHeartbeat),
  ]
);

/**
 * Agents Table
 * Stores information about operational agents: Analyzer, Defender, Scout, Coordinator, Kwetu
 */
export const agents = pgTable(
  'agents',
  {
    id: varchar('id', { length: 64 }).primaryKey(), // e.g., 'agent-analyzer'
    name: varchar('name', { length: 255 }).notNull().unique(),
    type: varchar('type', { length: 64 }).notNull(), // 'analyzer', 'defender', 'scout', 'coordinator', 'kwetu'
    emoji: varchar('emoji', { length: 10 }).notNull(),
    description: text('description').notNull(),
    
    // Status
    status: varchar('status', { length: 20 }).notNull().default('online'), // 'online', 'offline', 'error'
    uptime: numeric('uptime', { precision: 5, scale: 4 }).notNull().default('0.995'), // 0-1 decimal
    lastHeartbeat: timestamp('last_heartbeat').defaultNow().notNull(),
    
    // Performance Metrics
    messagesProcessed: integer('messages_processed').default(0),
    averageResponseTime: integer('average_response_time').default(0), // in milliseconds
    errorRate: numeric('error_rate', { precision: 5, scale: 4 }).default('0.01'), // 0-1 decimal
    
    // Capabilities
    capabilities: json('capabilities').notNull().default(sql`'[]'::json`),
    
    // Version & Release
    version: varchar('version', { length: 20 }).default('1.0.0'),
    lastDeployedAt: timestamp('last_deployed_at').defaultNow(),
    
    // Configuration
    configuration: json('configuration').notNull().default(sql`'{}'::json`),
    
    // Metadata
    tags: json('tags').default(sql`'[]'::json`),
    metadata: json('metadata').default(sql`'{}'::json`),
    
    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_agents_status').on(table.status),
    index('idx_agents_type').on(table.type),
    index('idx_agents_lastHeartbeat').on(table.lastHeartbeat),
  ]
);

/**
 * Elder Activity History
 * Tracks actions and recommendations from each Elder
 */
export const elderActivity = pgTable(
  'elder_activity',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    elderId: varchar('elder_id', { length: 64 }).notNull(),
    
    // Activity details
    activityType: varchar('activity_type', { length: 64 }).notNull(), // 'recommendation', 'alert', 'analysis'
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    
    // Impact/Result
    impact: varchar('impact', { length: 255 }),
    severity: varchar('severity', { length: 20 }).default('info'), // 'info', 'warning', 'critical'
    
    // Status
    status: varchar('status', { length: 20 }).default('pending'), // 'pending', 'completed', 'failed'
    
    // Related data
    relatedProposalId: varchar('related_proposal_id', { length: 64 }),
    data: json('data').default(sql`'{}'::json`),
    
    // Timestamps
    occurredAt: timestamp('occurred_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.elderId],
      foreignColumns: [elders.id],
    }),
    index('idx_elder_activity_elderId').on(table.elderId),
    index('idx_elder_activity_type').on(table.activityType),
    index('idx_elder_activity_occurredAt').on(table.occurredAt),
  ]
);

/**
 * Agent Activity Logs
 * Tracks operations and messages processed by agents
 */
export const agentLogs = pgTable(
  'agent_logs',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    agentId: varchar('agent_id', { length: 64 }).notNull(),
    
    // Operation details
    action: varchar('action', { length: 255 }).notNull(), // e.g., 'process_proposal', 'scan_threats'
    operationType: varchar('operation_type', { length: 64 }).notNull(), // 'analysis', 'security', 'monitoring'
    description: text('description'),
    
    // Result
    result: varchar('result', { length: 20 }).notNull().default('success'), // 'success', 'error', 'warning', 'pending'
    resultDetails: json('result_details').default(sql`'{}'::json`),
    
    // Performance
    responseTime: integer('response_time').default(0), // in milliseconds
    
    // Related data
    relatedEntityType: varchar('related_entity_type', { length: 64 }), // 'proposal', 'user', 'dao'
    relatedEntityId: varchar('related_entity_id', { length: 64 }),
    
    // Metadata
    metadata: json('metadata').default(sql`'{}'::json`),
    
    // Timestamps
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
    }),
    index('idx_agent_logs_agentId').on(table.agentId),
    index('idx_agent_logs_result').on(table.result),
    index('idx_agent_logs_timestamp').on(table.timestamp),
  ]
);

/**
 * Elder-Agent Interaction
 * Tracks interactions and coordination between Elders and Agents
 */
export const elderAgentInteraction = pgTable(
  'elder_agent_interaction',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    elderId: varchar('elder_id', { length: 64 }).notNull(),
    agentId: varchar('agent_id', { length: 64 }).notNull(),
    
    // Interaction details
    interactionType: varchar('interaction_type', { length: 64 }).notNull(), // 'request', 'response', 'feedback'
    direction: varchar('direction', { length: 20 }).notNull(), // 'elder_to_agent', 'agent_to_elder', 'bidirectional'
    
    // Content
    message: text('message'),
    data: json('data').default(sql`'{}'::json`),
    
    // Status
    status: varchar('status', { length: 20 }).default('completed'), // 'pending', 'completed', 'failed'
    
    // Timestamps
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.elderId],
      foreignColumns: [elders.id],
    }),
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
    }),
    index('idx_elder_agent_elderId').on(table.elderId),
    index('idx_elder_agent_agentId').on(table.agentId),
    index('idx_elder_agent_timestamp').on(table.timestamp),
  ]
);

/**
 * System Configuration
 * Stores system-wide settings for Elders and Agents
 */
export const systemConfiguration = pgTable(
  'system_configuration',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    
    // Configuration sections
    elderSettings: json('elder_settings').notNull().default(sql`'{}'::json`), // Per-elder config
    agentSettings: json('agent_settings').notNull().default(sql`'{}'::json`), // Per-agent config
    systemSettings: json('system_settings').notNull().default(sql`'{}'::json`), // Global settings
    
    // Feature flags
    elderFeatureFlags: json('elder_feature_flags').default(sql`'{}'::json`),
    agentFeatureFlags: json('agent_feature_flags').default(sql`'{}'::json`),
    
    // Version & Tracking
    version: varchar('version', { length: 20 }).default('1.0.0'),
    
    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

/**
 * Performance Metrics Historical
 * Stores historical performance data for analytics
 */
export const performanceMetrics = pgTable(
  'performance_metrics',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    entityType: varchar('entity_type', { length: 20 }).notNull(), // 'elder', 'agent'
    entityId: varchar('entity_id', { length: 64 }).notNull(),
    
    // Metrics
    uptime: numeric('uptime', { precision: 5, scale: 4 }),
    responseTime: integer('response_time'), // ms
    throughput: integer('throughput'), // operations/minute
    errorCount: integer('error_count').default(0),
    successCount: integer('success_count').default(0),
    
    // Additional metrics
    customMetrics: json('custom_metrics').default(sql`'{}'::json`),
    
    // Time period
    recordedAt: timestamp('recorded_at').defaultNow().notNull(),
    periodStart: timestamp('period_start'),
    periodEnd: timestamp('period_end'),
    
    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_metrics_entityType_entityId').on(table.entityType, table.entityId),
    index('idx_metrics_recordedAt').on(table.recordedAt),
  ]
);

/**
 * Relations
 * Define relationships between tables for Drizzle ORM
 */
export const eldersRelations = relations(elders, ({ many }) => ({
  activities: many(elderActivity),
  interactions: many(elderAgentInteraction),
  metrics: many(performanceMetrics),
}));

export const agentsRelations = relations(agents, ({ many }) => ({
  logs: many(agentLogs),
  interactions: many(elderAgentInteraction),
  metrics: many(performanceMetrics),
}));

export const elderActivityRelations = relations(elderActivity, ({ one }) => ({
  elder: one(elders, {
    fields: [elderActivity.elderId],
    references: [elders.id],
  }),
}));

export const agentLogsRelations = relations(agentLogs, ({ one }) => ({
  agent: one(agents, {
    fields: [agentLogs.agentId],
    references: [agents.id],
  }),
}));

export const elderAgentInteractionRelations = relations(elderAgentInteraction, ({ one }) => ({
  elder: one(elders, {
    fields: [elderAgentInteraction.elderId],
    references: [elders.id],
  }),
  agent: one(agents, {
    fields: [elderAgentInteraction.agentId],
    references: [agents.id],
  }),
}));

export const performanceMetricsRelations = relations(performanceMetrics, ({ one }) => ({
  elder: one(elders, {
    fields: [performanceMetrics.entityId],
    references: [elders.id],
  }),
  agent: one(agents, {
    fields: [performanceMetrics.entityId],
    references: [agents.id],
  }),
}));
