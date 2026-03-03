/**
 * CONSOLIDATED AUDIT SERVICE
 * ═════════════════════════════════════════════════════════════════════════════════
 * 
 * Unified audit logging for the entire platform
 * Consolidates:
 * - auditLogging.ts (event-based, comprehensive event types)
 * - auditLoggingService.ts (detailed state tracking, before/after changes)
 * - auditLogger.ts (DEPRECATED - file-based logging)
 * 
 * ALL AUDIT LOGGING GOES TO: audit_logs table (PostgreSQL)
 * NO FILE-BASED LOGGING - database only
 * 
 * ═════════════════════════════════════════════════════════════════════════════════
 */

import { db } from '../db';
import { auditLogs } from '../../shared/schema';
import { v4 as uuid } from 'uuid';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

/**
 * Event Types - Unified enum for all audit events
 */
export enum AuditEventType {
  // Authentication
  LOGIN_ATTEMPT = 'LOGIN_ATTEMPT',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',

  // User
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  ACCOUNT_UPDATED = 'ACCOUNT_UPDATED',
  ACCOUNT_BANNED = 'ACCOUNT_BANNED',
  ACCOUNT_UNBANNED = 'ACCOUNT_UNBANNED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',

  // DAO
  DAO_CREATED = 'DAO_CREATED',
  DAO_UPDATED = 'DAO_UPDATED',
  DAO_DELETED = 'DAO_DELETED',
  MEMBER_ADDED = 'MEMBER_ADDED',
  MEMBER_REMOVED = 'MEMBER_REMOVED',
  MEMBER_ROLE_CHANGED = 'MEMBER_ROLE_CHANGED',
  MEMBER_BANNED = 'MEMBER_BANNED',

  // Proposals & Governance
  PROPOSAL_CREATED = 'PROPOSAL_CREATED',
  PROPOSAL_EXECUTED = 'PROPOSAL_EXECUTED',
  PROPOSAL_CANCELLED = 'PROPOSAL_CANCELLED',
  PROPOSAL_VOTED = 'PROPOSAL_VOTED',

  // Treasury
  TRANSFER_INITIATED = 'TRANSFER_INITIATED',
  TRANSFER_EXECUTED = 'TRANSFER_EXECUTED',
  TRANSFER_FAILED = 'TRANSFER_FAILED',
  WITHDRAWAL_APPROVED = 'WITHDRAWAL_APPROVED',
  WITHDRAWAL_REJECTED = 'WITHDRAWAL_REJECTED',

  // Vault/Strategy
  VAULT_CREATED = 'VAULT_CREATED',
  VAULT_UPDATED = 'VAULT_UPDATED',
  VAULT_DELETED = 'VAULT_DELETED',
  STRATEGY_DEPLOYED = 'STRATEGY_DEPLOYED',
  STRATEGY_REBALANCED = 'STRATEGY_REBALANCED',
  CROSS_CHAIN_OPERATION = 'CROSS_CHAIN_OPERATION',

  // Admin Actions
  ADMIN_USER_LIST_ACCESSED = 'ADMIN_USER_LIST_ACCESSED',
  ADMIN_USER_BANNED = 'ADMIN_USER_BANNED',
  ADMIN_ROLE_UPDATED = 'ADMIN_ROLE_UPDATED',
  ADMIN_DAO_DELETED = 'ADMIN_DAO_DELETED',
  ADMIN_SETTINGS_CHANGED = 'ADMIN_SETTINGS_CHANGED',

  // Security
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',

  // API
  API_ERROR = 'API_ERROR',
  API_VALIDATION_FAILED = 'API_VALIDATION_FAILED',
}

/**
 * Unified Audit Log Entry
 */
export interface UnifiedAuditEntry {
  // Actor information
  actorId: string;
  actorType?: 'admin' | 'user' | 'system' | 'super_admin';
  actorRole?: string;

  // Action information
  actionType: AuditEventType | string;
  actionCategory?: 'admin' | 'governance' | 'user' | 'security' | 'system' | 'vault' | 'audit' | string;

  // Target information
  targetType: string;
  targetId: string;
  targetName?: string;

  // State changes (optional)
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  changedFields?: string[];

  // Result
  result?: 'success' | 'failed' | 'partial';
  resultReason?: string;

  // Context
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  metadata?: Record<string, any>;

  // Severity for security events
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Log a unified audit event to database
 * This is the single entrypoint for all audit logging
 */
export async function logConsolidatedAuditEvent(entry: UnifiedAuditEntry): Promise<void> {
  try {
    const logId = uuid();
    const now = new Date();

    // Build complete metadata
    const metadata: Record<string, any> = entry.metadata || {};
    if (entry.ipAddress) metadata.ipAddress = entry.ipAddress;
    if (entry.userAgent) metadata.userAgent = entry.userAgent;
    if (entry.endpoint) metadata.endpoint = entry.endpoint;
    if (entry.severity) metadata.severity = entry.severity;

    // Insert into audit_logs
    await db.insert(auditLogs).values({
      id: logId,
      userId: entry.actorId,
      userEmail: undefined, // Can be populated if available
      action: entry.actionType as string,
      resource: entry.targetType,
      resourceId: entry.targetId,
      method: entry.actionCategory || 'audit',
      endpoint: entry.endpoint || '/api',
      ipAddress: entry.ipAddress || 'unknown',
      userAgent: entry.userAgent || 'unknown',
      status: entry.result === 'success' ? 200 : 400,
      details: metadata,
      severity: mapSeverityToDbLevel(entry.severity),
      category: categorizeAuditEvent(entry.actionType),
      createdAt: now,
      updatedAt: now,
    } as any);

    logger.info(`[Audit] ${entry.actionType} by ${entry.actorId} on ${entry.targetType}:${entry.targetId}`, {
      metadata,
    });
  } catch (error) {
    logger.error('[AuditConsolidation] Failed to log event:', error);
    // Don't throw - audit failure shouldn't break the app
  }
}

/**
 * Helper: Map severity level to database integer
 */
function mapSeverityToDbLevel(severity?: string): number {
  switch (severity) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
    default:
      return 1;
  }
}

/**
 * Helper: Categorize event for easier querying
 */
function categorizeAuditEvent(actionType: string): string {
  if (actionType.startsWith('LOGIN') || actionType.startsWith('LOGOUT')) return 'authentication';
  if (actionType.startsWith('ACCOUNT')) return 'account';
  if (actionType.startsWith('DAO')) return 'dao';
  if (actionType.startsWith('PROPOSAL')) return 'governance';
  if (actionType.startsWith('TRANSFER') || actionType.startsWith('WITHDRAWAL')) return 'treasury';
  if (actionType.startsWith('VAULT') || actionType.startsWith('STRATEGY')) return 'vault';
  if (actionType.startsWith('ADMIN')) return 'admin';
  if (actionType.startsWith('PERMISSION') || actionType.startsWith('UNAUTHORIZED') || actionType.startsWith('SUSPICIOUS'))
    return 'security';
  if (actionType.startsWith('API')) return 'api';
  return 'system';
}

// -----------------------------------------------------------------------------
// Convenience middleware helper and alias
// -----------------------------------------------------------------------------

import { Request, Response, NextFunction } from 'express';

/**
 * Express middleware generator that logs a simple audit event and continues.
 * The returned handler never fails the request even if logging throws.
 */
export function auditConsolidated(
  actionType: string,
  severity: string[] | string = []
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req, res, next) => {
    try {
      const entry: UnifiedAuditEntry = {
        actorId: (req as any).user?.id || 'unknown',
        actorType: (req as any).user?.role || 'user',
        actionType,
        actionCategory: 'audit',
        targetType: req.path,
        targetId: req.params.daoId || req.params.id || '',
        result: 'success',
        metadata: { severity },
        ipAddress: req.ip,
        endpoint: req.originalUrl,
      };
      await logConsolidatedAuditEvent(entry);
    } catch (e) {
      // swallow - auditing should not block main flow
      logger.error('[AuditMiddleware] failed', e);
    }
    next();
  };
}

// attach .log helper so existing callsites continue to work
auditConsolidated.log = logConsolidatedAuditEvent;

/**
 * Convenience function for vault operations
 */
export async function logVaultOperation(
  userId: string,
  operation: 'created' | 'updated' | 'deleted' | 'accessed',
  vaultId: string,
  vaultName?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const eventTypeMap = {
    created: AuditEventType.VAULT_CREATED,
    updated: AuditEventType.VAULT_UPDATED,
    deleted: AuditEventType.VAULT_DELETED,
    accessed: AuditEventType.VAULT_UPDATED, // Treat access as update
  };

  return logConsolidatedAuditEvent({
    actorId: userId,
    actorType: 'user',
    actionType: eventTypeMap[operation],
    actionCategory: 'vault',
    targetType: 'vault',
    targetId: vaultId,
    targetName: vaultName,
    result: 'success',
    metadata,
  });
}

/**
 * Convenience function for strategy operations
 */
export async function logStrategyOperation(
  userId: string,
  operation: 'deployed' | 'rebalanced' | 'created',
  strategyId: string,
  vaultId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const eventTypeMap = {
    deployed: AuditEventType.STRATEGY_DEPLOYED,
    rebalanced: AuditEventType.STRATEGY_REBALANCED,
    created: AuditEventType.VAULT_CREATED,
  };

  return logConsolidatedAuditEvent({
    actorId: userId,
    actorType: 'user',
    actionType: eventTypeMap[operation],
    actionCategory: 'vault',
    targetType: 'strategy',
    targetId: strategyId,
    result: 'success',
    metadata: {
      ...metadata,
      vaultId,
    },
  });
}

/**
 * Convenience function for permission checks
 */
export async function logPermissionEvent(
  userId: string,
  resource: string,
  resourceId: string,
  allowed: boolean,
  metadata?: Record<string, any>
): Promise<void> {
  return logConsolidatedAuditEvent({
    actorId: userId,
    actionType: allowed ? 'PERMISSION_GRANTED' : AuditEventType.PERMISSION_DENIED,
    actionCategory: 'security',
    targetType: resource,
    targetId: resourceId,
    result: allowed ? 'success' : 'failed',
    severity: allowed ? 'low' : 'medium',
    metadata,
  });
}

export default {
  logConsolidatedAuditEvent,
  logVaultOperation,
  logStrategyOperation,
  logPermissionEvent,
};
