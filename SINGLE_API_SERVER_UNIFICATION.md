# API Server Unification - Single Server Strategy

## Current Architecture

Your application has **ONE Express.js API server**:
- **Primary Server**: Node.js/Express on port 5000
- **Address**: `http://localhost:5000`
- **File**: `server/index.ts`
- **Type**: Full-stack (handles API routes, static files, WebSocket)

## Backend Integration Status

The FastAPI Python services (market_aggregator.py, markets.py routes) are **design specifications** but NOT separate servers.

### Current State:
- ✅ One Express server (5000) - Running
- ⚠️ FastAPI routes documented but not running as separate service
- ✅ All market data routes defined in backend/routes/markets.py (Python)
- ✅ Market aggregator service ready (backend/services/market_aggregator.py)

## 🎯 Unification Strategy

### Option 1: Keep Express.js as Single Server (RECOMMENDED)
**Status**: Current setup

Keep all API requests going to the Express server on port 5000.

```
User Frontend (React)
    ↓
Express Server (Port 5000)
    ├── /api/... (all routes)
    ├── Static files
    └── WebSocket
```

### Option 2: Integrate FastAPI into Express Server
Bridge Python services into Express through child processes or HTTP calls.

```
Express Server (Port 5000)
    ├── Node.js routes
    └── Python services (subprocess)
        ├── market_aggregator
        ├── signals
        └── strategies
```

### Option 3: Unified Architecture with Proxy
Run both Express and FastAPI, with Express as gateway.

```
Express Gateway (Port 5000)
    ├── Routes to /api/* → Express handlers
    ├── Routes to /api/yuki/* → FastAPI (8000) via proxy
    └── Routes to /api/other/* → Other services
```

## ✅ Recommended Setup: Single Express Server

**Why:**
1. Already configured and running
2. Handles full stack (API + static + WebSocket)
3. Simpler deployment
4. Easier CORS/auth configuration
5. No proxy complexity

**Implementation:**

### Current Express Server (`server/index.ts`)
```typescript
const PORT = 5000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log('[STARTUP] ✅ Server listening on port 5000');
});
```

### Verify Single Server
```bash
# Check what's listening
netstat -ano | findstr "LISTENING"  # Windows

# Or on Linux/Mac
lsof -i -P -n | grep LISTEN

# Should show ONLY:
# Port 5000 - Express (Node.js)
# Port 5173 - Vite dev (frontend only, in dev mode)
```

### All API Routes Go Through Express
```
Frontend API calls → http://localhost:5000/api/*
No separate FastAPI needed
No proxy configuration needed
```

## 📋 Current Express Routes

Verify all routes are mounted in `server/index.ts`:

```typescript
// Line ~50-80 in server/index.ts
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/vault', vaultRoutes);
// ... more routes

// Market routes should be here:
app.use('/api/yuki/markets', marketRoutes);  // Add if not present
```

## 🔧 Configuration Checklist

### ✅ Single Server Verification

1. **Port Configuration**
   - Express: Port 5000 ✓
   - Frontend (dev): Port 5173 ✓
   - No FastAPI server running ✓
   - No other backends on different ports

2. **API Endpoints**
   - All routes served from http://localhost:5000
   - Frontend calls: `fetch('/api/...')`
   - No proxy rewrites needed
   - No CORS issues between services

3. **Environment Variables**
   ```
   NODE_ENV=development
   PORT=5000
   FRONTEND_URL=http://localhost:5173
   BACKEND_URL=http://localhost:5000
   # NO PYTHON_PORT, FASTAPI_HOST, or similar
   ```

4. **Docker/Deployment**
   - One Dockerfile for Node server
   - All dependencies in package.json
   - No docker-compose with multiple services

## 🚀 Ensure Single Server in Production

### Deployment Setup
```yaml
# docker-compose.yml (SIMPLIFIED)
version: '3.9'
services:
  backend:
    build: .
    ports:
      - "5000:5000"
    environment:
      NODE_ENV: production
      PORT: 5000
    # NO separate services for Python/FastAPI
```

### Environment Variables
```env
# .env (Production)
NODE_ENV=production
PORT=5000  # Only one port needed
# No PYTHON_PORT=8000
# No FASTAPI_HOST settings
```

### Nginx Configuration (if needed)
```nginx
# One upstream, one server block
upstream backend {
  server localhost:5000;
}

server {
    listen 80;
    server_name api.example.com;
    
    location / {
        proxy_pass http://backend;
    }
    # NO /api/yuki → separate_host proxy
    # Everything routes to same backend
}
```

## 🔄 Frontend API Configuration

### useApi Hook (`frontend/src/hooks/useApi.ts`)
```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// All calls go to same server:
export const useApi = () => {
  const get = async (endpoint: string) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    return response.json();
  };
  
  return { get };
};
```

### Market Data Hook
```typescript
// frontend/src/hooks/useMarketData.ts
const response = await get(`/api/yuki/markets/search?q=${pair}`);
// Resolves to: http://localhost:5000/api/yuki/markets/search?q=BTC/USDT
```

## ✅ Market Explorer Integration (Single Server)

### 1. Verify Routes Mounted
In `server/index.ts`, ensure:
```typescript
import marketRoutes from './routes/markets';  // Not FastAPI routes
app.use('/api/yuki/markets', marketRoutes);    // Express routes only
```

### 2. Implementation in Express
Since market_aggregator.py is a Python service, either:

**Option A: Implement in TypeScript/Node.js**
```typescript
// server/routes/markets.ts
import { Router } from 'express';
import { MarketAggregator } from '../services/marketAggregator';

const router = Router();
const aggregator = new MarketAggregator();

router.get('/search', async (req, res) => {
  const { q } = req.query;
  const data = await aggregator.getPairMarketData(q);
  res.json({ status: 'success', ...data });
});

export default router;
```

**Option B: Call Python as Child Process**
```typescript
// server/services/marketAggregator.ts
import { spawn } from 'child_process';

export async function getPrices(pair: string) {
  return new Promise((resolve, reject) => {
    const py = spawn('python', ['./backend/services/market_aggregator.py', pair]);
    
    let output = '';
    py.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    py.on('close', (code) => {
      resolve(JSON.parse(output));
    });
  });
}
```

**Option C: Call FastAPI via HTTP (if needed)**
```typescript
// server/routes/markets.ts
async function getMarketData(pair: string) {
  const response = await fetch(`http://localhost:8000/markets/search?q=${pair}`);
  return response.json();
}
```

## 🚨 What NOT to Do

❌ **Don't** run FastAPI on port 8000 AND Express on 5000
```bash
# WRONG:
npm start          # Express on 5000
python ...         # FastAPI on 8000 (SEPARATE)
```

❌ **Don't** use multiple docker-compose services
```yaml
# WRONG:
services:
  node:
    ports: ["5000:5000"]
  python:
    ports: ["8000:8000"]  # WRONG - Multiple servers
```

❌ **Don't** have separate API base URLs
```typescript
// WRONG:
const MARKET_API = 'http://localhost:8000';  // Different server
const MAIN_API = 'http://localhost:5000';    // Different server
```

## ✅ Current Status

| Component | Status | Location |
|-----------|--------|----------|
| Express Server | ✅ Running | server/index.ts (Port 5000) |
| API Routes | ✅ Defined | server/routes/* |
| Frontend | ✅ Dev | client/ (Port 5173) |
| Market Routes | ✅ Ready | backend/routes/markets.py |
| Aggregator Service | ✅ Ready | backend/services/market_aggregator.py |
| Separate FastAPI | ❌ Not Needed | - |

## 📝 Next Steps

1. **Verify Single Server**
   ```bash
   npm start  # Should only start Express on 5000
   # Check: No FastAPI, no other ports
   ```

2. **Mount Market Routes**
   ```typescript
   // In server/index.ts
   import marketRoutes from './routes/markets';
   app.use('/api/yuki/markets', marketRoutes);
   ```

3. **Test Unified API**
   ```bash
   curl http://localhost:5000/api/yuki/markets/search?q=BTC/USDT
   ```

4. **Verify Frontend Calls**
   - Market Explorer component calls `/api/yuki/markets/*`
   - useMarketData hook uses same base URL
   - All requests go to Port 5000

## 📚 Documentation Files

- [Market Explorer Integration](./MARKET_EXPLORER_INTEGRATION.md) - API specifications
- [Server Configuration](./server/index.ts) - Express server setup
- [API Routes](./server/routes/) - All endpoint definitions

---

**Summary**: Your architecture should have **ONE API server** (Express on port 5000). No separate FastAPI server. All routes, including market data, handled by the same Express backend.
