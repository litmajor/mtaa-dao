# Phase 4: Real-Time WebSocket Streaming - Testing Guide

## Overview

Phase 4 implements real-time WebSocket price streaming with automatic arbitrage detection. This guide covers testing the WebSocket server, client hooks, and UI components.

**Implementation Status**: Core infrastructure complete
- ✅ WebSocket server (`server/websocket/priceStream.ts`)
- ✅ React hooks (`client/src/hooks/useLiveExchangePrices.ts`)
- ✅ UI components (`client/src/components/LivePricesPanel.tsx`)
- ✅ Routes integration (`server/routes.ts`)

---

## 1. WebSocket Server Testing

### 1.1 Verify Server Initialization

**Endpoint**: `GET /api/websocket/stats`

Test the WebSocket server is initialized:

```bash
curl -X GET http://localhost:3000/api/websocket/stats
```

**Expected Response**:
```json
{
  "status": "active",
  "stats": {
    "clientCount": 0,
    "totalSubscriptions": 0,
    "uniqueSymbols": 0,
    "uniqueExchanges": 0
  }
}
```

### 1.2 WebSocket Connection Test

**URL**: `ws://localhost:3000/ws/prices`

**Client Test Code** (Node.js):

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000/ws/prices');

ws.on('open', () => {
  console.log('✅ Connected to WebSocket server');
  
  // Subscribe to BTC prices on Binance and Coinbase
  ws.send(JSON.stringify({
    action: 'subscribe',
    symbols: ['BTC/USDT'],
    exchanges: ['binance', 'coinbase']
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('📨 Received:', JSON.stringify(message, null, 2));
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

ws.on('close', () => {
  console.log('❌ WebSocket disconnected');
});
```

### 1.3 Message Types

#### Subscribe Message

**Request**:
```json
{
  "action": "subscribe",
  "symbols": ["BTC/USDT", "ETH/USDT"],
  "exchanges": ["binance", "coinbase", "kraken"]
}
```

**Response**:
```json
{
  "type": "subscribed",
  "symbols": ["BTC/USDT", "ETH/USDT"],
  "exchanges": ["binance", "coinbase", "kraken"],
  "message": "Successfully subscribed"
}
```

#### Price Update Message

**Incoming** (every 500ms):
```json
{
  "type": "price",
  "symbol": "BTC/USDT",
  "exchange": "binance",
  "bid": 42500.50,
  "ask": 42501.75,
  "timestamp": 1704067200000
}
```

#### Arbitrage Alert Message

**Incoming** (when spread > 0.5%):
```json
{
  "type": "arbitrage",
  "symbol": "BTC/USDT",
  "buyExchange": "binance",
  "sellExchange": "coinbase",
  "buyPrice": 42500.50,
  "sellPrice": 42800.25,
  "spreadPct": 0.705,
  "profit": 29975,
  "timestamp": 1704067200000
}
```

---

## 2. React Hook Testing

### 2.1 useLiveExchangePrices Hook

**Basic Usage Test**:

```typescript
import { useLiveExchangePrices } from '@/hooks/useLiveExchangePrices';

function TestComponent() {
  const {
    prices,
    arbitrageAlerts,
    isConnected,
    error,
    subscribe,
    unsubscribe,
    getPrice,
    requestNotificationPermission
  } = useLiveExchangePrices({
    initialSymbols: ['BTC/USDT'],
    initialExchanges: ['binance', 'coinbase'],
    autoConnect: true
  });

  // Test getting a specific price
  const btcBinancePrice = getPrice('BTC/USDT', 'binance');

  // Test getting all prices for a symbol
  const allBTCPrices = getPricesForSymbol('BTC/USDT');

  // Test subscribing to new symbols
  const handleSubscribe = () => {
    subscribe(['ETH/USDT'], ['kraken']);
  };

  // Test unsubscribing
  const handleUnsubscribe = () => {
    unsubscribe(['BTC/USDT'], []);
  };

  return (
    <div>
      <p>Connected: {isConnected ? '✅' : '❌'}</p>
      <p>Error: {error || 'None'}</p>
      <p>Arbitrage Alerts: {arbitrageAlerts.length}</p>
      <p>Prices: {Object.keys(prices).length}</p>
      
      <button onClick={handleSubscribe}>Subscribe ETH</button>
      <button onClick={handleUnsubscribe}>Unsubscribe BTC</button>
      <button onClick={requestNotificationPermission}>Enable Notifications</button>
    </div>
  );
}
```

### 2.2 useArbitrageMonitor Hook

**Test Arbitrage Detection**:

```typescript
import { useArbitrageMonitor } from '@/hooks/useLiveExchangePrices';

function ArbitrageTest() {
  const { alerts, bestOpportunity, alertCount } = useArbitrageMonitor('BTC/USDT', 0.5);

  return (
    <div>
      <p>Total Alerts: {alertCount}</p>
      {bestOpportunity && (
        <div>
          <p>Best Spread: {bestOpportunity.spreadPct.toFixed(2)}%</p>
          <p>Buy @ {bestOpportunity.buyExchange}: ${bestOpportunity.buyPrice.toFixed(2)}</p>
          <p>Sell @ {bestOpportunity.sellExchange}: ${bestOpportunity.sellPrice.toFixed(2)}</p>
          <p>Profit (100 coins): ${bestOpportunity.profit.toFixed(2)}</p>
        </div>
      )}
    </div>
  );
}
```

### 2.3 useExchangePriceComparison Hook

**Test Price Comparison**:

```typescript
import { useExchangePriceComparison } from '@/hooks/useLiveExchangePrices';

function PriceComparisonTest() {
  const comparison = useExchangePriceComparison('BTC/USDT', [
    'binance',
    'coinbase',
    'kraken'
  ]);

  return (
    <div>
      <p>Best Buy: {comparison.bestBuyExchange} @ ${comparison.bestBuyPrice}</p>
      <p>Best Sell: {comparison.bestSellExchange} @ ${comparison.bestSellPrice}</p>
      <p>Potential Spread: {comparison.potentialSpread?.toFixed(2)}%</p>
      
      {comparison.comparison.map((c) => (
        <div key={c.exchange}>
          <p>{c.exchange}: ${c.midPrice?.toFixed(4) || 'N/A'}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## 3. UI Component Testing

### 3.1 LivePricesPanel Component

**Test Live Prices Display**:

```tsx
import { LivePricesPanel } from '@/components/LivePricesPanel';

export function TestLivePrices() {
  return (
    <div className="p-4">
      <LivePricesPanel
        symbol="BTC/USDT"
        exchanges={['binance', 'coinbase', 'kraken']}
        minArbitrageSpread={0.5}
      />
    </div>
  );
}
```

**Test Checklist**:
- ✅ Connection status indicator shows green when connected
- ✅ Prices update every 500ms
- ✅ Exchange prices display bid/ask spreads
- ✅ Best buy/sell exchanges are highlighted
- ✅ Arbitrage alerts appear when spread > threshold
- ✅ "No opportunities" message shows when spread is low

### 3.2 LivePricesWidget Component

**Compact Widget Test**:

```tsx
import { LivePricesWidget } from '@/components/LivePricesPanel';

export function TestWidget() {
  return (
    <LivePricesWidget
      symbol="ETH/USDT"
      exchanges={['binance', 'coinbase']}
    />
  );
}
```

### 3.3 SmartOrderRouter Integration

**Test Integration with Price Panel**:

The SmartOrderRouter can be enhanced to display live prices alongside order routing:

```tsx
import { SmartOrderRouter } from '@/components/SmartOrderRouter';
import { LivePricesPanel } from '@/components/LivePricesPanel';

export function EnhancedOrderRouting() {
  const [symbol, setSymbol] = useState('BTC/USDT');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SmartOrderRouter defaultSymbol={symbol} defaultAmount={1} />
      <LivePricesPanel
        symbol={symbol}
        exchanges={['binance', 'coinbase', 'kraken']}
      />
    </div>
  );
}
```

---

## 4. End-to-End Testing

### 4.1 Complete Flow Test

**Scenario**: Monitor BTC/USDT prices and detect arbitrage

1. **Start Server**:
   ```bash
   npm run dev
   ```

2. **Open WebSocket Connection** in browser console:
   ```javascript
   const ws = new WebSocket('ws://localhost:3000/ws/prices');
   ws.onmessage = (e) => console.log(JSON.parse(e.data));
   ws.send(JSON.stringify({
     action: 'subscribe',
     symbols: ['BTC/USDT'],
     exchanges: ['binance', 'coinbase', 'kraken']
   }));
   ```

3. **Observe Price Updates**: Should see price messages every 500ms

4. **Wait for Arbitrage Alerts**: If spreads > 0.5%, alerts should appear

5. **Check Stats Endpoint**:
   ```bash
   curl http://localhost:3000/api/websocket/stats
   ```
   Should show:
   - clientCount: 1
   - totalSubscriptions: 3
   - uniqueSymbols: 1
   - uniqueExchanges: 3

### 4.2 Multiple Client Test

**Test Scenario**: Multiple clients subscribing to different symbols

```javascript
// Client 1 - BTC
const ws1 = new WebSocket('ws://localhost:3000/ws/prices');
ws1.onopen = () => {
  ws1.send(JSON.stringify({
    action: 'subscribe',
    symbols: ['BTC/USDT'],
    exchanges: ['binance']
  }));
};

// Client 2 - ETH
const ws2 = new WebSocket('ws://localhost:3000/ws/prices');
ws2.onopen = () => {
  ws2.send(JSON.stringify({
    action: 'subscribe',
    symbols: ['ETH/USDT'],
    exchanges: ['coinbase']
  }));
};

// Check stats
fetch('http://localhost:3000/api/websocket/stats')
  .then(r => r.json())
  .then(d => console.log('Stats:', d));
// Should show clientCount: 2, totalSubscriptions: 2
```

### 4.3 Reconnection Test

**Test Scenario**: Client reconnects on disconnect

1. Subscribe to prices
2. Close browser dev tools or disconnect network
3. Browser should attempt reconnection
4. On successful reconnect, should re-subscribe automatically
5. Prices should resume flowing

### 4.4 Performance Test

**Test Scenario**: Monitor performance with multiple clients and high-frequency updates

```javascript
// Connect 10 clients
const clients = [];
for (let i = 0; i < 10; i++) {
  const ws = new WebSocket('ws://localhost:3000/ws/prices');
  ws.onopen = () => {
    ws.send(JSON.stringify({
      action: 'subscribe',
      symbols: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
      exchanges: ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin']
    }));
  };
  ws.onmessage = () => {
    // Count message frequency
  };
  clients.push(ws);
}

// Monitor memory and CPU usage
// Should handle 10 clients with 15 symbol/exchange subscriptions = 150 message streams
// at 500ms intervals = 300 messages/second
```

---

## 5. Performance Metrics

### Expected Performance

| Metric | Expected Value |
|--------|-----------------|
| Price Update Frequency | 500ms |
| Messages/Second (1 symbol, 5 exchanges) | 10 msgs/sec |
| Arbitrage Detection Latency | <50ms after price update |
| Client Connection Time | <100ms |
| Memory per Client | ~1MB |
| Max Recommended Clients | 100+ |

### Monitoring

**Check Server Performance**:
```bash
# Monitor WebSocket stats periodically
watch -n 1 'curl -s http://localhost:3000/api/websocket/stats | jq'
```

**Browser DevTools Monitoring**:
- Network tab: Monitor WebSocket frames
- Performance tab: Track message processing time
- Memory tab: Monitor for memory leaks

---

## 6. Common Issues & Troubleshooting

### Issue: WebSocket Connection Fails

**Problem**: `WebSocket is closed before the connection is established`

**Solution**:
1. Ensure server is running: `npm run dev`
2. Check WebSocket is initialized in routes
3. Verify `/ws/prices` path is correct
4. Check browser console for CORS errors

### Issue: No Price Updates Arriving

**Problem**: Connected but no messages received

**Solution**:
1. Verify exchange data is available
2. Check if ccxtService is initialized
3. Ensure prices are being fetched: Check CCXT service logs
4. Try subscribing to different symbols

### Issue: High Memory Usage

**Problem**: Memory grows over time

**Solution**:
1. Check for memory leaks in price cache
2. Verify old client connections are cleaned up
3. Limit arbitrage alerts history (current: 100 alerts)
4. Monitor client connections: `curl http://localhost:3000/api/websocket/stats`

### Issue: Arbitrage Alerts Not Appearing

**Problem**: No arbitrage messages received even with large spreads

**Solution**:
1. Verify minArbitrageSpread threshold in UI (default 0.5%)
2. Check if exchanges have price data
3. Look at server logs for arbitrage detection errors
4. Verify debounce period isn't preventing alerts (1 minute per pair)

---

## 7. Load Testing

### Using Artillery.io

**Install**:
```bash
npm install -g artillery
```

**WebSocket Load Test Config** (`ws-load-test.yml`):

```yaml
config:
  target: "ws://localhost:3000"
  phases:
    - duration: 10
      arrivalRate: 10
      name: "Ramp up to 10 WS clients per second"
    - duration: 60
      arrivalRate: 10
      name: "Sustained load"

scenarios:
  - name: "WebSocket price streaming"
    flow:
      - ws.connect:
          target: "/ws/prices"
      - ws.send:
          data: |
            {
              "action": "subscribe",
              "symbols": ["BTC/USDT", "ETH/USDT"],
              "exchanges": ["binance", "coinbase"]
            }
      - think: 30
      - ws.send:
          data: |
            {
              "action": "unsubscribe",
              "symbols": ["BTC/USDT"],
              "exchanges": []
            }
      - think: 30
```

**Run Test**:
```bash
artillery run ws-load-test.yml
```

---

## 8. Integration Tests

### Test with SmartOrderRouter

**File**: `client/src/pages/__tests__/ExchangeMarkets.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { ExchangeMarkets } from '@/pages/ExchangeMarkets';

describe('SmartOrderRouter with WebSocket', () => {
  it('should display live prices when WebSocket connects', async () => {
    render(<ExchangeMarkets />);

    // Wait for WebSocket connection
    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify price data is displayed
    await waitFor(() => {
      expect(screen.getByText(/binance/i)).toBeInTheDocument();
      expect(screen.getByText(/\$/)).toBeInTheDocument();
    });
  });

  it('should show arbitrage alerts when spreads exceed threshold', async () => {
    render(<ExchangeMarkets />);

    // Wait for arbitrage alert to appear
    await waitFor(() => {
      expect(screen.getByText(/arbitrage/i)).toBeInTheDocument();
    }, { timeout: 30000 });
  });
});
```

---

## 9. Deployment Checklist

Before deploying Phase 4 to production:

- [ ] WebSocket server initializes without errors
- [ ] Client connections persist properly
- [ ] Price updates arrive at 500ms intervals
- [ ] Arbitrage detection works accurately
- [ ] Memory usage is stable over 24 hours
- [ ] Multiple clients can connect simultaneously
- [ ] Reconnection logic works when network drops
- [ ] Error handling covers all edge cases
- [ ] Server stats endpoint accessible
- [ ] Browser notifications working (if enabled)
- [ ] Load test passes with 100+ concurrent clients
- [ ] No console errors in browser
- [ ] SSL/TLS working for WSS in production

---

## 10. Next Steps

**Phase 4 Completion Tasks**:
- [ ] Add WebSocket stats dashboard
- [ ] Implement WebSocket compression
- [ ] Add WebSocket authentication
- [ ] Create monitoring/alerting system
- [ ] Document API for mobile clients

**Phase 5 (Future)**: Order Execution Automation
- Real-time order execution based on arbitrage alerts
- Automated position management
- Risk management integration

