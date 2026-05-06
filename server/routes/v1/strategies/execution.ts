/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * V1 STRATEGIES - EXECUTION SUB-ROUTER
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Strategy Execution Operations - Async jobs and performance:
 * - POST   /v1/strategies/:strategyId/backtest            → Queue backtest job
 * - GET    /v1/strategies/:strategyId/backtest-status/:id → Poll job status
 * - POST   /v1/strategies/:strategyId/deploy              → Deploy to Freqtrade
 * - POST   /v1/strategies/:strategyId/optimize            → Queue optimization
 * - POST   /v1/strategies/:strategyId/rebalance           → Trigger rebalance
 * - GET    /v1/strategies/:strategyId/performance         → Get metrics
 * 
 * All execution endpoints except GET performance require authentication.
 * Most return 202 Accepted with job ID for polling.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express, { Request, Response } from 'express';
import { strategyDashboardService } from '../../../services/strategyDashboardService';
import { strategyFreqtradeIntegration } from '../../../services/strategyFreqtradeIntegration';
import { Logger } from '../../../utils/logger';
import { jobQueueService } from '../../../services/jobQueueService';
import { rateLimitPerUser } from '../../../middleware/rateLimit';

const logger = Logger.getLogger();
const router = express.Router({ mergeParams: true });

/**
 * Middleware: Require authentication for write operations
 */
function requireAuth(req: Request, res: Response, next: Function) {
  const userId = (req as any).userId || req.query.userId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: User ID required'
    });
  }
  (req as any).userId = userId;
  next();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE & ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/strategies/:strategyId/performance
 * Get strategy performance metrics (public, no auth required)
 * 
 * Returns:
 *   - returnOnInvestment: number (%)
 *   - winRate: number (%)
 *   - sharpeRatio: number
 *   - maxDrawdown: number (%)
 *   - profitFactor: number
 *   - totalTrades: number
 *   - successfulTrades: number
 */
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;

    const performance = await strategyDashboardService.getStrategyPerformance(strategyId);

    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    logger.error('[Strategies:Execution] Performance error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get performance metrics'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BACKTESTING - Queue & Poll Jobs
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /v1/strategies/:strategyId/backtest
 * Get completed backtest results
 */
router.get('/backtest', async (req: Request, res: Response) => {
  try {
    const { strategyId } = req.params;

    const results = await strategyFreqtradeIntegration.getStrategyBacktestResults(strategyId);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error('[Strategies:Execution] Get backtest error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get backtest results'
    });
  }
});

/**
 * POST /v1/strategies/:strategyId/backtest
 * Queue backtest job (async - returns immediately with job ID for polling)
 * 
 * Request Body:
 *   - pair?: string (default: 'BTC/USDT')
 *   - timeframe?: string (default: '1h')
 *   - timerange?: string (default: '20230101-20231231')
 *   - stakeAmount?: number (default: 100)
 *   - enableOptimization?: boolean (default: false)
 * 
 * Returns (202 Accepted):
 *   - jobId: string (unique job identifier)
 *   - statusUrl: string (polling endpoint)
 */
router.post('/backtest', [requireAuth, rateLimitPerUser('strategy-backtest', 20, '10min')], async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { strategyId } = req.params;
    const {
      pair = 'BTC/USDT',
      timeframe = '1h',
      timerange = '20230101-20231231',
      stakeAmount = 100,
      enableOptimization = false
    } = req.body;

    // Queue backtest job
    const jobId = await jobQueueService.queueJob('strategy-backtest', {
      userId,
      strategyId,
      pair,
      timeframe,
      timerange,
      stakeAmount,
      enableOptimization
    }, {
      priority: 6,
      timeout: 1800000 // 30 minute timeout for backtest
    });

    res.status(202).json({
      success: true,
      message: 'Backtest queued',
      jobId,
      statusUrl: `/v1/strategies/${strategyId}/backtest-status/${jobId}`
    });
  } catch (error) {
    logger.error('[Strategies:Execution] Backtest queue error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue backtest'
    });
  }
});

/**
 * GET /v1/strategies/:strategyId/backtest-status/:jobId
 * Poll backtest job status (async job polling pattern)
 * 
 * Returns:
 *   - 202 Accepted if still processing
 *   - 200 OK with results if completed
 *   - 404 Not Found if job expired
 * 
 * Response:
 *   - status: 'pending'|'processing'|'completed'|'failed'
 *   - progress: number (0-100)
 *   - data?: object (results if completed)
 */
router.get('/backtest-status/:jobId', async (req: Request, res: Response) => {
  try {
    const { strategyId, jobId } = req.params;

    const jobStatus = await jobQueueService.getJobResult(jobId);

    if (!jobStatus) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    if (jobStatus.status === 'completed') {
      return res.json({
        success: true,
        status: 'completed',
        progress: 100,
        data: jobStatus.result
      });
    }

    res.status(202).json({
      success: true,
      status: jobStatus.status,
      progress: jobStatus.progress || 0,
      message: `Backtest ${jobStatus.status}`
    });
  } catch (error) {
    logger.error('[Strategies:Execution] Backtest status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get backtest status'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DEPLOYMENT - Freqtrade Integration
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /v1/strategies/:strategyId/deploy
 * Deploy strategy to Freqtrade instance
 * 
 * Request Body:
 *   - dryRun?: boolean (default: false - validate without actually deploying)
 * 
 * Returns:
 *   - deploymentId: string
 *   - status: string
 *   - freqtradeConfig: object
 */
router.post('/deploy', [requireAuth, rateLimitPerUser('strategy-deploy', 10, '10min')], async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { strategyId } = req.params;
    const { dryRun = false } = req.body;

    const result = await strategyFreqtradeIntegration.deployStrategy(
      strategyId,
      userId,
      dryRun
    );

    res.json({
      success: true,
      message: 'Strategy deployed successfully',
      data: result
    });
  } catch (error) {
    logger.error('[Strategies:Execution] Deploy error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deploy strategy'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// OPTIMIZATION - Parameter Tuning (Async)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /v1/strategies/:strategyId/optimize
 * Queue parameter optimization job (async - returns immediately with job ID)
 * 
 * Request Body:
 *   - parameters: object (parameter ranges to optimize)
 *   - optimizer?: string (default: 'hyperopt' - 'hyperopt'|'optuna'|'bayes')
 *   - maxEvaluations?: number (default: 100)
 * 
 * Returns (202 Accepted):
 *   - jobId: string
 *   - statusUrl: string (polling endpoint)
 */
router.post('/optimize', [requireAuth, rateLimitPerUser('strategy-optimize', 10, '10min')], async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { strategyId } = req.params;
    const { parameters, optimizer = 'hyperopt' } = req.body;

    // Queue optimization job
    const jobId = await jobQueueService.queueJob('strategy-optimize', {
      userId,
      strategyId,
      optimizationParams: parameters,
      optimizer
    }, {
      priority: 5,
      timeout: 3600000 // 60 minute timeout for optimization
    });

    res.status(202).json({
      success: true,
      message: 'Optimization queued',
      jobId,
      statusUrl: `/v1/strategies/${strategyId}/optimize-status/${jobId}`
    });
  } catch (error) {
    logger.error('[Strategies:Execution] Optimize queue error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue optimization'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REBALANCING - Manual Trigger
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /v1/strategies/:strategyId/rebalance
 * Manually trigger asset rebalancing
 * 
 * Returns:
 *   - rebalanceId: string
 *   - executedAllocations: Array (new allocation state)
 *   - previousAllocations: Array (old allocation state)
 */
router.post('/rebalance', [requireAuth, rateLimitPerUser('strategy-rebalance', 10, '10min')], async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { strategyId } = req.params;

    const result = await strategyDashboardService.rebalanceStrategy(strategyId);

    res.json({
      success: true,
      message: 'Rebalancing triggered successfully',
      data: result
    });
  } catch (error) {
    logger.error('[Strategies:Execution] Rebalance error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to rebalance strategy'
    });
  }
});

export default router;
