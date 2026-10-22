import { getRedisInstanceAsync } from '../config/redisConnectionManager';
import { RedisStreamConsumer, StreamNames } from '../infrastructure/redis/RedisStreamAdapter';
import { IdempotencyGuard } from '../infrastructure/consumers/IdempotencyGuard';
import type {StreamAcknowledger} from '../infrastructure/consumers/IdempotencyGuard';
import { DrizzleProcessedEventRepository } from '../infrastructure/postgres/DrizzleProcessedEventRepository';
import { triggerDAOSpawnFromPayment } from '../services/daoSpawnService';
import { logger } from '../utils/logger';
import { EventCatalog } from '../domain/events/catalog';

const STREAM_NAME = StreamNames.DOMAIN_DAO;
const CONSUMER_GROUP = 'payment-completed-group';
const CONSUMER_NAME = 'payment-completed-worker';
const READ_COUNT = 10;
const POLL_INTERVAL_MS = 2500;
const BLOCK_MS = 2000;

class RedisAcknowledger implements StreamAcknowledger {
  constructor(
    private consumer: RedisStreamConsumer,
    private stream: typeof STREAM_NAME,
    private group: string,
  ) {}

  async ack(streamMessageId: string): Promise<void> {
    await this.consumer.ack(this.stream, this.group, streamMessageId);
  }
}

export class PaymentCompletedConsumerWorker {
  private consumer: RedisStreamConsumer;
  private guard: IdempotencyGuard;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private static retryTimer: ReturnType<typeof setTimeout> | null = null;
  private static initializationInProgress = false;
  private static shuttingDown = false;
  private static retryAttempt = 0;

  constructor(redisClient: Awaited<ReturnType<typeof getRedisInstanceAsync>>) {
    this.consumer = new RedisStreamConsumer(redisClient);
    this.guard = new IdempotencyGuard(
      new DrizzleProcessedEventRepository(),
      new RedisAcknowledger(this.consumer, STREAM_NAME, CONSUMER_GROUP),
      { maxRetries: 3, stalledThresholdMs: 5 * 60 * 1000 },
    );
  }

  static async initialize(): Promise<boolean> {
    if (this.instance) return true;
    if (this.initializationInProgress || this.shuttingDown) return false;
    this.initializationInProgress = true;
    let blockingClient: Awaited<ReturnType<typeof getRedisInstanceAsync>> | null = null;

    try {
      // XREADGROUP BLOCK holds its connection for up to BLOCK_MS, so it must not
      // run on the shared singleton: every other command (rate limits, cache)
      // would queue behind it and hit the command timeout.
      const shared = await getRedisInstanceAsync();
      blockingClient = shared.duplicate() as typeof shared;
      blockingClient.on('error', (err: Error) => {
        logger.debug('[PaymentCompletedConsumer] Blocking client error', { error: err.message });
      });
      await blockingClient.connect();

      const worker = new PaymentCompletedConsumerWorker(blockingClient);
      await worker.start();
      this.blockingClient = blockingClient;
      this.instance = worker;
      this.retryAttempt = 0;
      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }
      return true;
    } catch (error) {
      await blockingClient?.close().catch(() => undefined);
      const baseDelayMs = Math.min(60_000, 1_000 * (2 ** Math.min(this.retryAttempt, 6)));
      const delayMs = Math.min(
        60_000,
        baseDelayMs + Math.floor(Math.random() * Math.min(10_000, baseDelayMs * 0.2)),
      );
      this.retryAttempt += 1;
      logger.warn('[PaymentCompletedConsumer] Redis unavailable; retrying worker initialization', {
        error: error instanceof Error ? error.message : String(error),
        retryInMs: delayMs,
        attempt: this.retryAttempt,
      });
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        void this.initialize();
      }, delayMs);
      this.retryTimer.unref?.();
      return false;
    } finally {
      this.initializationInProgress = false;
    }
  }

  static async shutdown(): Promise<void> {
    this.shuttingDown = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.instance) {
      await this.instance.stop();
      this.instance = null;
    }
    if (this.blockingClient) {
      await this.blockingClient.close().catch(() => undefined);
      this.blockingClient = null;
    }
    this.retryAttempt = 0;
  }

  private static instance: PaymentCompletedConsumerWorker | null = null;
  private static blockingClient: Awaited<ReturnType<typeof getRedisInstanceAsync>> | null = null;

  async start(): Promise<void> {
    await this.consumer.ensureGroup(STREAM_NAME, CONSUMER_GROUP, '$');

    logger.info('[PaymentCompletedConsumer] Consumer group ensured', {
      stream: STREAM_NAME,
      group: CONSUMER_GROUP,
      consumer: CONSUMER_NAME,
    });

    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
    logger.info('[PaymentCompletedConsumer] Started polling loop');
  }

  async stop(): Promise<void> {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    logger.info('[PaymentCompletedConsumer] Stopped polling loop');
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const messages = await this.consumer.readGroup(
        STREAM_NAME,
        CONSUMER_GROUP,
        CONSUMER_NAME,
        READ_COUNT,
        BLOCK_MS,
      );

      if (messages.length === 0) {
        return;
      }

      for (const message of messages) {
        try {
          await this.handleMessage(message);
        } catch (error: any) {
          logger.error('[PaymentCompletedConsumer] Message handling failed', {
            streamMessageId: message.id,
            error: error?.message ?? String(error),
          });
        }
      }
    } catch (error: any) {
      logger.error('[PaymentCompletedConsumer] Redis readGroup failed', {
        error: error?.message ?? String(error),
      });
    } finally {
      this.running = false;
    }
  }

  private async handleMessage(message: { id: string; fields: Record<string, string> }): Promise<void> {
    const eventId = message.fields.eventId;
    if (!eventId) {
      logger.warn('[PaymentCompletedConsumer] Missing eventId on stream message', {
        streamMessageId: message.id,
      });
      await this.consumer.ack(STREAM_NAME, CONSUMER_GROUP, message.id);
      return;
    }

    const eventType = message.fields.eventType;
    if (eventType !== EventCatalog.PaymentCompleted) {
      logger.info('[PaymentCompletedConsumer] Skipping non-payment event', {
        streamMessageId: message.id,
        eventType,
      });
      await this.consumer.ack(STREAM_NAME, CONSUMER_GROUP, message.id);
      return;
    }

    let payload: any;
    try {
      payload = JSON.parse(message.fields.payload);
    } catch (error: any) {
      logger.error('[PaymentCompletedConsumer] Failed to parse event payload', {
        streamMessageId: message.id,
        error: error?.message ?? String(error),
      });
      await this.consumer.ack(STREAM_NAME, CONSUMER_GROUP, message.id);
      return;
    }

    const reference = payload?.reference;
    if (!reference || typeof reference !== 'string') {
      logger.error('[PaymentCompletedConsumer] PaymentCompleted event missing reference', {
        eventId,
        streamMessageId: message.id,
      });
      await this.consumer.ack(STREAM_NAME, CONSUMER_GROUP, message.id);
      return;
    }

    await this.guard.execute(eventId, CONSUMER_NAME, message.id, async () => {
      await triggerDAOSpawnFromPayment(reference);
    });
  }
}
