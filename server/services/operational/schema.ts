/**
 * Drizzle Schema Extensions for Operational Framework
 * Add these tables to shared/schema.ts
 * 
 * These extensions provide persistent storage for:
 * - Audit trail (immutable events)
 * - System topology snapshots
 * - Architecture validation reports
 * - Remediation actions
 * - Drift detections
 */

import { pgTable, text, timestamp, serial, integer, boolean, jsonb, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// ============================================================================
// AUDIT EVENTS TABLE
// ============================================================================

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey(),
  timestamp: timestamp('timestamp').notNull(),
  action: text('action').notNull(), // AuditActionType enum
  actor: text('actor').notNull(),
  targetService: uuid('target_service'),
  targetResource: text('target_resource'),

  // State transition
  previousState: jsonb('previous_state'),
  newState: jsonb('new_state'),

  // Integrity chain
  eventHash: text('event_hash').notNull().unique(),
  previousEventHash: text('previous_event_hash'),

  // Metadata
  description: text('description'),
  metadata: jsonb('metadata'),

  // Approval workflow
  requiresApproval: boolean('requires_approval').default(false).notNull(),
  approvedBy: text('approved_by'),
  approvalTimestamp: timestamp('approval_timestamp'),

  // Indexes for querying
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertAuditEventSchema = createInsertSchema(auditEvents);
export const selectAuditEventSchema = createSelectSchema(auditEvents);

export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;
export type SelectAuditEvent = z.infer<typeof selectAuditEventSchema>;

// ============================================================================
// SYSTEM TOPOLOGY TABLE
// Snapshots of discovered services and their relationships
// ============================================================================

export const systemTopology = pgTable('system_topology', {
  id: uuid('id').primaryKey(),
  version: text('version').notNull(), // ISO timestamp version
  capturedAt: timestamp('captured_at').notNull(),

  // Service snapshot
  servicesData: jsonb('services_data').notNull(),

  // Dependencies
  dependenciesData: jsonb('dependencies_data').notNull(),

  // Privilege matrix
  privilegeMatrix: jsonb('privilege_matrix').notNull(),

  // Topology hash for change detection
  topologyHash: text('topology_hash').notNull(),
  previousTopologyHash: text('previous_topology_hash'),
  changesSinceLastCapture: jsonb('changes_since_last_capture'),

  // Metadata
  metadata: jsonb('metadata'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertSystemTopologySchema = createInsertSchema(systemTopology);
export const selectSystemTopologySchema = createSelectSchema(systemTopology);

export type InsertSystemTopology = z.infer<typeof insertSystemTopologySchema>;
export type SelectSystemTopology = z.infer<typeof selectSystemTopologySchema>;

// ============================================================================
// ARCHITECTURE GAPS TABLE
// Detected issues and inconsistencies
// ============================================================================

export const architectureGaps = pgTable('architecture_gaps', {
  id: uuid('id').primaryKey(),
  detectedAt: timestamp('detected_at').notNull(),

  category: text('category').notNull(), // Gap category
  severity: text('severity').notNull(), // critical | warning | info
  affectedServices: jsonb('affected_services').notNull(), // Array of service IDs

  description: text('description').notNull(),
  impact: text('impact').notNull(),
  suggestedRemediation: text('suggested_remediation').notNull(),

  resolved: boolean('resolved').default(false).notNull(),
  resolvedAt: timestamp('resolved_at'),

  metadata: jsonb('metadata'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertArchitectureGapSchema = createInsertSchema(architectureGaps);
export const selectArchitectureGapSchema = createSelectSchema(architectureGaps);

export type InsertArchitectureGap = z.infer<typeof insertArchitectureGapSchema>;
export type SelectArchitectureGap = z.infer<typeof selectArchitectureGapSchema>;

// ============================================================================
// REMEDIATION ACTIONS TABLE
// Track and audit all remediation operations
// ============================================================================

export const remediationActions = pgTable('remediation_actions', {
  id: uuid('id').primaryKey(),

  remediationType: text('remediation_type').notNull(),
  targetServiceId: uuid('target_service_id').notNull(),
  gapId: uuid('gap_id').notNull(),

  // Execution control
  requiresApproval: boolean('requires_approval').notNull(),
  executionMode: text('execution_mode').notNull(), // pending | approved | emergency
  estimatedDuration: integer('estimated_duration'), // milliseconds

  // Status
  status: text('status').notNull(), // pending | executing | completed | failed | rolled_back
  initiatedBy: text('initiated_by').notNull(),
  initiatedAt: timestamp('initiated_at').notNull(),
  completedAt: timestamp('completed_at'),

  // Results
  success: boolean('success').notNull().default(false),
  output: text('output'),
  errorMessage: text('error_message'),

  // Rate limiting data
  previousAttemptsIn24h: integer('previous_attempts_in_24h').notNull(),
  maxAttemptsAllowedIn24h: integer('max_attempts_allowed_in_24h').notNull(),

  metadata: jsonb('metadata'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertRemediationActionSchema = createInsertSchema(remediationActions);
export const selectRemediationActionSchema = createSelectSchema(remediationActions);

export type InsertRemediationAction = z.infer<typeof insertRemediationActionSchema>;
export type SelectRemediationAction = z.infer<typeof selectRemediationActionSchema>;

// ============================================================================
// DRIFT DETECTIONS TABLE
// Hardcoded secrets, missing credentials, configuration drift
// ============================================================================

export const driftDetections = pgTable('drift_detections', {
  id: uuid('id').primaryKey(),
  detectedAt: timestamp('detected_at').notNull(),

  type: text('type').notNull(), // hardcoded_secret | missing_credential | expired_credential | unused_credential
  location: text('location').notNull(), // File path or service name
  severity: text('severity').notNull(), // critical | high | medium | low

  remediation: text('remediation').notNull(),
  resolved: boolean('resolved').default(false).notNull(),

  metadata: jsonb('metadata'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertDriftDetectionSchema = createInsertSchema(driftDetections);
export const selectDriftDetectionSchema = createSelectSchema(driftDetections);

export type InsertDriftDetection = z.infer<typeof insertDriftDetectionSchema>;
export type SelectDriftDetection = z.infer<typeof selectDriftDetectionSchema>;

// ============================================================================
// OPERATIONAL STATE SNAPSHOTS
// Store periodic snapshots for diagnostics and forensics
// ============================================================================

export const operationalStateSnapshots = pgTable('operational_state_snapshots', {
  id: uuid('id').primaryKey(),
  timestamp: timestamp('timestamp').notNull(),

  // Overall health
  overallHealth: text('overall_health').notNull(), // healthy | degraded | critical

  // Service statistics
  totalServices: integer('total_services').notNull(),
  healthyServices: integer('healthy_services').notNull(),
  degradedServices: integer('degraded_services').notNull(),
  offlineServices: integer('offline_services').notNull(),

  // Dependency statistics
  totalDependencies: integer('total_dependencies').notNull(),
  brokenDependencies: integer('broken_dependencies').notNull(),

  // Alerts
  criticalAlerts: jsonb('critical_alerts').notNull(), // Array of alert strings
  warningAlerts: jsonb('warning_alerts').notNull(), // Array of alert strings

  // Full state snapshot (for forensics)
  stateSnapshot: jsonb('state_snapshot').notNull(),

  metadata: jsonb('metadata'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertOperationalStateSnapshotSchema = createInsertSchema(operationalStateSnapshots);
export const selectOperationalStateSnapshotSchema = createSelectSchema(operationalStateSnapshots);

export type InsertOperationalStateSnapshot = z.infer<typeof insertOperationalStateSnapshotSchema>;
export type SelectOperationalStateSnapshot = z.infer<typeof selectOperationalStateSnapshotSchema>;

// ============================================================================
// VALIDATION REPORTS TABLE
// Store architecture validation reports
// ============================================================================

export const validationReports = pgTable('validation_reports', {
  id: uuid('id').primaryKey(),
  generatedAt: timestamp('generated_at').notNull(),

  // Health status
  healthStatus: text('health_status').notNull(), // healthy | degraded | critical

  // Statistics
  totalServices: integer('total_services').notNull(),
  healthyServices: integer('healthy_services').notNull(),
  degradedServices: integer('degraded_services').notNull(),
  offlineServices: integer('offline_services').notNull(),
  totalGaps: integer('total_gaps').notNull(),
  criticalGaps: integer('critical_gaps').notNull(),
  warningGaps: integer('warning_gaps').notNull(),

  // Report data
  reportData: jsonb('report_data').notNull(),
  recommendations: jsonb('recommendations').notNull(), // Array of recommendation strings

  metadata: jsonb('metadata'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertValidationReportSchema = createInsertSchema(validationReports);
export const selectValidationReportSchema = createSelectSchema(validationReports);

export type InsertValidationReport = z.infer<typeof insertValidationReportSchema>;
export type SelectValidationReport = z.infer<typeof selectValidationReportSchema>;

// ============================================================================
// INDEXED QUERIES HELPER
// ============================================================================

export const schemaExtensions = {
  auditEvents,
  systemTopology,
  architectureGaps,
  remediationActions,
  driftDetections,
  operationalStateSnapshots,
  validationReports,
};

// Export all types
export type {
  InsertAuditEvent,
  SelectAuditEvent,
  InsertSystemTopology,
  SelectSystemTopology,
  InsertArchitectureGap,
  SelectArchitectureGap,
  InsertRemediationAction,
  SelectRemediationAction,
  InsertDriftDetection,
  SelectDriftDetection,
  InsertOperationalStateSnapshot,
  SelectOperationalStateSnapshot,
  InsertValidationReport,
  SelectValidationReport,
};
