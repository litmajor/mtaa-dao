/**
 * IdempotencyGuard — Consumer-side safety wrapper for event processing.
 *
 * Ensures every (eventId, consumerName) pair is processed exactly once,
 * even under at-least-once delivery from Redis Streams.
 *
 * Two patterns supported:
 *
 * 1. Database Mutations (transactional):
 *    BEGIN → INSERT processed_events → business mutation → COMMIT → XACK
 *
 * 2. External Side Effects (non-transactional):
 *    INSERT PROCESSING → execute external call with idempotency key →
 *    COMPLETE → XACK
 *    On retry: check external system state first, never blindly re-execute.
 */

import { logger } from '../../observability/logger';
import type {
  ProcessedEventRepository,
  ConsumerEventStatus,
} from '../postgres/ProcessedEventRepository';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface IdempotencyGuardConfig {
  /** Max retries before giving up on a failed event */
  maxRetries: number;
  /** How long (ms) a PROCESSING event can be stalled before recovery claims it */
  stalledThresholdMs: number;
}

const DEFAULT_CONFIG: IdempotencyGuardConfig = {
  maxRetries: 3,
  stalledThresholdMs: 5 * 60 * 1000, // 5 minutes
};

// ---------------------------------------------------------------------------
// Guard Result
// ---------------------------------------------------------------------------

export interface GuardResult {
  executed: boolean;
  skipped: boolean;
  reason?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Stream Acknowledger Port
// ---------------------------------------------------------------------------

export interface StreamAcknowledger {
  ack(streamMessageId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// IdempotencyGuard
// ---------------------------------------------------------------------------

export class IdempotencyGuard {
  private config: IdempotencyGuardConfig;

  constructor(
    private repo: ProcessedEventRepository,
    private acknowledger: StreamAcknowledger,
    config: Partial<IdempotencyGuardConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Wraps event processing with idempotency guarantees.
   *
   * @param eventId       The domain event ID (from domain_events.id)
   * @param consumerName  The consumer identity (e.g., "portfolio-service")
   * @param streamMsgId   The Redis stream message ID (for XACK + tracing)
   * @param handler       The business logic to execute exactly once
   */
  async execute(
    eventId: string,
    consumerName: string,
    streamMsgId: string,
    handler: () => Promise<void>,
  ): Promise<GuardResult> {
    // 1. Attempt to claim the event
    const claim = await this.repo.claimEvent(eventId, consumerName, streamMsgId);

    if (!claim.claimed) {
      return this.handleExistingRecord(eventId, consumerName, streamMsgId, claim.existingStatus!, handler);
    }

    // 2. Fresh event — transition RECEIVED → PROCESSING → execute → COMPLETED
    return this.processEvent(eventId, consumerName, streamMsgId, handler);
  }

  /**
   * Handles the case where a record already exists for (eventId, consumerName).
   */
  private async handleExistingRecord(
    eventId: string,
    consumerName: string,
    streamMsgId: string,
    existingStatus: ConsumerEventStatus,
    handler: () => Promise<void>,
  ): Promise<GuardResult> {
    switch (existingStatus) {
      case 'COMPLETED':
        // Already processed — just ACK the duplicate delivery
        await this.safeAck(streamMsgId);
        logger.info({
          message: 'idempotency.duplicate.skipped',
          eventId,
          consumerName,
          existingStatus,
        });
        return { executed: false, skipped: true, reason: 'ALREADY_COMPLETED' };

      case 'FAILED': {
        // Check retry budget
        const record = await this.repo.getStatus(eventId, consumerName);
        if (record && record.retryCount >= this.config.maxRetries) {
          await this.safeAck(streamMsgId);
          logger.error({
            message: 'idempotency.retries.exhausted',
            eventId,
            consumerName,
            retryCount: record.retryCount,
          });
          return { executed: false, skipped: true, reason: 'RETRIES_EXHAUSTED' };
        }

        // Retry: FAILED → PROCESSING → execute
        await this.repo.retryFailed(eventId, consumerName);
        return this.processEvent(eventId, consumerName, streamMsgId, handler, true);
      }

      case 'PROCESSING': {
        // Stalled check: if it's been PROCESSING too long, the original worker is dead
        const record = await this.repo.getStatus(eventId, consumerName);
        if (record?.processingStartedAt) {
          const elapsed = Date.now() - record.processingStartedAt.getTime();
          if (elapsed > this.config.stalledThresholdMs) {
            // Claim from dead worker: mark FAILED then retry
            logger.warn({
              message: 'idempotency.stalled.reclaimed',
              eventId,
              consumerName,
              stalledMs: elapsed,
            });
            await this.repo.markFailed(eventId, consumerName, 'STALLED_RECLAIMED');
            await this.repo.retryFailed(eventId, consumerName);
            return this.processEvent(eventId, consumerName, streamMsgId, handler, true);
          }
        }

        // Still actively processing by another worker — skip
        logger.info({
          message: 'idempotency.concurrent.skipped',
          eventId,
          consumerName,
        });
        return { executed: false, skipped: true, reason: 'CURRENTLY_PROCESSING' };
      }

      case 'RECEIVED':
        // Race condition: claimed but not yet transitioned. Treat as concurrent.
        return { executed: false, skipped: true, reason: 'CURRENTLY_PROCESSING' };

      default:
        return { executed: false, skipped: true, reason: `UNKNOWN_STATUS: ${existingStatus}` };
    }
  }

  /**
   * Core processing flow: RECEIVED → PROCESSING → handler() → COMPLETED.
   */
  private async processEvent(
    eventId: string,
    consumerName: string,
    streamMsgId: string,
    handler: () => Promise<void>,
    skipMarkProcessing: boolean = false,
  ): Promise<GuardResult> {
    // Transition to PROCESSING
    if (!skipMarkProcessing) {
      await this.repo.markProcessing(eventId, consumerName);
    }

    try {
      // Execute the business logic
      await handler();

      // Mark COMPLETED
      await this.repo.markCompleted(eventId, consumerName);

      // ACK the Redis stream message
      await this.safeAck(streamMsgId);

      logger.info({
        message: 'idempotency.event.processed',
        eventId,
        consumerName,
        streamMsgId,
      });

      return { executed: true, skipped: false };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Mark FAILED — the message stays pending in Redis for redelivery
      await this.repo.markFailed(eventId, consumerName, errorMsg);

      logger.error({
        message: 'idempotency.event.failed',
        eventId,
        consumerName,
        error: errorMsg,
      });

      return { executed: false, skipped: false, error: errorMsg };
    }
  }

  /**
   * Safe ACK — never let an ACK failure crash the consumer.
   */
  private async safeAck(streamMsgId: string): Promise<void> {
    try {
      await this.acknowledger.ack(streamMsgId);
    } catch (error) {
      logger.warn({
        message: 'idempotency.ack.failed',
        streamMsgId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
