/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FREQTRADE REST API CLIENT  —  real endpoints only
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Covers the actual Freqtrade REST API v1 surface.
 * Docs: https://www.freqtrade.io/en/stable/rest-api/
 *
 *  ✅  Bot control        POST /api/v1/start|stop|stopbuy|reload_config
 *  ✅  Live monitoring    GET  /api/v1/status|count|balance|profit|performance|daily
 *  ✅  Open trades        GET  /api/v1/status   (this returns open trades, NOT bot state)
 *  ✅  Force exit         POST /api/v1/forceexit
 *  ✅  Strategy listing   GET  /api/v1/strategies
 *  ✅  Strategy source    GET  /api/v1/strategy/{name}
 *  ✅  Strategy deploy    fs.writeFile → POST /api/v1/reload_config
 *  ✅  Strategy validate  local Python subprocess (no REST endpoint exists)
 *  ✅  Backtesting        POST|GET|DELETE /api/v1/backtest
 *  ✅  Retry logic        exponential backoff on all REST calls
 *
 *  ❌  Hyperopt           CLI-only — use freqtrade_wrapper.py subprocess
 *  ❌  Remote deploy      write file via shared volume / SCP; then call reloadConfig()
 *
 * Environment variables
 * ──────────────────────
 *   FREQTRADE_API_URL          Base URL of running Freqtrade instance  (default: http://localhost:8080)
 *   FREQTRADE_API_TOKEN        JWT Bearer token set in Freqtrade's api_server config
 *   FREQTRADE_STRATEGIES_DIR   Local path to user_data/strategies/ for file-based deploy
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { spawn }                             from 'child_process';
import { Logger }                            from '../utils/logger';

const logger = Logger.getLogger();

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

export interface BacktestMetrics {
  totalTrades:         number;
  profitableTrades:    number;
  losingTrades:        number;
  winRatePercent:      number;   // 0-100
  totalProfitUsd:      number;   // stake currency absolute
  totalProfitPercent:  number;   // 0-100
  avgProfitPercent:    number;   // 0-100
  sharpeRatio:         number;
  sortinoRatio:        number;
  maxDrawdownPercent:  number;   // 0-100
  buyAndHoldPercent:   number;   // 0-100
  exposureTimePercent: number;   // 0-100
  avgDurationMinutes:  number;
  recoveryFactor:      number;
  expectancy:          number;
}

export interface FreqtradeBacktestRequest {
  strategyName: string;   // Python class name of the IStrategy to run
  timerange:    string;   // "20230101-20231231"
  timeframe?:   string;   // override strategy default, e.g. "1h"
  stakeAmount?: number;   // override config stake_amount
}

/** Shape returned by GET /api/v1/status (open trade list) */
export interface FreqtradeOpenTrade {
  trade_id:              number;
  pair:                  string;
  is_open:               boolean;
  open_rate:             number;
  current_rate:          number;
  profit_ratio:          number;
  profit_pct:            number;
  profit_abs:            number;
  stake_amount:          number;
  amount:                number;
  open_date:             string;
  duration_in_minutes:   number;
  enter_tag:             string;
  stop_loss_abs:         number;
  strategy:              string;
}

/** Aggregated bot status — built from multiple real endpoints */
export interface FreqtradeBotStatus {
  isConnected:       boolean;
  openTradeCount:    number;
  maxTradeCount:     number;
  totalStake:        number;
  totalBalance:      number;
  stakeCurrency:     string;
  closedProfit:      number;    // profit_closed_coin from /profit
  totalProfit:       number;    // profit_all_coin from /profit
  winningTrades:     number;
  losingTrades:      number;
  tradingVolume:     number;
}

export interface BacktestPollResult {
  status:    'running' | 'finished' | 'error' | 'not_started';
  progress:  number;          // 0-1
  statusMsg: string;
  metrics?:  BacktestMetrics; // present when status === 'finished'
}

// ════════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Parse Freqtrade's avg_duration into decimal minutes.
 * Freqtrade backtest results use a "H:MM:SS" string, e.g. "1:23:45".
 * Some live-trade endpoints return seconds as a number.
 */
function parseDurationToMinutes(raw: unknown): number {
  if (typeof raw === 'number') return raw / 60;
  if (typeof raw === 'string') {
    const parts = raw.split(':').map(Number);
    if (parts.length === 3 && parts.every(Number.isFinite)) {
      return parts[0] * 60 + parts[1] + parts[2] / 60;
    }
  }
  return 0;
}

/**
 * Map a single strategy entry from Freqtrade's backtest_result into BacktestMetrics.
 *
 * Freqtrade field reference (all ratios are 0-1 unless noted):
 *   total_trades        int
 *   wins / losses       int
 *   win_rate            float 0-1   → ×100 = %
 *   profit_total        float 0-1   → ×100 = %
 *   profit_total_abs    float       absolute stake-currency profit
 *   avg_profit          float 0-1   → ×100 = %
 *   sharpe / sortino    float
 *   max_drawdown        float 0-1   → ×100 = %
 *   buy_and_hold_returns float 0-1  → ×100 = %  (newer versions)
 *   exposure_time       float 0-1   → ×100 = %
 *   avg_duration        string "H:MM:SS"
 *   recovery_factor     float
 *   expectancy          float
 */
function mapBacktestResult(r: Record<string, any>): BacktestMetrics {
  return {
    totalTrades:         r.total_trades            ?? 0,
    profitableTrades:    r.wins                    ?? 0,
    losingTrades:        r.losses                  ?? 0,
    winRatePercent:      (r.win_rate               ?? 0) * 100,
    totalProfitUsd:      r.profit_total_abs        ?? 0,
    totalProfitPercent:  (r.profit_total           ?? 0) * 100,
    avgProfitPercent:    (r.avg_profit             ?? 0) * 100,
    sharpeRatio:         r.sharpe                  ?? 0,
    sortinoRatio:        r.sortino                 ?? 0,
    maxDrawdownPercent:  (r.max_drawdown           ?? 0) * 100,
    // Field name changed across Freqtrade versions — handle both
    buyAndHoldPercent:   (r.buy_and_hold_returns   ?? r.buy_hold_abs ?? 0) * 100,
    exposureTimePercent: (r.exposure_time          ?? 0) * 100,
    avgDurationMinutes:  parseDurationToMinutes(r.avg_duration),
    recoveryFactor:      r.recovery_factor         ?? 0,
    expectancy:          r.expectancy              ?? 0,
  };
}

/**
 * Extract the first strategy result from Freqtrade's backtest_result object.
 * The shape is:  { strategy: { StrategyClassName: { ...metrics } } }
 */
function extractStrategyResult(backtestResult: Record<string, any>): Record<string, any> | null {
  const strategyMap = backtestResult?.strategy ?? backtestResult;
  const firstKey    = Object.keys(strategyMap ?? {})[0];
  return firstKey ? strategyMap[firstKey] : null;
}

/**
 * Exponential backoff retry wrapper.
 * Retries on network errors and 5xx responses; throws immediately on 4xx.
 */
async function withRetry<T>(
  fn:           () => Promise<T>,
  maxAttempts:  number = 3,
  baseDelayMs:  number = 600,
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = (err as AxiosError)?.response?.status ?? 0;

      // Don't retry client errors (4xx) — they won't resolve with retries
      if (status >= 400 && status < 500) throw err;

      lastErr = err;

      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        logger.warn(`[Freqtrade] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastErr;
}

// ════════════════════════════════════════════════════════════════════════════════
// CLIENT
// ════════════════════════════════════════════════════════════════════════════════

class ProductionFreqtradeRestClient {
  private api: AxiosInstance;

  constructor() {
    const baseUrl  = process.env.FREQTRADE_API_URL   || 'http://localhost:8080';
    const apiToken = process.env.FREQTRADE_API_TOKEN || '';

    this.api = axios.create({
      baseURL: baseUrl,
      timeout: 30_000,
      headers: {
        'Content-Type':  'application/json',
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      },
    });

    logger.info(`[Freqtrade] REST client initialised → ${baseUrl}`);
  }

  // ── CONNECTIVITY ────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/ping
   * Returns { "status": "pong" } — lightest possible health check.
   */
  async ping(): Promise<boolean> {
    try {
      const res = await withRetry(() => this.api.get('/api/v1/ping'));
      return res.data?.status === 'pong';
    } catch {
      return false;
    }
  }

  /** Alias kept for compatibility — wraps ping(). */
  async verifyConnection(): Promise<boolean> {
    const ok = await this.ping();
    if (ok) logger.info('[Freqtrade] ✅ Connected');
    else     logger.error('[Freqtrade] ❌ Unreachable');
    return ok;
  }

  // ── BOT CONTROL ─────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/start
   * Starts the bot trading loop.
   * NOTE: strategy is determined by the bot's config.json, not this call.
   *       To switch strategies, update config.json and call reloadConfig().
   * Returns: { "status": "starting trader" | "already running" }
   */
  async startBot(): Promise<string> {
    const res = await withRetry(() => this.api.post('/api/v1/start'));
    const msg = res.data?.status ?? 'unknown';
    logger.info(`[Freqtrade] start → ${msg}`);
    return msg;
  }

  /**
   * POST /api/v1/stop
   * Stops the bot trading loop. Open trades remain open until manually closed.
   * Returns: { "status": "stopping trader" | "already stopped" }
   */
  async stopBot(): Promise<string> {
    const res = await withRetry(() => this.api.post('/api/v1/stop'));
    const msg = res.data?.status ?? 'unknown';
    logger.info(`[Freqtrade] stop → ${msg}`);
    return msg;
  }

  /**
   * POST /api/v1/stopbuy
   * Stops opening new trades but lets existing trades close normally.
   * Useful for graceful wind-down without force-closing positions.
   */
  async stopBuying(): Promise<string> {
    const res = await withRetry(() => this.api.post('/api/v1/stopbuy'));
    const msg = res.data?.status ?? 'unknown';
    logger.info(`[Freqtrade] stopbuy → ${msg}`);
    return msg;
  }

  /**
   * POST /api/v1/reload_config
   * Makes Freqtrade re-read its config.json without restarting the process.
   * Called automatically after deployStrategy().
   */
  async reloadConfig(): Promise<void> {
    await withRetry(() => this.api.post('/api/v1/reload_config'));
    logger.info('[Freqtrade] Config reloaded');
  }

  // ── LIVE MONITORING ─────────────────────────────────────────────────────────

  /**
   * Aggregate status from three real endpoints:
   *   GET /api/v1/count    → open trade count + max trades + total stake
   *   GET /api/v1/balance  → total wallet balance + stake currency
   *   GET /api/v1/profit   → cumulative P&L + win/loss counts
   *
   * Uses Promise.allSettled so a single endpoint failure doesn't kill the whole call.
   */
  async getBotStatus(): Promise<FreqtradeBotStatus> {
    const [countRes, balanceRes, profitRes] = await Promise.allSettled([
      withRetry(() => this.api.get('/api/v1/count')),
      withRetry(() => this.api.get('/api/v1/balance')),
      withRetry(() => this.api.get('/api/v1/profit')),
    ]);

    const count   = countRes.status   === 'fulfilled' ? countRes.value.data   : null;
    const balance = balanceRes.status === 'fulfilled' ? balanceRes.value.data : null;
    const profit  = profitRes.status  === 'fulfilled' ? profitRes.value.data  : null;

    return {
      isConnected:    true,
      openTradeCount: count?.current          ?? 0,
      maxTradeCount:  count?.max              ?? 0,
      totalStake:     count?.total_stake      ?? 0,
      totalBalance:   balance?.total          ?? 0,
      stakeCurrency:  balance?.symbol         ?? 'USDT',
      closedProfit:   profit?.profit_closed_coin ?? 0,
      totalProfit:    profit?.profit_all_coin ?? 0,
      winningTrades:  profit?.winning_trades  ?? 0,
      losingTrades:   profit?.losing_trades   ?? 0,
      tradingVolume:  profit?.trading_volume  ?? 0,
    };
  }

  /**
   * GET /api/v1/status
   * Returns the list of currently OPEN trades.
   * This is NOT the bot's operational state — it's open position data.
   */
  async getOpenTrades(): Promise<FreqtradeOpenTrade[]> {
    const res = await withRetry(() => this.api.get('/api/v1/status'));
    return res.data ?? [];
  }

  /**
   * GET /api/v1/profit
   * Cumulative P&L summary across all closed trades.
   */
  async getProfit(): Promise<Record<string, any>> {
    const res = await withRetry(() => this.api.get('/api/v1/profit'));
    return res.data;
  }

  /**
   * GET /api/v1/balance
   * Wallet balance per currency.
   */
  async getBalance(): Promise<Record<string, any>> {
    const res = await withRetry(() => this.api.get('/api/v1/balance'));
    return res.data;
  }

  /**
   * GET /api/v1/performance
   * Profit breakdown per trading pair — useful for pair ranking.
   */
  async getPerformance(): Promise<Array<{ pair: string; profit: number; count: number }>> {
    const res = await withRetry(() => this.api.get('/api/v1/performance'));
    return res.data ?? [];
  }

  /**
   * GET /api/v1/daily?timedelta={days}
   * Daily P&L for the last N days (default 7).
   */
  async getDailyProfit(days = 7): Promise<Record<string, any>> {
    const res = await withRetry(() => this.api.get('/api/v1/daily', { params: { timedelta: days } }));
    return res.data;
  }

  /**
   * GET /api/v1/stats
   * Trade duration breakdown and exit reason distribution.
   * Useful for diagnosing strategy exit behaviour.
   */
  async getStats(): Promise<Record<string, any>> {
    const res = await withRetry(() => this.api.get('/api/v1/stats'));
    return res.data;
  }

  /**
   * GET /api/v1/trades?limit={limit}&offset={offset}
   * Paginated list of closed trades.
   */
  async getTrades(limit = 50, offset = 0): Promise<Record<string, any>> {
    const res = await withRetry(() =>
      this.api.get('/api/v1/trades', { params: { limit, offset } })
    );
    return res.data;
  }

  /**
   * POST /api/v1/forceexit
   * Immediately close an open trade at market price.
   * Use with caution in live trading.
   */
  async forceExit(tradeId: number, orderType: 'market' | 'limit' = 'market'): Promise<Record<string, any>> {
    const res = await withRetry(() =>
      this.api.post('/api/v1/forceexit', { tradeid: String(tradeId), ordertype: orderType })
    );
    logger.info(`[Freqtrade] Force exit trade ${tradeId} → ${res.data?.result ?? 'sent'}`);
    return res.data;
  }

  // ── WHITELIST / BLACKLIST ────────────────────────────────────────────────────

  /**
   * GET /api/v1/whitelist
   * Returns the current trading pair whitelist.
   */
  async getWhitelist(): Promise<string[]> {
    const res = await withRetry(() => this.api.get('/api/v1/whitelist'));
    return res.data?.whitelist ?? [];
  }

  /**
   * GET /api/v1/blacklist
   * Returns the current pair blacklist.
   */
  async getBlacklist(): Promise<string[]> {
    const res = await withRetry(() => this.api.get('/api/v1/blacklist'));
    return res.data?.blacklist ?? [];
  }

  // ── STRATEGY MANAGEMENT ──────────────────────────────────────────────────────

  /**
   * GET /api/v1/strategies
   * Lists strategy class names Freqtrade can see in its strategies directory.
   * Returns string[] of class names (not filenames).
   */
  async getDeployedStrategies(): Promise<string[]> {
    const res = await withRetry(() => this.api.get('/api/v1/strategies'));
    // Freqtrade returns { strategies: ["StrategyA", "StrategyB"] }
    return res.data?.strategies ?? [];
  }

  /**
   * GET /api/v1/strategy/{strategy_name}
   * Returns the Python source code of a deployed strategy.
   * Useful for inspecting what's actually running.
   */
  async getStrategySource(strategyName: string): Promise<{ name: string; code: string }> {
    const res = await withRetry(() => this.api.get(`/api/v1/strategy/${strategyName}`));
    return {
      name: res.data?.strategy ?? strategyName,
      code: res.data?.code     ?? '',
    };
  }

  /**
   * Deploy a strategy by writing it to Freqtrade's strategies directory,
   * then triggering a config reload so Freqtrade picks it up immediately.
   *
   * Requires FREQTRADE_STRATEGIES_DIR to point at the same directory the
   * Freqtrade process reads from (local path or shared Docker volume).
   *
   * For remote Freqtrade instances: SCP the file first, then call reloadConfig().
   */
  async deployStrategy(
    strategyCode: string,
    strategyName: string,
  ): Promise<{ strategyId: string; status: string }> {
    // 1. Validate Python syntax locally — no REST endpoint for this
    const syntaxResult = await this.validateStrategyCodeLocally(strategyCode);
    if (!syntaxResult.valid) {
      throw new Error(`Strategy syntax error: ${syntaxResult.error}`);
    }

    // 2. Validate required Freqtrade interface methods
    const ifaceResult = this.validateFreqtradeInterface(strategyCode);
    if (!ifaceResult.valid) {
      throw new Error(
        `Strategy is missing required methods: ${ifaceResult.missing.join(', ')}. ` +
        `IStrategy requires populate_indicators, populate_entry_trend, populate_exit_trend.`
      );
    }

    // 3. Write file to strategies directory
    const strategiesDir = process.env.FREQTRADE_STRATEGIES_DIR;
    if (!strategiesDir) {
      throw new Error(
        'FREQTRADE_STRATEGIES_DIR is not set. ' +
        'Point it at the Freqtrade user_data/strategies/ directory.'
      );
    }

    const { writeFile } = await import('fs/promises');
    const { join }      = await import('path');
    const filename      = `${strategyName}.py`;

    await writeFile(join(strategiesDir, filename), strategyCode, 'utf-8');
    logger.info(`[Freqtrade] Wrote strategy file: ${filename}`);

    // 4. Tell Freqtrade to reload — picks up the new file without restart
    await this.reloadConfig();

    return { strategyId: strategyName, status: 'deployed' };
  }

  /**
   * Validate Python syntax via local subprocess.
   * Falls back to valid:true if Python3 is not available on the host.
   *
   * There is no Freqtrade REST endpoint for syntax validation.
   */
  private validateStrategyCodeLocally(
    code: string,
  ): Promise<{ valid: boolean; error?: string }> {
    return new Promise((resolve) => {
      // Use Python's compile() — catches SyntaxError without executing
      const script = [
        'import sys',
        'try:',
        '    compile(sys.stdin.read(), "<strategy>", "exec")',
        '    sys.exit(0)',
        'except SyntaxError as e:',
        '    print(f"line {e.lineno}: {e.msg}", file=sys.stderr)',
        '    sys.exit(1)',
      ].join('\n');

      const cp = spawn('python3', ['-c', script], { stdio: ['pipe', 'pipe', 'pipe'] });

      let stderr = '';
      cp.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

      cp.on('error', () => {
        // python3 not on host PATH — skip validation, warn and continue
        logger.warn('[Freqtrade] python3 not found locally; skipping syntax validation');
        resolve({ valid: true });
      });

      cp.on('close', (exitCode) => {
        if (exitCode === 0) resolve({ valid: true });
        else                resolve({ valid: false, error: stderr.trim() });
      });

      cp.stdin.write(code);
      cp.stdin.end();
    });
  }

  /**
   * Check that the strategy source contains the three required IStrategy methods.
   * Simple string scan — sufficient for catching missing scaffolding.
   */
  private validateFreqtradeInterface(code: string): { valid: boolean; missing: string[] } {
    const required = [
      'populate_indicators',
      'populate_entry_trend',
      'populate_exit_trend',
    ];
    const missing = required.filter((m) => !code.includes(`def ${m}`));
    return { valid: missing.length === 0, missing };
  }

  // ── BACKTESTING ──────────────────────────────────────────────────────────────
  //
  // Freqtrade's backtest REST API (added in ~2021.9):
  //   POST   /api/v1/backtest  → start a backtest, returns immediately with status
  //   GET    /api/v1/backtest  → poll for completion / get results
  //   DELETE /api/v1/backtest  → cancel a running backtest
  //
  // Only ONE backtest can run at a time. Starting a new one while one is
  // running returns a 502. Call cancelBacktest() first if needed.
  //
  // The result is nested under:
  //   response.backtest_result.strategy.<StrategyClassName>

  /**
   * POST /api/v1/backtest
   * Starts a backtest on a named strategy. Returns immediately — poll with
   * pollBacktest() until status === 'finished'.
   */
  async startBacktest(request: FreqtradeBacktestRequest): Promise<void> {
    const body: Record<string, any> = {
      strategy:  request.strategyName,
      timerange: request.timerange,
    };
    if (request.timeframe)   body.timeframe   = request.timeframe;
    if (request.stakeAmount) body.stake_amount = request.stakeAmount;

    await withRetry(() => this.api.post('/api/v1/backtest', body));
    logger.info(`[Freqtrade] Backtest started: ${request.strategyName} (${request.timerange})`);
  }

  /**
   * GET /api/v1/backtest
   * Poll the running or last-completed backtest.
   *
   * Freqtrade response shape:
   *   { status, running, progress, status_msg, backtest_result? }
   *
   * status values: "running" | "finished" | "error" | "not_started"
   */
  async pollBacktest(): Promise<BacktestPollResult> {
    const res  = await withRetry(() => this.api.get('/api/v1/backtest'));
    const data = res.data;

    const base: BacktestPollResult = {
      status:    data.status    ?? 'not_started',
      progress:  data.progress  ?? 0,
      statusMsg: data.status_msg ?? '',
    };

    if (data.status === 'finished' && data.backtest_result) {
      const stratResult = extractStrategyResult(data.backtest_result);
      if (stratResult) {
        base.metrics = mapBacktestResult(stratResult);
      }
    }

    return base;
  }

  /**
   * DELETE /api/v1/backtest
   * Cancel a running backtest.
   */
  async cancelBacktest(): Promise<void> {
    await this.api.delete('/api/v1/backtest');
    logger.info('[Freqtrade] Backtest cancelled');
  }

  /**
   * Convenience: start a backtest and wait for completion with polling.
   *
   * @param request    backtest parameters
   * @param timeoutMs  give up after this many ms (default 10 min)
   * @param pollMs     how often to poll (default 3 s)
   */
  async runBacktestAndWait(
    request:   FreqtradeBacktestRequest,
    timeoutMs: number = 600_000,
    pollMs:    number = 3_000,
  ): Promise<BacktestMetrics> {
    // Cancel anything already running so we don't get a 502
    const current = await this.pollBacktest();
    if (current.status === 'running') {
      logger.warn('[Freqtrade] Cancelling in-progress backtest before starting new one');
      await this.cancelBacktest();
      await new Promise((r) => setTimeout(r, 1_000));
    }

    await this.startBacktest(request);

    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, pollMs));

      const result = await this.pollBacktest();

      logger.debug(
        `[Freqtrade] Backtest progress: ${(result.progress * 100).toFixed(1)}% — ${result.statusMsg}`
      );

      if (result.status === 'finished') {
        if (!result.metrics) throw new Error('Backtest finished but metrics missing from response');
        logger.info(
          `[Freqtrade] ✅ Backtest complete: ` +
          `${result.metrics.totalTrades} trades | ` +
          `WR ${result.metrics.winRatePercent.toFixed(1)}% | ` +
          `Sharpe ${result.metrics.sharpeRatio.toFixed(2)}`
        );
        return result.metrics;
      }

      if (result.status === 'error') {
        throw new Error(`Freqtrade backtest error: ${result.statusMsg}`);
      }
    }

    await this.cancelBacktest();
    throw new Error(`Backtest timed out after ${timeoutMs}ms`);
  }

  // ── HYPEROPT NOTE ────────────────────────────────────────────────────────────
  //
  // Freqtrade hyperopt has NO REST API.  It is a CLI-only operation:
  //
  //   freqtrade hyperopt \
  //     --strategy MyStrategy \
  //     --hyperopt-loss SharpeHyperOptLoss \
  //     --spaces buy sell roi stoploss \
  //     --epochs 100 \
  //     --timerange 20230101-20231231
  //
  // Results are written to user_data/hyperopt_results/.
  // Use freqtrade_wrapper.py (FREQTRADE_OPTIMIZE_WRAPPER) to invoke hyperopt
  // as a subprocess and parse the result file.
}

// ════════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════════════════

export { ProductionFreqtradeRestClient };
export const productionFreqtradeIntegration = new ProductionFreqtradeRestClient();