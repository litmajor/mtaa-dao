/**
 * OutboxRelayWorker — Moves durable domain events from PostgreSQL to Redis Streams.
 *
 * Guarantees:
 *  - Events are never lost (PostgreSQL is the source of truth).
 *  - Duplicate delivery is acceptable (consumers handle idempotency).
 *  - FOR UPDATE SKIP LOCKED ensures safe multi-worker concurrency.
 *  - Poison events are quarantined after MAX_PUBLISH_ATTEMPTS.
 *
 * This class is the pure relay engine. The polling loop and lifecycle are
 * managed by the worker entry-point (workers/outbox.worker.ts).
 */

import { logger } from '../../observability/logger';
import { StreamNames } from '../redis/RedisStreamAdapter';
import type {StreamName} from '../redis/RedisStreamAdapter';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const OUTBOX_CONFIG = {
  /** Max rows fetched per relay cycle */
  BATCH_SIZE: 100,
  /** After this many publish failures the event is quarantined */
  MAX_PUBLISH_ATTEMPTS: 10,
} as const;

// ---------------------------------------------------------------------------
// Aggregate → Stream Router
// ---------------------------------------------------------------------------

const AGGREGATE_STREAM_MAP: Record<string, StreamName> = {
  order:  StreamNames.DOMAIN_TRADE,
  trade:  StreamNames.DOMAIN_TRADE,
  vault:  StreamNames.DOMAIN_VAULT,
  dao:    StreamNames.DOMAIN_DAO,
};

export function resolveStream(aggregateType: string): StreamName {
  return AGGREGATE_STREAM_MAP[aggregateType.toLowerCase()] || StreamNames.DOMAIN_DAO;
}

// ---------------------------------------------------------------------------
// Port Interfaces (Dependency Inversion)
// ---------------------------------------------------------------------------

/** A single unpublished outbox row */
export interface OutboxEvent {
  id: string;
  eventType: string;
  version: number;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  correlationId: string;
  causationId: string | null;
  actor: string;
  publishAttempts: number;
}

/**
 * Database port — hides Drizzle/pg from the relay engine.
 * Implementations wrap Drizzle queries + raw SQL for SKIP LOCKED.
 */
export interface OutboxRepository {
  /**
   * Fetches and row-locks unpublished events.
   * Must use: SELECT ... WHERE published_at IS NULL
   *           ORDER BY created_at ASC LIMIT $batchSize
   *           FOR UPDATE SKIP LOCKED
   */
  fetchAndLockUnpublished(batchSize: number): Promise<OutboxEvent[]>;

  /**
   * Marks a single event as successfully published.
   * Sets published_at = NOW().
   */
  markPublished(eventId: string): Promise<void>;

  /**
   * Records a publish failure: increments publish_attempts,
   * stamps last_publish_attempt, stores last_publish_error.
   */
  recordFailure(eventId: string, error: string): Promise<void>;

  /**
   * Quarantines a poison event (publish_attempts >= MAX).
   * Implementations may move it to a separate table or set a flag.
   * The event MUST be excluded from future fetchAndLockUnpublished calls.
   */
  quarantine(eventId: string): Promise<void>;
}

/**
 * Redis Stream port — hides the Redis client from the relay engine.
 */
export interface StreamPublisher {
  publish(stream: StreamName, fields: Record<string, string>): Promise<string>;
}

// ---------------------------------------------------------------------------
// Relay Result Types
// ---------------------------------------------------------------------------

export interface RelayBatchResult {
  published: number;
  failed: number;
  quarantined: number;
  total: number;
}

// ---------------------------------------------------------------------------
// OutboxRelayWorker
// ---------------------------------------------------------------------------

export class OutboxRelayWorker {
  constructor(
    private repo: OutboxRepository,
    private publisher: StreamPublisher,
  ) {}

  /**
   * Executes a single relay cycle:
   *   1. Fetch + lock unpublished events
   *   2. Publish each to its bounded-context Redis stream
   *   3. Mark published or record failure
   *   4. Quarantine poison events
   */
  async relayCycle(): Promise<RelayBatchResult> {
    const result: RelayBatchResult = { published: 0, failed: 0, quarantined: 0, total: 0 };

    let events: OutboxEvent[];
    try {
      events = await this.repo.fetchAndLockUnpublished(OUTBOX_CONFIG.BATCH_SIZE);
    } catch (error) {
      logger.error({
        message: 'outbox.fetch.failed',
        error: error instanceof Error ? error.message : String(error),
      });
      return result;
    }

    result.total = events.length;
    if (events.length === 0) return result;

    for (const event of events) {
      // Check for poison threshold BEFORE attempting publish
      if (event.publishAttempts >= OUTBOX_CONFIG.MAX_PUBLISH_ATTEMPTS) {
        await this.handlePoison(event);
        result.quarantined++;
        continue;
      }

      try {
        const stream = resolveStream(event.aggregateType);
        const fields = this.serializeEvent(event);

        await this.publisher.publish(stream, fields);

        // Scenario B safety: if markPublished fails after XADD succeeds,
        // the next relay cycle will re-publish. Consumers handle dedup.
        await this.repo.markPublished(event.id);

        logger.info({
          message: 'outbox.event.published',
          eventId: event.id,
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          stream,
          attempt: event.publishAttempts + 1,
        });

        result.published++;
      } catch (error) {
        // Scenario A: Redis unavailable — record failure, continue
        const errorMsg = error instanceof Error ? error.message : String(error);

        try {
          await this.repo.recordFailure(event.id, errorMsg);
        } catch (dbError) {
          // If even the failure recording fails, log and move on.
          // The row lock will be released when the transaction ends.
          logger.error({
            message: 'outbox.recordFailure.failed',
            eventId: event.id,
            originalError: errorMsg,
            dbError: dbError instanceof Error ? dbError.message : String(dbError),
          });
        }

        logger.error({
          message: 'outbox.publish.failed',
          eventId: event.id,
          eventType: event.eventType,
          error: errorMsg,
          attempt: event.publishAttempts + 1,
        });

        result.failed++;
      }
    }

    return result;
  }

  /**
   * Quarantines a poison event and publishes it to the DLQ for alerting.
   */
  private async handlePoison(event: OutboxEvent): Promise<void> {
    try {
      // Attempt to push a notification to the DLQ stream
      await this.publisher.publish(StreamNames.DLQ, {
        eventId: event.id,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        reason: `Exceeded MAX_PUBLISH_ATTEMPTS (${OUTBOX_CONFIG.MAX_PUBLISH_ATTEMPTS})`,
        lastAttempt: String(event.publishAttempts),
      });
    } catch {
      // DLQ publish failure should not block quarantine
    }

    await this.repo.quarantine(event.id);

    logger.error({
      message: 'outbox.event.quarantined',
      eventId: event.id,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      publishAttempts: event.publishAttempts,
    });
  }

  /**
   * Serializes an OutboxEvent into flat string fields for Redis XADD.
   * The financial identity is the domain event ID, NOT the Redis stream message ID.
   */
  private serializeEvent(event: OutboxEvent): Record<string, string> {
    return {
      eventId:       event.id,
      eventType:     event.eventType,
      version:       String(event.version),
      aggregateType: event.aggregateType,
      aggregateId:   event.aggregateId,
      correlationId: event.correlationId,
      causationId:   event.causationId || '',
      actor:         event.actor,
      payload:       JSON.stringify(event.payload),
    };
  }
}
