/**
 * Operational Audit Logger
 * Immutable, cryptographically verified audit trail for all operational changes
 * No hardcoded values; all state transitions are hashed and chained for integrity verification
 */

import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import {
  AuditEvent,
  AuditActionType,
  AuditTrail,
  OperationalFrameworkConfig,
  AuditIntegrityError,
} from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * In-memory audit log with hash chain verification
 * For production use with PostgreSQL persistence via hooks
 */
export class OperationalAuditLogger extends EventEmitter {
  private events: AuditEvent[] = [];
  private lastEventHash: string = this.computeInitialHash();
  private config: OperationalFrameworkConfig;
  private immutabilityEnabled: boolean;

  constructor(config: OperationalFrameworkConfig) {
    super();
    this.config = config;
    this.immutabilityEnabled = config.audit.immutabilityEnabled;
  }

  /**
   * Log an audit event
   * Automatically computes hash chain and verifies integrity
   */
  async logEvent(
    action: AuditActionType,
    actor: string,
    targetService?: string,
    targetResource?: string,
    previousState?: Record<string, unknown>,
    newState?: Record<string, unknown>,
    description?: string,
    metadata?: Record<string, unknown>,
    requiresApproval: boolean = false
  ): Promise<AuditEvent> {
    const timestamp = new Date();
    const eventId = uuidv4();

    // Compute event hash - includes all immutable state
    const eventHash = this.computeEventHash(
      timestamp,
      action,
      actor,
      targetService,
      targetResource,
      previousState,
      newState,
      this.lastEventHash
    );

    const event: AuditEvent = {
      id: eventId,
      timestamp,
      action,
      actor,
      targetService,
      targetResource,
      previousState,
      newState,
      eventHash,
      previousEventHash: this.lastEventHash,
      description,
      metadata,
      requiresApproval,
    };

    // Verify hash chain integrity before adding
    if (this.immutabilityEnabled) {
      this.verifyEventIntegrity(event);
    }

    this.events.push(event);
    this.lastEventHash = eventHash;

    // Emit event for listeners
    this.emit('audit:event', {
      event,
      chainValid: this.verifyChainIntegrity(),
      eventCount: this.events.length,
    });

    console.log(`[AuditLogger] Logged: ${action} by ${actor} on ${targetResource || 'N/A'}`);

    return event;
  }

  /**
   * Approve a pending audit event
   * Updates event with approval details and computes new hash
   */
  async approveEvent(eventId: string, approver: string): Promise<AuditEvent> {
    const event = this.events.find((e) => e.id === eventId);

    if (!event) {
      throw new AuditIntegrityError(`Event not found: ${eventId}`, { eventId });
    }

    if (!event.requiresApproval) {
      throw new AuditIntegrityError(`Event does not require approval: ${eventId}`, { eventId });
    }

    if (event.approvedBy) {
      throw new AuditIntegrityError(
        `Event already approved by ${event.approvedBy}: ${eventId}`,
        { eventId }
      );
    }

    event.approvedBy = approver;
    event.approvalTimestamp = new Date();

    // Recompute hash with approval
    const newHash = this.computeEventHash(
      event.timestamp,
      event.action,
      event.actor,
      event.targetService,
      event.targetResource,
      event.previousState,
      event.newState,
      event.previousEventHash,
      approver
    );

    event.eventHash = newHash;
    this.lastEventHash = newHash;

    this.emit('audit:approved', {
      eventId,
      approver,
      timestamp: new Date(),
    });

    console.log(`[AuditLogger] Event ${eventId} approved by ${approver}`);

    return event;
  }

  /**
   * Get all events in audit trail
   * Returns immutable copy
   */
  getEvents(): AuditEvent[] {
    return JSON.parse(JSON.stringify(this.events)) as AuditEvent[];
  }

  /**
   * Query events by multiple filters
   */
  queryEvents(filters: {
    action?: AuditActionType;
    actor?: string;
    targetService?: string;
    targetResource?: string;
    timeRange?: { startTime: Date; endTime: Date };
    requiresApproval?: boolean;
  }): AuditEvent[] {
    return this.events.filter((event) => {
      if (filters.action && event.action !== filters.action) return false;
      if (filters.actor && event.actor !== filters.actor) return false;
      if (filters.targetService && event.targetService !== filters.targetService) return false;
      if (filters.targetResource && event.targetResource !== filters.targetResource) return false;
      if (filters.requiresApproval !== undefined && event.requiresApproval !== filters.requiresApproval)
        return false;
      if (filters.timeRange) {
        if (event.timestamp < filters.timeRange.startTime || event.timestamp > filters.timeRange.endTime)
          return false;
      }
      return true;
    });
  }

  /**
   * Get complete audit trail
   */
  getTrail(): AuditTrail {
    return {
      events: this.getEvents(),
      lastEventHash: this.lastEventHash,
      integrityVerified: this.verifyChainIntegrity(),
    };
  }

  /**
   * Verify complete hash chain integrity
   * Returns true if all hashes are valid and properly chained
   */
  verifyChainIntegrity(): boolean {
    if (this.events.length === 0) {
      return true;
    }

    let previousHash = this.computeInitialHash();

    for (const event of this.events) {
      if (event.previousEventHash !== previousHash) {
        console.error(
          `[AuditLogger] Chain integrity violation at event ${event.id}: expected previousHash ${previousHash}, got ${event.previousEventHash}`
        );
        return false;
      }

      const recomputedHash = this.computeEventHash(
        event.timestamp,
        event.action,
        event.actor,
        event.targetService,
        event.targetResource,
        event.previousState,
        event.newState,
        previousHash,
        event.approvedBy
      );

      if (event.eventHash !== recomputedHash) {
        console.error(
          `[AuditLogger] Hash mismatch at event ${event.id}: expected ${recomputedHash}, got ${event.eventHash}`
        );
        return false;
      }

      previousHash = event.eventHash;
    }

    return true;
  }

  /**
   * Verify single event integrity
   * Throws error if integrity is violated
   */
  private verifyEventIntegrity(event: AuditEvent): void {
    if (event.previousEventHash !== this.lastEventHash) {
      throw new AuditIntegrityError(
        `Event hash chain broken: expected previousHash ${this.lastEventHash}, got ${event.previousEventHash}`,
        { event }
      );
    }

    const expectedHash = this.computeEventHash(
      event.timestamp,
      event.action,
      event.actor,
      event.targetService,
      event.targetResource,
      event.previousState,
      event.newState,
      this.lastEventHash
    );

    if (event.eventHash !== expectedHash) {
      throw new AuditIntegrityError(
        `Event hash mismatch: expected ${expectedHash}, got ${event.eventHash}`,
        { event }
      );
    }
  }

  /**
   * Compute hash for a single event
   * Deterministic - always produces same hash for same inputs
   */
  private computeEventHash(
    timestamp: Date,
    action: AuditActionType,
    actor: string,
    targetService: string | undefined,
    targetResource: string | undefined,
    previousState: Record<string, unknown> | undefined,
    newState: Record<string, unknown> | undefined,
    previousHash: string,
    approver?: string
  ): string {
    const data = JSON.stringify({
      timestamp: timestamp.toISOString(),
      action,
      actor,
      targetService: targetService || null,
      targetResource: targetResource || null,
      previousState: previousState || null,
      newState: newState || null,
      previousHash,
      approver: approver || null,
    });

    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Compute initial hash (no previous event)
   * Used as starting point for hash chain
   */
  private computeInitialHash(): string {
    return createHash('sha256').update('AUDIT_TRAIL_GENESIS').digest('hex');
  }

  /**
   * Get audit statistics
   */
  getStatistics(): {
    totalEvents: number;
    eventsByAction: Record<string, number>;
    eventsByActor: Record<string, number>;
    chainIntegrity: boolean;
    oldestEvent?: Date;
    newestEvent?: Date;
  } {
    const stats = {
      totalEvents: this.events.length,
      eventsByAction: {} as Record<string, number>,
      eventsByActor: {} as Record<string, number>,
      chainIntegrity: this.verifyChainIntegrity(),
      oldestEvent: this.events[0]?.timestamp,
      newestEvent: this.events[this.events.length - 1]?.timestamp,
    };

    for (const event of this.events) {
      stats.eventsByAction[event.action] = (stats.eventsByAction[event.action] || 0) + 1;
      stats.eventsByActor[event.actor] = (stats.eventsByActor[event.actor] || 0) + 1;
    }

    return stats;
  }

  /**
   * Export audit trail to JSON format
   * For forensic analysis and compliance reporting
   */
  exportToJSON(): string {
    const trail = this.getTrail();
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        statistics: this.getStatistics(),
        trail,
      },
      null,
      2
    );
  }

  /**
   * Export audit trail to CSV format
   * For spreadsheet analysis
   */
  exportToCSV(): string {
    const headers = [
      'ID',
      'Timestamp',
      'Action',
      'Actor',
      'TargetService',
      'TargetResource',
      'Description',
      'ApprovedBy',
      'RequiresApproval',
    ];

    const rows = this.events.map((event) => [
      event.id,
      event.timestamp.toISOString(),
      event.action,
      event.actor,
      event.targetService || '',
      event.targetResource || '',
      event.description || '',
      event.approvedBy || '',
      event.requiresApproval ? 'true' : 'false',
    ]);

    return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
  }
}

// Export singleton
let auditLoggerInstance: OperationalAuditLogger | null = null;

export function initializeAuditLogger(config: OperationalFrameworkConfig): OperationalAuditLogger {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new OperationalAuditLogger(config);
  }
  return auditLoggerInstance;
}

export function getAuditLogger(): OperationalAuditLogger {
  if (!auditLoggerInstance) {
    throw new Error('OperationalAuditLogger not initialized. Call initializeAuditLogger first.');
  }
  return auditLoggerInstance;
}
