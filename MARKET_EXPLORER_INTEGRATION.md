# Market Explorer Integration Guide

## Overview

The Market Explorer feature has been implemented with three major components:

1. **Backend Service**: `backend/services/market_aggregator.py` - Price aggregation logic
2. **Backend API**: `backend/routes/markets.py` - FastAPI endpoints  
3. **Frontend Hook**: `frontend/src/hooks/useMarketData.ts` - React hook for data fetching
4. **Frontend Component**: `frontend/src/components/dashboard/MarketExplorer.tsx` - UI component

## Files Created

### Backend

#### `/backend/services/market_aggregator.py`
Service layer for aggregating market prices from multiple sources.

**Key Classes:**
- `MarketAggregator` - Main service class

**Key Methods:**
- `get_cex_prices(pair: str)` - Fetch prices from 8 CEX (Binance, Coinbase, Kraken, Gate.io, OKX, Bybit, Kucoin, Bitget)
- `get_dex_prices(pair: str)` - Fetch prices from DEX sources (Uniswap, Sushiswap, Curve, etc.)
- `calculate_aggregate_price(sources: List[Dict])` - Volume-weighted average price (VWAP)
- `get_pair_market_data(pair: str)` - Orchestrate full price fetching

**Features:**
- Parallel async fetching from multiple exchanges
- Minimum liquidity filtering ($100K default)
- Volume-weighted average price calculation
- CEX/DEX separation and comparison

#### `/backend/routes/markets.py`
FastAPI routes for market data endpoints.

**Endpoints:**
- `GET /api/yuki/markets/search?q=BTC/USDT` - Quick pair search
- `GET /api/yuki/markets/pairs/{pair}/detail` - All sources with detail
- `GET /api/yuki/markets/ohlcv/{pair}?timeframe=1h&limit=100` - Historical candles
- `GET /api/yuki/markets/trending?limit=10&period=24h` - Trending pairs
- `GET /api/yuki/markets/pairs/{pair}/arbitrage?size_usd=10000` - Arbitrage detection
- `GET /api/yuki/markets/pairs/{pair}/stats?period=24h` - Comprehensive stats

**Response Format:**
```json
{
  "status": "success",
  "pair": "BTC/USDT",
  "weighted_price": 42501.23,
  "best_bid": 42501.00,
  "best_ask": 42502.50,
  "spread_pct": 0.0035,
  "cex_price": 42502.80,
  "dex_price": 42500.00,
  "cex_liquidity": 12200000,
  "dex_liquidity": 2950000,
  "total_liquidity": 15150000,
  "source_count": 10,
  "cex_count": 8,
  "dex_count": 2,
  "cex_sources": [...],
  "dex_sources": [...],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Frontend

#### `/frontend/src/hooks/useMarketData.ts`
Custom React hook for market data operations.

**Exports:**
- `useMarketData()` - Hook returning market data and methods

**Returned Methods:**
- `searchPair(pair: string)` - Search for a trading pair
- `getDetailedData(pair: string)` - Get full market detail with all sources
- `getTrendingPairs(limit?: number)` - Get trending pairs
- `detectArbitrage(pair: string, sizeUsd?: number)` - Find arb opportunities
- `getOHLCV(pair: string, timeframe?: string, limit?: number)` - Get candle data
- `getPairStats(pair: string, period?: string)` - Get comprehensive stats

**State:**
- `marketData: MarketData | null` - Current pair data
- `sources: MarketSource[]` - All sources for current pair
- `loading: boolean` - Loading state
- `error: string | null` - Error message if any

#### `/frontend/src/components/dashboard/MarketExplorer.tsx`
React component for market exploration UI.

**Features:**
- Search input with pair autocomplete suggestions
- Recent searches history
- CEX/DEX/ALL filter buttons
- Two-tab display:
  - **Summary**: Aggregated price, CEX vs DEX comparison, action buttons
  - **All Sources**: Detailed table with all exchange data
- Responsive design with collapsible header
- Real-time loading states and error handling

**Props:** None (standalone component)

**Styling:** Tailwind CSS with dark theme support

## Integration Steps

### 1. Mount Backend Routes

In `backend/main.py`, add the market routes:

```python
# Add import at top
from routes import markets

# In your FastAPI app setup, add:
app.include_router(markets.router)
```

### 2. Add Component to Dashboard

In `frontend/src/components/dashboard/YukiDashboard.tsx`:

```typescript
// Add import
import { MarketExplorer } from './MarketExplorer';

// Add component in JSX after OpportunitiesSection:
<MarketExplorer />
```

### 3. Verify Dependencies

Ensure these packages are installed:

**Backend:**
```bash
pip install ccxt  # For CEX price fetching
pip install fastapi  # Already installed
pip install httpx  # For async HTTP requests
```

**Frontend:**
```bash
npm list lucide-react  # For icons (should be installed)
npm list react  # Should be installed
```

### 4. Test the Feature

**Backend Test:**
```bash
# Test service directly
python -c "
from backend.services.market_aggregator import MarketAggregator
import asyncio

async def test():
    agg = MarketAggregator()
    data = await agg.get_pair_market_data('BTC/USDT')
    print(data)

asyncio.run(test())
"

# Test API endpoint
curl "http://localhost:8000/api/yuki/markets/search?q=BTC/USDT"
```

**Frontend Test:**
1. Navigate to dashboard
2. Expand MARKET EXPLORER section
3. Type "BTC/USDT" in search
4. Click search or press Enter
5. Verify data loads and displays

## Data Flow

```
User Input (SearchInput)
    ↓
useMarketData.searchPair()
    ↓
/api/yuki/markets/search endpoint
    ↓
MarketAggregator.get_pair_market_data()
    ↓
Parallel CCXT + DexScreener fetches
    ↓
Volume-weighted aggregation
    ↓
JSON response with aggregated + source data
    ↓
MarketExplorer component renders
    ↓
Summary or Detail view
```

## Customization

### Change Minimum Liquidity Threshold

In `backend/services/market_aggregator.py`:
```python
MIN_LIQUIDITY_USD = 100000  # Change this value
```

### Add More CEX Sources

In `backend/services/market_aggregator.py`, modify `__init__` method to add exchanges:
```python
def __init__(self):
    # Initialize CEX exchanges
    self.binance = ccxt.binance()
    self.coinbase = ccxt.coinbase()
    self.kraken = ccxt.kraken()
    self.gatedio = ccxt.gatedio()
    self.okx = ccxt.okx()
    self.bybit = ccxt.bybit()
    self.kucoin = ccxt.kucoin()
    self.bitget = ccxt.bitget()
    # Add more exchanges here
    
    self.exchanges = {
        'binance': self.binance,
        # ... etc
    }
```

### Customize Price Weighting

In `backend/services/market_aggregator.py`, modify `calculate_aggregate_price()`:
```python
# Current: Volume-weighted
# Could change to: Liquidity-weighted, Equal-weighted, etc.
```

### Change Filter Colors

In `frontend/src/components/dashboard/MarketExplorer.tsx`, modify filter button styles:
```tsx
className={`...
  ${filter === f.value
    ? 'bg-blue-600 text-white'  // Active color
    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'  // Inactive color
  }`}
```

## Performance Considerations

1. **CEX Fetching**: Requests go to 5 exchanges in parallel (~200-500ms total)
2. **DEX Fetching**: Uses DexScreener API (~100-200ms)
3. **Caching**: Consider adding Redis caching for repeated requests
4. **Rate Limiting**: Implement rate limiting to avoid exchange throttling

## Error Handling

The component handles three error states:

1. **Network Error**: "Failed to fetch market data"
2. **Invalid Pair**: "Pair not found on any exchange"
3. **API Error**: Exchange-specific error message

All errors are displayed in red banner in the UI.

## Next Steps

1. ✅ Mount routes in backend
2. ✅ Add component to dashboard
3. ✅ Test with real data
4. Add watchlist functionality (save favorite pairs)
5. Add price alerts (notify when price hits target)
6. Add price charts (TradingView-like)
7. Add more trading pairs from market list

## Troubleshooting

**Issue: "Module not found" for market_aggregator**
- Ensure `backend/services/market_aggregator.py` exists
- Check Python path includes `backend/` directory

**Issue: Empty results when searching**
- Check internet connection
- Verify CCXT is installed: `pip list | grep ccxt`
- Check exchange API rate limits

**Issue: Component not rendering**
- Verify `useMarketData` hook is in `frontend/src/hooks/`
- Check Tailwind CSS classes are loaded
- Verify lucide-react icons are imported

**Issue: Slow response times**
- CCXT parallel requests can take 200-500ms
- Consider implementing caching
- Check exchange API rate limits
