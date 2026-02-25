import { db } from '../index';
import { sql } from 'drizzle-orm';

/**
 * Phase 5.3 Advanced Features Service
 * Handles configuration history, templates, scheduled changes, alerts, search, and analytics
 */

// ============================================================================
// CONFIGURATION HISTORY SERVICE
// ============================================================================

export interface ConfigHistoryEntry {
  id: string;
  entityType: string;
  entityId: string;
  versionNumber: number;
  configuration: Record<string, any>;
  previousConfiguration?: Record<string, any>;
  changedFields: string[];
  changeReason?: string;
  changedBy: string;
  changedAt: Date;
  createdAt: Date;
}

/**
 * Record a configuration change in history
 */
export async function recordConfigurationChange(
  entityType: string,
  entityId: string,
  newConfiguration: Record<string, any>,
  previousConfiguration: Record<string, any> | null,
  changedBy: string,
  changeReason?: string
): Promise<ConfigHistoryEntry> {
  // Calculate which fields changed
  const changedFields: string[] = [];
  
  if (previousConfiguration) {
    Object.keys({ ...previousConfiguration, ...newConfiguration }).forEach(key => {
      if (JSON.stringify(previousConfiguration?.[key]) !== JSON.stringify(newConfiguration[key])) {
        changedFields.push(key);
      }
    });
  } else {
    changedFields.push(...Object.keys(newConfiguration));
  }

  // Get current version number
  const lastVersion = await db.execute(
    sql`SELECT COALESCE(MAX(version_number), 0) as max_version FROM configuration_history 
        WHERE entity_type = ${entityType} AND entity_id = ${entityId}`
  );

  const versionNumber = (lastVersion.rows[0]?.max_version || 0) + 1;

  // Insert history entry
  const result = await db.execute(sql`
    INSERT INTO configuration_history 
    (entity_type, entity_id, version_number, configuration, previous_configuration, 
     changed_fields, change_reason, changed_by, changed_at)
    VALUES 
    (${entityType}, ${entityId}, ${versionNumber}, 
     ${JSON.stringify(newConfiguration)}, 
     ${previousConfiguration ? JSON.stringify(previousConfiguration) : null},
     ${changedFields},
     ${changeReason || null}, 
     ${changedBy}, 
     now())
    RETURNING id, entity_type, entity_id, version_number, configuration, 
              previous_configuration, changed_fields, change_reason, changed_by, changed_at, created_at
  `);

  const row = result.rows[0];
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    versionNumber: row.version_number,
    configuration: JSON.parse(row.configuration),
    previousConfiguration: row.previous_configuration ? JSON.parse(row.previous_configuration) : undefined,
    changedFields: row.changed_fields,
    changeReason: row.change_reason,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
    createdAt: row.created_at
  };
}

/**
 * Get configuration history for an entity
 */
export async function getConfigurationHistory(
  entityType: string,
  entityId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ entries: ConfigHistoryEntry[]; total: number }> {
  const [historyResult, countResult] = await Promise.all([
    db.execute(sql`
      SELECT * FROM configuration_history 
      WHERE entity_type = ${entityType} AND entity_id = ${entityId}
      ORDER BY version_number DESC
      LIMIT ${limit} OFFSET ${offset}
    `),
    db.execute(sql`
      SELECT COUNT(*) as total FROM configuration_history 
      WHERE entity_type = ${entityType} AND entity_id = ${entityId}
    `)
  ]);

  const entries = historyResult.rows.map(row => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    versionNumber: row.version_number,
    configuration: JSON.parse(row.configuration),
    previousConfiguration: row.previous_configuration ? JSON.parse(row.previous_configuration) : undefined,
    changedFields: row.changed_fields,
    changeReason: row.change_reason,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
    createdAt: row.created_at
  }));

  return {
    entries,
    total: countResult.rows[0]?.total || 0
  };
}

/**
 * Get a specific version of configuration
 */
export async function getConfigurationVersion(
  entityType: string,
  entityId: string,
  versionNumber: number
): Promise<ConfigHistoryEntry | null> {
  const result = await db.execute(sql`
    SELECT * FROM configuration_history 
    WHERE entity_type = ${entityType} AND entity_id = ${entityId} AND version_number = ${versionNumber}
  `);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    versionNumber: row.version_number,
    configuration: JSON.parse(row.configuration),
    previousConfiguration: row.previous_configuration ? JSON.parse(row.previous_configuration) : undefined,
    changedFields: row.changed_fields,
    changeReason: row.change_reason,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
    createdAt: row.created_at
  };
}

/**
 * Compare two versions of configuration
 */
export async function compareConfigurationVersions(
  entityType: string,
  entityId: string,
  versionA: number,
  versionB: number
): Promise<{
  versionA: ConfigHistoryEntry | null;
  versionB: ConfigHistoryEntry | null;
  differences: Record<string, { from: any; to: any }>;
}> {
  const [configA, configB] = await Promise.all([
    getConfigurationVersion(entityType, entityId, versionA),
    getConfigurationVersion(entityType, entityId, versionB)
  ]);

  const differences: Record<string, { from: any; to: any }> = {};

  if (configA && configB) {
    const allKeys = new Set([
      ...Object.keys(configA.configuration),
      ...Object.keys(configB.configuration)
    ]);

    allKeys.forEach(key => {
      if (JSON.stringify(configA.configuration[key]) !== JSON.stringify(configB.configuration[key])) {
        differences[key] = {
          from: configA.configuration[key],
          to: configB.configuration[key]
        };
      }
    });
  }

  return { versionA: configA, versionB: configB, differences };
}

// ============================================================================
// CONFIGURATION TEMPLATES SERVICE
// ============================================================================

export interface ConfigTemplate {
  id: string;
  name: string;
  description?: string;
  entityType: string;
  specificType?: string;
  configuration: Record<string, any>;
  category?: string;
  isPublic: boolean;
  createdBy: string;
  usageCount: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new configuration template
 */
export async function createConfigTemplate(
  name: string,
  configuration: Record<string, any>,
  entityType: string,
  createdBy: string,
  options?: {
    description?: string;
    specificType?: string;
    category?: string;
    isPublic?: boolean;
    tags?: string[];
  }
): Promise<ConfigTemplate> {
  const result = await db.execute(sql`
    INSERT INTO configuration_templates 
    (name, description, entity_type, specific_type, configuration, category, is_public, 
     created_by, tags)
    VALUES 
    (${name}, ${options?.description || null}, ${entityType}, 
     ${options?.specificType || null}, ${JSON.stringify(configuration)}, 
     ${options?.category || null}, ${options?.isPublic !== false}, 
     ${createdBy}, ${(options?.tags || []).length > 0 ? options?.tags : null})
    RETURNING id, name, description, entity_type, specific_type, configuration, category, 
              is_public, created_by, usage_count, tags, created_at, updated_at
  `);

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    entityType: row.entity_type,
    specificType: row.specific_type,
    configuration: JSON.parse(row.configuration),
    category: row.category,
    isPublic: row.is_public,
    createdBy: row.created_by,
    usageCount: row.usage_count,
    tags: row.tags || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Get all templates for an entity type
 */
export async function getTemplatesByEntityType(
  entityType: string,
  includePrivate: boolean = false,
  specificType?: string
): Promise<ConfigTemplate[]> {
  let query = sql`SELECT * FROM configuration_templates WHERE entity_type = ${entityType}`;
  
  if (!includePrivate) {
    query = sql`SELECT * FROM configuration_templates WHERE entity_type = ${entityType} AND is_public = true`;
  }
  
  if (specificType) {
    query = sql`${query} AND specific_type = ${specificType}`;
  }

  const result = await db.execute(sql`${query} ORDER BY usage_count DESC, updated_at DESC`);

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    entityType: row.entity_type,
    specificType: row.specific_type,
    configuration: JSON.parse(row.configuration),
    category: row.category,
    isPublic: row.is_public,
    createdBy: row.created_by,
    usageCount: row.usage_count,
    tags: row.tags || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

/**
 * Increment template usage count
 */
export async function incrementTemplateUsage(templateId: string): Promise<void> {
  await db.execute(sql`
    UPDATE configuration_templates 
    SET usage_count = usage_count + 1, updated_at = now()
    WHERE id = ${templateId}
  `);
}

/**
 * Delete a template
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  await db.execute(sql`DELETE FROM configuration_templates WHERE id = ${templateId}`);
}

// ============================================================================
// SCHEDULED CHANGES SERVICE
// ============================================================================

export interface ScheduledChange {
  id: string;
  entityType: string;
  entityId: string;
  configuration: Record<string, any>;
  scheduledFor: Date;
  schedule?: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  changeReason?: string;
  executedAt?: Date;
  executionResult?: Record<string, any>;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Schedule a configuration change
 */
export async function scheduleConfigChange(
  entityType: string,
  entityId: string,
  configuration: Record<string, any>,
  scheduledFor: Date,
  createdBy: string,
  changeReason?: string,
  schedule?: string
): Promise<ScheduledChange> {
  const result = await db.execute(sql`
    INSERT INTO scheduled_changes 
    (entity_type, entity_id, configuration, scheduled_for, schedule, 
     change_reason, created_by)
    VALUES 
    (${entityType}, ${entityId}, ${JSON.stringify(configuration)}, 
     ${scheduledFor}, ${schedule || null}, ${changeReason || null}, ${createdBy})
    RETURNING id, entity_type, entity_id, configuration, scheduled_for, schedule, status,
              change_reason, executed_at, execution_result, created_by, approved_by, 
              approved_at, created_at, updated_at
  `);

  const row = result.rows[0];
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    configuration: JSON.parse(row.configuration),
    scheduledFor: row.scheduled_for,
    schedule: row.schedule,
    status: row.status,
    changeReason: row.change_reason,
    executedAt: row.executed_at,
    executionResult: row.execution_result ? JSON.parse(row.execution_result) : undefined,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Approve a scheduled change
 */
export async function approveScheduledChange(
  changeId: string,
  approvedBy: string
): Promise<ScheduledChange | null> {
  const result = await db.execute(sql`
    UPDATE scheduled_changes 
    SET status = 'approved', approved_by = ${approvedBy}, approved_at = now(), updated_at = now()
    WHERE id = ${changeId} AND status = 'pending'
    RETURNING id, entity_type, entity_id, configuration, scheduled_for, schedule, status,
              change_reason, executed_at, execution_result, created_by, approved_by, 
              approved_at, created_at, updated_at
  `);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    configuration: JSON.parse(row.configuration),
    scheduledFor: row.scheduled_for,
    schedule: row.schedule,
    status: row.status,
    changeReason: row.change_reason,
    executedAt: row.executed_at,
    executionResult: row.execution_result ? JSON.parse(row.execution_result) : undefined,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Get pending scheduled changes ready for execution
 */
export async function getPendingScheduledChanges(limit: number = 50): Promise<ScheduledChange[]> {
  const result = await db.execute(sql`
    SELECT * FROM scheduled_changes 
    WHERE status = 'approved' AND scheduled_for <= now()
    ORDER BY scheduled_for ASC
    LIMIT ${limit}
  `);

  return result.rows.map(row => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    configuration: JSON.parse(row.configuration),
    scheduledFor: row.scheduled_for,
    schedule: row.schedule,
    status: row.status,
    changeReason: row.change_reason,
    executedAt: row.executed_at,
    executionResult: row.execution_result ? JSON.parse(row.execution_result) : undefined,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

/**
 * Mark scheduled change as executed
 */
export async function markScheduledChangeExecuted(
  changeId: string,
  executionResult: Record<string, any>
): Promise<ScheduledChange | null> {
  const result = await db.execute(sql`
    UPDATE scheduled_changes 
    SET status = 'executed', executed_at = now(), execution_result = ${JSON.stringify(executionResult)}, 
        updated_at = now()
    WHERE id = ${changeId}
    RETURNING id, entity_type, entity_id, configuration, scheduled_for, schedule, status,
              change_reason, executed_at, execution_result, created_by, approved_by, 
              approved_at, created_at, updated_at
  `);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    configuration: JSON.parse(row.configuration),
    scheduledFor: row.scheduled_for,
    schedule: row.schedule,
    status: row.status,
    changeReason: row.change_reason,
    executedAt: row.executed_at,
    executionResult: row.execution_result ? JSON.parse(row.execution_result) : undefined,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ============================================================================
// CONFIGURATION ALERTS SERVICE
// ============================================================================

export interface ConfigAlert {
  id: string;
  entityType: string;
  entityId: string;
  alertType: string;
  message: string;
  details?: Record<string, any>;
  severity: 'info' | 'warning' | 'error' | 'critical';
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  notificationsSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a configuration alert
 */
export async function createConfigAlert(
  entityType: string,
  entityId: string,
  alertType: string,
  message: string,
  severity: 'info' | 'warning' | 'error' | 'critical' = 'info',
  details?: Record<string, any>
): Promise<ConfigAlert> {
  const result = await db.execute(sql`
    INSERT INTO configuration_alerts 
    (entity_type, entity_id, alert_type, message, severity, details)
    VALUES 
    (${entityType}, ${entityId}, ${alertType}, ${message}, ${severity}, 
     ${details ? JSON.stringify(details) : null})
    RETURNING id, entity_type, entity_id, alert_type, message, details, severity,
              is_resolved, resolved_at, resolved_by, notifications_sent, created_at, updated_at
  `);

  const row = result.rows[0];
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    alertType: row.alert_type,
    message: row.message,
    details: row.details ? JSON.parse(row.details) : undefined,
    severity: row.severity,
    isResolved: row.is_resolved,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    notificationsSent: row.notifications_sent,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Get unresolved alerts
 */
export async function getUnresolvedAlerts(
  entityType?: string,
  limit: number = 50
): Promise<ConfigAlert[]> {
  let query = sql`SELECT * FROM configuration_alerts WHERE is_resolved = false`;
  
  if (entityType) {
    query = sql`SELECT * FROM configuration_alerts WHERE is_resolved = false AND entity_type = ${entityType}`;
  }

  const result = await db.execute(
    sql`${query} ORDER BY severity DESC, created_at DESC LIMIT ${limit}`
  );

  return result.rows.map(row => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    alertType: row.alert_type,
    message: row.message,
    details: row.details ? JSON.parse(row.details) : undefined,
    severity: row.severity,
    isResolved: row.is_resolved,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    notificationsSent: row.notifications_sent,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

/**
 * Resolve an alert
 */
export async function resolveAlert(
  alertId: string,
  resolvedBy: string
): Promise<ConfigAlert | null> {
  const result = await db.execute(sql`
    UPDATE configuration_alerts 
    SET is_resolved = true, resolved_at = now(), resolved_by = ${resolvedBy}, updated_at = now()
    WHERE id = ${alertId}
    RETURNING id, entity_type, entity_id, alert_type, message, details, severity,
              is_resolved, resolved_at, resolved_by, notifications_sent, created_at, updated_at
  `);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    alertType: row.alert_type,
    message: row.message,
    details: row.details ? JSON.parse(row.details) : undefined,
    severity: row.severity,
    isResolved: row.is_resolved,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    notificationsSent: row.notifications_sent,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ============================================================================
// SEARCH PROFILES SERVICE
// ============================================================================

export interface SearchProfile {
  id: string;
  name: string;
  description?: string;
  query: string;
  filters?: Record<string, any>;
  isPublic: boolean;
  createdBy: string;
  usageCount: number;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a search profile
 */
export async function createSearchProfile(
  name: string,
  query: string,
  createdBy: string,
  options?: {
    description?: string;
    filters?: Record<string, any>;
    isPublic?: boolean;
  }
): Promise<SearchProfile> {
  const result = await db.execute(sql`
    INSERT INTO search_profiles 
    (name, description, query, filters, is_public, created_by)
    VALUES 
    (${name}, ${options?.description || null}, ${query}, 
     ${options?.filters ? JSON.stringify(options.filters) : null},
     ${options?.isPublic !== false}, ${createdBy})
    RETURNING id, name, description, query, filters, is_public, created_by, 
              usage_count, last_used_at, created_at, updated_at
  `);

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    query: row.query,
    filters: row.filters ? JSON.parse(row.filters) : undefined,
    isPublic: row.is_public,
    createdBy: row.created_by,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Get search profiles for a user
 */
export async function getSearchProfilesForUser(createdBy: string): Promise<SearchProfile[]> {
  const result = await db.execute(sql`
    SELECT * FROM search_profiles 
    WHERE created_by = ${createdBy} OR is_public = true
    ORDER BY usage_count DESC, updated_at DESC
  `);

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    query: row.query,
    filters: row.filters ? JSON.parse(row.filters) : undefined,
    isPublic: row.is_public,
    createdBy: row.created_by,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

/**
 * Increment search profile usage
 */
export async function incrementSearchProfileUsage(profileId: string): Promise<void> {
  await db.execute(sql`
    UPDATE search_profiles 
    SET usage_count = usage_count + 1, last_used_at = now(), updated_at = now()
    WHERE id = ${profileId}
  `);
}

// ============================================================================
// PERFORMANCE SNAPSHOTS SERVICE
// ============================================================================

export interface PerformanceSnapshot {
  id: string;
  entityType: string;
  entityId: string;
  metrics: Record<string, any>;
  timestamp: Date;
  period?: string;
}

/**
 * Record a performance snapshot
 */
export async function recordPerformanceSnapshot(
  entityType: string,
  entityId: string,
  metrics: Record<string, any>,
  period?: string
): Promise<PerformanceSnapshot> {
  const result = await db.execute(sql`
    INSERT INTO performance_snapshots 
    (entity_type, entity_id, metrics, period)
    VALUES 
    (${entityType}, ${entityId}, ${JSON.stringify(metrics)}, ${period || null})
    RETURNING id, entity_type, entity_id, metrics, timestamp, period
  `);

  const row = result.rows[0];
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metrics: JSON.parse(row.metrics),
    timestamp: row.timestamp,
    period: row.period
  };
}

/**
 * Get performance snapshots for an entity within a time range
 */
export async function getPerformanceSnapshots(
  entityType: string,
  entityId: string,
  startDate: Date,
  endDate: Date
): Promise<PerformanceSnapshot[]> {
  const result = await db.execute(sql`
    SELECT * FROM performance_snapshots 
    WHERE entity_type = ${entityType} AND entity_id = ${entityId}
    AND timestamp >= ${startDate} AND timestamp <= ${endDate}
    ORDER BY timestamp DESC
  `);

  return result.rows.map(row => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metrics: JSON.parse(row.metrics),
    timestamp: row.timestamp,
    period: row.period
  }));
}

// ============================================================================
// ALERT RULES SERVICE
// ============================================================================

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  entityType?: string;
  entityId?: string;
  alertType: string;
  condition: Record<string, any>;
  threshold?: Record<string, any>;
  severity: 'info' | 'warning' | 'error' | 'critical';
  isEnabled: boolean;
  notificationChannels: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create an alert rule
 */
export async function createAlertRule(
  name: string,
  alertType: string,
  condition: Record<string, any>,
  createdBy: string,
  options?: {
    description?: string;
    entityType?: string;
    entityId?: string;
    threshold?: Record<string, any>;
    severity?: 'info' | 'warning' | 'error' | 'critical';
    isEnabled?: boolean;
    notificationChannels?: string[];
  }
): Promise<AlertRule> {
  const result = await db.execute(sql`
    INSERT INTO alert_rules 
    (name, description, entity_type, entity_id, alert_type, condition, threshold, 
     severity, is_enabled, notification_channels, created_by)
    VALUES 
    (${name}, ${options?.description || null}, ${options?.entityType || null}, 
     ${options?.entityId || null}, ${alertType}, ${JSON.stringify(condition)}, 
     ${options?.threshold ? JSON.stringify(options.threshold) : null},
     ${options?.severity || 'info'}, ${options?.isEnabled !== false}, 
     ${(options?.notificationChannels || []).length > 0 ? options?.notificationChannels : null},
     ${createdBy})
    RETURNING id, name, description, entity_type, entity_id, alert_type, condition, 
              threshold, severity, is_enabled, notification_channels, created_by, created_at, updated_at
  `);

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    entityType: row.entity_type,
    entityId: row.entity_id,
    alertType: row.alert_type,
    condition: JSON.parse(row.condition),
    threshold: row.threshold ? JSON.parse(row.threshold) : undefined,
    severity: row.severity,
    isEnabled: row.is_enabled,
    notificationChannels: row.notification_channels || [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Get enabled alert rules
 */
export async function getEnabledAlertRules(entityType?: string): Promise<AlertRule[]> {
  let query = sql`SELECT * FROM alert_rules WHERE is_enabled = true`;
  
  if (entityType) {
    query = sql`SELECT * FROM alert_rules WHERE is_enabled = true AND (entity_type = ${entityType} OR entity_type IS NULL)`;
  }

  const result = await db.execute(query);

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    entityType: row.entity_type,
    entityId: row.entity_id,
    alertType: row.alert_type,
    condition: JSON.parse(row.condition),
    threshold: row.threshold ? JSON.parse(row.threshold) : undefined,
    severity: row.severity,
    isEnabled: row.is_enabled,
    notificationChannels: row.notification_channels || [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

/**
 * Update alert rule
 */
export async function updateAlertRule(
  ruleId: string,
  updates: Partial<AlertRule>
): Promise<AlertRule | null> {
  const setClauses: string[] = [];
  const values: any[] = [];

  if (updates.name) {
    setClauses.push(`name = $${values.length + 1}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    setClauses.push(`description = $${values.length + 1}`);
    values.push(updates.description);
  }
  if (updates.condition) {
    setClauses.push(`condition = $${values.length + 1}`);
    values.push(JSON.stringify(updates.condition));
  }
  if (updates.severity) {
    setClauses.push(`severity = $${values.length + 1}`);
    values.push(updates.severity);
  }
  if (updates.isEnabled !== undefined) {
    setClauses.push(`is_enabled = $${values.length + 1}`);
    values.push(updates.isEnabled);
  }

  if (setClauses.length === 0) return null;

  setClauses.push('updated_at = now()');
  values.push(ruleId);

  const result = await db.execute(sql`
    UPDATE alert_rules 
    SET ${sql.raw(setClauses.join(', '))}
    WHERE id = $${values.length}
    RETURNING id, name, description, entity_type, entity_id, alert_type, condition, 
              threshold, severity, is_enabled, notification_channels, created_by, created_at, updated_at
  `);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    entityType: row.entity_type,
    entityId: row.entity_id,
    alertType: row.alert_type,
    condition: JSON.parse(row.condition),
    threshold: row.threshold ? JSON.parse(row.threshold) : undefined,
    severity: row.severity,
    isEnabled: row.is_enabled,
    notificationChannels: row.notification_channels || [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ============================================================================
// ADVANCED SEARCH SERVICE
// ============================================================================

export interface SearchResult {
  id: string;
  entityType: string;
  entityId: string;
  versionNumber: number;
  configuration: Record<string, any>;
  changedFields: string[];
  changeReason?: string;
  changedBy: string;
  changedAt: Date;
}

/**
 * Search configuration history with advanced filters
 */
export async function searchConfigurationHistory(
  searchQuery: string,
  filters: {
    entityType?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    changedBy?: string;
    changedFields?: string[];
    severity?: string;
  },
  limit: number = 50,
  offset: number = 0
): Promise<{ results: SearchResult[]; total: number }> {
  let query = `SELECT ch.* FROM configuration_history ch WHERE 1=1`;
  const params: any[] = [];
  let paramIndex = 1;

  // Full-text search on change reason
  if (searchQuery.trim()) {
    query += ` AND ch.change_reason ILIKE $${paramIndex}`;
    params.push(`%${searchQuery}%`);
    paramIndex++;
  }

  // Entity filters
  if (filters.entityType) {
    query += ` AND ch.entity_type = $${paramIndex}`;
    params.push(filters.entityType);
    paramIndex++;
  }

  if (filters.entityId) {
    query += ` AND ch.entity_id = $${paramIndex}`;
    params.push(filters.entityId);
    paramIndex++;
  }

  // Date range
  if (filters.startDate) {
    query += ` AND ch.changed_at >= $${paramIndex}`;
    params.push(filters.startDate);
    paramIndex++;
  }

  if (filters.endDate) {
    query += ` AND ch.changed_at <= $${paramIndex}`;
    params.push(filters.endDate);
    paramIndex++;
  }

  // User filter
  if (filters.changedBy) {
    query += ` AND ch.changed_by = $${paramIndex}`;
    params.push(filters.changedBy);
    paramIndex++;
  }

  // Field filter
  if (filters.changedFields && filters.changedFields.length > 0) {
    query += ` AND (`;
    filters.changedFields.forEach((field, idx) => {
      if (idx > 0) query += ` OR `;
      query += `ch.changed_fields @> $${paramIndex}`;
      params.push(JSON.stringify([field]));
      paramIndex++;
    });
    query += `)`;
  }

  // Count total
  const countResult = await db.execute(
    sql`${sql.raw(`SELECT COUNT(*) as total FROM configuration_history ch WHERE 1=1` + 
      query.substring(query.indexOf('WHERE') + 5))}`
  );

  // Get results with pagination
  const result = await db.execute(
    sql`${sql.raw(`${query} ORDER BY ch.changed_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`)}
    `,
    [...params, limit, offset]
  );

  return {
    results: result.rows.map((row: any) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      versionNumber: row.version_number,
      configuration: JSON.parse(row.configuration),
      changedFields: row.changed_fields,
      changeReason: row.change_reason,
      changedBy: row.changed_by,
      changedAt: row.changed_at
    })),
    total: countResult.rows[0]?.total || 0
  };
}

// ============================================================================
// ANALYTICS SERVICE
// ============================================================================

export interface ChangeMetrics {
  totalChanges: number;
  changesLast24h: number;
  changesLast7d: number;
  changesLast30d: number;
  changesPerUser: Record<string, number>;
  mostChangedFields: Array<{ field: string; count: number }>;
  changesByType: Record<string, number>;
  averageChangeFrequency: number;
}

/**
 * Get analytics metrics for configuration changes
 */
export async function getConfigurationAnalytics(
  entityType?: string
): Promise<ChangeMetrics> {
  const baseQuery = entityType
    ? `WHERE entity_type = '${entityType}'`
    : '';

  // Total changes
  const totalResult = await db.execute(
    sql`SELECT COUNT(*) as count FROM configuration_history ${entityType ? sql`WHERE entity_type = ${entityType}` : sql``}`
  );
  const totalChanges = totalResult.rows[0]?.count || 0;

  // Changes by time period
  const last24h = await db.execute(
    sql`SELECT COUNT(*) as count FROM configuration_history 
        WHERE changed_at >= NOW() - INTERVAL '24 hours'
        ${entityType ? sql`AND entity_type = ${entityType}` : sql``}`
  );

  const last7d = await db.execute(
    sql`SELECT COUNT(*) as count FROM configuration_history 
        WHERE changed_at >= NOW() - INTERVAL '7 days'
        ${entityType ? sql`AND entity_type = ${entityType}` : sql``}`
  );

  const last30d = await db.execute(
    sql`SELECT COUNT(*) as count FROM configuration_history 
        WHERE changed_at >= NOW() - INTERVAL '30 days'
        ${entityType ? sql`AND entity_type = ${entityType}` : sql``}`
  );

  // Changes per user
  const perUserResult = await db.execute(
    sql`SELECT changed_by, COUNT(*) as count FROM configuration_history 
        ${entityType ? sql`WHERE entity_type = ${entityType}` : sql``}
        GROUP BY changed_by ORDER BY count DESC LIMIT 10`
  );

  const changesPerUser: Record<string, number> = {};
  perUserResult.rows.forEach((row: any) => {
    changesPerUser[row.changed_by] = row.count;
  });

  // Most changed fields
  const fieldsResult = await db.execute(
    sql`WITH field_counts AS (
          SELECT unnest(changed_fields) as field FROM configuration_history
          ${entityType ? sql`WHERE entity_type = ${entityType}` : sql``}
        )
        SELECT field, COUNT(*) as count FROM field_counts 
        GROUP BY field ORDER BY count DESC LIMIT 10`
  );

  const mostChangedFields = fieldsResult.rows.map((row: any) => ({
    field: row.field,
    count: row.count
  }));

  // Changes by type
  const typeResult = await db.execute(
    sql`SELECT entity_type, COUNT(*) as count FROM configuration_history 
        GROUP BY entity_type`
  );

  const changesByType: Record<string, number> = {};
  typeResult.rows.forEach((row: any) => {
    changesByType[row.entity_type] = row.count;
  });

  // Average change frequency (changes per day in last 30 days)
  const averageChangeFrequency = totalChanges > 0 ? totalChanges / 30 : 0;

  return {
    totalChanges,
    changesLast24h: last24h.rows[0]?.count || 0,
    changesLast7d: last7d.rows[0]?.count || 0,
    changesLast30d: last30d.rows[0]?.count || 0,
    changesPerUser,
    mostChangedFields,
    changesByType,
    averageChangeFrequency
  };
}

/**
 * Get performance trend data
 */
export async function getPerformanceTrends(
  entityType: string,
  entityId: string,
  days: number = 30
): Promise<Array<{ date: string; metrics: Record<string, number> }>> {
  const result = await db.execute(
    sql`SELECT 
          DATE(timestamp) as date,
          jsonb_object_agg(period, metrics) as metrics_by_period
        FROM performance_snapshots
        WHERE entity_type = ${entityType}
          AND entity_id = ${entityId}
          AND timestamp >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(timestamp)
        ORDER BY date DESC`
  );

  return result.rows.map((row: any) => ({
    date: row.date,
    metrics: row.metrics_by_period || {}
  }));
}
