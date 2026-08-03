import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisStreamProducer, RedisStreamConsumer, StreamNames } from '../../infrastructure/redis/RedisStreamAdapter';

// ---------------------------------------------------------------------------
// Mock Redis Client
// ---------------------------------------------------------------------------

function createMockRedisClient() {
  return {
    xAdd: vi.fn(),
    xGroupCreate: vi.fn(),
    xReadGroup: vi.fn(),
    xAck: vi.fn(),
    xPendingRange: vi.fn(),
    xClaim: vi.fn(),
  };
}

describe('Phase 1: Redis Stream Adapter', () => {
  let mockClient: ReturnType<typeof createMockRedisClient>;

  beforeEach(() => {
    mockClient = createMockRedisClient();
  });

  // -------------------------------------------------------------------------
  // Producer
  // -------------------------------------------------------------------------

  describe('RedisStreamProducer', () => {
    it('publishes a message and returns the stream ID', async () => {
      mockClient.xAdd.mockResolvedValue('1627846000000-0');
      const producer = new RedisStreamProducer(mockClient as any);

      const id = await producer.publish(StreamNames.DOMAIN_TRADE, {
        eventId: 'evt-1',
        type: 'OrderFilled',
        payload: '{"price":64000}',
      });

      expect(id).toBe('1627846000000-0');
      expect(mockClient.xAdd).toHaveBeenCalledWith(
        'stream:domain:trade',
        '*',
        { eventId: 'evt-1', type: 'OrderFilled', payload: '{"price":64000}' },
      );
    });

    it('propagates errors from Redis', async () => {
      mockClient.xAdd.mockRejectedValue(new Error('REDIS_UNAVAILABLE'));
      const producer = new RedisStreamProducer(mockClient as any);

      await expect(
        producer.publish(StreamNames.DOMAIN_VAULT, { eventId: 'evt-2' }),
      ).rejects.toThrow('REDIS_UNAVAILABLE');
    });
  });

  // -------------------------------------------------------------------------
  // Consumer
  // -------------------------------------------------------------------------

  describe('RedisStreamConsumer', () => {
    it('ensures group creation is idempotent', async () => {
      // First call: group does not exist
      mockClient.xGroupCreate.mockResolvedValue('OK');
      const consumer = new RedisStreamConsumer(mockClient as any);
      await consumer.ensureGroup(StreamNames.DOMAIN_TRADE, 'vault-worker');

      expect(mockClient.xGroupCreate).toHaveBeenCalledWith(
        'stream:domain:trade',
        'vault-worker',
        '0',
        { MKSTREAM: true },
      );
    });

    it('ignores BUSYGROUP error (group already exists)', async () => {
      mockClient.xGroupCreate.mockRejectedValue(new Error('BUSYGROUP Consumer Group name already exists'));
      const consumer = new RedisStreamConsumer(mockClient as any);

      // Should NOT throw
      await expect(
        consumer.ensureGroup(StreamNames.DOMAIN_TRADE, 'vault-worker'),
      ).resolves.toBeUndefined();
    });

    it('reads messages from a consumer group', async () => {
      mockClient.xReadGroup.mockResolvedValue([
        {
          name: 'stream:domain:trade',
          messages: [
            { id: '123-0', message: { eventId: 'evt-1', type: 'OrderFilled' } },
            { id: '124-0', message: { eventId: 'evt-2', type: 'TradeExecuted' } },
          ],
        },
      ]);

      const consumer = new RedisStreamConsumer(mockClient as any);
      const messages = await consumer.readGroup(
        StreamNames.DOMAIN_TRADE,
        'vault-worker',
        'worker-1',
        10,
        2000,
      );

      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe('123-0');
      expect(messages[0].fields.type).toBe('OrderFilled');
    });

    it('returns empty array when no messages available', async () => {
      mockClient.xReadGroup.mockResolvedValue(null);
      const consumer = new RedisStreamConsumer(mockClient as any);

      const messages = await consumer.readGroup(
        StreamNames.DOMAIN_TRADE,
        'vault-worker',
        'worker-1',
      );

      expect(messages).toEqual([]);
    });

    it('acknowledges a message', async () => {
      mockClient.xAck.mockResolvedValue(1);
      const consumer = new RedisStreamConsumer(mockClient as any);

      await consumer.ack(StreamNames.DOMAIN_TRADE, 'vault-worker', '123-0');

      expect(mockClient.xAck).toHaveBeenCalledWith(
        'stream:domain:trade',
        'vault-worker',
        '123-0',
      );
    });

    it('lists pending messages', async () => {
      mockClient.xPendingRange.mockResolvedValue([
        { id: '123-0', owner: 'worker-1', millisecondsSinceLastDelivery: 60000, timesDelivered: 3 },
      ]);

      const consumer = new RedisStreamConsumer(mockClient as any);
      const pending = await consumer.pending(StreamNames.DOMAIN_TRADE, 'vault-worker');

      expect(pending).toHaveLength(1);
      expect(pending[0].consumer).toBe('worker-1');
      expect(pending[0].deliveryCount).toBe(3);
      expect(pending[0].idleTimeMs).toBe(60000);
    });

    it('claims stalled messages from another consumer', async () => {
      mockClient.xClaim.mockResolvedValue([
        { id: '123-0', message: { eventId: 'evt-1', type: 'OrderFilled' } },
      ]);

      const consumer = new RedisStreamConsumer(mockClient as any);
      const claimed = await consumer.claim(
        StreamNames.DOMAIN_TRADE,
        'vault-worker',
        'worker-2',
        30000,
        ['123-0'],
      );

      expect(claimed).toHaveLength(1);
      expect(claimed[0].fields.type).toBe('OrderFilled');
    });

    it('returns empty array when claiming with no IDs', async () => {
      const consumer = new RedisStreamConsumer(mockClient as any);
      const claimed = await consumer.claim(
        StreamNames.DOMAIN_TRADE,
        'vault-worker',
        'worker-2',
        30000,
        [],
      );
      expect(claimed).toEqual([]);
      expect(mockClient.xClaim).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Stream Names
  // -------------------------------------------------------------------------

  describe('StreamNames', () => {
    it('contains all expected bounded context streams', () => {
      expect(StreamNames.DOMAIN_TRADE).toBe('stream:domain:trade');
      expect(StreamNames.DOMAIN_VAULT).toBe('stream:domain:vault');
      expect(StreamNames.DOMAIN_DAO).toBe('stream:domain:dao');
      expect(StreamNames.MARKET_RAW).toBe('stream:market:raw');
      expect(StreamNames.MARKET_CANDLES).toBe('stream:market:candles');
      expect(StreamNames.DLQ).toBe('stream:dlq');
    });
  });
});
