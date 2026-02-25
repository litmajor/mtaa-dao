# 🚀 API Backend - Quick Start Guide

**Setup**: 5 minutes  
**Status**: Production Ready ✅  

---

## 📍 Architecture Overview

```
┌───────────────────────────────────────────────────────────┐
│             Single Express App (Port 5000)                 │
│                                                            │
│  ✅ Frontend Server (Vite)                                │
│     └── localhost:3000/5173 (dev) or 5000 (prod)          │
│                                                            │
│  ✅ Web Routes                                            │
│     ├── /api/users, /api/governance, /api/treasury       │
│     ├── /api/morio (Agent routes)                         │
│     └── WebSockets for real-time                          │
│                                                            │
│  ✅ NEW API Routes (Just Added!)                          │
│     ├── /api/dex/*          (DexScreener - 8 endpoints)  │
│     └── /api/freqtrade/*    (Freqtrade - 6 endpoints)    │
│                                                            │
│  ✅ Core Services                                         │
│     ├── NURU Agent                                        │
│     ├── KWETU Agent                                       │
│     ├── Symbol Universe                                   │
│     ├── Intelligence Shards                               │
│     └── Gateway Agents                                    │
└───────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Start

**Single command - Everything runs together!**

```bash
npm run dev
```

This starts:
- Frontend (Vite dev server on port 3000 or 5173)
- Backend API server on port 5000
- All services (NURU, KWETU, Symbol Universe, etc.)
- **DexScreener API endpoints** (/api/dex/*)
- **Freqtrade API endpoints** (/api/freqtrade/*)

**All in one process!**

---

### Production Build

```bash
# Build
npm run build

# Run
npm start
```

---

## ✅ Verify It's Working

### Test Main App
```bash
curl http://localhost:3000
# Should return HTML or redirect
```

### Test API Backend
```bash
curl http://localhost:5000/health
# Should return:
# {
#   "status": "healthy",
#   "service": "mtaa-api-backend",
#   "port": 5000,
#   "apis": {
#     "dexscreener": "running",
#     "freqtrade": "running"
#   }
# }
```

### Test DexScreener API
```bash
curl "http://localhost:5000/api/dex/search-pairs?q=ETH&limit=5"
# Should return: { pairs: [...], total: 5, cached: false, timestamp: "..." }
```

### Test Freqtrade API
```bash
curl http://localhost:5000/api/freqtrade/strategies
# Should return: { strategies: [...], total: 2, timestamp: "..." }
```

---

## 📊 API Endpoints at a Glance

### DexScreener API (`http://localhost:5000/api/dex`)

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Service health |
| `GET /search-pairs?q=ETH` | Search pairs by symbol |
| `GET /pairs/{chain}/{address}` | Get pair details |
| `GET /token-pairs/{chain}/{address}` | Get all pairs for token |
| `GET /trending-pairs?chain=ethereum` | Find trending pairs |
| `POST /symbol-universe/sync` | Discover new tokens |
| `GET /cache/stats` | Cache information |
| `DELETE /cache/clear` | Clear response cache |

### Freqtrade API (`http://localhost:5000/api/freqtrade`)

| Endpoint | Purpose |
|----------|---------|
| `GET /strategies` | List all strategies |
| `POST /strategies/upload` | Upload new strategy |
| `POST /strategies/{id}/backtest` | Run backtest |
| `POST /strategies/{id}/hyperopt` | Optimize parameters |
| `GET /strategies/{id}/performance` | Get metrics |
| `POST /strategies/{id}/deploy` | Deploy strategy |

---

## 🔧 Common Commands

### Development
```bash
npm run dev              # Main app + all APIs (DexScreener + Freqtrade)
```

### Build & Production
```bash
npm run build           # Build everything
npm start               # Run everything on port 5000
```

### Checking
```bash
npm run check           # TypeScript check
npm run lint            # ESLint check
npm run format          # Format code
```

---

## 📡 How Components Work Together

### Portfolio Analysis (NURU)
```
User: "Analyze my portfolio"
    ↓
Main App (port 5000)
    ↓
NURU Agent → symbolUniverse
    ↓
Calls /api/dex/trending-pairs (same port!)
    ↓
Response with category risks & recommendations
```

### Strategy Backtesting (Freqtrade)
```
User: "Test my strategy"
    ↓
Main App uploads code
    ↓
Calls /api/freqtrade/strategies/upload (same server!)
POST /api/freqtrade/strategies/{id}/backtest
    ↓
Returns backtest results with metrics
```

---

## 🔐 Security Notes

### CORS Configuration
API Backend allows requests from:
- `http://localhost:3000` (main app)
- `http://localhost:5173` (Vite dev)
- `http://localhost:3001` (admin panel)

### Rate Limiting
All endpoints have per-minute limits:
- Search: 60/min
- Pair details: 300/min
- Trending: 30/min
- Backtest: 5/min
- Hyperopt: 2/min

### Authentication
- Public endpoints: No auth needed
- Protected endpoints: JWT token required

---

## 🆘 Troubleshooting

### "Cannot find module" when running dev
```bash
# Make sure you're in repo root
cd e:\repos\litmajor\mtaa-dao

# Install dependencies
npm install

# Try again
npm run dev
```

### Port 5000 already in use
```bash
# The main app is claiming port 5000
# Check what's using it:
netstat -ano | findstr :5000

# Kill it
taskkill /PID <PID> /F

# Try again
npm run dev
```

### API endpoints returning 404
```bash
# Make sure main app is running
npm run dev

# Then test from another terminal:
curl http://localhost:5000/api/dex/health

# If still 404, check that routes are mounted in server/index.ts
# (Lines ~643-644 should have the dex and freqtrade routes)
```

### "Rate limit exceeded"
```bash
# Each endpoint has per-minute limits
# Wait 1 minute and retry
# Or add your JWT token with admin claims

curl -H "Authorization: Bearer <your_token>" \
  http://localhost:5000/api/dex/search-pairs?q=ETH
```

---

## 📊 Monitoring

### Check Backend Status
```bash
curl http://localhost:5000/status | jq
```

Response shows:
- Memory usage
- Uptime
- Which APIs are running
- Number of endpoints

### Check Cache Performance
```bash
curl http://localhost:5000/api/dex/cache/stats
```

Response shows:
- Cache size
- TTL (5 minutes)
- Hit/miss rates

---

## 🎯 Next Steps

1. **Run both servers**:
   ```bash
   npm run dev:full
   ```

2. **Test the APIs**:
   ```bash
   # Trending pairs
   curl "http://localhost:5000/api/dex/trending-pairs?chain=ethereum"
   
   # List strategies
   curl http://localhost:5000/api/freqtrade/strategies
   ```

3. **Integrate into your app**:
   ```typescript
   // From main app (port 3000)
   const response = await fetch('http://localhost:5000/api/dex/search-pairs?q=ETH');
   const data = await response.json();
   ```

4. **Deploy strategies**:
   Use `/api/freqtrade/strategies/{id}/deploy` endpoints

---

## 📚 Full Documentation

For complete API reference, see:
- [**API_BACKEND_ENDPOINTS.md**](./API_BACKEND_ENDPOINTS.md) - Full endpoint listing
- [**BACKEND_TYPESCRIPT_MIGRATION.md**](./BACKEND_TYPESCRIPT_MIGRATION.md) - Migration details
- [**server/backend-server.ts**](./server/backend-server.ts) - Source code
- [**server/api/dex-screener.ts**](./server/api/dex-screener.ts) - DexScreener handlers
- [**server/api/freqtrade.ts**](./server/api/freqtrade.ts) - Freqtrade handlers

---

## ✨ Summary

| Component | Port | Purpose |
|-----------|------|---------|
| Main App | 5000 | Everything: Web UI + DexScreener + Freqtrade + all services |
| Frontend UI | 3000 (dev) | Vite dev server for development |

**Status**: ✅ All systems operational

Start with `npm run dev` and you're good to go! 🚀
- - - 
 
 # #   F A Q 
 
 # # #   Q :   W h y   i s   t h e r e   n o   s e p a r a t e   b a c k e n d   s e r v e r ? 
 * * A * * :   D e x S c r e e n e r   a n d   F r e q t r a d e   A P I s   a r e   i n t e g r a t e d   i n t o   t h e   m a i n   E x p r e s s   a p p   o n   p o r t   5 0 0 0 .   T h i s   e l i m i n a t e s   d e p l o y m e n t   c o m p l e x i t y ,   s i m p l i f i e s   n e t w o r k i n g ,   a n d   m a k e s   d e v e l o p m e n t   t r i v i a l   ( s i n g l e   \ 
 p m   r u n   d e v \   c o m m a n d ) . 
 
 # # #   Q :   C a n   I   e d i t   j u s t   D e x S c r e e n e r   o r   F r e q t r a d e ? 
 * * A * * :   Y e s ,   t h e y ' r e   m o d u l a r : 
 -   \ s e r v e r / a p i / d e x - s c r e e n e r . t s \   -   B u s i n e s s   l o g i c   ( 4 4 5   l i n e s )     
 -   \ s e r v e r / a p i / f r e q t r a d e . t s \   -   B u s i n e s s   l o g i c   ( 3 0 0   l i n e s ) 
 -   \ s e r v e r / r o u t e s / d e x - s c r e e n e r . t s \   -   R o u t e s   +   r a t e   l i m i t i n g 
 -   \ s e r v e r / r o u t e s / f r e q t r a d e . t s \   -   R o u t e s   +   r a t e   l i m i t i n g 
 
 # # #   Q :   A r e   e n d p o i n t s   p r o d u c t i o n - r e a d y ? 
 * * A * * :   D e x S c r e e n e r   i s   f u l l y   r e a d y   w i t h   5 - m i n   c a c h i n g .   F r e q t r a d e   i s   m o c k - r e a d y ;   w r a p   r e a l   F r e q t r a d e   C L I   f o r   l i v e   t r a d i n g . 
 
 # # #   Q :   H o w   d o   N U R U / K W E T U   c a l l   t h e s e   A P I s ? 
 * * A * * :   T h e   s a m e   w a y   a s   a n y   H T T P   c l i e n t : 
 \ \ \ 	 y p e s c r i p t 
 c o n s t   r e s p o n s e   =   a w a i t   f e t c h ( ' h t t p : / / l o c a l h o s t : 5 0 0 0 / a p i / d e x / s e a r c h - p a i r s ? q = E T H ' ) ; 
 \ \ \ 
 
 # # #   Q :   W h y   r a t e   l i m i t s ? 
 * * A * * :   R e s o u r c e   p r o t e c t i o n .   D e x S c r e e n e r :   6 0   r e q / m i n .   F r e q t r a d e   b a c k t e s t :   5   r e q / m i n .   H y p e r o p t :   2   r e q / m i n .   A d m i n   J W T   b y p a s s e s   a l l . 
 
 