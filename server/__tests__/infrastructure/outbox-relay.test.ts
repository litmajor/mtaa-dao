import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OutboxRelayWorker,
  OutboxRepository,
  StreamPublisher,
  OutboxEvent,
  OUTBOX_CONFIG,
  resolveStream,
} from '../../infrastructure/postgres/OutboxRelayWorker';
import { StreamNames } from '../../infrastructure/redis/RedisStreamAdapter';

// ---------------------------------------------------------------------------
// In-Memory Test Doubles
// ---------------------------------------------------------------------------

function createEvent(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    eventType: 'OrderFilled',
    version: 1,
    aggregateType: 'trade',
    aggregateId: 'trade-001',
    payload: { price: 64000 },
    correlationId: 'corr-1',
    causationId: 'cmd-1',
    actor: 'agent_mirrorcore',
    publishAttempts: 0,
    ...overrides,
  };
}

class InMemoryOutboxRepo implements OutboxRepository {
  events: OutboxEvent[] = [];
  published = new Set<string>();
  failures = new Map<string, { attempts: number; error: string }>();
  quarantined = new Set<string>();

  async fetchAndLockUnpublished(batchSize: number): Promise<OutboxEvent[]> {
    return this.events
      .filter((e) => !this.published.has(e.id) && !this.quarantined.has(e.id))
      .slice(0, batchSize);
  }

  async markPublished(eventId: string): Promise<void> {
    this.published.add(eventId);
  }

  async recordFailure(eventId: string, error: string): Promise<void> {
    const existing = this.failures.get(eventId) || { attempts: 0, error: '' };
    existing.attempts++;
    existing.error = error;
    this.failures.set(eventId, existing);

    // Also increment on the event object so the relay sees the updated count
    const event = this.events.find((e) => e.id === eventId);
    if (event) event.publishAttempts++;
  }

  async quarantine(eventId: string): Promise<void> {
    this.quarantined.add(eventId);
  }
}

class MockStreamPublisher implements StreamPublisher {
  published: Array<{ stream: string; fields: Record<string, string> }> = [];
  shouldFail = false;
  failForEventIds = new Set<string>();

  async publish(stream: string, fields: Record<string, string>): Promise<string> {
    if (this.shouldFail || this.failForEventIds.has(fields.eventId)) {
      throw new Error('REDIS_UNAVAILABLE');
    }
    this.published.push({ stream, fields });
    return `${Date.now()}-0`;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Stage 5: OutboxRelayWorker', () => {
  let repo: InMemoryOutboxRepo;
  let publisher: MockStreamPublisher;
  let relay: OutboxRelayWorker;

  beforeEach(() => {
    repo = new InMemoryOutboxRepo();
    publisher = new MockStreamPublisher();
    relay = new OutboxRelayWorker(repo, publisher);
  });

  // -----------------------------------------------------------------------
  // Test 1 — Successful Publishing
  // -----------------------------------------------------------------------

  it('publishes all unpublished events and marks them published', async () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      createEvent({ id: `evt-${i}`, aggregateType: 'trade' }),
    );
    repo.events = events;

    const result = await relay.relayCycle();

    expect(result.total).toBe(5);
    expect(result.published).toBe(5);
    expect(result.failed).toBe(0);
    expect(result.quarantined).toBe(0);

    // All marked published in repo
    for (const e of events) {
      expect(repo.published.has(e.id)).toBe(true);
    }

    // All pushed to Redis
    expect(publisher.published).toHaveLength(5);

    // Verify stream routing
    for (const p of publisher.published) {
      expect(p.stream).toBe(StreamNames.DOMAIN_TRADE);
    }
  });

  it('serializes event fields correctly for Redis', async () => {
    const event = createEvent({
      id: 'evt-serial',
      eventType: 'DepositCompleted',
      aggregateType: 'vault',
      aggregateId: 'vault-001',
      correlationId: 'corr-serial',
      causationId: 'cmd-serial',
      actor: 'system',
      payload: { amount: 1000, token: 'USDC' },
    });
    repo.events = [event];

    await relay.relayCycle();

    const fields = publisher.published[0].fields;
    expect(fields.eventId).toBe('evt-serial');
    expect(fields.eventType).toBe('DepositCompleted');
    expect(fields.aggregateType).toBe('vault');
    expect(fields.correlationId).toBe('corr-serial');
    expect(fields.causationId).toBe('cmd-serial');
    expect(fields.actor).toBe('system');
    expect(JSON.parse(fields.payload)).toEqual({ amount: 1000, token: 'USDC' });
  });

  // -----------------------------------------------------------------------
  // Test 2 — Redis Failure (Scenario A)
  // -----------------------------------------------------------------------

  it('records failure when Redis is unavailable', async () => {
    repo.events = [createEvent({ id: 'evt-fail' })];
    publisher.shouldFail = true;

    const result = await relay.relayCycle();

    expect(result.total).toBe(1);
    expect(result.published).toBe(0);
    expect(result.failed).toBe(1);

    // published_at NOT set
    expect(repo.published.has('evt-fail')).toBe(false);

    // failure recorded
    const failure = repo.failures.get('evt-fail');
    expect(failure).toBeDefined();
    expect(failure!.attempts).toBe(1);
    expect(failure!.error).toBe('REDIS_UNAVAILABLE');
  });

  it('increments publish_attempts on each failure', async () => {
    const event = createEvent({ id: 'evt-retry', publishAttempts: 3 });
    repo.events = [event];
    publisher.shouldFail = true;

    await relay.relayCycle();

    // publishAttempts should have been incremented by recordFailure
    expect(event.publishAttempts).toBe(4);
  });

  // -----------------------------------------------------------------------
  // Test 3 — Duplicate Publishing Safety (Scenario B)
  // -----------------------------------------------------------------------

  it('re-publishes when markPublished fails (Scenario B)', async () => {
    const event = createEvent({ id: 'evt-scenb' });
    repo.events = [event];

    // First run: XADD succeeds, but markPublished throws
    const originalMark = repo.markPublished.bind(repo);
    let markCallCount = 0;
    repo.markPublished = async (eventId: string) => {
      markCallCount++;
      if (markCallCount === 1) throw new Error('DB_UPDATE_FAILED');
      return originalMark(eventId);
    };

    // First cycle — the event publish succeeds in Redis, but Postgres update fails.
    // Because markPublished throws, the relay catches it and records a failure.
    const result1 = await relay.relayCycle();
    expect(result1.failed).toBe(1);

    // Redis received the event once
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0].fields.eventId).toBe('evt-scenb');

    // Second cycle — re-publishes the same event (duplicate, acceptable)
    const result2 = await relay.relayCycle();
    expect(result2.published).toBe(1);

    // Redis received it twice — consumers must dedup via eventId
    expect(publisher.published).toHaveLength(2);
    expect(publisher.published[1].fields.eventId).toBe('evt-scenb');
  });

  // -----------------------------------------------------------------------
  // Test 4 — Concurrent Workers (SKIP LOCKED simulation)
  // -----------------------------------------------------------------------

  it('simulates concurrent workers with no overlap', async () => {
    // Create 10 events
    const events = Array.from({ length: 10 }, (_, i) =>
      createEvent({ id: `evt-conc-${i}` }),
    );
    repo.events = events;

    // Simulate SKIP LOCKED: override fetchAndLockUnpublished to partition
    let callCount = 0;
    const originalFetch = repo.fetchAndLockUnpublished.bind(repo);
    repo.fetchAndLockUnpublished = async (batchSize: number) => {
      const all = await originalFetch(batchSize);
      callCount++;
      // Worker A gets first half, Worker B gets second half
      if (callCount === 1) return all.slice(0, 5);
      if (callCount === 2) return all.slice(5, 10);
      return [];
    };

    const relayA = new OutboxRelayWorker(repo, publisher);
    const relayB = new OutboxRelayWorker(repo, publisher);

    const [resultA, resultB] = await Promise.all([
      relayA.relayCycle(),
      relayB.relayCycle(),
    ]);

    expect(resultA.published).toBe(5);
    expect(resultB.published).toBe(5);
    expect(publisher.published).toHaveLength(10);

    // Verify no duplicate event IDs published
    const publishedIds = publisher.published.map((p) => p.fields.eventId);
    expect(new Set(publishedIds).size).toBe(10);
  });

  // -----------------------------------------------------------------------
  // Test 5 — Poison Event Quarantine
  // -----------------------------------------------------------------------

  it('quarantines poison events that exceed MAX_PUBLISH_ATTEMPTS', async () => {
    const poisonEvent = createEvent({
      id: 'evt-poison',
      publishAttempts: OUTBOX_CONFIG.MAX_PUBLISH_ATTEMPTS, // Already at limit
    });
    repo.events = [poisonEvent];

    const result = await relay.relayCycle();

    expect(result.quarantined).toBe(1);
    expect(result.published).toBe(0);
    expect(result.failed).toBe(0);

    // Event is quarantined in repo
    expect(repo.quarantined.has('evt-poison')).toBe(true);

    // DLQ received the notification
    const dlqMessages = publisher.published.filter(
      (p) => p.stream === StreamNames.DLQ,
    );
    expect(dlqMessages).toHaveLength(1);
    expect(dlqMessages[0].fields.eventId).toBe('evt-poison');
    expect(dlqMessages[0].fields.reason).toContain('MAX_PUBLISH_ATTEMPTS');
  });

  it('quarantines without blocking when DLQ publish fails', async () => {
    const poisonEvent = createEvent({
      id: 'evt-poison-nodlq',
      publishAttempts: OUTBOX_CONFIG.MAX_PUBLISH_ATTEMPTS,
    });
    repo.events = [poisonEvent];

    // DLQ publish also fails
    publisher.failForEventIds.add('evt-poison-nodlq');

    const result = await relay.relayCycle();

    // Still quarantined despite DLQ failure
    expect(result.quarantined).toBe(1);
    expect(repo.quarantined.has('evt-poison-nodlq')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Stream Routing
  // -----------------------------------------------------------------------

  it('routes events to the correct bounded context stream', async () => {
    repo.events = [
      createEvent({ id: 'evt-t', aggregateType: 'trade' }),
      createEvent({ id: 'evt-v', aggregateType: 'vault' }),
      createEvent({ id: 'evt-d', aggregateType: 'dao' }),
      createEvent({ id: 'evt-o', aggregateType: 'order' }),
      createEvent({ id: 'evt-u', aggregateType: 'unknown' }),
    ];

    await relay.relayCycle();

    const streamMap = new Map(
      publisher.published.map((p) => [p.fields.eventId, p.stream]),
    );
    expect(streamMap.get('evt-t')).toBe(StreamNames.DOMAIN_TRADE);
    expect(streamMap.get('evt-v')).toBe(StreamNames.DOMAIN_VAULT);
    expect(streamMap.get('evt-d')).toBe(StreamNames.DOMAIN_DAO);
    expect(streamMap.get('evt-o')).toBe(StreamNames.DOMAIN_TRADE); // order → trade
    expect(streamMap.get('evt-u')).toBe(StreamNames.DOMAIN_DAO);   // fallback
  });

  // -----------------------------------------------------------------------
  // Empty Batch
  // -----------------------------------------------------------------------

  it('returns zero-result on empty outbox', async () => {
    const result = await relay.relayCycle();
    expect(result.total).toBe(0);
    expect(result.published).toBe(0);
    expect(publisher.published).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // resolveStream unit
  // -----------------------------------------------------------------------

  it('resolveStream maps aggregate types case-insensitively', () => {
    expect(resolveStream('Trade')).toBe(StreamNames.DOMAIN_TRADE);
    expect(resolveStream('VAULT')).toBe(StreamNames.DOMAIN_VAULT);
    expect(resolveStream('DAO')).toBe(StreamNames.DOMAIN_DAO);
    expect(resolveStream('Order')).toBe(StreamNames.DOMAIN_TRADE);
    expect(resolveStream('anything_else')).toBe(StreamNames.DOMAIN_DAO);
  });
});
