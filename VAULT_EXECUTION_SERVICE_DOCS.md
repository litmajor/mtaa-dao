# Vault Execution Service - Complete Documentation

## Overview

The **VaultExecutionService** is the core engine that powers Strategy Vaults. It:
- Monitors deployed trading strategies in real-time
- Executes trades when conditions are met
- Tracks multi-depositor accounting and P&L
- Manages vault balances, shares, and performance metrics

## Architecture

```
┌─────────────────────────────────────┐
│   Depositors (Investors)            │
│  - Deposit capital                  │
│  - Receive vault shares             │
│  - Earn proportional returns        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Strategy Vault (Automated)        │
│  - Market-Neutral                   │
│  - Yield Aggregation                │
│  - Momentum                         │
│  - Stablecoin Defense               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Vault Execution Service           │
│  - Executes strategy blocks         │
│  - Evaluates conditions             │
│  - Tracks performance               │
│  - Updates positions                │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
   ┌────────┐    ┌──────────┐
   │  CEX   │    │   DEX    │
   │Trading │    │ Swaps &  │
   │Orders  │    │ Bridges  │
   └────────┘    └──────────┘
```

## Core Concepts

### Vaults
A vault is a managed fund that:
- Holds deposited capital
- Executes a specific strategy automatically
- Issues shares to depositors
- Tracks performance and P&L

```typescript
interface VaultState {
  vaultId: string;
  name: string;
  strategyId: string;
  totalValue: number;           // Total AUM
  totalShares: number;          // Total shares issued
  depositors: Map<userId, DepositorState>;
  positions: Position[];        // Current holdings
  performanceHistory: PerformanceEntry[];
  isActive: boolean;
}
```

### Depositors
When a user deposits into a vault:
1. **Deposit Amount** → Converted to shares at current share price
2. **Shares Issued** → `amount / (totalValue / totalShares)`
3. **Position Tracked** → Stored per user
4. **P&L Tracked** → Calculated from original deposit

```typescript
interface DepositorState {
  userId: string;
  depositAmount: number;        // Original amount deposited
  shares: number;               // Shares owned
  currentValue: number;         // Current value (shares × sharePrice)
  profitLoss: number;          // Unrealized P&L
  depositedAt: Date;
}
```

### Strategy Blocks
Strategies are composed of blocks that are executed sequentially:

**Condition Blocks** - Evaluate market conditions
- Price crosses threshold
- Volume spike
- RSI overbought/oversold
- Time-based triggers

**Action Blocks** - Execute trades
- Swap (DEX)
- Buy/Sell (CEX)
- Bridge (cross-chain)
- Move (internal transfer)
- Alert (notification)

**Logic Blocks** - Combine conditions
- AND, OR, NOT operations

**Risk Blocks** - Control risk
- Stop-loss
- Take-profit
- Max drawdown
- Daily trade limit

## Core Methods

### Creating a Vault

```typescript
const vault = await vaultService.createVault(
  'vault_market_neutral',
  'Market Neutral Strategy',
  'strategy_001',
  initialBalance
);
```

### Depositing Capital

```typescript
const { shares, currentValue } = await vaultService.depositToVault(
  vaultId,
  userId,
  amount // Amount to deposit
);
```

**Behind the scenes:**
- Calculate share price: `vault.totalValue / vault.totalShares`
- Shares to issue: `amount / sharePrice`
- Update vault total value
- Track depositor position

### Withdrawing Capital

```typescript
const { amount, profitLoss } = await vaultService.withdrawFromVault(
  vaultId,
  userId,
  sharesToRedeem
);
```

**Behind the scenes:**
- Calculate withdrawal amount: `shares × sharePrice`
- Calculate P&L: `currentValue - depositAmount`
- Update vault state
- Return funds to user

### Executing Strategy

The vault service runs a continuous execution loop every 5 seconds:

1. **Fetch Strategy** - Load strategy blocks from database
2. **Execute Blocks** - Process each block:
   - Conditions: evaluate market conditions
   - Actions: execute trades when conditions met
   - Risk: check risk controls
3. **Update Positions** - Reflect trades in vault state
4. **Record Performance** - Log metrics for analytics

### Strategy Execution Flow

```
Execution Loop (5s interval)
    │
    ├─ Load Strategy Blocks
    │
    ├─ For each block:
    │   ├─ Evaluate Conditions
    │   │   ├─ Price check
    │   │   ├─ RSI calculation
    │   │   └─ Volume analysis
    │   │
    │   ├─ If condition met:
    │   │   ├─ Execute Action
    │   │   │   ├─ Swap on DEX (smartRouter + dexIntegration)
    │   │   │   ├─ Trade on CEX (ccxtService)
    │   │   │   ├─ Bridge assets (crossChainService)
    │   │   │   └─ Update positions
    │   │
    │   └─ Check Risk Controls
    │       ├─ Stop-loss
    │       ├─ Take-profit
    │       └─ Max drawdown
    │
    └─ Record Performance
        ├─ Daily return
        ├─ Cumulative return
        └─ Trade count
```

## Supported Vault Categories

### 1. Market-Neutral Vault
- **Strategy**: Equal-weight long/short positions
- **Benefit**: Positive return in any market condition
- **Risk**: Lower volatility but lower returns
- **Example Conditions**:
  - Buy undervalued asset, short overvalued asset
  - Rebalance weekly to maintain neutrality

### 2. Yield Aggregation Vault
- **Strategy**: Rotate through best-yielding opportunities
- **Benefit**: Consistent yield generation
- **Risk**: Impermanent loss, concentration risk
- **Example Conditions**:
  - If Aave APY > 5%, deposit
  - If Uniswap V3 fee > 0.3%, provide liquidity
  - Rebalance monthly to top 5 yields

### 3. Momentum Vault
- **Strategy**: Follow price trends
- **Benefit**: Capture sustained moves
- **Risk**: Whipsaws, trend reversals
- **Example Conditions**:
  - RSI > 70 (momentum strength check)
  - Price > 50-day MA (trend confirmation)
  - Volume > 20-day MA (volume confirmation)
  - Execute: Buy and hold until trend reverses

### 4. Stablecoin Defense Vault
- **Strategy**: Maintain stablecoin peg
- **Benefit**: Principal protection, modest yield
- **Risk**: Low return environment
- **Example Conditions**:
  - If USDC < $0.98, buy (earn 2% profit)
  - If USDC > $1.02, sell (earn 2% profit)
  - Yield farm spare capital at 4% APY

## Position Management

### Tracking Positions

The vault maintains a list of current positions:

```typescript
vault.positions: [
  {
    symbol: 'ETH',
    amount: 5,
    entryPrice: 2800,
    currentPrice: 2847.50,
    unrealizedPnL: 237.50,
  },
  {
    symbol: 'USDC',
    amount: 15000,
    entryPrice: 1.00,
    currentPrice: 1.00,
    unrealizedPnL: 0,
  }
]
```

### Position Updates

When a trade executes:
1. **Reduce source position** → `position.amount -= tradeAmount`
2. **Increase target position** → Create or update with received amount
3. **Remove zero positions** → Clean up closed positions

## Performance Tracking

### Daily Metrics

```typescript
interface PerformanceEntry {
  timestamp: Date;
  totalValue: number;        // Vault total value
  dailyReturn: number;       // Today's % return
  cumulativeReturn: number;  // Total % return since inception
  trades: number;            // Trades executed today
}
```

### Calculating Returns

```typescript
// Daily Return
dailyReturn = ((currentValue - previousValue) / previousValue) * 100

// Cumulative Return (from inception)
cumulativeReturn = ((totalValue - initialValue) / initialValue) * 100

// Sharpe Ratio
sharpeRatio = (avgReturn - riskFreeRate) / stdDev

// Max Drawdown
maxDrawdown = (peakValue - troughValue) / peakValue
```

## Risk Controls

### Stop-Loss
- **Trigger**: When position loss exceeds threshold
- **Action**: Close position, lock in loss
- **Example**: `-5% loss → sell entire position`

### Take-Profit
- **Trigger**: When position gain exceeds threshold
- **Action**: Close position, lock in profit
- **Example**: `+10% gain → sell entire position`

### Max Drawdown
- **Trigger**: When cumulative loss exceeds limit
- **Action**: Pause vault until recovery
- **Example**: `Drawdown > 20% → pause all trading`

### Daily Trade Limit
- **Trigger**: When daily trade count exceeds limit
- **Action**: Stop executing new trades
- **Example**: `> 50 trades per day → pause execution`

## Event Emissions

The service emits events for monitoring and logging:

```typescript
// Vault lifecycle
vaultService.on('vault:created', ({ vaultId, name, strategyId }) => {})
vaultService.on('vault:paused', ({ vaultId }) => {})
vaultService.on('vault:resumed', ({ vaultId }) => {})

// Deposits/Withdrawals
vaultService.on('deposit:received', ({ vaultId, userId, amount, shares }) => {})
vaultService.on('withdrawal:processed', ({ vaultId, userId, amount, profitLoss }) => {})

// Execution
vaultService.on('vault:executed', ({ vaultId, executions, timestamp }) => {})
vaultService.on('execution:error', ({ vaultId, error }) => {})

// Risk
vaultService.on('vault:risk-triggered', ({ vaultId, violations }) => {})
vaultService.on('vault:alert', ({ vaultId, message, severity }) => {})
```

## Integration with Yuki

Vaults execute **Yuki strategies** automatically:

1. **Strategy Builder** → Create strategy blocks in Yuki
2. **Strategy Deploy** → Deploy strategy (strategy ID saved)
3. **Create Vault** → Reference strategy ID
4. **Execution** → Vault service loads and executes strategy blocks
5. **Performance** → Track vault-level P&L

### Example: Creating a Vault from Yuki Strategy

```typescript
// 1. User builds strategy in Yuki Dashboard
const strategy = {
  id: 'strategy_001',
  name: 'ETH Momentum',
  blocks: [
    { type: 'condition', config: { metric: 'rsi', value: 70 } },
    { type: 'action', config: { type: 'buy', token: 'ETH', amount: 'all' } },
  ]
};

// 2. Deploy strategy
await yukiApi.deployStrategy(strategy);

// 3. Create vault using strategy
const vault = await vaultApi.createVault({
  name: 'ETH Momentum Fund',
  strategyId: 'strategy_001',
  initialBalance: 100000,
});

// 4. Users deposit
await vaultApi.deposit(vault.vaultId, 50000); // Gets shares

// 5. Vault automatically executes strategy
// - Monitors RSI daily
// - Buys when RSI > 70
// - Sells when RSI < 30
// - Tracks P&L per depositor
```

## API Endpoints

### Vault Discovery
- `GET /api/vaults` - List all vaults
- `GET /api/vaults/:id` - Get vault details

### Deposits & Withdrawals
- `POST /api/vaults/:id/deposit` - Deposit capital
- `POST /api/vaults/:id/withdraw` - Withdraw capital
- `GET /api/vaults/:id/my-position` - Get your position

### Performance & Analytics
- `GET /api/vaults/:id/performance` - Performance history
- `GET /api/vaults/:id/analytics` - Detailed analytics
- `GET /api/vaults/:id/positions` - Current positions
- `GET /api/vaults/:id/execution-log` - Execution history

### Management
- `POST /api/vaults` - Create vault (admin)
- `PUT /api/vaults/:id/pause` - Pause vault
- `PUT /api/vaults/:id/resume` - Resume vault

## Database Schema

```sql
-- Vaults
CREATE TABLE vaults (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255),
  description TEXT,
  category VARCHAR(50),
  strategy_id VARCHAR(255),
  total_value DECIMAL(20, 8),
  total_shares DECIMAL(20, 8),
  status VARCHAR(50),
  created_at TIMESTAMP,
  created_by VARCHAR(255)
);

-- Vault Transactions (deposits/withdrawals)
CREATE TABLE vault_transactions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255),
  vault_id VARCHAR(255),
  type VARCHAR(50), -- 'deposit' or 'withdrawal'
  amount DECIMAL(20, 8),
  shares DECIMAL(20, 8),
  profit_loss DECIMAL(20, 8),
  timestamp TIMESTAMP
);

-- Vault Execution Logs
CREATE TABLE vault_execution_logs (
  id VARCHAR(255) PRIMARY KEY,
  vault_id VARCHAR(255),
  block_id VARCHAR(255),
  condition_met BOOLEAN,
  action_taken VARCHAR(50),
  result TEXT,
  created_at TIMESTAMP
);

-- Vault Performance History
CREATE TABLE vault_performance (
  id VARCHAR(255) PRIMARY KEY,
  vault_id VARCHAR(255),
  total_value DECIMAL(20, 8),
  daily_return DECIMAL(8, 4),
  cumulative_return DECIMAL(8, 4),
  trades INT,
  recorded_at TIMESTAMP
);
```

## Monitoring & Observability

### Key Metrics to Track

```typescript
// Per Vault
- Total AUM (Assets Under Management)
- Number of depositors
- Daily return %
- Cumulative return %
- Max drawdown %
- Win rate (profitable trades / total trades)
- Sharpe ratio
- Total trades executed

// Per Depositor
- Deposit amount
- Current value
- Unrealized P&L
- P&L %
- Deposits/withdrawals history
- Share balance
```

### Recommended Dashboards

1. **Vault Overview Dashboard**
   - Total AUM across all vaults
   - Top performing vaults
   - Recent trades
   - Risk alerts

2. **Individual Vault Dashboard**
   - Performance chart (30/90/365 days)
   - Current positions
   - Execution logs
   - Depositor list with P&L

3. **Depositor Dashboard**
   - My vaults
   - My positions
   - P&L tracking
   - Deposit/withdrawal history

## Best Practices

### For Vault Creators
1. Start with simple strategies (1-3 conditions)
2. Backtest thoroughly before deploying
3. Monitor execution logs daily
4. Set appropriate risk controls
5. Communicate strategy changes to depositors

### For Depositors
1. Understand the strategy before depositing
2. Start with small amounts
3. Monitor your P&L regularly
4. Diversify across multiple vaults
5. Check withdrawal timeline (lockup periods if any)

### For Operators
1. Monitor all vault execution loops
2. Alert on risk control triggers
3. Log all transactions for audit
4. Maintain 99.9% execution uptime
5. Regular backups and disaster recovery

## Future Enhancements

- [ ] Vault governance (DAO voting)
- [ ] Fee structure (management + performance fees)
- [ ] Lockup periods (time-based withdrawal restrictions)
- [ ] Vault insurance (slashing protection)
- [ ] Advanced risk models (Monte Carlo, VaR)
- [ ] Multi-asset vaults (deposit any asset)
- [ ] Vault benchmarking (compare to index)
- [ ] Social features (strategy discovery, ratings)

---

**Status**: 🟢 Production Ready
**Last Updated**: January 29, 2026
