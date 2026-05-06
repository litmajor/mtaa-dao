/**
 * DENORMALIZATION LISTENER SERVICE
 * 
 * Listens for PostgreSQL NOTIFY events from triggers and updates denormalized stats.
 * Combines event-driven updates with periodic reconciliation for eventual consistency.
 * 
 * Channels:
 * - dao_stats_update: contribution/proposal/vote events
 * - strategy_stats_update: strategy execution events
 */

import { pool } from '../db';
import { daoMemberStatsUpdater } from './daoMemberStatsUpdater';
import { strategyStatsUpdater } from './strategyStatsUpdater';
import { logger } from '../utils/logger';
import * as cron from 'node-cron';

interface ListenerConfig {
  enabled: boolean;
  autoRetry: boolean;
  retryDelayMs: number;
  maxRetries: number;
}

const DEFAULT_CONFIG: ListenerConfig = {
  enabled: process.env.DENORM_LISTENER_ENABLED !== 'false',
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
export async function initializeDenormListener(config: Partial<ListenerConfig> = {}): Promise<void> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  if (!finalConfig.enabled) {
    logger.info('[DENORM LISTENER] Disabled via config');
    return;
  }

  try {
    logger.info('[DENORM LISTENER] Initializing PostgreSQL listener...');
    
    notifyClient = await pool.connect();
    
    // Subscribe to denormalization channels
    await notifyClient.query('LISTEN dao_stats_update');
    await notifyClient.query('LISTEN strategy_stats_update');
    
    logger.info('[DENORM LISTENER] ✅ Subscribed to: dao_stats_update, strategy_stats_update');
    
    // Set up notification handlers
    notifyClient.on('notification', handleNotification);
    notifyClient.on('error', (err: any) => {
      logger.error('[DENORM LISTENER] Connection error:', err);
      isListenerActive = false;
    });
    notifyClient.on('end', () => {
      logger.warn('[DENORM LISTENER] Connection ended');
      isListenerActive = false;
    });
    
    isListenerActive = true;
    retryCount = 0;
    
  } catch (error) {
    logger.error('[DENORM LISTENER] Failed to initialize:', error);
    isListenerActive = false;
    
    if (finalConfig.autoRetry && retryCount < finalConfig.maxRetries) {
      retryCount++;
      const delay = finalConfig.retryDelayMs * Math.pow(1.5, retryCount - 1);
      logger.info(`[DENORM LISTENER] Retrying in ${delay}ms (attempt ${retryCount}/${finalConfig.maxRetries})...`);
      setTimeout(() => initializeDenormListener(config), delay);
    }
  }
}

/**
 * Handle PostgreSQL NOTIFY events
 */
async function handleNotification(msg: any): Promise<void> {
  try {
    const payload = JSON.parse(msg.payload);
    
    if (msg.channel === 'dao_stats_update') {
      await handleDaoStatsUpdate(payload);
    } else if (msg.channel === 'strategy_stats_update') {
      await handleStrategyStatsUpdate(payload);
    }
  } catch (error) {
    logger.error('[DENORM LISTENER] Error handling notification:', error);
  }
}

/**
 * Handle DAO stats update (contribution/proposal/vote events)
 */
async function handleDaoStatsUpdate(payload: any): Promise<void> {
  const { type, dao_id, member_id, action } = payload;
  
  try {
    logger.debug('[DENORM LISTENER] Processing DAO stats update', { type, member_id, action });
    
    // Use setImmediate to avoid blocking listener
    setImmediate(async () => {
      switch (type) {
        case 'contribution':
          if (action === 'INSERT') {
            await daoMemberStatsUpdater.onContributionCreated(dao_id, member_id);
          }
          break;
        case 'proposal':
          if (action === 'INSERT') {
            await daoMemberStatsUpdater.onProposalCreated(dao_id, member_id);
          }
          break;
        case 'vote':
          if (action === 'INSERT') {
            await daoMemberStatsUpdater.onVoteCast(dao_id, member_id);
          }
          break;
      }
    });
  } catch (error) {
    logger.error('[DENORM LISTENER] Error processing DAO stats update:', error);
  }
}

/**
 * Handle strategy stats update (execution events)
 */
async function handleStrategyStatsUpdate(payload: any): Promise<void> {
  const { strategy_id, status, action } = payload;
  
  try {
    logger.debug('[DENORM LISTENER] Processing strategy stats update', { strategy_id, status, action });
    
    // Use setImmediate to avoid blocking listener
    setImmediate(async () => {
      if (action === 'INSERT') {
        await strategyStatsUpdater.onExecutionStatusChanged(strategy_id, status);
      }
    });
  } catch (error) {
    logger.error('[DENORM LISTENER] Error processing strategy stats update:', error);
  }
}

/**
 * Initialize periodic reconciliation job
 */
export async function initializeDenormReconciliation(): Promise<void> {
  try {
    logger.info('[DENORM RECONCILIATION] Scheduling reconciliation job...');
    
    // Run reconciliation every 5 minutes
    reconciliationJobId = cron.schedule('*/5 * * * *', async () => {
      try {
        logger.info('[DENORM RECONCILIATION] Starting denormalization reconciliation...');
        const startTime = Date.now();
        
        // Reconcile DAO member stats
        const daoResult = await daoMemberStatsUpdater.reconcileAllStats();
        
        // Reconcile strategy stats
        const strategyResult = await strategyStatsUpdater.reconcileAllStats();
        
        const duration = Date.now() - startTime;
        logger.info(`[DENORM RECONCILIATION] ✅ Completed in ${duration}ms`, {
          dao_members_processed: daoResult.processed,
          dao_members_fixed: daoResult.fixed,
          strategies_processed: strategyResult.processed,
          strategies_fixed: strategyResult.fixed,
        });
        
        // Log any issues found
        if (daoResult.fixed > 0 || strategyResult.fixed > 0) {
          logger.warn(`[DENORM RECONCILIATION] ⚠️ Fixed ${daoResult.fixed} DAO members and ${strategyResult.fixed} strategies`, {
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        logger.error('[DENORM RECONCILIATION] Job failed:', error);
      }
    });
    
    logger.info('[DENORM RECONCILIATION] ✅ Reconciliation job scheduled (every 5 minutes)');
    
    // Also run initial reconciliation immediately (non-blocking)
    setImmediate(async () => {
      try {
        logger.info('[DENORM RECONCILIATION] Running initial reconciliation...');
        const daoResult = await daoMemberStatsUpdater.reconcileAllStats();
        const strategyResult = await strategyStatsUpdater.reconcileAllStats();
        logger.info('[DENORM RECONCILIATION] Initial run complete', { 
          dao: daoResult,
          strategies: strategyResult
        });
      } catch (error) {
        logger.warn('[DENORM RECONCILIATION] Initial reconciliation warning (non-blocking):', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    });
  } catch (error) {
    logger.error('[DENORM RECONCILIATION] Failed to initialize:', error);
  }
}

/**
 * Graceful shutdown
 */
export async function shutdownDenormListener(): Promise<void> {
  try {
    if (reconciliationJobId) {
      reconciliationJobId.stop();
      logger.info('[DENORM LISTENER] Reconciliation job stopped');
    }
    
    if (notifyClient) {
      await notifyClient.query('UNLISTEN dao_stats_update');
      await notifyClient.query('UNLISTEN strategy_stats_update');
      await notifyClient.release();
      logger.info('[DENORM LISTENER] ✅ Listener shutdown complete');
    }
  } catch (error) {
    logger.error('[DENORM LISTENER] Error during shutdown:', error);
  }
}

/**
 * Get listener status for monitoring
 */
export function getListenerStatus() {
  return {
    active: isListenerActive,
    connected: notifyClient?.connection?.stream?.readyState === 'open',
    retryCount,
    nextReconciliation: reconciliationJobId ? 'scheduled' : 'not scheduled',
  };
}
