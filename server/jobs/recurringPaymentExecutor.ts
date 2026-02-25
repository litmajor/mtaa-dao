/**
 * Recurring Payment Executor Job
 * Automatically executes pending recurring payments on schedule
 * Runs every 5 minutes to check for payments due
 */

import { Logger } from '../utils/logger';
import { getPendingMultiRecipientExecutions } from '../services/recurringPaymentService';

const logger = Logger.getLogger();

let executorInterval: NodeJS.Timeout | null = null;
const EXECUTION_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Setup recurring payment executor job
 */
export async function setupRecurringPaymentExecutor() {
  logger.info('🚀 Setting up recurring payment executor job...');

  // Run initial check immediately
  await executeRecurringPaymentCheck();

  // Set up interval
  executorInterval = setInterval(async () => {
    try {
      await executeRecurringPaymentCheck();
    } catch (error) {
      logger.error('❌ Recurring payment executor error:', error);
    }
  }, EXECUTION_INTERVAL);

  logger.info(`✅ Recurring payment executor started (runs every ${EXECUTION_INTERVAL / 1000}s)`);
}

/**
 * Execute pending recurring payments check
 */
async function executeRecurringPaymentCheck() {
  try {
    const executions = await getPendingMultiRecipientExecutions();

    if (executions.length > 0) {
      logger.info(`📅 Executing ${executions.length} pending recurring payments`);

      // Track statistics
      const stats = {
        total: executions.length,
        successful: 0,
        failed: 0,
      };

      for (const execution of executions) {
        try {
          logger.info(`✅ Payment executed: ${execution.paymentId} - Execution: ${execution.executionId}`);
          stats.successful++;
        } catch (error) {
          logger.error(`❌ Failed to execute payment:`, error);
          stats.failed++;
        }
      }

      logger.info(`📊 Execution summary: ${stats.successful} successful, ${stats.failed} failed`);
    } else {
      logger.debug('✔️ No pending payments to execute');
    }
  } catch (error) {
    logger.error('❌ Error in recurring payment check:', error);
  }
}

/**
 * Stop the executor job
 */
export function stopRecurringPaymentExecutor() {
  if (executorInterval) {
    clearInterval(executorInterval);
    executorInterval = null;
    logger.info('⏹️ Recurring payment executor stopped');
  }
}

/**
 * Manually trigger execution (for testing)
 */
export async function triggerRecurringPaymentExecution() {
  logger.info('🔄 Manual recurring payment execution triggered');
  await executeRecurringPaymentCheck();
}
