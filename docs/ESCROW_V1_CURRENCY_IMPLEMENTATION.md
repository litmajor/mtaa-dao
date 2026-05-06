# Escrow V1 Currency & Multi-Asset Implementation

## Overview

The V1 Escrow system now supports **multi-asset payments** with **stablecoins as the default** and flexibility for other tokens. This document details the currency configuration and implementation.

---

## Supported Currencies

### Category 1: Primary (Stablecoins - RECOMMENDED) 🟢
These are the recommended options for most users:

| Currency | Symbol | Chain | Decimals | Use Case |
|----------|--------|-------|----------|----------|
| **Celo Dollar** | `cUSD` | Celo | 18 | ✅ **DEFAULT** - Fast, stable, lowest fees |
| **USD Coin** | `USDC` | Multi-chain | 6 | ✅ Regulated stablecoin, high liquidity |
| **Tether USD** | `USDT` | Multi-chain | 6 | ✅ Most widely used stablecoin |

### Category 2: Secondary (Regional Stablecoins) 🟡
Alternative stablecoins for specific regions:

| Currency | Symbol | Chain | Decimals | Use Case |
|----------|--------|-------|----------|----------|
| **Celo Euro** | `cEUR` | Celo | 18 | EU transactions (pegged to EUR) |
| **Celo Kenyan Shilling** | `cKES` | Celo | 18 | Kenya transactions (pegged to KES) |

### Category 3: Tertiary (Other Assets) 🔴
Non-stablecoin assets (volatile):

| Currency | Symbol | Chain | Decimals | Use Case |
|----------|--------|-------|----------|----------|
| **Celo Native** | `CELO` | Celo | 18 | On-chain gas, governance token |
| **Ethereum** | `ETH` | Ethereum | 18 | Cross-chain payments, bridge to Ethereum |

---

## Implementation Details

### Backend Configuration

**File**: `server/routes/v1/wallets/escrow.ts`

```typescript
export const SUPPORTED_CURRENCIES = {
  // Primary: Stablecoins (recommended)
  'cUSD': { name: 'Celo Dollar', isStablecoin: true, chain: 'celo', decimals: 18, category: 'primary' },
  'USDC': { name: 'USD Coin', isStablecoin: true, chain: 'multi', decimals: 6, category: 'primary' },
  'USDT': { name: 'Tether USD', isStablecoin: true, chain: 'multi', decimals: 6, category: 'primary' },
  
  // Secondary: Regional stablecoins
  'cEUR': { name: 'Celo Euro', isStablecoin: true, chain: 'celo', decimals: 18, category: 'secondary' },
  'cKES': { name: 'Celo Kenyan Shilling', isStablecoin: true, chain: 'celo', decimals: 18, category: 'secondary' },
  
  // Tertiary: Non-stablecoins (volatile)
  'CELO': { name: 'Celo Native', isStablecoin: false, chain: 'celo', decimals: 18, category: 'tertiary' },
  'ETH': { name: 'Ethereum', isStablecoin: false, chain: 'ethereum', decimals: 18, category: 'tertiary' },
};
```

### Database Storage

The `escrowAccounts` table stores currency information:

```typescript
// Column: currency (varchar, not null, default: 'cUSD')
currency: 'cUSD' | 'USDC' | 'USDT' | 'cEUR' | 'cKES' | 'CELO' | 'ETH'

// Metadata: Additional currency info
metadata: {
  currencyInfo: {
    name: string,
    isStablecoin: boolean,
    chain: string,
    decimals: number,
    category: 'primary' | 'secondary' | 'tertiary'
  }
}
```

### Validation

All endpoints use Zod schemas to validate currency input:

```typescript
const currencySchema = z.enum(['cUSD', 'USDC', 'USDT', 'cEUR', 'cKES', 'CELO', 'ETH']).default('cUSD');

// Example: Create escrow request
{
  "payeeId": "user-123",
  "amount": "100",
  "currency": "cUSD",  // Optional: defaults to cUSD
  "milestones": [...]
}
```

---

## API Endpoints

### Get Supported Currencies (NEW)

```http
GET /api/v1/wallets/escrow/currencies
```

**Response**:
```json
{
  "success": true,
  "currencies": [
    {
      "symbol": "cUSD",
      "name": "Celo Dollar",
      "isStablecoin": true,
      "chain": "celo",
      "decimals": 18,
      "category": "primary",
      "default": true
    },
    // ... more currencies
  ],
  "grouped": {
    "primary": [...],
    "secondary": [...],
    "tertiary": [...]
  },
  "default": "cUSD",
  "recommended": [...],
  "description": "Primary: Stablecoins (recommended) | Secondary: Regional stablecoins | Tertiary: Other assets"
}
```

### Create Escrow with Currency

```http
POST /api/v1/wallets/escrow
Content-Type: application/json

{
  "payeeId": "user-456",
  "amount": "50.50",
  "currency": "USDC",  // Default: cUSD
  "milestones": [
    {
      "description": "Initial deliverable",
      "amount": "25.25"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "escrow": {
    "id": "escrow-123",
    "payerId": "user-123",
    "payeeId": "user-456",
    "amount": "50.50",
    "currency": "USDC",
    "status": "pending",
    "metadata": {
      "currencyInfo": {
        "name": "USD Coin",
        "isStablecoin": true,
        "chain": "multi",
        "decimals": 6,
        "category": "primary"
      }
    }
  },
  "currency": "USDC",
  "currencyInfo": {
    "name": "USD Coin",
    "isStablecoin": true,
    "chain": "multi",
    "decimals": 6,
    "category": "primary"
  }
}
```

### Initiate Escrow with Invite

```http
POST /api/v1/wallets/escrow/initiate
Content-Type: application/json

{
  "recipient": "john@example.com",
  "amount": "100",
  "currency": "cEUR",  // Default: cUSD
  "description": "Payment for consulting work"
}
```

---

## Client Implementation Guide

### Currency Selection Dropdown

**React Component**:

```tsx
import { useQuery } from '@tanstack/react-query';

function EscrowForm() {
  const { data: supportedCurrencies } = useQuery({
    queryKey: ['escrow-currencies'],
    queryFn: async () => {
      const res = await fetch('/api/v1/wallets/escrow/currencies');
      return res.json();
    }
  });

  if (!supportedCurrencies) return <div>Loading...</div>;

  return (
    <form>
      <label>Recipient</label>
      <input type="email" name="recipient" required />
      
      <label>Amount</label>
      <input type="number" name="amount" step="0.01" required />
      
      <label>Currency</label>
      <select name="currency" defaultValue="cUSD">
        {/* Primary (Recommended) */}
        <optgroup label="Recommended Stablecoins">
          {supportedCurrencies.grouped.primary.map(c => (
            <option key={c.symbol} value={c.symbol}>
              {c.symbol} ({c.name})
            </option>
          ))}
        </optgroup>
        
        {/* Secondary */}
        <optgroup label="Regional Stablecoins">
          {supportedCurrencies.grouped.secondary.map(c => (
            <option key={c.symbol} value={c.symbol}>
              {c.symbol} ({c.name})
            </option>
          ))}
        </optgroup>
        
        {/* Tertiary */}
        <optgroup label="Other Assets (Volatile)">
          {supportedCurrencies.grouped.tertiary.map(c => (
            <option key={c.symbol} value={c.symbol}>
              {c.symbol} ({c.name})
            </option>
          ))}
        </optgroup>
      </select>
      
      <button type="submit">Create Escrow</button>
    </form>
  );
}
```

---

## Security Considerations

### 1. Currency Validation
- All endpoints validate currency against the supported list
- Invalid currencies are rejected with a 400 status
- Client receives list of supported currencies for validation

### 2. Decimal Precision
- Uses PostgreSQL `decimal(18, 8)` for precise financial calculations
- JavaScript BigInt or Decimal.js for amount handling (frontend)
- Prevents floating-point precision errors

### 3. Cross-Chain Payments
- Multi-chain tokens (USDC, USDT) are supported but escrow doesn't handle bridging
- Payment gateway (`/api/v1/wallets/rails/*`) handles actual transfer logic
- Escrow tracks *intended* asset, not actual transfer mechanism

### 4. Stablecoin vs Non-Stablecoin
- Metadata flags `isStablecoin` for UI/UX differentiation
- No enforcement of stablecoin-only (allows flexibility)
- Clients should warn users about volatile assets

---

## Future Expansion

### Adding New Tokens

**Step 1**: Update `SUPPORTED_CURRENCIES` in `escrow.ts`:

```typescript
export const SUPPORTED_CURRENCIES = {
  // ... existing currencies
  'USDE': {
    name: 'Ethena USDe',
    isStablecoin: true,
    chain: 'ethereum',
    decimals: 18,
    category: 'primary'
  },
  'MTAA': {
    name: 'MTAA Community Token',
    isStablecoin: false,
    chain: 'celo',
    decimals: 18,
    category: 'tertiary'
  }
};
```

**Step 2**: Update Zod schema:

```typescript
const currencySchema = z.enum([
  'cUSD', 'USDC', 'USDT', 'cEUR', 'cKES', 'CELO', 'ETH',
  'USDE', 'MTAA'  // ← Add new
]).default('cUSD');
```

**Step 3**: Update token registry if needed:

```typescript
// shared/tokenRegistry.ts
const TOKEN_REGISTRY = {
  // ... existing
  USDE: { /* ... */ },
  MTAA: { /* ... */ }
};
```

### Custom Token Support (Future)

```typescript
// Allow arbitrary ERC20 addresses (future phase)
const customTokenSchema = z.object({
  symbol: z.string().max(20),
  customAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  decimals: z.number().min(0).max(18),
  name: z.string()
});
```

---

## Fees & Gas Considerations

### By Blockchain

| Chain | Gas Token | Escrow Transfer Cost |
|-------|-----------|----------------------|
| **Celo** | CELO | ~0.01 CELO (~$0.005) |
| **Ethereum** | ETH | ~$5-50 (varies with network) |
| **Polygon** | MATIC | ~$0.50 |
| **BSC** | BNB | ~$0.50 |

### Recommendations
- **cUSD**: Best for small escrows (<$100) due to low fees
- **USDC/USDT**: Good for medium escrows ($100-$10k)
- **CELO/ETH**: Good for large escrows (>$10k) where fees are small proportion

---

## Testing

### Test All Currencies

```bash
# Create escrow with each currency
POST /api/v1/wallets/escrow
{
  "payeeId": "test-user-2",
  "amount": "50",
  "currency": "cUSD"  # ← Change for each test
}

# Expected: 201 Created with currency metadata
```

### Test Default Currency

```bash
POST /api/v1/wallets/escrow
{
  "payeeId": "test-user-2",
  "amount": "50"
  # No currency specified
}

# Expected: Currency defaults to "cUSD"
```

### Test Invalid Currency

```bash
POST /api/v1/wallets/escrow
{
  "payeeId": "test-user-2",
  "amount": "50",
  "currency": "DOGE"  # Not supported
}

# Expected: 400 Bad Request with supported currencies list
```

---

## Monitoring & Logging

All escrow operations log currency information:

```typescript
// Logs include:
{
  timestamp: "2026-03-17T10:30:00Z",
  operation: "escrow_created",
  escrowId: "escrow-123",
  currency: "cUSD",
  currencyInfo: { ... },
  amount: "100",
  payerId: "user-123",
  payeeId: "user-456"
}
```

---

## Summary

✅ **Stablecoins by default** (cUSD) with USDC/USDT alternatives  
✅ **Multi-asset support** for regional currencies (cEUR, cKES)  
✅ **Flexible for other tokens** (CELO, ETH, future custom tokens)  
✅ **Client-friendly API** with currency metadata and grouping  
✅ **Type-safe validation** using Zod schemas  
✅ **Database-backed** with full SQL operations  

**For most users**: Use cUSD (fast, cheap, stable)  
**For specific regions**: Use cEUR, cKES  
**For cross-chain**: Use USDC, USDT  
**For advanced users**: CELO, ETH, or custom tokens
