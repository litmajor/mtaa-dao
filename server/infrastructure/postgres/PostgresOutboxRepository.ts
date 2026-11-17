import { randomUUID } from 'crypto';
import { pool } from '../../db';
import type { OutboxEvent, OutboxRepository } from './OutboxRelayWorker';

const CLAIM_LEASE_MS = 60_000;

interface OutboxRow {
  id: string;
  eventType: string;
  version: number;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  correlationId: string;
  causationId: string | null;
  actor: string;
  publishAttempts: number;
  claimToken: string;
}

function assertClaimed(rowCount: number | null, eventId: string): void {
  if (rowCount !== 1) {
    throw new Error(`OUTBOX_CLAIM_LOST: event ${eventId} is no longer claimed by this relay`);
  }
}

export class PostgresOutboxRepository implements OutboxRepository {
  async fetchAndLockUnpublished(batchSize: number): Promise<OutboxEvent[]> {
    const claimToken = randomUUID();
    const { rows } = await pool.query<OutboxRow>(`
      WITH claimable AS (
        SELECT id
        FROM domain_events
        WHERE published_at IS NULL
          AND quarantined_at IS NULL
          AND (claim_until IS NULL OR claim_until <= NOW())
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE domain_events AS event
      SET claim_token = $2,
          claim_until = NOW() + ($3 * INTERVAL '1 millisecond')
      FROM claimable
      WHERE event.id = claimable.id
      RETURNING
        event.id,
        event.event_type AS "eventType",
        event.version,
        event.aggregate_type AS "aggregateType",
        event.aggregate_id AS "aggregateId",
        event.payload,
        event.correlation_id AS "correlationId",
        event.causation_id AS "causationId",
        event.actor,
        event.publish_attempts AS "publishAttempts",
        event.claim_token AS "claimToken"
    `, [batchSize, claimToken, CLAIM_LEASE_MS]);

    return rows;
  }

  async markPublished(eventId: string, claimToken?: string): Promise<void> {
    const result = await pool.query(`
      UPDATE domain_events
      SET published_at = NOW(),
          claim_token = NULL,
          claim_until = NULL,
          last_publish_error = NULL
      WHERE id = $1
        AND published_at IS NULL
        AND claim_token IS NOT DISTINCT FROM $2
    `, [eventId, claimToken ?? null]);
    assertClaimed(result.rowCount, eventId);
  }

  async recordFailure(eventId: string, error: string, claimToken?: string): Promise<void> {
    const result = await pool.query(`
      UPDATE domain_events
      SET publish_attempts = publish_attempts + 1,
          last_publish_attempt = NOW(),
          last_publish_error = $3,
          claim_token = NULL,
          claim_until = NULL
      WHERE id = $1
        AND published_at IS NULL
        AND quarantined_at IS NULL
        AND claim_token IS NOT DISTINCT FROM $2
    `, [eventId, claimToken ?? null, error]);
    assertClaimed(result.rowCount, eventId);
  }

  async quarantine(eventId: string, claimToken?: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<OutboxRow>(`
        UPDATE domain_events
        SET quarantined_at = NOW(),
            claim_token = NULL,
            claim_until = NULL
        WHERE id = $1
          AND published_at IS NULL
          AND quarantined_at IS NULL
          AND claim_token IS NOT DISTINCT FROM $2
        RETURNING
          id,
          event_type AS "eventType",
          aggregate_type AS "aggregateType",
          aggregate_id AS "aggregateId",
          payload,
          correlation_id AS "correlationId",
          actor,
          publish_attempts AS "publishAttempts"
      `, [eventId, claimToken ?? null]);
      const event = rows[0];
      if (!event) throw new Error(`OUTBOX_CLAIM_LOST: event ${eventId} is no longer claimed by this relay`);

      await client.query(`
        INSERT INTO event_dead_letters (
          id, original_event_id, event_type, aggregate_type, aggregate_id,
          payload, correlation_id, actor, failure_reason, failure_source, attempts
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'outbox_relay', $10)
      `, [
        randomUUID(),
        event.id,
        event.eventType,
        event.aggregateType,
        event.aggregateId,
        event.payload,
        event.correlationId,
        event.actor,
        'Exceeded MAX_PUBLISH_ATTEMPTS',
        event.publishAttempts,
      ]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
