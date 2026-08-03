/**
 * RedisStreamAdapter — Infrastructure adapter for Redis Streams.
 *
 * Provides typed Producer/Consumer operations over Redis Streams.
 * Uses the existing RedisConnectionManager singleton.
 *
 * Streams are separated by bounded context:
 *   stream:domain:trade
 *   stream:domain:vault
 *   stream:domain:dao
 *   stream:market:raw
 *   stream:market:candles
 *   stream:dlq
 */

import type { RedisClientType } from 'redis';
import { logger } from '../../observability/logger';

// ---------------------------------------------------------------------------
// Stream Names (Bounded Contexts)
// ---------------------------------------------------------------------------

export const StreamNames = {
  // Durable domain events
  DOMAIN_TRADE:    'stream:domain:trade',
  DOMAIN_VAULT:    'stream:domain:vault',
  DOMAIN_DAO:      'stream:domain:dao',

  // Operational market events (bypass Outbox)
  MARKET_RAW:      'stream:market:raw',
  MARKET_CANDLES:  'stream:market:candles',

  // Dead Letter Queue
  DLQ:             'stream:dlq',
} as const;

export type StreamName = typeof StreamNames[keyof typeof StreamNames];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StreamMessage {
  id: string;         // Redis stream message ID (e.g., "1627846-0")
  fields: Record<string, string>;
}

export interface PendingMessage {
  id: string;
  consumer: string;
  idleTimeMs: number;
  deliveryCount: number;
}

type RedisStreamReadEntry = {
  id: string;
  message: Record<string, string>;
} | null;

type RedisStreamReadResult = Array<{
  name: string;
  messages: RedisStreamReadEntry[];
}> | null;

type RedisPendingEntry = {
  id: string;
  owner?: string;
  consumer?: string;
  millisecondsSinceLastDelivery?: number;
  idle?: number;
  timesDelivered?: number;
  deliveriesCounter?: number;
};

type RedisClaimedEntry = {
  id: string;
  message: Record<string, string>;
};

function isRedisStreamReadEntry(entry: RedisStreamReadEntry): entry is Exclude<RedisStreamReadEntry, null> {
  return entry !== null;
}

// ---------------------------------------------------------------------------
// Producer
// ---------------------------------------------------------------------------

export class RedisStreamProducer {
  constructor(private client: RedisClientType) {}

  /**
   * Appends a message to a stream. Uses '*' for auto-generated IDs.
   * Returns the Redis-assigned message ID.
   */
  async publish(stream: StreamName, fields: Record<string, string>): Promise<string> {
    try {
      const id = await this.client.xAdd(stream, '*', fields);
      return id;
    } catch (error) {
      logger.error({
        message: 'redis.stream.publish.failed',
        stream,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Consumer
// ---------------------------------------------------------------------------

export class RedisStreamConsumer {
  constructor(private client: RedisClientType) {}

  /**
   * Ensures the consumer group exists. Idempotent — safe to call on startup.
   * `startId` controls where new groups start reading:
   *   '0' = from the beginning of the stream
   *   '$' = only new messages after group creation
   */
  async ensureGroup(stream: StreamName, group: string, startId: string = '0'): Promise<void> {
    try {
      await this.client.xGroupCreate(stream, group, startId, { MKSTREAM: true });
    } catch (error: unknown) {
      // BUSYGROUP = group already exists — safe to ignore
      if (error instanceof Error && error.message.includes('BUSYGROUP')) {
        return;
      }
      throw error;
    }
  }

  /**
   * Reads new messages for a consumer within a group.
   * `count` limits the batch size. `blockMs` is the blocking timeout (0 = forever).
   */
  async readGroup(
    stream: StreamName,
    group: string,
    consumer: string,
    count: number = 10,
    blockMs: number = 2000,
  ): Promise<StreamMessage[]> {
    try {
      const response = await this.client.xReadGroup(
        group,
        consumer,
        { key: stream, id: '>' },    // '>' = only undelivered messages
        { COUNT: count, BLOCK: blockMs },
      ) as RedisStreamReadResult;

      if (!response) return [];

      const messages: StreamMessage[] = [];
      for (const streamData of response) {
        for (const msg of streamData.messages) {
          if (!isRedisStreamReadEntry(msg)) continue;
          messages.push({
            id: msg.id,
            fields: msg.message,
          });
        }
      }
      return messages;
    } catch (error) {
      logger.error({
        message: 'redis.stream.readGroup.failed',
        stream,
        group,
        consumer,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Acknowledges successful processing of a message.
   */
  async ack(stream: StreamName, group: string, messageId: string): Promise<void> {
    await this.client.xAck(stream, group, messageId);
  }

  /**
   * Lists pending (unacknowledged) messages for a consumer group.
   */
  async pending(
    stream: StreamName,
    group: string,
    count: number = 100,
  ): Promise<PendingMessage[]> {
    try {
      const result = await this.client.xPendingRange(stream, group, '-', '+', count) as RedisPendingEntry[];

      return result.map((entry) => ({
        id: entry.id,
        consumer: entry.owner ?? entry.consumer ?? '',
        idleTimeMs: entry.millisecondsSinceLastDelivery ?? entry.idle ?? 0,
        deliveryCount: entry.timesDelivered ?? entry.deliveriesCounter ?? 0,
      }));
    } catch (error) {
      logger.error({
        message: 'redis.stream.pending.failed',
        stream,
        group,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Claims idle messages from other consumers that have stalled.
   * Used by the supervisor/recovery process.
   */
  async claim(
    stream: StreamName,
    group: string,
    consumer: string,
    minIdleMs: number,
    messageIds: string[],
  ): Promise<StreamMessage[]> {
    if (messageIds.length === 0) return [];

    try {
      const claimed = await this.client.xClaim(
        stream,
        group,
        consumer,
        minIdleMs,
        messageIds,
      ) as RedisClaimedEntry[];

      return claimed.map((msg) => ({
        id: msg.id,
        fields: msg.message,
      }));
    } catch (error) {
      logger.error({
        message: 'redis.stream.claim.failed',
        stream,
        group,
        consumer,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}
