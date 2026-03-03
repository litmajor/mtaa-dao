/**
 * Job Workers Initialization
 * Starts all async job processors and worker threads
 */

import { StrategyJobWorker } from './strategyJobWorker';
import { MorioJobWorker } from './morioJobWorker';
import { PoolVaultJobWorker } from './poolVaultJobWorker';
import { logger } from '../utils/logger';

/**
 * Initialize all job workers
 * Call this during server startup to register job processors
 */
export async function initializeWorkers(): Promise<void> {
  try {
    logger.info('[Workers] Initializing async job workers...');

    // Initialize strategy worker (backtest, optimize)
    StrategyJobWorker.initialize();
    logger.info('[Workers] Strategy worker initialized');

    // Initialize Morio worker (analyze, chat)
    MorioJobWorker.initialize();
    logger.info('[Workers] Morio worker initialized');

    // Initialize pool/vault worker (rebalance)
    PoolVaultJobWorker.initialize();
    logger.info('[Workers] Pool/Vault worker initialized');

    logger.info('[Workers] All job workers initialized successfully');
  } catch (error) {
    logger.error('[Workers] Failed to initialize workers:', error);
    throw error;
  }
}

/**
 * Gracefully shutdown all workers
 * Call this during server shutdown
 */
export async function shutdownWorkers(): Promise<void> {
  try {
    logger.info('[Workers] Shutting down job workers...');
    
    // Close all queues
    const queues = require('./jobQueueService').jobQueueService.getQueues();
    
    for (const [jobType, queue] of queues) {
      try {
        await queue.close();
        logger.info(`[Workers] Closed queue: ${jobType}`);
      } catch (error) {
        logger.error(`[Workers] Error closing queue ${jobType}:`, error);
      }
    }

    logger.info('[Workers] All job workers shutdown successfully');
  } catch (error) {
    logger.error('[Workers] Error shutting down workers:', error);
  }
}

