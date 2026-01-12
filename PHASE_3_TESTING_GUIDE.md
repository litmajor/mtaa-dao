# Phase 3: Smart Order Router - Testing & Deployment Guide

## Overview
Phase 3 implements intelligent order routing that compares DEX vs CEX prices, recommends optimal execution venues, and supports persistent limit orders with automatic status tracking.

**Status**: ✅ Implementation Complete
**Files Created**: 6 new services + 3 UI components + 1 database migration
**API Endpoints**: 6 new routes
**Estimated Effort**: ~35 hours

---

## Phase 3 Deliverables Checklist

### Backend Services ✅
- [x] **orderRouter.ts** - Core smart routing logic
  - Price comparison (DEX vs configurable CEX exchanges)
  - Exchanges loaded dynamically from `exchanges.config.json`
  - Order splitting recommendations
  - Best venue analysis
  - Limit order management
  
- [x] **limitOrderTracker.ts** - Limit order database management
  - Create, read, cancel limit orders
  - Periodic status checking (every 5 minutes)
  - Auto-expiration of old orders
  - Order statistics reporting

- [x] **Database Migration** (003-limit-orders.ts)
  - `limit_orders` table with proper indexes
  - Foreign key to users table
  - Unique constraint on (exchange, order_id)
  - Status tracking (pending, filled, canceled, expired)

### API Endpoints ✅
- [x] **POST /api/orders/route** - Compare prices and get routing recommendation
- [x] **POST /api/orders/split** - Get order splitting recommendation
- [x] **GET /api/orders/best-venue** - Find best execution venue
- [x] **POST /api/orders/limit** - Place a limit order
- [x] **GET /api/orders/limit/:orderId/status** - Check limit order status
- [x] **DELETE /api/orders/limit/:orderId** - Cancel a limit order

### Frontend Components ✅
- [x] **SmartOrderRouter.tsx** - Main Phase 3 UI component
  - Price Comparison tab
  - Order Splitting tab
  - Limit Orders tab (prepared for future)
  
- [x] **useOrderRouting** hook - Fetch routing analysis
- [x] **useOrderSplitting** hook - Get splitting recommendations
- [x] **useBestExecutionVenue** hook - Find best venue
- [x] **useCreateLimitOrder** hook - Place limit orders
- [x] **useLimitOrderStatus** hook - Track order status

### Integration ✅
- [x] SmartOrderRouter integrated into ExchangeMarkets page
- [x] New "Smart Router (Phase 3)" tab in ExchangeMarkets
- [x] Routes mounted in main routes.ts file

---

## Configuration

### Exchanges Configuration File: `server/exchanges.config.json`

The system uses a configurable exchanges file to enable/disable exchanges without code changes:

```json
{
  "binance": {
    "enabled": true,
    "apiKey": "${BINANCE_API_KEY}",
    "apiSecret": "${BINANCE_API_SECRET}"
  },
  "coinbase": {
    "enabled": true,
    "apiKey": "${COINBASE_API_KEY}",
    "apiSecret": "${COINBASE_API_SECRET}"
  },
  "kraken": {
    "enabled": true,
    "apiKey": "${KRAKEN_API_KEY}",
    "apiSecret": "${KRAKEN_API_SECRET}"
  },
  "bybit": {
    "enabled": false,
    "apiKey": "${BYBIT_API_KEY}",
    "apiSecret": "${BYBIT_API_SECRET}"
  },
  "kucoin": {
    "enabled": false,
    "apiKey": "${KUCOIN_API_KEY}",
    "apiSecret": "${KUCOIN_API_SECRET}"
  }
}
```

### How to Configure
1. Edit `server/exchanges.config.json`
2. Set `"enabled": true` to enable an exchange
3. Set `"enabled": false` to disable an exchange
4. Add new exchanges without touching code
5. Restart server to load new configuration

### Dynamic Loading
- Exchanges are loaded at startup from `exchangesConfig`
- Available exchanges are cached in memory
- Price comparison automatically uses all enabled exchanges
- No hardcoding of exchange list

---

## Testing Instructions

### 1. Exchange Configuration Verification
```bash
# Check which exchanges are enabled
cat server/exchanges.config.json

# Verify server loaded the config
npm run dev
# Look for logs showing loaded exchanges
```

### 2. Database Setup
```bash
# Run the migration to create limit_orders table
npm run migrate

# Verify table creation
psql $DATABASE_URL -c "\d limit_orders"
```

### 2. Test Backend API Endpoints

#### Test Price Comparison
```bash
# Compare prices across DEX and CEX
curl -X POST http://localhost:3000/api/orders/route \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "CELO",
    "amount": 100,
    "side": "buy",
    "exchanges": ["binance", "coinbase", "kraken"]
  }'

# Expected Response:
{
  "success": true,
  "data": {
    "symbol": "CELO",
    "amount": 100,
    "side": "buy",
    "recommendations": [
      {
        "venue": "dex",
        "price": 0.649,
        "totalCost": 64.90,
        "slippage": 0.15,
        "gasCost": 2.00,
        "totalWithCosts": 67.05,
        "confidence": "high",
        "reasoning": "Ubeswap DEX with 0.15% slippage"
      },
      {
        "venue": "cex",
        "exchange": "binance",
        "price": 0.651,
        "totalCost": 65.10,
        "fee": 0.065,
        "totalWithCosts": 65.165,
        "confidence": "high",
        "reasoning": "binance with 0.1% taker fee"
      }
    ],
    "recommended": "dex",
    "savings": 0.115,
    "savingsPercent": 0.18,
    "timestamp": 1672531200000
  }
}
```

#### Test Order Splitting
```bash
# Get splitting recommendation for large order
curl -X POST http://localhost:3000/api/orders/split \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "CELO",
    "amount": 10000,
    "side": "buy",
    "maxDEXLiquidity": 5000
  }'

# Expected Response:
{
  "success": true,
  "data": {
    "symbol": "CELO",
    "totalAmount": 10000,
    "splits": [
      {
        "venue": "dex",
        "amount": 5000,
        "price": 0.649,
        "cost": 3245,
        "percentage": 50
      },
      {
        "venue": "cex",
        "exchange": "binance",
        "amount": 5000,
        "price": 0.651,
        "cost": 3255,
        "percentage": 50
      }
    ],
    "totalCost": 6500,
    "averagePrice": 0.650,
    "recommendation": "Split order: 50% on DEX, 50% on binance"
  }
}
```

#### Test Best Venue
```bash
curl -X GET "http://localhost:3000/api/orders/best-venue?symbol=CELO&amount=100&side=buy"

# Expected Response:
{
  "success": true,
  "data": {
    "venue": "dex",
    "price": 0.649,
    "totalWithCosts": 67.05,
    "confidence": "high",
    "reasoning": "Ubeswap DEX with 0.15% slippage"
  }
}
```

#### Test Limit Orders (requires authentication)
```bash
# Place a limit order
curl -X POST http://localhost:3000/api/orders/limit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "exchange": "binance",
    "symbol": "CELO/USDC",
    "side": "buy",
    "amount": 100,
    "price": 0.60,
    "expiresInDays": 7
  }'

# Expected Response:
{
  "success": true,
  "data": {
    "userId": "user-123",
    "exchange": "binance",
    "symbol": "CELO/USDC",
    "side": "buy",
    "amount": 100,
    "price": 0.60,
    "status": "pending",
    "orderId": "12345678",
    "createdAt": "2024-01-10T12:00:00Z",
    "expiresAt": "2024-01-17T12:00:00Z"
  }
}

# Check order status
curl -X GET "http://localhost:3000/api/orders/limit/12345678/status?exchange=binance"

# Expected Response:
{
  "success": true,
  "data": {
    "orderId": "12345678",
    "symbol": "CELO/USDC",
    "side": "buy",
    "amount": 100,
    "price": 0.60,
    "filled": 100,
    "average": 0.60,
    "fee": 0.01,
    "status": "closed",
    "timestamp": 1672531200000
  }
}

# Cancel order
curl -X DELETE "http://localhost:3000/api/orders/limit/12345678?exchange=binance"
```

### 3. Test Frontend Components

#### Launch the application
```bash
npm run dev
# Navigate to /exchange-markets in your browser
```

#### Test Smart Order Router Tab
1. Click "Smart Router (Phase 3)" tab
2. Enter symbol: CELO
3. Enter amount: 100
4. Click "Compare Venues"
5. Verify:
   - Best option is highlighted (green)
   - Savings amount is calculated correctly
   - All venue options are displayed
   - Reasoning explains the choice

#### Test Order Splitting
1. Stay in Smart Router tab
2. Switch to "Order Splitting" tab
3. Enter amount: 10000
4. Click "Calculate Split"
5. Verify:
   - Recommendation shows split percentage
   - Each split shows amount, price, cost
   - Total cost is accurate

#### Test Price Comparison Tab
1. Go to "Price Comparison" tab in main Exchange Markets
2. Enter symbol (e.g., CELO)
3. Select multiple exchanges (Binance, Coinbase, Kraken)
4. Verify:
   - Best price is highlighted
   - Spread percentage is calculated
   - All exchanges are compared

### 4. Test Periodic Order Checking

#### Start the server and monitoring
```bash
# The limitOrderTracker starts periodic checking when server starts
npm run dev

# Check logs for confirmation:
# "Starting periodic order checking every 300000s" (5 minutes)
```

#### Simulate order status update
```bash
# Create a test script to verify status updates are working
# (Would check database after 5 minutes to see if status was updated)
```

### 5. Test with Real Exchange Data (Optional)

```bash
# Add real exchange API keys to .env
BINANCE_API_KEY=your_key
BINANCE_API_SECRET=your_secret
COINBASE_API_KEY=your_key
COINBASE_API_SECRET=your_secret

# Restart server
npm run dev

# Test will use real exchange data instead of mock data
```

---

## Frontend User Flow

### Price Comparison Flow
```
1. User enters symbol (CELO) and amount (100)
2. System fetches prices from DEX and multiple CEX
3. Display shows:
   - Best option with savings calculation
   - Detailed breakdown of all options
   - Confidence level for each recommendation
   - Cost breakdown (price, fee, slippage, gas)
4. User can click "Use This" to proceed with execution
```

### Order Splitting Flow
```
1. User enters large order (10,000 CELO)
2. System analyzes DEX liquidity and CEX options
3. Recommend optimal split:
   - Use DEX for available liquidity (e.g., 5,000)
   - Use best CEX for remainder (e.g., 5,000 on Binance)
4. Display shows cost breakdown for each split
5. User can execute split order atomically
```

### Limit Order Flow (Prepared)
```
1. User opens Limit Orders tab
2. Selects exchange (Binance, Coinbase, etc.)
3. Sets symbol, side (buy/sell), amount, price
4. Sets expiration (default 7 days)
5. Order is created and tracked in database
6. Backend checks status every 5 minutes
7. When filled, user is notified
8. User can cancel at any time
```

---

## Database Schema

### limit_orders table
```sql
CREATE TABLE limit_orders (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  exchange VARCHAR(50) NOT NULL,
  order_id VARCHAR(255) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL,
  amount NUMERIC(20, 8) NOT NULL,
  price NUMERIC(20, 8) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  filled_amount NUMERIC(20, 8) DEFAULT 0,
  filled_price NUMERIC(20, 8),
  fee NUMERIC(20, 8) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  filled_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  canceled_at TIMESTAMP,
  last_checked_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(exchange, order_id)
);
```

### Indexes
- `idx_limit_orders_user_id` - For user queries
- `idx_limit_orders_status` - For status filtering
- `idx_limit_orders_expires_at` - For expiration checks
- `idx_limit_orders_symbol` - For symbol lookups
- `idx_limit_orders_user_status` - For common queries

---

## Known Limitations & Future Work

### Phase 3 Limitations
1. **Limit orders** - Created but not fully integrated in UI yet
2. **Notification system** - Orders don't notify users when filled
3. **Authentication** - Limit orders require auth (prepared but not fully tested)
4. **DEX execution** - Recommended but not actually executed (just analyzed)
5. **CEX credentials** - Not stored securely (requires encryption)

### Phase 4 Additions (Future)
- [ ] Real-time WebSocket streaming for price updates
- [ ] Actual order execution (not just recommendations)
- [ ] User notifications when orders are filled
- [ ] Tax reporting and gain/loss calculations
- [ ] Portfolio rebalancing suggestions

### Phase 5+ Additions (Future)
- [ ] Machine learning for price predictions
- [ ] Arbitrage bot for automated trading
- [ ] Advanced charting with OHLCV data
- [ ] Options and derivatives trading
- [ ] Cross-chain atomic swaps

---

## Troubleshooting

### Orders not appearing in database
- Check `limit_orders` table exists: `\d limit_orders`
- Verify user_id matches users table
- Check for foreign key constraint errors

### Price comparison returning no results
- Verify CCXT service is initialized
- Check exchange API keys are set in .env
- Look for timeout errors in logs

### Status checking not working
- Verify periodic checking started in logs
- Check database connection is active
- Verify orders have correct exchange/orderId

### Frontend not loading
- Check SmartOrderRouter component is imported
- Verify hooks are correctly defined
- Check for TypeScript compilation errors

---

## Performance Considerations

### API Performance
- Price comparison cached for 30 seconds
- Order splitting cached for 30 seconds
- Limit order status checks every 5 minutes (configurable)
- Use indexes on commonly queried columns

### Frontend Performance
- React Query handles caching automatically
- useOrderRouting refetches when symbol/amount changes
- useLimitOrderStatus auto-refetches every 5 seconds for active orders
- SmartOrderRouter component is lazy-loaded

### Database Performance
- Queries use indexed columns
- Limit checks on result sizes
- Batch updates for status checks

---

## Deployment Checklist

Before deploying Phase 3 to production:

### Backend
- [ ] Run database migration successfully
- [ ] Test all 6 API endpoints with curl
- [ ] Verify limit order tracking is working
- [ ] Check error handling and logging
- [ ] Test with multiple exchanges (Binance, Coinbase, Kraken)
- [ ] Load test with concurrent requests
- [ ] Verify performance is acceptable

### Frontend
- [ ] Test Smart Router UI in Chrome
- [ ] Test in Firefox and Safari
- [ ] Verify mobile responsiveness
- [ ] Test with slow network (DevTools)
- [ ] Check for console errors
- [ ] Verify all hooks are working

### Integration
- [ ] Test end-to-end flow (UI → API → Service → Database)
- [ ] Verify authentication is required for limit orders
- [ ] Test error handling and user feedback
- [ ] Check data consistency between frontend and backend

### Monitoring
- [ ] Setup alerts for failed API requests
- [ ] Monitor database query performance
- [ ] Track API response times
- [ ] Monitor limit order tracking job

---

## Next Steps (Phase 4)

Phase 4 will add real-time WebSocket streaming:
1. Create WebSocket server at `/ws/prices`
2. Subscribe to price updates per symbol
3. Stream price changes every 500ms
4. Push real-time arbitrage alerts
5. Update frontend with live price feeds

Estimated effort: 25 hours (Week 7)

---

**Last Updated**: January 10, 2026
**Status**: Ready for Testing
**Owner**: Development Team
