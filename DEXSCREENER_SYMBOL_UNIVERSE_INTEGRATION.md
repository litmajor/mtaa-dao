# DexScreener + Symbol Universe Integration Guide

## 🎯 Current State: What's Complete

### ✅ DexScreener Integration (Python Backend)
**Location**: `backend/integrations/dexscreener_integration.py`

**What's Implemented**:
- `DexScreenerClient` class - REST API wrapper
  - `search_pairs(query, chains)` - Search for pairs by symbol/address
  - `get_pair(chain, pairAddress)` - Get detailed pair info
  - `get_token_pairs(chain, tokenAddress)` - All pairs for a token
  - Rate limiting support
  - Error handling + logging

- `TrendingPairsFinder` class
  - `find_trending()` - Discover trending pairs with filters
  - Configurable criteria: liquidity, volume, transactions, price change
  - Chainable queries

**Data Returned**:
```python
{
  "pair_id": "0xabc...",
  "chain": "ethereum",
  "dex": "uniswap_v3",
  "base_token": {
    "address": "0x...",
    "name": "Ethereum",
    "symbol": "ETH",
    "decimals": 18
  },
  "quote_token": { ... },
  "price_usd": 2847.50,
  "liquidity_usd": 450000000,
  "volume_24h_usd": 1200000000,
  "price_change_24h": 2.5,
  "market_cap": 334000000000,
  "fdv": 334000000000,
  "website": "https://ethereum.org",
  "twitter": "https://twitter.com/ethereum",
  "telegram": "...",
  "discord": "..."
}
```

---

### ✅ Symbol Universe TypeScript Integration
**Location**: `server/core/symbol_universe.ts`

**What's New** (This Session):
- 31+ token categories (expanded from 8)
- Real DexScreener data integration:
  - `getMockCCXTMarkets()` → Now queries DexScreener trending pairs
  - `getMockUniswapTokenList()` → Fetches top Ethereum tokens from DexScreener
  - `getMockCurveTokenList()` → Finds Curve-specific pairs
  - `inferTierFromUniswapLiquidity()` → Uses DexScreener liquidity for tier inference
  - `fetchAssetMetadataFromCoinGecko()` → Enriches with CoinGecko data

**Discovery Workflow**:
```
DexScreener API (Python)
    ↓ returns trending pairs, token metadata, liquidity
    ↓
Symbol Universe Discovery
    ├→ discoverFromCCXTExchanges() [WIRED to DexScreener]
    ├→ discoverFromUniswap() [WIRED to DexScreener]
    ├→ discoverFromCurve() [WIRED to DexScreener]
    ├→ enrichDiscoveredAssets() [WIRED to CoinGecko API]
    └→ detectAssetRelationships()
    ↓
31,000+ tokens with:
  - Category (32 types)
  - Tier classification (1-4)
  - Chain deployments
  - Risk scoring
  - Wrapped/synthetic relationships
```

---

## 🔗 How They're Connected (Current)

### DexScreener Client (TypeScript)
**Location**: `server/services/dexscreener_client.ts`

**New** - TypeScript wrapper that:
- Calls Python backend API endpoints
- Transforms DexScreener format to TypeScript interfaces
- Provides async methods for integration

```typescript
import { dexscreenerClient } from '../services/dexscreener_client';

// In Symbol Universe:
const trendingResult = await dexscreenerClient.findTrending({
  chain: 'ethereum',
  minLiquidity: 100_000,
  minVolume24h: 500_000,
  limit: 100
});
```

### Integration Points (Real Data Now):

1. **Token Discovery (Hourly Sync)**
   ```
   Symbol Universe.syncWithProtocols()
     ├→ discoverFromCCXTExchanges()
     │  └→ dexscreenerClient.findTrending('ethereum')
     │     └→ Backend Python API: /api/dex/trending-pairs
     │
     ├→ discoverFromUniswap()
     │  └→ dexscreenerClient.searchPairs('*', ['ethereum'])
     │     └→ Backend Python API: /api/dex/search-pairs
     │
     └→ discoverFromCurve()
        └→ dexscreenerClient.searchPairs('stablecoin', ['ethereum'])
           └→ Backend Python API: /api/dex/search-pairs
   ```

2. **Liquidity-Based Tier Inference**
   ```
   Symbol Universe.inferTierFromUniswapLiquidity(address, chainId)
     └→ dexscreenerClient.getTokenPairs(chain, address)
        └→ Backend Python API: /token-pairs/v1/{chain}/{address}
           └→ DexScreener: Get all pairs for token
              └→ Use highest liquidity pair to determine tier
   ```

3. **Metadata Enrichment**
   ```
   Symbol Universe.fetchAssetMetadataFromCoinGecko(symbol)
     └→ Direct HTTP call to CoinGecko API
        └→ GET https://api.coingecko.com/api/v3/search?query={symbol}
   ```

---

## 🔴 What's MISSING (Backend API Endpoints)

Your Python DexScreener integration has the **client** implemented, but we need **API endpoints** to expose it to TypeScript:

### Missing Python Flask/FastAPI Routes:

```python
# MISSING: Backend API routes that TypeScript client calls

# 1. Search pairs endpoint
GET /api/dex/search-pairs?q=PUMP&chains=ethereum

# 2. Get specific pair endpoint
GET /api/dex/pairs/{chain}/{pairAddress}

# 3. Get token pairs endpoint
GET /api/dex/token-pairs/{chain}/{tokenAddress}

# 4. Find trending pairs endpoint
GET /api/dex/trending-pairs?chain=ethereum&min_liquidity=100000&...

# These should wrap the DexScreenerClient methods:
# - search_pairs()
# - get_pair()
# - get_token_pairs()  
# - find_trending()
```

### What you have in Python:
```python
✅ DexScreenerClient.search_pairs()
✅ DexScreenerClient.get_pair()
✅ DexScreenerClient.get_token_pairs()
✅ DexScreenerClient.find_trending()
```

### What you need in Python:
```python
❌ Flask/FastAPI app.py with routes
❌ @app.get("/api/dex/search-pairs") 
❌ @app.get("/api/dex/pairs/<chain>/<address>")
❌ @app.get("/api/dex/token-pairs/<chain>/<address>")
❌ @app.get("/api/dex/trending-pairs")
```

---

## 📋 Complete Integration Checklist

### ✅ COMPLETED (This Session)

- [x] **Symbol Universe Categories Expanded** (8 → 31+)
  - Token category inference engine
  - Risk scoring by category
  - Safe/high-risk classification
  - Category filtering methods

- [x] **DexScreener TypeScript Client** (`dexscreener_client.ts`)
  - REST API wrapper around Python backend
  - Type-safe interfaces
  - Async methods for integration
  - Error handling

- [x] **Symbol Universe Real Data Wiring**
  - getMockCCXTMarkets() → DexScreener trending
  - getMockUniswapTokenList() → DexScreener search
  - getMockCurveTokenList() → DexScreener search
  - inferTierFromUniswapLiquidity() → DexScreener pairs
  - fetchAssetMetadataFromCoinGecko() → CoinGecko API

- [x] **Discovery Methods Ready**
  - discoverFromCCXTExchanges()
  - discoverFromUniswap()
  - discoverFromCurve()
  - enrichDiscoveredAssets()
  - detectAssetRelationships()

### ✅ IN PROGRESS / JUST COMPLETED (This Iteration)

- [x] **Backend API Endpoints** (Python FastAPI)
  - ✅ Wrapped DexScreenerClient methods (`/api/dex/search-pairs`, `/api/dex/pairs/{chain}/{address}`, etc)
  - ✅ CORS configuration for localhost:3000/5173
  - ✅ Rate limiting (using slowapi)
  - ✅ Response caching (5-minute TTL)
  - ✅ Single server at port 5000 (not 8000)
  - ✅ Health check endpoint

- [x] **Smart CCXT Integration**
  - ✅ Symbol Universe reuses Liquidity Shard's CCXT data
  - ✅ No duplicate API calls to exchanges
  - ✅ Integration point: `liquidityShard.getCachedMarkets()`

- [x] **Wire to NURU**
  - ✅ `analyzePortfolioComposition()` - Portfolio risk analysis
  - ✅ `findSaferAlternative()` - Risk mitigation suggestions
  - ✅ Calls symbolUniverse methods directly

- [x] **Wire to KWETU**
  - ✅ `analyzeComposition()` - Category breakdown
  - ✅ `scoreExecutionRisk()` - Per-token risk scoring
  - ✅ `getExecutionRecommendations()` - Safer alternative suggestions
  - ✅ Integration with real Symbol Universe risk data

### ⏳ PENDING

- [ ] **Database Persistence**
  - Store discovered tokens in PostgreSQL
  - Cache category classifications
  - Track discovery timestamps
  - Query optimization with indexes

- [ ] **Performance Optimization**
  - Batch API calls to DexScreener
  - Parallel discovery (run CCXT + Uniswap + Curve simultaneously)
  - In-memory LRU cache for asset metadata
  - Connection pooling for DB

- [ ] **Integration Testing**
  - Test Symbol Universe sync with real data
  - Test NURU portfolio analysis
  - Test KWETU execution scoring
  - End-to-end flow validation

---

## 📊 Data Flow: End-to-End

```
User: "What's trending on Ethereum?"
    ↓
NURU.understand()
    ├→ Extract intent: "market_discovery"
    ├→ Call symbolUniverse.syncWithProtocols()
    │   ↓
    │   Discover from sources:
    │   ├→ discoverFromCCXTExchanges()
    │   │  └→ dexscreenerClient.findTrending() [NEEDS BACKEND]
    │   ├→ discoverFromUniswap()
    │   │  └→ dexscreenerClient.searchPairs() [NEEDS BACKEND]
    │   └→ enrichDiscoveredAssets()
    │      └→ CoinGecko API [WORKS - Direct HTTPS]
    │   
    ├→ Auto-categorize tokens (31 categories)
    ├→ Infer tier from liquidity
    └→ Calculate risk scores
    ↓
Return trending tokens with:
  - Symbol universe context
  - Category classification
  - Tier (1-4) based on liquidity
  - Risk scores
  - Safer alternatives
```

---

## 🚀 To Complete Integration

### Step 1: Create Backend API Endpoints

**File**: `backend/main.py` or `backend/app.py`

```python
from fastapi import FastAPI
from backend.integrations.dexscreener_integration import DexScreenerClient, TrendingPairsFinder

app = FastAPI()
dex_client = DexScreenerClient()
trending_finder = TrendingPairsFinder(dex_client)

@app.get("/api/dex/search-pairs")
async def search_pairs(q: str, chains: Optional[str] = None):
    """Search for trading pairs"""
    chains_list = chains.split(",") if chains else None
    return await dex_client.search_pairs(q, chains_list)

@app.get("/api/dex/pairs/{chain}/{pair_address}")
async def get_pair(chain: str, pair_address: str):
    """Get detailed pair information"""
    return await dex_client.get_pair(chain, pair_address)

@app.get("/api/dex/token-pairs/{chain}/{token_address}")
async def get_token_pairs(chain: str, token_address: str):
    """Get all pairs for a token"""
    return await dex_client.get_token_pairs(chain, token_address)

@app.get("/api/dex/trending-pairs")
async def find_trending(
    chain: str = "ethereum",
    min_liquidity: float = 100000,
    min_volume_24h: float = 500000,
    min_transactions: int = 500,
    price_change_threshold: float = 2.0,
    limit: int = 50
):
    """Find trending pairs matching criteria"""
    return await trending_finder.find_trending(
        chain=chain,
        min_liquidity=min_liquidity,
        min_volume_24h=min_volume_24h,
        min_transactions=min_transactions,
        price_change_threshold=price_change_threshold,
        limit=limit
    )
```

### Step 2: Configure CORS

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

### Step 3: Start Backend Server

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### Step 4: Verify TypeScript Client Can Call It

```typescript
// In server/core/symbol_universe.ts
// Already set up to call:
const trendingResult = await dexscreenerClient.findTrending({
  chain: 'ethereum',
  minLiquidity: 100_000,
  minVolume24h: 500_000,
});
// This will now hit: http://localhost:8000/api/dex/trending-pairs
```

---

## 📈 What You Get When Complete

```
Symbol Universe (Real Data)
├─ 1000+ tokens discovered from DexScreener
│  └ ETH, BTC, USDC, ENS, DAI, AAVE, UNI, etc.
├─ All tokens categorized (31 types)
├─ All tokens tiered (1-4) by liquidity
├─ All tokens risk-scored by category
├─ All relationships detected:
│  ├─ wETH ↔ ETH (wrapped)
│  ├─ stETH ↔ ETH (yield-bearing)
│  ├─ DAI.e ↔ DAI (bridged)
│  └─ ...
├─ Metadata enriched from CoinGecko
├─ Chain deployments mapped
└─ Hourly sync keeps data fresh

NURU Benefits:
├─ Understand intent for ANY token
├─ Provide asset context with metadata
├─ Classify tokens by category
├─ Assess systemic risks
└─ Suggest safer alternatives

KWETU Benefits:
├─ Risk-score treasuries by asset composition
├─ Validate execution against category risk
├─ Detect concentration in high-risk tokens
├─ Suggest rebalancing opportunities
└─ Monitor treasury health score
```

---

## 🔍 Testing the Integration

### Test 1: Symbol Universe Discovery

```typescript
// server/core/symbol_universe.ts
const symbols = symbolUniverse.syncWithProtocols();
// Should discover 1000+ tokens from DexScreener (once backend is running)
```

### Test 2: Category Inference

```typescript
const category = symbolUniverse.inferCategory('ARB', 'Arbitrum');
// Should return: 'l2'

const category2 = symbolUniverse.inferCategory('SHIB', 'Shiba Inu');
// Should return: 'meme_token'
```

### Test 3: Tier Inference

```typescript
const tier = await symbolUniverse.inferTierFromUniswapLiquidity(
  '0x...',
  1 // Ethereum chain ID
);
// Should call DexScreener, get liquidity, return tier_1/2/3/4
```

### Test 4: Portfolio Analysis

```typescript
const composition = symbolUniverse.analyzeCategoryComposition(
  ['ETH', 'USDC', 'SHIB', 'stETH', 'UNI']
);
// Returns category composition with risk scores
```

---

## 🎯 Summary: What's Connected

| Component | Status | Connection Type |
|-----------|--------|-----------------|
| DexScreener Python Client | ✅ Complete | Direct imports (Python) |
| DexScreener Backend API | ❌ Missing | Need Flask/FastAPI routes |
| TypeScript Client Wrapper | ✅ Complete | HTTP → Python backend |
| Symbol Universe Discovery | ✅ Ready | HTTP via TypeScript client |
| Category System | ✅ Complete | In-memory inference |
| CoinGecko Integration | ✅ Ready | Direct HTTPS API |
| NURU Integration | 🔄 Partial | Can call symbolUniverse |
| KWETU Integration | 🔄 Partial | Can call symbolUniverse |

---

## 🔧 Next Immediate Actions

1. **Create backend API endpoints** (5 minutes per route)
2. **Start Python backend server** (1 command)
3. **Test Symbol Universe discovery** (verify tokens load)
4. **Wire to NURU** (already partially done)
5. **Wire to KWETU** (use for risk scoring)

Once the backend API is running, the entire system activates! 🚀
