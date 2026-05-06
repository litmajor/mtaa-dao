# CCXT Integration - Technical Implementation Guide

## File Structure & Creation Plan

```
server/
├─ services/
│  ├─ ccxtService.ts (NEW - 500 lines)
│  │  └─ Core CCXT aggregation logic
│  ├─ orderRouter.ts (NEW - 400 lines)
│  │  └─ Smart order routing (DEX vs CEX)
│  ├─ arbitrageService.ts (NEW - 250 lines)
│  │  └─ Arbitrage detection & tracking
│  └─ [EXISTING - no changes needed]
│     ├─ exchangeRateService.ts (update for new data)
│     ├─ tokenService.ts (unchanged)
│     └─ vaultService.ts (unchanged)
│
├─ routes/
│  ├─ exchange.ts (NEW - 200 lines)
│  │  └─ API endpoints for prices & orders
│  ├─ trades.ts (NEW - 150 lines)
│  │  └─ Smart routing endpoints
│  └─ [EXISTING]
│     ├─ wallet.ts (FIX: disconnect from mock data)
│     └─ index.ts (ADD new routes)
│
├─ websocket/
│  └─ priceStream.ts (NEW - 300 lines)
│     └─ WebSocket server for real-time prices
│
├─ middleware/
│  └─ ccxtAuth.ts (NEW - 100 lines)
│     └─ Authentication for CEX endpoints
│
└─ db/
   └─ migrations/ (NEW)
      └─ 001_add_cex_tables.sql (NEW)
         └─ Database schema for CEX data

client/
├─ components/wallet/
│  ├─ CEXPriceComparison.tsx (NEW - 250 lines)
│  ├─ CEXOrderModal.tsx (NEW - 400 lines)
│  ├─ CEXBalancePanel.tsx (NEW - 300 lines)
│  ├─ ArbitrageDetector.tsx (NEW - 250 lines)
│  ├─ TransactionMonitor.tsx (ENHANCE - add Exchange tab)
│  └─ [EXISTING - minimal changes]
│     ├─ TokenSwapModal.tsx (add CEX option)
│     ├─ BalanceAggregatorWidget.tsx (add Exchanges tab)
│     └─ ExchangeRateWidget.tsx (add exchange selection)
│
└─ hooks/
   ├─ useCEXPrices.ts (NEW - 50 lines)
   ├─ useCEXOrders.ts (NEW - 80 lines)
   ├─ useLiveExchangePrices.ts (NEW - 100 lines)
   └─ useOrderRouter.ts (NEW - 60 lines)
```

---

## Step-by-Step Implementation

### Step 1: Install Dependencies (15 minutes)

```bash
# Backend dependencies
npm install ccxt ws crypto-js dotenv
npm install --save-dev @types/node @types/ccxt

# Frontend already has: @tanstack/react-query, zustand, recharts

# Verify installation
npm list ccxt ws crypto-js
```

### Step 2: Setup Environment Variables (15 minutes)

Create `.env` file:
```env
# Exchange API Keys (get from exchange settings)
BINANCE_API_KEY=your_key_here
BINANCE_API_SECRET=your_secret_here

COINBASE_API_KEY=your_key_here
COINBASE_API_SECRET=your_secret_here

KRAKEN_API_KEY=your_key_here
KRAKEN_API_SECRET=your_secret_here

GATEDIO_API_KEY=your_key_here
GATEDIO_API_SECRET=your_secret_here

OKX_API_KEY=your_key_here
OKX_API_SECRET=your_secret_here
OKX_PASSPHRASE=your_passphrase_here

# Configuration
CEX_PRICE_CACHE_TTL=30000
CEX_OHLCV_CACHE_TTL=300000
CEX_API_RATE_LIMIT_DELAY=100
CCXT_TIMEOUT=30000

# Database
DATABASE_URL=postgresql://...
```

### Step 3: Create CCXT Service (2-3 hours)

File: `server/services/ccxtService.ts`

```typescript
import ccxt from 'ccxt';
import NodeCache from 'node-cache';

interface CachedPrice {
  symbol: string;
  exchange: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  timestamp: number;
}

export class CCXTAggregator {
  private exchanges: Map<string, any> = new Map();
  private priceCache = new NodeCache({ stdTTL: 30 });
  private ohlcvCache = new NodeCache({ stdTTL: 300 });

  constructor() {
    this.initializeExchanges();
  }

  private initializeExchanges(): void {
    const exchangeList = ['binance', 'coinbase', 'kraken', 'gateio', 'okx'];

    exchangeList.forEach(name => {
      const ExchangeClass = ccxt[name as keyof typeof ccxt];
      if (ExchangeClass) {
        const exchange = new ExchangeClass({
          apiKey: process.env[`${name.toUpperCase()}_API_KEY`],
          secret: process.env[`${name.toUpperCase()}_API_SECRET`],
          password: process.env[`${name.toUpperCase()}_PASSPHRASE`],
          timeout: parseInt(process.env.CCXT_TIMEOUT || '30000'),
          enableRateLimit: true,
          rateLimit: parseInt(process.env.CEX_API_RATE_LIMIT_DELAY || '100')
        });
        this.exchanges.set(name, exchange);
      }
    });
  }

  /**
   * Fetch ticker (current price) from exchange
   */
  async getTickerFromExchange(
    exchange: string,
    symbol: string
  ): Promise<CachedPrice | null> {
    const cacheKey = `ticker:${exchange}:${symbol}`;
    const cached = this.priceCache.get<CachedPrice>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const ex = this.exchanges.get(exchange);
      if (!ex) {
        throw new Error(`Exchange ${exchange} not initialized`);
      }

      // Format symbol for CCXT (must be "BASE/QUOTE")
      const ccxtSymbol = this.formatSymbol(symbol);
      const ticker = await ex.fetchTicker(ccxtSymbol);

      const price: CachedPrice = {
        symbol: ccxtSymbol,
        exchange,
        bid: ticker['bid'] || 0,
        ask: ticker['ask'] || 0,
        last: ticker['last'] || 0,
        volume: ticker['quoteVolume'] || 0,
        timestamp: ticker['timestamp'] || Date.now()
      };

      this.priceCache.set(cacheKey, price);
      return price;
    } catch (error: any) {
      console.error(`Error fetching ${symbol} from ${exchange}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch OHLCV (candle) data from exchange
   */
  async getOHLCVFromExchange(
    exchange: string,
    symbol: string,
    timeframe: string = '1h',
    limit: number = 24
  ): Promise<any[] | null> {
    const cacheKey = `ohlcv:${exchange}:${symbol}:${timeframe}:${limit}`;
    const cached = this.ohlcvCache.get<any[]>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const ex = this.exchanges.get(exchange);
      if (!ex) {
        throw new Error(`Exchange ${exchange} not initialized`);
      }

      const ccxtSymbol = this.formatSymbol(symbol);
      const ohlcv = await ex.fetchOHLCV(ccxtSymbol, timeframe, undefined, limit);

      this.ohlcvCache.set(cacheKey, ohlcv);
      return ohlcv;
    } catch (error: any) {
      console.error(`Error fetching OHLCV for ${symbol} from ${exchange}:`, error.message);
      return null;
    }
  }

  /**
   * Aggregate prices from multiple exchanges
   */
  async getPricesFromMultipleExchanges(
    symbol: string,
    exchanges: string[] = ['binance', 'coinbase', 'kraken']
  ): Promise<Record<string, CachedPrice | null>> {
    const results: Record<string, CachedPrice | null> = {};

    // Fetch in parallel
    const promises = exchanges.map(ex => 
      this.getTickerFromExchange(ex, symbol).catch(() => null)
    );

    const prices = await Promise.all(promises);

    exchanges.forEach((ex, idx) => {
      results[ex] = prices[idx];
    });

    return results;
  }

  /**
   * Place market order
   */
  async placeMarketOrder(
    exchange: string,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number
  ): Promise<any> {
    const ex = this.exchanges.get(exchange);
    if (!ex) {
      throw new Error(`Exchange ${exchange} not initialized`);
    }

    try {
      const ccxtSymbol = this.formatSymbol(symbol);
      const order = await ex.createMarketOrder(ccxtSymbol, side, amount);

      return {
        success: true,
        orderId: order['id'],
        symbol: ccxtSymbol,
        side,
        amount,
        filled: order['filled'] || 0,
        average: order['average'] || 0,
        fee: order['fee']?.['cost'] || 0,
        cost: order['cost'] || 0,
        status: order['status'],
        timestamp: order['timestamp']
      };
    } catch (error: any) {
      throw new Error(`Failed to place order: ${error.message}`);
    }
  }

  /**
   * Place limit order
   */
  async placeLimitOrder(
    exchange: string,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    price: number
  ): Promise<any> {
    const ex = this.exchanges.get(exchange);
    if (!ex) {
      throw new Error(`Exchange ${exchange} not initialized`);
    }

    try {
      const ccxtSymbol = this.formatSymbol(symbol);
      const order = await ex.createLimitOrder(ccxtSymbol, side, amount, price);

      return {
        success: true,
        orderId: order['id'],
        symbol: ccxtSymbol,
        side,
        amount,
        price,
        filled: order['filled'] || 0,
        status: order['status'],
        timestamp: order['timestamp']
      };
    } catch (error: any) {
      throw new Error(`Failed to place limit order: ${error.message}`);
    }
  }

  /**
   * Check order status
   */
  async checkOrderStatus(
    exchange: string,
    orderId: string,
    symbol?: string
  ): Promise<any> {
    const ex = this.exchanges.get(exchange);
    if (!ex) {
      throw new Error(`Exchange ${exchange} not initialized`);
    }

    try {
      const order = await ex.fetchOrder(orderId, symbol);

      return {
        orderId: order['id'],
        symbol: order['symbol'],
        side: order['side'],
        amount: order['amount'],
        price: order['price'],
        filled: order['filled'],
        average: order['average'] || 0,
        fee: order['fee']?.['cost'] || 0,
        status: order['status'],
        timestamp: order['timestamp']
      };
    } catch (error: any) {
      throw new Error(`Failed to check order status: ${error.message}`);
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(
    exchange: string,
    orderId: string,
    symbol?: string
  ): Promise<boolean> {
    const ex = this.exchanges.get(exchange);
    if (!ex) {
      throw new Error(`Exchange ${exchange} not initialized`);
    }

    try {
      await ex.cancelOrder(orderId, symbol);
      return true;
    } catch (error: any) {
      throw new Error(`Failed to cancel order: ${error.message}`);
    }
  }

  /**
   * Get user balances from exchange
   */
  async getBalances(exchange: string): Promise<Record<string, any>> {
    const ex = this.exchanges.get(exchange);
    if (!ex) {
      throw new Error(`Exchange ${exchange} not initialized`);
    }

    if (!ex.apiKey || !ex.secret) {
      throw new Error(`No API credentials configured for ${exchange}`);
    }

    try {
      const balance = await ex.fetchBalance();
      return balance;
    } catch (error: any) {
      throw new Error(`Failed to fetch balance: ${error.message}`);
    }
  }

  /**
   * Helper: Format symbol for CCXT (e.g., "CELO" → "CELO/USDC")
   */
  private formatSymbol(symbol: string): string {
    if (symbol.includes('/')) {
      return symbol;
    }
    // Default to /USDC pair
    return `${symbol}/USDC`;
  }

  /**
   * Helper: Get market info from exchange
   */
  async getMarkets(exchange: string): Promise<any[]> {
    const ex = this.exchanges.get(exchange);
    if (!ex) {
      throw new Error(`Exchange ${exchange} not initialized`);
    }

    try {
      if (!ex.markets || !Object.keys(ex.markets).length) {
        await ex.loadMarkets();
      }
      return Object.values(ex.markets);
    } catch (error: any) {
      throw new Error(`Failed to load markets: ${error.message}`);
    }
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.priceCache.flushAll();
    this.ohlcvCache.flushAll();
  }
}

// Singleton instance
export const ccxtService = new CCXTAggregator();
```

### Step 4: Create Order Router Service (2-3 hours)

File: `server/services/orderRouter.ts`

```typescript
import { ccxtService } from './ccxtService';
import { dexAggregatorService } from './dexAggregator'; // Existing
import { tokenService } from './tokenService'; // Existing

interface OrderRoutingResult {
  recommendedVenue: 'dex' | 'cex';
  recommendedExchange?: string;
  dexPrice: number;
  dexSlippage: number;
  dexGasCost: number;
  dexTotalCost: number;
  
  cexPrices: Record<string, number>;
  cexFee: number;
  cexTotalCost: number;
  
  savings: number;
  savingsPercent: number;
  strategy: string;
}

export class OrderRouter {
  /**
   * Compare DEX vs CEX prices and recommend best venue
   */
  async routeOrder(
    symbol: string,
    amount: number,
    side: 'buy' | 'sell'
  ): Promise<OrderRoutingResult> {
    // Get DEX price
    const dexData = await dexAggregatorService.getAggregatedPrice(symbol, amount, side);
    
    // Get CEX prices
    const cexPrices = await ccxtService.getPricesFromMultipleExchanges(symbol, [
      'binance',
      'coinbase',
      'kraken'
    ]);

    // Calculate costs
    const dexTotalCost = dexData.price + dexData.slippage + dexData.gasCost;
    
    const cexCosts = Object.entries(cexPrices).reduce((acc, [exchange, priceData]) => {
      if (!priceData) return acc;
      
      const price = side === 'buy' ? priceData.ask : priceData.bid;
      const fee = price * amount * 0.001; // 0.1% fee example
      const totalCost = (price * amount) + fee;
      
      return {
        ...acc,
        [exchange]: {
          price,
          fee,
          totalCost
        }
      };
    }, {});

    // Find best CEX
    const bestCEX = Object.entries(cexCosts).reduce((best, [ex, costs]) => {
      if (!best || (costs as any).totalCost < best.totalCost) {
        return { exchange: ex, costs };
      }
      return best;
    }, null);

    // Determine recommendation
    let recommendedVenue: 'dex' | 'cex' = 'dex';
    let savings = 0;
    let strategy = '';

    if (bestCEX && bestCEX.costs.totalCost < dexTotalCost) {
      recommendedVenue = 'cex';
      savings = dexTotalCost - bestCEX.costs.totalCost;
      strategy = `Use ${bestCEX.exchange} (save $${savings.toFixed(2)})`;
    } else {
      savings = bestCEX ? bestCEX.costs.totalCost - dexTotalCost : 0;
      strategy = `Use DEX (save $${savings.toFixed(2)} vs best CEX)`;
    }

    return {
      recommendedVenue,
      recommendedExchange: bestCEX?.exchange,
      dexPrice: dexData.price,
      dexSlippage: dexData.slippage,
      dexGasCost: dexData.gasCost,
      dexTotalCost,
      cexPrices: Object.entries(cexCosts).reduce((acc, [ex, costs]) => ({
        ...acc,
        [ex]: (costs as any).price
      }), {}),
      cexFee: bestCEX?.costs.fee || 0,
      cexTotalCost: bestCEX?.costs.totalCost || Infinity,
      savings: Math.abs(savings),
      savingsPercent: (Math.abs(savings) / dexTotalCost) * 100,
      strategy
    };
  }

  /**
   * Execute order on recommended venue
   */
  async executeOptimalOrder(
    symbol: string,
    amount: number,
    side: 'buy' | 'sell',
    userPreferences: {
      venue?: 'dex' | 'cex';
      exchange?: string;
      maxSlippage?: number;
    } = {}
  ): Promise<any> {
    const routing = await this.routeOrder(symbol, amount, side);

    // Respect user preference if specified
    const venue = userPreferences.venue || routing.recommendedVenue;
    const exchange = userPreferences.exchange || routing.recommendedExchange;

    if (venue === 'cex' && exchange) {
      // Execute on CEX
      return await ccxtService.placeMarketOrder(exchange, symbol, side, amount);
    } else {
      // Execute on DEX
      return await dexAggregatorService.executeSwap(symbol, amount, side);
    }
  }
}

export const orderRouter = new OrderRouter();
```

### Step 5: Create API Endpoints (1-2 hours)

File: `server/routes/exchange.ts`

```typescript
import express from 'express';
import { ccxtService } from '../services/ccxtService';
import { orderRouter } from '../services/orderRouter';

const router = express.Router();

/**
 * GET /api/exchanges/prices
 * Get prices from multiple exchanges
 */
router.get('/prices', async (req, res) => {
  try {
    const { symbol, exchanges = 'binance,coinbase,kraken' } = req.query;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol required' });
    }

    const exchangeList = (exchanges as string).split(',');
    const prices = await ccxtService.getPricesFromMultipleExchanges(
      symbol as string,
      exchangeList
    );

    res.json({
      symbol,
      prices,
      timestamp: Date.now()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/exchanges/ohlcv
 * Get OHLCV (candle) data
 */
router.get('/ohlcv', async (req, res) => {
  try {
    const {
      symbol,
      exchange = 'binance',
      timeframe = '1h',
      limit = '24'
    } = req.query;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol required' });
    }

    const ohlcv = await ccxtService.getOHLCVFromExchange(
      exchange as string,
      symbol as string,
      timeframe as string,
      parseInt(limit as string)
    );

    res.json({
      symbol,
      exchange,
      timeframe,
      data: ohlcv
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/exchanges/order
 * Place market order on exchange
 */
router.post('/order', async (req, res) => {
  try {
    const { exchange, symbol, side, amount } = req.body;

    if (!exchange || !symbol || !side || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['buy', 'sell'].includes(side)) {
      return res.status(400).json({ error: 'Invalid side' });
    }

    const order = await ccxtService.placeMarketOrder(
      exchange,
      symbol,
      side,
      amount
    );

    res.json({
      success: true,
      order
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/exchanges/order-status
 * Check order status
 */
router.get('/order-status', async (req, res) => {
  try {
    const { exchange, orderId, symbol } = req.query;

    if (!exchange || !orderId) {
      return res.status(400).json({ error: 'Exchange and orderId required' });
    }

    const status = await ccxtService.checkOrderStatus(
      exchange as string,
      orderId as string,
      symbol as string
    );

    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/exchanges/cancel-order
 * Cancel order
 */
router.post('/cancel-order', async (req, res) => {
  try {
    const { exchange, orderId, symbol } = req.body;

    if (!exchange || !orderId) {
      return res.status(400).json({ error: 'Exchange and orderId required' });
    }

    const success = await ccxtService.cancelOrder(
      exchange,
      orderId,
      symbol
    );

    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/exchanges/balances
 * Get balances from exchange (requires auth)
 */
router.get('/balances', async (req, res) => {
  try {
    const { exchange } = req.query;

    if (!exchange) {
      return res.status(400).json({ error: 'Exchange required' });
    }

    // TODO: Add authentication check
    // const userId = req.user.id;
    // const credentials = await getEncryptedCredentials(userId, exchange);

    const balances = await ccxtService.getBalances(exchange as string);

    res.json({
      exchange,
      balances,
      timestamp: Date.now()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### Step 6: Create Frontend Hooks (1-2 hours)

File: `client/src/hooks/useCEXPrices.ts`

```typescript
import { useQuery } from '@tanstack/react-query';

interface ExchangePrice {
  exchange: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
}

export function useCEXPrices(symbol: string, exchanges: string[] = ['binance', 'coinbase', 'kraken']) {
  return useQuery({
    queryKey: ['cex-prices', symbol, exchanges.join(',')],
    queryFn: async () => {
      const response = await fetch(
        `/api/exchanges/prices?symbol=${symbol}&exchanges=${exchanges.join(',')}`
      );
      if (!response.ok) throw new Error('Failed to fetch prices');
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    retry: 3,
    refetchInterval: 30000
  });
}

export function useCEXOHLCV(
  symbol: string,
  exchange: string = 'binance',
  timeframe: string = '1h',
  limit: number = 24
) {
  return useQuery({
    queryKey: ['cex-ohlcv', symbol, exchange, timeframe, limit],
    queryFn: async () => {
      const response = await fetch(
        `/api/exchanges/ohlcv?symbol=${symbol}&exchange=${exchange}&timeframe=${timeframe}&limit=${limit}`
      );
      if (!response.ok) throw new Error('Failed to fetch OHLCV');
      return response.json();
    },
    staleTime: 300000, // 5 minutes
    retry: 3
  });
}

export function useCEXOrder(orderId: string | null, exchange: string | null) {
  return useQuery({
    queryKey: ['cex-order', orderId, exchange],
    queryFn: async () => {
      if (!orderId || !exchange) return null;
      const response = await fetch(
        `/api/exchanges/order-status?exchange=${exchange}&orderId=${orderId}`
      );
      if (!response.ok) throw new Error('Failed to fetch order');
      return response.json();
    },
    enabled: !!orderId && !!exchange,
    staleTime: 5000, // 5 seconds for active orders
    refetchInterval: 5000
  });
}
```

---

## Database Migration

File: `server/db/migrations/001_add_cex_tables.sql`

```sql
-- Exchange API Credentials (encrypted)
CREATE TABLE exchange_credentials (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exchange VARCHAR(50) NOT NULL,
  api_key VARCHAR(255) NOT NULL,
  api_secret VARCHAR(255) NOT NULL,
  passphrase VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, exchange)
);

-- CEX Orders
CREATE TABLE exchange_orders (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exchange VARCHAR(50) NOT NULL,
  order_id VARCHAR(255) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL,
  order_type VARCHAR(20) NOT NULL,
  amount DECIMAL(18,8) NOT NULL,
  price DECIMAL(18,8),
  fee DECIMAL(18,8),
  status VARCHAR(20) NOT NULL,
  filled_amount DECIMAL(18,8),
  filled_price DECIMAL(18,8),
  filled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  UNIQUE(exchange, order_id)
);

-- CEX Balance Snapshots
CREATE TABLE exchange_balances (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exchange VARCHAR(50) NOT NULL,
  asset VARCHAR(20) NOT NULL,
  free DECIMAL(18,8),
  used DECIMAL(18,8),
  total DECIMAL(18,8),
  usd_value DECIMAL(18,2),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(user_id, exchange),
  INDEX(updated_at)
);

-- Arbitrage Tracking
CREATE TABLE arbitrage_opportunities (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  buy_exchange VARCHAR(50) NOT NULL,
  sell_exchange VARCHAR(50) NOT NULL,
  buy_price DECIMAL(18,8) NOT NULL,
  sell_price DECIMAL(18,8) NOT NULL,
  spread_pct DECIMAL(5,2),
  potential_profit DECIMAL(18,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(symbol, created_at)
);

-- Create indexes for performance
CREATE INDEX idx_exchange_orders_user ON exchange_orders(user_id);
CREATE INDEX idx_exchange_orders_status ON exchange_orders(status);
CREATE INDEX idx_exchange_balances_user ON exchange_balances(user_id);
CREATE INDEX idx_arbitrage_symbol ON arbitrage_opportunities(symbol);
```

---

## Deployment Checklist

```
PRE-DEPLOYMENT:
├─ [ ] All unit tests pass
├─ [ ] Integration tests pass
├─ [ ] API endpoints verified with curl/Postman
├─ [ ] Database migrations tested on staging
├─ [ ] Frontend components render correctly
├─ [ ] No console errors/warnings
├─ [ ] Performance benchmarks acceptable
├─ [ ] Security audit completed
├─ [ ] .env variables configured on server
├─ [ ] Backup of production database
├─ [ ] Rollback plan documented
└─ [ ] Monitoring/alerting configured

DEPLOYMENT:
├─ [ ] Deploy database migrations
├─ [ ] Deploy backend services
├─ [ ] Deploy API routes
├─ [ ] Deploy frontend components
├─ [ ] Test all endpoints in production
├─ [ ] Monitor logs for errors
├─ [ ] Monitor performance metrics
└─ [ ] Document deployment time

POST-DEPLOYMENT:
├─ [ ] Verify all features working
├─ [ ] Check third-party integrations
├─ [ ] Monitor error rates
├─ [ ] Collect user feedback
├─ [ ] Document any issues
└─ [ ] Schedule retrospective
```

---

## Testing Guide

### Backend Testing

```bash
# Test CCXT initialization
curl http://localhost:3000/api/exchanges/prices?symbol=CELO&exchanges=binance,coinbase

# Test order placement (sandbox only!)
curl -X POST http://localhost:3000/api/exchanges/order \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "CELO/USDC",
    "side": "buy",
    "amount": 0.001
  }'

# Test order status
curl "http://localhost:3000/api/exchanges/order-status?exchange=binance&orderId=test123"
```

### Frontend Testing

```tsx
// Test CEX price hook
import { useCEXPrices } from '@/hooks/useCEXPrices';

function TestComponent() {
  const { data, isLoading, error } = useCEXPrices('CELO');
  
  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      {data && (
        <ul>
          {Object.entries(data.prices).map(([ex, price]) => (
            <li key={ex}>{ex}: ${price.ask}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| `Exchange not found` | Exchange not in CCXT | Check spelling, ensure installed |
| `Rate limit exceeded` | API calls too frequent | Increase cache TTL, add delays |
| `Invalid API key` | Wrong credentials | Verify .env file, test key on exchange |
| `Connection timeout` | Network or exchange down | Check exchange status, use fallback |
| `No active orders` | Orders canceled/filled | Check order status, check timestamp |
| `Fee calculation wrong` | Different fee structure | Verify exchange fee tier |

---

**Implementation Status**: Ready for development
**Estimated Completion**: 6-8 weeks
**Next Step**: Assign developers and create tickets
