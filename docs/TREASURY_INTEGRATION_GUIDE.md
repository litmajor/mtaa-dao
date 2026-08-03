# Treasury Mode + Real-Time Market Stream Integration

## Overview

Your trading hub now integrates with real smart contracts for live treasury data and real-time market streams. This document explains the architecture and how to set it up.

## ✅ What's Been Implemented

### 1. **Backend Treasury API** (`server/routes/treasury-data.ts`)
Real-time treasury data fetching from smart contracts:

```bash
GET /api/treasury/data/:daoId           # Complete treasury state
GET /api/treasury/holdings/:daoId       # Token holdings breakdown
GET /api/treasury/budget/:daoId         # Budget & expenses
GET /api/treasury/governance/:daoId     # Governance metrics
GET /api/treasury/health/:daoId         # Health score & alerts
```

**Features:**
- ✅ Fetches from MultiAssetVault contract (ETH, USDC, DAO tokens)
- ✅ Tracks governance weight from MtaaGovernance contract
- ✅ Budgets and expenses from database
- ✅ Automatic fallback to mock data if contract unavailable
- ✅ DAO membership authentication required

### 2. **React Hook** (`client/src/hooks/useTreasuryData.ts`)
```tsx
const { data, loading, error, health, lastUpdated, refetch } = useTreasuryData({
  daoId: 'dao-123',
  refreshInterval: 30000, // 30 seconds
  enabled: true
});
```

**Sub-hooks:**
- `useTreasuryHoldings(daoId)` - Just token holdings
- `useTreasuryBudget(daoId)` - Just budget data

### 3. **Treasury Mode Component** (`client/src/components/trading/TreasuryMode.tsx`)
Updated to use real data:
- ✅ Fetches treasury data on mount
- ✅ Auto-refreshes every 30 seconds
- ✅ Shows loading indicator while fetching
- ✅ Displays health score and alerts
- ✅ Falls back to mock data on errors

### 4. **Market Stream WebSocket** (`server/services/marketStreamService.ts`)
Real-time market data streaming:

```typescript
// Client side
const ws = new WebSocket('ws://localhost:3000/api/market-stream');
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log(`${update.exchange}: $${update.price} (${update.priceChange}%)`);
};
```

**Data Format:**
```typescript
interface MarketStreamUpdate {
  exchange: string;      // 'Binance', 'Kraken', etc
  price: number;        // Current price
  volume24h: number;    // 24h volume in USD
  priceChange: number;  // % change
  volumeChange: number; // % change
  timestamp: string;    // ISO timestamp
  liquidity: number;    // 0-100 score
}
```

---

## 🚀 Setup Instructions

### Step 1: Configure Contract Addresses

Create `.env.local` in project root:

```bash
# Copy from example
cp .env.local.example .env.local

# Then edit .env.local with your deployed addresses:
MULTI_ASSET_VAULT_ADDRESS=0x...          # Your MultiAssetVault address
MTAA_GOVERNANCE_ADDRESS=0x...             # Your MtaaGovernance address
MTAA_TOKEN_ADDRESS=0x...                  # Your MTAA token address
RPC_URL=https://alfajores-forno.celo-testnet.org
```

**To get contract addresses:**
```bash
cd contracts/
npx hardhat run scripts/deploy.ts --network alfajores
# Copy output addresses to .env.local
```

### Step 2: Verify Contract Deployment

```bash
# Check MultiAssetVault
npx hardhat verify --network alfajores <MULTI_ASSET_VAULT_ADDRESS>

# Check MtaaGovernance
npx hardhat verify --network alfajores <MTAA_GOVERNANCE_ADDRESS>
```

### Step 3: Start the Servers

```bash
# Terminal 1: Start backend + frontend
npm run dev

# Server will start on http://localhost:3000
# WebSocket endpoint: ws://localhost:3000/api/market-stream
# Treasury API: http://localhost:3000/api/treasury/*
```

### Step 4: Access the Trading Hub

1. Go to `http://localhost:3000/trading`
2. Select **Treasury Mode** (💰 button)
3. See real treasury data from your smart contract

---

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  React Component                         │
│              (client/TreasuryMode.tsx)                   │
└────────────────┬────────────────────────────────────────┘
                 │
         ┌───────┴────────┐
         │                │
    ┌────▼─────┐    ┌─────▼────┐
    │  useTreasury    │useMarketStream
    │  Data Hook      │Hook
    └────┬─────┘    └─────┬────┘
         │                │
    ┌────▼─────────────────▼────┐
    │   HTTP/WebSocket           │
    │   Client Library           │
    └────┬──────────────┬────────┘
         │              │
    ┌────▼──────┐  ┌───▼──────────┐
    │ REST API  │  │WebSocket      │
    │/api/      │  │/api/market    │
    │treasury/* │  │-stream        │
    └────┬──────┘  └───┬──────────┘
         │              │
    ┌────▼──────────────▼────────┐
    │   Express Middleware        │
    │   (routes.ts)              │
    └────┬───────────────────────┘
         │
    ┌────▼──────────────────────────┐
    │   Smart Contract Layer        │
    │   (blockchain.ts)             │
    └────┬───────────────────────────┘
         │
    ┌────▼──────────────────────────┐
    │   Ethereum RPC                │
    │   (Celo Alfajores testnet)    │
    └───────────────────────────────┘
```

---

## 💻 Example Usage

### In Trading Hub (Treasury Mode)

```tsx
import { TreasuryMode } from './components/trading/TreasuryMode';

export function TradingHub() {
  const [viewMode, setViewMode] = useState<string>('treasury');

  return (
    <>
      {viewMode === 'treasury' && <TreasuryMode exchanges={exchanges} />}
    </>
  );
}
```

### Direct Hook Usage

```tsx
import { useTreasuryData, useTreasuryHoldings } from './hooks/useTreasuryData';

function MyComponent() {
  // Full treasury data
  const { data, loading, error } = useTreasuryData({
    daoId: 'dao-123',
    refreshInterval: 30000,
  });

  // Just holdings
  const { holdings, totalValue } = useTreasuryHoldings('dao-123');

  if (loading) return <div>Loading treasury...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Total Assets: ${(data?.totalAssets / 1000000).toFixed(1)}M</h2>
      <h3>Holdings:</h3>
      <ul>
        {data?.tokenHoldings.map(h => (
          <li key={h.symbol}>
            {h.symbol}: {h.amount} tokens (${(h.value / 1000000).toFixed(2)}M)
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Market Stream WebSocket

```tsx
import { useMarketStream } from './hooks/useMarketStream';

function MarketPrices() {
  const { updates, connected, connectionStatus } = useMarketStream(exchanges, {
    enabled: true,
    updateInterval: 1000,
  });

  return (
    <div>
      <p>Status: {connectionStatus}</p>
      {updates && Array.from(updates.values()).map(update => (
        <div key={update.exchange}>
          {update.exchange}: ${update.price} ({update.priceChange}%)
        </div>
      ))}
    </div>
  );
}
```

---

## 🔧 Backend Routes Reference

### Treasury Data API

**GET `/api/treasury/data/:daoId`**
```json
{
  "success": true,
  "data": {
    "totalAssets": 48500000,
    "tokenHoldings": [
      {
        "symbol": "ETH",
        "name": "Ethereum",
        "amount": 15000,
        "value": 36750000,
        "allocation": 75.8,
        "decimals": 18,
        "address": "0x..."
      }
    ],
    "governanceWeight": 42.3,
    "monthlyBudget": 500000,
    "spentThisMonth": 287500,
    "lastUpdated": "2026-05-27T10:30:00Z",
    "daoId": "dao-123"
  }
}
```

**GET `/api/treasury/budget/:daoId`**
```json
{
  "success": true,
  "data": {
    "monthlyBudget": 500000,
    "spentThisMonth": 287500,
    "remaining": 212500,
    "usagePercentage": 57.5,
    "expenses": [
      {
        "id": "1",
        "name": "Developer Grants",
        "amount": 125000,
        "date": "2026-05-20",
        "category": "grants"
      }
    ]
  }
}
```

**GET `/api/treasury/health/:daoId`**
```json
{
  "success": true,
  "data": {
    "healthScore": 85,
    "alerts": [
      {
        "severity": "medium",
        "message": "Budget usage over 70%"
      }
    ],
    "lastChecked": "2026-05-27T10:30:00Z"
  }
}
```

---

## ⚡ Performance Optimization

### Auto-Refresh Tuning

```typescript
// Slower (better for production)
useTreasuryData({ refreshInterval: 60000 }); // 60 seconds

// Faster (for real-time dashboards)
useTreasuryData({ refreshInterval: 10000 }); // 10 seconds

// Disable auto-refresh (manual only)
useTreasuryData({ refreshInterval: Infinity });
```

### Selective Fetching

```typescript
// Only token holdings (faster)
const { holdings } = useTreasuryHoldings(daoId);

// Only budget (lightweight)
const { budget } = useTreasuryBudget(daoId);

// Full data (comprehensive)
const { data } = useTreasuryData(daoId);
```

---

## 🐛 Troubleshooting

### Contract Not Found
**Error:** "No contract found at address 0x..."

**Solution:**
1. Verify contract is deployed: `npx hardhat verify --network alfajores <ADDRESS>`
2. Check `.env.local` has correct addresses
3. Confirm RPC_URL is correct

### WebSocket Connection Fails
**Error:** "Failed to connect to WebSocket"

**Solution:**
```bash
# Check server is running
curl http://localhost:3000/api/health

# Check WebSocket endpoint
wscat -c ws://localhost:3000/api/market-stream
```

### Mock Data Showing Instead of Real
**Expected:** Component uses mock data when contract is unavailable

**To use real data:**
1. Deploy contracts to Celo
2. Set `MULTI_ASSET_VAULT_ADDRESS` and `MTAA_GOVERNANCE_ADDRESS` in `.env.local`
3. Restart backend: `npm run dev`

---

## 📝 Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `MULTI_ASSET_VAULT_ADDRESS` | ❌ | 0x0...0 | MultiAssetVault contract |
| `MTAA_GOVERNANCE_ADDRESS` | ❌ | 0x0...0 | Governance token contract |
| `MTAA_TOKEN_ADDRESS` | ❌ | 0x0...0 | DAO token contract |
| `RPC_URL` | ✅ | Celo Alfajores | Blockchain RPC endpoint |
| `VITE_TREASURY_REFRESH_INTERVAL` | ❌ | 30000 | Auto-refresh interval (ms) |
| `VITE_MARKET_STREAM_ENDPOINT` | ❌ | ws://localhost:3000 | WebSocket endpoint |

---

## 🚀 Next Steps

1. **Deploy Contracts** (`contracts/MultiAssetVault.sol`, `MtaaGovernance.sol`)
2. **Configure Addresses** (`.env.local`)
3. **Connect Real Data** (Update ABIs if contracts differ)
4. **Test Integration** (Run `npm run dev` and visit trading hub)
5. **Optimize** (Adjust refresh intervals for your use case)

---

## 📚 Related Files

- **Backend Treasury API:** `server/routes/treasury-data.ts`
- **Market Stream Service:** `server/services/marketStreamService.ts`
- **React Hooks:** `client/src/hooks/useTreasuryData.ts`
- **Treasury Component:** `client/src/components/trading/TreasuryMode.tsx`
- **Main Router Config:** `server/routes.ts` (line ~358)
- **Server Initialization:** `server/index.ts` (line ~336)
- **Smart Contracts:** `contracts/MultiAssetVault.sol`, `MtaaGovernance.sol`

---

## 💡 Advanced: Custom Price Oracle

To replace the mock price oracle:

**File:** `server/routes/treasury-data.ts`, function `getTokenPrice()`

```typescript
async function getTokenPrice(tokenSymbol: string): Promise<number> {
  // Example: Use CoinGecko API
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${tokenSymbol.toLowerCase()}&vs_currencies=usd`
  );
  const data = await response.json();
  return data[tokenSymbol.toLowerCase()]?.usd || 0;
}
```

---

## 🔐 Security Notes

- ✅ All treasury endpoints require authentication (`isAuthenticated` middleware)
- ✅ DAO membership validation enforced
- ✅ RPC calls validated for contract existence
- ✅ Mock data fallback prevents service disruption
- ✅ WebSocket uses optional token authentication

---

## 📞 Support

For issues:
1. Check `npm run dev` output for error logs
2. Verify `.env.local` configuration
3. Run `curl http://localhost:3000/api/health` for system health
4. Check smart contract ABIs match deployed contracts
