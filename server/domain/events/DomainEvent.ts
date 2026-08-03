export interface EventMetadata {
  source: string;
  environment: string;
  schemaVersion: number;
  [key: string]: string | number | boolean | undefined; // Allow custom metadata
}

export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  version: number;
  aggregateType: string;
  aggregateId: string;
  correlationId: string;
  causationId?: string;
  actor: string;
  timestamp: Date;
  payload: T;
  metadata: EventMetadata;
}
