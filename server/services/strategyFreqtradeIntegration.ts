/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * STRATEGY FREQTRADE INTEGRATION SERVICE — PRODUCTION BACKTEST ENGINE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Zero-mock backtest & hyperopt orchestrator.
 * Requires Freqtrade + Python wrapper scripts installed.
 */

import { Logger } from '../utils/logger';
import { spawn } from 'child_process';
import { db } from '../db';
import { strategiesTable, strategyAllocationsTable, backtestJobsTable } from '../db/schema/strategies';
import { eq, desc, isNotNull, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const logger = Logger.getLogger();

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BacktestMetrics {
  totalTrades: number;
  profitableTrades: number;
  losingTrades: number;
  winRatePercent: number;
  totalProfitUsd: number;
  totalProfitPercent: number;
  avgProfitPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdownPercent: number;
  buyAndHoldPercent: number;
  exposureTimePercent: number;
  avgDurationMinutes: number;
  recoveryFactor: number;
  expectancy: number;
}

export interface FreqtradeBacktestRequest {
  strategyId: string;
  strategyCode?: string;   // falls back to DB stored code
  strategyName?: string;   // falls back to DB stored name (class name)
  pair: string;
  timeframe: string;
  timerange: string;
  stakeAmount: number;
  startingCapital?: number;
  enableOptimization: boolean;
  optParams?: {
    spaces?: string[];
    trials?: number;
    epochs?: number;
  };
}

export interface BacktestJob {
  id: string;
  strategyId: string;
  kind: 'backtest' | 'optimization';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  metrics: BacktestMetrics | null;
  bestParameters: Record<string, unknown> | null;
  error: string | null;
  requestedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENV LOADING — defer configuration validation until the feature is actually used
// ═══════════════════════════════════════════════════════════════════════════════

function getEnv(name: string, required = false): string | undefined {
  const value = process.env[name];
  if (!value && required) {
    const err = new Error(`Missing required environment variable: ${name}`);
    logger.error(err.message);
    throw err;
  }
  return value;
}

function ensureEnv(name: string, value: string | undefined): string {
  if (!value) {
    const err = new Error(`Missing required environment variable: ${name}`);
    logger.error(err.message);
    throw err;
  }
  return value;
}

const BACKTEST_WRAPPER = process.env.FREQTRADE_BACKTEST_WRAPPER;
const OPTIMIZE_WRAPPER = process.env.FREQTRADE_OPTIMIZE_WRAPPER;
const STRATEGIES_DIR = process.env.FREQTRADE_STRATEGIES_DIR;
const API_URL = process.env.FREQTRADE_API_URL;
const API_TOKEN = process.env.FREQTRADE_API_TOKEN;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function parseCommandString(input: string): { cmd: string; args: string[] } {
  const re = /(?:[^\s"']+|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')+/g;
  const parts = (input.match(re) ?? []).map((s) => s.replace(/^['"]|['"]$/g, ''));
  return { cmd: parts[0] ?? '', args: parts.slice(1) };
}

interface WrapperOutput {
  metrics: BacktestMetrics | null;
  bestParameters: Record<string, unknown> | null;
  raw: Record<string, unknown>;
}

async function runWrapperSubprocess(
  wrapperCommand: string,
  payload: unknown,
  timeoutMs: number,
): Promise<WrapperOutput> {
  return new Promise((resolve, reject) => {
    const { cmd, args } = parseCommandString(wrapperCommand);
    const cp = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      cp.kill('SIGKILL');
      reject(new Error(`Wrapper subprocess timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    cp.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    cp.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    cp.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn wrapper: ${err.message}`));
    });

    cp.on('close', (code) => {
      clearTimeout(timer);
      if (killed) return;

      if (code !== 0) {
        logger.error('[FreqtradeWrapper] Non-zero exit', {
          code,
          stderr: stderr.slice(0, 2000),
        });
        return reject(new Error(`Wrapper exited ${code}: ${stderr.slice(0, 500)}`));
      }

      try {
        const raw = JSON.parse(stdout.trim() || '{}') as Record<string, unknown>;
        const metrics = (raw.metrics ?? null) as BacktestMetrics | null;
        const bestParameters = (raw.bestParams ?? raw.bestParameters ?? null) as Record<string, unknown> | null;
        resolve({ metrics, bestParameters, raw });
      } catch (err) {
        reject(new Error(
          `Failed to parse wrapper stdout: ${(err as Error).message}. Raw: ${stdout.slice(0, 500)}`
        ));
      }
    });

    cp.stdin.write(JSON.stringify(payload));
    cp.stdin.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

class StrategyFreqtradeIntegration {
  // ── STRATEGY LIFECYCLE ────────────────────────────────────────────────────

  async createStrategyWithFreqtrade(input: {
    creatorId: string;
    name: string;
    description?: string;
    allocations: Array<{ asset: string; weight: number }>;
    freqtradeStrategyCode: string;
    freqtradeStrategyName: string;
    backtestRequest?: Omit<FreqtradeBacktestRequest, 'strategyId' | 'strategyCode' | 'strategyName'>;
  }): Promise<string> {
    if (!input.freqtradeStrategyCode?.trim()) {
      throw new Error('freqtradeStrategyCode is required');
    }
    if (!input.freqtradeStrategyName?.trim()) {
      throw new Error('freqtradeStrategyName (Python class name) is required');
    }

    const strategyId = `strategy_${Date.now()}_${uuidv4()}`;
    const freqtradeStrategyId = `ft_${strategyId}`;

    const targetAllocations: Record<string, number> = {};
    let totalWeight = 0;
    for (const alloc of input.allocations) {
      targetAllocations[alloc.asset] = alloc.weight;
      totalWeight += alloc.weight;
    }
    if (Math.abs(totalWeight - 1) > 0.01) {
      throw new Error(`Allocations must sum to 1.0 (got ${totalWeight})`);
    }

    await db.transaction(async (trx) => {
      await trx.insert(strategiesTable).values({
        id: strategyId,
        creatorId: input.creatorId,
        name: input.name,
        description: input.description,
        targetAllocations: targetAllocations as any,
        rebalanceFrequency: 'weekly',
        riskLevel: 'medium',
        freqtradeStrategyId,
        freqtradeCode: input.freqtradeStrategyCode,
        freqtradeName: input.freqtradeStrategyName,
        isActive: true,
        totalFollowers: 0,
        assetsUnderManagement: '0',
        ytdReturnPercent: '0',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      for (const alloc of input.allocations) {
        await trx.insert(strategyAllocationsTable).values({
          id: uuidv4(),
          strategyId,
          asset: alloc.asset,
          targetWeightPercent: String(alloc.weight * 100),
          currentWeightPercent: String(alloc.weight * 100),
          driftPercent: '0',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    });

    logger.info(`✅ Created strategy: ${input.name} (${strategyId})`);

    if (input.backtestRequest) {
      await this.queueBacktest({
        ...input.backtestRequest,
        strategyId,
        strategyCode: input.freqtradeStrategyCode,
        strategyName: input.freqtradeStrategyName,
      });
    }

    return strategyId;
  }

  async deployStrategy(strategyId: string, userId: string, dryRun = false): Promise<boolean> {
    const strategy = await this.getStrategyOrThrow(strategyId);

    if (dryRun) {
      logger.info(`[StrategyFreqtrade] Dry run: no deployment for ${strategyId}`);
      return true;
    }

    const code = (strategy as any).freqtradeCode as string | undefined;
    const name = (strategy as any).freqtradeName as string | undefined;
    if (!code) throw new Error(`Strategy ${strategyId} has no freqtradeCode`);
    if (!name) throw new Error(`Strategy ${strategyId} has no freqtradeName`);

    const { writeFile } = await import('fs/promises');
    const { join } = await import('path');
    const strategiesDir = ensureEnv('FREQTRADE_STRATEGIES_DIR', STRATEGIES_DIR);
    await writeFile(join(strategiesDir, `${strategyId}.py`), code, 'utf-8');
    logger.info(`[StrategyFreqtrade] Wrote strategy file: ${strategyId}.py`);

    if (API_URL) {
      const { default: axios } = await import('axios');
      await axios.post(
        `${API_URL}/api/v1/reload_config`,
        {},
        { headers: { Authorization: API_TOKEN ? `Bearer ${API_TOKEN}` : undefined } },
      );
      logger.info('[StrategyFreqtrade] reload_config sent');
    }

    await db
      .update(strategiesTable)
      .set({ isDeployed: true, deployedAt: new Date() } as any)
      .where(eq(strategiesTable.id, strategyId));

    logger.info(`✅ Strategy ${strategyId} deployed`);
    return true;
  }

  async linkFreqtradeStrategy(strategyId: string, freqtradeStrategyId: string): Promise<boolean> {
    await this.getStrategyOrThrow(strategyId);

    await db
      .update(strategiesTable)
      .set({ freqtradeStrategyId })
      .where(eq(strategiesTable.id, strategyId));

    logger.info(`✅ Linked Freqtrade strategy ${freqtradeStrategyId} → ${strategyId}`);
    return true;
  }

  // ── BACKTESTING ───────────────────────────────────────────────────────────

  async queueBacktest(request: FreqtradeBacktestRequest): Promise<string> {
    const strategy = await this.getStrategyOrThrow(request.strategyId);
    const code = request.strategyCode ?? (strategy as any).freqtradeCode;
    const name = request.strategyName ?? (strategy as any).freqtradeName;
    if (!code) throw new Error(`Strategy ${request.strategyId} has no backtest code`);
    if (!name) throw new Error(`Strategy ${request.strategyId} has no strategy class name`);

    const jobId = `backtest_${request.strategyId}_${Date.now()}`;

    await db.insert(backtestJobsTable).values({
      id: jobId,
      strategyId: request.strategyId,
      kind: 'backtest',
      status: 'pending',
      metrics: null,
      bestParameters: null,
      error: null,
      requestedAt: new Date(),
      startedAt: null,
      completedAt: null,
      durationMs: null,
    });

    logger.info(`[StrategyFreqtrade] Queued backtest ${jobId}`);

    void this.executeBacktest(jobId, request, code, name);

    return jobId;
  }

  async runBacktest(
    request: FreqtradeBacktestRequest,
    timeoutMs: number = 300_000,
  ): Promise<BacktestMetrics> {
    const jobId = await this.queueBacktest(request);
    return this.pollForCompletion(jobId, timeoutMs);
  }

  private async executeBacktest(
    jobId: string,
    request: FreqtradeBacktestRequest,
    code: string,
    name: string,
  ): Promise<void> {
    const startedAt = Date.now();
    try {
      await db.update(backtestJobsTable)
        .set({ status: 'running', startedAt: new Date() })
        .where(eq(backtestJobsTable.id, jobId));

      await this.writeStrategyFile(request.strategyId, code);

      const payload = {
        mode: 'backtest',
        strategyId: request.strategyId,
        strategyName: name,
        pair: request.pair,
        timeframe: request.timeframe,
        timerange: request.timerange,
        stakeAmount: request.stakeAmount,
        startingCapital: request.startingCapital ?? 10000,
        strategyFile: `${request.strategyId}.py`,
      };

      const backtestWrapper = ensureEnv('FREQTRADE_BACKTEST_WRAPPER', BACKTEST_WRAPPER);
      const { metrics, raw } = await runWrapperSubprocess(backtestWrapper, payload, 300_000);

      if (!metrics) {
        throw new Error('Backtest completed but wrapper returned no metrics');
      }

      await this.persistMetrics(request.strategyId, metrics);

      await db.update(backtestJobsTable)
        .set({
          status: 'completed',
          metrics: metrics as any,
          completedAt: new Date(),
          durationMs: Date.now() - startedAt,
        })
        .where(eq(backtestJobsTable.id, jobId));

      logger.info(
        `✅ Backtest complete — ${request.strategyId}: ` +
        `Sharpe=${metrics.sharpeRatio.toFixed(2)} WR=${metrics.winRatePercent}%`
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      await db.update(backtestJobsTable)
        .set({
          status: 'failed',
          error: errMsg,
          completedAt: new Date(),
          durationMs: Date.now() - startedAt,
        })
        .where(eq(backtestJobsTable.id, jobId));
      logger.error('[StrategyFreqtrade] Backtest failed:', error);
    }
  }

  // ── OPTIMISATION ──────────────────────────────────────────────────────────

  async optimizeStrategyParameters(
    strategyId: string,
    options: {
      timeframe?: string;
      timerange?: string;
      trials?: number;
      spaces?: string[];
    } = {},
  ): Promise<string> {
    const strategy = await this.getStrategyOrThrow(strategyId);
    const code = (strategy as any).freqtradeCode as string | undefined;
    if (!code) throw new Error(`Strategy ${strategyId} has no code for optimization`);

    const jobId = `optim_${strategyId}_${Date.now()}`;

    await db.insert(backtestJobsTable).values({
      id: jobId,
      strategyId,
      kind: 'optimization',
      status: 'pending',
      metrics: null,
      bestParameters: null,
      error: null,
      requestedAt: new Date(),
      startedAt: null,
      completedAt: null,
      durationMs: null,
    });

    logger.info(`[StrategyFreqtrade] Queued optimization ${jobId}`);

    void this.executeOptimization(jobId, strategyId, code, options);

    return jobId;
  }

  async runOptimization(
    strategyConfig: { id?: string; strategyId?: string; [key: string]: unknown },
    options: { trials?: number; spaces?: string[]; timeframe?: string; timerange?: string } = {},
    timeoutMs: number = 600_000,
  ): Promise<{ metrics: BacktestMetrics; bestParameters: Record<string, unknown> }> {
    const strategyId = strategyConfig.id ?? strategyConfig.strategyId;
    if (!strategyId) throw new Error('strategyConfig must have id or strategyId');

    const jobId = await this.optimizeStrategyParameters(String(strategyId), options);
    const metrics = await this.pollForCompletion(jobId, timeoutMs);
    if (!metrics) throw new Error('Optimization completed but no metrics returned');

    const job = await this.getJobStatus(jobId);
    return {
      metrics,
      bestParameters: job?.bestParameters ?? {},
    };
  }

  private async executeOptimization(
    jobId: string,
    strategyId: string,
    code: string,
    options: { trials?: number; spaces?: string[]; timeframe?: string; timerange?: string },
  ): Promise<void> {
    const startedAt = Date.now();
    try {
      await db.update(backtestJobsTable)
        .set({ status: 'running', startedAt: new Date() })
        .where(eq(backtestJobsTable.id, jobId));

      await this.writeStrategyFile(strategyId, code);

      const payload = {
        mode: 'hyperopt',
        strategyId,
        strategyFile: `${strategyId}.py`,
        trials: options.trials ?? 50,
        spaces: options.spaces ?? ['buy', 'sell', 'roi', 'stoploss'],
        timeframe: options.timeframe ?? '1h',
        timerange: options.timerange,
      };

      const optimizeWrapper = ensureEnv('FREQTRADE_OPTIMIZE_WRAPPER', OPTIMIZE_WRAPPER);
      const { metrics, bestParameters, raw } = await runWrapperSubprocess(
        optimizeWrapper,
        payload,
        600_000,
      );

      if (!metrics) throw new Error('Optimization completed but returned no metrics');

      await this.persistMetrics(strategyId, metrics);

      await db.update(backtestJobsTable)
        .set({
          status: 'completed',
          metrics: metrics as any,
          bestParameters: bestParameters as any,
          completedAt: new Date(),
          durationMs: Date.now() - startedAt,
        })
        .where(eq(backtestJobsTable.id, jobId));

      logger.info(
        `✅ Optimization complete — ${strategyId}: ` +
        `Sharpe=${metrics.sharpeRatio.toFixed(2)} DD=${metrics.maxDrawdownPercent.toFixed(1)}%`
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      await db.update(backtestJobsTable)
        .set({
          status: 'failed',
          error: errMsg,
          completedAt: new Date(),
          durationMs: Date.now() - startedAt,
        })
        .where(eq(backtestJobsTable.id, jobId));
      logger.error('[StrategyFreqtrade] Optimization failed:', error);
    }
  }

  // ── QUERIES ───────────────────────────────────────────────────────────────

  async getJobStatus(jobId: string): Promise<BacktestJob | null> {
    const rows = await db.select().from(backtestJobsTable).where(eq(backtestJobsTable.id, jobId)).limit(1);
    return rows.length > 0 ? (rows[0] as unknown as BacktestJob) : null;
  }

  async getStrategyBacktestResults(strategyId: string): Promise<BacktestMetrics | null> {
    const rows = await db
      .select()
      .from(strategiesTable)
      .where(eq(strategiesTable.id, strategyId))
      .limit(1);
    return rows.length > 0 ? (rows[0].backtestResults as BacktestMetrics) : null;
  }

  async getStrategiesByPerformance(
    metric: 'sharpe' | 'return' | 'drawdown' = 'sharpe',
    limit = 20,
  ): Promise<any[]> {
    const orderColumn =
      metric === 'sharpe'
        ? sql`(backtest_results->>'sharpeRatio')::float`
        : metric === 'return'
        ? sql`(backtest_results->>'totalProfitPercent')::float`
        : sql`(backtest_results->>'maxDrawdownPercent')::float`;

    const strategies = await db
      .select()
      .from(strategiesTable)
      .where(isNotNull(strategiesTable.backtestResults))
      .orderBy(metric === 'drawdown' ? sql`${orderColumn} ASC` : desc(orderColumn))
      .limit(limit);

    return strategies;
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────────────────────

  private async getStrategyOrThrow(strategyId: string): Promise<any> {
    const rows = await db.select().from(strategiesTable).where(eq(strategiesTable.id, strategyId)).limit(1);
    if (rows.length === 0) throw new Error(`Strategy not found: ${strategyId}`);
    return rows[0];
  }

  private async writeStrategyFile(strategyId: string, code: string): Promise<void> {
    const { writeFile } = await import('fs/promises');
    const { join } = await import('path');
    const strategiesDir = ensureEnv('FREQTRADE_STRATEGIES_DIR', STRATEGIES_DIR);
    await writeFile(join(strategiesDir, `${strategyId}.py`), code, 'utf-8');
  }

  private async persistMetrics(strategyId: string, metrics: BacktestMetrics): Promise<void> {
    await db
      .update(strategiesTable)
      .set({
        backtestResults: metrics as any,
        lastBacktestedAt: new Date(),
        sharpeRatio: String(metrics.sharpeRatio),
        maxDrawdownPercent: String(metrics.maxDrawdownPercent),
        ytdReturnPercent: String(metrics.totalProfitPercent),
      })
      .where(eq(strategiesTable.id, strategyId));
  }

  private async pollForCompletion(jobId: string, timeoutMs: number): Promise<BacktestMetrics> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const job = await this.getJobStatus(jobId);
      if (!job) throw new Error(`Job ${jobId} not found`);
      if (job.status === 'completed') {
        if (!job.metrics) throw new Error('Job completed but metrics are null');
        return job.metrics;
      }
      if (job.status === 'failed') throw new Error(job.error ?? 'Job failed');
      await new Promise((r) => setTimeout(r, 2_000));
    }
    throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
  }
}

export { StrategyFreqtradeIntegration };
export const strategyFreqtradeIntegration = new StrategyFreqtradeIntegration();