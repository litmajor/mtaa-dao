# Yuki API Integration Guide

## 🚀 Quick Start: Wire Real APIs to Components

This guide shows how to replace mock data in Yuki components with real API calls.

---

## 1. CEX Manager - Replace Mock Exchanges

**File**: `client/src/components/trading/CexManager.tsx`

### Before (Mock Data)
```typescript
const [exchanges, setExchanges] = useState<Exchange[]>(MOCK_EXCHANGES);
```

### After (Real API)
```typescript
import { getConnectedExchanges, getExchangeBalances, getExchangePositions } from '../api/yukiApi';

const [exchanges, setExchanges] = useState<Exchange[]>([]);

useEffect(() => {
  async function loadExchanges() {
    try {
      const exData = await getConnectedExchanges();
      
      // Fetch balances and positions for each exchange
      const enriched = await Promise.all(
        exData.map(async (ex) => ({
          ...ex,
          balances: await getExchangeBalances(ex.id),
          positions: await getExchangePositions(ex.id),
        }))
      );
      
      setExchanges(enriched);
    } catch (error) {
      console.error('Failed to load exchanges:', error);
    }
  }
  
  loadExchanges();
}, []);
```

---

## 2. Strategy Marketplace - Replace Mock Strategies

**File**: `client/src/components/trading/StrategyMarketplace.tsx`

### Before (Mock Data)
```typescript
const [strategies, setStrategies] = useState(MOCK_STRATEGIES);
```

### After (Real API)
```typescript
import { getMarketplaceStrategies, copyMarketplaceStrategy } from '../api/yukiApi';

const [strategies, setStrategies] = useState([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  async function loadStrategies() {
    setLoading(true);
    try {
      const data = await getMarketplaceStrategies(filterBy, sortBy, search);
      setStrategies(data);
    } catch (error) {
      console.error('Failed to load strategies:', error);
    } finally {
      setLoading(false);
    }
  }
  
  loadStrategies();
}, [filterBy, sortBy, search]);

// Update handleCopyStrategy
const handleCopyStrategy = async (strategyId: string) => {
  try {
    const result = await copyMarketplaceStrategy(strategyId);
    // Show success message
    alert('Strategy copied! Upgrade to Amara for deeper education');
  } catch (error) {
    alert('Failed to copy strategy: ' + error);
  }
};
```

---

## 3. Yuki Dashboard - Replace Mock Market Data

**File**: `client/src/components/trading/YukiDashboard.tsx`

### Replace OverviewSection Market Stats
```typescript
import { getMarketPrices, getMarketOpportunities } from '../api/yukiApi';

const OverviewSection = () => {
  const [prices, setPrices] = useState<any>(null);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadMarketData() {
      setLoading(true);
      try {
        const [priceData, oppData] = await Promise.all([
          getMarketPrices(['ETH', 'USDC', 'BTC']),
          getMarketOpportunities(),
        ]);
        setPrices(priceData);
        setOpportunities(oppData);
      } catch (error) {
        console.error('Failed to load market data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadMarketData();
    const interval = setInterval(loadMarketData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>Loading market data...</div>;

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {prices && Object.entries(prices).map(([symbol, priceData]: any) => (
          <div key={symbol} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">💹</span>
              <span className={priceData.change >= 0 ? 'text-green-400' : 'text-red-400'}>
                {priceData.change >= 0 ? '+' : ''}{priceData.change.toFixed(1)}%
              </span>
            </div>
            <p className="text-slate-400 text-sm">{symbol}</p>
            <p className="text-xl font-bold mt-1">${priceData.usd.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Opportunities */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-bold mb-4">Trading Opportunities</h3>
        <div className="space-y-3">
          {opportunities.map((opp, i) => (
            <div key={i} className="bg-slate-700 rounded p-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{opp.type}</p>
                <p className="text-xs text-slate-400">{opp.pairs}</p>
              </div>
              <div className="text-right">
                <p className="text-green-400 font-bold">{opp.profit}%</p>
                <p className="text-xs text-slate-400">Gas: ${opp.gas}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

---

## 4. Add WebSocket Real-Time Updates

### Setup WebSocket Connection
```typescript
import { connectToYukiWebSocket, subscribeToFills, subscribeToPortfolio, subscribeToAlerts } from '../api/yukiApi';

function YukiDashboard() {
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const ws = connectToYukiWebSocket(token);

    ws.onopen = () => {
      // Subscribe to real-time feeds
      subscribeToFills(ws);
      subscribeToPortfolio(ws);
      subscribeToAlerts(ws);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'price-update') {
        setPrices(prev => ({ ...prev, [message.symbol]: message.price }));
      }
      
      if (message.type === 'position-update') {
        updatePositions(message);
      }
      
      if (message.type === 'alert') {
        showAlert(message);
      }
      
      if (message.type === 'fill') {
        handleFill(message);
      }
    };

    return () => ws.close();
  }, []);

  // ... rest of component
}
```

---

## 5. Swap Execution with Smart Order Routing

**File**: `client/src/components/trading/YukiDashboard.tsx` - ExecuteSection

### Before (Mock)
```typescript
<button className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-semibold">
  Preview & Swap
</button>
```

### After (Real API with Routing)
```typescript
import { previewSwap, executeSwap, compareOrderRoutes, executeOptimalRoute } from '../api/yukiApi';

function ExecuteSection() {
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState('USDC');
  const [amount, setAmount] = useState(0);
  const [preview, setPreview] = useState(null);
  const [routes, setRoutes] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePreview = async () => {
    setLoading(true);
    try {
      const data = await previewSwap(fromToken, toToken, amount);
      setPreview(data);
      
      // Also get routing comparison
      const routingData = await compareOrderRoutes(`${fromToken}/${toToken}`, amount, 'buy');
      setRoutes(routingData);
    } catch (error) {
      alert('Preview failed: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteOnBestRoute = async () => {
    if (!routes?.bestRoute) return;
    
    setLoading(true);
    try {
      const result = await executeOptimalRoute(`${fromToken}/${toToken}`, amount, routes.bestRoute.venue);
      alert(`Swap executed on ${routes.bestRoute.venue}! Saved $${(routes.routes[0].totalCost - routes.bestRoute.totalCost).toFixed(2)}`);
    } catch (error) {
      alert('Execution failed: ' + error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Swap form */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-bold mb-4">🔄 Quick Swap</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400">From</label>
            <select 
              value={fromToken}
              onChange={(e) => setFromToken(e.target.value)}
              className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
            >
              <option>ETH</option>
              <option>USDC</option>
              <option>DAI</option>
              <option>BTC</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-400">To</label>
            <select 
              value={toToken}
              onChange={(e) => setToToken(e.target.value)}
              className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
            >
              <option>USDC</option>
              <option>ETH</option>
              <option>DAI</option>
              <option>BTC</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-400">Amount</label>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
            />
          </div>
          <button 
            onClick={handlePreview}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-semibold disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Preview'}
          </button>
        </div>
      </div>

      {/* Preview + Routing */}
      {preview && routes && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-bold mb-4">📊 Best Route Comparison</h3>
          <div className="space-y-2">
            {routes.routes.map((route: any, i: number) => (
              <div key={i} className="flex justify-between items-center p-3 bg-slate-700 rounded">
                <span>{route.venue}</span>
                <span className={route.venue === routes.bestRoute.venue ? 'text-green-400 font-bold' : 'text-slate-400'}>
                  ${route.totalCost.toLocaleString()} {route.venue === routes.bestRoute.venue && '✓'}
                </span>
              </div>
            ))}
          </div>
          <button 
            onClick={handleExecuteOnBestRoute}
            disabled={loading}
            className="w-full mt-4 bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-semibold disabled:opacity-50"
          >
            {loading ? 'Executing...' : `Execute Best Route (Save $${(routes.routes[0].totalCost - routes.bestRoute.totalCost).toFixed(2)})`}
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 6. Strategy Builder - Save & Deploy

**File**: `client/src/components/trading/VisualStrategyBuilder.tsx`

### Add Deploy Function
```typescript
import { createStrategy, deployStrategy } from '../api/yukiApi';

function VisualStrategyBuilder() {
  const handleDeploy = async () => {
    try {
      setLoading(true);
      
      // Create strategy via API
      const created = await createStrategy(
        strategyName,
        strategyDescription,
        blocks
      );

      // Deploy it
      const deployed = await deployStrategy(created.id);
      
      alert(`Strategy deployed! ID: ${deployed.id}`);
    } catch (error) {
      alert('Failed to deploy: ' + error);
    } finally {
      setLoading(false);
    }
  };

  return (
    // ... existing JSX ...
    <button 
      onClick={handleDeploy}
      disabled={loading}
      className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
    >
      {loading ? 'Deploying...' : 'Deploy Strategy'}
    </button>
  );
}
```

---

## 7. Environment Setup

### .env.local
```bash
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_WS_URL=ws://localhost:3000/api
```

### .env.production
```bash
REACT_APP_API_URL=https://api.mtaa.io/api
REACT_APP_WS_URL=wss://api.mtaa.io/api
```

---

## 8. Error Handling Pattern

```typescript
async function withErrorHandling<T>(
  fn: () => Promise<T>,
  errorMessage: string = 'Operation failed'
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    console.error(errorMessage, error);
    // TODO: Show toast/notification
    return null;
  }
}

// Usage
const result = await withErrorHandling(
  () => copyMarketplaceStrategy(strategyId),
  'Failed to copy strategy'
);
```

---

## 9. Loading States & Skeletons

```typescript
function SkeletonCard() {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 animate-pulse">
      <div className="h-4 bg-slate-700 rounded mb-2"></div>
      <div className="h-8 bg-slate-700 rounded"></div>
    </div>
  );
}

// Use in components
{loading ? (
  <SkeletonCard />
) : (
  <div>Real content</div>
)}
```

---

## 10. Testing API Calls

### Use Thunder Client or Postman

```bash
# Get marketplace strategies
GET http://localhost:3000/api/yuki/marketplace/strategies

# Create strategy
POST http://localhost:3000/api/yuki/strategies
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "ETH Mean Reversion",
  "description": "Sell on RSI > 70, buy on RSI < 30",
  "blocks": []
}

# Connect exchange
POST http://localhost:3000/api/yuki/exchanges
Content-Type: application/json
Authorization: Bearer <token>

{
  "exchangeName": "Kraken",
  "apiKey": "...",
  "apiSecret": "..."
}

# Compare routes
POST http://localhost:3000/api/yuki/routing/compare
Content-Type: application/json
Authorization: Bearer <token>

{
  "symbol": "ETH/USDC",
  "amount": 10,
  "side": "buy"
}
```

---

## ✅ Implementation Checklist

- [ ] Replace MOCK_EXCHANGES with getConnectedExchanges()
- [ ] Replace MOCK_STRATEGIES with getMarketplaceStrategies()
- [ ] Wire market prices from getMarketPrices()
- [ ] Wire opportunities from getMarketOpportunities()
- [ ] Add WebSocket connection for real-time updates
- [ ] Implement swap preview with smart order routing
- [ ] Add strategy creation and deployment
- [ ] Add error handling and loading states
- [ ] Test all API endpoints with real backend
- [ ] Add authentication headers to all requests
- [ ] Performance optimize with memoization

---

**Status**: 🚀 Ready for Integration  
**Last Updated**: January 29, 2026
