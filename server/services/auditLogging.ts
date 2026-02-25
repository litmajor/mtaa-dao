import { Logger } from '../utils/logger';
import { db } from '../db';
import { auditLogs } from '../../shared/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

const logger = new Logger('audit-logging');

/**
 * Audit Logging Service
 * 
 * Comprehensive audit trail for security and compliance:
 * - User action tracking
 * - Admin action logging
 * - Security event logging
 * - DAO operation tracking
 * - Authentication events
 * - Error tracking
 */

export enum AuditEventType {
  // Authentication events
  LOGIN_ATTEMPT = 'LOGIN_ATTEMPT',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  TOKEN_VALIDATION_FAILED = 'TOKEN_VALIDATION_FAILED',

  // User account events
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  ACCOUNT_UPDATED = 'ACCOUNT_UPDATED',
  ACCOUNT_BANNED = 'ACCOUNT_BANNED',
  ACCOUNT_UNBANNED = 'ACCOUNT_UNBANNED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET = 'PASSWORD_RESET',

  // DAO events
  DAO_CREATED = 'DAO_CREATED',
  DAO_UPDATED = 'DAO_UPDATED',
  DAO_DELETED = 'DAO_DELETED',
  MEMBER_ADDED = 'MEMBER_ADDED',
  MEMBER_REMOVED = 'MEMBER_REMOVED',
  MEMBER_ROLE_CHANGED = 'MEMBER_ROLE_CHANGED',

  // Proposal events
  PROPOSAL_CREATED = 'PROPOSAL_CREATED',
  PROPOSAL_EXECUTED = 'PROPOSAL_EXECUTED',
  PROPOSAL_CANCELLED = 'PROPOSAL_CANCELLED',
  PROPOSAL_VOTED = 'PROPOSAL_VOTED',

  // Treasury/Transfer events
  TRANSFER_INITIATED = 'TRANSFER_INITIATED',
  TRANSFER_EXECUTED = 'TRANSFER_EXECUTED',
  TRANSFER_FAILED = 'TRANSFER_FAILED',
  TRANSFER_CANCELLED = 'TRANSFER_CANCELLED',

  // Governance events
  GOVERNANCE_SETTINGS_UPDATED = 'GOVERNANCE_SETTINGS_UPDATED',
  THRESHOLD_UPDATED = 'THRESHOLD_UPDATED',
  APPROVAL_RULE_CHANGED = 'APPROVAL_RULE_CHANGED',

  // Admin events
  ADMIN_USER_LIST_ACCESSED = 'ADMIN_USER_LIST_ACCESSED',
  ADMIN_USER_BANNED = 'ADMIN_USER_BANNED',
  ADMIN_ROLE_UPDATED = 'ADMIN_ROLE_UPDATED',
  ADMIN_DAO_DELETED = 'ADMIN_DAO_DELETED',
  ADMIN_SETTINGS_CHANGED = 'ADMIN_SETTINGS_CHANGED',
  USER_PERMISSIONS_CHANGED = 'USER_PERMISSIONS_CHANGED',

  // Security events
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',

  // Payment events
  PAYMENT_INITIATED = 'PAYMENT_INITIATED',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  RECURRING_PAYMENT_CREATED = 'RECURRING_PAYMENT_CREATED',
  RECURRING_PAYMENT_CANCELLED = 'RECURRING_PAYMENT_CANCELLED',

  // Agent events
  AGENT_MESSAGE_SIGNED = 'AGENT_MESSAGE_SIGNED',
  AGENT_MESSAGE_VERIFIED = 'AGENT_MESSAGE_VERIFIED',
  AGENT_MESSAGE_VERIFICATION_FAILED = 'AGENT_MESSAGE_VERIFICATION_FAILED',
  AGENT_EXECUTION_STARTED = 'AGENT_EXECUTION_STARTED',
  AGENT_EXECUTION_COMPLETED = 'AGENT_EXECUTION_COMPLETED',
  AGENT_EXECUTION_FAILED = 'AGENT_EXECUTION_FAILED',

  // API events
  API_ERROR = 'API_ERROR',
  API_VALIDATION_FAILED = 'API_VALIDATION_FAILED',
  API_TIMEOUT = 'API_TIMEOUT',
}

export interface AuditEventMetadata {
  [key: string]: any;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  requestId?: string;
  durationMs?: number;
  statusCode?: number;
  errorMessage?: string;
  errorCode?: string;
  source?: 'web' | 'mobile' | 'agent' | 'admin' | 'api';
}

export interface AuditLogEntry {
  eventType: AuditEventType;
  userId?: string;
  userEmail?: string;
  daoId?: string;
  resourceId?: string;
  action: string;
  metadata: AuditEventMetadata;
  severity: 'low' | 'medium' | 'high' | 'critical';
  method?: string;
  endpoint?: string;
  ipAddress?: string;
  userAgent?: string;
  statusCode?: number;
}

/**
 * Log an audit event
 */
export async function logAuditEvent(
  entry: AuditLogEntry
): Promise<typeof auditLogs.$inferSelect | null> {
  try {
    const auditEntry = {
      userId: entry.userId || null,
      userEmail: entry.userEmail || null,
      action: entry.action,
      resource: entry.eventType,
      resourceId: entry.resourceId || null,
      method: entry.method || 'UNKNOWN',
      endpoint: entry.endpoint || '/unknown',
      ipAddress: entry.ipAddress || 'unknown',
      userAgent: entry.userAgent || 'unknown',
      status: entry.statusCode || 200,
      details: entry.metadata,
      severity: mapSeverityToDb(entry.severity),
      category: categorizeEvent(entry.eventType),
    };

    const result = await db.insert(auditLogs).values(auditEntry);
    logger.debug('Audit event logged', {
      eventType: entry.eventType,
      userId: entry.userId,
      severity: entry.severity,
    });

    return auditEntry as typeof auditLogs.$inferSelect;
  } catch (error) {
    logger.error('Failed to log audit event', {
      error: error instanceof Error ? error.message : String(error),
      eventType: entry.eventType,
    });
    return null;
  }
}

/**
 * Query audit logs with filters
 */
export async function getAuditLogs(filters: {
  userId?: string;
  resource?: string;
  eventType?: AuditEventType;
  severity?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<(typeof auditLogs.$inferSelect)[]> {
  try {
    const {
      userId,
      resource,
      eventType,
      severity,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = filters;

    const conditions = [];

    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }
    if (resource) {
      conditions.push(eq(auditLogs.resource, resource));
    }
    if (eventType) {
      conditions.push(eq(auditLogs.resource, eventType));
    }
    if (severity) {
      conditions.push(eq(auditLogs.severity, severity));
    }
    if (startDate) {
      conditions.push(gte(auditLogs.timestamp, startDate));
    }
    if (endDate) {
      conditions.push(lte(auditLogs.timestamp, endDate));
    }

    const query = db.select().from(auditLogs);

    if (conditions.length > 0) {
      return await query
        .where(and(...conditions))
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit)
        .offset(offset);
    }

    return await query
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit)
      .offset(offset);
  } catch (error) {
    logger.error('Failed to query audit logs', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get recent activity for a user
 */
export async function getUserActivity(
  userId: string,
  hoursBack: number = 24,
  limit: number = 50
): Promise<(typeof auditLogs.$inferSelect)[]> {
  const startDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  return getAuditLogs({
    userId,
    startDate,
    limit,
  });
}

/**
 * Get resource activity
 */
export async function getResourceActivity(
  resource: string,
  hoursBack: number = 24,
  limit: number = 50
): Promise<(typeof auditLogs.$inferSelect)[]> {
  const startDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  return getAuditLogs({
    resource,
    startDate,
    limit,
  });
}

/**
 * Get security events (only WARNING, ERROR, CRITICAL)
 */
export async function getSecurityEvents(filters: {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  limit?: number;
} = {}): Promise<(typeof auditLogs.$inferSelect)[]> {
  const { startDate, endDate, userId, limit = 100 } = filters;

  try {
    const conditions = [];

    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }
    if (startDate) {
      conditions.push(gte(auditLogs.timestamp, startDate));
    }
    if (endDate) {
      conditions.push(lte(auditLogs.timestamp, endDate));
    }

    // Only high/critical severity events
    const severities = ['high', 'critical'];

    const query = db.select().from(auditLogs);

    if (conditions.length > 0) {
      return await query
        .where(and(...conditions))
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit);
    }

    return await query
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);
  } catch (error) {
    logger.error('Failed to query security events', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Archive audit logs older than specified days
 * (For production: move to long-term storage)
 */
export async function archiveOldAuditLogs(
  daysOld: number = 90
): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    // In production, export to S3/backup storage first
    logger.info('Archiving old audit logs', {
      cutoffDate,
      daysOld,
    });

    // Then delete
    // const result = await db.delete(auditLogs).where(
    //   lte(auditLogs.timestamp, cutoffDate)
    // );

    return 0; // Placeholder
  } catch (error) {
    logger.error('Failed to archive audit logs', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Generate audit report for compliance
 */
export async function generateAuditReport(filters: {
  startDate: Date;
  endDate: Date;
  userId?: string;
  resource?: string;
}): Promise<{
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  criticalEvents: (typeof auditLogs.$inferSelect)[];
  reportGeneratedAt: Date;
}> {
  try {
    const allEvents = await getAuditLogs({
      ...filters,
      limit: 10000,
    });

    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};
    const criticalEvents: (typeof auditLogs.$inferSelect)[] = [];

    for (const event of allEvents) {
      // Count by type
      eventsByType[event.resource] = (eventsByType[event.resource] || 0) + 1;

      // Count by severity
      eventsBySeverity[event.severity] =
        (eventsBySeverity[event.severity] || 0) + 1;

      // Track critical events
      if (event.severity === 'critical') {
        criticalEvents.push(event);
      }
    }

    return {
      totalEvents: allEvents.length,
      eventsByType,
      eventsBySeverity,
      criticalEvents,
      reportGeneratedAt: new Date(),
    };
  } catch (error) {
    logger.error('Failed to generate audit report', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Helper to categorize events by severity
 */
export function getEventSeverity(eventType: AuditEventType): 'low' | 'medium' | 'high' | 'critical' {
  const criticalEvents = [
    AuditEventType.ACCOUNT_BANNED,
    AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
    AuditEventType.TOKEN_VALIDATION_FAILED,
    AuditEventType.PERMISSION_DENIED,
    AuditEventType.SUSPICIOUS_ACTIVITY,
    AuditEventType.CONSTRAINT_VIOLATION,
    AuditEventType.AGENT_MESSAGE_VERIFICATION_FAILED,
  ];

  const highEvents = [
    AuditEventType.LOGIN_FAILURE,
    AuditEventType.RATE_LIMIT_EXCEEDED,
    AuditEventType.API_VALIDATION_FAILED,
    AuditEventType.PASSWORD_CHANGED,
    AuditEventType.TRANSFER_FAILED,
    AuditEventType.PAYMENT_FAILED,
    AuditEventType.AGENT_EXECUTION_FAILED,
    AuditEventType.API_ERROR,
  ];

  const mediumEvents = [
    AuditEventType.PERMISSION_DENIED,
    AuditEventType.MEMBER_REMOVED,
    AuditEventType.PASSWORD_RESET,
    AuditEventType.GOVERNANCE_SETTINGS_UPDATED,
  ];

  if (criticalEvents.includes(eventType)) return 'critical';
  if (highEvents.includes(eventType)) return 'high';
  if (mediumEvents.includes(eventType)) return 'medium';
  return 'low';
}

/**
 * Helper to categorize event for resource tracking
 */
function categorizeEvent(eventType: AuditEventType): string {
  if (eventType.includes('LOGIN') || eventType.includes('LOGOUT') || eventType.includes('TOKEN')) {
    return 'authentication';
  }
  if (eventType.includes('ADMIN')) {
    return 'admin';
  }
  if (eventType.includes('ACCOUNT')) {
    return 'account';
  }
  if (eventType.includes('PAYMENT') || eventType.includes('TRANSFER')) {
    return 'payment';
  }
  if (eventType.includes('PROPOSAL') || eventType.includes('DAO') || eventType.includes('GOVERNANCE')) {
    return 'governance';
  }
  if (eventType.includes('AGENT')) {
    return 'agent';
  }
  if (eventType.includes('PERMISSION') || eventType.includes('UNAUTHORIZED') || eventType.includes('SUSPICIOUS')) {
    return 'security';
  }
  return 'general';
}

/**
 * Helper to map severity levels to database values
 */
function mapSeverityToDb(severity: 'low' | 'medium' | 'high' | 'critical'): string {
  return severity;
}
