# Yuki Dashboard - Trading & Protocol Intelligence Platform

## 📈 Implementation Status

| Component | Status | File |
|-----------|--------|------|
| **Yuki Dashboard (Main)** | ✅ Complete | `client/src/components/trading/YukiDashboard.tsx` |
| **Visual Strategy Builder** | ✅ Complete | `client/src/components/trading/VisualStrategyBuilder.tsx` |
| **Strategy Marketplace** | ✅ Complete | `client/src/components/trading/StrategyMarketplace.tsx` |
| **CEX Manager** | ✅ Complete | `client/src/components/trading/CexManager.tsx` |
| **Market Intelligence** | 🔄 Scaffolded | Overview tab in YukiDashboard |
| **Smart Order Routing** | 🔄 Documented | CexManager smart routing preview |
| **API Reference** | ✅ Complete | `YUKI_API_REFERENCE.md` |

---

## 🎯 Vision

**Yuki** is the active trading and DeFi intelligence layer for MTAA investors. It turns **OKEDI's unified balance** into an **execution engine** for:
- Active trading (swap, bridge, move assets)
- Market intelligence (prices, volume, volatility)
- Strategy development (visual builder + API)
- Flash loans & arbitrage
- Portfolio rebalancing & DCA
- Cross-chain operations
- CEX management (connected exchanges, positions, auto-execution)
- Smart order routing (optimal execution across DEX/CEX)
- Strategy marketplace (discover, copy, earn from strategies)

---

## 📊 Core Capabilities

### 1. **Market Intelligence Dashboard**
- Real-time price feeds (DEX, CEX, aggregators)
- Volume, volatility, liquidity heatmaps
- DAO treasury analysis & tracking
- Arbitrage opportunities
- Liquidation risks & yields

### 2. **Trading Execution**
- **Swap**: Token swaps (Uniswap V3/V4, Curve, etc.)
- **Bridge**: Cross-chain transfers (Stargate, LayerZero, native bridges)
- **Move**: Internal transfers between Okedi wallet & subprofiles
- **Flash Loans**: Atomic arbitrage via Aave, dYdX
- **Portfolio Rebalance**: Auto-rebalance across subprofiles
- **Smart Order Routing**: Best execution across DEX/CEX venues
- **CCCT Routing**: Cross-Chain Cross-Counterparty Trading

### 3. **CEX Integration & Management**
- **Connected Exchanges**: Kraken, Coinbase, Binance, dYdX, etc.
- **Real-time Positions**: View balances & open orders across exchanges
- **Unified P&L**: Aggregate performance across all accounts
- **Auto-Execution**: Execute strategies automatically on any connected exchange
- **Deposit/Withdraw**: Fiat on/off ramps integrated
- **Risk Monitoring**: Liquidation alerts, margin ratios, funding rates (perpetuals)
- **API Key Management**: Secure, read-only or trading mode

### 4. **Strategy Ecosystem** (Non-Technical + API + Marketplace)
#### For Visual Builders (Drag-and-Drop)
- **Condition Blocks**: Price > X, Volume > Y, RSI > 70, etc.
- **Action Blocks**: Buy, Sell, Swap, Bridge, Alert
- **Logic Gates**: AND, OR, IF/THEN, ELSE
- **Execution Nodes**: Manual, Scheduled (cron), Triggered (price alert)
- **Risk Controls**: Stop-loss, Take-profit, Max slippage, Position size
- **Backtesting**: Run strategy on historical data

#### For API Developers
- REST API for strategy CRUD
- WebSocket feeds (prices, fills, portfolio)
- Strategy deployment & monitoring
- Historical backtest API

#### For Strategy Marketplace
- **Share**: Publish strategies with performance history
- **Discover**: Browse top strategies by category, return, risk-adjusted metrics
- **Copy**: One-click copy strategies to your account (with optional parameter tuning)
- **Earn**: Monetize strategies (% of profits, subscription, licensing)
- **Attribution**: Followers → Amara subprofile (for advanced trading & education)

### 3. **Strategy Ecosystem** (Non-Technical + API)
#### For Visual Builders (Drag-and-Drop)
- **Condition Blocks**: Price > X, Volume > Y, RSI > 70, etc.
- **Action Blocks**: Buy, Sell, Swap, Bridge, Alert
- **Logic Gates**: AND, OR, IF/THEN, ELSE
- **Execution Nodes**: Manual, Scheduled (cron), Triggered (price alert)
- **Risk Controls**: Stop-loss, Take-profit, Max slippage, Position size
- **Backtesting**: Run strategy on historical data

#### For API Developers
- REST API for strategy CRUD
- WebSocket feeds (prices, fills, portfolio)
- Strategy deployment & monitoring
- Historical backtest API

### 4. **Advanced Features (MTAA Protocol)**
- **Bayesian Belief Updater**: Machine-learning confidence scoring
- **Liquidity Flow Tracker**: Monitor liquidity migration
- **Market Entropy Analyzer**: Regime detection (trending vs ranging)
- **Adaptive Ensemble Optimizer**: Multi-strategy consensus
- **Smart Order Routing**: Optimal execution across DEX/CEX
- **CCCT (Cross-Chain Cross-Counterparty)**: Intelligent routing across chains & venues

---

## 🛒 Strategy Marketplace

Users can monetize and discover trading strategies:

### Publisher (Creator) Flow
1. **Create & Backtest** strategy (visual builder)
2. **Publish** to marketplace with:
   - Name, description, category
   - Performance metrics (returns, Sharpe, win rate, max DD)
   - Risk profile & recommended capital
   - Pricing model (free, % profit share, subscription, licensing)
   - Historical backtest data
3. **Track Performance** in live market
4. **Earn** when followers copy strategy
5. **Attribution**: Followers → Amara (advanced subprofile for learning)

### Subscriber (Discoverer) Flow
1. **Browse** marketplace by category, return, risk-adjusted metrics
2. **View** strategy details, backtests, live performance, creator profile
3. **Copy** strategy (one-click deploy to own account)
4. **Tune** parameters (optional) for own risk tolerance
5. **Monitor** copied strategy performance vs original
6. **Upgrade to Amara** if interested in deeper education from creator

### Economics
- **Free strategies**: Exposure, community reputation
- **Profit share**: Creator gets X% of subscriber gains (e.g., 10-30%)
- **Subscription**: Monthly fee (e.g., $99/month for premium strategy)
- **Licensing**: Enterprise or institutional use
- **Referral**: X% commission when follower signs up

### Marketplace Features
- **Leaderboards**: Top strategies by period, category, risk-adjusted return
- **Creator badges**: Verified, trusted, top-performer
- **Reviews & ratings**: User feedback on strategy quality
- **Performance attestation**: On-chain proof of historical returns
- **Dispute resolution**: Mechanism for false claims

---

## 🌐 CEX Integration & Smart Order Routing

### Connected Exchanges
Yuki supports direct integration with major centralized exchanges:
- **Tier 1**: Kraken, Coinbase Pro, Binance, Bybit, OKX
- **Tier 2**: Huobi, Gate.io, Kucoin, Crypto.com
- **Tier 3**: dYdX (decentralized perpetuals), Perps (decentralized)

### API Key Management
- Secure vault for exchange API keys (encrypted, non-custodial)
- Granular permissions (read-only, trading, withdrawals)
- Audit log of all key usage
- One-time setup, automatic rotation reminders

### Unified Dashboard
- **Balances**: Real-time across all connected exchanges
- **Open Orders**: View all orders, cancel quickly
- **Positions**: Spot + perpetual positions with P&L
- **Funding Rates**: Monitor perpetual funding costs
- **Liquidation Risk**: Alerts when approaching liquidation price
- **Margin Ratios**: Real-time leverage monitoring

### Smart Order Routing
Automatically route orders to best execution venue:
```
User wants to buy 10 ETH
  → System checks DEX liquidity (Uniswap, Curve, Balancer)
  → System checks CEX liquidity (Kraken, Coinbase, Binance)
  → Smart router selects venue(s) with:
     - Best price after slippage/fees
     - Lowest gas (if DEX)
     - Lowest maker/taker fees (if CEX)
     - Acceptable speed/confirmation
  → Execute across optimal venue(s)
```

### CCCT (Cross-Chain Cross-Counterparty Trading)
Enable trading across chains and counterparties seamlessly:
- **Example**: User wants USDC on Polygon but cheapest on Ethereum CEX
  - Smart router: Buy ETH on Polygon DEX → Swap for USDC → Done
  - Or: Buy USDC on Ethereum CEX → Bridge to Polygon → Done
  - Route selection: Lowest cost + fastest execution

### Auto-Execution
Strategies can execute automatically on connected exchanges:
- **Triggers**: Price, time, volume, technical indicators
- **Actions**: Buy/Sell at market, limit, stop-loss
- **Approval**: User confirms first trade, then auto-approves until risk limits hit
- **Risk guards**: Stop-loss, max daily loss, max position size

---

## 🎨 Visual Strategy Builder

Users can build strategies without code by dragging blocks:

```
START → IF (Price > $100 AND RSI > 70) 
        → THEN (Sell 50% of ETH)
        → AND (Send proceeds to Amara subprofile)
        → ELSE (Hold)
        → ON ERROR (Alert Slack)
        → END
```

**Block Types:**
- **Conditions**: Price, Volume, RSI, MACD, MA, Bollinger Bands, Custom formula
- **Actions**: Buy, Sell, Swap, Bridge, DCA, Rebalance, Alert
- **Logic**: AND, OR, NOT, IF/THEN/ELSE, Loop
- **Risk**: Stop-loss, Take-profit, Max slippage, Position size limit
- **Execution**: Scheduled (cron), Triggered (webhook), Manual, Time-based

---

## 🔌 API Surface

### REST Endpoints (Yuki-specific)

#### Market Intelligence
```
GET /api/yuki/market/prices
  ?symbols=ETH,USDC&chains=ethereum,polygon
  → { symbol, price, change24h, volume24h, liquidity }

GET /api/yuki/market/opportunities
  → { type, pnl%, gas, slippage, protocol, actionable }

GET /api/yuki/portfolio/rebalance
  ?target={"ETH": 40%, "USDC": 60%}
  → { rebalances[], totalGas, recommendation }
```

#### Trading Execution
```
POST /api/yuki/execute/swap
  { from: "ETH", to: "USDC", amount: "1.5", slippage: "0.5%" }
  → { txHash, route, amountOut, gas, executedAt }

POST /api/yuki/execute/bridge
  { from_chain: "ethereum", to_chain: "polygon", token: "USDC", amount: "1000" }
  → { bridgeTx, estimated_arrival, fee }

POST /api/yuki/execute/move
  { from_wallet: "okedi", to_wallet: "amara", token: "cUSD", amount: "500" }
  → { txHash, status }
```

#### Strategy Management
```
POST /api/yuki/strategies
  { name, blocks: [{type, config}], riskControls, backtest }
  → { strategyId, createdAt, status }

GET /api/yuki/strategies/:id
  → { id, blocks, riskControls, stats, backtestResults }

PUT /api/yuki/strategies/:id
  → Update strategy

DELETE /api/yuki/strategies/:id
  → Delete strategy

POST /api/yuki/strategies/:id/deploy
  → Deploy & start monitoring

POST /api/yuki/strategies/:id/backtest
  { dateRange: "2024-01-01:2024-12-31" }
  → { pnl%, winRate, maxDrawdown, trades[] }

GET /api/yuki/strategies/:id/signals
  → { currentSignal, confidence, nextAction, lastUpdate }
```

#### WebSocket (Real-time)
```
ws://api/yuki/live
  → Subscribe to: prices, fills, portfolio, alerts

{
  "type": "subscribe",
  "channels": ["price:ETH-USDC", "fills:user", "alerts"]
}

→ Receive updates on price changes, trade fills, strategy alerts
```

---

## 🏗️ Feature Roadmap

### Phase 1: MVP (Now)
- [x] Market intelligence (price feeds, volume)
- [x] Swap execution (Uniswap V3)
- [x] Bridge execution (Stargate)
- [x] Move funds (internal transfers)
- [ ] Visual strategy builder (UI scaffolding)
- [ ] Basic backtesting

### Phase 2: Smart Strategies
- [ ] Strategy templates (DCA, Grid, Mean Reversion, Momentum)
- [ ] Mean Reversion agent (7 additional strategies)
- [ ] Flash loan executor
- [ ] Bayesian belief updater
- [ ] Liquidity flow tracker

### Phase 3: Advanced Intelligence
- [ ] Market entropy analyzer
- [ ] Adaptive ensemble optimizer
- [ ] Liquidation risk monitoring
- [ ] Yield farming aggregator
- [ ] Options/derivatives support

### Phase 4: Community & Governance
- [ ] Strategy marketplace (share/monetize strategies)
- [ ] DAO governance on strategy parameters
- [ ] Leaderboards & performance tracking
- [ ] Risk-adjusted returns ranking

---

## 📦 Data Structures

### Strategy Block
```typescript
interface StrategyBlock {
  id: string;
  type: 'condition' | 'action' | 'logic' | 'risk' | 'execution';
  config: {
    // Condition examples
    metric?: 'price' | 'volume' | 'rsi' | 'macd' | 'custom';
    operator?: '>' | '<' | '==' | 'between' | 'custom';
    value?: number | string;
    
    // Action examples
    action?: 'buy' | 'sell' | 'swap' | 'bridge' | 'alert';
    amount?: number;
    token?: string;
    
    // Execution examples
    when?: 'immediate' | 'scheduled' | 'triggered' | 'manual';
    schedule?: string; // cron expression
    
    // Risk examples
    stopLoss?: number;
    takeProfit?: number;
    maxSlippage?: number;
    positionSizeLimit?: number;
  };
  inputs: string[]; // IDs of previous blocks
  outputs: string[]; // IDs of next blocks
}

interface Strategy {
  id: string;
  name: string;
  description?: string;
  blocks: StrategyBlock[];
  riskControls: {
    maxLoss: number;
    maxDrawdown: number;
    dailyTradeLimit: number;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  backtestResults?: {
    pnl: number;
    pnlPercent: number;
    winRate: number;
    trades: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
}
```

---

## 🛠️ Implementation Priority

1. **Visual Strategy Builder UI** (Next)
   - Drag-drop block library
   - Block palette (conditions, actions, logic)
   - Canvas for strategy design
   - Preview & validation

2. **Strategy Engine** (Backend)
   - Block execution engine
   - Data binding (connect blocks)
   - Signal generation
   - Backtesting framework

3. **API Layer** (Parallel)
   - REST endpoints for market data
   - Swap/bridge execution
   - Strategy CRUD & deployment
   - WebSocket for real-time updates

4. **Integrations**
   - DEX connectors (Uniswap, Curve)
   - Bridge providers (Stargate, LayerZero)
   - Price feeds (Pyth, Chainlink)
   - Flash loan protocols (Aave, dYdX)

---

## 📚 Related Docs

- [AAVE Flash Loans](AAVE_FLASH_LOANS_LIVE.md)
- [Additional Strategies (Python)](additional_strategies.py)
- [OKEDI Quick Reference](OKEDI_DASHBOARD_QUICK_REFERENCE.md)

---

**Last Updated:** January 29, 2026  
**Status:** 🚧 In Development (visual builder phase)
