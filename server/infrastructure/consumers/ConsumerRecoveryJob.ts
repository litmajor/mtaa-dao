/**
 * ConsumerRecoveryJob — Recovers stalled event processing across consumers.
 *
 * Responsibilities:
 *   1. XPENDING — find messages idle longer than threshold
 *   2. XCLAIM   — take ownership from dead consumers
 *   3. Re-dispatch claimed messages through the IdempotencyGuard
 *
 * Designed to run on a periodic schedule (e.g., every 60s).
 */

import { logger } from '../../observability/logger';
import type { ProcessedEventRepository } from '../postgres/ProcessedEventRepository';
import { type RedisStreamConsumer} from '../redis/RedisStreamAdapter';
import type {StreamName } from '../redis/RedisStreamAdapter';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ConsumerRecoveryConfig {
  /** Messages idle longer than this (ms) are considered stalled */
  stalledThresholdMs: number;
  /** Max messages to claim per recovery cycle */
  claimBatchSize: number;
  /** Consumer name used by the recovery worker for XCLAIM */
  recoveryConsumerName: string;
}

const DEFAULT_CONFIG: ConsumerRecoveryConfig = {
  stalledThresholdMs: 5 * 60 * 1000, // 5 minutes
  claimBatchSize: 50,
  recoveryConsumerName: 'recovery-worker',
};

// ---------------------------------------------------------------------------
// Recovery Result
// ---------------------------------------------------------------------------

export interface RecoveryResult {
  pendingFound: number;
  stalledFound: number;
  claimed: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// ConsumerRecoveryJob
// ---------------------------------------------------------------------------

export class ConsumerRecoveryJob {
  private config: ConsumerRecoveryConfig;

  constructor(
    private streamConsumer: RedisStreamConsumer,
    private processedEventRepo: ProcessedEventRepository,
    config: Partial<ConsumerRecoveryConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Runs a single recovery cycle for a specific stream + consumer group.
   *
   * @param stream  The Redis stream to inspect
   * @param group   The consumer group name
   * @param onRecovered  Callback invoked for each recovered message
   */
  async recover(
    stream: StreamName,
    group: string,
    onRecovered?: (eventId: string, streamMsgId: string) => Promise<void>,
  ): Promise<RecoveryResult> {
    const result: RecoveryResult = { pendingFound: 0, stalledFound: 0, claimed: 0, errors: 0 };

    // 1. Inspect pending messages
    const pending = await this.streamConsumer.pending(stream, group, this.config.claimBatchSize);
    result.pendingFound = pending.length;

    if (pending.length === 0) return result;

    // 2. Filter for stalled messages
    const stalled = pending.filter((p) => p.idleTimeMs >= this.config.stalledThresholdMs);
    result.stalledFound = stalled.length;

    if (stalled.length === 0) return result;

    logger.warn({
      message: 'consumer.recovery.stalled_found',
      stream,
      group,
      stalledCount: stalled.length,
      stalledIds: stalled.map((s) => s.id),
    });

    // 3. XCLAIM stalled messages
    const stalledIds = stalled.map((s) => s.id);
    const claimed = await this.streamConsumer.claim(
      stream,
      group,
      this.config.recoveryConsumerName,
      this.config.stalledThresholdMs,
      stalledIds,
    );

    result.claimed = claimed.length;

    // 4. Re-dispatch claimed messages
    for (const msg of claimed) {
      try {
        const eventId = msg.fields.eventId;
        if (!eventId) {
          logger.warn({
            message: 'consumer.recovery.missing_eventId',
            streamMsgId: msg.id,
            stream,
          });
          result.errors++;
          continue;
        }

        if (onRecovered) {
          await onRecovered(eventId, msg.id);
        }

        logger.info({
          message: 'consumer.recovery.message_reclaimed',
          eventId,
          streamMsgId: msg.id,
          stream,
          group,
        });
      } catch (error) {
        logger.error({
          message: 'consumer.recovery.dispatch_failed',
          streamMsgId: msg.id,
          error: error instanceof Error ? error.message : String(error),
        });
        result.errors++;
      }
    }

    return result;
  }

  /**
   * Finds events stuck in PROCESSING in the database layer
   * (complements the Redis-level XPENDING scan).
   */
  async recoverStalledDbRecords(consumerName: string): Promise<number> {
    const stalled = await this.processedEventRepo.findStalled(
      consumerName,
      this.config.stalledThresholdMs,
    );

    for (const record of stalled) {
      try {
        await this.processedEventRepo.markFailed(
          record.eventId,
          record.consumerName,
          'STALLED_RECOVERY: processing exceeded threshold',
        );

        logger.warn({
          message: 'consumer.recovery.db_stalled_marked_failed',
          eventId: record.eventId,
          consumerName: record.consumerName,
          processingStartedAt: record.processingStartedAt,
        });
      } catch (error) {
        logger.error({
          message: 'consumer.recovery.db_stalled_mark_failed_error',
          eventId: record.eventId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return stalled.length;
  }
}
