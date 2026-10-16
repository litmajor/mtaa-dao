/**
 * Strategy Freqtrade Integration (Production)
 *
 * Orchestrates strategy persistence + Freqtrade backtest/hyperopt via
 * external wrapper commands. Designed for a *trusted operator* or
 * heavily sandboxed worker — never run untrusted Python on the API host.
 *
 * Hardening vs prior version
 * ─────────────────────────────────────────────────────────────
 * • Allocations accept percentage (0–100) or weight (0–1)
 * • Jobs tracked with optional worker handoff (in-process fallback)
 * • enableOptimization honored when queueing
 * • deploy/link require creatorId match
 * • Strategy file writes restricted to safe ids + strategies dir
 * • Subprocess timeouts, stderr capture, concurrency guard
 * • No busy-wait required for HTTP (queue + getJobStatus)
 */

import { spawn, type ChildProcess } from 'child_process';
import { createHash } from 'crypto';
import { join, resolve, basename } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { db } from '../db';
import {
  strategiesTable,
  strategyAllocationsTable,
  backtestJobsTable,
} from '../db/schema/strategies';

const logger = Logger.getLogger();

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

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
  strategyCode?: string;
  strategyName?: string;
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
  requestedBy?: string;
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

export type AllocationInput =
  | { asset: string; percentage: number; weight?: never }
  | { asset: string; weight: number; percentage?: never }
  | { asset: string; percentage?: number; weight?: number };

export interface ServiceOptions {
  /** Max concurrent wrapper processes in this process (default 1) */
  maxConcurrentJobs?: number;
  backtestTimeoutMs?: number;
  optimizeTimeoutMs?: number;
  /**
   * If set, called instead of in-process void execute*.
   * Use BullMQ/worker to run runJobPayload(jobId).
   */
  enqueueJob?: (jobId: string, kind: 'backtest' | 'optimization') => Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// Env / config
// ─────────────────────────────────────────────────────────────

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const BACKTEST_WRAPPER = env('FREQTRADE_BACKTEST_WRAPPER');
const OPTIMIZE_WRAPPER = env('FREQTRADE_OPTIMIZE_WRAPPER');
const STRATEGIES_DIR = env('FREQTRADE_STRATEGIES_DIR');
const API_URL = env('FREQTRADE_API_URL');
const API_TOKEN = env('FREQTRADE_API_TOKEN');

/** Only allow safe strategy id characters in filenames */
function assertSafeStrategyId(strategyId: string): string {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(strategyId)) {
    throw new Error('Invalid strategyId for filesystem use');
  }
  return strategyId;
}

function parseCommandString(input: string): { cmd: string; args: string[] } {
  const re = /(?:[^\s"']+|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')+/g;
  const parts = (input.match(re) ?? []).map((s) =>
    s.replace(/^['"]|['"]$/g, '')
  );
  if (!parts[0]) throw new Error('Wrapper command is empty');
  return { cmd: parts[0], args: parts.slice(1) };
}

function normalizeAllocations(
  allocations: AllocationInput[]
): Array<{ asset: string; weight: number }> {
  if (!allocations?.length) {
    throw new Error('allocations are required');
  }

  const out: Array<{ asset: string; weight: number }> = [];
  const seen = new Set<string>();

  for (const a of allocations) {
    const asset = String(a.asset || '')
      .trim()
      .toUpperCase();
    if (!asset) throw new Error('allocation asset is required');
    if (seen.has(asset)) throw new Error(`Duplicate asset: ${asset}`);
    seen.add(asset);

    let weight: number;
    if (typeof a.weight === 'number' && Number.isFinite(a.weight)) {
      weight = a.weight;
    } else if (
      typeof a.percentage === 'number' &&
      Number.isFinite(a.percentage)
    ) {
      weight = a.percentage / 100;
    } else {
      throw new Error(`allocation for ${asset} needs weight or percentage`);
    }

    if (!(weight > 0) || weight > 1) {
      throw new Error(`allocation weight for ${asset} must be in (0, 1]`);
    }
    out.push({ asset, weight });
  }

  const sum = out.reduce((s, x) => s + x.weight, 0);
  if (Math.abs(sum - 1) > 0.01) {
    throw new Error(`Allocations must sum to 1.0 (got ${sum.toFixed(4)})`);
  }
  return out;
}

interface WrapperOutput {
  metrics: BacktestMetrics | null;
  bestParameters: Record<string, unknown> | null;
  raw: Record<string, unknown>;
}

async function runWrapperSubprocess(
  wrapperCommand: string,
  payload: unknown,
  timeoutMs: number
): Promise<WrapperOutput> {
  return new Promise((resolvePromise, reject) => {
    const { cmd, args } = parseCommandString(wrapperCommand);
    const cp: ChildProcess = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      try {
        cp.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      reject(new Error(`Wrapper timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    cp.stdout?.on('data', (c: Buffer) => {
      stdout += c.toString();
      if (stdout.length > 5_000_000) {
        killed = true;
        cp.kill('SIGKILL');
        reject(new Error('Wrapper stdout exceeded size limit'));
      }
    });
    cp.stderr?.on('data', (c: Buffer) => {
      stderr += c.toString();
    });

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
        return reject(
          new Error(`Wrapper exited ${code}: ${stderr.slice(0, 500)}`)
        );
      }
      try {
        const raw = JSON.parse(stdout.trim() || '{}') as Record<
          string,
          unknown
        >;
        resolvePromise({
          metrics: (raw.metrics ?? null) as BacktestMetrics | null,
          bestParameters: (raw.bestParams ??
            raw.bestParameters ??
            null) as Record<string, unknown> | null,
          raw,
        });
      } catch (err) {
        reject(
          new Error(
            `Failed to parse wrapper stdout: ${(err as Error).message}. Raw: ${stdout.slice(0, 500)}`
          )
        );
      }
    });

    cp.stdin?.write(JSON.stringify(payload));
    cp.stdin?.end();
  });
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

class StrategyFreqtradeIntegration {
  private maxConcurrent: number;
  private backtestTimeoutMs: number;
  private optimizeTimeoutMs: number;
  private running = 0;
  private waitQueue: Array<() => void> = [];
  private enqueueJob?: ServiceOptions['enqueueJob'];

  constructor(options: ServiceOptions = {}) {
    this.maxConcurrent = options.maxConcurrentJobs ?? 1;
    this.backtestTimeoutMs = options.backtestTimeoutMs ?? 300_000;
    this.optimizeTimeoutMs = options.optimizeTimeoutMs ?? 600_000;
    this.enqueueJob = options.enqueueJob;
  }

  // ── Strategy lifecycle ─────────────────────────────────────

  async createStrategyWithFreqtrade(input: {
    creatorId: string;
    name: string;
    description?: string;
    allocations: AllocationInput[];
    freqtradeStrategyCode: string;
    freqtradeStrategyName?: string;
    riskLevel?: 'low' | 'medium' | 'high';
    rebalanceFrequencyDays?: number;
    backtestRequest?: Omit<
      FreqtradeBacktestRequest,
      'strategyId' | 'strategyCode' | 'strategyName'
    >;
  }): Promise<string> {
    if (!input.freqtradeStrategyCode?.trim()) {
      throw new Error('freqtradeStrategyCode is required');
    }

    // Soft size guard — full sandbox still required in production
    if (input.freqtradeStrategyCode.length > 500_000) {
      throw new Error('freqtradeStrategyCode exceeds maximum size');
    }

    const freqtradeStrategyName =
      input.freqtradeStrategyName?.trim() || 'CustomStrategy';
    const normalized = normalizeAllocations(input.allocations);

    const strategyId = assertSafeStrategyId(
      `ft_${Date.now().toString(36)}_${uuidv4().replace(/-/g, '').slice(0, 12)}`
    );
    const freqtradeStrategyId = `ft_${strategyId}`;

    const targetAllocations: Record<string, number> = {};
    for (const a of normalized) targetAllocations[a.asset] = a.weight;

    await db.transaction(async (trx) => {
      await trx.insert(strategiesTable).values({
        id: strategyId,
        creatorId: input.creatorId,
        name: input.name,
        description: input.description,
        targetAllocations: targetAllocations as any,
        rebalanceFrequency: input.rebalanceFrequencyDays
          ? `${input.rebalanceFrequencyDays}d`
          : 'weekly',
        riskLevel: input.riskLevel ?? 'medium',
        freqtradeStrategyId,
        freqtradeCode: input.freqtradeStrategyCode,
        freqtradeName: freqtradeStrategyName,
        isActive: true,
        totalFollowers: 0,
        assetsUnderManagement: '0',
        ytdReturnPercent: '0',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      for (const alloc of normalized) {
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

    logger.info('[StrategyFreqtrade] Strategy created', {
      strategyId,
      name: input.name,
      creatorId: input.creatorId,
    });

    if (input.backtestRequest) {
      await this.queueBacktest({
        ...input.backtestRequest,
        strategyId,
        strategyCode: input.freqtradeStrategyCode,
        strategyName: freqtradeStrategyName,
        requestedBy: input.creatorId,
      });
    }

    return strategyId;
  }

  async getStrategyDetails(strategyId: string) {
    const rows = await db
      .select()
      .from(strategiesTable)
      .where(eq(strategiesTable.id, strategyId))
      .limit(1);
    return rows[0];
  }

  async deployStrategy(
    strategyId: string,
    userId: string,
    dryRun = false
  ): Promise<boolean> {
    const strategy = await this.getStrategyOrThrow(strategyId);
    this.assertCreator(strategy, userId);

    if (dryRun) {
      logger.info('[StrategyFreqtrade] Dry-run deploy', { strategyId });
      return true;
    }

    const code = strategy.freqtradeCode as string | undefined;
    const name = strategy.freqtradeName as string | undefined;
    if (!code) throw new Error(`Strategy ${strategyId} has no freqtradeCode`);
    if (!name) throw new Error(`Strategy ${strategyId} has no freqtradeName`);

    await this.writeStrategyFile(strategyId, code);

    if (API_URL) {
      const { default: axios } = await import('axios');
      await axios.post(
        `${API_URL}/api/v1/reload_config`,
        {},
        {
          timeout: 15_000,
          headers: API_TOKEN
            ? { Authorization: `Bearer ${API_TOKEN}` }
            : undefined,
        }
      );
      logger.info('[StrategyFreqtrade] reload_config sent');
    }

    await db
      .update(strategiesTable)
      .set({ isDeployed: true, deployedAt: new Date() } as any)
      .where(eq(strategiesTable.id, strategyId));

    logger.info('[StrategyFreqtrade] Deployed', { strategyId, userId });
    return true;
  }

  async linkFreqtradeStrategy(
    strategyId: string,
    freqtradeStrategyId: string,
    userId: string
  ): Promise<boolean> {
    const strategy = await this.getStrategyOrThrow(strategyId);
    this.assertCreator(strategy, userId);

    await db
      .update(strategiesTable)
      .set({ freqtradeStrategyId, updatedAt: new Date() })
      .where(eq(strategiesTable.id, strategyId));

    logger.info('[StrategyFreqtrade] Linked', {
      strategyId,
      freqtradeStrategyId,
    });
    return true;
  }

  // ── Backtest / optimize queue ──────────────────────────────

  async queueBacktest(request: FreqtradeBacktestRequest): Promise<string> {
    const strategy = await this.getStrategyOrThrow(request.strategyId);
    if (request.requestedBy) {
      this.assertCreator(strategy, request.requestedBy);
    }

    const code =
      request.strategyCode ?? (strategy.freqtradeCode as string | undefined);
    const name =
      request.strategyName ?? (strategy.freqtradeName as string | undefined);
    if (!code) throw new Error(`Strategy ${request.strategyId} has no code`);
    if (!name) throw new Error(`Strategy ${request.strategyId} has no class name`);

    const kind = request.enableOptimization ? 'optimization' : 'backtest';
    const jobId = assertSafeStrategyId(
      `${kind === 'optimization' ? 'optim' : 'bt'}_${Date.now().toString(36)}_${uuidv4().slice(0, 8)}`
    );

    await db.insert(backtestJobsTable).values({
      id: jobId,
      strategyId: request.strategyId,
      kind,
      status: 'pending',
      metrics: null,
      bestParameters: null,
      error: null,
      // store request snapshot if column exists — cast for flexibility
      requestPayload: {
        pair: request.pair,
        timeframe: request.timeframe,
        timerange: request.timerange,
        stakeAmount: request.stakeAmount,
        startingCapital: request.startingCapital ?? 10_000,
        optParams: request.optParams,
        strategyName: name,
        codeSha256: createHash('sha256').update(code).digest('hex'),
      } as any,
      requestedAt: new Date(),
      startedAt: null,
      completedAt: null,
      durationMs: null,
    } as any);

    logger.info('[StrategyFreqtrade] Job queued', { jobId, kind });

    await this.dispatchJob(jobId, kind, async () => {
      if (kind === 'optimization') {
        await this.executeOptimization(jobId, request.strategyId, code, {
          trials: request.optParams?.trials,
          spaces: request.optParams?.spaces,
          timeframe: request.timeframe,
          timerange: request.timerange,
        });
      } else {
        await this.executeBacktest(jobId, request, code, name);
      }
    });

    return jobId;
  }

  /**
   * Blocking helper for trusted internal callers only.
   * Prefer queueBacktest + getJobStatus from HTTP handlers.
   */
  async runBacktest(
    request: FreqtradeBacktestRequest,
    timeoutMs = 300_000
  ): Promise<BacktestMetrics> {
    const jobId = await this.queueBacktest({
      ...request,
      enableOptimization: false,
    });
    return this.pollForCompletion(jobId, timeoutMs);
  }

  async optimizeStrategyParameters(
    strategyId: string,
    userId: string,
    options: {
      timeframe?: string;
      timerange?: string;
      trials?: number;
      spaces?: string[];
    } = {}
  ): Promise<string> {
    const strategy = await this.getStrategyOrThrow(strategyId);
    this.assertCreator(strategy, userId);
    const code = strategy.freqtradeCode as string | undefined;
    if (!code) throw new Error(`Strategy ${strategyId} has no code`);

    return this.queueBacktest({
      strategyId,
      strategyCode: code,
      strategyName: strategy.freqtradeName as string,
      pair: 'BTC/USDT',
      timeframe: options.timeframe ?? '1h',
      timerange: options.timerange ?? '20230101-',
      stakeAmount: 100,
      enableOptimization: true,
      optParams: {
        trials: options.trials,
        spaces: options.spaces,
      },
      requestedBy: userId,
    });
  }

  /** Worker entry: run a pending job by id (for external queue consumers) */
  async runJobById(jobId: string): Promise<void> {
    const job = await this.getJobStatus(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    if (job.status === 'completed' || job.status === 'cancelled') return;
    if (job.status === 'running') {
      logger.warn('[StrategyFreqtrade] Job already running', { jobId });
      return;
    }

    const strategy = await this.getStrategyOrThrow(job.strategyId);
    const code = strategy.freqtradeCode as string;
    const name = strategy.freqtradeName as string;

    if (job.kind === 'optimization') {
      await this.executeOptimization(jobId, job.strategyId, code, {});
    } else {
      await this.executeBacktest(
        jobId,
        {
          strategyId: job.strategyId,
          pair: 'BTC/USDT',
          timeframe: '1h',
          timerange: '20230101-',
          stakeAmount: 100,
          enableOptimization: false,
        },
        code,
        name
      );
    }
  }

  async cancelJob(jobId: string, userId: string): Promise<boolean> {
    const job = await this.getJobStatus(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    const strategy = await this.getStrategyOrThrow(job.strategyId);
    this.assertCreator(strategy, userId);

    if (job.status === 'completed' || job.status === 'failed') {
      return false;
    }

    await db
      .update(backtestJobsTable)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
        error: 'Cancelled by user',
      })
      .where(eq(backtestJobsTable.id, jobId));

    return true;
  }

  // ── Queries ────────────────────────────────────────────────

  async getJobStatus(jobId: string): Promise<BacktestJob | null> {
    const rows = await db
      .select()
      .from(backtestJobsTable)
      .where(eq(backtestJobsTable.id, jobId))
      .limit(1);
    return rows.length ? (rows[0] as unknown as BacktestJob) : null;
  }

  async getStrategyBacktestResults(
    strategyId: string
  ): Promise<BacktestMetrics | null> {
    const rows = await db
      .select()
      .from(strategiesTable)
      .where(eq(strategiesTable.id, strategyId))
      .limit(1);
    return rows.length
      ? ((rows[0].backtestResults as BacktestMetrics) ?? null)
      : null;
  }

  async getStrategiesByPerformance(
    metric: 'sharpe' | 'return' | 'drawdown' = 'sharpe',
    limit = 20
  ): Promise<any[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const orderColumn =
      metric === 'sharpe'
        ? sql`(backtest_results->>'sharpeRatio')::float`
        : metric === 'return'
          ? sql`(backtest_results->>'totalProfitPercent')::float`
          : sql`(backtest_results->>'maxDrawdownPercent')::float`;

    return db
      .select()
      .from(strategiesTable)
      .where(isNotNull(strategiesTable.backtestResults))
      .orderBy(
        metric === 'drawdown' ? sql`${orderColumn} ASC` : desc(orderColumn)
      )
      .limit(safeLimit);
  }

  // ── Execution ──────────────────────────────────────────────

  private async dispatchJob(
    jobId: string,
    kind: 'backtest' | 'optimization',
    runner: () => Promise<void>
  ): Promise<void> {
    if (this.enqueueJob) {
      await this.enqueueJob(jobId, kind);
      return;
    }
    // In-process fallback with concurrency limit
    void this.withConcurrency(async () => {
      try {
        await runner();
      } catch (err) {
        logger.error('[StrategyFreqtrade] Unhandled job error', {
          jobId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  private async withConcurrency<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.maxConcurrent) {
      await new Promise<void>((r) => this.waitQueue.push(r));
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.waitQueue.shift();
      if (next) next();
    }
  }

  private async executeBacktest(
    jobId: string,
    request: FreqtradeBacktestRequest,
    code: string,
    name: string
  ): Promise<void> {
    const startedAt = Date.now();
    try {
      const current = await this.getJobStatus(jobId);
      if (current?.status === 'cancelled') return;

      await db
        .update(backtestJobsTable)
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
        startingCapital: request.startingCapital ?? 10_000,
        strategyFile: `${assertSafeStrategyId(request.strategyId)}.py`,
      };

      const wrapper = requireEnv(
        'FREQTRADE_BACKTEST_WRAPPER',
        BACKTEST_WRAPPER
      );
      const { metrics } = await runWrapperSubprocess(
        wrapper,
        payload,
        this.backtestTimeoutMs
      );

      if (!metrics) {
        throw new Error('Backtest completed but wrapper returned no metrics');
      }

      await this.persistMetrics(request.strategyId, metrics);

      await db
        .update(backtestJobsTable)
        .set({
          status: 'completed',
          metrics: metrics as any,
          completedAt: new Date(),
          durationMs: Date.now() - startedAt,
        })
        .where(eq(backtestJobsTable.id, jobId));

      logger.info('[StrategyFreqtrade] Backtest complete', {
        strategyId: request.strategyId,
        sharpe: metrics.sharpeRatio,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      await db
        .update(backtestJobsTable)
        .set({
          status: 'failed',
          error: errMsg,
          completedAt: new Date(),
          durationMs: Date.now() - startedAt,
        })
        .where(eq(backtestJobsTable.id, jobId));
      logger.error('[StrategyFreqtrade] Backtest failed', { jobId, errMsg });
    }
  }

  private async executeOptimization(
    jobId: string,
    strategyId: string,
    code: string,
    options: {
      trials?: number;
      spaces?: string[];
      timeframe?: string;
      timerange?: string;
    }
  ): Promise<void> {
    const startedAt = Date.now();
    try {
      const current = await this.getJobStatus(jobId);
      if (current?.status === 'cancelled') return;

      await db
        .update(backtestJobsTable)
        .set({ status: 'running', startedAt: new Date() })
        .where(eq(backtestJobsTable.id, jobId));

      await this.writeStrategyFile(strategyId, code);

      const payload = {
        mode: 'hyperopt',
        strategyId,
        strategyFile: `${assertSafeStrategyId(strategyId)}.py`,
        trials: options.trials ?? 50,
        spaces: options.spaces ?? ['buy', 'sell', 'roi', 'stoploss'],
        timeframe: options.timeframe ?? '1h',
        timerange: options.timerange,
      };

      const wrapper = requireEnv(
        'FREQTRADE_OPTIMIZE_WRAPPER',
        OPTIMIZE_WRAPPER
      );
      const { metrics, bestParameters } = await runWrapperSubprocess(
        wrapper,
        payload,
        this.optimizeTimeoutMs
      );

      if (!metrics) {
        throw new Error('Optimization completed but returned no metrics');
      }

      await this.persistMetrics(strategyId, metrics);

      await db
        .update(backtestJobsTable)
        .set({
          status: 'completed',
          metrics: metrics as any,
          bestParameters: bestParameters as any,
          completedAt: new Date(),
          durationMs: Date.now() - startedAt,
        })
        .where(eq(backtestJobsTable.id, jobId));

      logger.info('[StrategyFreqtrade] Optimization complete', { strategyId });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      await db
        .update(backtestJobsTable)
        .set({
          status: 'failed',
          error: errMsg,
          completedAt: new Date(),
          durationMs: Date.now() - startedAt,
        })
        .where(eq(backtestJobsTable.id, jobId));
      logger.error('[StrategyFreqtrade] Optimization failed', {
        jobId,
        errMsg,
      });
    }
  }

  // ── Private helpers ────────────────────────────────────────

  private assertCreator(strategy: any, userId: string) {
    const creator = strategy.creatorId ?? strategy.creator;
    if (creator !== userId) {
      throw new Error('Forbidden: not strategy creator');
    }
  }

  private async getStrategyOrThrow(strategyId: string): Promise<any> {
    const strategy = await this.getStrategyDetails(strategyId);
    if (!strategy) throw new Error(`Strategy not found: ${strategyId}`);
    return strategy;
  }

  private async writeStrategyFile(
    strategyId: string,
    code: string
  ): Promise<void> {
    const id = assertSafeStrategyId(strategyId);
    const strategiesDir = requireEnv(
      'FREQTRADE_STRATEGIES_DIR',
      STRATEGIES_DIR
    );
    const base = resolve(strategiesDir);
    const target = resolve(join(base, `${id}.py`));
    if (!target.startsWith(base + '/') && target !== join(base, `${id}.py`)) {
      // path traversal guard
      if (!target.startsWith(base)) {
        throw new Error('Invalid strategy path');
      }
    }
    await mkdir(base, { recursive: true });
    await writeFile(target, code, { encoding: 'utf-8', mode: 0o640 });
  }

  private async persistMetrics(
    strategyId: string,
    metrics: BacktestMetrics
  ): Promise<void> {
    await db
      .update(strategiesTable)
      .set({
        backtestResults: metrics as any,
        lastBacktestedAt: new Date(),
        sharpeRatio: String(metrics.sharpeRatio),
        maxDrawdownPercent: String(metrics.maxDrawdownPercent),
        ytdReturnPercent: String(metrics.totalProfitPercent),
        updatedAt: new Date(),
      })
      .where(eq(strategiesTable.id, strategyId));
  }

  private async pollForCompletion(
    jobId: string,
    timeoutMs: number
  ): Promise<BacktestMetrics> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const job = await this.getJobStatus(jobId);
      if (!job) throw new Error(`Job ${jobId} not found`);
      if (job.status === 'completed') {
        if (!job.metrics) throw new Error('Job completed but metrics are null');
        return job.metrics;
      }
      if (job.status === 'failed') {
        throw new Error(job.error ?? 'Job failed');
      }
      if (job.status === 'cancelled') {
        throw new Error('Job cancelled');
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
  }
}

export { StrategyFreqtradeIntegration };
export const strategyFreqtradeIntegration = new StrategyFreqtradeIntegration({
  // Wire BullMQ in server bootstrap:
  // enqueueJob: async (jobId) => { await freqtradeQueue.add('run', { jobId }); }
});