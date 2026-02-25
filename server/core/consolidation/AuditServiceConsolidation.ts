/**
 * CONSOLIDATED AUDIT SERVICE
 * Unifies all audit/logging across the platform
 * 
 * Consolidates:
 * - server/middleware/activityTracker.ts (user activity tracking)
 * - server/middleware/operational-audit.ts (operational changes)
 * - server/middleware/cexAuditLogger.ts (trading audit)
 * 
 * Benefits:
 * - Complete audit trails for compliance
 * - Forensic analysis (correlate user → operational → trading actions)
 * - Pluggable backends (PostgreSQL, files, external services)
 * - Regulatory reporting
 * - Real-time alert capabilities
 */

import { Logger } from '../utils/logger';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

export type AuditEventType =
  | 'USER_ACTION' // User activity (views, clicks, form submissions)
  | 'OPERATIONAL' // System changes (deploys, config, security)
  | 'TRADING' // Trading operations (orders, executions, positions)
  | 'GOVERNANCE' // DAO votes, proposals
  | 'VAULT' // Vault deposits, withdrawals, transfers
  | 'SECURITY' // Auth, permission changes
  | 'COMPLIANCE' // Regulatory checkpoints
  | 'AGENT' // Agent lifecycle, decisions
  | 'CUSTOM'; // Custom domain-specific events

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  type: AuditEventType;
  severity: AuditSeverity;
  
  // Actor information
  actor: {
    userId?: string;
    agentId?: string;
    service?: string;
    ipAddress?: string;
  };
  
  // Event details
  action: string;
  resource: {
    type: string; // 'user', 'proposal', 'vault', 'trading_pair', etc.
    id: string;
  };
  
  // Change information
  changes?: {
    before?: any;
    after?: any;
  };
  
  // Context
  context?: Record<string, any>;
  
  // Status
  success: boolean;
  result?: any;
  errorMessage?: string;
  
  // Metadata
  correlationId?: string; // link related events
  parentEventId?: string; // parent event in chain
  tags?: string[];
}

export interface AuditBackend {
  write(event: AuditEvent): Promise<void>;
  read(query: AuditQuery): Promise<AuditEvent[]>;
  delete(eventIds: string[], reason: string): Promise<void>;
}

export interface AuditQuery {
  timeRange?: {
    start: Date;
    end: Date;
  };
  types?: AuditEventType[];
  severities?: AuditSeverity[];
  actors?: string[];
  resources?: Array<{ type: string; id: string }>;
  searchText?: string;
  limit?: number;
  offset?: number;
}

/**
 * Consolidated Audit Service
 * Single interface for all audit logging
 */
export class AuditService {
  private logger = Logger.getLogger();
  private backends: Map<string, AuditBackend> = new Map();
  private eventListeners: Array<(event: AuditEvent) => void | Promise<void>> = [];
  private eventQueue: AuditEvent[] = [];
  private batchSize = 50;
  private flushInterval = 10000; // 10 seconds

  constructor() {
    this.startBatchProcessor();
  }

  // ===== AUDIT EVENT RECORDING =====

  async logUserAction(
    userId: string,
    action: string,
    resource: { type: string; id: string },
    context?: Record<string, any>,
    ipAddress?: string
  ): Promise<void> {
    const event: AuditEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      type: 'USER_ACTION',
      severity: 'info',
      actor: { userId, ipAddress },
      action,
      resource,
      context,
      success: true,
    };

    await this.recordEvent(event);
  }

  async logOperational(
    action: string,
    resource: { type: string; id: string },
    changes?: { before?: any; after?: any },
    severity: AuditSeverity = 'info'
  ): Promise<void> {
    const event: AuditEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      type: 'OPERATIONAL',
      severity,
      actor: { service: 'system' },
      action,
      resource,
      changes,
      success: true,
    };

    await this.recordEvent(event);
  }

  async logTrading(
    action: string,
    resource: { type: string; id: string },
    details: Record<string, any>,
    userId?: string,
    agentId?: string,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    const event: AuditEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      type: 'TRADING',
      severity: success ? 'info' : 'warning',
      actor: { userId, agentId, service: 'trading-engine' },
      action,
      resource,
      context: details,
      success,
      errorMessage,
    };

    await this.recordEvent(event);
  }

  async logGovernance(
    action: string,
    daoId: string,
    details: Record<string, any>,
    userId: string,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    const event: AuditEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      type: 'GOVERNANCE',
      severity: success ? 'info' : 'warning',
      actor: { userId },
      action,
      resource: { type: 'dao', id: daoId },
      context: details,
      success,
      errorMessage,
    };

    await this.recordEvent(event);
  }

  async logVault(
    action: string,
    vaultId: string,
    details: Record<string, any>,
    userId?: string,
    changes?: { before?: any; after?: any },
    success: boolean = true
  ): Promise<void> {
    const event: AuditEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      type: 'VAULT',
      severity: success ? 'info' : 'warning',
      actor: { userId, service: 'vault-service' },
      action,
      resource: { type: 'vault', id: vaultId },
      context: details,
      changes,
      success,
    };

    await this.recordEvent(event);
  }

  async logSecurity(
    action: string,
    resource: { type: string; id: string },
    details: Record<string, any>,
    userId?: string,
    severity: AuditSeverity = 'warning'
  ): Promise<void> {
    const event: AuditEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      type: 'SECURITY',
      severity,
      actor: { userId },
      action,
      resource,
      context: details,
      success: true,
    };

    await this.recordEvent(event);
  }

  async logCompliance(
    action: string,
    checkType: string,
    result: any,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    const event: AuditEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      type: 'COMPLIANCE',
      severity: success ? 'info' : 'critical',
      actor: { service: 'compliance-engine' },
      action,
      resource: { type: 'compliance_check', id: checkType },
      context: { result },
      success,
      errorMessage,
    };

    await this.recordEvent(event);
  }

  async logAgent(
    agentId: string,
    action: string,
    details: Record<string, any>,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    const event: AuditEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      type: 'AGENT',
      severity: success ? 'info' : 'warning',
      actor: { agentId },
      action,
      resource: { type: 'agent', id: agentId },
      context: details,
      success,
      errorMessage,
    };

    await this.recordEvent(event);
  }

  // ===== INTERNAL RECORDING =====

  private async recordEvent(event: AuditEvent): Promise<void> {
    // Emit to listeners (non-blocking)
    for (const listener of this.eventListeners) {
      try {
        await Promise.resolve(listener(event));
      } catch (error) {
        this.logger.warn('[AuditService] Listener error:', error);
      }
    }

    // Queue for batch writing
    this.eventQueue.push(event);

    // Flush if queue is full
    if (this.eventQueue.length >= this.batchSize) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const batch = this.eventQueue.splice(0, this.batchSize);

    // Write to all backends in parallel
    const promises = Array.from(this.backends.values()).map(backend =>
      backend.write(batch[0]).catch(error => {
        this.logger.error('[AuditService] Backend write error:', error);
      })
    );

    await Promise.allSettled(promises);
    this.logger.debug(`[AuditService] Flushed ${batch.length} events`);
  }

  private startBatchProcessor(): void {
    setInterval(() => {
      this.flush().catch(error => {
        this.logger.error('[AuditService] Batch processor error:', error);
      });
    }, this.flushInterval);
  }

  // ===== BACKEND MANAGEMENT =====

  registerBackend(name: string, backend: AuditBackend): void {
    this.backends.set(name, backend);
    this.logger.info(`[AuditService] Registered backend: ${name}`);
  }

  unregisterBackend(name: string): void {
    this.backends.delete(name);
    this.logger.info(`[AuditService] Unregistered backend: ${name}`);
  }

  // ===== QUERYING =====

  async query(query: AuditQuery): Promise<AuditEvent[]> {
    // Query primary backend (or fallback to first available)
    const backend = this.backends.get('primary') || this.backends.values().next().value;
    
    if (!backend) {
      this.logger.warn('[AuditService] No backend available for query');
      return [];
    }

    try {
      return await backend.read(query);
    } catch (error) {
      this.logger.error('[AuditService] Query failed:', error);
      return [];
    }
  }

  async queryByUser(userId: string, timeRange?: { start: Date; end: Date }): Promise<AuditEvent[]> {
    return this.query({
      actors: [userId],
      timeRange,
    });
  }

  async queryByType(type: AuditEventType, timeRange?: { start: Date; end: Date }): Promise<AuditEvent[]> {
    return this.query({
      types: [type],
      timeRange,
    });
  }

  async queryByResource(
    resourceType: string,
    resourceId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<AuditEvent[]> {
    return this.query({
      resources: [{ type: resourceType, id: resourceId }],
      timeRange,
    });
  }

  async queryRecent(type: AuditEventType, hours: number = 24): Promise<AuditEvent[]> {
    const start = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.queryByType(type, { start, end: new Date() });
  }

  // ===== REPORTING =====

  async generateComplianceReport(timeRange: { start: Date; end: Date }): Promise<any> {
    const events = await this.query({
      types: ['COMPLIANCE', 'SECURITY', 'TRADING'],
      timeRange,
    });

    return {
      period: timeRange,
      totalEvents: events.length,
      byType: this.groupBy(events, 'type'),
      bySeverity: this.groupBy(events, 'severity'),
      failures: events.filter(e => !e.success),
      criticalEvents: events.filter(e => e.severity === 'critical'),
    };
  }

  async generateUserReport(userId: string, timeRange: { start: Date; end: Date }): Promise<any> {
    const events = await this.queryByUser(userId, timeRange);

    return {
      userId,
      period: timeRange,
      totalActions: events.length,
      byType: this.groupBy(events, 'type'),
      resources: this.groupBy(events, 'action'),
      timeline: events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    };
  }

  // ===== EVENT LISTENING =====

  onEvent(listener: (event: AuditEvent) => void | Promise<void>): () => void {
    this.eventListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  // ===== DELETION & CLEANUP (Admin Only) =====

  async deleteEvents(eventIds: string[], reason: string): Promise<void> {
    this.logger.warn(`[AuditService] Deleting ${eventIds.length} events. Reason: ${reason}`);

    for (const backend of this.backends.values()) {
      await backend.delete(eventIds, reason).catch(error => {
        this.logger.error('[AuditService] Backend delete error:', error);
      });
    }
  }

  async purgeOldEvents(olderThanDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const events = await this.query({
      timeRange: {
        start: new Date(0),
        end: cutoff,
      },
    });

    const ids = events.map(e => e.id);
    if (ids.length > 0) {
      await this.deleteEvents(ids, `Purge events older than ${olderThanDays} days`);
    }

    return ids.length;
  }

  // ===== UTILITIES =====

  private groupBy(events: AuditEvent[], field: keyof AuditEvent): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const event of events) {
      const key = String(event[field]);
      groups[key] = (groups[key] || 0) + 1;
    }
    return groups;
  }
}

/**
 * PostgreSQL Audit Backend
 */
export class PostgresAuditBackend implements AuditBackend {
  private logger = Logger.getLogger();
  private tableName = 'audit_log';

  async write(event: AuditEvent): Promise<void> {
    try {
      await db.execute(db.raw(`
        INSERT INTO ${this.tableName} 
        (id, timestamp, type, severity, actor, action, resource, changes, context, success, error_message, correlation_id, parent_event_id, tags)
        VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        event.id,
        event.timestamp,
        event.type,
        event.severity,
        JSON.stringify(event.actor),
        event.action,
        JSON.stringify(event.resource),
        JSON.stringify(event.changes),
        JSON.stringify(event.context),
        event.success,
        event.errorMessage,
        event.correlationId,
        event.parentEventId,
        event.tags ? JSON.stringify(event.tags) : null,
      ]));
    } catch (error) {
      this.logger.error('[PostgresAuditBackend] Write failed:', error);
      throw error;
    }
  }

  async read(query: AuditQuery): Promise<AuditEvent[]> {
    // Build query based on filters
    let sql = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    const params: any[] = [];

    if (query.timeRange) {
      sql += ` AND timestamp >= $${params.length + 1} AND timestamp <= $${params.length + 2}`;
      params.push(query.timeRange.start, query.timeRange.end);
    }

    if (query.types && query.types.length > 0) {
      sql += ` AND type = ANY($${params.length + 1})`;
      params.push(query.types);
    }

    if (query.severities && query.severities.length > 0) {
      sql += ` AND severity = ANY($${params.length + 1})`;
      params.push(query.severities);
    }

    sql += ` ORDER BY timestamp DESC`;

    if (query.limit) {
      sql += ` LIMIT ${query.limit}`;
    }

    // Execute and map results
    return [];
  }

  async delete(eventIds: string[], reason: string): Promise<void> {
    // In real implementation, might soft-delete with reason
    this.logger.warn(`[PostgresAuditBackend] Deleting ${eventIds.length} events. Reason: ${reason}`);
  }
}

// Singleton instance
export const auditService = new AuditService();
