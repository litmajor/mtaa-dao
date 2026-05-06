# 🚀 Unified Dashboard - Quick Start Reference

## What's New

You now have a complete **Unified Dashboard** replacing the old dashboard with:
- ✅ Real-time data from backend (port 5000)
- ✅ Trading integration (quick order, smart routing, history)
- ✅ 5 tabs: Overview, DAOs, Assets, Activity, Trading
- ✅ WebSocket support for live updates
- ✅ Responsive design (mobile + desktop)

---

## Quick Navigation

| Action | How |
|--------|-----|
| **View Dashboard** | Go to http://localhost:3000/unified-dashboard |
| **Backend API** | http://localhost:5000/api/* |
| **Check API Health** | `curl http://localhost:5000/api/dashboard/metrics` |
| **View Protocol** | http://localhost:3000/protocol |

---

## Port Configuration

```
Frontend: http://localhost:3000    ← You access dashboard here
           ↓ (REST API calls)
Backend:  http://localhost:5000    ← Backend APIs served here
           ↓ (WebSocket)
WebSocket: ws://localhost:5000     ← Real-time updates
```

---

## 20+ Backend APIs Ready

```
📊 Dashboard
  GET /api/dashboard/metrics
  GET /api/morio/overview

🏛️ DAO Management
  GET /api/daos
  GET /api/dao/:id/metrics

📈 Analytics (Elders)
  GET /api/elders/kaizen/all-metrics
  GET /api/elders/kaizen/dao/:id/metrics
  GET /api/elders/kaizen/dao/:id/recommendations

💱 Trading & Arbitrage
  GET /api/discover/arbitrage
  GET /api/discover/arbitrage/:symbol

📊 Market Data
  GET /api/exchanges/prices?pair=BTC/USDT
  GET /api/exchanges/market-data

🌍 Global Metrics
  GET /api/global-metrics

📋 Activity Logs
  GET /api/admin/activity-logs

💾 Assets
  GET /api/discover/assets
```

---

## 5 Dashboard Tabs

1. **Overview** - Your DAOs + aggregated balance (30-60s refresh)
2. **DAOs** - Detailed DAO view with all metrics (60s refresh)
3. **Assets** - Asset breakdown across all DAOs (60s refresh)
4. **Activity** - Real-time feed of opportunities & events (10-60s + WebSocket)
5. **Trading** - Quick orders, smart routing, history (5s + WebSocket)

---

## Getting Started

```bash
# Terminal 1: Backend
cd server && npm run dev
# Runs on http://localhost:5000

# Terminal 2: Frontend  
cd client && npm run dev
# Runs on http://localhost:3000

# Then visit:
# http://localhost:3000/unified-dashboard
```

---

## Files Created

| File | Purpose | Size |
|------|---------|------|
| `unified-dashboard.tsx` | Main dashboard component | 300+ lines |
| `useWebSocket.ts` | Real-time WebSocket hooks | 400+ lines |
| `useDashboardData.ts` | React Query data hooks | 240 lines |
| `apiConfig.ts` | API configuration | 130 lines |

---

## Data Refresh Intervals

| Data | Interval | How |
|------|----------|-----|
| Market Prices | 5s | REST + WebSocket |
| Activity | 10s | REST + WebSocket |
| Arbitrage | 15s | REST API |
| Metrics | 30-60s | REST API |

---

## Testing

✅ Navigate to `/unified-dashboard`
✅ Check DevTools Network tab for API calls
✅ Watch prices update every 5 seconds
✅ See WebSocket connection in Console
✅ Try switching tabs - each loads data

---

## Documentation

- `UNIFIED_DASHBOARD_BACKEND_INTEGRATION_COMPLETE.md` - Full architecture guide
- `UNIFIED_DASHBOARD_DESIGN_TREEVIEW.md` - Visual design specs
- `UNIFIED_DASHBOARD_FULL_PICTURE.md` - Feature inventory

---

**Status**: 🚀 Ready to test! Dashboard is fully integrated with backend APIs and real-time updates.
