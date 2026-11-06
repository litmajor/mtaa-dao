import { describe, expect, it, vi } from 'vitest';
import { MessageBusAdapter } from '../core/agents/gateway/message-bus';

describe('Gateway message bus subscriptions', () => {
  it('registers a single request handler and removes it idempotently', async () => {
    const messageBus = new MessageBusAdapter();
    const handler = vi.fn(async () => undefined);
    const unsubscribe = messageBus.subscribe('gateway:price_request', handler);

    expect(messageBus.getStats().activeSubscriptions).toEqual([
      { type: 'gateway:price_request', handlerCount: 1 },
    ]);

    await messageBus.publish(MessageBusAdapter.createRequest('price', { symbols: ['BTC/USD'] }));
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    unsubscribe();
    expect(messageBus.getStats().activeSubscriptions).toEqual([]);
    expect(messageBus.getStats().subscriptions).toBe(0);
  });
});
