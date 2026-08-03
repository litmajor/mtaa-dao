import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  IdempotencyGuard,
  StreamAcknowledger,
  GuardResult,
} from '../../infrastructure/consumers/IdempotencyGuard';
import {
  ProcessedEventRepository,
  ProcessedEventRecord,
  ConsumerEventStatus,
  ClaimResult,
  assertConsumerTransition,
} from '../../infrastructure/postgres/ProcessedEventRepository';
import {
  ConsumerRecoveryJob,
} from '../../infrastructure/consumers/ConsumerRecoveryJob';

// ---------------------------------------------------------------------------
// In-Memory ProcessedEventRepository
// ---------------------------------------------------------------------------

class InMemoryProcessedEventRepo implements ProcessedEventRepository {
  records = new Map<string, ProcessedEventRecord>();

  private key(eventId: string, consumer: string) {
    return `${eventId}::${consumer}`;
  }

  async claimEvent(eventId: string, consumerName: string, streamMsgId?: string): Promise<ClaimResult> {
    const k = this.key(eventId, consumerName);
    if (this.records.has(k)) {
      return { claimed: false, existingStatus: this.records.get(k)!.status };
    }
    this.records.set(k, {
      eventId,
      consumerName,
      status: 'RECEIVED',
      streamMessageId: streamMsgId || null,
      receivedAt: new Date(),
      processingStartedAt: null,
      processedAt: null,
      retryCount: 0,
      lastError: null,
    });
    return { claimed: true };
  }

  async markProcessing(eventId: string, consumerName: string): Promise<void> {
    const r = this.records.get(this.key(eventId, consumerName));
    if (!r) throw new Error('RECORD_NOT_FOUND');
    assertConsumerTransition(r.status, 'PROCESSING');
    r.status = 'PROCESSING';
    r.processingStartedAt = new Date();
  }

  async markCompleted(eventId: string, consumerName: string): Promise<void> {
    const r = this.records.get(this.key(eventId, consumerName));
    if (!r) throw new Error('RECORD_NOT_FOUND');
    assertConsumerTransition(r.status, 'COMPLETED');
    r.status = 'COMPLETED';
    r.processedAt = new Date();
  }

  async markFailed(eventId: string, consumerName: string, error: string): Promise<void> {
    const r = this.records.get(this.key(eventId, consumerName));
    if (!r) throw new Error('RECORD_NOT_FOUND');
    assertConsumerTransition(r.status, 'FAILED');
    r.status = 'FAILED';
    r.retryCount++;
    r.lastError = error;
  }

  async getStatus(eventId: string, consumerName: string): Promise<ProcessedEventRecord | null> {
    return this.records.get(this.key(eventId, consumerName)) || null;
  }

  async findStalled(consumerName: string, stalledThresholdMs: number): Promise<ProcessedEventRecord[]> {
    const now = Date.now();
    const results: ProcessedEventRecord[] = [];
    for (const r of this.records.values()) {
      if (
        r.consumerName === consumerName &&
        r.status === 'PROCESSING' &&
        r.processingStartedAt &&
        now - r.processingStartedAt.getTime() > stalledThresholdMs
      ) {
        results.push(r);
      }
    }
    return results;
  }

  async retryFailed(eventId: string, consumerName: string): Promise<void> {
    const r = this.records.get(this.key(eventId, consumerName));
    if (!r) throw new Error('RECORD_NOT_FOUND');
    assertConsumerTransition(r.status, 'PROCESSING');
    r.status = 'PROCESSING';
    r.processingStartedAt = new Date();
  }
}

// ---------------------------------------------------------------------------
// Mock Acknowledger
// ---------------------------------------------------------------------------

class MockAcknowledger implements StreamAcknowledger {
  ackedIds: string[] = [];
  async ack(streamMsgId: string) {
    this.ackedIds.push(streamMsgId);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Stage 6: Consumer Idempotency Guard', () => {
  let repo: InMemoryProcessedEventRepo;
  let acker: MockAcknowledger;
  let guard: IdempotencyGuard;

  beforeEach(() => {
    repo = new InMemoryProcessedEventRepo();
    acker = new MockAcknowledger();
    guard = new IdempotencyGuard(repo, acker, { maxRetries: 3, stalledThresholdMs: 100 });
  });

  // -----------------------------------------------------------------------
  // Happy Path
  // -----------------------------------------------------------------------

  it('processes a new event exactly once', async () => {
    let handlerCalls = 0;
    const result = await guard.execute('evt-1', 'portfolio-service', 'stream-msg-1', async () => {
      handlerCalls++;
    });

    expect(result.executed).toBe(true);
    expect(result.skipped).toBe(false);
    expect(handlerCalls).toBe(1);

    // Record is COMPLETED
    const record = await repo.getStatus('evt-1', 'portfolio-service');
    expect(record!.status).toBe('COMPLETED');

    // Stream message acknowledged
    expect(acker.ackedIds).toContain('stream-msg-1');
  });

  // -----------------------------------------------------------------------
  // Duplicate Delivery
  // -----------------------------------------------------------------------

  it('skips duplicate delivery of an already-completed event', async () => {
    let handlerCalls = 0;
    const handler = async () => { handlerCalls++; };

    // First delivery
    await guard.execute('evt-2', 'portfolio-service', 'msg-a', handler);
    expect(handlerCalls).toBe(1);

    // Second delivery (duplicate from Redis)
    const result = await guard.execute('evt-2', 'portfolio-service', 'msg-b', handler);

    expect(result.executed).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('ALREADY_COMPLETED');
    expect(handlerCalls).toBe(1); // NOT re-executed

    // Duplicate ACK'd
    expect(acker.ackedIds).toContain('msg-b');
  });

  it('allows different consumers to independently process the same event', async () => {
    let portfolioCalls = 0;
    let riskCalls = 0;

    await guard.execute('evt-3', 'portfolio-service', 'msg-1', async () => { portfolioCalls++; });
    await guard.execute('evt-3', 'risk-engine', 'msg-2', async () => { riskCalls++; });

    expect(portfolioCalls).toBe(1);
    expect(riskCalls).toBe(1);

    const p = await repo.getStatus('evt-3', 'portfolio-service');
    const r = await repo.getStatus('evt-3', 'risk-engine');
    expect(p!.status).toBe('COMPLETED');
    expect(r!.status).toBe('COMPLETED');
  });

  // -----------------------------------------------------------------------
  // Failed Transaction Rollback
  // -----------------------------------------------------------------------

  it('marks FAILED when handler throws and does NOT ack', async () => {
    const result = await guard.execute('evt-4', 'portfolio-service', 'msg-fail', async () => {
      throw new Error('DATABASE_TIMEOUT');
    });

    expect(result.executed).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.error).toBe('DATABASE_TIMEOUT');

    const record = await repo.getStatus('evt-4', 'portfolio-service');
    expect(record!.status).toBe('FAILED');
    expect(record!.retryCount).toBe(1);
    expect(record!.lastError).toBe('DATABASE_TIMEOUT');

    // Message NOT ack'd — stays pending in Redis for redelivery
    expect(acker.ackedIds).not.toContain('msg-fail');
  });

  // -----------------------------------------------------------------------
  // Crash During Processing (Stalled Reclaim)
  // -----------------------------------------------------------------------

  it('reclaims a stalled PROCESSING event after threshold', async () => {
    // Simulate: worker claimed event, transitioned to PROCESSING, then crashed
    await repo.claimEvent('evt-5', 'portfolio-service', 'msg-stalled');
    await repo.markProcessing('evt-5', 'portfolio-service');

    // Backdate processingStartedAt to simulate a crash 200ms ago
    const record = repo.records.get('evt-5::portfolio-service')!;
    record.processingStartedAt = new Date(Date.now() - 200); // Past threshold (100ms)

    // Recovery worker picks up duplicate delivery
    let handlerCalls = 0;
    const result = await guard.execute('evt-5', 'portfolio-service', 'msg-reclaimed', async () => {
      handlerCalls++;
    });

    expect(result.executed).toBe(true);
    expect(handlerCalls).toBe(1);

    const final = await repo.getStatus('evt-5', 'portfolio-service');
    expect(final!.status).toBe('COMPLETED');
    expect(acker.ackedIds).toContain('msg-reclaimed');
  });

  it('does NOT reclaim PROCESSING event within threshold', async () => {
    // Simulate: another worker is actively processing (recently started)
    await repo.claimEvent('evt-6', 'portfolio-service', 'msg-active');
    await repo.markProcessing('evt-6', 'portfolio-service');

    // processingStartedAt is NOW — within threshold
    const result = await guard.execute('evt-6', 'portfolio-service', 'msg-dup', async () => {
      throw new Error('SHOULD NOT RUN');
    });

    expect(result.executed).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('CURRENTLY_PROCESSING');
  });

  // -----------------------------------------------------------------------
  // Retry Budget
  // -----------------------------------------------------------------------

  it('retries FAILED events up to maxRetries', async () => {
    let attempts = 0;

    // First attempt: fails
    await guard.execute('evt-7', 'portfolio-service', 'msg-r1', async () => {
      attempts++;
      if (attempts < 3) throw new Error(`FAIL_${attempts}`);
    });
    expect(attempts).toBe(1);

    // Second attempt: fails again
    await guard.execute('evt-7', 'portfolio-service', 'msg-r2', async () => {
      attempts++;
      if (attempts < 3) throw new Error(`FAIL_${attempts}`);
    });
    expect(attempts).toBe(2);

    // Third attempt: succeeds
    const result = await guard.execute('evt-7', 'portfolio-service', 'msg-r3', async () => {
      attempts++;
    });
    expect(attempts).toBe(3);
    expect(result.executed).toBe(true);
  });

  it('stops retrying after maxRetries exhausted', async () => {
    // Exhaust all 3 retries
    for (let i = 0; i < 3; i++) {
      await guard.execute('evt-8', 'portfolio-service', `msg-x${i}`, async () => {
        throw new Error('ALWAYS_FAILS');
      });
    }

    const record = await repo.getStatus('evt-8', 'portfolio-service');
    expect(record!.retryCount).toBe(3);

    // 4th attempt should be rejected
    let handlerCalled = false;
    const result = await guard.execute('evt-8', 'portfolio-service', 'msg-x4', async () => {
      handlerCalled = true;
    });

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('RETRIES_EXHAUSTED');
    expect(handlerCalled).toBe(false);
    // The exhausted message IS ack'd to prevent infinite redelivery
    expect(acker.ackedIds).toContain('msg-x4');
  });

  // -----------------------------------------------------------------------
  // Consumer State Machine Transitions
  // -----------------------------------------------------------------------

  it('state machine: COMPLETED → PROCESSING is forbidden', () => {
    expect(() => assertConsumerTransition('COMPLETED', 'PROCESSING')).toThrow('ILLEGAL_CONSUMER_TRANSITION');
  });

  it('state machine: FAILED → PROCESSING is allowed (retry)', () => {
    expect(() => assertConsumerTransition('FAILED', 'PROCESSING')).not.toThrow();
  });

  it('state machine: RECEIVED → COMPLETED is forbidden (must go through PROCESSING)', () => {
    expect(() => assertConsumerTransition('RECEIVED', 'COMPLETED')).toThrow('ILLEGAL_CONSUMER_TRANSITION');
  });

  // -----------------------------------------------------------------------
  // streamMessageId Tracing
  // -----------------------------------------------------------------------

  it('stores streamMessageId in the processed event record', async () => {
    await guard.execute('evt-9', 'portfolio-service', '1711648222334-0', async () => {});

    const record = await repo.getStatus('evt-9', 'portfolio-service');
    expect(record!.streamMessageId).toBe('1711648222334-0');
  });
});

// ---------------------------------------------------------------------------
// ConsumerRecoveryJob Tests
// ---------------------------------------------------------------------------

describe('Stage 6: ConsumerRecoveryJob', () => {
  it('finds and claims stalled messages via XPENDING + XCLAIM', async () => {
    const mockStreamConsumer = {
      pending: vi.fn().mockResolvedValue([
        { id: 'msg-stalled-1', consumer: 'worker-1', idleTimeMs: 600_000, deliveryCount: 3 },
        { id: 'msg-fresh', consumer: 'worker-2', idleTimeMs: 1_000, deliveryCount: 1 },
      ]),
      claim: vi.fn().mockResolvedValue([
        { id: 'msg-stalled-1', fields: { eventId: 'evt-stalled-1', eventType: 'OrderFilled' } },
      ]),
      ensureGroup: vi.fn(),
      readGroup: vi.fn(),
      ack: vi.fn(),
    };

    const mockRepo = {
      findStalled: vi.fn().mockResolvedValue([]),
      markFailed: vi.fn(),
    } as any;

    const recoveredIds: string[] = [];
    const job = new ConsumerRecoveryJob(mockStreamConsumer as any, mockRepo, {
      stalledThresholdMs: 300_000,
      claimBatchSize: 50,
    });

    const result = await job.recover(
      'stream:domain:trade' as any,
      'vault-worker',
      async (eventId, streamMsgId) => { recoveredIds.push(eventId); },
    );

    expect(result.pendingFound).toBe(2);
    expect(result.stalledFound).toBe(1); // Only msg-stalled-1 exceeds threshold
    expect(result.claimed).toBe(1);
    expect(recoveredIds).toContain('evt-stalled-1');

    // XCLAIM was called with correct args
    expect(mockStreamConsumer.claim).toHaveBeenCalledWith(
      'stream:domain:trade',
      'vault-worker',
      'recovery-worker',
      300_000,
      ['msg-stalled-1'],
    );
  });

  it('marks stalled DB records as FAILED for retry', async () => {
    const stalledRecord = {
      eventId: 'evt-db-stalled',
      consumerName: 'portfolio-service',
      status: 'PROCESSING' as const,
      streamMessageId: 'msg-old',
      receivedAt: new Date(),
      processingStartedAt: new Date(Date.now() - 600_000),
      processedAt: null,
      retryCount: 1,
      lastError: null,
    };

    const mockRepo: any = {
      findStalled: vi.fn().mockResolvedValue([stalledRecord]),
      markFailed: vi.fn(),
    };

    const job = new ConsumerRecoveryJob({} as any, mockRepo, {
      stalledThresholdMs: 300_000,
    });

    const count = await job.recoverStalledDbRecords('portfolio-service');

    expect(count).toBe(1);
    expect(mockRepo.markFailed).toHaveBeenCalledWith(
      'evt-db-stalled',
      'portfolio-service',
      expect.stringContaining('STALLED_RECOVERY'),
    );
  });

  it('returns zero when no pending messages exist', async () => {
    const mockStreamConsumer = {
      pending: vi.fn().mockResolvedValue([]),
      claim: vi.fn(),
    };

    const job = new ConsumerRecoveryJob(mockStreamConsumer as any, {} as any);
    const result = await job.recover('stream:domain:trade' as any, 'vault-worker');

    expect(result.pendingFound).toBe(0);
    expect(result.claimed).toBe(0);
    expect(mockStreamConsumer.claim).not.toHaveBeenCalled();
  });
});
