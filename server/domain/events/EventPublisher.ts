import { type DomainEvent } from './DomainEvent';

/**
 * Domain abstraction for publishing events.
 * Implementations (Postgres Outbox, Redis Stream) will be provided in the infrastructure layer.
 */
export interface EventPublisher {
  /**
   * Publishes a durable event within the context of a database transaction.
   * Ensures the event is only dispatched if the business transaction commits successfully.
   * 
   * @param event The domain event to persist to the outbox.
   * @param tx The database transaction context (e.g., from Drizzle).
   */
  publishDurable(event: DomainEvent, tx: unknown): Promise<void>;

  /**
   * Directly publishes an ephemeral operational event to the event bus.
   * Bypasses the transactional outbox, prioritizing speed over durability.
   * 
   * @param event The domain event to publish.
   */
  publishOperational(event: DomainEvent): Promise<void>;
}
