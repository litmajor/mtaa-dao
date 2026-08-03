import { db } from '../../db';
import { processedEvents } from '../../db/schema/eda';
import { eq, and, sql, lt } from 'drizzle-orm';
import type {
  ProcessedEventRepository,
  ClaimResult,
  ProcessedEventRecord,
  ConsumerEventStatus,
} from '../postgres/ProcessedEventRepository';

export class DrizzleProcessedEventRepository implements ProcessedEventRepository {
  async claimEvent(eventId: string, consumerName: string, streamMessageId?: string): Promise<ClaimResult> {
    const inserted = await db.insert(processedEvents)
      .values({
        eventId,
        consumerName,
        status: 'RECEIVED',
        streamMessageId: streamMessageId ?? null,
        receivedAt: new Date(),
        processingStartedAt: null,
        processedAt: null,
        retryCount: 0,
        lastError: null,
      })
      .onConflictDoNothing()
      .returning({ eventId: processedEvents.eventId });

    if (inserted.length > 0) {
      return { claimed: true };
    }

    const rows = await db
      .select()
      .from(processedEvents)
      .where(
        and(
          eq(processedEvents.eventId, eventId),
          eq(processedEvents.consumerName, consumerName),
        ),
      )
      .limit(1);

    return {
      claimed: false,
      existingStatus: rows[0]?.status as ConsumerEventStatus | undefined,
    };
  }

  async markProcessing(eventId: string, consumerName: string): Promise<void> {
    await db
      .update(processedEvents)
      .set({
        status: 'PROCESSING',
        processingStartedAt: new Date(),
      })
      .where(
        and(
          eq(processedEvents.eventId, eventId),
          eq(processedEvents.consumerName, consumerName),
        ),
      );
  }

  async markCompleted(eventId: string, consumerName: string): Promise<void> {
    await db
      .update(processedEvents)
      .set({
        status: 'COMPLETED',
        processedAt: new Date(),
      })
      .where(
        and(
          eq(processedEvents.eventId, eventId),
          eq(processedEvents.consumerName, consumerName),
        ),
      );
  }

  async markFailed(eventId: string, consumerName: string, error: string): Promise<void> {
    await db
      .update(processedEvents)
      .set({
        status: 'FAILED',
        retryCount: sql`retry_count + 1`,
        lastError: error,
      })
      .where(
        and(
          eq(processedEvents.eventId, eventId),
          eq(processedEvents.consumerName, consumerName),
        ),
      );
  }

  async getStatus(eventId: string, consumerName: string): Promise<ProcessedEventRecord | null> {
    const rows = await db
      .select()
      .from(processedEvents)
      .where(
        and(
          eq(processedEvents.eventId, eventId),
          eq(processedEvents.consumerName, consumerName),
        ),
      )
      .limit(1);

    return rows[0] as ProcessedEventRecord | null;
  }

  async findStalled(consumerName: string, stalledThresholdMs: number): Promise<ProcessedEventRecord[]> {
    const cutoff = new Date(Date.now() - stalledThresholdMs);

    const rows = await db
      .select()
      .from(processedEvents)
      .where(
        and(
          eq(processedEvents.consumerName, consumerName),
          eq(processedEvents.status, 'PROCESSING'),
          lt(processedEvents.processingStartedAt, cutoff),
        ),
      );

    return rows as ProcessedEventRecord[];
  }

  async retryFailed(eventId: string, consumerName: string): Promise<void> {
    await db
      .update(processedEvents)
      .set({
        status: 'PROCESSING',
        processingStartedAt: new Date(),
        lastError: null,
        retryCount: sql`retry_count + 1`,
      })
      .where(
        and(
          eq(processedEvents.eventId, eventId),
          eq(processedEvents.consumerName, consumerName),
          eq(processedEvents.status, 'FAILED'),
        ),
      );
  }
}
