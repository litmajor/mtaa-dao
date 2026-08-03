/**
 * ProcessedEventRepository — Port interface for consumer idempotency storage.
 *
 * Defines the contract for tracking event processing state per consumer.
 * Infrastructure implementations (Drizzle/pg) are provided separately.
 *
 * State Machine:
 *
 *   ┌──────────┐
 *   │ RECEIVED │
 *   └────┬─────┘
 *        │
 *   ┌────▼──────┐
 *   │ PROCESSING│
 *   └──┬─────┬──┘
 *      │     │
 * ┌────▼──┐ ┌▼───────┐
 * │COMPLETED│ │ FAILED │
 * └────────┘ └────────┘
 */

export type ConsumerEventStatus = 'RECEIVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

const ALLOWED_CONSUMER_TRANSITIONS: Record<ConsumerEventStatus, ConsumerEventStatus[]> = {
  RECEIVED:   ['PROCESSING'],
  PROCESSING: ['COMPLETED', 'FAILED'],
  COMPLETED:  [],
  FAILED:     ['PROCESSING'], // Allow retry: FAILED → PROCESSING
};

export function assertConsumerTransition(from: ConsumerEventStatus, to: ConsumerEventStatus): void {
  if (!ALLOWED_CONSUMER_TRANSITIONS[from].includes(to)) {
    throw new Error(`ILLEGAL_CONSUMER_TRANSITION: ${from} → ${to}`);
  }
}

export interface ProcessedEventRecord {
  eventId: string;
  consumerName: string;
  status: ConsumerEventStatus;
  streamMessageId: string | null;
  receivedAt: Date;
  processingStartedAt: Date | null;
  processedAt: Date | null;
  retryCount: number;
  lastError: string | null;
}

export interface ClaimResult {
  claimed: boolean;
  existingStatus?: ConsumerEventStatus;
}

export interface ProcessedEventRepository {
  /**
   * Atomically inserts a RECEIVED record for (eventId, consumerName).
   * Returns { claimed: true } if this consumer has never seen this event.
   * Returns { claimed: false, existingStatus } if a record already exists.
   */
  claimEvent(
    eventId: string,
    consumerName: string,
    streamMessageId?: string,
  ): Promise<ClaimResult>;

  /**
   * Transitions RECEIVED → PROCESSING.
   * Sets processingStartedAt = NOW().
   */
  markProcessing(eventId: string, consumerName: string): Promise<void>;

  /**
   * Transitions PROCESSING → COMPLETED.
   * Sets processedAt = NOW().
   */
  markCompleted(eventId: string, consumerName: string): Promise<void>;

  /**
   * Transitions PROCESSING → FAILED.
   * Increments retryCount, stores error.
   */
  markFailed(eventId: string, consumerName: string, error: string): Promise<void>;

  /**
   * Fetches the current state of a processed event record.
   */
  getStatus(eventId: string, consumerName: string): Promise<ProcessedEventRecord | null>;

  /**
   * Finds events stuck in PROCESSING for longer than stalledThresholdMs.
   * Used by the recovery worker.
   */
  findStalled(consumerName: string, stalledThresholdMs: number): Promise<ProcessedEventRecord[]>;

  /**
   * Transitions FAILED → PROCESSING for retry.
   * Enforced by the state machine guard.
   */
  retryFailed(eventId: string, consumerName: string): Promise<void>;
}
