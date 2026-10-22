/**
 * Freqtrade Strategy API — Production Integration
 * TypeScript + Express + Real Freqtrade Wrapper
 *
 * Replaces mock backtester with StrategyFreqtradeIntegration.
 * All jobs are DB-tracked. Telegram notifications are fire-and-forget.
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { strategiesTable, backtestJobsTable } from '../db/schema/strategies';
import { users } from '../../shared/schema';
import { eq, desc, isNotNull } from 'drizzle-orm';
import { strategyFreqtradeIntegration } from '../services/strategyFreqtradeIntegration';
// Telegram helpers imported dynamically to avoid static resolution issues
import { logger } from '../utils/logger';


// ── VALIDATION SCHEMAS ─────────────────────────────────────────────────────

const uploadStrategySchema = z.object({
  name: z.string().min(1).max(256),
  description: z.string().max(2000).optional(),
  strategyCode: z.string().min(50, 'Strategy code looks too short'),
  strategyName: z.string().min(1, 'Python class name is required'),
  pair: z.string().default('BTC/USDT'),
  timeframe: z.string().default('1h'),
  allocations: z.array(
    z.object({
      asset: z.string(),
      weight: z.number().min(0).max(1),
    })
  ).min(1),
  backtestOnCreate: z.boolean().default(false),
  timerange: z.string().default('20240101-20241231'),
  stakeAmount: z.number().positive().default(100),
  startingCapital: z.number().positive().default(10000),
});

const backtestSchema = z.object({
  timerange: z.string().default('20240101-20241231'),
  stakeAmount: z.number().positive().default(100),
  startingCapital: z.number().positive().default(10000),
  pair: z.string().default('BTC/USDT'),
  timeframe: z.string().default('1h'),
  enableOptimization: z.boolean().default(false),
});

const hyperoptSchema = z.object({
  objective: z.enum(['sharpe', 'sortino', 'profit']).default('sharpe'),
  epochs: z.number().int().min(10).max(1000).default(100),
  timerange: z.string().default('20240101-20241231'),
  timeframe: z.string().default('1h'),
  spaces: z.array(z.string()).default(['buy', 'sell', 'roi', 'stoploss']),
  trials: z.number().int().default(50),
});

const deploySchema = z.object({
  dryRun: z.boolean().default(true),
  maxExposure: z.number().min(0).max(100).default(50),
});

// ── HELPERS ─────────────────────────────────────────────────────────────────

function getUserId(req: Request): string {
  // Replace with your auth middleware extraction
  const uid = (req as any).user?.id;
  if (!uid) throw new Error('Unauthorized');

  return uid;
}

async function maybeNotify(
  userId: string,
  fn: (chatId: number) => Promise<void>
): Promise<void> {
  try {
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const chatId = rows[0]?.telegramChatId;
    if (chatId) await fn(Number(chatId));
  } catch (err) {
    logger.error('[Telegram] Notification failed:', err);
  }
}

// ── ROUTES ──────────────────────────────────────────────────────────────────

/**
 * POST /api/freqtrade/strategies
 * Upload and validate a trading strategy. Optionally queues a backtest.
 */
export const uploadStrategy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = uploadStrategySchema.parse(req.body);
    const creatorId = getUserId(req);

    const totalWeight = input.allocations.reduce((s, a) => s + a.weight, 0);
    if (Math.abs(totalWeight - 1) > 0.01) {
      return res.status(400).json({ error: `Allocations must sum to 1.0 (got ${totalWeight})` });
    }

    // Validate Python syntax (basic interface check)
    const required = ['populate_indicators', 'populate_entry_trend', 'populate_exit_trend'];
    const missing = required.filter((m) => !input.strategyCode.includes(`def ${m}`));
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required methods: ${missing.join(', ')}` });
    }

    const strategyId = await strategyFreqtradeIntegration.createStrategyWithFreqtrade({
      creatorId,
      name: input.name,
      description: input.description,
      allocations: input.allocations,
      freqtradeStrategyCode: input.strategyCode,
      freqtradeStrategyName: input.strategyName,
      backtestRequest: input.backtestOnCreate
        ? {
            pair: input.pair,
            timeframe: input.timeframe,
            timerange: input.timerange,
            stakeAmount: input.stakeAmount,
            startingCapital: input.startingCapital,
            enableOptimization: false,
          }
        : undefined,
    });

    if (!strategyId) {
      return res.status(500).json({ error: 'Strategy creation failed' });
    }

    res.status(201).json({
      status: 'success',
      strategyId,
      message: input.backtestOnCreate ? 'Strategy created and backtest queued' : 'Strategy created',
      metadata: {
        pair: input.pair,
        timeframe: input.timeframe,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
};

/**
 * POST /api/freqtrade/strategies/:strategyId/backtest
 * Queue a backtest. Returns immediately with a jobId for polling.
 */
export const backtestStrategy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { strategyId } = req.params;
    const input = backtestSchema.parse(req.body);

    const rows = await db.select().from(strategiesTable).where(eq(strategiesTable.id, strategyId)).limit(1);
    if (!rows.length) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    const jobId = await strategyFreqtradeIntegration.queueBacktest({
      strategyId,
      pair: input.pair,
      timeframe: input.timeframe,
      timerange: input.timerange,
      stakeAmount: input.stakeAmount,
      startingCapital: input.startingCapital,
      enableOptimization: input.enableOptimization,
    });

    res.json({
      status: 'queued',
      jobId,
      strategyId,
      message: 'Backtest queued. Use GET /jobs/:jobId for status.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
};

/**
 * POST /api/freqtrade/strategies/:strategyId/backtest-sync
 * Run backtest and await result (blocking, for scripts/CLI use).
 * Timeout default: 5 minutes.
 */
export const backtestStrategySync = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { strategyId } = req.params;
    const input = backtestSchema.parse(req.body);
    const timeout = Math.min(Number(req.query.timeout) || 300_000, 900_000);

    const rows = await db.select().from(strategiesTable).where(eq(strategiesTable.id, strategyId)).limit(1);
    if (!rows.length) return res.status(404).json({ error: 'Strategy not found' });

    const metrics = await strategyFreqtradeIntegration.runBacktest(
      {
        strategyId,
        pair: input.pair,
        timeframe: input.timeframe,
        timerange: input.timerange,
        stakeAmount: input.stakeAmount,
        startingCapital: input.startingCapital,
        enableOptimization: input.enableOptimization,
      },
      timeout
    );

    // Notify user
    const userId = getUserId(req);
    await maybeNotify(userId, async (chatId) => {
      const mod = await import('../services/telegram.ts');
      const metricsObj: Record<string, unknown> = JSON.parse(JSON.stringify(metrics));
      return mod.notifyBacktestComplete(Number(chatId), rows[0].name, metricsObj, `sync_${strategyId}`);
    });

    res.json({
      status: 'completed',
      strategyId,
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
};

/**
 * POST /api/freqtrade/strategies/:strategyId/hyperopt
 * Queue hyperparameter optimization.
 */
export const hyperoptStrategy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { strategyId } = req.params;
    const input = hyperoptSchema.parse(req.body);

    const rows = await db.select().from(strategiesTable).where(eq(strategiesTable.id, strategyId)).limit(1);
    if (!rows.length) return res.status(404).json({ error: 'Strategy not found' });

    const jobId = await strategyFreqtradeIntegration.optimizeStrategyParameters(
      strategyId,
      getUserId(req),
      {
        timeframe: input.timeframe,
        timerange: input.timerange,
        trials: input.trials,
        spaces: input.spaces,
      },
    );

    res.json({
      status: 'queued',
      jobId,
      strategyId,
      objective: input.objective,
      epochs: input.epochs,
      message: 'Hyperopt queued. Use GET /jobs/:jobId for status.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
};

/**
 * POST /api/freqtrade/strategies/:strategyId/hyperopt-sync
 * Run hyperopt and await result.
 */
export const hyperoptStrategySync = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { strategyId } = req.params;
    const input = hyperoptSchema.parse(req.body);
    const timeout = Math.min(Number(req.query.timeout) || 600_000, 1_800_000);

    const rows = await db.select().from(strategiesTable).where(eq(strategiesTable.id, strategyId)).limit(1);
    if (!rows.length) return res.status(404).json({ error: 'Strategy not found' });

    const result = await strategyFreqtradeIntegration.runOptimization(
      strategyId,
      getUserId(req),
      {
        trials: input.trials,
        spaces: input.spaces,
        timeframe: input.timeframe,
        timerange: input.timerange,
      },
      timeout
    );

    const userId = getUserId(req);
    await maybeNotify(userId, async (chatId) => {
      const mod = await import('../services/telegram.ts');
      const metricsObj2: Record<string, unknown> = JSON.parse(JSON.stringify(result.metrics));
      const paramsObj: Record<string, unknown> = JSON.parse(JSON.stringify(result.bestParameters));
      return mod.notifyOptimizationComplete(Number(chatId), rows[0].name, metricsObj2, paramsObj);
    });

    res.json({
      status: 'completed',
      strategyId,
      metrics: result.metrics,
      bestParameters: result.bestParameters,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
};

/**
 * GET /api/freqtrade/jobs/:jobId
 * Poll job status (backtest or hyperopt).
 */
export const getJobStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const job = await strategyFreqtradeIntegration.getJobStatus(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      jobId: job.id,
      strategyId: job.strategyId,
      kind: job.kind,
      status: job.status,
      metrics: job.metrics,
      bestParameters: job.bestParameters,
      error: job.error,
      requestedAt: job.requestedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      durationMs: job.durationMs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/freqtrade/strategies/:strategyId/performance
 * Get latest persisted performance metrics for a strategy.
 */
export const getStrategyPerformance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { strategyId } = req.params;
    const metrics = await strategyFreqtradeIntegration.getStrategyBacktestResults(strategyId);

    if (!metrics) {
      return res.status(404).json({ error: 'No backtest results found for this strategy' });
    }

    res.json({
      strategyId,
      metrics,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/freqtrade/strategies/leaderboard
 * Top strategies by Sharpe, return, or drawdown.
 */
export const getLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metric = (req.query.metric as 'sharpe' | 'return' | 'drawdown') || 'sharpe';
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const strategies = await strategyFreqtradeIntegration.getStrategiesByPerformance(metric, limit);

    res.json({
      metric,
      count: strategies.length,
      strategies: strategies.map((s) => ({
        id: s.id,
        name: s.name,
        creatorId: s.creatorId,
        sharpeRatio: (s.backtestResults as any)?.sharpeRatio,
        totalProfitPercent: (s.backtestResults as any)?.totalProfitPercent,
        maxDrawdownPercent: (s.backtestResults as any)?.maxDrawdownPercent,
        lastBacktestedAt: s.lastBacktestedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/freqtrade/strategies
 * List user's strategies.
 */
export const listStrategies = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);

    const rows = await db
      .select()
      .from(strategiesTable)
      .where(eq(strategiesTable.creatorId, userId))
      .orderBy(desc(strategiesTable.createdAt));

    res.json({
      strategies: rows.map((s) => ({
        id: s.id,
        name: s.name,
        pair: (s as any).defaultPair || 'BTC/USDT',
        timeframe: (s as any).defaultTimeframe || '1h',
        isDeployed: (s as any).isDeployed || false,
        deployedAt: (s as any).deployedAt,
        backtestResults: s.backtestResults,
        lastBacktestedAt: s.lastBacktestedAt,
        createdAt: s.createdAt,
      })),
      total: rows.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/freqtrade/strategies/:strategyId/deploy
 * Deploy strategy to Freqtrade.
 */
export const deployStrategy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { strategyId } = req.params;
    const input = deploySchema.parse(req.body);
    const userId = getUserId(req);

    const success = await strategyFreqtradeIntegration.deployStrategy(strategyId, userId, input.dryRun);

    if (!success) {
      return res.status(500).json({ error: 'Deployment failed' });
    }

    res.json({
      status: 'deployed',
      strategyId,
      mode: input.dryRun ? 'dry_run' : 'live',
      maxExposure: `${input.maxExposure}%`,
      startTime: new Date().toISOString(),
      message: input.dryRun
        ? 'Strategy deployed in dry-run mode. Monitor before enabling live trading.'
        : 'Strategy deployed to live trading!',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
};

/**
 * POST /api/freqtrade/telegram/link
 * Link Telegram chat ID to user account.
 */
export const linkTelegram = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chatId, username } = z.object({
      chatId: z.string().or(z.number()).transform(Number),
      username: z.string().optional(),
    }).parse(req.body);

    const userId = getUserId(req);

    await db
      .update(users)
      .set({ telegramChatId: String(chatId), telegramUsername: username ?? null })
      .where(eq(users.id, userId));

    // Test message
    {
      const mod = await import('../services/telegram.ts');
      await mod.sendTelegramMessage(chatId, '✅ Your account is now linked. You will receive backtest alerts here.');
    }

    res.json({ status: 'linked', userId, chatId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
};

export default {
  uploadStrategy,
  backtestStrategy,
  backtestStrategySync,
  hyperoptStrategy,
  hyperoptStrategySync,
  getJobStatus,
  getStrategyPerformance,
  getLeaderboard,
  listStrategies,
  deployStrategy,
  linkTelegram,
};