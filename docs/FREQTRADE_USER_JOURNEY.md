# Freqtrade Strategy User Journey

This document describes the current user journey from strategy creation through backtest and deployment, as implemented in the repository today.

> Current implementation notes:
> - The YUKI strategy flow is primarily mounted under `POST /api/v1/yuki/strategies` and related `/api/v1/yuki/strategies/*` routes.
> - The freqtrade-specific service logic is implemented in `server/api/freqtrade.ts` and `server/services/strategyFreqtradeIntegration.ts`.
> - `backtest_jobs` is used as the persistent queue/job state table.

## 1. Strategy types and what counts as a strategy

### 1.1 Freqtrade Python strategy

A Freqtrade strategy is a Python class implementing the Freqtrade `IStrategy` interface, with required methods such as:
- `populate_indicators`
- `populate_entry_trend`
- `populate_exit_trend`

These strategies are stored in the database as raw Python source in `strategies.freqtrade_code` and are also written to disk under the configured `FREQTRADE_STRATEGIES_DIR`.

### 1.2 UI builder / native strategy

The UI builder path creates strategies via the dashboard service and uses strategy metadata, allocation rules, and compiled payloads rather than Freqtrade Python code.

In this repo, those strategies are handled by:
- `server/routes/v1/strategies/core.ts`
- `server/services/strategyDashboardService.ts`

They are not executed through the Freqtrade engine unless the strategy explicitly includes `freqtradeStrategyCode`.

### 1.3 What constitutes a strategy?

A strategy in this system typically includes:
- metadata: `name`, `description`, `tags`, `riskLevel`
- allocations: asset weights / target allocation set
- backtesting config: `pair`, `timeframe`, `timerange`, `stakeAmount`
- strategy source: either Freqtrade Python code or dashboard/compiled payload
- optionally: `freqtradeStrategyName`, `freqtradeStrategyId`, `freqtradeCode`

## 2. Core services involved

### 2.1 `server/services/strategyFreqtradeIntegration.ts`

This is the main Freqtrade integration service. It handles:
- creating Freqtrade-compatible strategy records
- writing Python strategy files to disk
- queuing backtest jobs in `backtest_jobs`
- running Freqtrade wrapper subprocesses
- persisting metrics and job state
- deploying strategies to the Freqtrade instance

### 2.2 `server/services/telegram.ts`

This helper sends Telegram notifications when backtests or optimizations complete.

### 2.3 `server/db/schema/strategies.ts`

Defines the schema for:
- `strategies`
- `strategy_allocations`
- `strategy_rebalances`
- `backtest_jobs`

The `backtest_jobs` table now tracks Freqtrade job lifecycle state.

### 2.4 `server/routes/v1/yuki/strategies.ts`

This route file exposes the user-facing YUKI strategy endpoints, including the queueing of backtest jobs and job polling.

### 2.5 `server/routes/v1/strategies/core.ts` and `execution.ts`

These consolidated routes also support strategy creation, backtest queueing, status polling, and deployment.

## 3. The user journey

### 3.1 Create the strategy

The user can create a strategy in two main ways:

#### A. Upload a Freqtrade Python strategy

1. Client submits a request with:
   - `name`
   - `strategyCode` (Python source)
   - `strategyName` (Python class name)
   - `pair`
   - `timeframe`
   - `allocations`
   - `backtestOnCreate`
   - `timerange`, `stakeAmount`, `startingCapital`

2. The route validates the payload using Zod.
3. It verifies the Python strategy implements required methods.
4. The repo creates a new `strategies` row and stores the Python source in `freqtrade_code`.
5. If `backtestOnCreate` is set, a backtest job is queued immediately.

Code paths involved:
- `server/api/freqtrade.ts` upload logic
- `strategyFreqtradeIntegration.createStrategyWithFreqtrade()`
- `backtest_jobs` insert

#### B. Create via the UI builder / native strategy route

1. Client submits a strategy definition via the dashboard route.
2. The system stores allocations and metadata in the strategy dashboard.
3. If the payload includes `freqtradeStrategyCode`, it uses the specialized Freqtrade handler.
4. If it is a pure dashboard strategy, it does not use the Freqtrade engine.

Current gap:
- Native TypeScript or UI-built strategies are not automatically backtested by Freqtrade unless they include Python code.
- That means the system currently has two strategy paths: Freqtrade Python strategies and dashboard strategies.

## 4. Queueing a backtest

### 4.1 Endpoint

The current async backtest entry point is:
- `POST /api/v1/yuki/strategies/:strategyId/backtest`

This route is protected by authentication and advanced-mode guard.

### 4.2 What happens

1. The route confirms the authenticated user owns the strategy.
2. It inserts a row into `backtest_jobs` with:
   - `status = pending`
   - `kind = backtest`
   - `requested_at`
3. It publishes a queue message to Redis via `redis.publish('backtest_jobs:queue', ...)`.
4. It returns a `202 Accepted`-style response with:
   - `jobId`
   - a status endpoint for polling

### 4.3 Why `backtest_jobs`?

The system uses `backtest_jobs` to track job lifecycle, keep user visibility, and avoid inline blocking calls.

## 5. Where candles and prices come from

### 5.1 Freqtrade backtest data source

The actual candle and price data for Freqtrade backtests are fetched by the Freqtrade engine itself.

That means:
- Freqtrade downloads OHLCV from the configured exchange connector (e.g. Binance, Kraken)
- Freqtrade manages its own cache and historical data
- The internal YUKI pricing APIs are not used for the backtest candle feed

### 5.2 UI/market pricing vs backtest pricing

- The YUKI market services may provide live prices and exchange quotes for the frontend.
- But the Freqtrade backtest uses the Python/Freqtrade pipeline, not the live internal price service.

## 6. Job processing and worker flow

### 6.1 Worker / execution

The work is handled by the Freqtrade integration service and/or a job worker:
- `server/services/strategyFreqtradeIntegration.ts`
- `server/workers/strategyJobWorker.ts`

### 6.2 What the worker does

1. Marks the `backtest_jobs` record as `running`.
2. Writes the Python file to `FREQTRADE_STRATEGIES_DIR`.
3. Executes the configured wrapper command:
   - `FREQTRADE_BACKTEST_WRAPPER`
   - or `FREQTRADE_OPTIMIZE_WRAPPER` for hyperopt.
4. The wrapper runs Freqtrade CLI and reads the JSON output.
5. The repo parses metrics and converts them into the internal metrics shape.
6. The worker updates `backtest_jobs` to `completed` or `failed`.

## 7. Results and where the user sees them

### 7.1 Polling job status

Users can poll the job status by hitting:
- `GET /api/v1/yuki/strategies/jobs/:jobId`

This returns job metadata, status, metrics, best parameters, and timestamps.

### 7.2 Completed results

Once complete, the user can also view persisted backtest performance via:
- `GET /v1/strategies/:strategyId/backtest`
- `GET /v1/strategies/:strategyId/performance`

The stored results are persisted to `strategies.backtestResults` and `strategies.lastBacktestedAt`.

### 7.3 Telegram notifications

If the user has linked Telegram, the completion notification path is:
- `server/services/telegram.ts`
- `notifyBacktestComplete()`

The message is sent after backtest completion and includes summary metrics.

## 8. Deploying a strategy

### 8.1 Deploy endpoint

The deploy route is:
- `POST /v1/strategies/:strategyId/deploy`

This route also requires authentication and ownership.

### 8.2 What deploy does

1. Reads the strategy's `freqtradeCode` and `freqtradeName` from the DB.
2. Writes the Python file to `FREQTRADE_STRATEGIES_DIR`.
3. If `FREQTRADE_API_URL` is configured, calls Freqtrade's `reload_config` endpoint.
4. Marks the strategy as deployed in the database.

### 8.3 Result

After deploy, the Freqtrade instance should pick up the new strategy file and make it available for live execution.

## 9. Strategy execution boundaries and gaps

### 9.1 UI-built/native TS strategies

- They are created by dashboard services and do not automatically become Freqtrade Python strategies.
- This means a TypeScript-native strategy would currently need a separate bridge to Freqtrade if the user wants Freqtrade backtesting.
- In practice, the repo is currently treating these as different strategy families:
  - Freqtrade Python strategies for Python backtests
  - dashboard strategies for allocation/rebalance and non-Freqtrade use cases

### 9.2 What users should do

- If they want full Freqtrade backtesting, they should upload Python code and a valid Freqtrade strategy class.
- If they want normal YUKI dashboard strategies, they use the UI builder or core strategy creation endpoint.
- If they have TypeScript strategy code, the current implementation does not offer a direct Freqtrade-compatible conversion path.

## 10. Summary flow

1. **Create strategy**
   - Upload Python code or use UI builder.
   - Persist metadata and optionally `freqtrade_code`.
   - If `backtestOnCreate`, queue a backtest job immediately.

2. **Queue backtest**
   - `POST /api/v1/yuki/strategies/:strategyId/backtest`
   - `backtest_jobs` row inserted with `pending`.
   - User receives `jobId` and status URL.

3. **Run backtest**
   - Worker marks job `running`.
   - Writes `.py` file to `FREQTRADE_STRATEGIES_DIR`.
   - Runs Freqtrade wrapper subprocess.
   - Freqtrade downloads candles from the exchange and simulates trades.

4. **Persist results**
   - Update `backtest_jobs` to `completed`.
   - Store metrics in `strategies.backtestResults`.
   - Optionally notify user via Telegram.

5. **View results**
   - Poll `GET /api/v1/yuki/strategies/jobs/:jobId`.
   - Inspect `GET /v1/strategies/:strategyId/backtest` or `performance`.

6. **Deploy**
   - `POST /v1/strategies/:strategyId/deploy`
   - Write strategy file and reload Freqtrade config.

## 11. Recommended next gaps to close

- Add a first-class path for TypeScript-native strategies to backtest through the same job queue.
- Expose a progress stream / SSE endpoint for `jobId` status updates.
- Document the exact mounted route for the Freqtrade direct API module if it is meant to be active.
- Add a clear UI section for `freqtradeCode` vs `dashboard strategy` and which engine each path uses.
