import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
}));

vi.mock('../../db', () => ({
  pool: {
    query: state.query,
    connect: state.connect,
  },
}));

import { PostgresOutboxRepository } from '../../infrastructure/postgres/PostgresOutboxRepository';

describe('PostgresOutboxRepository', () => {
  const repository = new PostgresOutboxRepository();

  beforeEach(() => {
    state.query.mockReset();
    state.connect.mockReset();
  });

  it('claims unpublished events with a durable lease and skip-locked selection', async () => {
    state.query.mockResolvedValueOnce({
      rows: [{
        id: 'event-1',
        eventType: 'PaymentCompleted',
        version: 1,
        aggregateType: 'Payment',
        aggregateId: 'payment-1',
        payload: { reference: 'payment-reference' },
        correlationId: 'correlation-1',
        causationId: 'command-1',
        actor: 'provider-webhook:mpesa',
        publishAttempts: 0,
        claimToken: 'claim-1',
      }],
    });

    const events = await repository.fetchAndLockUnpublished(25);

    expect(events).toHaveLength(1);
    expect(events[0].claimToken).toBe('claim-1');
    expect(state.query.mock.calls[0][0]).toContain('FOR UPDATE SKIP LOCKED');
    expect(state.query.mock.calls[0][0]).toContain('claim_until');
    expect(state.query.mock.calls[0][1][0]).toBe(25);
  });

  it('requires ownership of the claim before marking an event published', async () => {
    state.query.mockResolvedValueOnce({ rowCount: 0 });

    await expect(repository.markPublished('event-1', 'stale-claim'))
      .rejects.toThrow('OUTBOX_CLAIM_LOST');

    expect(state.query.mock.calls[0][1]).toEqual(['event-1', 'stale-claim']);
  });

  it('releases the claim and records a retryable publish failure', async () => {
    state.query.mockResolvedValueOnce({ rowCount: 1 });

    await repository.recordFailure('event-1', 'Redis unavailable', 'claim-1');

    expect(state.query.mock.calls[0][0]).toContain('publish_attempts = publish_attempts + 1');
    expect(state.query.mock.calls[0][0]).toContain('claim_token = NULL');
    expect(state.query.mock.calls[0][1]).toEqual(['event-1', 'claim-1', 'Redis unavailable']);
  });

  it('writes a dead letter and quarantines a poison event atomically', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          rows: [{
            id: 'event-1',
            eventType: 'PaymentCompleted',
            aggregateType: 'Payment',
            aggregateId: 'payment-1',
            payload: { reference: 'payment-reference' },
            correlationId: 'correlation-1',
            actor: 'provider-webhook:mpesa',
            publishAttempts: 10,
          }],
        })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined),
      release: vi.fn(),
    };
    state.connect.mockResolvedValueOnce(client);

    await repository.quarantine('event-1', 'claim-1');

    expect(client.query.mock.calls.map(([sql]) => sql.trim())).toEqual([
      'BEGIN',
      expect.stringContaining('UPDATE domain_events'),
      expect.stringContaining('INSERT INTO event_dead_letters'),
      'COMMIT',
    ]);
    expect(client.query.mock.calls[1][1]).toEqual(['event-1', 'claim-1']);
    expect(client.release).toHaveBeenCalledOnce();
  });
});
