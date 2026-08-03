import { randomUUID } from 'crypto';
import { CorrelationContext } from './CorrelationContext';
import { logger } from './logger';

/**
 * Wraps a background worker task in a CorrelationContext, generating
 * a fresh correlationId and assigning the 'system' actor.
 * 
 * @param taskName The name of the worker task for logging purposes.
 * @param callback The work to be executed.
 */
export async function runWorkerTask<R>(taskName: string, callback: () => Promise<R> | R): Promise<R> {
  const correlationId = randomUUID();
  
  return CorrelationContext.run({ correlationId, actor: 'system' }, async () => {
    logger.info({ message: 'worker.task.started', taskName });
    
    try {
      const result = await callback();
      logger.info({ message: 'worker.task.completed', taskName });
      return result;
    } catch (err) {
      logger.error({ 
        message: 'worker.task.failed', 
        taskName, 
        error: err instanceof Error ? err.message : String(err) 
      });
      throw err;
    }
  });
}
