import { describe, expect, it, vi } from 'vitest';
import { OutboxMiddleware } from '../../domain/commands/middlewares/OutboxMiddleware';
import type { DomainEvent } from '../../domain/events/DomainEvent';

const event: DomainEvent = {
  id: 'event-1',
  type: 'PaymentCompleted',
  version: 1,
  aggregateType: 'Payment',
  aggregateId: 'payment-1',
  correlationId: 'correlation-1',
  causationId: 'command-1',
  actor: 'provider-webhook:mpesa',
  payload: { reference: 'payment-reference' },
  timestamp: new Date(),
};

describe('transactional outbox middleware', () => {
  it('persists successful domain events using the command transaction', async () => {
    const tx = { transactionId: 'tx-1' };
    const publishDurable = vi.fn().mockResolvedValue(undefined);
    const middleware = new OutboxMiddleware({
      publishDurable,
      publishOperational: vi.fn(),
    });

    const result = await middleware.handle(
      { id: 'command-1', type: 'CompletePayment', actor: 'user-1', correlationId: 'correlation-1', timestamp: new Date(), payload: {} },
      { tx },
      async () => ({ success: true, commandId: 'command-1', events: [event] }),
    );

    expect(result.success).toBe(true);
    expect(publishDurable).toHaveBeenCalledWith(event, tx);
  });

  it('does not persist events from failed commands', async () => {
    const publishDurable = vi.fn();
    const middleware = new OutboxMiddleware({
      publishDurable,
      publishOperational: vi.fn(),
    });

    await middleware.handle(
      { id: 'command-1', type: 'CompletePayment', actor: 'user-1', correlationId: 'correlation-1', timestamp: new Date(), payload: {} },
      { tx: {} },
      async () => ({ success: false, commandId: 'command-1', events: [event], error: 'failed' }),
    );

    expect(publishDurable).not.toHaveBeenCalled();
  });

  it('fails explicitly when a successful command has no transaction context', async () => {
    const middleware = new OutboxMiddleware({
      publishDurable: vi.fn(),
      publishOperational: vi.fn(),
    });

    await expect(middleware.handle(
      { id: 'command-1', type: 'CompletePayment', actor: 'user-1', correlationId: 'correlation-1', timestamp: new Date(), payload: {} },
      {},
      async () => ({ success: true, commandId: 'command-1', events: [event] }),
    )).rejects.toThrow('requires a transaction context');
  });
});
