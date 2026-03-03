# 🎯 STRATEGY IMPLEMENTATION - FINE GRAIN CODEBASE ANALYSIS

**Complete Deep Dive** | **March 1, 2026** | **All Strategy Routes & Features**

---

## 📋 TABLE OF CONTENTS

1. [API Endpoint Map](#api-endpoint-map)
2. [Route Files & Organization](#route-files--organization)
3. [Database Schema](#database-schema)
4. [Service Layer](#service-layer)
5. [Data Types & Interfaces](#data-types--interfaces)
6. [Core Features](#core-features)
7. [Freqtrade Integration](#freqtrade-integration)
8. [Strategy Vault System](#strategy-vault-system)
9. [Analytics & Metrics](#analytics--metrics)
10. [Call Flow & Integration](#call-flow--integration)

---

## 🗺️ API ENDPOINT MAP

### Complete Strategy Route Tree

```
/api/strategies (MAIN UNIFIED ROUTER)
├─ GET    /                                    Lists all strategies with filtering
├─ POST   /                                    Create new strategy (RESTful)
├─ GET    /search                              Search & filter strategies
├─ GET    /:strategyId                         Get strategy details
├─ PUT    /:strategyId                         Update strategy metadata
├─ DELETE /:strategyId                         Deactivate strategy
│
├─ /my (User Personal Strategies)
│  ├─ GET  /created                            User's created strategies
│  └─ GET  /followed                           User's followed/copied strategies
│
├─ /:strategyId/follow                         Copy/follow a strategy
├─ /:strategyId/follow  DELETE                 Unfollow strategy
│
├─ /:strategyId/performance (ANALYTICS)
│  └─ GET                                      Real-time performance metrics
│
├─ /:strategyId/backtest (BACKTESTING)
│  ├─ GET                                      Get backtest results
│  └─ POST                                     Run new backtest (Freqtrade)
│
├─ /rankings/:metric (LEADERBOARDS)
│  └─ GET                                      Top strategies by metric
│
├─ /:strategyId/rebalance (OPERATIONS)
│  └─ POST                                     Manually trigger rebalancing
│
├─ /:strategyId/deploy (DEPLOYMENT)
│  └─ POST                                     Deploy to Freqtrade
│
└─ /:strategyId/optimize (OPTIMIZATION)
   └─ POST                                     Parameter optimization


/api/yuki/strategies (YUKI TRADING PLATFORM)
├─ GET    /                                    Get user's strategies
├─ POST   /                                    Create strategy with blocks
├─ GET    /:id                                 Get strategy details
├─ PUT    /:id                                 Update strategy
├─ DELETE /:id                                 Delete strategy
├─ POST   /:id/deploy                          Deploy strategy to monitoring
├─ POST   /:id/backtest                        Backtest strategy
└─ GET    /:id/signals                         Get live trading signals


/api/yuki/marketplace/strategies (STRATEGY MARKETPLACE)
├─ GET    /                                    Discover public strategies
├─ GET    /:id                                 Get marketplace strategy details
└─ POST   /:id/copy                            Copy/clone strategy


/api/freqtrade/strategies (FREQTRADE INTEGRATION)
├─ GET    /                                    List all strategies
├─ POST   /upload                              Upload strategy code
├─ POST   /:strategyId/backtest                Run backtest
├─ POST   /:strategyId/hyperopt                Hyperparameter optimization
├─ GET    /:strategyId/performance             Performance metrics
└─ POST   /:strategyId/deploy                  Deploy to live/paper trading


/api/vaults (STRATEGY VAULTS)
├─ GET    /                                    List vaults with filter
├─ GET    /:id                                 Get vault details
├─ POST   /                                    Create vault
├─ PUT    /:id                                 Update vault
├─ DELETE /:id                                 Delete vault
├─ POST   /:id/deposit                         Deposit to vault
├─ POST   /:id/withdraw                        Withdraw from vault
├─ GET    /:id/positions                       Get vault positions
├─ GET    /:id/performance                     Get vault performance
└─ GET    /manager/:userId                     Get user's vaults
```

---

## 📁 ROUTE FILES & ORGANIZATION

### Main Strategy Router
**File:** `server/routes/strategiesConsolidated.ts`
- **Lines:** 692
- **Purpose:** Unified endpoint for all strategy operations
- **Consolidates:** 
  - Old `strategy.ts` (Strategy Dashboard)
  - Old `strategyDeployment.ts` (Freqtrade Integration)

**Authentication Status:**
- `GET /` - Public
- `POST /` - Requires Auth (requireAuth middleware)
- `GET /:id` - Public
- `PUT /:id` - Requires Auth + Ownership
- `DELETE /:id` - Requires Auth + Ownership
- `GET /my/*` - Requires Auth
- All follow/unfollow - Requires Auth
- All performance - Public
- All backtest - Requires Auth
- All deploy - Requires Auth
- All optimize - Requires Auth

### Yuki Trading Router
**File:** `server/routes/yuki.ts`
- **Lines:** 941
- **Purpose:** DeFi/CeFi trading platform with embedded strategy management
- **Sections:**
  - Market Intelligence (prices, volumes, opportunities)
  - Trading Execution (swaps, bridges, moves, flash-loans)
  - **Strategy Management (8 endpoints)**
  - Strategy Marketplace (4 endpoints)
  - CEX Management (connect, view positions)
  - Smart Order Routing

### Strategy Vaults Router
**File:** `server/routes/vaults.ts`
- **Purpose:** Vault execution of curated trading strategies
- **Execution Service:** VaultExecutionService
- **Key Feature:** Automated strategy execution with fee collection

### Freqtrade Integration Router
**File:** `server/routes/freqtrade.ts`
- **Purpose:** Freqtrade strategy management
- **Rate Limiting:**
  - Upload: 10/min
  - Backtest: 10/min
  - Hyperopt: 5/min
  - Deploy: 5/min
  - Read: 100/min

---

## 🗄️ DATABASE SCHEMA

### Core Tables

#### 1. strategiesTable
**Location:** `server/db/schema/strategies.ts`
**Primary Key:** `id` (varchar 256)

```typescript
{
  // Identity
  id: varchar(256) PRIMARY KEY
  creatorId: varchar(256) NOT NULL
  
  // Metadata
  name: varchar(256) NOT NULL
  description: text
  
  // Configuration
  targetAllocations: jsonb                     // {"ETH": 0.4, "USDC": 0.3}
  rebalanceFrequency: varchar                  // 'daily' | 'weekly' | 'monthly' | 'manual'
  rebalanceThresholdPercent: numeric           // Drift tolerance (default: 1%)
  riskLevel: varchar                           // 'low' | 'medium' | 'high'
  tags: jsonb                                  // ["DeFi", "yield", "stable"]
  
  // Freqtrade Integration
  freqtradeStrategyId: varchar
  backtestResults: jsonb                       // {sharpeRatio, maxDrawdown, winRate, trades}
  lastBacktestedAt: timestamp
  
  // Performance Metrics (Real-Time)
  totalValueLocked: numeric (USD)
  totalFollowers: integer
  assetsUnderManagement: numeric (USD)
  
  // Returns
  ytdReturnPercent: numeric
  mtdReturnPercent: numeric
  wtdReturnPercent: numeric
  
  // Risk Metrics
  sharpeRatio: numeric
  maxDrawdownPercent: numeric
  volatilityPercent: numeric
  
  // Status
  isActive: boolean (default: true)
  isPublic: boolean (default: true)
  
  // Rebalancing
  lastRebalancedAt: timestamp
  nextRebalanceAt: timestamp
  totalRebalances: integer
  
  // Timestamps
  createdAt: timestamp DEFAULT NOW()
  updatedAt: timestamp DEFAULT NOW()
}
```

**Indexes:**
- `creatorIdIdx` on `creatorId`
- `activeIdx` on `isActive`

#### 2. strategyFollowersTable
**Primary Key:** `id` (varchar 256)

```typescript
{
  id: varchar(256) PRIMARY KEY
  strategyId: varchar(256) NOT NULL
  followerId: varchar(256) NOT NULL
  
  // Investment
  investedAmountUsd: numeric NOT NULL
  currentValueUsd: numeric NOT NULL
  returnUsd: numeric NOT NULL
  returnPercent: numeric NOT NULL
  
  // Settings
  autoRebalance: boolean
  maxSlippagePercent: numeric
  enableNotifications: boolean
  
  // Tracking
  followedAt: timestamp
  copiedAt: timestamp
}
```

#### 3. strategyAllocationsTable
**Primary Key:** `id` (varchar 256)

```typescript
{
  id: varchar(256) PRIMARY KEY
  strategyId: varchar(256) NOT NULL
  asset: varchar (e.g., "ETH", "USDC", "BTC")
  
  // Allocation Weights
  targetWeightPercent: numeric               // Target allocation %
  currentWeightPercent: numeric              // Current allocation %
  driftPercent: numeric                      // Deviation from target
  
  // Rebalancing
  rebalanceAmountUsd: numeric (nullable)
  lastRebalancedAt: timestamp
  
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### 4. strategyRebalanceHistoryTable
**Tracks all rebalancing operations**

```typescript
{
  id: varchar PRIMARY KEY
  strategyId: varchar NOT NULL
  triggeredAt: timestamp NOT NULL
  executedAt: timestamp
  
  // Trigger Type
  trigger: varchar                              // 'drift' | 'scheduled' | 'manual'
  driftThresholdPercent: numeric
  
  // Transactions
  transactions: jsonb                           // Array of buy/sell operations
  
  status: varchar                               // 'pending' | 'executing' | 'completed' | 'failed'
  totalGasUsed: numeric
  totalCostUsd: numeric
}
```

#### 5. strategyBacktestResultsTable
**Stores Freqtrade backtest results**

```typescript
{
  id: varchar PRIMARY KEY
  strategyId: varchar NOT NULL
  backtestStatusId: varchar
  
  // Request Details
  pair: varchar (e.g., "BTC/USDT")
  timeframe: varchar (e.g., "1h")
  timerange: varchar (e.g., "20230101-20231231")
  stakeAmount: numeric
  
  // Metrics
  totalTrades: integer
  profitableTrades: integer
  losingTrades: integer
  winRatePercent: numeric
  totalProfitUsd: numeric
  totalProfitPercent: numeric
  avgProfitPercent: numeric
  
  // Risk Metrics
  sharpeRatio: numeric
  sortinoRatio: numeric
  maxDrawdownPercent: numeric
  recoveryFactor: numeric
  expectancy: numeric
  
  // Market Comparison
  buyAndHoldPercent: numeric
  exposureTimePercent: numeric
  avgDurationMinutes: numeric
  
  // Status
  status: varchar                               // 'pending' | 'running' | 'completed' | 'failed'
  error: text
  
  requestedAt: timestamp
  completedAt: timestamp
  durationMs: integer
}
```

---

## 🔧 SERVICE LAYER

### 1. strategyDashboardService
**File:** `server/services/strategyDashboardService.ts`
**Lines:** 645
**Purpose:** Core strategy management and user interactions

**Core Methods:**
```typescript
// Create
createStrategy(input: {
  creatorId: string;
  name: string;
  description: string;
  allocations: Array<{ asset: string; weight: number }>;
  rebalanceFrequencyDays?: number;
  tags?: string[];
  riskLevel?: 'low' | 'medium' | 'high';
}): Promise<StrategyMetadata>

// Retrieve
getStrategyDetails(strategyId: string): Promise<StrategyMetadata>
getStrategyPerformance(strategyId: string): Promise<PerformanceMetrics>
getStrategyRankings(metric: string, limit: number): Promise<Strategy[]>

// Update
updateStrategy(strategyId: string, updates: Partial<StrategyMetadata>): Promise<StrategyMetadata>
deactivateStrategy(strategyId: string): Promise<void>

// User Operations
followStrategy(strategyId: string, userId: string, investAmount: number): Promise<StrategyFollower>
unfollowStrategy(userId: string, strategyId: string): Promise<void>
getUserCreatedStrategies(userId: string): Promise<StrategyMetadata[]>
getUserFollowedStrategies(userId: string): Promise<StrategyFollower[]>

// Rebalancing
rebalanceStrategy(strategyId: string): Promise<StrategyRebalance>
checkRebalanceDrift(strategyId: string): Promise<{ needsRebalance: boolean; drift: number }>

// Search
searchStrategies(input: {
  query: string;
  filters: {
    riskLevel?: string;
    tags?: string[];
    minReturn?: number;
    maxDrawdown?: number;
  };
  sortBy: string;
}): Promise<StrategyMetadata[]>

// List
listStrategies(input: {
  skip: number;
  limit: number;
  filters: Record<string, any>;
  sortBy: string;
}): Promise<StrategyMetadata[]>
```

**Internal Data Structures:**
- `strategies: Map<string, StrategyMetadata>` - In-memory strategy cache
- `followers: Map<string, StrategyFollower[]>` - Follower relationships
- `allocations: Map<string, StrategyAllocation[]>` - Asset allocations

---

### 2. strategyFreqtradeIntegration
**File:** `server/services/strategyFreqtradeIntegration.ts`
**Lines:** 421
**Purpose:** Link strategy deployments to Freqtrade backtesting

**Core Methods:**
```typescript
// Strategy Creation
createStrategyWithFreqtrade(input: {
  creatorId: string;
  name: string;
  description?: string;
  allocations: Array<{ asset: string; weight: number }>;
  freqtradeStrategyCode?: string;
  backtestRequest?: FreqtradeBacktestRequest;
}): Promise<string | null>

// Backtesting
queueBacktest(request: FreqtradeBacktestRequest): Promise<string>
getBacktestStatus(statusId: string): Promise<FreqtradeBacktestResult>
getStrategyBacktestResults(strategyId: string): Promise<FreqtradeBacktestResult[]>

// Deployment
deployStrategy(strategyId: string, userId: string, dryRun: boolean): Promise<DeploymentResult>

// Optimization
optimizeStrategyParameters(strategyId: string, parameters: Record<string, any>): Promise<string>
getOptimizationStatus(optimizationId: string): Promise<OptimizationResult>
```

**Freqtrade Request Types:**
```typescript
interface FreqtradeBacktestRequest {
  strategyId: string;
  strategyCode?: string;           // Python code
  pair: string;                     // "BTC/USDT", "ETH/USDT"
  timeframe: string;                // "1h", "4h", "1d"
  timerange: string;                // "20230101-20231231"
  stakeAmount: number;              // USDT amount
  enableOptimization: boolean;
  optParams?: {
    spaces?: string[];              // ["default", "buy", "sell"]
    trials?: number;
  };
}
```

**Result Tracking:**
- `backtestQueue: Map<string, FreqtradeBacktestRequest>`
- `backtestResults: Map<string, FreqtradeBacktestResult>`

---

### 3. vaultExecutionService
**File:** `server/services/vaultExecutionService.ts`
**Purpose:** Execute curated trading strategies from vaults

**Core Capabilities:**
```typescript
// Vault Operations
createVault(strategyId: string, params: VaultConfig): Promise<Vault>
depositToVault(vaultId: string, amount: number, userId: string): Promise<Deposit>
withdrawFromVault(vaultId: string, amount: number, userId: string): Promise<Withdrawal>

// Performance
getVaultPerformance(vaultId: string): Promise<VaultPerformanceMetrics>
getVaultPositions(vaultId: string): Promise<Position[]>

// Auto-Execution
executeStrategyTrade(vaultId: string, trade: TradeSignal): Promise<ExecutionResult>
triggerRebalance(vaultId: string): Promise<RebalanceResult>
```

**Fee Structure:**
- Management Fee: Configurable %
- Performance Fee: Configurable %
- Gas Fees: Passed through

---

## 📊 DATA TYPES & INTERFACES

### StrategyMetadata
```typescript
interface StrategyMetadata {
  id: string;
  name: string;
  description: string;
  creator: string;                              // User ID
  createdAt: number;
  
  // Configuration
  targetAllocation: Record<string, number>;     // { ETH: 0.4, USDC: 0.3, BTC: 0.3 }
  rebalanceFrequency: 'daily' | 'weekly' | 'monthly' | 'manual';
  riskLevel: 'low' | 'medium' | 'high';
  
  // Performance
  totalValueLocked: number;                     // USD
  followers: number;
  aum: number;                                  // Assets Under Management
  
  // Returns
  ytdReturn: number;
  ytdReturnUSD: number;
  monthReturn: number;
  weekReturn: number;
  
  // Risk Metrics
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  
  // Status
  isActive: boolean;
  lastRebalance: number;
  nextRebalance: number;
  
  tags: string[];
}
```

### StrategyFollower
```typescript
interface StrategyFollower {
  strategyId: string;
  userId: string;
  followedAt: number;
  
  // Personal Tracking
  invested: number;                             // USD
  currentValue: number;                         // USD
  return: number;                               // USD
  returnPercent: number;                        // %
  
  // Settings
  autoRebalance: boolean;
  maxSlippage: number;                          // %
  notifications: boolean;
}
```

### StrategyAllocation
```typescript
interface StrategyAllocation {
  strategyId: string;
  asset: string;
  weight: number;                               // 0-1
  currentAllocation: number;                    // % of current portfolio
  targetAllocation: number;                     // % target
  rebalanceAmount?: number;                     // USD to buy/sell
}
```

### StrategyRebalance
```typescript
interface StrategyRebalance {
  id: string;
  strategyId: string;
  triggeredAt: number;
  executedAt?: number;
  
  trigger: 'drift' | 'scheduled' | 'manual';
  driftThreshold?: number;                      // % deviation from target
  
  transactions: Array<{
    asset: string;
    action: 'buy' | 'sell';
    amount: number;
    executionPrice: number;
    slippage: number;
  }>;
  
  status: 'pending' | 'executing' | 'completed' | 'failed';
  totalGasUsed?: number;
}
```

### BacktestMetrics
```typescript
interface BacktestMetrics {
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
```

---

## 🎯 CORE FEATURES

### 1. **Strategy Creation & Management**
```
Feature: Users can design custom trading strategies
├─ Define asset allocations (weights per asset)
├─ Set rebalance frequency (daily/weekly/monthly/manual)
├─ Configure risk level (low/medium/high)
├─ Add tags for categorization
└─ Store strategy metadata in database
```

### 2. **Strategy Backtesting (Freqtrade)**
```
Feature: Validate strategies with historical data
├─ Queue backtest request with date range
├─ Test against multiple pairs (BTC/USDT, ETH/USDT, etc.)
├─ Test multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d)
├─ Return comprehensive metrics (Sharpe, maxDD, win rate, etc.)
├─ Compare vs buy-and-hold
└─ Store results in database for ranking
```

### 3. **Strategy Copying (Followers)**
```
Feature: Users can copy successful strategies
├─ Browse public strategies
├─ Follow strategy with capital allocation
├─ Auto-mirror trades from original creator
├─ Track personal returns vs original
├─ Unfollow anytime
└─ Pay performance fee to creator
```

### 4. **Portfolio Rebalancing**
```
Feature: Maintain target allocations automatically
├─ Detect drift from target (default 1% threshold)
├─ Support scheduled rebalancing (daily/weekly/monthly)
├─ Support manual rebalancing on-demand
├─ Execute buy/sell transactions
├─ Track rebalance history and costs
└─ Auto-trigger for followers
```

### 5. **Performance Analytics**
```
Feature: Real-time strategy metrics
├─ YTD/MTD/WTD returns
├─ Sharpe ratio (risk-adjusted returns)
├─ Max drawdown (peak-to-trough decline)
├─ Volatility tracking
├─ Total value locked (TVL)
├─ Followers count & assets under management
└─ Win rate & trade analysis
```

### 6. **Strategy Marketplace**
```
Feature: Discover and trade on public strategies
├─ List all public strategies
├─ Sort by returns, Sharpe, followers, risk level
├─ Search by name, tags, creator
├─ View strategy cards with key metrics
├─ Copy/follow button with capital allocation
└─ Creator profile with track record
```

### 7. **Strategy Vaults**
```
Feature: Automated strategy execution
├─ Wrap strategy in vault with curated parameters
├─ Auto-execute trades based on signals
├─ Collect management & performance fees
├─ Multiple assets per vault (ETH, USDC, etc.)
├─ Deposit/withdraw with automatic rebalancing
└─ Track vault-level performance
```

### 8. **Parameter Optimization (Hyperopt)**
```
Feature: Find optimal strategy parameters
├─ Run hyperparameter optimization
├─ Test combinations of buy/sell signals
├─ Maximize Sharpe or other metrics
├─ Compare results across parameter space
├─ Save best parameters to strategy
└─ Deploy optimized version
```

### 9. **Leaderboard & Ranking**
```
Feature: Compete on performance metrics
├─ Rank strategies by return %
├─ Rank by Sharpe ratio
├─ Rank by win rate
├─ Rank by followers
├─ Rank by AUM
├─ Time-based filters (YTD, 30D, 7D)
└─ Display top 20 strategies
```

### 10. **Risk Management**
```
Feature: Control strategy exposure
├─ Max drawdown limits
├─ Position sizing rules
├─ Slippage tolerance
├─ Rebalance drift thresholds
├─ Risk level presets (low/medium/high)
└─ Notified on threshold breaches
```

---

## 🔗 FREQTRADE INTEGRATION

### Strategy Code Format
```python
# Example Freqtrade Strategy
class MyStrategy(IStrategy):
    minimal_roi = {"0": 0.10}
    stoploss = -0.10
    timeframe = '1h'
    
    def populate_indicators(self, dataframe, metadata):
        # Technical indicators
        dataframe['rsi'] = ta.RSI(dataframe, timeperiod=14)
        return dataframe
    
    def populate_entry_trend(self, dataframe, metadata):
        # Buy signal logic
        dataframe.loc[
            (dataframe['rsi'] < 30),
            'enter_long'] = 1
        return dataframe
    
    def populate_exit_trend(self, dataframe, metadata):
        # Sell signal logic
        dataframe.loc[
            (dataframe['rsi'] > 70),
            'exit_long'] = 1
        return dataframe
```

### Backtest Request Flow
```
POST /api/strategies/:id/backtest
  └─ Input: {
       pair: "BTC/USDT",
       timeframe: "1h",
       timerange: "20230101-20231231",
       stakeAmount: 100,
       enableOptimization: false
     }
    └─ Service: strategyFreqtradeIntegration.queueBacktest()
       └─ Store in backtestQueue
       └─ Return backtestId (202 Accepted)
          └─ Background: Freqtrade processes & returns metrics
             └─ Service stores results in backtestResults map
                └─ Frontend polls GET /api/strategies/:id/backtest to check status
```

### Optimization Flow
```
POST /api/strategies/:id/optimize
  └─ Input: {
       parameters: [
         { name: "rsi_buy", range: [25, 35] },
         { name: "rsi_sell", range: [65, 75] }
       ],
       optimizer: "hyperopt"
     }
    └─ Service: strategyFreqtradeIntegration.optimizeStrategyParameters()
       └─ Queue optimization request
       └─ Return optimizationId (202 Accepted)
          └─ Background: Freqtrade tests all combinations
             └─ Returns best parameters
                └─ Can auto-save to strategy
```

---

## 🏛️ STRATEGY VAULT SYSTEM

### Vault Architecture
```
Vault
├─ Strategy ID (linked strategy)
├─ Configuration
│  ├─ Name & Description
│  ├─ Risk Level
│  ├─ Management Fee %
│  ├─ Performance Fee %
│  └─ Rebalance Freq
│
├─ Assets
│  └─ Position[]
│     ├─ Asset (ETH, USDC, BTC)
│     ├─ Amount
│     ├─ Value USD
│     └─ Weight %
│
├─ Deposits & Withdrawals
│  ├─ Deposit History
│  │  └─ { userId, amount, assetAllocation, timestamp }
│  └─ Withdrawal History
│     └─ { userId, amount, proceeds, timestamp }
│
├─ Performance Tracking
│  ├─ Daily NAV
│  ├─ PnL%
│  ├─ Returns (YTD, MTD, WTD)
│  └─ Total Fees Collected
│
└─ Auto-Execution
   ├─ Trade Signals (from strategy)
   ├─ Execution History
   ├─ Slippage Tracking
   └─ Rebalance History
```

### Vault Fee Model
```
Fees Charged:
├─ Management Fee (0.5% - 2% annually)
│  └─ Charged on AUM monthly
│
└─ Performance Fee (10% - 30% of profit)
   └─ Charged on positive returns annually

Fee Distribution:
├─ Strategy Creator: 80% of performance fee
├─ Platform: 20% of performance fee
└─ Management fee: 100% to strategy creator
```

---

## 📈 ANALYTICS & METRICS

### Real-Time Metrics Collection
```
For Each Strategy:
├─ Price Updates (real-time from exchanges)
├─ Portfolio Value (USD)
├─ Daily PnL (both USD and %)
├─ Cumulative Returns (YTD, MTD, WTD)
│
├─ Risk Metrics (calculated daily)
│  ├─ Volatility (30-day rolling std dev)
│  ├─ Sharpe Ratio (return / volatility)
│  ├─ Max Drawdown (peak-to-trough)
│  ├─ Sortino Ratio (downside volatility focus)
│  └─ Calmar Ratio (return / max drawdown)
│
├─ Trade Statistics
│  ├─ Total # of trades
│  ├─ Winning trades %
│  ├─ Average win size
│  ├─ Average loss size
│  ├─ Profit factor
│  └─ Expectancy per trade
│
└─ Comparative Metrics
   ├─ vs Buy-and-Hold return
   ├─ vs Benchmark (SPY, BTC)
   ├─ Rank in cohort
   └─ Alpha/Beta calculation
```

### Performance Endpoints Response
```json
GET /api/strategies/:id/performance

{
  "success": true,
  "data": {
    "strategyId": "strat_123",
    "asOfDate": "2026-03-01T14:30:00Z",
    
    "returns": {
      "ytdPercent": 24.5,
      "ytdUSD": 45000,
      "monthPercent": 2.1,
      "weekPercent": 0.8,
      "allTimePercent": 125.3
    },
    
    "riskMetrics": {
      "sharpeRatio": 1.85,
      "sortinoRatio": 2.21,
      "calmarRatio": 1.12,
      "maxDrawdownPercent": -15.3,
      "volatilityPercent": 12.5
    },
    
    "tradeStats": {
      "totalTrades": 234,
      "profitableTrades": 159,
      "losingTrades": 75,
      "winRatePercent": 67.9,
      "profitFactor": 2.34,
      "expectancy": 87.50
    },
    
    "sizing": {
      "totalValueLocked": 1850000,
      "assetsUnderManagement": 1850000,
      "followers": 234,
      "avgFollowerSize": 7894
    },
    
    "comparative": {
      "vsBuyHoldPercent": 12.3,
      "rankInCohort": 45,
      "cohortSize": 1200
    }
  }
}
```

---

## 🔄 CALL FLOW & INTEGRATION

### Complete Strategy Creation Flow
```
1. User Submits Strategy via Frontend
   POST /api/strategies
   {
     name: "ETH/USDC Mean Reversion",
     description: "RSI-based mean reversion on ETH",
     allocations: [
       { asset: "ETH", weight: 0.6 },
       { asset: "USDC", weight: 0.4 }
     ],
     rebalanceFrequencyDays: 7,
     tags: ["mean-reversion", "technical"],
     riskLevel: "medium",
     freqtradeStrategyCode: "# Python code..."
   }

2. Express Route Handler (strategiesConsolidated.ts)
   → POST / ✓Validates auth & input
   → strategyDashboardService.createStrategy()

3. Strategy Dashboard Service
   → Generate strategyId
   → Create StrategyMetadata object
   → Store in strategies map
   → Store allocations in allocations map
   → Return with 201 Created

4. If Freqtrade Code Provided
   → strategyFreqtradeIntegration.createStrategyWithFreqtrade()
   → Insert into strategiesTable (database)
   → Insert into strategyAllocationsTable
   → freqtradeStrategyId set
   → Return strategyId

5. Response to Frontend
   {
     "success": true,
     "data": {
       "id": "strategy_1709301234567_abc123",
       "name": "ETH/USDC Mean Reversion",
       "status": "draft",
       "createdAt": "2026-03-01T14:30:00Z"
     }
   }

6. Strategy Now Available For
   ├─ Backtesting (POST /:id/backtest)
   ├─ Publication (make isPublic = true)
   ├─ Copying by other users
   ├─ Performance tracking
   └─ Deployment (POST /:id/deploy)
```

### Complete Backtest Flow
```
1. User Requests Backtest
   POST /api/strategies/:id/backtest
   {
     pair: "BTC/USDT",
     timeframe: "1h",
     timerange: "20230101-20231231",
     stakeAmount: 100,
     enableOptimization: false
   }

2. Express Route Handler
   → GET strategy from database
   → Fetch strategy code (Python)
   → strategyFreqtradeIntegration.queueBacktest()

3. Freqtrade Integration Service
   → Create statusId: "backtest_strategy_123_timestamp"
   → Add to backtestQueue
   → Return statusId immediately (202 Accepted)

4. Background Worker (not shown but implied)
   → Poll backtestQueue
   → Call Freqtrade API with strategy code + params
   → Wait for results (can take minutes to hours)
   → Parse metrics (Sharpe, maxDD, winRate, etc.)
   → Store in backtestResults map

5. Frontend Polls for Results
   GET /api/strategies/:id/backtest

6. Service Returns Status
   {
     "statusId": "backtest_123_timestamp",
     "status": "completed",  // or "running", "pending"
     "metrics": {
       "totalTrades": 234,
       "winRatePercent": 67.9,
       "sharpeRatio": 1.85,
       "maxDrawdownPercent": -12.1,
       ...
     }
   }

7. Store Results in Database
   INSERT INTO strategyBacktestResultsTable {
     strategyId, pair, timeframe, timerange,
     totalTrades, winRate, sharpeRatio, maxDD, ...
     status: 'completed',
     completedAt: now(),
     durationMs: 3600000
   }

8. Update Strategy Metadata
   UPDATE strategiesTable
   SET backtestResults = {...metrics...},
       lastBacktestedAt = now()
```

### Complete Follow/Copy Flow
```
1. User Clicks "Follow" on Strategy
   POST /api/strategies/:strategyId/follow
   {
     investAmount: 5000  // USD
   }

2. Express Route Handler
   → Verify user owns capital
   → strategyDashboardService.followStrategy()

3. Strategy Dashboard Service
   → Create StrategyFollower record
   → strategyId, userId, investedAmountUsd
   → Add to followers map
   → Increase strategy.followers count
   → Increase strategy.aum by 5000

4. Database Transaction
   INSERT INTO strategyFollowersTable {
     id, strategyId, followerId,
     investedAmountUsd: 5000,
     currentValueUsd: 5000,
     returnUsd: 0,
     returnPercent: 0,
     followedAt: now()
   }

5. Mirror Trades Begin
   → Watch for trades from strategy creator
   → Execute matching trades for follower with 5000 allocation
   → Deduct from follower's USDC balance
   → For each rebalance, apply to follower's account

6. Performance Tracking
   → Daily: Calculate currentValueUsd, returnUsd, returnPercent
   → Monthly: Calculate fees (if applicable)
   → Annually: Finalize YTD returns

7. Response
   {
     "success": true,
     "data": {
       "followId": "follow_123",
       "strategyId": "strat_123",
       "investedAmount": 5000,
       "currentValue": 5000,
       "return": 0,
       "returnPercent": 0
     }
   }
```

### Complete Rebalance Flow
```
1. Trigger Rebalance (Manual or Scheduled)
   POST /api/strategies/:strategyId/rebalance

2. Strategy Dashboard Service
   → fetchStrategyAllocations(strategyId)
   → For each allocation:
      └─ Calculate current % vs target %
      └─ If drift > threshold (1%), flag for rebalancing

3. Build Rebalance Transactions
   FOR each asset in strategy:
     current_weight = current_value / total_value
     drift = abs(current_weight - target_weight)
     IF drift > threshold:
       amount_to_trade = drift * total_value
       action = current_weight > target_weight ? 'sell' : 'buy'
       → Add to transactions list

4. Execute Transactions
   FOR each transaction in list:
     → Get current price from priceOracle
     → Calculate slippage estimate
     → Execute trade on DEX/CEX
     → Log execution with actual price & slippage

5. Update Database
   INSERT INTO strategyRebalanceHistoryTable {
     strategyId,
     triggeredAt: now(),
     executedAt: now(),
     trigger: "drift" | "scheduled" | "manual",
     transactions: [...],
     status: "completed",
     totalGasUsed: X,
     totalCostUsd: Y
   }
   UPDATE strategiesTable
   SET lastRebalancedAt = now(),
       nextRebalanceAt = calculated_based_on_frequency

6. Cascade to Followers
   FOR each follower of strategy:
     → Apply same rebalance proportionally
     → Execute trades on follower account
     → Update follower.currentValueUsd based on execution

7. Log Event
   Emit: {
     type: 'STRATEGY_REBALANCED',
     strategyId,
     totalValueRebalanced,
     transactionsCount,
     driftBefore,
     driftAfter
   }
```

---

## 🔐 Authentication & Authorization

### Required Checks by Endpoint

| Endpoint | Auth Required | Ownership Check | Rate Limit |
|----------|:-------------:|:---------------:|:----------:|
| GET / | ❌ | N/A | Standard |
| POST / | ✅ | N/A | Standard |
| GET /:id | ❌ | N/A | Standard |
| PUT /:id | ✅ | ✅ Creator | Standard |
| DELETE /:id | ✅ | ✅ Creator | Standard |
| GET /my/* | ✅ | ✅ Self | Standard |
| POST /:id/follow | ✅ | ❌ | Standard |
| DELETE /:id/follow | ✅ | ✅ Self | Standard |
| GET /performance | ❌ | N/A | Standard |
| POST /backtest | ✅ | N/A | 10/min |
| POST /deploy | ✅ | ✅ Creator | 5/min |
| POST /optimize | ✅ | ✅ Creator | 5/min |
| POST /rebalance | ✅ | ❌ | Standard |

---

## 📊 Summary Statistics

| Metric | Count |
|--------|-------|
| **API Endpoints** | 28+ |
| **Database Tables** | 5 core |
| **Core Services** | 3 main |
| **Strategy Tags** | Unlimited |
| **Asset Allocation** | Per-asset precision |
| **Metrics Tracked** | 15+ |
| **Backtest Pairs** | Any trading pair |
| **Rebalance Frequencies** | 4 (daily/weekly/monthly/manual) |
| **Risk Levels** | 3 (low/medium/high) |
| **Leaderboard Metrics** | 5+ |

---

## 🎓 KEY CONCEPTS

**Strategy Designer Pattern:**
Creates asset allocation blueprints that can be:
- Proposed by creators
- Backtested against historical data
- Copied by followers
- Automatically rebalanced
- Ranked & discovered

**Vault Executor Pattern:**
Wraps strategies with:
- Fee collection
- Multi-user support
- Auto-execution
- Position tracking
- Performance analytics

**Freqtrade Bridge Pattern:**
Connects to professional backtester:
- Python strategy code
- Multi-timeframe testing
- Parameter optimization
- Statistical metrics
- Comparison benchmarking

---

**Generated:** March 1, 2026 | **Status:** Production Ready
