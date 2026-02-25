# Data Integration Blockers & Questions

Before we wire up Phase 1, we need to resolve these blockers. Each one can completely change how we implement.

---

## 🚨 BLOCKER #1: DEX Liquidity Query Method

**Problem:** `dexIntegrationService.ts` is execution-focused (swap execution), not data-focused.

**Current Situation:**
```typescript
class DEXIntegrationService {
  async getSwapQuote(swap: SwapRequest): Promise<SwapQuote>
  async executeSwap(swap: SwapRequest): Promise<SwapResult>
  async getLiquidityPool(protocol: string, pair: string): Promise<PoolData>  // ← Does this exist?
}
```

**Action Required:**
1. Check if `getLiquidityPool()` method exists
2. If NOT, how do we query pool liquidity without executing swaps?
3. Options:
   - Option A: Call `getSwapQuote()` with small test amount (e.g., 0.001 ETH), extract slippage
   - Option B: Query pool contract directly via ethers.js
   - Option C: Use external DEX API (1inch, 0x Protocol)

**Question:** Which method is currently available?

---

## 🚨 BLOCKER #2: Historical OHLCV Candle Storage

**Problem:** Indicators need 200 candles of data. Where does this come from?

**Current Situation:**
```typescript
// CCXT can fetch candles:
async fetchOHLCV(exchange: string, symbol: string, timeframe: string, limit?: number)
  : Promise<OHLCV[]>

// But where do we STORE them?
// - Real database? (PostgreSQL, MongoDB?)
// - In-memory cache? (Redis, Node-cache?)
// - Fetch on-demand each time? (Slow!)
```

**Action Required:**
1. Determine storage location (database vs cache)
2. What's the retention period? (7 days? 30 days? 90 days?)
3. Which timeframe is primary? (1-hour? 4-hour? Daily?)
4. How often refresh? (Real-time? 5min? 1hour?)

**Question:** Is there existing OHLCV storage in the platform? Where?

---

## 🚨 BLOCKER #3: Volatility Calculation Method

**Problem:** PriceOracle doesn't provide volatility directly.

**Current Situation:**
```typescript
// PriceOracle gives us:
{
  priceUsd: 45000,
  priceChange24h: 1200,
  // ... but NO volatility metric
}

// We need volatility for:
// - Regime detection
// - Risk adjustment
// - Confidence scoring
// - Bollinger Bands Width
```

**Three Options:**
1. **ATR from Indicators.ts** 
   - Needs high/low/close candles
   - Reliable, industry standard
   - Cost: 50ms calculation time

2. **Standard Deviation of Returns**
   - Needs historical closes
   - Simpler than ATR
   - Cost: Minimal

3. **Request from PriceOracle extension**
   - Check if PriceOracle can provide volatility metric
   - Might already calculate it

**Question:** Which method should we use?

---

## 🚨 BLOCKER #4: Portfolio Service Location

**Problem:** Can't find where user holdings are stored.

**Current Situation:**
```typescript
// Referenced in assetStateEngine but not implemented:
private portfolioService: any;

async getUserContext(userId: string, symbol: string) {
  const portfolio = await this.portfolioService.getHoldings(userId);
  // But where is portfolioService defined?
}
```

**Action Required:**
1. Find the portfolio/wallet service (search for "holdings" or "portfolio")
2. Understand data structure:
   - Is it real wallet integration?
   - Simulated holdings in database?
   - User account balance tracking?
3. Get method signatures

**Question:** Where is user portfolio data stored and accessed?

---

## 🚨 BLOCKER #5: Morio Agent Signal Generation

**Problem:** Can't find the exact method to call for AI signals.

**Current Situation:**
```typescript
// Referenced in assetStateEngine:
private morioAgents: any;

async getAISignal(derivedMetrics: any, userContext: any) {
  // How do we call this?
  // const signal = await this.morioAgents.generateSignal(...)?
  // const signal = await this.morioAgents.KAIZEN.signal(...)?
  // const signal = await this.morioAgents.signal(...)?
}
```

**Action Required:**
1. Find Morio agent service file
2. Understand personality structure (KAIZEN? SCRY? LUMEN?)
3. Get method signatures
4. Understand input/output format

**Question:** What's the exact method to call? And which agent personality?

---

## ✅ RESOLVED: Clear Path Forward

These are NOT blockers—we know how to handle them:

### ✅ Price Oracle
- **Status:** Clear interface
- **Method:** `getPrice(symbol)` → PriceData
- **Integration:** Straightforward

### ✅ CCXT (CEX Data)
- **Status:** Clear interface
- **Methods:** `fetchOrderBook()`, `getTickerFromExchange()`, `fetchOHLCV()`
- **Integration:** Parallel requests, straightforward

### ✅ Arbitrage Detection
- **Status:** Clear interface
- **Method:** `findArbitrageOpportunities(symbol, exchanges)`
- **Integration:** Direct call

### ✅ Market Analytics
- **Status:** Clear interface
- **Methods:** `analyzeSpreadTrends()`, `analyzeMarketMicrostructure()`
- **Integration:** Direct call with caching

### ✅ Indicators Library
- **Status:** Complete, no integration needed
- **Usage:** Direct function calls
- **Input:** OHLCV arrays

---

## 📊 Impact Analysis: How Each Blocker Affects Timeline

| Blocker | Impact | Timeline if Blocked | Workaround Latency |
|---------|--------|-------------------|-------------------|
| **DEX Liquidity Query** | HIGH—blocks DEX layer completely | Adds 2-3 hours research | Query via getSwapQuote: +100ms per pool |
| **OHLCV Storage** | MEDIUM—blocks technical indicators realtime | Adds 1-2 hours architecture | Fetch on-demand from CCXT: +200ms per request |
| **Volatility Calc** | LOW—has multiple solutions | Adds 30min | Calculate from ATR: +50ms overhead |
| **Portfolio Service** | MEDIUM—blocks Tier 2 enrichment | Adds 1 hour | Skip for Phase 1, add in Phase 1B |
| **Morio Integration** | MEDIUM—blocks Tier 3 enrichment | Adds 1 hour | Skip for Phase 1, add in Phase 1B |

---

## 🎯 Recommended Approach: 2-Phase Unblock

### Phase A: Core (Non-Blocked)
Start with these while unblocking others:
1. ✅ Price Oracle integration
2. ✅ CCXT CEX integration
3. ✅ Arbitrage Detection integration
4. ✅ Market Analytics integration
5. ⏳ Indicators waiting on OHLCV decision

### Phase B: Dependent Features
Can be done in parallel while Phase A integrates:
1. 🔍 Locate and test DEX liquidity query
2. 🔍 Locate and test portfolio service
3. 🔍 Locate and test Morio agent signal
4. 🔍 Finalize volatility calculation method

### Phase C: Wire Remaining Layers
Once Phase B blockers resolved:
1. Wire DEX data layer
2. Wire Tier 2 (user portfolio context)
3. Wire Tier 3 (AI insight generation)

---

## 🔍 Quick Investigation Tasks (You Can Do Now)

If you want to unblock these right now:

### Task 1: Find OHLCV Storage
```bash
# Search for where OHLCV candles are stored
grep -r "fetchOHLCV\|OHLCV\|candle.*{" server/ --include="*.ts" | grep -v assetStateEngine

# Look for: Redis, database schemas, cache patterns
```

### Task 2: Find Portfolio Service
```bash
# Search for holdings, portfolio, wallet references
grep -r "getHoldings\|portfolio\|wallet" server/services --include="*.ts" | head -20

# Look for the actual implementation
find server -name "*portfolio*" -o -name "*wallet*" -o -name "*holding*"
```

### Task 3: Find Morio/AI Service
```bash
# Search for Morio, agents, signal generation
grep -r "morio\|KAIZEN\|generateSignal" server/ --include="*.ts" | head -20

# Look for agent definitions
find server -name "*morio*" -o -name "*agent*"
```

### Task 4: Test DEX Liquidity Query
```typescript
// In a test file, try:
const dexService = require('./dexIntegrationService');
const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(dexService));

// What methods are available?
console.log(methods);
// Look for: getLiquidity, getPool, queryPool, getSlippage
```

---

## 💡 Low-Risk Path Forward

If blockers can't be resolved immediately:

### Phase 1A: MVP (Always Works)
```typescript
// This ALWAYS works with existing code:
const rawLayers = {
  price: await priceOracle.getPrice(symbol),
  cex: await ccxtService.getTickerMultiExchange(symbol),
  arbitrage: await arbitrageDetector.findOpportunities(symbol),
  dex: null,  // SKIP for now
  technicals: null,  // SKIP until OHLCV resolved
};

const derived = {
  confidence: await marketAnalytics.analyzeSpreadTrends(symbol),
  regime: null,  // Can't calculate without technicals
  crossExchange: derive_from_arbitrage(arbitrage),
};

// Result: 70% complete, all data real
```

This gets you:
- ✅ Real prices
- ✅ Real CEX data
- ✅ Real arbitrage detection
- ✅ Real spread analysis
- ✅ 70% of Phase 1

### Phase 1B: Full Feature (After Unblocking)
Then wire the remaining 30% once blockers are resolved.

---

## Next Actions

**You:**
1. Review `DATA_SOURCES_DEEP_DIVE.md` (you're reading it)
2. Run the investigation tasks above
3. Find answers to the 5 blocker questions

**Me (Once You Provide Answers):**
1. Create precise integration code
2. Handle data transformations
3. Set up caching strategies
4. Wire everything together

**Expected Timeline:**
- Investigation: 30 minutes
- Unblocking (if needed): 1-2 hours
- Full Wire-up: 2-3 hours
- Testing: 2 hours
- **Total: 1 day to complete Phase 1A**

---

**Ready to investigate? Or should I start with the MVP path (70% that definitely works)?**
