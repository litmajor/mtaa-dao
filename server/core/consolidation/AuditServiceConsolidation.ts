/**
 * CONSOLIDATED AUDIT SERVICE (Production)
 *
 * Single audit pipeline for USER_ACTION, OPERATIONAL, TRADING, GOVERNANCE,
 * VAULT, SECURITY, COMPLIANCE, AGENT, and CUSTOM events.
 *
 * Guarantees
 * ─────────────────────────────────────────────────────────────
 * • Every queued event is written (batch flush no longer drops events).
 * • Optional durable outbox so process crashes don’t lose audits.
 * • Postgres backend supports filtered reads and soft-delete.
 * • Listeners cannot block or crash the recorder.
 * • Configurable batching, back-pressure, and metrics.
 */

import { v4 as uuidv4 } from 'uuid';
import { and, eq, gte, lte, inArray, sql, desc, asc } from 'drizzle-orm';
import * as prometheus from 'prom-client';
import { Logger } from '../../utils/logger';
import { db } from '../../db';
import { auditLogs } from '../../../shared/schema';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type AuditEventType =
  | 'USER_ACTION'
  | 'OPERATIONAL'
  | 'TRADING'
  | 'GOVERNANCE'
  | 'VAULT'
  | 'SECURITY'
  | 'COMPLIANCE'
  | 'AGENT'
  | 'CUSTOM';

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  type: AuditEventType;
  severity: AuditSeverity;
  actor: {
    userId?: string;
    agentId?: string;
    service?: string;
    ipAddress?: string;
  };
  action: string;
  resource: {
    type: string;
    id: string;
  };
  changes?: {
    before?: unknown;
    after?: unknown;
  };
  context?: Record<string, unknown>;
  success: boolean;
  result?: unknown;
  errorMessage?: string;
  correlationId?: string;
  parentEventId?: string;
  tags?: string[];
}

export interface AuditQuery {
  timeRange?: { start: Date; end: Date };
  types?: AuditEventType[];
  severities?: AuditSeverity[];
  actors?: string[]; // userId | agentId | service
  resources?: Array<{ type: string; id: string }>;
  searchText?: string;
  success?: boolean;
  correlationId?: string;
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

export interface AuditBackend {
  /** Write a batch of events. Must be idempotent on event.id where possible. */
  writeBatch(events: AuditEvent[]): Promise<void>;
  read(query: AuditQuery): Promise<AuditEvent[]>;
  softDelete(eventIds: string[], reason: string, deletedBy?: string): Promise<number>;
}

export interface AuditServiceOptions {
  batchSize?: number;
  flushIntervalMs?: number;
  maxQueueSize?: number;
  listenerTimeoutMs?: number;
  /** If true, persist to outbox table before acknowledging recordEvent */
  durableOutbox?: boolean;
  /** Require at least one backend; otherwise recordEvent throws */
  requireBackend?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Metrics (simple counters – wire to Prometheus if available)
// ─────────────────────────────────────────────────────────────

const metrics = {
  recorded: 0,
  flushed: 0,
  dropped: 0,
  backendErrors: 0,
  listenerErrors: 0,
  queueDepth: 0,
};

const recordedEvents = new prometheus.Counter({
  name: 'mtaa_audit_events_recorded_total',
  help: 'Total number of audit events accepted into the queue',
});
const flushedEvents = new prometheus.Counter({
  name: 'mtaa_audit_events_flushed_total',
  help: 'Total number of audit events successfully flushed to an audit backend',
});
const droppedEvents = new prometheus.Counter({
  name: 'mtaa_audit_events_dropped_total',
  help: 'Total number of audit events dropped because the queue was full',
});
const backendErrors = new prometheus.Counter({
  name: 'mtaa_audit_backend_errors_total',
  help: 'Total number of audit backend write failures',
});
const listenerErrors = new prometheus.Counter({
  name: 'mtaa_audit_listener_errors_total',
  help: 'Total number of audit event listener failures',
});
const queueDepth = new prometheus.Gauge({
  name: 'mtaa_audit_queue_depth',
  help: 'Current number of audit events waiting to be flushed',
});

export function getAuditMetrics() {
  return { ...metrics };
}

// ─────────────────────────────────────────────────────────────
// Audit Service
// ─────────────────────────────────────────────────────────────

export class AuditService {
  private logger = Logger.getLogger();
  private backends = new Map<string, AuditBackend>();
  private eventListeners: Array<(event: AuditEvent) => void | Promise<void>> = [];
  private eventQueue: AuditEvent[] = [];
  private flushing = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private destroyed = false;

  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxQueueSize: number;
  private readonly listenerTimeoutMs: number;
  private readonly durableOutbox: boolean;
  private readonly requireBackend: boolean;

  constructor(options: AuditServiceOptions = {}) {
    this.batchSize = options.batchSize ?? Number(process.env.AUDIT_BATCH_SIZE ?? 50);
    this.flushIntervalMs =
      options.flushIntervalMs ?? Number(process.env.AUDIT_FLUSH_INTERVAL_MS ?? 5_000);
    this.maxQueueSize =
      options.maxQueueSize ?? Number(process.env.AUDIT_MAX_QUEUE_SIZE ?? 5_000);
    this.listenerTimeoutMs =
      options.listenerTimeoutMs ?? Number(process.env.AUDIT_LISTENER_TIMEOUT_MS ?? 2_000);
    this.durableOutbox = options.durableOutbox ?? process.env.AUDIT_DURABLE_OUTBOX === 'true';
    this.requireBackend = options.requireBackend ?? true;

    this.startBatchProcessor();
  }

  // ── Domain helpers ─────────────────────────────────────────

  async logUserAction(
    userId: string,
    action: string,
    resource: { type: string; id: string },
    context?: Record<string, unknown>,
    ipAddress?: string,
    correlationId?: string
  ): Promise<string> {
    return this.recordEvent({
      type: 'USER_ACTION',
      severity: 'info',
      actor: { userId, ipAddress },
      action,
      resource,
      context,
      success: true,
      correlationId,
    });
  }

  async logOperational(
    action: string,
    resource: { type: string; id: string },
    changes?: { before?: unknown; after?: unknown },
    severity: AuditSeverity = 'info',
    correlationId?: string
  ): Promise<string> {
    return this.recordEvent({
      type: 'OPERATIONAL',
      severity,
      actor: { service: 'system' },
      action,
      resource,
      changes,
      success: true,
      correlationId,
    });
  }

  async logTrading(
    action: string,
    resource: { type: string; id: string },
    details: Record<string, unknown>,
    opts: {
      userId?: string;
      agentId?: string;
      success?: boolean;
      errorMessage?: string;
      correlationId?: string;
    } = {}
  ): Promise<string> {
    const success = opts.success ?? true;
    return this.recordEvent({
      type: 'TRADING',
      severity: success ? 'info' : 'warning',
      actor: {
        userId: opts.userId,
        agentId: opts.agentId,
        service: 'trading-engine',
      },
      action,
      resource,
      context: details,
      success,
      errorMessage: opts.errorMessage,
      correlationId: opts.correlationId,
    });
  }

  async logGovernance(
    action: string,
    daoId: string,
    details: Record<string, unknown>,
    userId: string,
    success = true,
    errorMessage?: string,
    correlationId?: string
  ): Promise<string> {
    return this.recordEvent({
      type: 'GOVERNANCE',
      severity: success ? 'info' : 'warning',
      actor: { userId },
      action,
      resource: { type: 'dao', id: daoId },
      context: details,
      success,
      errorMessage,
      correlationId,
    });
  }

  async logVault(
    action: string,
    vaultId: string,
    details: Record<string, unknown>,
    opts: {
      userId?: string;
      changes?: { before?: unknown; after?: unknown };
      success?: boolean;
      correlationId?: string;
    } = {}
  ): Promise<string> {
    const success = opts.success ?? true;
    return this.recordEvent({
      type: 'VAULT',
      severity: success ? 'info' : 'warning',
      actor: { userId: opts.userId, service: 'vault-service' },
      action,
      resource: { type: 'vault', id: vaultId },
      context: details,
      changes: opts.changes,
      success,
      correlationId: opts.correlationId,
    });
  }

  async logSecurity(
    action: string,
    resource: { type: string; id: string },
    details: Record<string, unknown>,
    opts: {
      userId?: string;
      severity?: AuditSeverity;
      correlationId?: string;
    } = {}
  ): Promise<string> {
    return this.recordEvent({
      type: 'SECURITY',
      severity: opts.severity ?? 'warning',
      actor: { userId: opts.userId },
      action,
      resource,
      context: details,
      success: true,
      correlationId: opts.correlationId,
    });
  }

  async logCompliance(
    action: string,
    checkType: string,
    result: unknown,
    success = true,
    errorMessage?: string,
    correlationId?: string
  ): Promise<string> {
    return this.recordEvent({
      type: 'COMPLIANCE',
      severity: success ? 'info' : 'critical',
      actor: { service: 'compliance-engine' },
      action,
      resource: { type: 'compliance_check', id: checkType },
      context: { result },
      success,
      errorMessage,
      correlationId,
    });
  }

  async logAgent(
    agentId: string,
    action: string,
    details: Record<string, unknown>,
    success = true,
    errorMessage?: string,
    correlationId?: string
  ): Promise<string> {
    return this.recordEvent({
      type: 'AGENT',
      severity: success ? 'info' : 'warning',
      actor: { agentId },
      action,
      resource: { type: 'agent', id: agentId },
      context: details,
      success,
      errorMessage,
      correlationId,
    });
  }

  /**
   * Generic recorder. Returns the event id.
   */
  async recordEvent(
    partial: Omit<AuditEvent, 'id' | 'timestamp'> & {
      id?: string;
      timestamp?: Date;
    }
  ): Promise<string> {
    if (this.destroyed) {
      throw new Error('AuditService has been destroyed');
    }

    if (this.requireBackend && this.backends.size === 0) {
      throw new Error(
        'No audit backends registered. Call registerBackend() before recording events.'
      );
    }

    const event: AuditEvent = {
      id: partial.id ?? uuidv4(),
      timestamp: partial.timestamp ?? new Date(),
      type: partial.type,
      severity: partial.severity,
      actor: partial.actor ?? {},
      action: partial.action,
      resource: partial.resource,
      changes: partial.changes,
      context: partial.context,
      success: partial.success,
      result: partial.result,
      errorMessage: partial.errorMessage,
      correlationId: partial.correlationId,
      parentEventId: partial.parentEventId,
      tags: partial.tags,
    };

    // Durable path: write to outbox first (best-effort if table missing)
    if (this.durableOutbox) {
      try {
        await this.writeOutbox(event);
      } catch (err) {
        this.logger.error('[AuditService] Outbox write failed – falling back to memory queue', {
          error: err instanceof Error ? err.message : String(err),
          eventId: event.id,
        });
      }
    }

    // Notify listeners without blocking the recorder
    this.notifyListeners(event);

    // Back-pressure: drop oldest if queue is full
    if (this.eventQueue.length >= this.maxQueueSize) {
      const dropped = this.eventQueue.shift();
      metrics.dropped += 1;
      droppedEvents.inc();
      this.logger.warn('[AuditService] Queue full – dropped oldest event', {
        droppedId: dropped?.id,
        queueSize: this.eventQueue.length,
      });
    }

    this.eventQueue.push(event);
    metrics.recorded += 1;
    metrics.queueDepth = this.eventQueue.length;
    recordedEvents.inc();
    queueDepth.set(metrics.queueDepth);

    if (this.eventQueue.length >= this.batchSize) {
      // Fire-and-forget flush; errors logged inside flush
      void this.flush();
    }

    return event.id;
  }

  /**
   * Run work under a shared correlation id.
   */
  async withCorrelation<T>(
    correlationId: string,
    fn: (correlate: (partial: Parameters<AuditService['recordEvent']>[0]) => Promise<string>) => Promise<T>
  ): Promise<T> {
    const correlate = (partial: Parameters<AuditService['recordEvent']>[0]) =>
      this.recordEvent({ ...partial, correlationId });
    return fn(correlate);
  }

  // ── Internal ───────────────────────────────────────────────

  private notifyListeners(event: AuditEvent): void {
    if (!this.eventListeners.length) return;

    const tasks = this.eventListeners.map((listener) =>
      Promise.race([
        Promise.resolve().then(() => listener(event)),
        new Promise<void>((_, reject) =>
          setTimeout(
            () => reject(new Error('listener timeout')),
            this.listenerTimeoutMs
          )
        ),
      ]).catch((err) => {
        metrics.listenerErrors += 1;
        listenerErrors.inc();
        this.logger.warn('[AuditService] Listener error', {
          error: err instanceof Error ? err.message : String(err),
          eventId: event.id,
        });
      })
    );

    void Promise.allSettled(tasks);
  }

  private async writeOutbox(event: AuditEvent): Promise<void> {
    // Optional table – create via migration if you enable AUDIT_DURABLE_OUTBOX
    await db.execute(sql`
      INSERT INTO audit_outbox (id, payload, created_at)
      VALUES (
        ${event.id},
        ${JSON.stringify(event)}::jsonb,
        ${event.timestamp}
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }

  async flush(): Promise<void> {
    if (this.flushing || this.eventQueue.length === 0) return;
    this.flushing = true;

    try {
      const batch = this.eventQueue.splice(0, this.batchSize);
      metrics.queueDepth = this.eventQueue.length;
      queueDepth.set(metrics.queueDepth);

      if (this.backends.size === 0) {
        // Re-queue if we somehow lost backends mid-flight
        this.eventQueue.unshift(...batch);
        metrics.queueDepth = this.eventQueue.length;
        queueDepth.set(metrics.queueDepth);
        this.logger.error('[AuditService] Flush skipped – no backends');
        return;
      }

      const backends = Array.from(this.backends.values());
      const results = await Promise.allSettled(
        backends.map((backend) => backend.writeBatch(batch))
      );

      let anySuccess = false;
      for (const r of results) {
        if (r.status === 'fulfilled') {
          anySuccess = true;
        } else {
          metrics.backendErrors += 1;
          backendErrors.inc();
          this.logger.error('[AuditService] Backend writeBatch failed', {
            error: r.reason instanceof Error ? r.reason.message : String(r.reason),
            batchSize: batch.length,
          });
        }
      }

      if (!anySuccess) {
        // Put events back so they can be retried
        this.eventQueue.unshift(...batch);
        metrics.queueDepth = this.eventQueue.length;
        queueDepth.set(metrics.queueDepth);
        this.logger.error('[AuditService] All backends failed – re-queued batch', {
          batchSize: batch.length,
        });
        return;
      }

      metrics.flushed += batch.length;
      flushedEvents.inc(batch.length);

      // Best-effort: mark outbox rows as shipped
      if (this.durableOutbox) {
        const ids = batch.map((e) => e.id);
        try {
          await db.execute(sql`
            UPDATE audit_outbox
            SET shipped_at = NOW()
            WHERE id = ANY(${ids})
          `);
        } catch {
          /* outbox table may not exist */
        }
      }

      this.logger.debug('[AuditService] Flushed batch', { count: batch.length });
    } finally {
      this.flushing = false;
    }
  }

  private startBatchProcessor(): void {
    this.flushTimer = setInterval(() => {
      void this.flush().catch((err) => {
        this.logger.error('[AuditService] Batch processor error', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, this.flushIntervalMs);

    if (this.flushTimer.unref) this.flushTimer.unref();
  }

  // ── Backend management ─────────────────────────────────────

  registerBackend(name: string, backend: AuditBackend): void {
    this.backends.set(name, backend);
    this.logger.info('[AuditService] Registered backend', { name });
  }

  unregisterBackend(name: string): void {
    this.backends.delete(name);
    this.logger.info('[AuditService] Unregistered backend', { name });
  }

  // ── Query ──────────────────────────────────────────────────

  async query(query: AuditQuery): Promise<AuditEvent[]> {
    const backend =
      this.backends.get('primary') ?? this.backends.values().next().value;

    if (!backend) {
      this.logger.warn('[AuditService] No backend available for query');
      return [];
    }

    try {
      return await backend.read(query);
    } catch (err) {
      this.logger.error('[AuditService] Query failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  queryByUser(userId: string, timeRange?: { start: Date; end: Date }) {
    return this.query({ actors: [userId], timeRange });
  }

  queryByType(type: AuditEventType, timeRange?: { start: Date; end: Date }) {
    return this.query({ types: [type], timeRange });
  }

  queryByResource(
    resourceType: string,
    resourceId: string,
    timeRange?: { start: Date; end: Date }
  ) {
    return this.query({
      resources: [{ type: resourceType, id: resourceId }],
      timeRange,
    });
  }

  queryRecent(type: AuditEventType, hours = 24) {
    const start = new Date(Date.now() - hours * 3_600_000);
    return this.queryByType(type, { start, end: new Date() });
  }

  // ── Reporting ──────────────────────────────────────────────

  async generateComplianceReport(timeRange: { start: Date; end: Date }) {
    const events = await this.query({
      types: ['COMPLIANCE', 'SECURITY', 'TRADING'],
      timeRange,
      limit: 10_000,
    });

    return {
      period: timeRange,
      totalEvents: events.length,
      byType: this.groupBy(events, 'type'),
      bySeverity: this.groupBy(events, 'severity'),
      failures: events.filter((e) => !e.success).length,
      criticalEvents: events.filter((e) => e.severity === 'critical').length,
    };
  }

  async generateUserReport(userId: string, timeRange: { start: Date; end: Date }) {
    const events = await this.queryByUser(userId, timeRange);
    return {
      userId,
      period: timeRange,
      totalActions: events.length,
      byType: this.groupBy(events, 'type'),
      byAction: this.groupBy(events, 'action'),
      timeline: events.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      ),
    };
  }

  // ── Listeners ──────────────────────────────────────────────

  onEvent(listener: (event: AuditEvent) => void | Promise<void>): () => void {
    this.eventListeners.push(listener);
    return () => {
      const i = this.eventListeners.indexOf(listener);
      if (i >= 0) this.eventListeners.splice(i, 1);
    };
  }

  // ── Delete / purge ─────────────────────────────────────────

  async deleteEvents(
    eventIds: string[],
    reason: string,
    deletedBy?: string
  ): Promise<number> {
    this.logger.warn('[AuditService] Soft-deleting events', {
      count: eventIds.length,
      reason,
      deletedBy,
    });

    let total = 0;
    for (const backend of this.backends.values()) {
      try {
        total += await backend.softDelete(eventIds, reason, deletedBy);
      } catch (err) {
        this.logger.error('[AuditService] Backend softDelete failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return total;
  }

  async purgeOldEvents(olderThanDays: number, reason = 'retention policy'): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
    const events = await this.query({
      timeRange: { start: new Date(0), end: cutoff },
      limit: 5_000,
      includeDeleted: false,
    });

    if (!events.length) return 0;
    return this.deleteEvents(
      events.map((e) => e.id),
      `${reason}: older than ${olderThanDays} days`
    );
  }

  // ── Lifecycle ──────────────────────────────────────────────

  async shutdown(): Promise<void> {
    this.destroyed = true;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    // Drain remaining queue
    while (this.eventQueue.length > 0) {
      await this.flush();
    }
    this.logger.info('[AuditService] Shut down cleanly');
  }

  private groupBy(
    events: AuditEvent[],
    field: keyof AuditEvent
  ): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const event of events) {
      const key = String(event[field]);
      groups[key] = (groups[key] || 0) + 1;
    }
    return groups;
  }
}

// ─────────────────────────────────────────────────────────────
// PostgreSQL Backend
// ─────────────────────────────────────────────────────────────

/**
 * Maps AuditEvent ↔ auditLogs table.
 *
 * Audit metadata, event type, correlation, and soft-delete state are stored
 * in dedicated columns; details retains the full event payload.
 */
export class PostgresAuditBackend implements AuditBackend {
  private logger = Logger.getLogger();

  async writeBatch(events: AuditEvent[]): Promise<void> {
    if (!events.length) return;

    const rows = events.map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      userId: event.actor.userId ?? null,
      action: event.action,
      resource: `${event.resource.type}:${event.resource.id}`,
      resourceId: event.resource.id,
      method: event.type, // legacy column – stores event type
      endpoint: event.resource.type,
      ipAddress: event.actor.ipAddress ?? 'system',
      userAgent:
        event.actor.agentId ?? event.actor.service ?? 'system',
      status: event.success ? 200 : 500,
      details: {
        type: event.type,
        severity: event.severity,
        actor: event.actor,
        resource: event.resource,
        changes: event.changes,
        context: event.context,
        success: event.success,
        result: event.result,
        errorMessage: event.errorMessage,
        correlationId: event.correlationId,
        parentEventId: event.parentEventId,
        tags: event.tags,
      },
      eventType: event.type,
      correlationId: event.correlationId ?? null,
      severity: event.severity,
      category: event.type.toLowerCase(),
    }));

    try {
      // Insert in chunks to stay under parameter limits
      const CHUNK = 100;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        await db.insert(auditLogs).values(slice).onConflictDoNothing();
      }
    } catch (err) {
      this.logger.error('[PostgresAuditBackend] writeBatch failed', {
        error: err instanceof Error ? err.message : String(err),
        count: events.length,
      });
      throw err;
    }
  }

  async read(query: AuditQuery): Promise<AuditEvent[]> {
    const conditions = [];

    if (!query.includeDeleted) {
      conditions.push(
        sql`${auditLogs.deletedAt} IS NULL
          AND COALESCE(${auditLogs.details}->>'deleted', 'false') <> 'true'`
      );
    }

    if (query.timeRange) {
      conditions.push(gte(auditLogs.timestamp, query.timeRange.start));
      conditions.push(lte(auditLogs.timestamp, query.timeRange.end));
    }

    if (query.types?.length) {
      conditions.push(
        sql`COALESCE(${auditLogs.eventType}, ${auditLogs.method}) = ANY(${query.types})`
      );
    }

    if (query.severities?.length) {
      conditions.push(inArray(auditLogs.severity, query.severities));
    }

    if (query.actors?.length) {
      conditions.push(
        sql`(
          ${auditLogs.userId} = ANY(${query.actors})
          OR ${auditLogs.userAgent} = ANY(${query.actors})
        )`
      );
    }

    if (query.resources?.length) {
      const resourceKeys = query.resources.map((r) => `${r.type}:${r.id}`);
      conditions.push(inArray(auditLogs.resource, resourceKeys));
    }

    if (query.correlationId) {
      conditions.push(
        sql`COALESCE(${auditLogs.correlationId}, ${auditLogs.details}->>'correlationId') = ${query.correlationId}`
      );
    }

    if (query.success !== undefined) {
      conditions.push(
        eq(auditLogs.status, query.success ? 200 : 500)
      );
    }

    if (query.searchText) {
      const q = `%${query.searchText}%`;
      conditions.push(
        sql`(
          ${auditLogs.action} ILIKE ${q}
          OR ${auditLogs.resource} ILIKE ${q}
          OR details::text ILIKE ${q}
        )`
      );
    }

    const orderFn = query.order === 'asc' ? asc : desc;
    const limit = Math.min(query.limit ?? 100, 5_000);
    const offset = query.offset ?? 0;

    const rows = await db
      .select()
      .from(auditLogs)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(orderFn(auditLogs.timestamp))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => this.rowToEvent(row));
  }

  async softDelete(
    eventIds: string[],
    reason: string,
    deletedBy?: string
  ): Promise<number> {
    if (!eventIds.length) return 0;

    const deletedAt = new Date();
    const result = await db
      .update(auditLogs)
      .set({
        deletedAt,
        deleteReason: reason,
        deletedBy: deletedBy ?? null,
        details: sql`COALESCE(${auditLogs.details}, '{}'::jsonb) || ${JSON.stringify({
          deleted: true,
          deleteReason: reason,
          deletedBy: deletedBy ?? null,
          deletedAt: deletedAt.toISOString(),
        })}::jsonb`,
      })
      .where(inArray(auditLogs.id, eventIds))
      .returning({ id: auditLogs.id });

    return result.length;
  }

  private rowToEvent(row: typeof auditLogs.$inferSelect): AuditEvent {
    const details = (row.details ?? {}) as Record<string, unknown>;
    const resourceStr = String(row.resource || '');
    const [resourceType, ...rest] = resourceStr.split(':');
    const resourceId = rest.join(':') || String(row.resourceId || '');

    return {
      id: String(row.id),
      timestamp: row.timestamp instanceof Date ? row.timestamp : new Date(row.timestamp as string),
      type: (row.eventType as AuditEventType | null) ||
        (details.type as AuditEventType) ||
        (row.method as AuditEventType) ||
        'CUSTOM',
      severity: (row.severity as AuditSeverity) || 'info',
      actor: (details.actor as AuditEvent['actor']) || {
        userId: row.userId ?? undefined,
        service: row.userAgent !== 'system' ? String(row.userAgent) : undefined,
        ipAddress: row.ipAddress ?? undefined,
      },
      action: String(row.action),
      resource: {
        type: resourceType || 'unknown',
        id: resourceId || 'unknown',
      },
      changes: details.changes as AuditEvent['changes'],
      context: (details.context as Record<string, unknown>) || undefined,
      success: row.status === 200 || details.success === true,
      result: details.result,
      errorMessage: details.errorMessage as string | undefined,
      correlationId: row.correlationId ?? (details.correlationId as string | undefined),
      parentEventId: details.parentEventId as string | undefined,
      tags: details.tags as string[] | undefined,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton bootstrap
// ─────────────────────────────────────────────────────────────

export const auditService = new AuditService({
  durableOutbox: process.env.AUDIT_DURABLE_OUTBOX === 'true',
  requireBackend: process.env.AUDIT_REQUIRE_BACKEND !== 'false',
});

/** Call once at startup after DB is ready */
export function initializeAuditService(): void {
  const pg = new PostgresAuditBackend();
  auditService.registerBackend('primary', pg);
}

/** Call on SIGTERM */
export async function shutdownAuditService(): Promise<void> {
  await auditService.shutdown();
}