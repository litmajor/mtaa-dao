/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * STRATEGY FREQTRADE INTEGRATION SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Orchestrates:
 *   • Backtest execution via subprocess wrapper (FREQTRADE_BACKTEST_WRAPPER)
 *   • Hyperopt via subprocess wrapper    (FREQTRADE_OPTIMIZE_WRAPPER)
 *   • Strategy lifecycle (create, deploy, link)
 *   • DB persistence of results
 *
 * Environment variables:
 *   FREQTRADE_BACKTEST_WRAPPER    Command to invoke backtest wrapper
 *                                 e.g. "python server/tools/freqtrade_wrapper.py"
 *   FREQTRADE_OPTIMIZE_WRAPPER    Command to invoke hyperopt wrapper
 *   FREQTRADE_STRATEGIES_DIR      Path to Freqtrade user_data/strategies/ directory
 *   FREQTRADE_API_URL             Freqtrade REST API base URL (for reload_config)
 *   FREQTRADE_API_TOKEN           Bearer token for Freqtrade REST API
 *
 * Mock fallback is the default when no wrapper env vars are set — safe for local dev.
 */

import { Logger } from '../utils/logger';
import { spawn }  from 'child_process';
import { db }     from '../db';
import { strategiesTable, strategyAllocationsTable } from '../db/schema/strategies';
import { eq, isNotNull } from 'drizzle-orm';
import { v4 as uuidv4 }  from 'uuid';

const logger = Logger.getLogger();

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

export interface BacktestMetrics {
  totalTrades:         number;
  profitableTrades:    number;
  losingTrades:        number;
  winRatePercent:      number;
  totalProfitUsd:      number;
  totalProfitPercent:  number;
  avgProfitPercent:    number;
  sharpeRatio:         number;
  sortinoRatio:        number;
  maxDrawdownPercent:  number;
  buyAndHoldPercent:   number;
  exposureTimePercent: number;
  avgDurationMinutes:  number;
  recoveryFactor:      number;
  expectancy:          number;
}

export interface FreqtradeBacktestRequest {
  strategyId:          string;
  strategyCode?:       string;   // Python source for Freqtrade IStrategy
  strategyName?:       string;   // Class name inside strategyCode
  pair:                string;   // "BTC/USDT"
  timeframe:           string;   // "1h", "4h", "1d"
  timerange:           string;   // "20230101-20231231"
  stakeAmount:         number;   // USDT
  enableOptimization:  boolean;
  optParams?: {
    spaces?:  string[];
    trials?:  number;
  };
}

export interface FreqtradeJobResult {
  statusId:        string;
  strategyId:      string;
  kind:            'backtest' | 'optimization';
  status:          'pending' | 'running' | 'completed' | 'failed';
  metrics:         BacktestMetrics | null;
  bestParameters?: Record<string, unknown>;
  error?:          string;
  requestedAt:     number;
  completedAt?:    number;
  durationMs?:     number;
}

// ════════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Split a command string into cmd + args, honouring quoted segments.
 * e.g.  `python "server/tools/freqtrade_wrapper.py" --mode backtest`
 */
function parseCommandString(input: string): { cmd: string; args: string[] } {
  const re    = /(?:[^\s"']+|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')+/g;
  const parts = (input.match(re) ?? []).map((s) => s.replace(/^['"]|['"]$/g, ''));
  return { cmd: parts[0] ?? '', args: parts.slice(1) };
}

/**
 * Build arithmetically consistent mock metrics.
 * losingTrades  = totalTrades - profitableTrades (always)
 * winRatePercent is derived from those counts     (always)
 */
function buildMockMetrics(): BacktestMetrics {
  const total      = Math.floor(50 + Math.random() * 150);
  const profitable = Math.floor(total * (0.45 + Math.random() * 0.25)); // 45–70% win rate
  const losing     = total - profitable;
  const winRate    = parseFloat(((profitable / total) * 100).toFixed(2));

  return {
    totalTrades:         total,
    profitableTrades:    profitable,
    losingTrades:        losing,
    winRatePercent:      winRate,
    totalProfitUsd:      parseFloat((100  + Math.random() * 4900).toFixed(2)),
    totalProfitPercent:  parseFloat((5    + Math.random() * 50  ).toFixed(2)),
    avgProfitPercent:    parseFloat((0.5  + Math.random() * 3   ).toFixed(3)),
    sharpeRatio:         parseFloat((0.8  + Math.random() * 2   ).toFixed(3)),
    sortinoRatio:        parseFloat((1.0  + Math.random() * 3   ).toFixed(3)),
    maxDrawdownPercent:  parseFloat((5    + Math.random() * 15  ).toFixed(2)),
    buyAndHoldPercent:   parseFloat((15   + Math.random() * 35  ).toFixed(2)),
    exposureTimePercent: parseFloat((50   + Math.random() * 40  ).toFixed(2)),
    avgDurationMinutes:  Math.floor (60   + Math.random() * 240        ),
    recoveryFactor:      parseFloat((1.5  + Math.random() * 3   ).toFixed(3)),
    expectancy:          parseFloat((50   + Math.random() * 150 ).toFixed(2)),
  };
}

/**
 * Build mock metrics that are slightly better than baseline —
 * simulates what hyperopt optimisation would realistically improve.
 */
function buildOptimizedMockMetrics(): BacktestMetrics {
  const base = buildMockMetrics();
  return {
    ...base,
    sharpeRatio:        parseFloat((base.sharpeRatio        * (1.1 + Math.random() * 0.3)).toFixed(3)),
    sortinoRatio:       parseFloat((base.sortinoRatio       * (1.1 + Math.random() * 0.3)).toFixed(3)),
    winRatePercent:     parseFloat( Math.min(base.winRatePercent * 1.05, 85).toFixed(2)),
    maxDrawdownPercent: parseFloat((base.maxDrawdownPercent * (0.65 + Math.random() * 0.2)).toFixed(2)),
    recoveryFactor:     parseFloat((base.recoveryFactor     * (1.1 + Math.random() * 0.3)).toFixed(3)),
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// RESULT STORE  (in-memory, TTL-based eviction)
// ════════════════════════════════════════════════════════════════════════════════

const RESULT_TTL_MS = 10 * 60 * 1000; // evict completed/failed jobs after 10 min

class ResultStore {
  private store:  Map<string, FreqtradeJobResult>              = new Map();
  private timers: Map<string, ReturnType<typeof setTimeout>>   = new Map();

  set(id: string, result: FreqtradeJobResult): void {
    this.store.set(id, result);
  }

  get(id: string): FreqtradeJobResult | null {
    return this.store.get(id) ?? null;
  }

  /** Merge update into an existing result and schedule eviction. */
  finalize(id: string, update: Partial<FreqtradeJobResult>): void {
    const result = this.store.get(id);
    if (!result) return;
    Object.assign(result, update);
    this.scheduleEviction(id);
  }

  private scheduleEviction(id: string): void {
    const existing = this.timers.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.store.delete(id);
      this.timers.delete(id);
    }, RESULT_TTL_MS);
    this.timers.set(id, timer);
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// SUBPROCESS RUNNER  (shared by backtest + optimize paths)
// ════════════════════════════════════════════════════════════════════════════════

interface WrapperOutput {
  metrics: BacktestMetrics | null;
  raw:     Record<string, unknown>;
}

async function runWrapperSubprocess(
  wrapperCommand: string,
  payload:        unknown,
  timeoutMs:      number,
): Promise<WrapperOutput> {
  return new Promise((resolve, reject) => {
    const { cmd, args } = parseCommandString(wrapperCommand);
    const cp = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      cp.kill('SIGKILL');
      reject(new Error(`Wrapper subprocess timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    cp.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    cp.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    // Catches spawn failures (e.g. ENOENT — command not found)
    cp.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    cp.on('close', (code) => {
      clearTimeout(timer);

      if (code !== 0) {
        logger.error('[FreqtradeWrapper] Non-zero exit', { code, stderr: stderr.slice(0, 500) });
        return reject(new Error(`Wrapper exited ${code}: ${stderr.slice(0, 200)}`));
      }

      try {
        const raw     = JSON.parse(stdout.trim() || '{}') as Record<string, unknown>;
        const metrics = (raw.metrics ?? raw.backtestMetrics ?? null) as BacktestMetrics | null;
        resolve({ metrics, raw });
      } catch (err) {
        reject(new Error(`Failed to parse wrapper stdout: ${(err as Error).message}`));
      }
    });

    cp.stdin.write(JSON.stringify(payload));
    cp.stdin.end();
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// MAIN SERVICE CLASS
// ════════════════════════════════════════════════════════════════════════════════

class StrategyFreqtradeIntegration {
  private results = new ResultStore();

  // ── STRATEGY LIFECYCLE ────────────────────────────────────────────────────

  async createStrategyWithFreqtrade(input: {
    creatorId:               string;
    name:                    string;
    description?:            string;
    allocations:             Array<{ asset: string; weight: number }>;
    freqtradeStrategyCode?:  string;
    backtestRequest?:        FreqtradeBacktestRequest;
  }): Promise<string | null> {
    try {
      const strategyId = `strategy_${Date.now()}_${uuidv4()}`;

      const targetAllocations: Record<string, number> = {};
      for (const alloc of input.allocations) {
        targetAllocations[alloc.asset] = alloc.weight;
      }

      await db.insert(strategiesTable).values({
        id:                   strategyId,
        creatorId:            input.creatorId,
        name:                 input.name,
        description:          input.description,
        targetAllocations:    targetAllocations as any,
        rebalanceFrequency:   'weekly',
        riskLevel:            'medium',
        freqtradeStrategyId:  input.freqtradeStrategyCode ? `ft_${strategyId}` : undefined,
        isActive:             true,
        totalFollowers:       0,
        assetsUnderManagement:'0',
        ytdReturnPercent:     '0',
        createdAt:            new Date(),
        updatedAt:            new Date(),
      });

      for (const alloc of input.allocations) {
        await db.insert(strategyAllocationsTable).values({
          id:                    uuidv4(),
          strategyId,
          asset:                 alloc.asset,
          targetWeightPercent:   String(alloc.weight * 100),
          currentWeightPercent:  String(alloc.weight * 100),
          driftPercent:          '0',
          createdAt:             new Date(),
          updatedAt:             new Date(),
        });
      }

      // FIX: was `name` (undefined — global fn name). Should be `input.name`.
      logger.info(`✅ Created strategy: ${input.name} (${strategyId})`);

      if (input.backtestRequest) {
        await this.queueBacktest({
          ...input.backtestRequest,
          strategyId,
          strategyCode: input.freqtradeStrategyCode,
        });
      }

      return strategyId;
    } catch (error) {
      logger.error('[StrategyFreqtrade] Error creating strategy:', error);
      return null;
    }
  }

  /**
   * Deploy a strategy to Freqtrade.
   *
   * Real deployment = write .py file to Freqtrade's strategies dir + reload config.
   * Controlled by:
   *   FREQTRADE_STRATEGIES_DIR  – local or mounted path to user_data/strategies/
   *   FREQTRADE_API_URL         – Freqtrade REST base (for POST /api/v1/reload_config)
   *   FREQTRADE_API_TOKEN       – Bearer token
   *
   * Falls back to DB flag-only if env vars aren't set (safe in dev/test).
   */
  async deployStrategy(strategyId: string, userId: string, dryRun = false): Promise<boolean> {
    try {
      const rows = await db.select().from(strategiesTable).where(eq(strategiesTable.id, strategyId)).limit(1);
      const strategy = rows[0];

      if (!strategy) throw new Error('Strategy not found');

      if (!dryRun) {
        const strategiesDir = process.env.FREQTRADE_STRATEGIES_DIR;
        const apiUrl        = process.env.FREQTRADE_API_URL;
        const apiToken      = process.env.FREQTRADE_API_TOKEN;

        const strategyCode = (strategy as any).freqtradeCode as string | undefined;

        if (strategiesDir && strategyCode) {
          const { writeFile }    = await import('fs/promises');
          const { join }         = await import('path');
          const filename         = `${strategyId}.py`;

          await writeFile(join(strategiesDir, filename), strategyCode, 'utf-8');
          logger.info(`[StrategyFreqtrade] Wrote strategy file: ${filename}`);

          // Reload Freqtrade config so it picks up the new file
          if (apiUrl) {
            const { default: axios } = await import('axios');
            await axios.post(
              `${apiUrl}/api/v1/reload_config`,
              {},
              { headers: { Authorization: apiToken ? `Bearer ${apiToken}` : undefined } },
            );
            logger.info('[StrategyFreqtrade] Freqtrade reload_config sent');
          }
        } else {
          logger.warn(
            '[StrategyFreqtrade] FREQTRADE_STRATEGIES_DIR not set or strategy has no ' +
            'freqtradeCode — skipping file write. Set env var to enable real deployment.',
          );
        }

        await db
          .update(strategiesTable)
          .set({ isDeployed: true, deployedAt: new Date() } as any)
          .where(eq(strategiesTable.id, strategyId));
      }

      logger.info(`✅ Strategy ${strategyId} deployed (user=${userId}, dryRun=${dryRun})`);
      return true;
    } catch (error) {
      logger.error('[StrategyFreqtrade] Deploy failed:', error);
      throw error;
    }
  }

  async linkFreqtradeStrategy(strategyId: string, freqtradeStrategyId: string): Promise<boolean> {
    try {
      await db
        .update(strategiesTable)
        .set({ freqtradeStrategyId })
        .where(eq(strategiesTable.id, strategyId));

      logger.info(`✅ Linked Freqtrade strategy ${freqtradeStrategyId} → ${strategyId}`);
      return true;
    } catch (error) {
      logger.error('[StrategyFreqtrade] Error linking strategy:', error);
      return false;
    }
  }

  // ── BACKTESTING ───────────────────────────────────────────────────────────

  /**
   * Queue a backtest (fire-and-forget). Returns statusId for polling.
   * Use runBacktest() if you need the result inline.
   */
  async queueBacktest(request: FreqtradeBacktestRequest): Promise<string> {
    const statusId = `backtest_${request.strategyId}_${Date.now()}`;

    this.results.set(statusId, {
      statusId,
      strategyId: request.strategyId,
      kind:       'backtest',
      status:     'pending',
      metrics:    null,
      requestedAt: Date.now(),
    });

    logger.info(`[StrategyFreqtrade] Queued backtest ${statusId}`);

    // Fire and forget — void intentional
    void this.executeBacktest(statusId, request);

    return statusId;
  }

  /**
   * Run a backtest and await the BacktestMetrics result.
   *
   * If FREQTRADE_BACKTEST_WRAPPER is set, spawns the wrapper subprocess and
   * streams the JSON payload to stdin. Otherwise falls back to mock.
   */
  async runBacktest(
    request:   FreqtradeBacktestRequest,
    timeoutMs: number = 300_000,
  ): Promise<BacktestMetrics | null> {
    const wrapper = process.env.FREQTRADE_BACKTEST_WRAPPER;

    if (wrapper) {
      try {
        logger.info(`[StrategyFreqtrade] Backtest via wrapper: ${wrapper}`);
        const { metrics } = await runWrapperSubprocess(wrapper, request, timeoutMs);

        if (metrics) {
          await this.persistMetrics(request.strategyId, metrics);
        }

        return metrics;
      } catch (err) {
        logger.error(
          '[StrategyFreqtrade] Wrapper backtest failed:',
          err instanceof Error ? err.message : err,
        );
        throw err;
      }
    }

    // Mock fallback: queue → poll
    const statusId = await this.queueBacktest(request);
    return this.pollForCompletion(statusId, timeoutMs);
  }

  /** Internal backtest executor for the mock path. */
  private async executeBacktest(statusId: string, request: FreqtradeBacktestRequest): Promise<void> {
    const startedAt = Date.now();
    try {
      this.results.get(statusId)!.status = 'running';

      // Realistic mock delay: 2–8 s
      await new Promise((r) => setTimeout(r, 2_000 + Math.random() * 6_000));

      const metrics = buildMockMetrics();
      await this.persistMetrics(request.strategyId, metrics);

      this.results.finalize(statusId, {
        status:      'completed',
        metrics,
        completedAt: Date.now(),
        durationMs:  Date.now() - startedAt,
      });

      logger.info(
        `✅ Backtest (mock) complete — ${request.strategyId}: ` +
        `Sharpe=${metrics.sharpeRatio.toFixed(2)} WR=${metrics.winRatePercent}%`,
      );
    } catch (error) {
      this.results.finalize(statusId, {
        status:      'failed',
        error:       error instanceof Error ? error.message : 'Unknown error',
        completedAt: Date.now(),
        durationMs:  Date.now() - startedAt,
      });
      logger.error('[StrategyFreqtrade] Backtest execution failed:', error);
    }
  }

  // ── OPTIMISATION ──────────────────────────────────────────────────────────

  /**
   * Queue hyperopt (fire-and-forget). Returns statusId for polling.
   * Optimisation jobs are stored separately from backtests (kind: 'optimization').
   */
  async optimizeStrategyParameters(
    strategyId: string,
    options: { timeframe?: string; timerange?: string; trials?: number } = {},
  ): Promise<string> {
    const rows = await db.select().from(strategiesTable).where(eq(strategiesTable.id, strategyId));
    if (rows.length === 0) throw new Error(`Strategy not found: ${strategyId}`);

    const statusId = `optim_${strategyId}_${Date.now()}`;

    this.results.set(statusId, {
      statusId,
      strategyId,
      kind:       'optimization',
      status:     'pending',
      metrics:    null,
      requestedAt: Date.now(),
    });

    logger.info(`[StrategyFreqtrade] Queued optimization ${statusId}`);

    void this.executeOptimization(statusId, strategyId, options.trials ?? 50);

    return statusId;
  }

  /**
   * Run hyperopt and await the result.
   *
   * If FREQTRADE_OPTIMIZE_WRAPPER is set, spawns that subprocess.
   * Otherwise falls back to mock (uses a realistic fixed delay, NOT trials × 1 s).
   */
  async runOptimization(
    strategyConfig: { id?: string; strategyId?: string; [key: string]: unknown },
    options:        { trials?: number; spaces?: string[] } = {},
    timeoutMs:      number = 600_000,
  ): Promise<BacktestMetrics | null> {
    const wrapper = process.env.FREQTRADE_OPTIMIZE_WRAPPER;

    if (wrapper) {
      try {
        logger.info(`[StrategyFreqtrade] Optimization via wrapper: ${wrapper}`);
        const { metrics } = await runWrapperSubprocess(
          wrapper,
          { strategyConfig, options },
          timeoutMs,
        );
        return metrics;
      } catch (err) {
        logger.error(
          '[StrategyFreqtrade] Wrapper optimization failed:',
          err instanceof Error ? err.message : err,
        );
        throw err;
      }
    }

    const strategyId = strategyConfig.id ?? strategyConfig.strategyId;
    if (!strategyId) throw new Error('strategyConfig must have id or strategyId');

    const statusId = await this.optimizeStrategyParameters(String(strategyId), { trials: options.trials });
    return this.pollForCompletion(statusId, timeoutMs);
  }

  /**
   * Internal optimization executor for the mock path.
   *
   * FIX: Was `trials * 1000` ms — with default 50 trials that froze the event loop
   * for 50 seconds. Now uses a realistic fixed window (5–12 s) regardless of trial count.
   */
  private async executeOptimization(
    statusId:   string,
    strategyId: string,
    _trials:    number,        // kept for signature compatibility; not used in mock timing
  ): Promise<void> {
    const startedAt = Date.now();
    try {
      this.results.get(statusId)!.status = 'running';

      // Realistic fixed delay: 5–12 s
      await new Promise((r) => setTimeout(r, 5_000 + Math.random() * 7_000));

      const metrics = buildOptimizedMockMetrics();
      await this.persistMetrics(strategyId, metrics);

      this.results.finalize(statusId, {
        status:      'completed',
        metrics,
        completedAt: Date.now(),
        durationMs:  Date.now() - startedAt,
      });

      logger.info(
        `✅ Optimization (mock) complete — ${strategyId}: ` +
        `Sharpe=${metrics.sharpeRatio.toFixed(2)} DD=${metrics.maxDrawdownPercent.toFixed(1)}%`,
      );
    } catch (error) {
      this.results.finalize(statusId, {
        status:      'failed',
        error:       error instanceof Error ? error.message : 'Unknown error',
        completedAt: Date.now(),
        durationMs:  Date.now() - startedAt,
      });
      logger.error('[StrategyFreqtrade] Optimization execution failed:', error);
    }
  }

  // ── QUERIES ───────────────────────────────────────────────────────────────

  getJobStatus(statusId: string): FreqtradeJobResult | null {
    return this.results.get(statusId);
  }

  /** @deprecated Use getJobStatus() — supports both backtest and optimization jobs. */
  getBacktestStatus(statusId: string): FreqtradeJobResult | null {
    return this.getJobStatus(statusId);
  }

  async getStrategyBacktestResults(strategyId: string): Promise<BacktestMetrics | null> {
    try {
      const rows = await db
        .select()
        .from(strategiesTable)
        .where(eq(strategiesTable.id, strategyId));

      return rows.length > 0 ? (rows[0].backtestResults as BacktestMetrics) : null;
    } catch (error) {
      logger.error('[StrategyFreqtrade] Error fetching backtest results:', error);
      return null;
    }
  }

  /**
   * Fetch strategies that have completed backtest results, sorted by metric.
   *
   * FIX: was `eq(strategiesTable.backtestResults, true)` — comparing JSONB to
   * boolean always returns nothing. Now uses isNotNull().
   *
   * NOTE: Sorting is done in-process for now. For large datasets, add an
   * indexed computed column (sharpe_ratio NUMERIC) and push ORDER BY into the query.
   */
  async getStrategiesByPerformance(
    metric: 'sharpe' | 'return' | 'drawdown' = 'sharpe',
    limit   = 20,
  ): Promise<any[]> {
    try {
      // Over-fetch so in-process sort produces correct top-N
      const strategies = await db
        .select()
        .from(strategiesTable)
        .where(isNotNull(strategiesTable.backtestResults))
        .limit(limit * 3);

      return strategies
        .sort((a, b) => {
          const ma = a.backtestResults as Partial<BacktestMetrics> | null;
          const mb = b.backtestResults as Partial<BacktestMetrics> | null;
          if (!ma || !mb) return 0;

          switch (metric) {
            case 'sharpe':   return (mb.sharpeRatio        ?? 0) - (ma.sharpeRatio        ?? 0);
            case 'return':   return (mb.totalProfitPercent ?? 0) - (ma.totalProfitPercent ?? 0);
            case 'drawdown': return (ma.maxDrawdownPercent ?? 0) - (mb.maxDrawdownPercent ?? 0); // lower is better
            default:         return 0;
          }
        })
        .slice(0, limit);
    } catch (error) {
      logger.error('[StrategyFreqtrade] Error fetching strategies by performance:', error);
      return [];
    }
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────────────────────

  private async persistMetrics(strategyId: string, metrics: BacktestMetrics): Promise<void> {
    await db
      .update(strategiesTable)
      .set({
        backtestResults:    metrics as any,
        lastBacktestedAt:   new Date(),
        sharpeRatio:        String(metrics.sharpeRatio),
        maxDrawdownPercent: String(metrics.maxDrawdownPercent),
        ytdReturnPercent:   String(metrics.totalProfitPercent),
      })
      .where(eq(strategiesTable.id, strategyId));
  }

  /**
   * Poll the in-memory ResultStore until a job reaches a terminal state
   * or the deadline passes.
   */
  private async pollForCompletion(statusId: string, timeoutMs: number): Promise<BacktestMetrics | null> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const job = this.results.get(statusId);
      if (job?.status === 'completed') return job.metrics;
      if (job?.status === 'failed')    throw new Error(job.error ?? 'Job failed');
      await new Promise((r) => setTimeout(r, 1_000));
    }

    throw new Error(`Job ${statusId} timed out after ${timeoutMs}ms`);
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════════════════

export { StrategyFreqtradeIntegration };
export const strategyFreqtradeIntegration = new StrategyFreqtradeIntegration();