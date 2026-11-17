/**
 * Outbox Relay Worker Entry Point
 *
 * Manages the polling lifecycle of the OutboxRelayWorker:
 *  - Configurable poll interval and batch size
 *  - Graceful SIGTERM / SIGINT shutdown
 *  - Correlation context per cycle
 *  - Back-pressure: skips cycle if previous is still running
 */

import { randomUUID } from 'crypto';
import {OutboxRelayWorker} from '../infrastructure/postgres/OutboxRelayWorker';
import type { OutboxRepository, StreamPublisher } from '../infrastructure/postgres/OutboxRelayWorker';
import { getRedisInstanceAsync } from '../config/redisConnectionManager';
import { RedisStreamProducer } from '../infrastructure/redis/RedisStreamAdapter';
import { PostgresOutboxRepository } from '../infrastructure/postgres/PostgresOutboxRepository';
import { logger } from '../observability/logger';
import { CorrelationContext } from '../observability/CorrelationContext';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface OutboxWorkerConfig {
  /** Milliseconds between relay cycles */
  pollIntervalMs: number;
  /** Passed through to OutboxRelayWorker (max rows per cycle) */
  batchSize?: number;
}

const DEFAULT_CONFIG: OutboxWorkerConfig = {
  pollIntervalMs: 500,
};

// ---------------------------------------------------------------------------
// Worker Lifecycle
// ---------------------------------------------------------------------------

export class OutboxWorker {
  private relay: OutboxRelayWorker;
  private config: OutboxWorkerConfig;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private shuttingDown = false;

  constructor(
    repo: OutboxRepository,
    publisher: StreamPublisher,
    config: Partial<OutboxWorkerConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.relay = new OutboxRelayWorker(repo, publisher);
  }

  /**
   * Starts the polling loop. Safe to call multiple times (idempotent).
   */
  start(): void {
    if (this.timer) return;

    logger.info({
      message: 'outbox.worker.started',
      pollIntervalMs: this.config.pollIntervalMs,
    });

    this.timer = setInterval(() => this.tick(), this.config.pollIntervalMs);

    // Graceful shutdown hooks
    const shutdown = () => this.stop();
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  }

  /**
   * Stops the polling loop and waits for any in-flight cycle to complete.
   */
  async stop(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;

    logger.info({ message: 'outbox.worker.stopping' });

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    // Wait for in-flight cycle
    const maxWaitMs = 10_000;
    const start = Date.now();
    while (this.running && Date.now() - start < maxWaitMs) {
      await new Promise((r) => setTimeout(r, 50));
    }

    logger.info({ message: 'outbox.worker.stopped' });
  }

  /**
   * Single tick of the polling loop.
   * Skipped if a previous cycle is still in-flight (back-pressure).
   */
  private async tick(): Promise<void> {
    if (this.running || this.shuttingDown) return;
    this.running = true;

    try {
      await CorrelationContext.run(
        {
          correlationId: randomUUID(),
          actor: 'system:outbox-relay',
        },
        async () => {
          const result = await this.relay.relayCycle();
          if (result.total > 0) {
            logger.info({
              message: 'outbox.cycle.complete',
              ...result,
            });
          }
        },
      );
    } catch (error) {
      logger.error({
        message: 'outbox.cycle.error',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.running = false;
    }
  }
}

let activeWorker: OutboxWorker | null = null;
let initializationRetry: ReturnType<typeof setTimeout> | null = null;
let initializationAttempt = 0;
let initializationInProgress = false;
let shuttingDown = false;

export async function initializeOutboxWorker(): Promise<boolean> {
  if (activeWorker) return true;
  if (shuttingDown || initializationInProgress) return false;

  initializationInProgress = true;
  try {
    const redis = await getRedisInstanceAsync();
    activeWorker = new OutboxWorker(
      new PostgresOutboxRepository(),
      new RedisStreamProducer(redis),
    );
    activeWorker.start();
    initializationAttempt = 0;
    if (initializationRetry) {
      clearTimeout(initializationRetry);
      initializationRetry = null;
    }
    return true;
  } catch (error) {
    initializationAttempt += 1;
    const delayMs = Math.min(60_000, 1_000 * (2 ** Math.min(initializationAttempt - 1, 6)));
    logger.warn({
      message: 'outbox.worker.initialization.deferred',
      error: error instanceof Error ? error.message : String(error),
      retryInMs: delayMs,
      attempt: initializationAttempt,
    });
    initializationRetry = setTimeout(() => {
      initializationRetry = null;
      void initializeOutboxWorker();
    }, delayMs);
    initializationRetry.unref?.();
    return false;
  } finally {
    initializationInProgress = false;
  }
}

export async function shutdownOutboxWorker(): Promise<void> {
  shuttingDown = true;
  if (initializationRetry) {
    clearTimeout(initializationRetry);
    initializationRetry = null;
  }
  if (activeWorker) {
    await activeWorker.stop();
    activeWorker = null;
  }
  initializationAttempt = 0;
}
