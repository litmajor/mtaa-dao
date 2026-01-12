/**
 * CCXT Integration Checklist - Phase 1
 * 
 * Step-by-step guide to integrate CCXT service into main application
 * Includes: Route integration, environment setup, verification steps
 */

# CCXT Phase 1 Integration Checklist

## Overview
This checklist guides integration of the CCXT Service foundation into your main Express application. Follow in order.

## ✅ Pre-Integration Verification

- [ ] Both files created successfully:
  - [ ] `server/services/ccxtService.ts` (735 lines)
  - [ ] `server/routes/exchanges.ts` (330+ lines)
  
- [ ] Dependencies installed:
  - [ ] `npm install ccxt` (completed)
  - [ ] `npm install node-cache` (verify: `npm list node-cache`)
  - [ ] `npm install p-limit` (verify: `npm list p-limit`)

- [ ] Test files created:
  - [ ] `server/services/ccxtService.test.ts`
  - [ ] `server/routes/exchanges.test.ts`

## 🔧 Step 1: Locate Main Express App

Find your main application file (one of):

- [ ] `server/app.ts` - Most common
- [ ] `server/index.ts`
- [ ] `server/server.ts`
- [ ] `src/server.ts`

**Location Found**: `_________________________________`

## 🔧 Step 2: Add Route Import

Open your main app file and add import at the top (after other imports):

```typescript
// Add this import with your other route imports
import exchangeRoutes from './routes/exchanges';
```

### Before:
```typescript
import express from 'express';
import userRoutes from './routes/users';
import tokenRoutes from './routes/tokens';
// ... other imports
```

### After:
```typescript
import express from 'express';
import userRoutes from './routes/users';
import tokenRoutes from './routes/tokens';
import exchangeRoutes from './routes/exchanges';  // ← ADD THIS
// ... other imports
```

- [ ] Import added

## 🔧 Step 3: Add Route Handler

Find where other routes are registered (typically after middleware setup):

```typescript
// Look for section like:
app.use('/api/users', userRoutes);
app.use('/api/tokens', tokenRoutes);
```

Add the exchange routes:

```typescript
// Add this with other route handlers
app.use('/api/exchanges', exchangeRoutes);
```

### Before:
```typescript
app.use(express.json());
app.use(express.static('public'));

app.use('/api/users', userRoutes);
app.use('/api/tokens', tokenRoutes);
```

### After:
```typescript
app.use(express.json());
app.use(express.static('public'));

app.use('/api/users', userRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/exchanges', exchangeRoutes);  // ← ADD THIS
```

- [ ] Route handler registered

## 🔧 Step 4: Configure Environment Variables

Create or update `.env` file in project root:

```bash
# CCXT Service Configuration
CCXT_ENABLED=true
CCXT_TIMEOUT=30000
CCXT_CACHE_TTL_PRICES=30000
CCXT_CACHE_TTL_OHLCV=300000
CCXT_CACHE_TTL_MARKETS=3600000

# Optional: Add API keys for authenticated endpoints (Phase 2)
# BINANCE_API_KEY=your_key_here
# BINANCE_API_SECRET=your_secret_here
# COINBASE_API_KEY=your_key_here
# etc...

# Debug mode (set to true for verbose logging)
DEBUG=false
```

- [ ] `.env` file configured

## 🔧 Step 5: Verify TypeScript Compilation

Run TypeScript check:

```bash
# Option 1: Full build
npm run build

# Option 2: Just type check
npx tsc --noEmit
```

Expected output: No errors

```
✅ No errors found
```

- [ ] TypeScript compilation successful

## 🔧 Step 6: Start Application

Start your development server:

```bash
# Common start commands
npm start
npm run dev
npm run start:dev
```

Expected output:
```
✅ Server running on http://localhost:PORT
✅ CCXT Service initialized
✅ Exchange routes mounted
```

- [ ] Application started successfully

## ✅ Verification Tests (Manual)

### Test 1: Check Health Endpoint

```bash
curl http://localhost:3000/api/exchanges/status
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": 1701234567890,
  "exchanges": {
    "binance": { "connected": true, "hasCredentials": false },
    "coinbase": { "connected": true, "hasCredentials": false },
    "kraken": { "connected": true, "hasCredentials": false }
  }
}
```

- [ ] Status endpoint working

### Test 2: Fetch Prices

```bash
curl "http://localhost:3000/api/exchanges/prices?symbol=CELO"
```

**Expected Response:**
```json
{
  "symbol": "CELO",
  "timestamp": 1701234567890,
  "prices": {
    "binance": { "bid": 0.65, "ask": 0.66, "last": 0.655 },
    "coinbase": { "bid": 0.64, "ask": 0.67, "last": 0.655 },
    "kraken": { "bid": 0.65, "ask": 0.66, "last": 0.655 }
  },
  "analysis": {
    "best_bid": 0.65,
    "best_ask": 0.66,
    "spread": 0.01,
    "spread_pct": 1.49,
    "best_source": "binance"
  }
}
```

- [ ] Prices endpoint working

### Test 3: Get Best Price

```bash
curl "http://localhost:3000/api/exchanges/best-price?symbol=CELO"
```

**Expected Response:**
```json
{
  "symbol": "CELO",
  "timestamp": 1701234567890,
  "best": {
    "exchange": "binance",
    "bid": 0.65,
    "ask": 0.66,
    "spread": 0.01
  },
  "analysis": {
    "tightest": "binance (0.01 spread)",
    "spread_pct": 1.49,
    "arbitrage_opportunity": false
  },
  "all": { /* all prices */ }
}
```

- [ ] Best price endpoint working

### Test 4: Get OHLCV Data

```bash
curl "http://localhost:3000/api/exchanges/ohlcv?symbol=CELO&timeframe=1h&limit=24"
```

**Expected Response:**
```json
{
  "symbol": "CELO",
  "exchange": "binance",
  "timeframe": "1h",
  "timestamp": 1701234567890,
  "data": [
    [1701234000000, 0.65, 0.66, 0.64, 0.655, 5000000],
    [1701230400000, 0.64, 0.67, 0.63, 0.65, 4500000],
    /* ... more candles ... */
  ]
}
```

- [ ] OHLCV endpoint working

### Test 5: Get Markets

```bash
curl "http://localhost:3000/api/exchanges/markets?exchange=binance"
```

**Expected Response:**
```json
{
  "exchange": "binance",
  "timestamp": 1701234567890,
  "count": 1234,
  "markets": [
    {
      "id": "CELOBUSD",
      "symbol": "CELO/BUSD",
      "base": "CELO",
      "quote": "BUSD",
      "maker": 0.001,
      "taker": 0.001,
      "limits": { /* limits */ }
    },
    /* ... more markets ... */
  ]
}
```

- [ ] Markets endpoint working

### Test 6: Validate Order

```bash
curl -X POST http://localhost:3000/api/exchanges/order/validate \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "CELO",
    "side": "buy",
    "amount": 10
  }'
```

**Expected Response:**
```json
{
  "valid": true,
  "errors": [],
  "market": {
    "symbol": "CELO/USDT",
    "base": "CELO",
    "quote": "USDT",
    "limits": { /* limits */ },
    "maker": 0.001,
    "taker": 0.001
  }
}
```

- [ ] Order validation endpoint working

## 📊 Performance Verification

### Test: Cache Performance

```bash
# First request (cache miss)
time curl "http://localhost:3000/api/exchanges/prices?symbol=CELO"

# Second request (cache hit) - should be ~1-5ms
time curl "http://localhost:3000/api/exchanges/prices?symbol=CELO"
```

**Expected:**
- First request: 200-500ms (API call)
- Second request: 1-5ms (from cache)
- Speedup: 40-500x faster

- [ ] Caching working correctly

### Test: Check Cache Stats

```bash
curl "http://localhost:3000/api/exchanges/cache-stats"
```

**Expected Response:**
```json
{
  "timestamp": 1701234567890,
  "prices": {
    "keys": 5,
    "size": "1.2 KB"
  },
  "ohlcv": {
    "keys": 0,
    "size": "0 B"
  },
  "markets": {
    "keys": 3,
    "size": "245 KB"
  }
}
```

- [ ] Cache stats accessible

## 🧪 Automated Testing

### Run All Tests

```bash
npm test
```

**Expected Output:**
```
✓ CCXT Service (38 tests)
✓ Exchange Routes (43 tests)

Tests: 81 passed | 81 total
Duration: ~45 seconds
```

- [ ] All tests passing

### Run Specific Tests

```bash
# Unit tests only
npm run test:ccxt

# Route tests only
npm run test:routes

# With coverage
npm run test:coverage
```

- [ ] Unit tests passing
- [ ] Route tests passing

## 🚨 Troubleshooting

### Issue: Import Error - Cannot find module

```
Error: Cannot find module './routes/exchanges'
```

**Solution:**
1. Verify file exists: `ls -la server/routes/exchanges.ts`
2. Check TypeScript compilation: `npx tsc --noEmit`
3. Ensure relative path is correct

### Issue: Route Not Found (404)

```
GET /api/exchanges/status → 404
```

**Solution:**
1. Verify route registered: Check app.use() call
2. Restart server: `npm start`
3. Check URL: Should be `/api/exchanges/status` not `/api/exchange/status`

### Issue: Network Timeout

```
Error: getaddrinfo ENOTFOUND api.binance.com
```

**Solution:**
1. Check internet connection
2. Verify API endpoints accessible: `ping api.binance.com`
3. Check firewall settings
4. Increase timeout in `.env`: `CCXT_TIMEOUT=60000`

### Issue: Type Errors

```
Property 'getExchangeStatus' does not exist on type 'typeof ccxtService'
```

**Solution:**
1. Run TypeScript check: `npx tsc --noEmit`
2. Check file permissions
3. Verify service file created correctly
4. Clear TypeScript cache: `rm -rf node_modules/.cache`

### Issue: 429 Rate Limit Error

```
Error: 429 Too Many Requests from Binance
```

**Solution:**
1. Wait 60 seconds before retrying
2. Reduce concurrent request count
3. Increase cache TTL in `.env`
4. Rate limiting is handled by p-limit library

## 📋 Post-Integration Checklist

- [ ] All files created and in correct locations
- [ ] Routes imported and registered in main app
- [ ] Environment variables configured
- [ ] TypeScript compiling without errors
- [ ] Application starts without errors
- [ ] All 5 manual verification tests passing
- [ ] Cache performance verified (>40x speedup)
- [ ] All 81 automated tests passing
- [ ] No console errors or warnings

## 🎯 Phase 1 Completion Criteria

✅ **READY FOR PHASE 2** when all above are complete:

- Service fully integrated and operational
- All endpoints responding correctly with real data
- Caching working efficiently
- Tests passing
- Performance validated

## 🚀 Next: Begin Phase 2

Once Phase 1 is complete:

1. **Frontend Team**: Build React hooks and components
   - `useCEXPrices` hook for price data
   - `CEXPriceComparison` component
   - `CEXOrderModal` component
   
2. **Database Team**: Create persistent storage
   - `exchange_credentials` table
   - `exchange_orders` table
   - `exchange_balances` table
   
3. **Backend Auth Team**: Implement authentication
   - Credential encryption
   - Private endpoint authorization
   - API key validation
   
4. **QA Team**: Comprehensive testing
   - End-to-end workflows
   - Performance benchmarks
   - Load testing

---

**Integration Status**: 🟢 **READY TO BEGIN**

Last Updated: [Current Date]
Completed By: [Your Team]
