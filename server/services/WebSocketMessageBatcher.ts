/**
 * WebSocket Message Batcher
 * Batches frequent WebSocket messages to reduce overhead and bandwidth
 * 
 * Features:
 * - Batch similar messages (trades, quotes, updates)
 * - Debounce rapid updates
 * - Configurable batch sizes and timeouts
 * - Automatic flushing based on time or size
 */

interface BatchedMessage {
  type: string;
  items: any[];
  timestamp: number;
}

interface BatchConfig {
  handler: (batch: BatchedMessage) => void;
  maxSize?: number;           // Max items before forced flush
  maxWaitMs?: number;         // Max time before flush
  debounceMs?: number;        // Debounce consecutive updates
}

export class WebSocketMessageBatcher {
  private batches: Map<string, BatchedMessage> = new Map();
  private configs: Map<string, BatchConfig> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private lastUpdate: Map<string, number> = new Map();

  private readonly DEFAULT_MAX_SIZE = 100;
  private readonly DEFAULT_MAX_WAIT_MS = 50;
  private readonly DEFAULT_DEBOUNCE_MS = 10;

  /**
   * Register a message type for batching
   */
  public registerBatch(type: string, config: BatchConfig): void {
    this.configs.set(type, {
      maxSize: config.maxSize || this.DEFAULT_MAX_SIZE,
      maxWaitMs: config.maxWaitMs || this.DEFAULT_MAX_WAIT_MS,
      debounceMs: config.debounceMs || this.DEFAULT_DEBOUNCE_MS,
      handler: config.handler
    });
  }

  /**
   * Add message to batch
   */
  public addMessage(type: string, item: any): boolean {
    const config = this.configs.get(type);
    if (!config) return false;

    // Check debounce
    const lastTime = this.lastUpdate.get(type) || 0;
    if (Date.now() - lastTime < config.debounceMs!) {
      return false; // Too recent, skip
    }
    this.lastUpdate.set(type, Date.now());

    // Get or create batch
    let batch = this.batches.get(type);
    if (!batch) {
      batch = {
        type,
        items: [],
        timestamp: Date.now()
      };
      this.batches.set(type, batch);
    }

    // Add item to batch
    batch.items.push(item);

    // Clear existing timer
    const existingTimer = this.timers.get(type);
    if (existingTimer) clearTimeout(existingTimer);

    // Check if should flush immediately
    if (batch.items.length >= config.maxSize!) {
      this.flush(type);
      return true;
    }

    // Set new timer for eventual flush
    const timer = setTimeout(() => {
      this.flush(type);
    }, config.maxWaitMs!);
    this.timers.set(type, timer);

    return true;
  }

  /**
   * Flush a batch
   */
  public flush(type: string): void {
    const batch = this.batches.get(type);
    const config = this.configs.get(type);

    if (!batch || !config || batch.items.length === 0) return;

    try {
      config.handler(batch);
    } catch (error) {
      console.error(`[MessageBatcher] Error flushing ${type}:`, error);
    }

    // Clear
    this.batches.delete(type);
    const timer = this.timers.get(type);
    if (timer) clearTimeout(timer);
    this.timers.delete(type);
  }

  /**
   * Flush all batches
   */
  public flushAll(): void {
    this.configs.forEach((_, type) => {
      this.flush(type);
    });
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.flushAll();
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.batches.clear();
    this.configs.clear();
    this.lastUpdate.clear();
  }
}
