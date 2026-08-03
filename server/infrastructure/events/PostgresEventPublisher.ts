import type { EventPublisher } from '../../domain/events/EventPublisher';
import type { DomainEvent } from '../../domain/events/DomainEvent';
import { domainEvents } from '../../db/schema/eda';

export class PostgresEventPublisher implements EventPublisher {
  /**
   * Publishes a durable event within the context of a database transaction.
   * Ensures the event is only dispatched if the business transaction commits successfully.
   */
  async publishDurable(event: DomainEvent, tx: any): Promise<void> {
    await tx.insert(domainEvents).values({
      id: event.id,
      eventType: event.type,
      version: event.version,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload,
      correlationId: event.correlationId,
      causationId: event.causationId,
      actor: event.actor,
      createdAt: event.timestamp,
    });
  }

  /**
   * Directly publishes an ephemeral operational event to the event bus.
   * Bypasses the transactional outbox, prioritizing speed over durability.
   */
  async publishOperational(event: DomainEvent): Promise<void> {
    // For Phase 1, we will mock this. In a real system, this could publish directly to Redis.
    console.log(`[Operational Event] Published ${event.type} for aggregate ${event.aggregateId}`);
  }
}
