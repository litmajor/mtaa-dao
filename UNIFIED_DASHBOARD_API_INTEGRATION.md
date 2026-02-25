# Tree View Dashboard - API Integration Guide

## Overview
Complete guide to connect the Tree View Unified Dashboard to your backend APIs.

## Backend Requirements

### 1. HTTP REST Endpoints

#### GET /api/dashboard/metrics
Returns platform-wide metrics.

**Response:**
```json
{
  "tvl": 25000000,
  "assetCount": 142,
  "daoCount": 8,
  "memberCount": 2541,
  "healthScores": {
    "treasury": 82,
    "liquidity": 75,
    "governance": 88,
    "security": 91,
    "adoption": 68
  },
  "lastUpdated": 1704067200000
}
```

#### GET /api/elders/kaizen/all-metrics
Returns metrics for all DAOs user is member of.

**Response:**
```json
[
  {
    "id": "dao-1",
    "name": "MTAA Protocol DAO",
    "memberCount": 542,
    "activeMembers": 287,
    "treasury": 8500000,
    "governance": {
      "participationRate": 0.68,
      "proposalCount": 24,
      "approvalRate": 0.87
    },
    "health": 92,
    "trend": "improving"
  },
  ...
]
```

#### GET /api/user/balances
Returns user's token balances per DAO.

**Response:**
```json
{
  "dao-1": 45000,
  "dao-2": 12000,
  "dao-3": 8500,
  "dao-4": 6200
}
```

#### GET /api/user/assets
Returns all user assets across DAOs and wallets.

**Response:**
```json
[
  {
    "id": "asset-1",
    "symbol": "MTAA",
    "name": "MTAA Token",
    "amount": 50000,
    "price": 12.50,
    "value": 625000,
    "change24h": 5.2,
    "location": "MTAA Protocol",
    "chain": "Ethereum"
  },
  {
    "id": "asset-2",
    "symbol": "ETH",
    "name": "Ethereum",
    "amount": 25.5,
    "price": 2450,
    "value": 62475,
    "change24h": 3.1,
    "location": "Wallet",
    "chain": "Ethereum"
  },
  ...
]
```

#### GET /api/elders/kaizen/opportunities
Returns opportunities detected by ELD-KAIZEN system.

**Response:**
```json
[
  {
    "id": "opp-1",
    "title": "Treasury Rebalancing",
    "description": "Rebalance MTAA holdings to optimize for market conditions",
    "category": "treasury",
    "priority": "high",
    "gain": 12.5,
    "risk": "low",
    "daoId": "dao-1",
    "daoName": "MTAA Protocol DAO",
    "timestamp": 1704067200000
  },
  ...
]
```

**Category values**: treasury | governance | community
**Priority values**: high | medium | low
**Risk values**: low | medium | high

#### GET /api/admin/activity-logs
Returns activity history for user's DAOs.

**Response:**
```json
[
  {
    "id": "act-1",
    "daoId": "dao-1",
    "daoName": "MTAA Protocol DAO",
    "action": "voted on proposal #24",
    "member": "alice.eth",
    "description": "Approved the new fee structure",
    "status": "completed",
    "timestamp": 1704067200000
  },
  ...
]
```

**Status values**: pending | completed | failed

---

### 2. WebSocket Real-time Endpoint

**URL**: `wss://api.mtaadao.io/ws`

The WebSocket server should send JSON messages with the following format:

```json
{
  "type": "MESSAGE_TYPE",
  "timestamp": 1704067200000,
  "data": { /* category-specific data */ },
  "source": "optional-source-identifier"
}
```

#### Supported Message Types

##### PLATFORM_METRICS
Sent when platform-wide metrics change.

```json
{
  "type": "PLATFORM_METRICS",
  "timestamp": 1704067200000,
  "data": {
    "tvl": 25000000,
    "assetCount": 142,
    "daoCount": 8,
    "memberCount": 2541,
    "healthScores": {
      "treasury": 82,
      "liquidity": 75,
      "governance": 88,
      "security": 91,
      "adoption": 68
    }
  }
}
```

**Send frequency**: Every 30 seconds or when metrics change

##### DAO_METRICS
Sent when a specific DAO's metrics update.

```json
{
  "type": "DAO_METRICS",
  "timestamp": 1704067200000,
  "data": {
    "daoId": "dao-1",
    "memberCount": 542,
    "activeMembers": 287,
    "treasury": 8500000,
    "governance": {
      "participationRate": 0.68,
      "proposalCount": 24,
      "approvalRate": 0.87
    },
    "health": 92,
    "trend": "improving"
  }
}
```

**Send frequency**: When member activity changes, treasury changes, or governance metrics update

##### OPPORTUNITY
Sent when new opportunity is detected by ELD-KAIZEN.

```json
{
  "type": "OPPORTUNITY",
  "timestamp": 1704067200000,
  "data": {
    "id": "opp-new-1",
    "title": "Governance Vote",
    "description": "Vote on new fee structure proposal",
    "category": "governance",
    "priority": "high",
    "gain": 5.0,
    "risk": "low",
    "daoId": "dao-1",
    "daoName": "MTAA Protocol DAO"
  }
}
```

**Send frequency**: When opportunities are detected (varies)

##### MARKET_DATA
Sent with price updates from exchanges.

```json
{
  "type": "MARKET_DATA",
  "timestamp": 1704067200000,
  "data": {
    "exchange": "Binance",
    "assetSymbol": "MTAA",
    "price": 12.50,
    "change24h": 5.2,
    "volume24h": 1500000
  }
}
```

**Send frequency**: Every 5-30 seconds (market data frequency)

##### GLOBAL_METRICS
Sent with global crypto metrics updates.

```json
{
  "type": "GLOBAL_METRICS",
  "timestamp": 1704067200000,
  "data": {
    "metric": "fear-greed",
    "value": 65,
    "change": 2.5,
    "description": "Market Greed (65/100)"
  }
}
```

**Metric values**: fear-greed | btc-dominance | market-cap | volume | eth-gas | top-movers

**Send frequency**: Every 60 seconds or when thresholds change

##### ACTIVITY
Sent when DAO activity occurs.

```json
{
  "type": "ACTIVITY",
  "timestamp": 1704067200000,
  "data": {
    "id": "act-new-1",
    "daoId": "dao-1",
    "daoName": "MTAA Protocol DAO",
    "action": "voted on proposal #25",
    "member": "bob.eth",
    "description": "Approved funding request",
    "status": "completed"
  }
}
```

**Send frequency**: Real-time as activities occur

---

## Implementation Steps

### Step 1: Update useUnifiedDashboardData.ts

Replace the mock data generators with real API calls:

```typescript
// client/src/components/dashboard/hooks/useUnifiedDashboardData.ts

const fetchData = useCallback(async () => {
  try {
    setLoading(true);
    setError(null);

    // Replace mock generators with real API calls
    const [
      platform,
      daos,
      userBalances,
      assets,
      opportunities,
      activities
    ] = await Promise.all([
      fetch('/api/dashboard/metrics').then(r => {
        if (!r.ok) throw new Error('Failed to fetch platform metrics');
        return r.json();
      }),
      fetch('/api/elders/kaizen/all-metrics').then(r => {
        if (!r.ok) throw new Error('Failed to fetch DAO metrics');
        return r.json();
      }),
      fetch('/api/user/balances').then(r => {
        if (!r.ok) throw new Error('Failed to fetch balances');
        return r.json();
      }),
      fetch('/api/user/assets').then(r => {
        if (!r.ok) throw new Error('Failed to fetch assets');
        return r.json();
      }),
      fetch('/api/elders/kaizen/opportunities').then(r => {
        if (!r.ok) throw new Error('Failed to fetch opportunities');
        return r.json();
      }),
      fetch('/api/admin/activity-logs').then(r => {
        if (!r.ok) throw new Error('Failed to fetch activities');
        return r.json();
      }),
    ]);

    // Rest of the function stays the same...
    const daoNames = daos.reduce((acc, dao) => ({
      ...acc,
      [dao.id]: dao.name,
    }), {});

    const totalNetWorth = Object.values(userBalances).reduce((sum, val) => sum + val, 0);
    const stakingAmount = /* calculate from assets or API */ 80000;
    const poolAmount = /* calculate from assets or API */ 150000;

    const combinedData: UnifiedDashboardData = {
      platform,
      daos,
      userBalances,
      assets,
      opportunities,
      activities,
      daoNames,
      totalNetWorth,
      stakingAmount,
      poolAmount,
    };

    setData(combinedData);
    setLastUpdated(Date.now());
  } catch (err) {
    setError(err instanceof Error ? err : new Error('Failed to fetch dashboard data'));
  } finally {
    setLoading(false);
  }
}, []);
```

### Step 2: Configure WebSocket URL

Update the WebSocket URL in UnifiedDashboardPage.tsx:

```typescript
// From:
const { connected, reconnecting, messages } = useWebSocket('wss://api.mtaadao.io/ws', {

// To your actual WebSocket endpoint:
const { connected, reconnecting, messages } = useWebSocket('wss://your-api.com/ws', {
  enabled: !isPaused,
});
```

### Step 3: Handle Real-time Messages

Update the message processing in UnifiedDashboardPage.tsx to actually update state:

```typescript
// Process real-time messages
useEffect(() => {
  if (messages.length === 0) return;

  const latestMessage = messages[messages.length - 1];
  
  switch (latestMessage.type) {
    case 'PLATFORM_METRICS':
      // Update platform data
      console.log('Platform metrics updated:', latestMessage.data);
      // Call refetch() or update state directly
      break;
      
    case 'DAO_METRICS':
      // Update specific DAO
      console.log('DAO metrics updated:', latestMessage.data);
      break;
      
    case 'OPPORTUNITY':
      // Add new opportunity to feed
      console.log('New opportunity:', latestMessage.data);
      break;
      
    case 'MARKET_DATA':
      // Update market prices
      console.log('Market data updated:', latestMessage.data);
      break;
      
    case 'GLOBAL_METRICS':
      // Update global metrics
      console.log('Global metrics updated:', latestMessage.data);
      break;
      
    case 'ACTIVITY':
      // Add new activity
      console.log('New activity:', latestMessage.data);
      break;
  }
}, [messages]);
```

### Step 4: Test Connection

1. Start your backend server
2. Navigate to `/dashboard`
3. Check browser console for WebSocket logs
4. Verify connection status indicator changes to green
5. Watch for real-time updates

---

## Testing Checklist

- [ ] Platform metrics endpoint returns correct data
- [ ] DAO metrics endpoint returns user's DAOs
- [ ] Balances endpoint returns correct amounts
- [ ] Assets endpoint returns all user assets
- [ ] Opportunities endpoint returns opportunities
- [ ] Activity logs endpoint returns recent activities
- [ ] WebSocket server accepts connections
- [ ] WebSocket sends PLATFORM_METRICS updates
- [ ] WebSocket sends DAO_METRICS updates
- [ ] WebSocket sends OPPORTUNITY updates
- [ ] WebSocket sends MARKET_DATA updates
- [ ] WebSocket sends GLOBAL_METRICS updates
- [ ] WebSocket sends ACTIVITY updates
- [ ] Dashboard displays all data correctly
- [ ] Real-time updates appear without page refresh
- [ ] Offline fallback to polling works
- [ ] Connection status indicator updates
- [ ] Error messages display properly

---

## Error Handling

The dashboard handles these error scenarios:

1. **API Fetch Fails**: Shows error message, uses cached data if available
2. **WebSocket Connection Fails**: Automatically switches to HTTP polling
3. **Network Timeout**: Retries up to 10 times with exponential backoff
4. **Invalid JSON**: Logs error, skips malformed message
5. **Missing Fields**: Uses default values, warns in console

---

## Performance Optimization

### API Call Optimization
- Initial data fetch: ~1.2 KB total (combined all endpoints)
- Real-time messages: ~0.5 KB per update
- Activity feed: Keep last 100 messages in memory

### WebSocket Recommendations
- Send platform metrics every 30 seconds
- Send DAO metrics when active changes > 1%
- Send market data every 5-10 seconds
- Send opportunities immediately when detected
- Send activities real-time

### Frontend Optimization
- Memoize expensive calculations
- Virtual scroll for 100+ items
- Lazy load components
- Message buffer (max 100 items)

---

## Security Considerations

1. **Authentication**: Ensure API endpoints require authentication
2. **WebSocket Auth**: Use JWT or session tokens
3. **Rate Limiting**: Implement rate limits on endpoints
4. **CORS**: Configure CORS for your domain
5. **Data Validation**: Validate all incoming data
6. **HTTPS/WSS**: Use secure protocols in production

---

## Deployment Checklist

- [ ] Update API endpoints to production URLs
- [ ] Update WebSocket URL to production endpoint
- [ ] Enable HTTPS and WSS
- [ ] Set up authentication tokens
- [ ] Test with production data
- [ ] Monitor WebSocket connections
- [ ] Set up error logging/monitoring
- [ ] Test on actual production backend
- [ ] Performance test with real load
- [ ] Monitor for memory leaks

---

## Support & Debugging

**View WebSocket messages:**
```typescript
console.log('All messages:', messages);
```

**View data structure:**
```typescript
console.log('Dashboard data:', data);
```

**Check connection status:**
```typescript
console.log('Connected:', connected, 'Reconnecting:', reconnecting);
```

**Monitor API calls:**
Open browser Network tab and filter for:
- `/api/dashboard/*`
- WebSocket URL

---

**Status**: Ready for production integration
