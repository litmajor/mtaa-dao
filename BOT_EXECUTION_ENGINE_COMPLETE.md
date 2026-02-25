# Bot Execution Engine - Complete Implementation Guide

## Overview

Full implementation of bot deployment, execution, and trade management system with exchange API integration and real-time strategy execution.

**Files Created:**
1. `server/integrations/exchanges/types.ts` - Exchange API interfaces
2. `server/integrations/exchanges/binance.ts` - Binance exchange connector
3. `server/integrations/exchanges/manager.ts` - Exchange connection manager
4. `server/integrations/bot/executionEngine.ts` - Bot execution and strategy engine
5. `server/api/handlers/botHandlersReal.ts` - Real API handlers (replaces stubs)
6. `server/api/routes/botRoutes.ts` - Route handlers and wiring

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (React)                          │
│  Strategy Wizard → Bot Card → Trading Dashboard             │
└────────────────────────┬────────────────────────────────────┘
                         │
                    /api/bots/*
                         │
┌────────────────────────▼────────────────────────────────────┐
│              API Routes (Next.js)                           │
│  POST /deploy | GET /list | POST /:id/pause | etc.        │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│          Real Bot Handlers (botHandlersReal.ts)            │
│  Validation → Database → Execution Engine → Response       │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼────┐   ┌──────▼────────┐   ┌──▼──────────────┐
   │Database │   │Exec Engine    │   │Exchange Manager│
   │         │   │               │   │                │
   │Bot Info │   │Strategy Logic │   │Binance API     │
   │Trades   │   │Order Mgmt     │   │Kraken (soon)   │
   │Perf     │   │Risk Control   │   │Coinbase (soon) │
   │Logs     │   │               │   │                │
   └─────────┘   └───────────────┘   └────────────────┘
```

---

## 1. Exchange Integration

### Exchange Connector Interface

**File:** `server/integrations/exchanges/types.ts`

All exchanges implement common interface:

```typescript
interface ExchangeConnector {
  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Orders
  placeOrder(request: OrderRequest): Promise<OrderResponse>;
  cancelOrder(orderId: string, pair: string): Promise<void>;
  getOrderStatus(orderId: string, pair: string): Promise<OrderResponse>;

  // Account
  getBalance(): Promise<BalanceResponse>;
  getTicker(pair: string): Promise<TickerData>;
  getFeeInfo(): Promise<FeeInfo>;

  // History
  getTradeHistory(pair?: string, limit?: number): Promise<TradeHistory[]>;

  // Streaming (optional)
  subscribeToTicker?(pair: string, callback: (data: TickerData) => void): void;
  unsubscribeFromTicker?(pair: string): void;
}
```

### Binance Implementation

**File:** `server/integrations/exchanges/binance.ts`

Full implementation with:
- HMAC SHA256 signature generation
- Order placement (market & limit)
- Balance queries
- Fee information
- Trade history retrieval
- Order status tracking

**Key Methods:**

```typescript
const binance = new BinanceConnector(apiKey, apiSecret, sandbox=false);

// Connect
await binance.connect();

// Place order
const order = await binance.placeOrder({
  pair: 'BTC/USDT',
  side: 'BUY',
  type: 'market',
  quantity: 0.1,
});

// Get balance
const balance = await binance.getBalance();
// Returns: { BTC: { free: 1.5, locked: 0, total: 1.5 }, USDT: {...} }

// Get ticker
const ticker = await binance.getTicker('BTC/USDT');
// Returns: { bid, ask, last, volume, timestamp }

// Get trades
const trades = await binance.getTradeHistory('BTC/USDT', limit=50);
```

### Exchange Manager

**File:** `server/integrations/exchanges/manager.ts`

Manages multiple exchange connections:

```typescript
const manager = new ExchangeManager();

// Initialize exchange
await manager.initializeExchange({
  name: 'binance',
  credentials: { apiKey: '...', apiSecret: '...' },
  sandbox: true, // Use testnet
});

// Get connector
const connector = manager.getConnector('binance');

// Check connection
if (manager.isExchangeConnected('binance')) {
  const balance = await connector.getBalance();
}

// Get all active exchanges
const exchanges = manager.getInitializedExchanges(); // ['binance', 'kraken']

// Disconnect
await manager.disconnect('binance');
```

---

## 2. Bot Execution Engine

**File:** `server/integrations/bot/executionEngine.ts`

### Deploy Bot

```typescript
const bot = await botExecutionEngine.deployBot(
  userId,
  strategyId,
  botName,
  inputs,           // { pair: 'BTC/USDT', quantity: 0.1, ... }
  riskControl,      // { maxLoss: 100, takeProfit: 500, ... }
  exchanges,        // ['binance', 'kraken']
  initialCapital,   // 1000
);

// Returns: Bot object with id, status='running', deployedAt
```

### Execution Loop

Bot runs continuously with 60-second cycles:

1. **Get Current Prices** - Fetch ticker data
2. **Calculate Indicators** - RSI, MACD, MA values
3. **Get Strategy Signal** - Call appropriate strategy function
4. **Validate Risk Controls** - Check if trade allowed
5. **Execute Trade** - Place order on exchange
6. **Record Trade** - Save to database
7. **Update Performance** - Recalculate metrics

### Strategy Implementations

#### RSI Oversold Strategy

```typescript
// Buys when RSI < 30 (oversold)
// Sells when RSI > 70 (overbought)

const signal = executeRSIStrategy(inputs, indicators);
// Returns: { action: 'BUY', confidence: 0.8, reason: 'RSI 25 < 30' }
```

#### Daily DCA Strategy

```typescript
// Buys at fixed time each day (e.g., 9 AM UTC)
// Fixed position size regardless of price

const signal = executeDCAStrategy(inputs, indicators);
// Returns: { action: 'BUY', confidence: 0.8, reason: 'Daily DCA at 9:00 UTC' }
```

#### Grid Trading Strategy

```typescript
// Places buy orders at regular price intervals
// Creates uniform grid from support to resistance

const signal = executeGridStrategy(inputs, indicators);
// Returns: { action: 'BUY', confidence: 0.7, targetPrice: 44250 }
```

#### MACD Momentum Strategy

```typescript
// Buys on MACD bullish crossover
// Sells on MACD bearish crossover

const signal = executeMACDStrategy(inputs, indicators);
// Returns: { action: 'BUY', confidence: 0.65, reason: 'MACD bullish crossover' }
```

### Control Methods

```typescript
// Pause bot (stop executing, but keep data)
await botExecutionEngine.pauseBot(botId);

// Resume paused bot
await botExecutionEngine.resumeBot(botId);

// Stop bot completely
await botExecutionEngine.stopBot(botId);

// Get executor status
const status = botExecutionEngine.getExecutorStatus(botId);
// Returns: { botId, bot, isRunning, lastCheck, interval }
```

---

## 3. Real API Handlers

**File:** `server/api/handlers/botHandlersReal.ts`

### Deploy Bot

```typescript
// POST /api/bots/deploy
const response = await deployBotHandler(userId, {
  strategyId: 'rsi_oversold',
  botName: 'My RSI Bot',
  inputs: {
    pair: 'BTC/USDT',
    quantity: 0.1,
    rsiThreshold: 30,
  },
  riskControl: {
    maxOpenTrades: 5,
    maxLossPerTrade: 100,
    maxDailyLoss: 500,
    maxLossStreak: 3,
    takeProfit: 500,
    stopLoss: -200,
    maxLeverage: 1,
    paused: false,
    maxDrawdown: 1000,
  },
  exchanges: ['binance'],
  initialCapital: 1000,
});

// Returns:
{
  id: 'bot-1234567890-abc123',
  strategyId: 'rsi_oversold',
  botName: 'My RSI Bot',
  status: 'running',
  deployedAt: '2026-01-15T10:30:00Z',
  config: { ... },
  performance: {
    trades: 0,
    wins: 0,
    losses: 0,
    profit: 0,
    profitPercent: 0,
    openPositions: 0,
  }
}
```

### List Bots

```typescript
// GET /api/bots
const bots = await listBotsHandler(userId);

// Returns:
[
  {
    id: 'bot-123',
    strategyId: 'rsi_oversold',
    botName: 'My RSI Bot',
    status: 'running',
    deployedAt: '2026-01-15T10:30:00Z',
    exchangeCount: 1,
    performance: {
      trades: 12,
      wins: 8,
      losses: 4,
      profit: 450.75,
      profitPercent: 45.08,
      winRate: 66.67,
    }
  }
]
```

### Get Bot Details

```typescript
// GET /api/bots/:id
const bot = await getBotHandler(botId, userId);

// Returns:
{
  id: 'bot-123',
  strategyId: 'rsi_oversold',
  botName: 'My RSI Bot',
  status: 'running',
  deployedAt: '2026-01-15T10:30:00Z',
  stoppedAt: null,
  initialCapital: 1000,
  configuration: { ... },
  performance: {
    trades: 12,
    wins: 8,
    losses: 4,
    profit: 450.75,
    profitPercent: 45.08,
    winRate: 66.67,
    sharpeRatio: 1.23,
    lastTrade: '2026-01-15T11:30:00Z',
  },
  recentTrades: [
    {
      id: 'trade-123',
      pair: 'BTC/USDT',
      side: 'BUY',
      quantity: 0.1,
      price: 45000,
      pnl: 45,
      status: 'filled',
      timestamp: '2026-01-15T11:30:00Z',
    }
  ],
  actionLog: [
    {
      action: 'deployed',
      description: 'Bot deployed with strategy rsi_oversold',
      timestamp: '2026-01-15T10:30:00Z',
    }
  ]
}
```

### Control Endpoints

```typescript
// POST /api/bots/:id/pause
await pauseBotHandler(botId, userId);
// Response: { status: 'paused', message: 'Bot paused successfully' }

// POST /api/bots/:id/resume
await resumeBotHandler(botId, userId);
// Response: { status: 'running', message: 'Bot resumed successfully' }

// POST /api/bots/:id/stop
await stopBotHandler(botId, userId);
// Response: { status: 'stopped', message: 'Bot stopped successfully' }

// DELETE /api/bots/:id
await deleteBotHandler(botId, userId);
// Response: { deleted: true, message: 'Bot deleted successfully' }
```

### Update Configuration

```typescript
// PUT /api/bots/:id/config
await updateBotConfigHandler(botId, userId, {
  inputs: {
    pair: 'BTC/USDT',
    quantity: 0.2, // Increased
    rsiThreshold: 25, // More aggressive
  },
  riskControl: {
    maxLossPerTrade: 150, // Increased
  }
});
```

### Get Trades

```typescript
// GET /api/bots/:id/trades?limit=100&offset=0
const trades = await getBotTradesHandler(botId, userId, 100, 0);

// Returns:
[
  {
    id: 'trade-123',
    pair: 'BTC/USDT',
    side: 'BUY',
    orderType: 'market',
    quantity: 0.1,
    filledQuantity: 0.1,
    entryPrice: 45000,
    filledPrice: 45050,
    fee: 0.45,
    pnl: 45,
    pnlPercent: 0.1,
    status: 'filled',
    exchange: 'binance',
    triggerReason: 'RSI 25 < 30 (oversold)',
    timestamp: '2026-01-15T11:30:00Z',
    filledAt: '2026-01-15T11:30:15Z',
  }
]
```

### Get Performance

```typescript
// GET /api/bots/:id/performance
const perf = await getBotPerformanceHandler(botId, userId);

// Returns:
{
  botId: 'bot-123',
  strategyName: 'My RSI Bot',
  totalTrades: 12,
  winRate: 66.67,
  profitFactor: 2.0,
  averageWin: 56.34,
  averageLoss: -28.17,
  largestWin: 150,
  largestLoss: -75,
  currentDrawdown: 0,
  totalProfit: 450.75,
  sharpeRatio: 1.23,
  maxConsecutiveWins: 4,
  maxConsecutiveLosses: 2,
  avgTradeTime: '45m',
  totalFeesPaid: 12.5,
}
```

---

## 4. API Routes Wiring

**File:** `server/api/routes/botRoutes.ts`

Example Next.js API handler implementation:

```typescript
// pages/api/bots/[...route].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import * as api from '@/server/api/routes/botRoutes';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Attach session to request
  req.session = session as any;

  const { route } = req.query;
  const [action, botId] = route as string[];

  // Route requests
  switch (req.method) {
    case 'GET':
      if (!action) return api.GET_BOTS(req, res);
      if (action.startsWith('bot-')) {
        if (req.query.trades) return api.GET_BOT_TRADES(action, req, res);
        if (req.query.performance) return api.GET_BOT_PERFORMANCE(action, req, res);
        return api.GET_BOT(action, req, res);
      }
      break;

    case 'POST':
      if (action === 'deploy') return api.POST_DEPLOY_BOT(req, res);
      if (botId === 'pause') return api.POST_PAUSE_BOT(action, req, res);
      if (botId === 'resume') return api.POST_RESUME_BOT(action, req, res);
      if (botId === 'stop') return api.POST_STOP_BOT(action, req, res);
      if (botId === 'trades') return api.POST_RECORD_TRADE(action, req, res);
      break;

    case 'PUT':
      if (botId === 'config') return api.PUT_UPDATE_CONFIG(action, req, res);
      break;

    case 'DELETE':
      return api.DELETE_BOT(action, req, res);
  }

  return res.status(404).json({ error: 'Not found' });
}
```

---

## 5. Data Flow

### Deploy Bot Flow

```
User clicks "Deploy" in wizard
         ↓
POST /api/bots/deploy
         ↓
deployBotHandler()
  ├─ Validate strategy ID
  ├─ Validate inputs against strategy schema
  ├─ Validate risk controls
  ├─ Validate exchanges
         ↓
botExecutionEngine.deployBot()
  ├─ Create bot in database
  ├─ Initialize exchanges
  ├─ Create performance record
  ├─ Start execution loop
  ├─ Record "deployed" action
         ↓
Return bot object to frontend
         ↓
Frontend updates UI with new bot
```

### Trade Execution Flow

```
Bot Execution Cycle (every 60 seconds)
         ↓
Get current prices from exchange
         ↓
Calculate technical indicators (RSI, MACD, etc)
         ↓
Call strategy function → Get signal
         ↓
Validate risk controls
         ↓
If HOLD: Return, wait for next cycle
         ↓
If BUY/SELL: Continue
         ↓
For each exchange:
  ├─ Create order request
  ├─ Place order via exchange API
  └─ Record trade in database
         ↓
Calculate new performance metrics
         ↓
Update bot_performance record
         ↓
Wait 60 seconds, repeat
```

---

## 6. Integration Checklist

- [x] Exchange API types defined
- [x] Binance connector implemented
- [x] Exchange manager created
- [x] Bot execution engine created
- [x] Strategy implementations (RSI, DCA, Grid, MACD)
- [x] Real API handlers implemented
- [x] Route wiring defined
- [ ] TODO: Kraken connector
- [ ] TODO: Coinbase connector
- [ ] TODO: WebSocket streaming
- [ ] TODO: Advanced indicator library (TA-Lib)
- [ ] TODO: Backtesting engine
- [ ] TODO: Paper trading mode

---

## 7. Environment Configuration

Add to `.env.local`:

```bash
# Exchange Credentials (encrypted storage recommended)
# BINANCE_API_KEY=your_key_here
# BINANCE_API_SECRET=your_secret_here
# BINANCE_SANDBOX=true

# Bot Configuration
BOT_EXECUTION_INTERVAL=60000  # 60 seconds
BOT_MAX_CONCURRENT=10
BOT_TIMEOUT=30000
```

---

## 8. Error Handling

All handlers include try-catch with detailed error messages:

```typescript
try {
  // Operation
} catch (error) {
  return res.status(500).json({
    error: error instanceof Error ? error.message : 'Unknown error'
  });
}
```

Common errors:
- 401 Unauthorized - Missing auth
- 404 Not Found - Bot doesn't exist
- 400 Bad Request - Invalid input
- 500 Server Error - Execution failed

---

## 9. Next Steps

1. **Implement Kraken & Coinbase connectors** - Use same ExchangeConnector interface
2. **Add WebSocket streaming** - Real-time price updates
3. **Implement TA-Lib integration** - Accurate technical indicators
4. **Build backtesting engine** - Test strategies on historical data
5. **Add paper trading** - Practice without real money
6. **Implement alerts** - Discord/Telegram notifications
7. **Create leaderboard** - Compare bot performance

---

## Summary

✅ **Complete exchange integration** with Binance API  
✅ **Bot execution engine** with 4 strategy implementations  
✅ **Real API handlers** connected to database and engine  
✅ **Risk controls** and performance tracking  
✅ **Audit logging** for all bot actions  
✅ **Type-safe** throughout with TypeScript  
✅ **Production-ready** error handling  

**Everything is ready to wire into Next.js API routes!** 🚀
