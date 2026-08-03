import { describe, expect, it } from 'vitest';
import { RedisSubscriptionManager } from '../services/redisSubscriptionManager';

class MockSubscriber {
  public subscribeCalls: Array<{ channel: string; listener?: Function }> = [];
  public unsubscribeCalls: Array<{ channel: string; listener?: Function }> = [];
  public pSubscribeCalls: Array<{ pattern: string; listener?: Function }> = [];
  public pUnsubscribeCalls: Array<{ pattern: string; listener?: Function }> = [];
  private readonly listeners = new Map<string, Set<(message: string, channel: string) => void>>();

  async subscribe(channel: string, listener?: (message: string, channel: string) => void) {
    this.subscribeCalls.push({ channel, listener });
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    if (listener) {
      this.listeners.get(channel)!.add(listener);
    }
  }

  async unsubscribe(channel: string, listener?: (message: string, channel: string) => void) {
    this.unsubscribeCalls.push({ channel, listener });
    const channelListeners = this.listeners.get(channel);
    if (!channelListeners) return;
    if (listener) {
      channelListeners.delete(listener);
    } else {
      channelListeners.clear();
    }
    if (channelListeners.size === 0) {
      this.listeners.delete(channel);
    }
  }

  async pSubscribe(pattern: string, listener?: (message: string, channel: string) => void) {
    this.pSubscribeCalls.push({ pattern, listener });
    if (!this.listeners.has(pattern)) {
      this.listeners.set(pattern, new Set());
    }
    if (listener) {
      this.listeners.get(pattern)!.add(listener);
    }
  }

  async pUnsubscribe(pattern: string, listener?: (message: string, channel: string) => void) {
    this.pUnsubscribeCalls.push({ pattern, listener });
    const channelListeners = this.listeners.get(pattern);
    if (!channelListeners) return;
    if (listener) {
      channelListeners.delete(listener);
    } else {
      channelListeners.clear();
    }
    if (channelListeners.size === 0) {
      this.listeners.delete(pattern);
    }
  }

  emit(channel: string, message: string) {
    for (const [pattern, listeners] of Array.from(this.listeners.entries())) {
      if (pattern === channel || (pattern.includes('*') && this.matchesPattern(pattern, channel))) {
        for (const listener of Array.from(listeners)) {
          listener(message, channel);
        }
      }
    }
  }

  private matchesPattern(pattern: string, channel: string): boolean {
    const escapedPattern = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${escapedPattern}$`).test(channel);
  }
}

describe('RedisSubscriptionManager', () => {
  it('keeps a second consumer subscribed after the first disposes', async () => {
    const subscriber = new MockSubscriber();
    const manager = new RedisSubscriptionManager(subscriber as any);

    const receivedA: string[] = [];
    const receivedB: string[] = [];

    const disposeA = await manager.subscribe('signals:price', (message) => receivedA.push(message));
    const disposeB = await manager.subscribe('signals:price', (message) => receivedB.push(message));

    expect(subscriber.subscribeCalls).toHaveLength(1);

    await disposeA();
    expect(subscriber.unsubscribeCalls).toHaveLength(0);

    subscriber.emit('signals:price', 'payload');

    expect(receivedA).toHaveLength(0);
    expect(receivedB).toEqual(['payload']);

    await disposeB();
    expect(subscriber.unsubscribeCalls).toHaveLength(1);
  });

  it('keeps a second pattern consumer subscribed after the first disposes', async () => {
    const subscriber = new MockSubscriber();
    const manager = new RedisSubscriptionManager(subscriber as any);

    const receivedA: string[] = [];
    const receivedB: string[] = [];

    const disposeA = await manager.pSubscribe('cache:*', (message) => receivedA.push(message));
    const disposeB = await manager.pSubscribe('cache:*', (message) => receivedB.push(message));

    expect(subscriber.pSubscribeCalls).toHaveLength(1);

    await disposeA();
    expect(subscriber.pUnsubscribeCalls).toHaveLength(0);

    subscriber.emit('cache:alpha', 'pattern-payload');

    expect(receivedA).toHaveLength(0);
    expect(receivedB).toEqual(['pattern-payload']);

    await disposeB();
    expect(subscriber.pUnsubscribeCalls).toHaveLength(1);
  });
});
