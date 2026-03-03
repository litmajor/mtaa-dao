═══════════════════════════════════════════════════════════════════════════════
PRODUCTION ARCHITECTURE & INTEGRATION POINTS
═══════════════════════════════════════════════════════════════════════════════

## SYSTEM ARCHITECTURE
═══════════════════════════════════════════════════════════════════════════════

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT APPLICATIONS                                 │
│  • Amara Dashboard (Portfolio View)                                          │
│  • Strategy Dashboard (Copy Trading)                                         │
│  • Admin Panel (Strategy Management)                                         │
└─────────┬───────────────────────────────────────────────────────────────────┘
          │
          │ HTTP/WebSocket
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXPRESS.JS API SERVER (PORT 5000)                        │
│                                                                              │
│  Routes:                                                                    │
│  • GET  /api/dashboard/portfolio          → assetGraphService              │
│  • POST /api/strategies/create             → strategyDeploymentRoutes      │
│  • POST /api/strategies/:id/backtest       → strategyFreqtradeIntegration  │
│  • POST /api/rebalancing/trigger           → dexRoutingExecution           │
│  • WS  /price:update                       → webSocketPriceStream          │
│                                                                              │
└─────────┬──────────────────┬──────────────────┬──────────────────┬──────────┘
          │                  │                  │                  │
          │ PostgreSQL       │ Blockchain RPC   │ Freqtrade Bot    │ Price Feeds
          ▼                  ▼                  ▼                  ▼
┌──────────────────┐ ┌──────────────────────┐ ┌─────────────────┐ ┌──────────┐
│  PostgreSQL DB   │ │ EVM Chain RPC        │ │ Freqtrade HTTP  │ │ Chainlink│
│  (Production)    │ │ (Alchemy/Infura)     │ │ API Server      │ │ Subgraph │
│                  │ │                      │ │                 │ │ CEX APIs │
│ Tables:          │ │ • Ethereum           │ │ • Deploy        │ │          │
│ • strategies     │ │ • Polygon            │ │ • Backtest      │ │ Real-time│
│ • followers      │ │ • Arbitrum           │ │ • Optimize      │ │ prices   │
│ • allocations    │ │ • Optimism           │ │ • Monitor       │ │          │
│ • rebalances     │ │ • Celo               │ │ • Live trading  │ │          │
│ • performance    │ │                      │ │                 │ │          │
│ • user_wallets   │ │ Functions:           │ │                 │ │          │
│                  │ │ • balanceOf()        │ │                 │ │          │
│                  │ │ • swap()             │ │                 │ │          │
│                  │ │ • approve()          │ │                 │ │          │
└────────┬─────────┘ └──────────┬───────────┘ └────────┬────────┘ └────┬─────┘
         │                      │                     │               │
         │ Drizzle ORM          │ Ethers.js          │ Axios          │ WebSocket
         │ (ACID Transactions)  │ (Real Execution)   │ (REST API)     │ (Pub/Sub)
         │                      │                    │                │
         └──────────────────────┴────────────────────┴────────────────┘
                                │
                    ┌───────────┴────────────┐
                    │                        │
              ┌─────▼──────┐              ┌──▼──────┐
              │ Application│              │Database │
              │   Lock     │              │ Locks   │
              │  Queues    │              │(SELECT  │
              │ (Prevent   │              │ FOR     │
              │  Deadlock) │              │UPDATE)  │
              └────────────┘              └─────────┘
```

═══════════════════════════════════════════════════════════════════════════════
## PRODUCTION SERVICE STACK
═══════════════════════════════════════════════════════════════════════════════

### 1. WALLET AGGREGATOR SERVICE (Atomicity Handler)
Location: server/services/walletAggregatorService.production.ts

Purpose: Fetch wallet balances across 5 chains with ACID guarantees

Integrations:
  ├─ INPUT: userWalletsTable (portfolio definition)
  │
  ├─ PROCESS:
  │  ├─ Application Lock (in-memory queue)
  │  │  └─ Prevents thundering herd before DB call
  │  │
  │  ├─ DB Lock (SELECT FOR UPDATE)
  │  │  └─ Exclusive row-level lock in PostgreSQL
  │  │  └─ Atomic: Fetch balance + Update DB in one transaction
  │  │
  │  ├─ RPC Queries (Ethers.js)
  │  │  ├─ getBalance() for native tokens
  │  │  ├─ balanceOf() for ERC-20 tokens
  │  │  └─ Retry logic (3 attempts, exponential backoff)
  │  │
  │  ├─ Price Queries
  │  │  ├─ Chainlink oracle (recommended)
  │  │  ├─ CEX APIs (fallback)
  │  │  └─ Cache with TTL (60 seconds default)
  │  │
  │  └─ DB Write
  │     ├─ UPDATE user_wallets SET cachedBalanceUsd, lastSyncedAt
  │     ├─ Increment version counter
  │     └─ Commit transaction (release lock)
  │
  └─ OUTPUT: WalletAggregation[] with balanceUsd per wallet

APIs:
  • fetchWalletBalanceWithLocking(walletId, address, chain, context)
    → Returns: WalletAggregation with ACID guarantee
  
  • fetchMultipleWalletsAtomic(walletIds[])
    → Returns: WalletAggregation[] (parallel, each locked)
  
  • getUserPortfolioSnapshot(userId)
    → Returns: Aggregated portfolio (user + DAO contexts)

Atomicity Guarantees:
  ✓ All-or-nothing: Either full balance update or rollback
  ✓ Isolated: Concurrent requests don't interfere
  ✓ Consistent: Version numbers prevent lost updates
  ✓ Durable: Committed writes survive server crash

Error Handling:
  • Deadlock → Catch (PostgresError.code === '40P01') → Retry
  • RPC failure → 3 retries with backoff → Return cached value
  • Lock timeout → Auto-release after 30s → Alert operator

═══════════════════════════════════════════════════════════════════════════════

### 2. DEX ROUTING EXECUTION SERVICE (Real Execution Handler)
Location: server/services/dexRoutingExecution.production.ts

Purpose: Find optimal DEX routes and execute real swaps on blockchain

Integrations:
  ├─ INPUT: SwapOrder[] (asset, amount, slippage tolerance)
  │
  ├─ ROUTING LAYER (Query Multiple Venues):
  │  ├─ Uniswap V3 (1inch API)
  │  │  ├─ REST API: Quote exact input single
  │  │  ├─ Returns: Expected price, slippage, gas cost
  │  │  └─ Best for: Large orders, volatile pairs
  │  │
  │  ├─ Curve (On-chain via provider)
  │  │  ├─ RPC Call: get_dy(i, j, dx)
  │  │  ├─ Returns: Output amount for stable swaps
  │  │  └─ Best for: Stablecoin trading (0.01% slippage)
  │  │
  │  ├─ Balancer (Vault API)
  │  │  ├─ Smart contract call: querySwap()
  │  │  ├─ Returns: Optimal path through liquidity pools
  │  │  └─ Best for: Large orders (> $100k)
  │  │
  │  └─ 1inch Aggregator (REST API)
  │     ├─ Queries DEXes + CEXes
  │     ├─ Returns: Best available rate
  │     └─ Fallback venue if DEXes insufficient
  │
  ├─ SELECTION LOGIC:
  │  └─ Compare all venues → Select lowest effective price
  │     └─ Effective price = (Output Amount) / (Input Amount)
  │
  ├─ EXECUTION LAYER:
  │  ├─ Build Transaction:
  │  │  ├─ Encode swap function (venue-specific)
  │  │  ├─ Set deadline (current time + 60 seconds)
  │  │  ├─ Set maxSlippage (from user input)
  │  │  └─ Calculate minAmountOut
  │  │
  │  ├─ Sign Transaction:
  │  │  ├─ Use STRATEGY_EXECUTOR_PRIVATE_KEY
  │  │  ├─ Sign with ethers.Wallet
  │  │  └─ Full transaction ready
  │  │
  │  ├─ Submit to Blockchain:
  │  │  ├─ POST to RPC endpoint
  │  │  ├─ Get transaction hash
  │  │  └─ Begin polling
  │  │
  │  └─ Confirm Receipt:
  │     ├─ Poll every 2 seconds
  │     ├─ Status: pending → confirmed/failed
  │     ├─ Get actual slippage from receipt
  │     └─ Get actual gas cost from receipt
  │
  └─ OUTPUT: ExecutedTransaction with txHash, slippage, gasCost

APIs:
  • routeOrder(order, chain)
    → Returns: RoutingResult (chose venue, expected price)
  
  • executeSwap(order, route, chain, recipient)
    → Returns: { txHash, slippageActual, gasCostActual }
  
  • estimateRebalanceCost(orders[])
    → Returns: { totalCostUsd, impactPercent }

Transaction Safety:
  ✓ Deadline protection: Swap reverts after 60 seconds
  ✓ Slippage protection: Reverts if price moves > tolerance
  ✓ Receipt verification: Confirms on-chain settlement
  ✓ Error recovery: Failed swap doesn't affect portfolio

Real Costs (Mainnet):
  • Uniswap Swap:   4000 gas (Ethereum: $50-100)
  • Curve Swap:     2000 gas (Ethereum: $25-50)
  • Balancer Swap:  3000 gas (Ethereum: $40-70)
  • Gas price: 20-100 gwei (depends on network congestion)

═══════════════════════════════════════════════════════════════════════════════

### 3. FREQTRADE INTEGRATION SERVICE (Backtest Handler)
Location: server/services/strategyFreqtradeIntegration.production.ts

Purpose: Deploy strategies and run real backtests with market data

Integrations:
  ├─ DEPLOYMENT FLOW:
  │  ├─ Strategy Code (Python)
  │  │  ├─ Required methods:
  │  │  │  ├─ populate_indicators(dataframe) → Add technical indicators
  │  │  │  ├─ populate_entry_trend(dataframe) → Signal buy entries
  │  │  │  └─ populate_exit_trend(dataframe) → Signal sell exits
  │  │  │
  │  │  └─ Validation:
  │  │     ├─ POST /api/v1/strategy/validate (to Freqtrade)
  │  │     └─ Validates syntax + required methods
  │  │
  │  └─ Deploy to Freqtrade:
  │     ├─ Send strategy file to Freqtrade server
  │     ├─ Freqtrade saves to strategies/ directory
  │     └─ Returns: strategyId (for referencing)
  │
  ├─ BACKTEST FLOW:
  │  ├─ Input:
  │  │  ├─ strategyId (already deployed)
  │  │  ├─ pair (e.g., "BTC/USDT")
  │  │  ├─ timeframe (e.g., "1h")
  │  │  ├─ timerange (e.g., "20230101-20231231")
  │  │  └─ stake_amount (e.g., 100 USDT)
  │  │
  │  ├─ Freqtrade Server:
  │  │  ├─ Download OHLCV data (1-2 years of history)
  │  │  ├─ For each candle:
  │  │  │  ├─ Call populate_indicators() → Add RSI, MACD, etc.
  │  │  │  ├─ Call populate_entry_trend() → Check if should buy
  │  │  │  ├─ Call populate_exit_trend() → Check if should sell
  │  │  │  ├─ Execute trade if signal
  │  │  │  └─ Track PnL
  │  │  │
  │  │  └─ Return backtest results:
  │  │     ├─ Trade count, win rate, profit
  │  │     ├─ Sharpe ratio, Sortino ratio
  │  │     ├─ Max drawdown percentage
  │  │     └─ backtest_id (for querying results)
  │  │
  │  └─ Result Retrieval:
  │     ├─ Poll GET /api/v1/backtest/{id}/result
  │     ├─ Status changes: pending → completed
  │     └─ Return BacktestMetrics object
  │
  ├─ OPTIMIZATION FLOW:
  │  ├─ Input:
  │  │  ├─ strategyId
  │  │  ├─ spaces: which parameters to optimize (buy, sell, roi, stoploss)
  │  │  ├─ trials: number of combinations to try (50-200)
  │  │  └─ hyperopt_loss: "SharpeHyperOptLoss" (optimize for risk-adjusted return)
  │  │
  │  ├─ Freqtrade Hyperopt Engine:
  │  │  ├─ Generate parameter combinations (Bayesian search)
  │  │  ├─ For each combination:
  │  │  │  ├─ Run backtest with those parameters
  │  │  │  ├─ Calculate Sharpe ratio
  │  │  │  └─ Track best parameters seen so far
  │  │  │
  │  │  └─ Return best parameters + results
  │  │     ├─ optimization_id
  │  │     ├─ best_parameters (dict)
  │  │     └─ best_metrics
  │  │
  │  └─ Deploy Best Parameters:
  │     ├─ POST /api/v1/strategy/{id}/parameters
  │     ├─ Freqtrade updates strategy configuration
  │     └─ Strategy ready for live trading
  │
  └─ LIVE TRADING FLOW:
     ├─ Start bot with deployed strategy
     ├─ Bot continuously monitors markets
     ├─ Executes trades on live exchange
     ├─ Monitor via GET /api/v1/bot/status
     └─ Can stop anytime with POST /api/v1/bot/stop

Backtest Results (BacktestMetrics):
  • totalTrades: Number of trades executed
  • winRatePercent: Profitable / Total trades × 100
  • sharpeRatio: Return standard deviation ratio (target > 1.5)
  • maxDrawdownPercent: Largest peak-to-trough decline
  • totalProfitPercent: Total return over timeframe

Real Results (Production):
  ✓ Based on actual historical OHLCV data (not simulated)
  ✓ Reproducible: Run again → Same results
  ✓ Verifiable: Can check against Freqtrade native UI
  ✓ Optimized: Found best parameters via Bayesian search

═══════════════════════════════════════════════════════════════════════════════

### 4. WEBSOCKET PRICE STREAMING SERVICE (Real-Time Handler)
Location: server/services/webSocketPriceStream.ts

Purpose: Stream real-time prices and portfolio updates to clients

Integrations:
  ├─ Server-Side (Node.js):
  │  ├─ Socket.IO Server
  │  │  ├─ HTTP upgrade to WebSocket
  │  │  ├─ Authentication via JWT token
  │  │  └─ User room management (user_{userId})
  │  │
  │  ├─ Price Feed Sources:
  │  │  ├─ Chainlink Price Feeds (recommended)
  │  │  │  ├─ Contract: 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 (ETH/USD)
  │  │  │  ├─ Method: latestRoundData()
  │  │  │  └─ Frequency: Update every block (~12s Ethereum)
  │  │  │
  │  │  ├─ CEX WebSocket APIs (Binance, Coinbase)
  │  │  │  ├─ Binance: wss://stream.binance.com:9443/ws/{symbol}@ticker
  │  │  │  ├─ Frequency: Real-time (< 100ms)
  │  │  │  └─ Pairs: BTC/USD, ETH/USD, etc.
  │  │  │
  │  │  └─ Subgraph Queries (Uniswap V3)
  │  │     ├─ Query: Latest pool price from subgraph
  │  │     ├─ Frequency: Polling every 1-2 blocks
  │  │     └─ Pairs: All Uniswap pools
  │  │
  │  └─ Broadcasting:
  │     ├─ Price update: io.emit('price:update', {...})\n     ├─ Portfolio update: io.to('user_123').emit('portfolio:update', {...})
  │     └─ Rebalancing alert: io.emit('rebalancing:alert', {...})
  │
  ├─ Client-Side (Browser/Mobile):
  │  ├─ Socket.IO Client
  │  │  ├─ Automatic reconnection on disconnect
  │  │  ├─ Message queue while offline
  │  │  └─ JWT token refresh on reconnect
  │  │
  │  ├─ Subscriptions:
  │  │  ├─ Price stream
  │  │  │  └─ emit('subscribe:price', {
  │  │  │        assets: ['ETH', 'USDC', 'BTC'],
  │  │  │        chains: ['ethereum', 'polygon'],
  │  │  │        updateFrequency: 'fast'  // 1 second updates
  │  │  │      })
  │  │  │
  │  │  ├─ Portfolio stream
  │  │  │  └─ emit('subscribe:portfolio', {
  │  │  │        userId: 'user_123',
  │  │  │        updateFrequency: 'slow'  // 5 second updates
  │  │  │      })
  │  │  │
  │  │  └─ Rebalancing alerts
  │  │     └─ emit('subscribe:rebalancing', {
  │  │          strategyId: 'strategy_123'
  │  │        })
  │  │
  │  └─ Event Handlers:
  │     ├─ on('price:update', (data) => {...})
  │     ├─ on('portfolio:update', (data) => {...})
  │     └─ on('rebalancing:alert', (alert) => {...})
  │
  └─ Message Formats:
     ├─ PriceUpdate:
     │  {
     │    asset: 'ETH',
     │    chain: 'ethereum',
     │    price: 2500,
     │    priceUsd: 2500,
     │    change24h: 50,
     │    changePercent24h: 2.04,
     │    timestamp: 1698765432000
     │  }
     │
     ├─ PortfolioUpdate:
     │  {
     │    userId: 'user_123',
     │    totalValueUsd: 25000,
     │    change24hUsd: 500,
     │    byChain: {ethereum: 15000, polygon: 10000},
     │    byContext: {user: 20000, dao: 5000}
     │  }
     │
     └─ RebalancingAlert:
        {
          strategyId: 'strategy_123',
          asset: 'ETH',
          driftPercent: 7.2,
          suggestedAction: 'buy',
          alertSeverity: 'warning'
        }

Real-Time Performance:
  • Server → Client latency: < 100ms (network dependent)
  • Price update frequency: 100ms - 5s (configurable)
  • Drop-off recovery: Auto-reconnect within 5s
  • Message buffering: Up to 1000 messages while offline

═══════════════════════════════════════════════════════════════════════════════
## DATABASE SCHEMA (PostgreSQL)
═══════════════════════════════════════════════════════════════════════════════

### user_wallets Table
```sql
CREATE TABLE IF NOT EXISTS user_wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  address TEXT NOT NULL,
  chain TEXT NOT NULL,              -- 'ethereum', 'polygon', etc.
  chain_id INTEGER NOT NULL,         -- 1, 137, 42161, etc.
  context TEXT NOT NULL,             -- 'user' or 'dao'
  dao_id TEXT,
  wallet_type TEXT,                  -- 'metamask', 'walletconnect', etc.
  label TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  cached_balance_usd TEXT,           -- For faster queries
  last_synced_at TIMESTAMP,
  
  version INTEGER DEFAULT 1,         -- For optimistic locking
  
  connected_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT fk_user_wallets_user_id FOREIGN KEY (user_id) 
    REFERENCES users(id),
  INDEX idx_user_chain_context (user_id, chain, context),
  INDEX idx_address_chain (address, chain)
);
```

### strategies Table
```sql
CREATE TABLE IF NOT EXISTS strategies (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  
  target_allocations JSONB,          -- {"ETH": 0.4, "USDC": 0.3}
  rebalance_frequency TEXT,          -- 'daily', 'weekly', 'monthly'
  rebalance_threshold_percent NUMERIC,
  risk_level TEXT,
  
  freqtrade_strategy_id TEXT,        -- Link to deployed bot strategy
  backtest_results JSONB,            -- Full BacktestMetrics
  last_backtested_at TIMESTAMP,
  
  performance_metrics JSONB,         -- Cached YTD/MTD returns
  ytd_return_percent TEXT,
  sharpe_ratio TEXT,
  max_drawdown_percent TEXT,
  volatility_percent TEXT,
  
  total_followers INTEGER DEFAULT 0,
  total_value_locked TEXT,
  assets_under_management TEXT,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT fk_strategies_creator FOREIGN KEY (creator_id) 
    REFERENCES users(id)
);
```

### strategy_rebalances Table
```sql
CREATE TABLE IF NOT EXISTS strategy_rebalances (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  
  triggered_at TIMESTAMP,
  executed_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  transactions JSONB,                -- Array of ExecutedTransaction
  
  status TEXT,                       -- 'pending', 'executing', 'completed', 'failed'
  successful_transactions INTEGER,
  failed_transactions INTEGER,
  
  total_gas_used TEXT,
  total_gas_cost_usd TEXT,
  total_slippage TEXT,
  
  error TEXT,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT fk_strategy_rebalances FOREIGN KEY (strategy_id) 
    REFERENCES strategies(id),
  INDEX idx_strategy_status (strategy_id, status)
);
```

═══════════════════════════════════════════════════════════════════════════════
## ENV VARIABLES SUMMARY
═══════════════════════════════════════════════════════════════════════════════

```bash
# RPC Endpoints (use professional providers, not free ones in production)
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/...
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/...
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/...
OPTIMISM_RPC_URL=https://opt-mainnet.g.alchemy.com/v2/...
CELO_RPC_URL=https://celo-mainnet.infura.io/v3/...

# Executor wallet for DEX swaps (MUST be funded)
STRATEGY_EXECUTOR_PRIVATE_KEY=0x...

# Freqtrade bot server
FREQTRADE_API_URL=http://freqtrade-bot:8080
FREQTRADE_API_TOKEN=your_jwt_token

# Caching
WALLET_CACHE_TTL_SECONDS=60
PRICE_CACHE_TTL_SECONDS=30

# Database
DATABASE_URL=postgresql://user:pass@host:5432/mtaa

# Monitoring
ENABLE_DEADLOCK_MONITORING=true
ENABLE_LOCK_TIMING_LOG=true
```

═══════════════════════════════════════════════════════════════════════════════
