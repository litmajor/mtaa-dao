/**
 * Represents a request to alter the state of the system.
 */
export interface Command<T = unknown> {
  id: string; // UUID, client-provided for idempotency
  type: string;
  actor: string;
  correlationId: string;
  timestamp: Date;
  payload: T;
}
