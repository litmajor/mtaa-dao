# Bot Database Schema - Drizzle ORM

## Overview

Complete Drizzle ORM schema for trading bot management system with 4 core tables:
- **bots** - Bot instances and deployment config
- **bot_trades** - Individual trades executed by bots
- **bot_performance** - Aggregated metrics and statistics
- **bot_action_log** - Audit trail of bot actions

## Table Schemas

### 1. Bots Table

Stores deployed bot/strategy instances.

```typescript
{
  id: varchar(64) PRIMARY KEY,           // Unique bot ID
  userId: varchar(64) NOT NULL,          // Owner user
  strategyId: varchar(64) NOT NULL,      // Strategy used
  botName: varchar(255) NOT NULL,        // User-friendly name
  
  configuration: json NOT NULL,          // Strategy inputs & settings
  exchanges: json NOT NULL,              // Array of exchange names
  
  status: varchar(20) DEFAULT 'running', // running/paused/stopped/error
  errorMessage: text,                    // Error details if status=error
  
  initialCapital: numeric(20,8),         // Starting capital
  deployedAt: timestamp,                 // When bot started
  stoppedAt: timestamp,                  // When bot stopped
  pausedAt: timestamp,                   // When bot last paused
  
  notes: text,                           // User notes
  tags: json,                            // Metadata tags
  metadata: json,                        // Custom data
  
  createdAt: timestamp,                  // Record created
  updatedAt: timestamp,                  // Last updated
}
```

**Indexes:**
- `user_id` - Query all user bots
- `status` - Filter by bot status
- `strategy_id` - Filter by strategy
- `deployed_at` - Sort by deployment time

**Usage:**
```typescript
// Create bot
const bot = await createBot({
  id: 'bot_123',
  userId: 'user_456',
  strategyId: 'rsi_oversold',
  botName: 'My RSI Bot',
  configuration: {
    inputs: { rsiThreshold: 30, quantity: 0.1 },
    riskControl: { maxLoss: 100 },
  },
  exchanges: ['binance', 'kraken'],
  status: 'running',
  initialCapital: new Decimal('1000'),
});

// Get user bots
const userBots = await getUserBots(userId);

// Get active bots only
const activeBots = await getActiveBots(userId);

// Update status
await updateBotStatus(botId, 'paused');
```

---

### 2. Bot Trades Table

Records every trade executed by bots.

```typescript
{
  id: varchar(64) PRIMARY KEY,           // Unique trade ID
  botId: varchar(64) NOT NULL,           // Which bot executed
  userId: varchar(64) NOT NULL,          // Trade owner
  
  pair: varchar(20) NOT NULL,            // BTC/USDT, ETH/USDT, etc.
  side: varchar(10) NOT NULL,            // BUY, SELL, CLOSE
  orderType: varchar(20) NOT NULL,       // market/limit/grid/dca
  
  quantity: numeric(20,8) NOT NULL,      // Requested quantity
  filledQuantity: numeric(20,8),         // Actually filled
  
  entryPrice: numeric(20,8) NOT NULL,    // Target price
  filledPrice: numeric(20,8) NOT NULL,   // Actual filled price
  
  fee: numeric(20,8) NOT NULL,           // Fee amount
  feePercent: numeric(10,6),             // Fee %
  totalValue: numeric(20,8) NOT NULL,    // filled_qty * filled_price
  
  pnl: numeric(20,8),                    // Profit/loss in currency
  pnlPercent: numeric(10,6),             // PnL %
  executionTime: integer,                // ms from trigger to fill
  
  status: varchar(20) DEFAULT 'pending', // pending/partial/filled/cancelled
  exchange: varchar(50) NOT NULL,        // Which exchange
  
  triggerReason: varchar(255),           // Why trade was triggered
  indicatorValues: json,                 // Indicators at time (RSI, MACD, etc)
  
  createdAt: timestamp,                  // When trade triggered
  filledAt: timestamp,                   // When filled
  closedAt: timestamp,                   // When position closed
  
  metadata: json,                        // Strategy-specific data
}
```

**Indexes:**
- `bot_id` - Query all trades for a bot
- `user_id` - Query trades for a user
- `pair` - Filter by trading pair
- `status` - Filter by trade status
- `created_at` - Sort by time (critical for history)
- `exchange` - Filter by exchange

**Usage:**
```typescript
// Record a trade
const trade = await recordBotTrade({
  id: 'trade_789',
  botId: 'bot_123',
  userId: 'user_456',
  pair: 'BTC/USDT',
  side: 'BUY',
  orderType: 'market',
  quantity: new Decimal('0.1'),
  filledQuantity: new Decimal('0.1'),
  entryPrice: new Decimal('45000'),
  filledPrice: new Decimal('45050'),
  fee: new Decimal('0.45'),
  totalValue: new Decimal('4505'),
  status: 'filled',
  exchange: 'binance',
  triggerReason: 'RSI < 30 (value: 25.3)',
  indicatorValues: { RSI: 25.3, MACD: 150.5 },
});

// Get bot trades
const trades = await getBotTrades(botId, limit=100);

// Get recent trades for a pair
const btcTrades = await getBotTradesByPair(botId, 'BTC/USDT');

// Get trades in time range
const weekTrades = await getBotTradesInRange(
  botId,
  new Date(Date.now() - 7*24*60*60*1000),
  new Date()
);

// Update trade (e.g., mark as filled)
await updateBotTrade(tradeId, {
  status: 'filled',
  filledAt: new Date(),
  pnl: new Decimal('450'),
  pnlPercent: new Decimal('10.0'),
});
```

---

### 3. Bot Performance Table

Aggregated metrics for each bot (updated after each trade).

```typescript
{
  id: varchar(64) PRIMARY KEY,
  botId: varchar(64) UNIQUE NOT NULL,    // Links to one bot
  userId: varchar(64) NOT NULL,
  
  // Trade counts
  totalTrades: integer DEFAULT 0,
  winningTrades: integer DEFAULT 0,
  losingTrades: integer DEFAULT 0,
  pendingTrades: integer DEFAULT 0,
  
  // Win/Loss metrics
  winRate: numeric(10,6) DEFAULT 0,      // 0-100 (percent)
  profitFactor: numeric(20,8) DEFAULT 0, // wins/losses
  averageWin: numeric(20,8) DEFAULT 0,
  averageLoss: numeric(20,8) DEFAULT 0,
  largestWin: numeric(20,8) DEFAULT 0,
  largestLoss: numeric(20,8) DEFAULT 0,
  
  // Drawdown
  currentDrawdown: numeric(20,8) DEFAULT 0,
  maxDrawdown: numeric(20,8) DEFAULT 0,
  
  // Returns
  totalProfit: numeric(20,8) DEFAULT 0,
  totalProfitPercent: numeric(10,6) DEFAULT 0,
  returnOnCapital: numeric(10,6) DEFAULT 0, // % of initial capital
  
  // Risk metrics
  sharpeRatio: numeric(10,6) DEFAULT 0,
  sortinoRatio: numeric(10,6),
  calmarRatio: numeric(10,6),
  
  // Streaks
  maxConsecutiveWins: integer DEFAULT 0,
  maxConsecutiveLosses: integer DEFAULT 0,
  currentConsecutiveWins: integer DEFAULT 0,
  currentConsecutiveLosses: integer DEFAULT 0,
  
  // Timing
  averageTradeTime: integer DEFAULT 0,   // ms
  totalTradingTime: integer DEFAULT 0,   // ms
  
  // Costs
  totalFeesPaid: numeric(20,8) DEFAULT 0,
  averageFeePerTrade: numeric(20,8) DEFAULT 0,
  
  // Best/Worst
  bestPair: varchar(20),
  worstPair: varchar(20),
  bestExchange: varchar(50),
  
  // Open positions
  openPositions: integer DEFAULT 0,
  openProfit: numeric(20,8) DEFAULT 0,
  openProfitPercent: numeric(10,6) DEFAULT 0,
  
  // Timestamps
  lastTradeAt: timestamp,
  nextTradeAt: timestamp,
  updatedAt: timestamp,
  createdAt: timestamp,
}
```

**Indexes:**
- `bot_id` (UNIQUE) - Fast lookup
- `user_id` - Query user's bot performance
- `win_rate` - Sort by win rate
- `total_profit` - Sort by profit
- `last_trade_at` - Filter recent activity

**Usage:**
```typescript
// Create/update performance (call after each trade)
await upsertBotPerformance({
  id: 'perf_123',
  botId: 'bot_123',
  userId: 'user_456',
  totalTrades: 45,
  winningTrades: 30,
  losingTrades: 15,
  winRate: new Decimal('66.67'),
  profitFactor: new Decimal('2.0'),
  totalProfit: new Decimal('1234.56'),
  totalProfitPercent: new Decimal('123.45'),
  sharpeRatio: new Decimal('1.5'),
});

// Get bot performance
const perf = await getBotPerformance(botId);

// Get top performing bots
const topBots = await getTopBots('profit', limit=10);
const topByWinRate = await getTopBots('winRate', limit=10);
const topByRisk = await getTopBots('sharpe', limit=10);

// Get user's aggregated stats
const stats = await getUserBotStats(userId);
// Returns: { totalBots, activeBots, totalProfit, totalTrades, avgWinRate }
```

---

### 4. Bot Action Log Table

Audit trail for all bot actions.

```typescript
{
  id: varchar(64) PRIMARY KEY,
  botId: varchar(64) NOT NULL,
  userId: varchar(64) NOT NULL,
  
  action: varchar(50) NOT NULL,         // deployed/paused/resumed/stopped/config_updated/error
  description: text,
  
  previousState: json,                  // State before action
  newState: json,                       // State after action
  
  createdAt: timestamp DEFAULT NOW(),
}
```

**Usage:**
```typescript
// Record action
await recordBotAction({
  id: 'log_456',
  botId: 'bot_123',
  userId: 'user_456',
  action: 'config_updated',
  description: 'Updated RSI threshold from 30 to 25',
  previousState: { rsiThreshold: 30 },
  newState: { rsiThreshold: 25 },
});

// Get action history
const history = await getBotActionLog(botId, limit=50);
```

---

## Database Setup

### Installation

```bash
npm install drizzle-orm drizzle-kit pg
```

### Configuration

`drizzle.config.ts`:
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/db/schema/*',
  out: './server/db/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL,
  },
});
```

### Create Migration

```bash
npm run db:generate -- --name create_bot_tables
```

### Apply Migration

```bash
npm run db:migrate
```

---

## Integration Points

### 1. Bot Deployment Handler

```typescript
async function deployBotHandler(req: DeployBotRequest) {
  const bot = await createBot({
    id: generateId(),
    userId: req.userId,
    strategyId: req.strategyId,
    botName: req.botName,
    configuration: req.inputs,
    exchanges: req.exchanges,
    status: 'running',
    initialCapital: req.initialCapital,
  });

  // Initialize performance record
  await upsertBotPerformance({
    id: generateId(),
    botId: bot.id,
    userId: bot.userId,
  });

  return bot;
}
```

### 2. Trade Recording

```typescript
async function recordBotTradeHandler(botId: string, tradeData: BotTradeData) {
  // Record trade
  const trade = await recordBotTrade({
    id: generateId(),
    botId,
    ...tradeData,
  });

  // Update performance
  const perf = await getBotPerformance(botId);
  if (perf) {
    const updated = calculatePerformanceMetrics(perf, trade);
    await upsertBotPerformance(updated);
  }

  // Record action
  await recordBotAction({
    botId,
    action: 'trade_executed',
    description: `${trade.side} ${trade.quantity} ${trade.pair}`,
  });

  return trade;
}
```

### 3. Trade History Query

```typescript
// Get unified trade history (manual + bot trades)
async function getUnifiedTradeHistory(userId: string) {
  const botTrades = await db
    .select()
    .from(botTrades)
    .where(eq(botTrades.userId, userId));

  return botTrades.map(t => ({
    ...t,
    source: 'bot' as const,
    sourceId: t.botId,
  }));
}
```

---

## Performance Considerations

### Indexes
All tables have appropriate indexes for common queries:
- **User-based queries:** `user_id` on all tables
- **Status queries:** `status` on bots
- **Time-range queries:** `created_at` on bot_trades
- **Performance sorting:** `total_profit`, `win_rate` on bot_performance

### Query Patterns
```typescript
// Fast: Using indexed columns
const activeBots = await db
  .select()
  .from(bots)
  .where(eq(bots.status, 'running'));  // ✅ Fast (indexed)

// Slow: Full table scan
const oldTrades = await db
  .select()
  .from(botTrades)
  .where(gt(botTrades.pnl, 100));  // ❌ Slow (not indexed)

// Better: Use bot_id first
const trades = await db
  .select()
  .from(botTrades)
  .where(
    and(
      eq(botTrades.botId, botId),
      gt(botTrades.pnl, 100)
    )
  );  // ✅ Fast (filters by bot_id first)
```

### Archiving Old Trades
```typescript
// Keep bot_trades performant by archiving old data
async function archiveOldTrades(botId: string, beforeDate: Date) {
  const trades = await archiveOldTrades(botId, beforeDate);
  // Move to archive table or S3, then delete
}
```

---

## Type Safety

All types are automatically inferred from schema:

```typescript
// Automatically inferred types
import {
  Bot,
  BotInsert,
  BotTrade,
  BotTradeInsert,
  BotPerformance,
  BotPerformanceInsert,
} from '@/server/db/schema/bots';

// Type-safe insert
const bot: BotInsert = {
  id: 'bot_123',
  userId: 'user_456',
  // TS will error if required fields missing
};

// Type-safe select
const found: Bot | null = await getBotById(botId);
if (found) {
  console.log(found.status); // ✅ TS knows status exists
  console.log(found.invalidField); // ❌ TS error
}
```

---

## Relationships

Defined in `/server/db/relations/bots.ts`:

```typescript
// One-to-many: User → Bots → Trades
const bot = await db.query.bots.findFirst({
  with: {
    user: true,
    trades: true,
    performance: true,
  },
});

// Query related data
const userId = bot.userId;
const allBotTrades = bot.trades;
const stats = bot.performance;
```

---

## File Structure

```
server/db/
├── schema/
│   └── bots.ts              ← Table definitions
├── relations/
│   └── bots.ts              ← Relationships
├── services/
│   └── botService.ts        ← Database operations
├── migrations/
│   └── bot_schema.sql       ← SQL migration
└── index.ts                 ← DB instance export
```

---

## Next Steps

1. **Run migrations:** `npm run db:migrate`
2. **Implement bot engine:** Creates bots, executes strategies
3. **Create API endpoints:** Use botService queries
4. **Connect frontend:** useTradeHistory hook already ready
5. **Add monitoring:** Query bot_performance for metrics

---

## Summary

✅ **Complete type-safe schema** with all bot data  
✅ **4 core tables** (bots, trades, performance, logs)  
✅ **Optimized indexes** for common queries  
✅ **Automatic type inference** (Drizzle)  
✅ **Relationships defined** for easy joins  
✅ **Service layer ready** (botService.ts)  
✅ **Production-ready** with error handling  

Database is ready for bot execution engine integration! 🚀
