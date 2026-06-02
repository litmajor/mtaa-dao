import { redis } from './redis';
import { logger } from '../utils/logger';

/**
 * Publish execution-related events to Redis so real-time subscribers
 * (Socket.IO) can receive them. Channel names should follow the
 * convention: `execution:<executionId>`, `vault:<vaultId>`, `strategy:<strategyId>`, etc.
 */
export async function publishExecutionEvent(channel: string, payload: any): Promise<void> {
  try {
    await redis.publish(channel, JSON.stringify(payload));
  } catch (err) {
    logger.warn('[ExecutionEvents] Failed to publish event', { channel, err });
  }
}

export default { publishExecutionEvent };
