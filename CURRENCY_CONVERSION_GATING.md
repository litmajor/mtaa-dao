# Currency Conversion in Feature Gating ✅

## How It Works

All gating amounts are **defined in KES (Kenyan Shilling)** as the base currency, then converted to the user's preferred currency for display.

### Example Flow

**User Profile:**
```json
{
  "id": "user123",
  "balance": 200_000,        // In KES (base currency)
  "preferredCurrency": "USD", // User's display preference
  "createdAt": "2026-01-20"
}
```

**Gating Rule (Vault Yield):**
```typescript
'vault.yield': {
  type: 'balance',
  value: { minAmount: 100_000 },  // 100K KES in database
  explanation: 'Available when balance exceeds 100K'
}
```

**Calculation:**

```
User balance:       200,000 KES
Required:           100,000 KES
Status:             ✅ AVAILABLE (has enough)
```

**Another User (Not Enough Balance):**

```
User balance:       50,000 KES
Required:           100,000 KES  
Shortfall:          50,000 KES
User's currency:    USD

// Conversion: KES to USD (rate ≈ 1/129)
50,000 KES ÷ 129 ≈ 387.60 USD

Response to Frontend:
{
  "isAvailable": false,
  "reason": "Available when balance exceeds 100K",
  "amountNeeded": 388,          // Rounded up
  "currency": "USD"             // User's preferred
}

UI Message: "Deposit 388 USD more to unlock"
```

---

## Supported Currencies

Gating amounts are converted automatically to:

| Currency | Rate (vs KES) | Example |
|----------|---------------|---------|
| KES | 1.0 | 100,000 KES = 100,000 KES |
| USD | 1/129 | 100,000 KES ≈ 776 USD |
| EUR | 1/140 | 100,000 KES ≈ 715 EUR |
| GBP | 1/160 | 100,000 KES ≈ 625 GBP |
| GHS | 1/7 | 100,000 KES ≈ 14,286 GHS |
| ZAR | 1/7 | 100,000 KES ≈ 14,286 ZAR |
| UGX | 1/0.03 | 100,000 KES ≈ 3.3M UGX |
| NGN | 1/0.35 | 100,000 KES ≈ 286K NGN |

---

## Where It's Implemented

### Backend (server/services/gatingService.ts)

```typescript
case 'balance': {
  const minAmountKSH = rule.value?.minAmount || 0;        // In KES
  const userBalanceKSH = parseFloat(user.balance?.toString() || '0'); // In KES
  const preferredCurrency = user.preferredCurrency || 'KES';
  
  if (userBalanceKSH < minAmountKSH) {
    const shortfallKSH = minAmountKSH - userBalanceKSH;
    
    // Convert shortfall to user's preferred currency
    const rate = conversionRates[preferredCurrency] || 1;
    const amountNeeded = Math.ceil(shortfallKSH * rate);
    
    return {
      isAvailable: false,
      amountNeeded,
      currency: preferredCurrency // ← USER'S CURRENCY
    };
  }
}
```

### API Response (server/routes/features.ts)

```json
{
  "status": {
    "vault.yield": {
      "isAvailable": false,
      "reason": "Available when balance exceeds 100K",
      "amountNeeded": 388,
      "currency": "USD"        // ← Includes currency
    }
  },
  "user": {
    "balance": 50_000,
    "balanceCurrency": "KES",             // ← Base currency
    "preferredCurrency": "USD",           // ← User's choice
    "reputation": 15,
    "advancedMode": false
  }
}
```

### Frontend Hook (client/src/hooks/useFeatureGating.ts)

```typescript
getMessage(): string {
  if (status.amountNeeded) {
    const currency = status.currency || 'KES';  // Uses returned currency
    return `Deposit ${status.amountNeeded.toLocaleString()} ${currency} more to unlock`;
  }
  // Outputs: "Deposit 388 USD more to unlock"
}
```

### Frontend UI (client/src/components/FeatureGate.tsx)

```typescript
{gating.amountNeeded !== undefined && (
  <div className="mt-2 text-sm text-amber-800 flex items-center gap-2">
    <DollarSign className="w-4 h-4" />
    Deposit {gating.amountNeeded.toLocaleString()} {status.currency} more
    //         ↑ Formatted number              ↑ Currency code
  </div>
)}
```

---

## Testing Currency Conversion

### Test Case 1: KES User
```bash
# User with preferredCurrency = KES
curl -H "Authorization: Bearer token" http://localhost:3000/api/features/gating-status

# Response:
{
  "user": {
    "preferredCurrency": "KES",
    "balance": 50000
  },
  "status": {
    "vault.yield": {
      "amountNeeded": 50000,
      "currency": "KES"
    }
  }
}
# UI: "Deposit 50,000 KES more"
```

### Test Case 2: USD User
```bash
# User with preferredCurrency = USD
curl -H "Authorization: Bearer token" http://localhost:3000/api/features/gating-status

# Response:
{
  "user": {
    "preferredCurrency": "USD",
    "balance": 50000
  },
  "status": {
    "vault.yield": {
      "amountNeeded": 388,      # 50,000 / 129 ≈ 388 (rounded up)
      "currency": "USD"
    }
  }
}
# UI: "Deposit 388 USD more"
```

### Test Case 3: GHS User
```bash
# User with preferredCurrency = GHS
# Response:
{
  "status": {
    "vault.yield": {
      "amountNeeded": 714286,   # 50,000 * 14.28...
      "currency": "GHS"
    }
  }
}
# UI: "Deposit 714,286 GHS more"
```

---

## How to Change Base Gating Amounts

All amounts in `server/services/gatingService.ts` are in **KES**:

```typescript
export const GATING_RULES = {
  'vault.yield': {
    value: { minAmount: 100_000 },  // ← THIS IS IN KES
    explanation: 'Available when balance exceeds 100K'
  },
  // ...
}
```

To increase the requirement from 100K KES to 500K KES:

```typescript
'vault.yield': {
  value: { minAmount: 500_000 },  // Changed to 500K
  explanation: 'Available when balance exceeds 500K'
}
```

Conversion happens automatically:
- USD: 500K KES ÷ 129 ≈ **3,876 USD**
- EUR: 500K KES ÷ 140 ≈ **3,571 EUR**
- GHS: 500K KES × 14.28 ≈ **7.14M GHS**

---

## Future Improvements

**Real Exchange Rates:**
Currently using hardcoded rates. Can integrate:
- `exchangeRateService.ts` (already exists for USD↔KES)
- Extend to support other currencies
- Update hourly with live rates

**Custom Rates Per Currency:**
```typescript
const exchangeRates = {
  'USD': await exchangeRateService.getUSDtoKESRate(),
  'EUR': await exchangeRateService.getEURtoKESRate(),
  // ... fetch live rates
}
```

**User-Specific Rates:**
Some users might have preferred rates (e.g., corporate contracts). Can add to user profile:
```typescript
user.customExchangeRates?: {
  'USD': 125, // Different from market rate of 129
}
```

---

## Summary

✅ **Gating amounts defined in:** KES (base)
✅ **Displayed in:** User's preferredCurrency
✅ **Conversion:** Automatic at API response time
✅ **Supported currencies:** 8 (KES, USD, EUR, GBP, GHS, ZAR, UGX, NGN)
✅ **Future:** Can integrate live exchange rates

**For Phase 3.2 Onboarding:** Currency handling is automatic, no additional work needed!

