# Trading Dashboard - Trading Account Connection Guide

## Overview

The **TradingDashboard** component is now fully connected to the **Trading Account System** which manages:
- Exchange connections (Binance, Coinbase, Kraken, etc.)
- Account balances across exchanges
- Open positions and orders
- Trading metrics and performance
- Real-time portfolio updates

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              TradingDashboard Component                      │
│         (client/components/trading/TradingDashboard.tsx)    │
└──────────────────┬──────────────────────────────────────────┘
                   │ uses hooks
                   ▼
┌─────────────────────────────────────────────────────────────┐
│            Custom Trading Hooks                             │
│      (client/src/hooks/useTrading.ts)                       │
│  - useOpenOrders()                                          │
│  - usePositions()                                           │
│  - useTradingMetrics()                                      │
│  - useTradeHistory()                                        │
│  - useAccountBalances()                                     │
│  - useSmartRouting()                                        │
│  - useOrderSplitting()                                      │
│  - useBestVenue()                                           │
└──────────────────┬──────────────────────────────────────────┘
                   │ uses context
                   ▼
┌─────────────────────────────────────────────────────────────┐
│        TradingAccountContext                                │
│   (client/src/contexts/trading-account-context.tsx)        │
│                                                             │
│  State:                                                     │
│  - connectedExchanges: ConnectedExchange[]                 │
│  - balances: ExchangeBalance[]                             │
│  - positions: TradePosition[]                              │
│  - orders: TradingOrder[]                                  │
│  - metrics: TradingMetrics                                 │
│                                                             │
│  Methods:                                                   │
│  - connectExchange()                                        │
│  - disconnectExchange()                                     │
│  - placeOrder()                                             │
│  - cancelOrder()                                            │
│  - closePosition()                                          │
│  - refreshBalances()                                        │
│  - refreshPositions()                                       │
│  - refreshOrders()                                          │
└──────────────────┬──────────────────────────────────────────┘
                   │ calls API
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend API Routes                             │
│       (server/routes/exchanges.ts, orders.ts)              │
│                                                             │
│  GET /api/exchanges/balances                               │
│  GET /api/exchanges/orders                                 │
│  POST /api/exchanges/order                                 │
│  POST /api/exchanges/cancel-order                          │
│  POST /api/orders/route                                    │
│  POST /api/orders/split                                    │
│  GET /api/orders/best-venue                                │
│  GET /api/orders/positions                                 │
│  GET /api/orders/metrics                                   │
│  GET /api/orders/history                                   │
│  GET /api/user/exchange-credentials                        │
│  POST /api/user/exchange-credentials                       │
│  DELETE /api/user/exchange-credentials/:exchange           │
└──────────────────┬──────────────────────────────────────────┘
                   │ connects to
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              CCXT Service Layer                             │
│       (server/services/ccxtService.ts)                      │
│                                                             │
│  Multi-exchange abstraction:                               │
│  - Binance, Coinbase, Kraken, Bybit, OKX, etc.            │
│  - Real-time price discovery                               │
│  - Order placement and tracking                            │
│  - Balance and position management                         │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
        ┌──────────┴──────────────┬─────────────────┐
        │                         │                 │
        ▼                         ▼                 ▼
    ┌──────────┐            ┌──────────┐      ┌──────────┐
    │ Binance  │            │ Coinbase │      │  Kraken  │
    │   API    │            │   API    │      │   API    │
    └──────────┘            └──────────┘      └──────────┘
```

## Setup Instructions

### 1. Add TradingAccountProvider to App

```tsx
// client/src/App.tsx
import { TradingAccountProvider } from '@/contexts/trading-account-context';

function App() {
  return (
    <HelmetProvider>
      <NavigationProvider>
        <ThemeProvider>
          <TooltipProvider>
            <MorioProvider userId={userId} daoId={user?.currentDaoId}>
              <TradingAccountProvider>
                {/* Your routes here */}
              </TradingAccountProvider>
            </MorioProvider>
          </TooltipProvider>
        </ThemeProvider>
      </NavigationProvider>
    </HelmetProvider>
  );
}
```

### 2. Use in Components

```tsx
import { TradingDashboard } from '@/components/trading';

export default function TradingPage() {
  return <TradingDashboard />;
}
```

## Features

### Connected State Management
- **Auto-sync**: Balances, positions, and orders sync every 30 seconds
- **Real-time**: Updates reflect across all components instantly
- **Error handling**: Graceful error display with retry options
- **Offline support**: Cached data available when disconnected

### Trading Operations

#### Place Orders
```tsx
const { placeOrder } = useTradingAccount();

const order = await placeOrder(
  'binance',           // exchange
  'BTC/USDT',         // symbol
  'buy',              // side: 'buy' | 'sell'
  'market',           // type: 'market' | 'limit'
  0.1,                // amount
  45000               // price (for limit orders)
);
```

#### Cancel Orders
```tsx
const { cancelOrder } = useTradingAccount();

await cancelOrder('binance', 'orderId123');
```

#### Close Positions
```tsx
const { closePosition } = useTradingAccount();

await closePosition('binance', 'positionId456');
```

### Smart Routing Features

#### Get Best Route (DEX vs CEX)
```tsx
import { useSmartRouting } from '@/hooks/useTrading';

const { routes, bestRoute, loading } = useSmartRouting(
  'ETH/USDC',   // symbol
  1.0,          // amount
  'buy'         // side
);
```

#### Order Splitting Recommendation
```tsx
import { useOrderSplitting } from '@/hooks/useTrading';

const { splitRecommendation, loading } = useOrderSplitting(
  'BTC/USDT',
  10.0,
  'sell'
);
```

#### Find Best Execution Venue
```tsx
import { useBestVenue } from '@/hooks/useTrading';

const { bestVenue, loading } = useBestVenue(
  'CELO/USDC',
  100,
  'buy'
);
```

### Dashboard Components

#### Quick Order Panel
```tsx
<QuickOrderPanel 
  onClose={() => setShowOrderPanel(false)} 
  selectedExchange={selectedExchange} 
/>
```
- Market and limit order placement
- Exchange and symbol selection
- Real-time balance display

#### Order List Panel
```tsx
<OrderListPanel
  orders={filteredOrders}
  loading={ordersLoading}
  selectedExchange={selectedExchange}
  marketType={activeTab === 'all' ? undefined : (activeTab as MarketType)}
/>
```
- Display all open orders
- Filter by exchange and market type
- Real-time order status updates
- Cancel orders directly from list

#### Positions Panel
```tsx
<PositionsPanel
  positions={filteredPositions}
  loading={positionsLoading}
  metrics={positionMetrics}
/>
```
- Display all open positions
- Show PnL (profit/loss) for each
- Position metrics and statistics
- Quick close position buttons

#### Portfolio Metrics Panel
```tsx
<PortfolioMetricsPanel 
  metrics={metrics} 
  loading={metricsLoading} 
/>
```
- Total portfolio value
- 24h change and percentage
- Win rate and trading volume
- Account health indicators

#### Smart Router UI
```tsx
<SmartRouterUI 
  pair={smartRoutingPair} 
  quantity={smartRoutingQty} 
  side={smartRoutingSide} 
/>
```
- DEX vs CEX comparison
- Liquidity analysis
- Fee calculation
- Route recommendations

### Hooks Reference

| Hook | Purpose | Returns |
|------|---------|---------|
| `useOpenOrders()` | Fetch open orders | `{ orders, loading, error, refresh }` |
| `usePositions()` | Fetch open positions | `{ positions, loading, error, metrics, refresh }` |
| `useTradingMetrics()` | Get portfolio metrics | `{ metrics, loading, error, refresh }` |
| `useTradeHistory()` | Fetch trade history | `{ trades, loading, error, refresh }` |
| `useAccountBalances()` | Get account balances | `{ balances, totalBalance, totalUsdValue, loading, error, refresh }` |
| `useSmartRouting()` | Compare DEX vs CEX | `{ routes, bestRoute, loading, error, refresh }` |
| `useOrderSplitting()` | Get split recommendations | `{ splitRecommendation, loading, error, refresh }` |
| `useBestVenue()` | Find best venue | `{ bestVenue, loading, error, refresh }` |
| `useHasConnectedExchanges()` | Check if exchanges connected | `boolean` |
| `useConnectedExchanges()` | Get all connected exchanges | `ConnectedExchange[]` |

## Data Flow Example

### Placing an Order

```
User clicks "Place Order"
    ↓
QuickOrderPanel validates inputs
    ↓
placeOrder() called
    ↓
POST /api/exchanges/order
    ↓
Backend validates with CCXT
    ↓
Order placed on exchange
    ↓
Order stored in database
    ↓
Response with order details
    ↓
TradingAccountContext updates orders state
    ↓
UI re-renders with new order
    ↓
30-second polling updates order status
```

### Receiving Real-time Updates

```
Every 30 seconds (configurable):
    ↓
refreshBalances() called
    ↓
GET /api/exchanges/balances
    ↓
Backend queries each exchange
    ↓
Updates balances state
    ↓
UI components automatically re-render
    ↓
User sees latest positions and PnL
```

## Configuration

### API Endpoints

All endpoints require authentication (`Bearer token` in Authorization header).

**Base URL**: `/api`

#### Exchange Management
```
GET    /api/user/exchange-credentials           # List connected exchanges
POST   /api/user/exchange-credentials           # Connect exchange
DELETE /api/user/exchange-credentials/:exchange # Disconnect exchange
```

#### Trading Operations
```
POST   /api/exchanges/order                     # Place order
POST   /api/exchanges/cancel-order              # Cancel order
GET    /api/exchanges/orders                    # List open orders
GET    /api/exchanges/balances                  # Get balances
GET    /api/orders/positions                    # Get open positions
GET    /api/orders/history                      # Get trade history
GET    /api/orders/metrics                      # Get trading metrics
```

#### Smart Routing
```
POST   /api/orders/route                        # Compare routes
POST   /api/orders/split                        # Order splitting
GET    /api/orders/best-venue                   # Best venue analysis
```

### Environment Variables

```env
VITE_API_URL=http://localhost:3001/api
VITE_API_PORT=5000
VITE_API_HOST=localhost
```

## Error Handling

### Automatic Error Recovery

The TradingAccountContext handles common errors:
- Network failures (retries automatically)
- Exchange API errors (displayed in UI)
- Authentication errors (refreshes token)
- Rate limiting (implements backoff)

### Manual Error Handling

```tsx
const { orders, error } = useOpenOrders();

if (error) {
  return (
    <div className="error-message">
      <p>Failed to load orders: {error}</p>
      <button onClick={() => refresh()}>
        Retry
      </button>
    </div>
  );
}
```

## Performance Optimization

### Polling Intervals
- Default: 30 seconds
- Configurable per hook
- Automatic backoff on errors

### Caching Strategy
- Balances cached across requests
- Orders deduplicated by ID
- Positions merged by symbol/exchange
- History paginated (100 trades per page)

### Lazy Loading
- Components imported as lazy
- Trade history paginated
- Historical data fetched on demand
- Metrics computed on demand

## Security

### Authentication
- All requests require valid JWT token
- Tokens automatically included in headers
- Token refresh on 401 errors
- Credentials never stored in state

### Credentials Management
- Exchange API keys encrypted in database
- Keys never sent to frontend
- Proxy pattern for all exchange operations
- Rate limiting on credential endpoints

### Data Protection
- HTTPS required in production
- API CORS configured
- SQL injection prevention
- Rate limiting per user

## Testing

### Unit Tests

```tsx
// Example: Test placing an order
test('should place market order', async () => {
  const { placeOrder } = useTradingAccount();
  
  const order = await placeOrder(
    'binance',
    'BTC/USDT',
    'buy',
    'market',
    0.1
  );
  
  expect(order.status).toBe('filled');
  expect(order.amount).toBe(0.1);
});
```

### Integration Tests

```tsx
// Example: Test complete order flow
test('should complete order lifecycle', async () => {
  const { placeOrder, cancelOrder, orders } = useTradingAccount();
  
  const order = await placeOrder(...);
  expect(orders).toContainEqual(order);
  
  await cancelOrder(order.exchange, order.id);
  expect(orders).not.toContainEqual(order);
});
```

## Troubleshooting

### Common Issues

**Issue**: Dashboard shows "No exchanges connected"
- **Solution**: Connect exchange via settings (Exchange Management page)
- **Check**: `useHasConnectedExchanges()` returns `false`

**Issue**: Orders not showing up
- **Solution**: Ensure exchange is connected and has open orders
- **Check**: `GET /api/exchanges/orders` in Network tab
- **Fallback**: Manual refresh with `refresh()` button

**Issue**: Balances not updating
- **Solution**: Check polling interval (30s default)
- **Check**: Console for API errors
- **Fallback**: Check exchange API status

**Issue**: Performance slow
- **Solution**: Reduce number of connected exchanges
- **Check**: API response times in Network tab
- **Fallback**: Disable real-time metrics

## Future Enhancements

- [ ] WebSocket real-time updates (instead of polling)
- [ ] Order conditional logic (stop-loss, take-profit)
- [ ] Automated trading strategies
- [ ] Advanced portfolio analytics
- [ ] Multi-account management
- [ ] Custom alerts and notifications
- [ ] API key rotation and security

## API Documentation

For detailed API documentation, see:
- [CCXT Integration Guide](../../CCXT_IMPLEMENTATION_GUIDE.md)
- [Phase 3 Testing Guide](../../PHASE_3_TESTING_GUIDE.md)
- [Order Routing Documentation](../../CCXT_PHASE_2_IMPLEMENTATION_ROADMAP.md)
- [Server Routes Reference](../../server/ROUTES.md)
