# Tuesday: Vault Analytics Real Data Connection

**Status**: Week 1 Implementation - Day 2 (Vault Data Phase)

---

## 🎯 Today's Tasks

1. ✅ **Verify WebSocket connection** - Check real-time infrastructure
2. ✅ **Map API endpoints** - Understand data structure
3. ✅ **Remove mock data fallbacks** - Switch to real APIs
4. ✅ **Test real-time updates** - Verify data flowing
5. ✅ **Debug data mismatches** - Handle schema differences

---

## 🔍 API Endpoints Review

### **Vault Endpoints** (Already Built)

#### 1. **GET /api/vault/performance**
Returns vault TVL, APY, and performance metrics.

**Response Structure**:
```json
{
  "vaultId": "vault-001",
  "currentTVL": 156000,
  "tvlHistory": [
    { "date": "2024-11-01", "value": 150000 },
    { "date": "2024-11-02", "value": 155000 }
  ],
  "currentAPY": 8.5,
  "apyHistory": [
    { "date": "2024-11-01", "apy": 8.2, "benchmark": 7.5 },
    { "date": "2024-11-02", "apy": 8.5, "benchmark": 7.5 }
  ],
  "performance": {
    "dayChange": 2.5,
    "weekChange": 5.2,
    "monthChange": 12.8,
    "yearChange": 45.3
  }
}
```

**Usage in VaultAnalyticsTab**:
```typescript
// Hook automatically fetches from this endpoint
const { data } = useRealtimeMetrics('vault:vaultId:metrics');

// data.currentTVL → displays in TVL card
// data.tvlHistory → populates LineChart
// data.apyHistory → populates AreaChart
```

#### 2. **GET /api/vault/transactions**
Returns withdrawal transactions for analysis.

**Query Parameters**:
```
?currency=cusd&startDate=2024-11-01&endDate=2024-11-23&limit=100
```

**Response Structure**:
```json
{
  "transactions": [
    {
      "id": "tx-001",
      "type": "withdrawal",
      "amount": "1500",
      "currency": "cUSD",
      "timestamp": "2024-11-20T14:30:00Z",
      "status": "completed",
      "from": "vault-address",
      "to": "user-address"
    }
  ],
  "count": 45
}
```

**Usage in VaultAnalyticsTab**:
```typescript
// Hook automatically fetches from this endpoint
const { data } = useRealtimeMetrics('vault:vaultId:transactions');

// Aggregate by date
const withdrawals = data.transactions
  .filter(tx => tx.type === 'withdrawal')
  .reduce((acc, tx) => {
    acc[tx.timestamp.split('T')[0]] = 
      (acc[tx.timestamp.split('T')[0]] || 0) + parseFloat(tx.amount);
    return acc;
  }, {});

// withdrawals → populates BarChart
```

---

## 🔌 Real-Time Connection Setup

### **Step 1: Verify WebSocket Configuration**

```typescript
// In app wrapper or analytics page
<RealtimeMetricsProvider
  apiBaseUrl={process.env.VITE_API_URL || 'http://localhost:3001/api'}
  webSocketUrl={process.env.VITE_WS_URL || 'ws://localhost:3001'}
  enablePolling={true}
/>
```

**Check in Browser DevTools**:
```javascript
// Open Console and paste:
const ws = new WebSocket('ws://localhost:3001');
ws.onopen = () => console.log('✅ WebSocket connected');
ws.onerror = (err) => console.log('❌ Error:', err);
```

### **Step 2: Subscribe to Vault Metrics Channel**

When component mounts:

```typescript
useEffect(() => {
  const unsub = context.subscribe('vault:vaultId:metrics', (data) => {
    console.log('📊 Vault metrics updated:', data);
    // Component automatically re-renders with new data
  });
  
  return unsub;
}, [vaultId]);
```

The hook handles this automatically via `useRealtimeMetrics`.

---

## 🧪 Testing Real Data

### **Test 1: Check API Responses**

```bash
# In terminal/Postman, test endpoint directly
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/vault/performance

# Should return TVL and APY data
```

### **Test 2: Monitor Network Tab**

Open DevTools → Network tab:
1. Navigate to analytics page
2. Look for WebSocket connection: `ws://localhost:3001`
3. Should show "101 Switching Protocols" (connection upgrade)
4. Watch for messages flowing in real-time

### **Test 3: Check Component Data**

Add console logs to VaultAnalyticsTab:

```typescript
const { data, isLoading, isConnected } = useRealtimeMetrics(channel);

useEffect(() => {
  console.log('📊 Data:', data);
  console.log('🔗 Connected:', isConnected);
  console.log('⏳ Loading:', isLoading);
}, [data, isConnected, isLoading]);
```

---

## 🐛 Debugging Data Mismatches

### **Issue: Charts Not Populating**

**Cause**: API response structure different from expected

**Solution**:
```typescript
// In VaultAnalyticsTab, add data validation
useEffect(() => {
  if (data) {
    console.log('Raw API Response:', data);
    console.log('Expected Keys:', 
      ['currentTVL', 'tvlHistory', 'currentAPY', 'apyHistory']
    );
    console.log('Actual Keys:', Object.keys(data));
  }
}, [data]);
```

### **Issue: Real-Time Updates Not Flowing**

**Cause**: WebSocket not connected or channel not subscribed

**Solution**:
```typescript
// Check connection status
const { isConnected } = useRealtimeMetrics(channel);

useEffect(() => {
  if (!isConnected) {
    console.warn('⚠️ Not connected to real-time updates');
    console.log('Falling back to mock data');
  }
}, [isConnected]);
```

### **Issue: Polling Interval Too Aggressive**

**Cause**: Server overloaded with requests

**Solution**:
```typescript
// Increase polling interval
const { data } = useRealtimeMetrics(channel, {
  refreshInterval: 60000,  // 60 seconds instead of 30
  staleTime: 30000,        // 30 seconds
});
```

---

## ✅ Checklist: Vault Analytics Ready for Production

- [ ] WebSocket connects without errors
- [ ] Charts render with real data
- [ ] Time range selector filters data correctly
- [ ] Real-time updates flow (check timestamps)
- [ ] Export button stub ready for CSV implementation
- [ ] Mobile responsive (test on DevTools)
- [ ] No console errors
- [ ] Performance acceptable (< 2s load)
- [ ] All metric cards show accurate data
- [ ] Back button works correctly

---

## 📊 Data Mapping Reference

| Component | Data Field | API Source | Chart Type |
|-----------|-----------|-----------|-----------|
| TVL Card | currentTVL | vault/performance | Metric |
| TVL Chart | tvlHistory | vault/performance | LineChart |
| APY Card | currentAPY | vault/performance | Metric |
| APY Chart | apyHistory | vault/performance | AreaChart |
| Withdrawal Chart | transactions[].amount | vault/transactions | BarChart |
| Performance Metrics | performance.* | vault/performance | Cards |
| Risk Metrics | risk.* | vault/performance | RadarChart |

---

## 🔧 Configuration Adjustments

### **If API Responds Slowly**

Increase cache TTL and polling interval:

```typescript
const { data } = useRealtimeMetrics(channel, {
  cacheTime: 10 * 60 * 1000,    // 10 minutes
  staleTime: 2 * 60 * 1000,     // 2 minutes
  refreshInterval: 60000,        // 60 seconds
});
```

### **If Historical Data Is Incomplete**

Request specific date range:

```typescript
// API endpoint with date filtering
GET /api/vault/transactions?startDate=2024-11-01&endDate=2024-11-23

// In component
const dateRange = {
  startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  endDate: new Date(),
};
```

### **If WebSocket Frequently Disconnects**

Increase reconnect delays:

```typescript
// In RealtimeMetricsProvider
const RECONNECT_DELAY_MS = 2000;  // 2 seconds
const MAX_RECONNECT_DELAY_MS = 60000;  // 60 seconds (exponential backoff)
```

---

## 📈 Expected Behavior

### **On Initial Load**
1. Component renders with mock data
2. WebSocket connects (or falls back to polling)
3. Real data fetches from API
4. Charts update with real values
5. Real-time updates flow in (every 30-60s)

### **On Real-Time Update**
1. API sends update via WebSocket
2. Hook updates internal state
3. Component re-renders
4. Charts animate to new values
5. Timestamps show latest update

### **On Connection Loss**
1. Polling mechanism kicks in
2. No real-time updates (but still refreshing)
3. Falls back to periodic fetches
4. Automatic reconnection attempts
5. User sees "Using cached data" indicator

---

## 🎯 Success Criteria for Tuesday

✅ Vault Analytics tab loads with real data  
✅ Charts display without mock data fallback  
✅ Real-time updates flowing (if WebSocket available)  
✅ Time range selector works with real data  
✅ All 4 metric cards show accurate values  
✅ Performance acceptable (< 2s load)  
✅ No console errors or warnings  
✅ Mobile responsive verified  

---

## 📞 Troubleshooting Quick Links

| Issue | Check | Fix |
|-------|-------|-----|
| Charts empty | API endpoint responding | Check network tab |
| Real-time not working | WebSocket connected | Check WS_URL env var |
| Data stale | Polling interval | Reduce to 30000ms |
| Slow performance | Number of data points | Use shorter time range |
| Missing data | API date range | Verify startDate/endDate |

---

## 🚀 Next: Wednesday

After Tuesday's real data integration, Wednesday will:
- Connect ContributionAnalyticsTab to analyzer endpoints
- Verify member contribution data flowing
- Test leaderboard data structures

---

**By end of Tuesday, Vault Analytics should display real financial metrics with real-time updates!** 📊
