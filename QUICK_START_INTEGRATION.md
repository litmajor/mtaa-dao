# 🚀 Complete Integration: Quick-Start Guide

## What's Ready to Use

```
✅ Backend Server (Port 5000)
   ├─ DexScreener API endpoints
   ├─ Symbol Universe integration
   ├─ Response caching
   └─ Rate limiting

✅ Symbol Universe
   ├─ 31+ token categories
   ├─ Real DexScreener discovery
   ├─ CCXT integration (reuses Liquidity Shard data)
   ├─ Risk scoring by category
   └─ Safer alternative suggestions

✅ NURU Upgrades
   ├─ Portfolio composition analysis
   ├─ Safer alternative recommendations
   └─ Wired to symbolUniverse

✅ KWETU Upgrades
   ├─ Execution risk scoring
   ├─ Category-based constraints
   └─ Composition analysis
```

---

## 🏃 Getting Started (5 minutes)

### Step 1: Start Backend Server (Port 5000)

```bash
cd e:\repos\litmajor\mtaa-dao\backend

# Install dependencies (if not already installed)
pip install fastapi uvicorn slowapi httpx python-dotenv

# Start server
python main.py
```

**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:5000
INFO:     Application startup complete
============================================================
MTAA DAO Backend Server Started
Port: 5000
Services:
  ✓ DexScreener API Integration
  ✓ Symbol Universe Discovery
  ✓ Response Caching (5 min TTL)
  ✓ Rate Limiting
============================================================
```

### Step 2: Verify Backend is Running

```bash
# Check health
curl http://localhost:5000/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2026-02-20T12:30:45.123456",
  "services": {
    "dexscreener": "ready",
    "symbol_universe": "ready"
  }
}
```

### Step 3: Start Frontend (Port 5173 or 3000)

```bash
cd e:\repos\litmajor\mtaa-dao

# Install and start frontend
npm install
npm run dev
```

### Step 4: Type-Check Everything

```bash
# Check TypeScript compilation
npx tsc --noEmit server/core/symbol_universe.ts
npx tsc --noEmit server/core/nuru/index.ts
npx tsc --noEmit server/core/kwetu/index.ts

# Should show: no errors
```

---

## 🔗 Testing the Integration

### Test 1: Backend DexScreener Endpoint

```bash
# Search for trending pairs on Ethereum
curl "http://localhost:5000/api/dex/trending-pairs?chain=ethereum&min_liquidity=100000&limit=10"

# Expected: List of 10 trending Ethereum pairs with metadata
```

### Test 2: Symbol Universe Discovery

```typescript
// server/core/symbol_universe.ts
const result = await symbolUniverse.syncWithProtocols();
console.log(result);
// Expected: { newAssetsDiscovered: 150, assetsUpdated: 85 }
```

### Test 3: NURU Portfolio Analysis

```typescript
// Using NURU
const portfolioAnalysis = await nuru.analyzePortfolioComposition([
  'ETH', 'USDC', 'UNI', 'SHIB', 'stETH'
]);

console.log(portfolioAnalysis);
// Expected:
// {
//   composition: [
//     { category: 'l1', count: 1, avgRisk: 5, symbols: ['ETH'] },
//     { category: 'stablecoin', count: 1, avgRisk: 5, symbols: ['USDC'] },
//     ...
//   ],
//   aggregateMetrics: {
//     totalAssets: 5,
//     avgRisk: 24,
//     riskProfile: 'moderate'
//   },
//   recommendations: [...]
// }
```

### Test 4: KWETU Execution Risk Scoring

```typescript
// Using KWETU
const executionScore = await kwetu.scoreExecutionRisk('SHIB', 1000000);

console.log(executionScore);
// Expected:
// {
//   categoricalRisk: 70,
//   riskLevel: 'critical',
//   multiplier: 1.70,
//   recommendation: 'SHIB is critical risk (70/100). Recommend limiting exposure to <5% of treasury.'
// }
```

### Test 5: KWETU Get Recommendations

```typescript
// Using KWETU
const recommendations = await kwetu.getExecutionRecommendations('SHIB');

console.log(recommendations);
// Expected:
// {
//   current: {
//     symbol: 'SHIB',
//     category: 'meme_token',
//     tier: 'tier_3',
//     riskScore: 70
//   },
//   alternatives: [
//     { symbol: 'UNI', category: 'governance_token', riskScore: 10 },
//     { symbol: 'AAVE', category: 'governance_token', riskScore: 10 },
//     ...
//   ],
//   recommendation: 'SHIB is high-risk. Consider these safer alternatives instead: UNI, AAVE, COMP'
// }
```

---

## 📊 Data Flow: Putting It All Together

### Scenario: User asks to swap SHIB to ETH

```
1. User Message: "I want to swap my SHIB tokens to ETH but I'm worried about gas costs"
   ↓
2. MORIO receives and routes to NURU
   ↓
3. NURU.understand(message)
   ├─ Intent: swap_request
   ├─ Entities: [SHIB, ETH]
   ├─ marketContext: { volatility, liquidity, risk }
   └─ assetInfo: [{SHIB: meme_token, tier_3}, {ETH: l1, tier_1}]
   ↓
4. MORIO prepares execution request to KWETU
   ├─ Symbol: SHIB
   ├─ Amount: user's balance
   └─ Target: ETH
   ↓
5. KWETU.planExecution()
   ├─ scoreExecutionRisk('SHIB') → 70 (critical)
   ├─ Check if SHIB risk > threshold (yes)
   ├─ Call analyzeComposition(['SHIB']) → 70% avg risk
   ├─ Get recommendations: suggest UNI, AAVE as alternatives
   └─ Return ExecutionPlan:
       {
         status: 'ready_with_warnings',
         warnings: [
           'SHIB is meme_token (70/100 risk)',
           'High slippage expected',
           'Consider swapping via: ETH → stETH → USDC → UNI (safer path)'
         ],
         alternatives: [UNI, COMP, AAVE]
       }
   ↓
6. MORIO presents to user:
   "Your SHIB is high-risk. I recommend:
    Option 1: Execute SHIB → ETH swap (risky, high slippage)
    Option 2: Swap SHIB → UNI instead (safer, DEX governance token)
    Option 3: Add 10% stablecoins (USDC) for stability
    
    Which would you prefer?"
   ↓
7. User chooses option, KWETU executes with appropriate constraints
```

---

## 🎯 Key Integration Points

### NURU Calls:
```typescript
import { symbolUniverse } from '../symbol_universe';

// Get asset context
const asset = symbolUniverse.getAsset('ETH');
const deployments = symbolUniverse.getDeployments('ETH');

// Portfolio analysis
const composition = await nuru.analyzePortfolioComposition(['ETH', 'USDC', 'UNI']);

// Risk mitigation
const safer = await nuru.findSaferAlternative('SHIB', 'defi_token');
```

### KWETU Calls:
```typescript
import { symbolUniverse } from '../symbol_universe';

// Score execution risk
const risk = await kwetu.scoreExecutionRisk('SHIB', 1000);

// Get alternatives
const recommendations = await kwetu.getExecutionRecommendations('SHIB');

// Analyze portfolio composition
const composition = await kwetu.analyzeComposition(['ETH', 'USDC']);
```

### Symbol Universe Direct Calls:
```typescript
import { symbolUniverse } from '../symbol_universe';

// Category operations
const riskScore = symbolUniverse.getCategoryRiskScore('meme_token'); // 70
const multiplier = symbolUniverse.getCategoryRiskMultiplier('meme_token'); // 1.70
const isSafe = symbolUniverse.isSafeCategory('l1'); // true

// Portfolio analysis
const composition = symbolUniverse.analyzeCategoryComposition(['ETH', 'SHIB']);

// Safer alternatives
const alternatives = symbolUniverse.findSaferAlternativesInCategory('SHIB', 'defi_token');

// Discovery
const sync = await symbolUniverse.syncWithProtocols();
```

---

## 🐛 Debugging

### Backend API not responding?

```bash
# Check if running on port 5000
netstat -ano | findstr :5000

# Kill if stuck
taskkill /PID <PID> /F

# Restart
python main.py
```

### Symbol Universe not finding tokens?

```typescript
// Check if sync completed
const stats = symbolUniverse.getStats();
console.log(stats);
// If totalAssets still 20, sync hasn't run yet

// Manually trigger sync
const result = await symbolUniverse.syncWithProtocols();
console.log(result); // Should show > 0 newAssetsDiscovered
```

### KWETU execution risk too high?

```typescript
// Check what category the token is
const asset = symbolUniverse.getAsset('TOKEN');
console.log(asset.category);

// Check category risk
const risk = symbolUniverse.getCategoryRiskScore(asset.category);
console.log(risk);

// If > 45, it's high risk
if (risk > 45) {
  // Use safer alternatives
  const alts = symbolUniverse.findSaferAlternativesInCategory('TOKEN', 'defi_token');
}
```

---

## 📋 Checklist: Verify Everything Works

- [ ] Backend server starts on port 5000
- [ ] `/health` endpoint returns `healthy`
- [ ] `/api/dex/trending-pairs` returns pair data
- [ ] Symbol Universe discovers 1000+ tokens
- [ ] NURU analyzes portfolio composition
- [ ] KWETU scores execution risk
- [ ] Safer alternatives suggested for high-risk tokens
- [ ] TypeScript compilation passes (`tsc --noEmit`)

---

## 🔧 Next Steps

### Immediate:
1. Start backend server (port 5000)
2. Verify endpoints respond
3. Test with Symbol Universe discovery
4. Monitor logs for errors

### Short-term:
1. Add database persistence (PostgreSQL)
2. Implement batch execution for performance
3. Add WebSocket notifications for real-time updates
4. Set up monitoring/alerting

### Medium-term:
1. Cache optimization with LRU eviction
2. Parallel discovery from multiple sources
3. Circuit breaker for cascading failures
4. Full test coverage (unit + integration)

---

## 📞 Support

If you encounter issues:

1. **Backend not starting?**
   - Check Python version: `python --version` (needs 3.8+)
   - Install deps: `pip install -r requirements.txt`

2. **Endpoints returning errors?**
   - Check DexScreener API status
   - Verify internet connection
   - Check rate limits (60/min for search)

3. **Symbol Universe not discovering?**
   - Run `symbolUniverse.syncWithProtocols()` manually
   - Check backend `/health` endpoint
   - Verify response caching isn't blocking updates

4. **Risk scoring seems off?**
   - Verify asset exists in registry: `symbolUniverse.getAsset(symbol)`
   - Check category: `asset.category`
   - Verify risk score: `getCategoryRiskScore(category)`

---

**Everything is now ready to use! Start the backend server and test the integration.** 🚀
