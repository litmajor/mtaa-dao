
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import type { QueryResult } from 'pg';

// Typed service for advanced agents/elders features.
// Implementations use properly typed QueryResult rows from Postgres.

// -------------------- Types --------------------
export interface ConfigHistoryEntry {
  id: string;
  entityType: string;
  entityId: string;
  versionNumber: number;
  configuration: Record<string, unknown>;
  previousConfiguration?: Record<string, unknown>;
  changedFields: string[];
  changeReason?: string;
  changedBy: string;
  changedAt: Date;
  createdAt: Date;
}

export interface ConfigTemplate {
  id: string;
  name: string;
  description?: string;
  entityType: string;
  specificType?: string;
  configuration: Record<string, unknown>;
  category?: string;
  isPublic: boolean;
  createdBy: string;
  usageCount: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledChange {
  id: string;
  entityType: string;
  entityId: string;
  configuration: Record<string, unknown>;
  scheduledFor: Date;
  schedule?: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  changeReason?: string;
  executedAt?: Date;
  executionResult?: Record<string, unknown>;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConfigAlert {
  id: string;
  entityType: string;
  entityId: string;
  alertType: string;
  message: string;
  details?: Record<string, unknown>;
  severity: 'info' | 'warning' | 'error' | 'critical';
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  notificationsSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchProfile {
  id: string;
  name: string;
  description?: string;
  query: string;
  filters?: Record<string, unknown>;
  isPublic: boolean;
  createdBy: string;
  usageCount: number;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PerformanceSnapshot {
  id: string;
  entityType: string;
  entityId: string;
  metrics: Record<string, unknown>;
  timestamp: Date;
  period?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  entityType?: string;
  entityId?: string;
  alertType: string;
  condition: Record<string, unknown>;
  threshold?: Record<string, unknown>;
  severity: 'info' | 'warning' | 'error' | 'critical';
  isEnabled: boolean;
  notificationChannels: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

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

// -------------------- Helpers --------------------
function parseJsonIfString<T>(value: unknown): T {
  if (typeof value === 'string') return JSON.parse(value) as T;
  return value as T;
}

// -------------------- Implementation --------------------
export async function recordConfigurationChange(
  entityType: string,
  entityId: string,
  newConfiguration: Record<string, unknown>,
  previousConfiguration: Record<string, unknown> | null,
  changedBy: string,
  changeReason?: string
): Promise<ConfigHistoryEntry> {
  const changedFields: string[] = [];
  if (previousConfiguration) {
    const keys = new Set([...Object.keys(previousConfiguration), ...Object.keys(newConfiguration)]);
    for (const key of keys) {
      const prev = (previousConfiguration as any)[key];
      const cur = (newConfiguration as any)[key];
      if (JSON.stringify(prev) !== JSON.stringify(cur)) changedFields.push(key);
    }
  } else {
    changedFields.push(...Object.keys(newConfiguration));
  }

  const lastVersionResult = (await db.execute(sql`
    SELECT COALESCE(MAX(version_number), 0) as max_version FROM configuration_history
    WHERE entity_type = ${entityType} AND entity_id = ${entityId}
  `)) as QueryResult<{ max_version: number }>;

  const versionNumber = Number(lastVersionResult.rows[0]?.max_version ?? 0) + 1;

  const insertResult = (await db.execute(sql`
    INSERT INTO configuration_history
      (entity_type, entity_id, version_number, configuration, previous_configuration, changed_fields, change_reason, changed_by, changed_at)
    VALUES
      (${entityType}, ${entityId}, ${versionNumber}, ${JSON.stringify(newConfiguration)}, ${previousConfiguration ? JSON.stringify(previousConfiguration) : null}, ${changedFields}, ${changeReason ?? null}, ${changedBy}, now())
    RETURNING id, entity_type, entity_id, version_number, configuration, previous_configuration, changed_fields, change_reason, changed_by, changed_at, created_at
  `)) as QueryResult<Record<string, unknown>>;

  const row = insertResult.rows[0];
  return {
    id: String(row.id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    versionNumber: Number(row.version_number),
    configuration: parseJsonIfString<Record<string, unknown>>(row.configuration),
    previousConfiguration: row.previous_configuration ? parseJsonIfString<Record<string, unknown>>(row.previous_configuration) : undefined,
    changedFields: (row.changed_fields as unknown) as string[],
    changeReason: (row.change_reason as unknown) as string | undefined,
    changedBy: String(row.changed_by),
    changedAt: (row.changed_at as unknown) as Date,
    createdAt: (row.created_at as unknown) as Date,
  };
}

export async function getConfigurationHistory(
  entityType: string,
  entityId: string,
  limit = 50,
  offset = 0
): Promise<{ entries: ConfigHistoryEntry[]; total: number }> {
  const historyResult = (await db.execute(sql`
    SELECT * FROM configuration_history
    WHERE entity_type = ${entityType} AND entity_id = ${entityId}
    ORDER BY version_number DESC
    LIMIT ${limit} OFFSET ${offset}
  `)) as QueryResult<Record<string, unknown>>;

  const countResult = (await db.execute(sql`
    SELECT COUNT(*) as total FROM configuration_history
    WHERE entity_type = ${entityType} AND entity_id = ${entityId}
  `)) as QueryResult<{ total: number }>;

  const entries: ConfigHistoryEntry[] = historyResult.rows.map((row) => ({
    id: String(row.id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    versionNumber: Number(row.version_number),
    configuration: parseJsonIfString<Record<string, unknown>>(row.configuration),
    previousConfiguration: row.previous_configuration ? parseJsonIfString<Record<string, unknown>>(row.previous_configuration) : undefined,
    changedFields: (row.changed_fields as unknown) as string[],
    changeReason: (row.change_reason as unknown) as string | undefined,
    changedBy: String(row.changed_by),
    changedAt: (row.changed_at as unknown) as Date,
    createdAt: (row.created_at as unknown) as Date,
  }));

  return { entries, total: Number(countResult.rows[0]?.total ?? 0) };
}

export async function getConfigurationVersion(
  entityType: string,
  entityId: string,
  versionNumber: number
): Promise<ConfigHistoryEntry | null> {
  const result = (await db.execute(sql`
    SELECT * FROM configuration_history
    WHERE entity_type = ${entityType} AND entity_id = ${entityId} AND version_number = ${versionNumber}
  `)) as QueryResult<Record<string, unknown>>;

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: String(row.id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    versionNumber: Number(row.version_number),
    configuration: parseJsonIfString<Record<string, unknown>>(row.configuration),
    previousConfiguration: row.previous_configuration ? parseJsonIfString<Record<string, unknown>>(row.previous_configuration) : undefined,
    changedFields: (row.changed_fields as unknown) as string[],
    changeReason: (row.change_reason as unknown) as string | undefined,
    changedBy: String(row.changed_by),
    changedAt: (row.changed_at as unknown) as Date,
    createdAt: (row.created_at as unknown) as Date,
  };
}

export async function createConfigTemplate(
  name: string,
  configuration: Record<string, unknown>,
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
  const insert = (await db.execute(sql`
    INSERT INTO configuration_templates (name, description, entity_type, specific_type, configuration, category, is_public, created_by, tags)
    VALUES (${name}, ${options?.description ?? null}, ${entityType}, ${options?.specificType ?? null}, ${JSON.stringify(configuration)}, ${options?.category ?? null}, ${options?.isPublic !== false}, ${createdBy}, ${options?.tags ?? null})
    RETURNING id, name, description, entity_type, specific_type, configuration, category, is_public, created_by, usage_count, tags, created_at, updated_at
  `)) as QueryResult<Record<string, unknown>>;

  const row = insert.rows[0];
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description as string | undefined,
    entityType: String(row.entity_type),
    specificType: row.specific_type as string | undefined,
    configuration: parseJsonIfString<Record<string, unknown>>(row.configuration),
    category: row.category as string | undefined,
    isPublic: Boolean(row.is_public),
    createdBy: String(row.created_by),
    usageCount: Number(row.usage_count ?? 0),
    tags: (row.tags as unknown) as string[] ?? [],
    createdAt: (row.created_at as unknown) as Date,
    updatedAt: (row.updated_at as unknown) as Date,
  };
}

export async function getTemplatesByEntityType(
  entityType: string,
  includePrivate = false,
  specificType?: string
): Promise<ConfigTemplate[]> {
  let query = `SELECT * FROM configuration_templates WHERE entity_type = $1`;
  const params: unknown[] = [entityType];
  if (!includePrivate) query = `SELECT * FROM configuration_templates WHERE entity_type = $1 AND is_public = true`;
  if (specificType) {
    query += ` AND specific_type = $${params.length + 1}`;
    params.push(specificType);
  }
  query += ` ORDER BY usage_count DESC, updated_at DESC`;

  const result = (await db.execute((sql.raw as any)(query, ...(params as any[])))) as QueryResult<Record<string, unknown>>;
  return result.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    description: row.description as string | undefined,
    entityType: String(row.entity_type),
    specificType: row.specific_type as string | undefined,
    configuration: parseJsonIfString<Record<string, unknown>>(row.configuration),
    category: row.category as string | undefined,
    isPublic: Boolean(row.is_public),
    createdBy: String(row.created_by),
    usageCount: Number(row.usage_count ?? 0),
    tags: (row.tags as unknown) as string[] ?? [],
    createdAt: (row.created_at as unknown) as Date,
    updatedAt: (row.updated_at as unknown) as Date,
  }));
}

export async function incrementTemplateUsage(templateId: string): Promise<void> {
  await db.execute(sql`UPDATE configuration_templates SET usage_count = usage_count + 1, updated_at = now() WHERE id = ${templateId}`);
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await db.execute(sql`DELETE FROM configuration_templates WHERE id = ${templateId}`);
}

export async function scheduleConfigChange(
  entityType: string,
  entityId: string,
  configuration: Record<string, unknown>,
  scheduledFor: Date,
  createdBy: string,
  changeReason?: string,
  schedule?: string
): Promise<ScheduledChange> {
  const insert = (await db.execute(sql`
    INSERT INTO scheduled_changes (entity_type, entity_id, configuration, scheduled_for, schedule, change_reason, created_by)
    VALUES (${entityType}, ${entityId}, ${JSON.stringify(configuration)}, ${scheduledFor}, ${schedule ?? null}, ${changeReason ?? null}, ${createdBy})
    RETURNING id, entity_type, entity_id, configuration, scheduled_for, schedule, status, change_reason, executed_at, execution_result, created_by, approved_by, approved_at, created_at, updated_at
  `)) as QueryResult<Record<string, unknown>>;

  const row = insert.rows[0];
  return {
    id: String(row.id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    configuration: parseJsonIfString<Record<string, unknown>>(row.configuration),
    scheduledFor: (row.scheduled_for as unknown) as Date,
    schedule: row.schedule as string | undefined,
    status: row.status as any,
    changeReason: row.change_reason as string | undefined,
    executedAt: row.executed_at as Date | undefined,
    executionResult: row.execution_result ? parseJsonIfString<Record<string, unknown>>(row.execution_result) : undefined,
    createdBy: String(row.created_by),
    approvedBy: row.approved_by as string | undefined,
    approvedAt: row.approved_at as Date | undefined,
    createdAt: (row.created_at as unknown) as Date,
    updatedAt: (row.updated_at as unknown) as Date,
  };
}

export async function approveScheduledChange(changeId: string, approvedBy: string): Promise<ScheduledChange | null> {
  const result = (await db.execute(sql`
    UPDATE scheduled_changes SET status = 'approved', approved_by = ${approvedBy}, approved_at = now(), updated_at = now()
    WHERE id = ${changeId} AND status = 'pending'
    RETURNING id, entity_type, entity_id, configuration, scheduled_for, schedule, status, change_reason, executed_at, execution_result, created_by, approved_by, approved_at, created_at, updated_at
  `)) as QueryResult<Record<string, unknown>>;
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: String(row.id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    configuration: parseJsonIfString<Record<string, unknown>>(row.configuration),
    scheduledFor: (row.scheduled_for as unknown) as Date,
    schedule: row.schedule as string | undefined,
    status: row.status as any,
    changeReason: row.change_reason as string | undefined,
    executedAt: row.executed_at as Date | undefined,
    executionResult: row.execution_result ? parseJsonIfString<Record<string, unknown>>(row.execution_result) : undefined,
    createdBy: String(row.created_by),
    approvedBy: row.approved_by as string | undefined,
    approvedAt: row.approved_at as Date | undefined,
    createdAt: (row.created_at as unknown) as Date,
    updatedAt: (row.updated_at as unknown) as Date,
  };
}

export async function getPendingScheduledChanges(limit = 50): Promise<ScheduledChange[]> {
  const result = (await db.execute(sql`
    SELECT * FROM scheduled_changes WHERE status = 'approved' AND scheduled_for <= now() ORDER BY scheduled_for ASC LIMIT ${limit}
  `)) as QueryResult<Record<string, unknown>>;
  return result.rows.map((row) => ({
    id: String(row.id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    configuration: parseJsonIfString<Record<string, unknown>>(row.configuration),
    scheduledFor: (row.scheduled_for as unknown) as Date,
    schedule: row.schedule as string | undefined,
    status: row.status as any,
    changeReason: row.change_reason as string | undefined,
    executedAt: row.executed_at as Date | undefined,
    executionResult: row.execution_result ? parseJsonIfString<Record<string, unknown>>(row.execution_result) : undefined,
    createdBy: String(row.created_by),
    approvedBy: row.approved_by as string | undefined,
    approvedAt: row.approved_at as Date | undefined,
    createdAt: (row.created_at as unknown) as Date,
    updatedAt: (row.updated_at as unknown) as Date,
  }));
}

export async function markScheduledChangeExecuted(changeId: string, executionResult: Record<string, unknown>): Promise<ScheduledChange | null> {
  const result = (await db.execute(sql`
    UPDATE scheduled_changes SET status = 'executed', executed_at = now(), execution_result = ${JSON.stringify(executionResult)}, updated_at = now() WHERE id = ${changeId} RETURNING id, entity_type, entity_id, configuration, scheduled_for, schedule, status, change_reason, executed_at, execution_result, created_by, approved_by, approved_at, created_at, updated_at
  `)) as QueryResult<Record<string, unknown>>;
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: String(row.id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    configuration: parseJsonIfString<Record<string, unknown>>(row.configuration),
    scheduledFor: (row.scheduled_for as unknown) as Date,
    schedule: row.schedule as string | undefined,
    status: row.status as any,
    changeReason: row.change_reason as string | undefined,
    executedAt: row.executed_at as Date | undefined,
    executionResult: row.execution_result ? parseJsonIfString<Record<string, unknown>>(row.execution_result) : undefined,
    createdBy: String(row.created_by),
    approvedBy: row.approved_by as string | undefined,
    approvedAt: row.approved_at as Date | undefined,
    createdAt: (row.created_at as unknown) as Date,
    updatedAt: (row.updated_at as unknown) as Date,
  };
}

export async function createConfigAlert(
  entityType: string,
  entityId: string,
  alertType: string,
  message: string,
  severity: 'info' | 'warning' | 'error' | 'critical' = 'info',
  details?: Record<string, unknown>
): Promise<ConfigAlert> {
  const result = (await db.execute(sql`
    INSERT INTO configuration_alerts (entity_type, entity_id, alert_type, message, severity, details)
    VALUES (${entityType}, ${entityId}, ${alertType}, ${message}, ${severity}, ${details ? JSON.stringify(details) : null})
    RETURNING id, entity_type, entity_id, alert_type, message, details, severity, is_resolved, resolved_at, resolved_by, notifications_sent, created_at, updated_at
  `)) as QueryResult<Record<string, unknown>>;
  const row = result.rows[0];
  return {
    id: String(row.id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    alertType: String(row.alert_type),
    message: String(row.message),
    details: row.details ? parseJsonIfString<Record<string, unknown>>(row.details) : undefined,
    severity: row.severity as 'info' | 'warning' | 'error' | 'critical',
    isResolved: Boolean(row.is_resolved),
    resolvedAt: row.resolved_at as Date | undefined,
    resolvedBy: row.resolved_by as string | undefined,
    notificationsSent: Boolean(row.notifications_sent),
    createdAt: (row.created_at as unknown) as Date,
    updatedAt: (row.updated_at as unknown) as Date,
  };
}

export async function getUnresolvedAlerts(entityType?: string, limit = 50): Promise<ConfigAlert[]> {
  let query = `SELECT * FROM configuration_alerts WHERE is_resolved = false`;
  const params: unknown[] = [];
  if (entityType) {
    query += ` AND entity_type = $1`;
    params.push(entityType);
  }
  query += ` ORDER BY severity DESC, created_at DESC LIMIT ${limit}`;
  const result = (await db.execute((sql.raw as any)(query, ...(params as any[])))) as QueryResult<Record<string, unknown>>;
  return result.rows.map((row) => ({
    id: String(row.id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    alertType: String(row.alert_type),
    message: String(row.message),
    details: row.details ? parseJsonIfString<Record<string, unknown>>(row.details) : undefined,
    severity: row.severity as 'info' | 'warning' | 'error' | 'critical',
    isResolved: Boolean(row.is_resolved),
    resolvedAt: row.resolved_at as Date | undefined,
    resolvedBy: row.resolved_by as string | undefined,
    notificationsSent: Boolean(row.notifications_sent),
    createdAt: (row.created_at as unknown) as Date,
    updatedAt: (row.updated_at as unknown) as Date,
  }));
}

export async function createSearchProfile(
  name: string,
  queryStr: string,
  createdBy: string,
  options?: { description?: string; filters?: Record<string, unknown>; isPublic?: boolean }
): Promise<SearchProfile> {
  const result = (await db.execute(sql`
    INSERT INTO search_profiles (name, description, query, filters, is_public, created_by)
    VALUES (${name}, ${options?.description ?? null}, ${queryStr}, ${options?.filters ? JSON.stringify(options.filters) : null}, ${options?.isPublic !== false}, ${createdBy})
    RETURNING id, name, description, query, filters, is_public, created_by, usage_count, last_used_at, created_at, updated_at
  `)) as QueryResult<Record<string, unknown>>;
  const row = result.rows[0];
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description as string | undefined,
    query: String(row.query),
    filters: row.filters ? parseJsonIfString<Record<string, unknown>>(row.filters) : undefined,
    isPublic: Boolean(row.is_public),
    createdBy: String(row.created_by),
    usageCount: Number(row.usage_count ?? 0),
    lastUsedAt: row.last_used_at as Date | undefined,
    createdAt: (row.created_at as unknown) as Date,
    updatedAt: (row.updated_at as unknown) as Date,
  };
}

export async function getSearchProfilesForUser(createdBy: string): Promise<SearchProfile[]> {
  const result = (await db.execute(sql`
    SELECT * FROM search_profiles WHERE created_by = ${createdBy} OR is_public = true ORDER BY usage_count DESC, updated_at DESC
  `)) as QueryResult<Record<string, unknown>>;
  return result.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    description: row.description as string | undefined,
    query: String(row.query),
    filters: row.filters ? parseJsonIfString<Record<string, unknown>>(row.filters) : undefined,
    isPublic: Boolean(row.is_public),
    createdBy: String(row.created_by),
    usageCount: Number(row.usage_count ?? 0),
    lastUsedAt: row.last_used_at as Date | undefined,
    createdAt: (row.created_at as unknown) as Date,
    updatedAt: (row.updated_at as unknown) as Date,
  }));
}

export async function incrementSearchProfileUsage(profileId: string): Promise<void> {
  await db.execute(sql`UPDATE search_profiles SET usage_count = usage_count + 1, last_used_at = now(), updated_at = now() WHERE id = ${profileId}`);
}

export async function recordPerformanceSnapshot(
  entityType: string,
  entityId: string,
  metrics: Record<string, unknown>,
  period?: string
): Promise<PerformanceSnapshot> {
  const result = (await db.execute(sql`
    INSERT INTO performance_snapshots (entity_type, entity_id, metrics, period)
    VALUES (${entityType}, ${entityId}, ${JSON.stringify(metrics)}, ${period ?? null})
    RETURNING id, entity_type, entity_id, metrics, timestamp, period
  `)) as QueryResult<Record<string, unknown>>;
  const row = result.rows[0];
  return {
    id: String(row.id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    metrics: parseJsonIfString<Record<string, unknown>>(row.metrics),
    timestamp: (row.timestamp as unknown) as Date,
    period: row.period as string | undefined,
  };
}

export async function getPerformanceSnapshots(
  entityType: string,
  entityId: string,
  startDate: Date,
  endDate: Date
): Promise<PerformanceSnapshot[]> {
  const result = (await db.execute(sql`
    SELECT * FROM performance_snapshots WHERE entity_type = ${entityType} AND entity_id = ${entityId} AND timestamp >= ${startDate} AND timestamp <= ${endDate} ORDER BY timestamp DESC
  `)) as QueryResult<Record<string, unknown>>;
  return result.rows.map((row) => ({
    id: String(row.id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    metrics: parseJsonIfString<Record<string, unknown>>(row.metrics),
    timestamp: (row.timestamp as unknown) as Date,
    period: row.period as string | undefined,
  }));
}

export async function createAlertRule(
  name: string,
  alertType: string,
  condition: Record<string, unknown>,
  createdBy: string,
  options?: { description?: string; entityType?: string; entityId?: string; threshold?: Record<string, unknown>; severity?: AlertRule['severity']; isEnabled?: boolean; notificationChannels?: string[] }
): Promise<AlertRule> {
  const result = (await db.execute(sql`
    INSERT INTO alert_rules (name, description, entity_type, entity_id, alert_type, condition, threshold, severity, is_enabled, notification_channels, created_by)
    VALUES (${name}, ${options?.description ?? null}, ${options?.entityType ?? null}, ${options?.entityId ?? null}, ${alertType}, ${JSON.stringify(condition)}, ${options?.threshold ? JSON.stringify(options.threshold) : null}, ${options?.severity ?? 'info'}, ${options?.isEnabled !== false}, ${options?.notificationChannels ?? null}, ${createdBy})
    RETURNING id, name, description, entity_type, entity_id, alert_type, condition, threshold, severity, is_enabled, notification_channels, created_by, created_at, updated_at
  `)) as QueryResult<Record<string, unknown>>;
  const row = result.rows[0];
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description as string | undefined,
    entityType: row.entity_type as string | undefined,
    entityId: row.entity_id as string | undefined,
    alertType: String(row.alert_type),
    condition: parseJsonIfString<Record<string, unknown>>(row.condition),
    threshold: row.threshold ? parseJsonIfString<Record<string, unknown>>(row.threshold) : undefined,
    severity: row.severity as AlertRule['severity'],
    isEnabled: Boolean(row.is_enabled),
    notificationChannels: (row.notification_channels as unknown) as string[] ?? [],
    createdBy: String(row.created_by),
    createdAt: (row.created_at as unknown) as Date,
    updatedAt: (row.updated_at as unknown) as Date,
  };
}

export async function getEnabledAlertRules(entityType?: string): Promise<AlertRule[]> {
  let query = `SELECT * FROM alert_rules WHERE is_enabled = true`;
  const params: unknown[] = [];
  if (entityType) {
    query += ` AND (entity_type = $1 OR entity_type IS NULL)`;
    params.push(entityType);
  }
  const result = (await db.execute((sql.raw as any)(query, ...(params as any[])))) as QueryResult<Record<string, unknown>>;
  return result.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    description: row.description as string | undefined,
    entityType: row.entity_type as string | undefined,
    entityId: row.entity_id as string | undefined,
    alertType: String(row.alert_type),
    condition: parseJsonIfString<Record<string, unknown>>(row.condition),
    threshold: row.threshold ? parseJsonIfString<Record<string, unknown>>(row.threshold) : undefined,
    severity: row.severity as AlertRule['severity'],
    isEnabled: Boolean(row.is_enabled),
    notificationChannels: (row.notification_channels as unknown) as string[] ?? [],
    createdBy: String(row.created_by),
    createdAt: (row.created_at as unknown) as Date,
    updatedAt: (row.updated_at as unknown) as Date,
  }));
}

export async function updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<AlertRule | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  if (updates.name) { setClauses.push(`name = $${values.length + 1}`); values.push(updates.name); }
  if (updates.description !== undefined) { setClauses.push(`description = $${values.length + 1}`); values.push(updates.description); }
  if (updates.condition) { setClauses.push(`condition = $${values.length + 1}`); values.push(JSON.stringify(updates.condition)); }
  if (updates.severity) { setClauses.push(`severity = $${values.length + 1}`); values.push(updates.severity); }
  if (updates.isEnabled !== undefined) { setClauses.push(`is_enabled = $${values.length + 1}`); values.push(updates.isEnabled); }
  if (setClauses.length === 0) return null;
  setClauses.push('updated_at = now()');
  values.push(ruleId);
  const query = `UPDATE alert_rules SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING id, name, description, entity_type, entity_id, alert_type, condition, threshold, severity, is_enabled, notification_channels, created_by, created_at, updated_at`;
  const result = (await db.execute((sql.raw as any)(query, ...(values as any[])))) as QueryResult<Record<string, unknown>>;
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description as string | undefined,
    entityType: row.entity_type as string | undefined,
    entityId: row.entity_id as string | undefined,
    alertType: String(row.alert_type),
    condition: parseJsonIfString<Record<string, unknown>>(row.condition),
    threshold: row.threshold ? parseJsonIfString<Record<string, unknown>>(row.threshold) : undefined,
    severity: row.severity as AlertRule['severity'],
    isEnabled: Boolean(row.is_enabled),
    notificationChannels: (row.notification_channels as unknown) as string[] ?? [],
    createdBy: String(row.created_by),
    createdAt: (row.created_at as unknown) as Date,
    updatedAt: (row.updated_at as unknown) as Date,
  };
}

export async function searchConfigurationHistory(
  searchQuery: string,
  filters: { entityType?: string; entityId?: string; startDate?: Date; endDate?: Date; changedBy?: string; changedFields?: string[]; severity?: string },
  limit = 50,
  offset = 0
): Promise<{ results: ConfigHistoryEntry[]; total: number }> {
  let base = `SELECT ch.* FROM configuration_history ch WHERE 1=1`;
  const params: unknown[] = [];
  if (searchQuery.trim()) { params.push(`%${searchQuery}%`); base += ` AND ch.change_reason ILIKE $${params.length}`; }
  if (filters.entityType) { params.push(filters.entityType); base += ` AND ch.entity_type = $${params.length}`; }
  if (filters.entityId) { params.push(filters.entityId); base += ` AND ch.entity_id = $${params.length}`; }
  if (filters.startDate) { params.push(filters.startDate); base += ` AND ch.changed_at >= $${params.length}`; }
  if (filters.endDate) { params.push(filters.endDate); base += ` AND ch.changed_at <= $${params.length}`; }
  if (filters.changedBy) { params.push(filters.changedBy); base += ` AND ch.changed_by = $${params.length}`; }
  if (filters.changedFields && filters.changedFields.length > 0) {
    const fieldClauses: string[] = [];
    for (const f of filters.changedFields) { params.push(JSON.stringify([f])); fieldClauses.push(`ch.changed_fields @> $${params.length}`); }
    base += ` AND (${fieldClauses.join(' OR ')})`;
  }

  const countQuery = `SELECT COUNT(*) as total FROM configuration_history ch WHERE 1=1` + base.substring(base.indexOf('WHERE') + 5);
  const countResult = (await db.execute((sql.raw as any)(countQuery, ...(params as any[])))) as QueryResult<{ total: number }>;

  const finalQuery = `${base} ORDER BY ch.changed_at DESC LIMIT ${limit} OFFSET ${offset}`;
  const result = (await db.execute((sql.raw as any)(finalQuery, ...(params as any[])))) as QueryResult<Record<string, unknown>>;
  const rows = result.rows.map((row) => ({
    id: String(row.id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    versionNumber: Number(row.version_number),
    configuration: parseJsonIfString<Record<string, unknown>>(row.configuration),
    previousConfiguration: row.previous_configuration ? parseJsonIfString<Record<string, unknown>>(row.previous_configuration) : undefined,
    changedFields: (row.changed_fields as unknown) as string[],
    changeReason: row.change_reason as string | undefined,
    changedBy: String(row.changed_by),
    changedAt: (row.changed_at as unknown) as Date,
    createdAt: (row.created_at as unknown) as Date,
  }));

  return { results: rows, total: Number(countResult.rows[0]?.total ?? 0) };
}

export async function getConfigurationAnalytics(entityType?: string): Promise<ChangeMetrics> {
  const totalRes = (await db.execute(sql`SELECT COUNT(*) as count FROM configuration_history ${entityType ? sql`WHERE entity_type = ${entityType}` : sql``}`)) as QueryResult<{ count: number }>;
  const totalChanges = Number(totalRes.rows[0]?.count ?? 0);

  const last24hRes = (await db.execute(sql`SELECT COUNT(*) as count FROM configuration_history WHERE changed_at >= NOW() - INTERVAL '24 hours' ${entityType ? sql`AND entity_type = ${entityType}` : sql``}`)) as QueryResult<{ count: number }>;
  const last7dRes = (await db.execute(sql`SELECT COUNT(*) as count FROM configuration_history WHERE changed_at >= NOW() - INTERVAL '7 days' ${entityType ? sql`AND entity_type = ${entityType}` : sql``}`)) as QueryResult<{ count: number }>;
  const last30dRes = (await db.execute(sql`SELECT COUNT(*) as count FROM configuration_history WHERE changed_at >= NOW() - INTERVAL '30 days' ${entityType ? sql`AND entity_type = ${entityType}` : sql``}`)) as QueryResult<{ count: number }>;

  const perUserRes = (await db.execute(sql`SELECT changed_by, COUNT(*) as count FROM configuration_history ${entityType ? sql`WHERE entity_type = ${entityType}` : sql``} GROUP BY changed_by ORDER BY count DESC LIMIT 10`)) as QueryResult<Record<string, unknown>>;
  const changesPerUser: Record<string, number> = {};
  perUserRes.rows.forEach((r) => { changesPerUser[String(r.changed_by)] = Number(r.count ?? 0); });

  const fieldsRes = (await db.execute(sql`WITH field_counts AS (SELECT unnest(changed_fields) as field FROM configuration_history ${entityType ? sql`WHERE entity_type = ${entityType}` : sql``}) SELECT field, COUNT(*) as count FROM field_counts GROUP BY field ORDER BY count DESC LIMIT 10`)) as QueryResult<Record<string, unknown>>;
  const mostChangedFields = fieldsRes.rows.map((r) => ({ field: String(r.field), count: Number(r.count ?? 0) }));

  const typeRes = (await db.execute(sql`SELECT entity_type, COUNT(*) as count FROM configuration_history GROUP BY entity_type`)) as QueryResult<Record<string, unknown>>;
  const changesByType: Record<string, number> = {};
  typeRes.rows.forEach((r) => { changesByType[String(r.entity_type)] = Number(r.count ?? 0); });

  const averageChangeFrequency = totalChanges > 0 ? totalChanges / 30 : 0;

  return {
    totalChanges,
    changesLast24h: Number(last24hRes.rows[0]?.count ?? 0),
    changesLast7d: Number(last7dRes.rows[0]?.count ?? 0),
    changesLast30d: Number(last30dRes.rows[0]?.count ?? 0),
    changesPerUser,
    mostChangedFields,
    changesByType,
    averageChangeFrequency,
  };
}

export async function getPerformanceTrends(entityType: string, entityId: string, days = 30): Promise<Array<{ date: string; metrics: Record<string, unknown> }>> {
  const result = (await db.execute(sql`SELECT DATE(timestamp) as date, jsonb_object_agg(period, metrics) as metrics_by_period FROM performance_snapshots WHERE entity_type = ${entityType} AND entity_id = ${entityId} AND timestamp >= NOW() - INTERVAL '${days} days' GROUP BY DATE(timestamp) ORDER BY date DESC`)) as QueryResult<Record<string, unknown>>;
  return result.rows.map((r) => ({ date: String(r.date), metrics: parseJsonIfString<Record<string, unknown>>(r.metrics_by_period) || {} }));
}

export default {} as const;
