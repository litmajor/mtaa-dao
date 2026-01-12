# CCXT Integration - Quick Reference Guide

## One-Page Summary

**What**: Add CEX (centralized exchange) trading to your DeFi wallet using CCXT library
**Why**: Access 6-8x more liquidity, better prices for users, new revenue stream
**How**: 4-phase integration (foundation → frontend → smart routing → real-time)
**Cost**: $15K-20K development + $20-50/month infrastructure
**Timeline**: 6-8 weeks (2 senior developers)
**Risk**: 🟠 MEDIUM (start with read-only, scale to trading)

---

## Current vs. Proposed

### Current Architecture (DeFi Only)
```
User Interface
    ↓
ExchangeRateWidget (BROKEN - mock data)
TokenSwapModal (DEX only, 0.65 hardcoded)
BalanceAggregatorWidget (on-chain only)
TransactionMonitor (blockchain only)
    ↓
Backend Services
    ├─ exchangeRateService (1 source, forex only)
    ├─ tokenService (3 sources, crypto only)
    └─ ❌ MISSING: CEX integration
    ↓
Data Sources
    ├─ exchangerate-api.com (forex)
    ├─ CoinGecko (aggregate prices)
    ├─ DeFiLlama (DEX liquidity)
    └─ Blockchain RPC (on-chain)
```

### Proposed Architecture (CeDeFi)
```
User Interface
    ├─ ExchangeRateWidget (FIXED - real rates + CEX prices)
    ├─ TokenSwapModal (DEX vs CEX comparison + smart router)
    ├─ BalanceAggregatorWidget (on-chain + CEX balances)
    ├─ TransactionMonitor (blockchain + CEX orders merged)
    ├─ CEXPriceComparison (new - side-by-side rates)
    ├─ CEXOrderModal (new - place CEX orders)
    ├─ ArbitrageDetector (new - find spread opportunities)
    └─ CEXBalancePanel (new - sync CEX accounts)
    ↓
Backend Services
    ├─ exchangeRateService (expanded coverage)
    ├─ tokenService (unchanged)
    ├─ orderRouter (NEW - compare DEX vs CEX)
    ├─ ccxtService (NEW - unified CEX interface)
    └─ arbitrageService (NEW - auto-detect spreads)
    ↓
Data Sources
    ├─ exchangerate-api.com (forex)
    ├─ CoinGecko (aggregate)
    ├─ DeFiLlama (DEX)
    ├─ Blockchain RPC (on-chain)
    └─ ✅ CCXT → Binance, Coinbase, Kraken, Gate.io, OKX
```

---

## Phase Breakdown

### Phase 1: CCXT Foundation (40 hours)
```
✅ Initialize CCXT service
✅ Connect 5 exchanges (Binance, Coinbase, Kraken, Gate.io, OKX)
✅ Implement price fetching
✅ Add API endpoints for prices & OHLCV
✅ Implement order validation & basic trading
⏭️ Result: Read-only price comparison API ready
```

**Deliverables**:
- `server/services/ccxtService.ts` (500 lines)
- `server/routes/exchange.ts` (200 lines)
- Database tables for CEX orders & balances
- Error handling & rate limiting

**Testing**:
```bash
curl http://localhost:3000/api/exchanges/prices?symbol=CELO
# Returns: {"binance": {bid: 0.650, ask: 0.651}, ...}
```

---

### Phase 2: Frontend CEX UI (50 hours)
```
✅ Create CEXPriceComparison component
✅ Create CEXOrderModal component
✅ Create CEXBalancePanel component
✅ Enhance TransactionMonitor with Exchange tab
✅ Create ArbitrageDetector widget
⏭️ Result: Full CEX trading UI ready
```

**Components Created**:
- `CEXPriceComparison.tsx` (250 lines)
- `CEXOrderModal.tsx` (400 lines)
- `CEXBalancePanel.tsx` (300 lines)
- `ArbitrageDetector.tsx` (250 lines)
- Enhanced `TransactionMonitor.tsx`

**UI Features**:
- Real-time price comparison (5 exchanges)
- Live order book from CCXT
- Fee breakdown by exchange
- Arbitrage opportunity alerts
- One-click execution

---

### Phase 3: Smart Order Router (35 hours)
```
✅ Compare DEX vs CEX prices
✅ Calculate total costs (price + slippage + fees + gas)
✅ Recommend best venue
✅ Split orders between venues if needed
✅ Add persistent limit orders
⏭️ Result: Production-ready execution engine
```

**Services**:
- `server/services/orderRouter.ts` (400 lines)
- Smart routing algorithm (DEX vs CEX)
- Order splitting logic
- Limit order persistence

**Examples**:
```
User wants: Buy 10,000 CELO

Smart Router Analysis:
├─ All DEX: $6,800 (incl. slippage & gas)
├─ All CEX (Binance): $6,700 (better)
├─ Split (5K DEX + 5K CEX): $6,650 (BEST)
└─ Recommendation: Split order, save $150

One-click execution handles both venues atomically
```

---

### Phase 4: Real-Time WebSocket (25 hours)
```
✅ Implement WebSocket price streaming
✅ Add real-time order updates
✅ Enable real-time arbitrage alerts
✅ Update frontend with live data
⏭️ Result: Full real-time CeDeFi platform
```

**Infrastructure**:
- `server/websocket/priceStream.ts` (200 lines)
- `client/hooks/useLiveExchangePrices.ts` (150 lines)
- Real-time price updates (500ms)
- Real-time order fill notifications

---

## Component Enhancement Checklist

### TokenSwapModal
```
CURRENT:
├─ From: cUSD
├─ To: CELO
├─ Rate: 0.65 (hardcoded)
├─ Venue: DEX only
└─ Order type: Market only

ENHANCED:
├─ From: cUSD
├─ To: CELO
├─ Rates shown:
│  ├─ DEX: 0.649
│  ├─ Binance: 0.651 ⭐ BEST
│  ├─ Coinbase: 0.648
│  ├─ Kraken: 0.652
│  └─ Spread range: $0.003
├─ Venue: User selects (or smart router recommends)
├─ Order types: Market, Limit, Stop
└─ Fee breakdown: Shows exact cost per venue
```

**Code Changes** (~100 lines):
```tsx
// Add CEX price fetching
const { cexPrices } = useCEXPrices(fromToken, toToken);
const { dexPrice } = useDEXPrice(fromToken, toToken);

// Add price comparison UI
<PriceComparison dex={dexPrice} cex={cexPrices} />

// Add venue selector
<VenueSelector 
  options={['DEX', 'Binance', 'Coinbase', 'Kraken']}
  recommended="Binance"
/>

// Add order type selector
<OrderTypeSelector options={['Market', 'Limit', 'Stop']} />
```

---

### BalanceAggregatorWidget
```
CURRENT TABS:
├─ Overview
├─ Wallet (on-chain)
├─ Pools (on-chain)
├─ Vaults (on-chain)
└─ Staking (on-chain)

ENHANCED TABS:
├─ Overview (+ CEX balances in totals)
├─ Wallet
├─ Pools
├─ Vaults
├─ Staking
└─ Exchanges ✨ NEW
   ├─ Binance: $1,234.56
   ├─ Coinbase: $456.78
   ├─ Kraken: $789.12
   ├─ Quick Deposit/Withdraw
   └─ Last synced: 2m ago
```

**Code Changes** (~50 lines):
```tsx
// Add Exchanges tab
<TabsContent value="exchanges">
  <CEXBalancePanel 
    exchanges={data.exchanges}
    onSync={refetch}
  />
</TabsContent>

// Update Overview to include CEX
const totalWithCEX = onChainTotal + cexTotal;
```

---

### TransactionMonitor
```
CURRENT TABS:
├─ Blockchain transactions
└─ Status tracking

ENHANCED TABS:
├─ Blockchain
│  ├─ Send: 100 cUSD (confirming 8/12)
│  └─ Swap: cUSD→CELO (confirmed)
├─ Exchanges ✨ NEW
│  ├─ Buy: 100 CELO on Binance (filled @ $0.651)
│  └─ Sell: 50 USDC on Coinbase (pending)
└─ All (merged)
   ├─ Buy 100 CELO (Binance - filled)
   ├─ Send 100 cUSD (confirming)
   ├─ Swap cUSD→CELO (confirmed)
   └─ Sell 50 USDC (Coinbase - pending)
```

**Code Changes** (~80 lines):
```tsx
// Add Exchanges tab
<TabsContent value="exchanges">
  <ExchangeOrderList orders={exchangeOrders} />
</TabsContent>

// Add unified timeline
<TabsContent value="all">
  <UnifiedOrderTimeline 
    blockchainTxns={txns}
    exchangeOrders={exchangeOrders}
  />
</TabsContent>
```

---

## Database Schema Additions

```sql
-- API Key Storage (encrypted)
CREATE TABLE exchange_credentials (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  exchange VARCHAR(50),                    -- 'binance', 'coinbase', etc
  api_key VARCHAR(255),                   -- encrypted
  api_secret VARCHAR(255),                -- encrypted
  passphrase VARCHAR(255),                -- encrypted (for Kraken)
  ip_whitelist TEXT,                      -- JSON array of IPs
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Orders from CEX
CREATE TABLE exchange_orders (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  exchange VARCHAR(50),
  order_id VARCHAR(255) UNIQUE,
  symbol VARCHAR(20),                     -- 'CELO/USDC'
  side VARCHAR(10),                       -- 'buy', 'sell'
  order_type VARCHAR(20),                 -- 'market', 'limit'
  amount DECIMAL(18,8),
  price DECIMAL(18,8),
  fee DECIMAL(18,8),
  status VARCHAR(20),                     -- 'pending', 'filled', 'canceled'
  filled_amount DECIMAL(18,8),
  filled_price DECIMAL(18,8),
  filled_at TIMESTAMP,
  created_at TIMESTAMP,
  expires_at TIMESTAMP
);

-- CEX Balance Snapshots
CREATE TABLE exchange_balances (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  exchange VARCHAR(50),
  asset VARCHAR(20),                      -- 'CELO', 'USDC', etc
  free DECIMAL(18,8),                     -- Available to trade
  used DECIMAL(18,8),                     -- In open orders
  total DECIMAL(18,8),                    -- free + used
  usd_value DECIMAL(18,2),
  updated_at TIMESTAMP
);

-- Arbitrage Tracking
CREATE TABLE arbitrage_opportunities (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20),                     -- 'CELO/USDC'
  buy_exchange VARCHAR(50),
  sell_exchange VARCHAR(50),
  buy_price DECIMAL(18,8),
  sell_price DECIMAL(18,8),
  spread_pct DECIMAL(5,2),
  potential_profit DECIMAL(18,2),
  created_at TIMESTAMP,
  INDEX (symbol, created_at)
);
```

---

## API Reference

### Price Endpoints

```bash
# Get prices from all exchanges
GET /api/exchanges/prices?symbol=CELO&exchanges=binance,coinbase,kraken

Response:
{
  "symbol": "CELO/USDC",
  "timestamp": 1673000000,
  "prices": {
    "binance": {
      "bid": 0.6500,
      "ask": 0.6510,
      "last": 0.6505,
      "volume": 1234567.89
    },
    "coinbase": {
      "bid": 0.6485,
      "ask": 0.6495,
      "last": 0.6490,
      "volume": 567890.12
    },
    ...
  },
  "spread_analysis": {
    "tightest_spread": "binance_coinbase",
    "spread_pct": 0.15
  }
}
```

### OHLCV (Candle Data)

```bash
# Get 24 hourly candles
GET /api/exchanges/ohlcv?symbol=CELO&timeframe=1h&limit=24

Response:
{
  "symbol": "CELO/USDC",
  "timeframe": "1h",
  "data": [
    [1672996800000, 0.6400, 0.6550, 0.6350, 0.6500, 456123],  // [ts, o, h, l, c, vol]
    [1673000400000, 0.6500, 0.6600, 0.6490, 0.6580, 567890],
    ...
  ]
}
```

### Order Endpoints

```bash
# Place market order
POST /api/exchanges/order
{
  "exchange": "binance",
  "symbol": "CELO/USDC",
  "side": "buy",
  "amount": 100,
  "type": "market"
}

Response:
{
  "orderId": "123456789",
  "symbol": "CELO/USDC",
  "side": "buy",
  "amount": 100,
  "status": "filled",
  "filled": 100,
  "average": 0.6505,
  "fee": 0.065,
  "cost": 65.05
}

# Check order status
GET /api/exchanges/order-status?exchange=binance&orderId=123456789

Response:
{
  "orderId": "123456789",
  "status": "filled",
  "filled": 100,
  "average": 0.6505,
  "fee": 0.065,
  "timestamp": 1673000000
}

# Cancel order
POST /api/exchanges/cancel-order
{
  "exchange": "binance",
  "orderId": "123456789"
}
```

### WebSocket Events

```javascript
// Connect
ws = new WebSocket('ws://localhost:3000/ws/prices');

// Subscribe to prices
ws.send(JSON.stringify({
  action: 'subscribe',
  symbols: ['CELO', 'USDC'],
  exchanges: ['binance', 'coinbase']
}));

// Receive price updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // {
  //   type: 'price',
  //   symbol: 'CELO',
  //   exchange: 'binance',
  //   bid: 0.6500,
  //   ask: 0.6510,
  //   timestamp: 1673000000
  // }
};
```

---

## Implementation Priorities

### High Priority (Must Have)
1. ✅ CCXT initialization (Phase 1)
2. ✅ Multi-exchange price API (Phase 1)
3. ✅ CEX order placement & tracking (Phase 1)
4. ✅ Price comparison UI (Phase 2)
5. ✅ Smart order router (Phase 3)
6. ✅ Secure credential storage (Phase 1)

### Medium Priority (Should Have)
7. WebSocket real-time prices (Phase 4)
8. Arbitrage detection (Phase 4)
9. Limit order support (Phase 3)
10. CEX balance sync (Phase 2)

### Low Priority (Nice to Have)
11. Automated arbitrage execution
12. Advanced portfolio rebalancing
13. Tax reporting export
14. Social portfolio sharing

---

## Security Checklist

```
BEFORE LAUNCH:
├─ [ ] API keys encrypted at rest (AES-256)
├─ [ ] API keys encrypted in transit (TLS 1.3)
├─ [ ] Rate limiting on order endpoints
├─ [ ] IP whitelist on exchange accounts
├─ [ ] 2FA enforcement for key management
├─ [ ] Audit log of all key access
├─ [ ] Automatic key rotation policy
├─ [ ] Secrets not in code (use .env)
├─ [ ] Database backups encrypted
├─ [ ] Order validation (amount, price)
├─ [ ] Slippage protection on market orders
├─ [ ] Warning: Users control own accounts
├─ [ ] Terms of Service updated
├─ [ ] Privacy Policy updated
├─ [ ] Disaster recovery plan tested
└─ [ ] Security audit by 3rd party
```

---

## Monitoring & Alerting

```
HEALTH CHECKS (Every 1 minute):
├─ Exchange API availability
├─ CCXT library errors
├─ Price staleness (>5 min old?)
├─ WebSocket connection status
└─ Order execution latency

ALERTS (When triggered):
├─ Exchange API down 3+ minutes
├─ Price feed stale >10 minutes
├─ Order failure rate >5%
├─ Rate limit approaching
├─ WebSocket disconnects >5 times/hour
└─ Unusual withdrawal activity
```

---

## Rollback Plan

```
If issues found in production:

PHASE 1 (Read-only prices):
├─ Disable CEX price endpoints
├─ Revert to aggregate prices only
└─ Users don't lose funds

PHASE 2 (Frontend UI):
├─ Hide CEX price comparison
├─ Show DEX prices only
└─ Users don't lose funds

PHASE 3 (Trading enabled):
├─ Disable CEX order placement
├─ Cancel all pending orders
├─ Withdraw user balances automatically
└─ CRITICAL - Execute immediately

Complete rollback: ~15 minutes
Data recovery: ~1 hour
```

---

## FAQ

### Q: What if CCXT has a bug?
A: CCXT is used by thousands of bots and traders. It's battle-tested. Plus, we're using multiple exchanges as fallback.

### Q: What if an exchange goes down?
A: Other exchanges stay up. Users can trade elsewhere. We show warnings about unavailable exchanges.

### Q: What if users lose money?
A: Clear terms of service stating user assumes risk. Consider insurance for covered scenarios. Audit trails show execution details.

### Q: How do we store API keys securely?
A: AES-256 encryption at rest. TLS 1.3 in transit. Users shouldn't share keys anyway. Encourage API key rotation.

### Q: Can we automate arbitrage?
A: Yes, Phase 4+ includes automated arbitrage with profit thresholds and risk limits.

### Q: What about regulatory compliance?
A: Country restrictions, KYC integration, tax reporting tools. Legal review required.

### Q: How much will this cost users?
A: Trading fees come from exchanges (0.01-0.6%). We could take 0.01% commission for smart routing.

---

## Next Steps

1. **Approve** this proposal (1 day)
2. **Allocate** 2 senior developers (1 day)
3. **Setup** repositories & infrastructure (2 days)
4. **Start Phase 1** (2 weeks)
5. **Beta test** with 100 users (1 week)
6. **Launch Phase 1-3** to production (1 week)
7. **Monitor** Phase 4 improvements (ongoing)

**Total time to basic production: 6 weeks**
**Total time to full feature set: 8 weeks**

---

**Document Status**: Ready for engineering review
**Last Updated**: January 10, 2026
**Prepared By**: Architecture Analysis Team
