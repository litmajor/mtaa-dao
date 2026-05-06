═══════════════════════════════════════════════════════════════════════════════
PRODUCTION IMPLEMENTATION MIGRATION GUIDE
═══════════════════════════════════════════════════════════════════════════════

## OVERVIEW

This guide explains how to migrate from mock implementations (for testing)
to production implementations with real atomicity, transaction locking, and
external API integration.

═══════════════════════════════════════════════════════════════════════════════
## PART 1: WALLET AGGREGATOR - TRANSACTION LOCKING
═══════════════════════════════════════════════════════════════════════════════

### PROBLEM: Race Conditions on Balance Caching

When multiple processes fetch wallet balances simultaneously:
  ❌ MOCK VERSION: No locking, final write overwrites previous updates
  ❌ RISK: Stale balance reads, orphaned wallet entries, double-spend

### SOLUTION: Database Transaction Isolation + Row-Level Locking

FILE: server/services/walletAggregatorService.production.ts (440 lines)

KEY FEATURES:

1. **PostgreSQL Serializable Isolation**
   ```typescript
   db.transaction(async (tx) => {
     // All operations in transaction are atomic
     // Serializable isolation (highest safety level)
     const wallets = await tx.execute(
       sql`SELECT * FROM user_wallets WHERE id = ${walletId} FOR UPDATE`
     );
     // Only this process can update this wallet until transaction commits
   })
   ```

2. **Row-Level Exclusive Locks (SELECT FOR UPDATE)**
   ```
   SELECT * FROM user_wallets WHERE id = ? FOR UPDATE
   ↓
   Acquires exclusive lock on matched rows
   ↓
   No other process can update until lock released
   ↓
   Transaction commits → Lock released automatically
   ```

3. **Application-Level Lock Queuing**
   ```typescript
   // Prevents thundering herd even before DB call
   await this.acquireWalletLock(walletId);
     ↓
   If lock held: Wait in queue with exponential backoff
   If lock free: Acquire and proceed
     ↓
   Timeout safety: Auto-release after 30 seconds
   ```

4. **Optimistic Locking with Version Counters**
   ```typescript
   // When transaction commits:
   UPDATE user_wallets 
   SET version = version + 1, cachedBalanceUsd = ?
   WHERE id = ? AND version = ?  // Fails if someone else updated
   ```

5. **RPC Retry Logic with Exponential Backoff**
   ```typescript
   // If RPC provider fails:
   Attempt 1: immediate
   Attempt 2: wait 100ms, retry
   Attempt 3: wait 200ms, retry
   Attempt 4: fail with error message
   ```

6. **Cache with TTL (Time-To-Live)**
   ```typescript
   // Balance cache expires after 60 seconds (configurable)
   WALLET_CACHE_TTL_MS = (process.env.WALLET_CACHE_TTL_SECONDS || 60) * 1000
   
   If balance is in cache and not expired: Return immediately
   If cache miss or expired: Fetch from RPC + update DB
   ```

### PRODUCTION SETUP

**Step 1: Environment Variables**
```bash
# RPC Endpoints (use professional providers)
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
OPTIMISM_RPC_URL=https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY
CELO_RPC_URL=https://celo-mainnet.infura.io/v3/YOUR_KEY

# Cache configuration
WALLET_CACHE_TTL_SECONDS=60

# Database configuration (PostgreSQL specific)
DATABASE_URL=postgresql://user:pass@host:5432/mtaa_production
```

**Step 2: Import Production Version**
```typescript
// OLD (mock version):
import { walletAggregatorService } from './services/walletAggregatorService';

// NEW (production version):
import { productionWalletAggregator } from './services/walletAggregatorService.production';
```

**Step 3: Update Route Handlers**
```typescript
// Before:
const aggregation = await walletAggregatorService.fetchWalletBalance(address, chain, context);

// After (with atomic locking):
const aggregation = await productionWalletAggregator.fetchWalletBalanceWithLocking(
  walletId,
  address,
  chain,
  context
);
```

**Step 4: Database Migration** 
```bash
npm run migrate  # Creates user_wallets table with version column
```

**Step 5: Add Price Oracle Integration**
```typescript
// Update getTokenPrice() method to call:
- Chainlink price feeds (most reliable)
- Uniswap V3 subgraph (real DEX prices)
- OHLCV service (fallback)
```

═══════════════════════════════════════════════════════════════════════════════
## PART 2: DEX ROUTING - REAL DAPP EXECUTION
═══════════════════════════════════════════════════════════════════════════════

### PROBLEM: Mock Swaps Don't Execute on Blockchain

Current: `executeSwap()` returns fake transaction hashes
Real production needs: Actual signed transactions submitted to blockchain

FILE: server/services/dexRoutingExecution.production.ts (520 lines)

### REPLACEMENT STRATEGY

**Old (Mock):**
```typescript
executeSwap(): Simulated with setTimeout
  → Returns fake tx hash
  → No actual blockchain interaction
  → Useful for testing UI
```

**New (Production):**
```typescript
executeSwap(): Real Uniswap/Curve/1Inch API calls
  → Query real DEX liquidity
  → Build Swap transaction
  → Sign with private key (STRATEGY_EXECUTOR_PRIVATE_KEY)
  → Submit to blockchain
  → Return real tx hash
  → Wait for confirmation
  → Return confirmed receipt
```

### ROUTING FLOW

```
User submits: { asset: "ETH", action: "buy", amountUsd: 10000 }
         ↓
    Query Multiple Venues:
    ├─ Uniswap V3 (1inch API) → Expected price, slippage
    ├─ Curve (on-chain call) → Stablecoin optimization
    ├─ Balancer (vault API) → Large order routing
    └─ 1inch Aggregator → Best available rate
         ↓
    Compare Results → Select venue with best price
         ↓
    Execute Swap:
    ├─ Build encoded transaction
    ├─ Estimate gas (gasCost function)
    ├─ Set slippage tolerance (maxSlippagePercent)
    ├─ Set deadline (current time + 1 minute)
    └─ Sign and submit
         ↓
    Wait for Confirmation
         ↓
    Return: { txHash, slippageActual, gasCostActual }
```

### PRODUCTION SETUP

**Step 1: Enable RPC Execution**
```bash
# Private key of strategy executor wallet
STRATEGY_EXECUTOR_PRIVATE_KEY=0x...

# Ensure wallet has funds on each chain:
Ethereum:  0.1+ ETH (for gas)
Polygon:   10+ MATIC (for gas)
Arbitrum:  0.01+ ETH (for gas)
Optimism:  0.01+ ETH (for gas)
Celo:      10+ CELO (for gas)
```

**Step 2: Initialize Wallet**
```typescript
productionDexRouting.initializeWallet('ethereum', process.env.STRATEGY_EXECUTOR_PRIVATE_KEY);
```

**Step 3: Call Real Routing**
```typescript
const route = await productionDexRouting.routeOrder(order, chain);
// → Actually queries Uniswap/Curve/Balancer/1inch APIs
// → Returns real price quotes

const result = await productionDexRouting.executeSwap(order, route, chain, recipient);
// → Submits real transaction to blockchain
// → Returns { txHash: "0x...", slippageActual, gasCostActual }
```

**Step 4: Monitor Execution**
```typescript
// Poll blockchain for confirmation
const receipt = await provider.getTransactionReceipt(txHash);
if (receipt.status === 1) {
  console.log('✅ Swap confirmed');
} else {
  console.log('❌ Swap failed');
}
```

### COST ESTIMATION

```
Uniswap V3 Swap Cost:
  Ethereum:  $50-200 USD
  Polygon:   $0.50-2 USD
  Arbitrum:  $1-5 USD
  Optimism:  $1-5 USD
  Celo:      $0.10-0.50 USD

Curve Swap Cost:
  All chains: 30-50% less gas than Uniswap

Large Order Handling:
  Orders > $100k: Split across multiple DEXes
  Method: Call splitOrder() before routing
```

═══════════════════════════════════════════════════════════════════════════════
## PART 3: FREQTRADE INTEGRATION - REAL BACKTESTING
═══════════════════════════════════════════════════════════════════════════════

### PROBLEM: Mock Backtests Don't Use Real Market Data

Current: Returns hardcoded "good-looking" metrics
Production: Actual Freqtrade bot processes real OHLCV data

FILE: server/services/strategyFreqtradeIntegration.production.ts (380 lines)

### PRODUCTION FLOW

```
1. Deploy Strategy
   Client sends: { name, code, pair, timeframe }
         ↓
   Validate code has required methods:
   - populate_indicators(dataframe)
   - populate_entry_trend(dataframe)
   - populate_exit_trend(dataframe)
         ↓
   POST /api/v1/strategy/deploy (to Freqtrade)
   Freqtrade saves to strategies/ directory
         ↓
   Returns: { strategyId: "momentum_1h" }

2. Queue Backtest
   Client sends: { strategyId, pair: "BTC/USDT", timeframe: "1h", 
                   timerange: "20230101-20231231", stakeAmount: 100 }
         ↓
   POST /api/v1/backtest (to Freqtrade)
   Freqtrade downloads OHLCV data for date range
   Freqtrade simulates trading:
   - Calls populate_indicators() on each candle
   - Calls populate_entry_trend() to identify entries
   - Calls populate_exit_trend() to identify exits
   - Executes trades, tracks PnL
         ↓
   Returns: { backtest_id: "abc123" }

3. Poll Results
   GET /api/v1/backtest/abc123/result
   Returns: {
     totalTrades: 145,
     profitableTrades: 92,
     winRate: 63.4%,
     sharpeRatio: 1.85,
     maxDrawdown: 8.3%,
     totalProfit: 2340  // In USDT
   }

4. Optimize Parameters (Optional)
   POST /api/v1/hyperopt/start {
     strategyId: "momentum_1h",
     spaces: ["buy", "sell", "roi", "stoploss"],
     hyperopt_trials: 50,
     hyperopt_loss: "SharpeHyperOptLoss"
   }
   Freqtrade runs Bayesian optimization:
   - Tries 50 different parameter combinations
   - Tests each against historical data
   - Returns best parameters by Sharpe ratio
         ↓
   Returns: { optimization_id: "opt_123", bestParams: {...} }

5. Deploy Best Strategy
   POST /api/v1/strategy/momentum_1h/parameters {
     parameters: { 
       buy_rsi: 35,
       sell_rsi: 72,
       stoploss: -0.10,
       roi: { "0": 0.35 }
     }
   }
```

### PRODUCTION SETUP

**Step 1: Install Freqtrade Server**
```bash
# Option A: Docker (recommended)
docker run -d \
  --name freqtrade-bot \
  -p 8080:8080 \
  -v /path/to/config:/freqtrade/config \
  -v /path/to/strategies:/freqtrade/user_data/strategies \
  freqtradeorg/freqtrade:latest

# Option B: Local installation
git clone https://github.com/freqtrade/freqtrade.git
cd freqtrade
pip install -e .
freqtrade create-userdir
freqtrade trades-to-ohlcv --exchange binance --pairs "BTC/USDT ETH/USDT"
```

**Step 2: Environment Variables**
```bash
FREQTRADE_API_URL=http://localhost:8080
FREQTRADE_API_TOKEN=your_jwt_token_here
```

**Step 3: Import Production Version**
```typescript
// OLD (mock):
import { strategyFreqtradeIntegration } from './services/strategyFreqtradeIntegration';

// NEW (production):
import { productionFreqtradeIntegration } from './services/strategyFreqtradeIntegration.production';
```

**Step 4: Deploy Strategy**
```typescript
const result = await productionFreqtradeIntegration.deployStrategy(
  strategyCode,  // Python code with indicators + trends
  'momentum_trading'
);
// → Actually sends code to Freqtrade server
// → Freqtrade validates and saves file
```

**Step 5: Queue Real Backtest**
```typescript
const backtestId = await productionFreqtradeIntegration.queueBacktest({
  strategyId: 'momentum_trading',
  pair: 'BTC/USDT',
  timeframe: '1h',
  timerange: '20230101-20231231',
  stakeAmount: 100,
  enableOptimization: false
});

// Poll for results
let metrics = null;
while (!metrics) {
  metrics = await productionFreqtradeIntegration.getBacktestResults(backtestId);
  if (!metrics) {
    await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds
  }
}
```

**Step 6: Run Hyperparameter Optimization**
```typescript
const optResult = await productionFreqtradeIntegration.startOptimization(
  'momentum_trading',
  'BTC/USDT',
  '20230101-20231231',
  trials: 50,  // Test 50 parameter combinations
  spaces: ['buy', 'sell', 'roi', 'stoploss']
);

// Check progress
const status = await productionFreqtradeIntegration.getOptimizationStatus(optResult.optimizationId);
console.log(`Progress: ${status.progress}%`);

// When complete
if (status.status === 'completed') {
  console.log('Best parameters:', status.bestParameters);
  console.log('Sharpe ratio:', status.metrics.sharpeRatio);
  
  // Deploy best parameters
  await productionFreqtradeIntegration.deployOptimizedStrategy(
    'momentum_trading',
    status.bestParameters
  );
}
```

═══════════════════════════════════════════════════════════════════════════════
## PART 4: WEBSOCKET PRICE STREAMING
═══════════════════════════════════════════════════════════════════════════════

### CURRENT: Returns Mock Prices from In-Memory Cache

To integrate real price feeds:

**Option A: Chainlink Price Feeds (Recommended)**
```typescript
// Query Chainlink oracles on-chain
const priceFeed = new AggregatorV3Interface(PRICE_FEED_ADDRESS);
const { answer } = await priceFeed.latestRoundData();
const price = BigNumber.from(answer).div(10n ** 8n);
```

**Option B: CEX Price APIs**
```typescript
// Binance, Coinbase, Kraken WebSocket feeds
const binanceWs = new WebSocket('wss://stream.binance.com:9443/ws/ethusdt@ticker');
binanceWs.on('message', (data) => {
  const { p: price } = JSON.parse(data);
  broadcastPriceUpdate({ asset: 'ETH', price });
});
```

**Option C: Subgraph Queries**
```typescript
// Real Uniswap V3 pools
const query = `
  query GetPrice($pair: String!) {
    pool(id: $pair) {
      token0Price
      token1Price
    }
  }
`;
```

**Update webSocketPriceStream.ts:**
```typescript
private async generatePriceUpdate(asset: string): Promise<PriceUpdate> {
  // Replace mock with real:
  const price = await getPriceFromChainlink(asset);  // Real oracle
  // or
  const price = await getPriceFromCEX(asset);        // Real CEX data
  // or
  const price = await getPriceFromSubgraph(asset);   // Real DEX data
  
  return { asset, price, ... };
}
```

═══════════════════════════════════════════════════════════════════════════════
## PART 5: DATABASE MIGRATIONS
═══════════════════════════════════════════════════════════════════════════════

Required tables with atomicity support:

```sql
-- Add version column for optimistic locking
ALTER TABLE user_wallets ADD COLUMN version INTEGER DEFAULT 1;

-- Add index on wallet lookups
CREATE INDEX idx_user_wallets_userid_context 
ON user_wallets(user_id, context);

-- Add index on strategy rebalance lookups
CREATE INDEX idx_strategy_rebalances_strategyid 
ON strategy_rebalances(strategy_id, status);

-- Add constraint to prevent stale writes
ALTER TABLE user_wallets 
ADD CONSTRAINT check_version_positive CHECK (version > 0);
```

Run migration:
```bash
npm run migrate:production
```

═══════════════════════════════════════════════════════════════════════════════
## PART 6: ERROR HANDLING & MONITORING
═══════════════════════════════════════════════════════════════════════════════

### Deadlock Detection (PostgreSQL)
```
ERROR: deadlock detected
DETAIL: Process 123 waits for ExclusiveLock on tuple (0,1) of relation 16384...
↓
Caught by: catch (error instanceof PostgresError && error.code === '40P01')
↓
Action: Retry with exponential backoff (100ms, 200ms, 400ms)
```

### RPC Timeout Handling
```
RPC request timeout after 30 seconds
↓
Caught by: axios timeout configuration
↓
Action: Retry up to 3 times with backoff
↓
Final failure: Graceful degradation (return cached value)
```

### Transaction Failure Handling
```
Swap execution fails (insufficient liquidity, price impact)
↓
Transaction reverted on blockchain
↓
Action: Alert user, suggest alternative venue
↓
Retry: Can attempt different DEX with updated prices
```

═══════════════════════════════════════════════════════════════════════════════
## CHECKLIST FOR PRODUCTION DEPLOYMENT
═══════════════════════════════════════════════════════════════════════════════

### Wallet Aggregator
  ☐ Import ProductionWalletAggregator
  ☐ Set RPC endpoints (Alchemy, Infura, or equivalent)
  ☐ Run database migrations (add version column)
  ☐ Test with test wallets on mainnet
  ☐ Monitor cache hit rates (should be 70%+)
  ☐ Set appropriate cache TTL (60-300 seconds)
  ☐ Test deadlock scenarios with concurrent requests
  ☐ Monitor PostgreSQL lock waits (should be < 100ms)

### DEX Routing
  ☐ Import ProductionDexRouting
  ☐ Initialize executor wallet with STRATEGY_EXECUTOR_PRIVATE_KEY
  ☐ Fund wallet on all 5 chains (for gas)
  ☐ Test routing on testnet (Goerli, Mumbai, etc.)
  ☐ Verify gas estimation accuracy
  ☐ Test slippage tolerance (start conservative: 0.5%)
  ☐ Monitor failed swap rate (should be < 1%)
  ☐ Implement swap monitoring dashboard

### Freqtrade
  ☐ Deploy Freqtrade server (Docker recommended)
  ☐ Configure for chosen pairs (BTC/USDT, ETH/USDT, etc.)
  ☐ Download historical OHLCV data (1-2 years minimum)
  ☐ Test strategy deployment on example strategy
  ☐ Verify backtest results match Freqtrade native UI
  ☐ Test hyperparameter optimization
  ☐ Set up monitoring for bot health

### WebSocket Price Streaming
  ☐ Replace mock price generation with real feeds
  ☐ Choose primary price source (Chainlink recommended)
  ☐ Set up backup price sources (CEX APIs)
  ☐ Test price update latency (< 100ms target)
  ☐ Monitor client connection stability
  ☐ Test reconnection logic under network failures

═══════════════════════════════════════════════════════════════════════════════
## TESTING IN PRODUCTION
═══════════════════════════════════════════════════════════════════════════════

1. Use TESTNET before mainnet:
   - Goerli (Ethereum)
   - Mumbai (Polygon)
   - Sepolia (Ethereum 2)
   - Goerli (Arbitrum)
   - Goerli (Optimism)

2. Gradual Rollout:
   - Day 1: Single wallet aggregation
   - Day 2: DEX routing on small amounts ($100)
   - Day 3: Freqtrade backtests in parallel mode
   - Week 2: Live rebalancing with human approval
   - Week 3: Autonomous rebalancing with small allocations

3. Monitoring:
   ```bash
   # Watch database locks
   SELECT * FROM pg_locks WHERE NOT granted;
   
   # Monitor transaction durations
   SELECT duration FROM pg_stat_statements 
   WHERE query LIKE '%user_wallets%'
   ORDER BY duration DESC;
   
   # Check RPC latency
   tail -f /var/log/rpc_latency.log
   ```

═══════════════════════════════════════════════════════════════════════════════
