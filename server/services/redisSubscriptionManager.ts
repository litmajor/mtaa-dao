import type { RedisClientType } from 'redis';

type MessageListener = (message: string, channel: string) => void;
type PatternMessageListener = (message: string, channel: string) => void;

interface ChannelState {
  refCount: number;
  listeners: Set<MessageListener>;
}

interface PatternState {
  refCount: number;
  listeners: Set<PatternMessageListener>;
}

/**
 * Ref-counted adapter around a single shared Redis pub/sub connection.
 *
 * For node-redis v4/v6, the listener passed to subscribe()/pSubscribe() is the
 * actual per-subscription callback. That means the manager only needs to own
 * the lifecycle of the underlying Redis subscription (when to call subscribe/
 * unsubscribe) — it does not need to build its own manual message dispatcher.
 */
export class RedisSubscriptionManager {
  private readonly subscriber: RedisClientType;
  private readonly channelStates = new Map<string, ChannelState>();
  private readonly patternStates = new Map<string, PatternState>();

  constructor(subscriber: RedisClientType) {
    this.subscriber = subscriber;
  }

  /**
   * Subscribe to a channel. Returns an async disposer for this consumer.
   */
  async subscribe(channel: string, listener: MessageListener): Promise<() => Promise<void>> {
    let state = this.channelStates.get(channel);
    if (!state) {
      state = { refCount: 0, listeners: new Set() };
      this.channelStates.set(channel, state);
    }

    if (state.refCount === 0) {
      await this.subscriber.subscribe(channel, (message: string, channelName: string) => {
        for (const registeredListener of state!.listeners) {
          registeredListener(message, channelName);
        }
      });
    }

    state.listeners.add(listener);
    state.refCount += 1;

    let disposed = false;
    return async () => {
      if (disposed) return;
      disposed = true;

      state!.listeners.delete(listener);
      state!.refCount -= 1;

      if (state!.refCount <= 0) {
        this.channelStates.delete(channel);
        await this.subscriber.unsubscribe(channel);
      }
    };
  }

  /**
   * Subscribe to a pattern. Returns an async disposer for this consumer.
   */
  async pSubscribe(pattern: string, listener: PatternMessageListener): Promise<() => Promise<void>> {
    let state = this.patternStates.get(pattern);
    if (!state) {
      state = { refCount: 0, listeners: new Set() };
      this.patternStates.set(pattern, state);
    }

    if (state.refCount === 0) {
      await this.subscriber.pSubscribe(pattern, (message: string, channelName: string) => {
        for (const registeredListener of state!.listeners) {
          registeredListener(message, channelName);
        }
      });
    }

    state.listeners.add(listener);
    state.refCount += 1;

    let disposed = false;
    return async () => {
      if (disposed) return;
      disposed = true;

      state!.listeners.delete(listener);
      state!.refCount -= 1;

      if (state!.refCount <= 0) {
        this.patternStates.delete(pattern);
        await this.subscriber.pUnsubscribe(pattern);
      }
    };
  }

  /** Convenience for subscribing to several channels at once. */
  async subscribeMany(channels: string[], listener: MessageListener): Promise<() => Promise<void>> {
    const disposers = await Promise.all(channels.map((channel) => this.subscribe(channel, listener)));
    let disposed = false;
    return async () => {
      if (disposed) return;
      disposed = true;
      await Promise.all(disposers.map((dispose) => dispose()));
    };
  }

  /** Convenience for subscribing to several patterns at once. */
  async pSubscribeMany(patterns: string[], listener: PatternMessageListener): Promise<() => Promise<void>> {
    const disposers = await Promise.all(patterns.map((pattern) => this.pSubscribe(pattern, listener)));
    let disposed = false;
    return async () => {
      if (disposed) return;
      disposed = true;
      await Promise.all(disposers.map((dispose) => dispose()));
    };
  }

  getChannelRefCounts(): Record<string, number> {
    return Object.fromEntries(Array.from(this.channelStates.entries()).map(([channel, state]) => [channel, state.refCount]));
  }

  getPatternRefCounts(): Record<string, number> {
    return Object.fromEntries(Array.from(this.patternStates.entries()).map(([pattern, state]) => [pattern, state.refCount]));
  }
}

let singletonSubscriptionManager: RedisSubscriptionManager | null = null;

export async function getRedisSubscriptionManager(): Promise<RedisSubscriptionManager> {
  if (!singletonSubscriptionManager) {
    const { redisService } = await import('./redis');
    const subscriber = await redisService.getSubscriber();
    singletonSubscriptionManager = new RedisSubscriptionManager(subscriber);
  }
  return singletonSubscriptionManager;
}
