import { AsyncLocalStorage } from 'async_hooks';

export interface CorrelationData {
  correlationId: string;
  causationId?: string;
  actor: string;
}

const asyncLocalStorage = new AsyncLocalStorage<CorrelationData>();

export class CorrelationContext {
  /**
   * Runs the provided callback within the given correlation context.
   */
  static run<R>(data: CorrelationData, callback: () => R): R {
    return asyncLocalStorage.run(data, callback);
  }

  /**
   * Gets the current correlation context data, if any.
   */
  static get(): CorrelationData | undefined {
    return asyncLocalStorage.getStore();
  }

  /**
   * Helper to quickly grab the current correlationId.
   */
  static getCorrelationId(): string | undefined {
    return this.get()?.correlationId;
  }

  /**
   * Helper to quickly grab the current actor.
   */
  static getActor(): string | undefined {
    return this.get()?.actor;
  }

  /**
   * Helper to quickly grab the current causationId.
   */
  static getCausationId(): string | undefined {
    return this.get()?.causationId;
  }
}
