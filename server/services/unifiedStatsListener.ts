/**
 * UNIFIED STATS LISTENER SERVICE
 * 
 * Manages PostgreSQL async listeners and hourly reconciliation cron job
 * for all denormalized stats tables.
 * 
 * Features:
 * - Listens for pg_notify events from database triggers
 * - Updates stats cache via unifiedStatsUpdater
 * - Hourly reconciliation to catch any drift
 * - Automatic retry on connection failures
 */

import { pool } from '../db';
import { unifiedStatsUpdater } from './unifiedStatsUpdater';
import { VenueStatsCache, OrderStatsCache, BalanceSummaryCache } from './unifiedStatsCache';
import { logger } from '../utils/logger';
import * as cron from 'node-cron';

interface ListenerConfig {
  enabled: boolean;
  autoRetry: boolean;
  retryDelayMs: number;
  maxRetries: number;
}

const DEFAULT_CONFIG: ListenerConfig = {
  enabled: process.env.UNIFIED_STATS_LISTENER_ENABLED !== 'false',
  autoRetry: true,
  retryDelayMs: 5000,
  maxRetries: 5,
};

let notifyClient: any = null;
let retryCount = 0;
let reconciliationJobId: any = null;
let isListenerActive = false;

/**
 * Initialize async PostgreSQL listener for stat updates
 */
export async function initializeStatsListener(config: Partial<ListenerConfig> = {}): Promise<void> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  if (!finalConfig.enabled) {
    logger.info('[STATS LISTENER] Disabled via config');
    return;
  }

  try {
    logger.info('[STATS LISTENER] Initializing PostgreSQL async listener...');
    
    // Get dedicated connection for listening
    notifyClient = await pool.connect();
    
    // Subscribe to notification channels
    await notifyClient.query('LISTEN "stats:venue_update"');
    await notifyClient.query('LISTEN "stats:order_update"');
    await notifyClient.query('LISTEN "marketplace:stats_update"');
    
    logger.info('[STATS LISTENER] ✅ Listening for events on 3 channels');
    
    // Handle notifications
    notifyClient.on('notification', async (msg: any) => {
      try {
        const payload = JSON.parse(msg.payload);
        const channel = msg.channel;
        const startTime = Date.now();
        
        logger.debug(`[STATS LISTENER] Event received: ${channel}`, payload);
        
        // Route to appropriate handler
        if (channel === 'stats:venue_update') {
          await handleVenueUpdate(payload);
        } else if (channel === 'stats:order_update') {
          await handleOrderUpdate(payload);
        } else if (channel === 'marketplace:stats_update') {
          await handleMarketplaceUpdate(payload);
        }
        
        const duration = Date.now() - startTime;
        logger.debug(`[STATS LISTENER] Event processed in ${duration}ms`);
        
        // Reset retry count on successful processing
        retryCount = 0;
      } catch (error) {
        logger.error('[STATS LISTENER] Error processing notification:', error);
      }
    });
    
    // Handle connection errors
    notifyClient.on('error', (err: Error) => {
      logger.error('[STATS LISTENER] Connection error:', err);
      isListenerActive = false;
      
      if (finalConfig.autoRetry && retryCount < finalConfig.maxRetries) {
        retryCount++;
        logger.info(`[STATS LISTENER] Attempting reconnect (${retryCount}/${finalConfig.maxRetries}) in ${finalConfig.retryDelayMs}ms...`);
        setTimeout(() => {
          initializeStatsListener(config).catch(err => {
            logger.error('[STATS LISTENER] Reconnection failed:', err);
          });
        }, finalConfig.retryDelayMs);
      } else if (finalConfig.autoRetry) {
        logger.error('[STATS LISTENER] ❌ Max retries exceeded. Listener stopped.');
      }
    });
    
    isListenerActive = true;
    logger.info('[STATS LISTENER] ✅ Async listener initialized and ready');
  } catch (error) {
    logger.error('[STATS LISTENER] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Handle venue execution stats update
 */
async function handleVenueUpdate(payload: any): Promise<void> {
  const { user_id, symbol, venue } = payload;
  
  try {
    // Update stats in database
    await unifiedStatsUpdater.updateVenueExecutionStats(user_id, symbol, venue);
    
    // Invalidate cache to force refresh on next request
    await VenueStatsCache.invalidate(user_id, symbol, venue);
    
    logger.debug(`[STATS LISTENER] Updated venue stats: ${user_id}/${symbol}/${venue}`);
  } catch (error) {
    logger.error('[STATS LISTENER] Error handling venue update:', error);
  }
}

/**
 * Handle order execution summary update
 */
async function handleOrderUpdate(payload: any): Promise<void> {
  const { exchange, symbol, timeWindow = '30 days' } = payload;
  
  try {
    // Update stats in database
    await unifiedStatsUpdater.updateOrderExecutionSummary(exchange, symbol, timeWindow);
    
    // Invalidate cache to force refresh on next request
    await OrderStatsCache.invalidate(exchange, symbol);
    
    logger.debug(`[STATS LISTENER] Updated order stats: ${exchange}/${symbol}`);
  } catch (error) {
    logger.error('[STATS LISTENER] Error handling order update:', error);
  }
}

/**
 * Handle marketplace stats update
 */
async function handleMarketplaceUpdate(payload: any): Promise<void> {
  const { strategy_id, user_id } = payload;
  
  try {
    // Import marketplace stats updater on-demand to avoid circular dependencies
    const { marketplaceStatsUpdater } = await import('./marketplaceStatsUpdater');
    const { redis } = await import('./redis');
    
    // Update denormalized marketplace stats
    logger.info('[STATS LISTENER] Updating marketplace strategy stats', {
      strategy_id,
      user_id,
    });
    
    // Update rating stats (if ratings changed)
    await marketplaceStatsUpdater.updateRatingStats(strategy_id);
    
    // Update strategy returns (if strategy performance changed)
    await marketplaceStatsUpdater.updateStrategyReturns(strategy_id);
    
    // Invalidate cache for this strategy
    const cacheKey = `marketplace_strategy:${strategy_id}`;
    await redis.del(cacheKey);
    
    logger.debug('[STATS LISTENER] ✅ Marketplace strategy stats updated', { strategy_id });
  } catch (error) {
    logger.error('[STATS LISTENER] Error handling marketplace update:', error);
  }
}

/**
 * Initialize hourly reconciliation cron job
 */
export async function initializeReconciliationJob(): Promise<void> {
  try {
    logger.info('[RECONCILIATION] Scheduling hourly reconciliation job...');
    
    // Run reconciliation every hour at :00 using node-cron syntax
    // Cron format: "minute hour * * * *" for hourly at top of hour
    reconciliationJobId = cron.schedule('0 * * * *', async () => {
      try {
        logger.info('[RECONCILIATION] Starting hourly stats reconciliation...');
        const startTime = Date.now();
        
        const result = await unifiedStatsUpdater.reconcileAllStats();
        
        const duration = Date.now() - startTime;
        logger.info(`[RECONCILIATION] ✅ Completed in ${duration}ms`, {
          processed: result.processed,
          fixed: result.fixed,
          duration: `${duration}ms`,
        });
        
        // Log any issues found
        if (result.fixed > 0) {
          logger.warn(`[RECONCILIATION] ⚠️ Found and fixed ${result.fixed} inconsistencies`, {
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        logger.error('[RECONCILIATION] Job failed:', error);
      }
    });
    
    logger.info('[RECONCILIATION] ✅ Hourly reconciliation job scheduled');
    
    // Also run initial reconciliation immediately (non-blocking)
    setImmediate(async () => {
      try {
        logger.info('[RECONCILIATION] Running initial reconciliation...');
        const result = await unifiedStatsUpdater.reconcileAllStats();
        logger.info('[RECONCILIATION] Initial run complete', { processed: result.processed, fixed: result.fixed });
      } catch (error) {
        logger.warn('[RECONCILIATION] Initial reconciliation warning (non-blocking):', { error: error instanceof Error ? error.message : String(error) });
      }
    });
  } catch (error) {
    logger.error('[RECONCILIATION] Failed to schedule job:', error);
    throw error;
  }
}

/**
 * Shutdown listener gracefully
 */
export async function shutdownStatsListener(): Promise<void> {
  try {
    if (reconciliationJobId) {
      reconciliationJobId.cancel();
      logger.info('[STATS LISTENER] Reconciliation job cancelled');
    }
    
    if (notifyClient) {
      await notifyClient.query('UNLISTEN "stats:venue_update"');
      await notifyClient.query('UNLISTEN "stats:order_update"');
      await notifyClient.query('UNLISTEN "marketplace:stats_update"');
      await notifyClient.release();
      logger.info('[STATS LISTENER] Listener shut down gracefully');
      isListenerActive = false;
    }
  } catch (error) {
    logger.error('[STATS LISTENER] Error during shutdown:', error);
  }
}

/**
 * Get listener status
 */
export function getListenerStatus(): {
  active: boolean;
  connected: boolean;
  retryCount: number;
  nextReconciliation: Date | null;
} {
  return {
    active: isListenerActive,
    connected: notifyClient !== null && !notifyClient.queryQueue,
    retryCount,
    nextReconciliation: reconciliationJobId ? new Date(reconciliationJobId.nextInvocation()) : null,
  };
}
