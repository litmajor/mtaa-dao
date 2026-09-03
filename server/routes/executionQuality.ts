/**
 * Execution Quality & Slippage Analysis Routes
 * 
 * Provides insights into execution quality across venues:
 * - Actual slippage realization
 * - Fee efficiency metrics
 * - Execution timing analysis
 * - Venue performance ranking
 * - Historical execution trends
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticateToken, isSuperUser } from '../middleware/auth';
import { executionTracking } from '../services/executionTrackingService';
import { createApiResponse, createApiError, ApiErrorCode } from '../types/ApiResponse';
import { logger } from '../utils/logger';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      logger.error('Unhandled async route error:', { error, path: req.path, method: req.method });
      next(error);
    });
  };
};

const parseBoundedHours = (value: unknown, fallback = 24, max = 168): number => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.max(parsed, 1), max);
};

/**
 * GET /api/v1/execution/quality/:symbol
 * 
 * Get execution quality metrics by venue
 * 
 * Query params:
 * - exchange: string (optional) - Specific exchange
 * - hours: number (default: 24) - Time window
 * 
 * Returns: Execution quality metrics per venue
 */
router.get('/quality/:symbol', asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    const exchange = (req.query.exchange as string) || '';
    const hours = parseBoundedHours(req.query.hours, 24, 168);

    if (exchange) {
      // Single exchange quality
      const quality = await executionTracking.getExecutionQuality(exchange, symbol, hours);

      if (quality.totalExecutions === 0) {
        return res.status(404).json(
          createApiError(
            ApiErrorCode.NOT_FOUND,
            `No execution history for ${exchange}/${symbol}`,
            404,
            { suggestion: 'Execute some trades first to see quality metrics' }
          )
        );
      }

      const data = {
        symbol,
        exchange,
        timeWindow: `${hours}h`,
        timestamp: Date.now(),
        quality,
        interpretation: {
          slippage:
            quality.avgSlippageRealization > 0.02
              ? '⚠️ High slippage - consider alternative venues'
              : quality.avgSlippageRealization < -0.02
                ? '✅ Better execution than estimated'
                : '✓ Slippage as expected',
          feeEfficiency:
            quality.avgFeeEfficiency > 0.2
              ? '✅ Better fee structure than expected'
              : quality.avgFeeEfficiency < -0.1
                ? '⚠️ Paying more in fees than expected'
                : '✓ Fees as expected',
          successRate:
            quality.successRate === 100
              ? '✅ Perfect fill rate'
              : quality.successRate >= 95
                ? '✓ Excellent fill rate'
                : '⚠️ Some failed or partial fills',
          trend: `📊 ${quality.trend === 'improving' ? '📈 Improving' : quality.trend === 'declining' ? '📉 Declining' : '➡️ Stable'}`,
        },
      };

      res.json(createApiResponse(data, { dataSource: exchange }));
    } else {
      // All venues comparison
      const performance = await executionTracking.getVenuePerformance(symbol, hours);

      if (performance.every((p) => p.quality.totalExecutions === 0)) {
        return res.status(404).json(
          createApiError(
            ApiErrorCode.NOT_FOUND,
            `No execution history for ${symbol}`,
            404
          )
        );
      }

      const data = {
        symbol,
        timeWindow: `${hours}h`,
        timestamp: Date.now(),
        venues: performance.map((p) => ({
          ranking: p.ranking,
          exchange: p.exchange,
          totalExecutions: p.quality.totalExecutions,
          successRate: `${p.quality.successRate}%`,
          avgSlippageRealization: `${(p.quality.avgSlippageRealization * 100).toFixed(3)}%`,
          avgFeeEfficiency: `${(p.quality.avgFeeEfficiency * 100).toFixed(2)}%`,
          avgExecutionTime: `${p.quality.avgExecutionTime.toFixed(0)}ms`,
          bestScore: p.quality.bestExecutionScore,
          worstScore: p.quality.worstExecutionScore,
          trend: p.quality.trend,
        })),
        recommendation: {
          bestVenue: performance[0]?.exchange,
          reason: 'Based on execution quality score',
          expectedSavings: 'Variable based on order size',
        },
      };

      res.json(createApiResponse(data));
    }
}));

/**
 * GET /api/v1/execution/slippage-analysis/:symbol
 * 
 * Detailed slippage analysis across venues
 * 
 * Query params:
 * - hours: number (default: 24)
 * 
 * Returns: Slippage comparison and trends
 */
router.get('/slippage-analysis/:symbol', asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params;
  const hours = parseBoundedHours(req.query.hours, 24, 168);

  const analysis = await executionTracking.getSlippageAnalysis(symbol, hours);
  const byExchange = analysis?.byExchange || {};

  const data = {
    ...analysis,
    summary: {
      exchanges: Object.keys(byExchange).length,
      dataPoints: Object.values(byExchange).reduce(
        (sum: number, v: any) => sum + (Number(v?.totalExecutions) || 0),
        0
      ),
      bestPerformer: analysis?.bestPerformer || 'N/A',
      worstPerformer: analysis?.worstPerformer || 'N/A',
      recommendations: [
        `Use ${analysis?.bestPerformer || 'the best available venue'} for lower slippage`,
        `Avoid ${analysis?.worstPerformer || 'the weakest venue'} if better alternatives are available`,
        'Large orders may experience worse slippage',
        'Monitor slippage during high volatility periods',
      ],
    },
  };

  res.json(createApiResponse(data));
}));

/**
 * GET /api/v1/execution/venue-ranking/:symbol
 * 
 * Rank venues by execution quality
 * 
 * Query params:
 * - metric: 'slippage' | 'fees' | 'speed' | 'overall' (default: overall)
 * - hours: number (default: 24)
 * 
 * Returns: Ranked venues with detailed metrics
 */
router.get('/venue-ranking/:symbol', asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    const metric = (req.query.metric as string) || 'overall';
    const hours = parseBoundedHours(req.query.hours, 24, 168);

    const performance = await executionTracking.getVenuePerformance(symbol, hours);

    // Sort by selected metric
    let sorted = [...performance];
    switch (metric) {
      case 'slippage':
        sorted.sort(
          (a, b) =>
            a.quality.avgSlippageRealization - b.quality.avgSlippageRealization
        );
        break;
      case 'fees':
        sorted.sort(
          (a, b) => b.quality.avgFeeEfficiency - a.quality.avgFeeEfficiency
        );
        break;
      case 'speed':
        sorted.sort(
          (a, b) => a.quality.avgExecutionTime - b.quality.avgExecutionTime
        );
        break;
      case 'overall':
      default:
        sorted.sort(
          (a, b) => b.quality.bestExecutionScore - a.quality.bestExecutionScore
        );
    }

    // Update rankings
    sorted.forEach((p, idx) => {
      p.ranking = idx + 1;
    });

    const data = {
      symbol,
      sortedBy: metric,
      timeWindow: `${hours}h`,
      timestamp: Date.now(),
      venues: sorted.map((venue) => ({
        rank: venue.ranking,
        exchange: venue.exchange,
        metrics: {
          executionScore: venue.quality.bestExecutionScore,
          slippageRealization: `${(
            venue.quality.avgSlippageRealization * 100
          ).toFixed(3)}%`,
          feeEfficiency: `${(venue.quality.avgFeeEfficiency * 100).toFixed(2)}%`,
          executionTime: `${venue.quality.avgExecutionTime.toFixed(0)}ms`,
          successRate: `${venue.quality.successRate.toFixed(1)}%`,
          totalExecutions: venue.quality.totalExecutions,
        },
        trend: venue.quality.trend,
        recommendation:
          venue.ranking === 1
            ? '🏆 Best performer'
            : venue.ranking <= 2
              ? '✅ Good choice'
              : '⚠️ Consider alternatives',
      })),
    };

    res.json(createApiResponse(data));
}));

/**
 * GET /api/v1/execution/history
 * 
 * Get user's execution history
 * 
 * Query params:
 * - exchange: string (optional)
 * - symbol: string (optional)
 * - hours: number (default: 24)
 * - limit: number (default: 100)
 * 
 * Returns: Array of execution records with quality analysis
 */
router.get('/history', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const exchange = (req.query.exchange as string) || '';
  const symbol = (req.query.symbol as string) || '';
  const hours = parseBoundedHours(req.query.hours, 24, 168);
  const limit = Math.min(Number.parseInt(String(req.query.limit ?? '100'), 10) || 100, 1000);

  const history = await executionTracking.getExecutionHistory(
    exchange || undefined,
    symbol || undefined,
    hours
  );

  const limited = history.slice(0, Math.max(1, limit));
  const records = limited.map((record) => ({
    id: record.id,
    symbol: record.symbol,
    exchange: record.exchange,
    side: record.side,
    inputAmount: record.inputAmount,
    estimatedOutput: record.estimatedOutput,
    actualOutput: record.actualOutput,
    slippageRealization: record.slippageRealization
      ? `${(record.slippageRealization * 100).toFixed(3)}%`
      : 'N/A',
    feeEfficiency: record.feeEfficiency
      ? `${(record.feeEfficiency * 100).toFixed(2)}%`
      : 'N/A',
    executionQualityScore: record.executionQualityScore || 'N/A',
    status: record.status,
    executedAt: record.executedAt,
    executionTime: record.executionTime ? `${record.executionTime}ms` : 'N/A',
    txHash: record.txHash,
  }));

  const numericScores = history
    .map((record) => Number(record.executionQualityScore))
    .filter((score) => Number.isFinite(score));

  const data = {
    symbol: symbol || 'all',
    exchange: exchange || 'all',
    timeWindow: `${hours}h`,
    timestamp: Date.now(),
    totalRecords: history.length,
    returned: records.length,
    records,
    summary: {
      avgQualityScore:
        numericScores.length > 0
          ? (numericScores.reduce((sum, score) => sum + score, 0) / numericScores.length).toFixed(2)
          : 'N/A',
      bestExecution: numericScores.length > 0 ? Math.max(...numericScores) : 'N/A',
      worstExecution: numericScores.length > 0 ? Math.min(...numericScores) : 'N/A',
    },
  };

  res.json(
    createApiResponse(data, {
      pagination: {
        limit,
        offset: 0,
        total: history.length,
        hasMore: history.length > limit,
      },
    })
  );
}));

/**
 * POST /api/v1/execution/record-quote
 * 
 * Record a new execution quote (internal use)
 * 
 * Body:
 * {
 *   symbol, exchange, side, inputAmount, inputToken, outputToken,
 *   estimatedPrice, estimatedOutput, estimatedFee, estimatedSlippage
 * }
 */
router.post('/record-quote', authenticateToken, isSuperUser, asyncHandler(async (req: Request, res: Response) => {
  const {
    symbol,
    exchange,
    side,
    inputAmount,
    inputToken,
    outputToken,
    estimatedPrice,
    estimatedOutput,
    estimatedFee,
    estimatedSlippage,
  } = req.body;

  const record = await executionTracking.recordQuote(
    symbol,
    exchange,
    side,
    inputAmount,
    inputToken,
    outputToken,
    estimatedPrice,
    estimatedOutput,
    estimatedFee,
    estimatedSlippage
  );

  res.json(createApiResponse({ quoteId: record.id }));
}));

/**
 * POST /api/v1/execution/record-execution
 * 
 * Record execution results (internal use)
 * 
 * Body:
 * {
 *   quoteId, actualPrice, actualOutput, actualFee, actualSlippage,
 *   executionTime, txHash, status, failureReason?
 * }
 */
router.post('/record-execution', authenticateToken, isSuperUser, asyncHandler(async (req: Request, res: Response) => {
  const {
    quoteId,
    actualPrice,
    actualOutput,
    actualFee,
    actualSlippage,
    executionTime,
    txHash,
    status = 'filled',
    failureReason,
  } = req.body;

  const record = await executionTracking.recordExecution(
    quoteId,
    actualPrice,
    actualOutput,
    actualFee,
    actualSlippage,
    executionTime,
    txHash,
    status,
    failureReason
  );

  res.json(
    createApiResponse({
      executionId: record.id,
      qualityScore: record.executionQualityScore,
      slippageRealization: record.slippageRealization,
    })
  );
}));

export default router;
