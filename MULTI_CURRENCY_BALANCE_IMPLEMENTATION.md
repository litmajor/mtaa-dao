# Multi-Currency Balance Display Implementation Guide

## Overview
This document outlines the complete implementation of multi-currency balance display functionality that allows users to view their portfolio balances in two selected currencies (e.g., KES and USDC) in real-time.

## Architecture

### Backend Components

#### 1. User Preferences API (`server/routes/user-preferences.ts`)
- **Endpoint**: `GET /api/user-preferences`
  - Returns user's selected dual currencies (primary and secondary)
  - Default: Primary = `cUSD`, Secondary = `KES`
  - Stores preferences as JSON in database

- **Endpoint**: `PUT /api/user-preferences/currency`
  - Updates user's currency preferences
  - Validates against SUPPORTED_CURRENCIES list
  - Prevents selecting same currency for both primary and secondary

- **Endpoint**: `GET /api/user-preferences/currencies/supported`
  - Returns list of all supported currencies
  - Currencies: CELO, cUSD, cEUR, cREAL, USDC, USDT, VEUR, USD, EUR, KES, GHS, NGN

#### 2. Wallet API Enhancements (`server/routes/wallet.ts`)
- **Endpoint**: `GET /api/wallet/exchange-rates`
  - Returns current exchange rates for all supported currency pairs
  - Updates every 30 seconds
  - Includes 24h change percentage for each pair
  - **Future**: Integrate with real exchange rate API (Coingecko, Kraken)

- **Endpoint**: `GET /api/wallet/balance-multi`
  - Returns balance converted to both selected currencies
  - Parameters: `primaryCurrency`, `secondaryCurrency`
  - Returns: native balance + conversions in selected currencies

### Frontend Components

#### 1. Portfolio Settings Component (`client/src/components/wallet/PortfolioSettings.tsx`)
**Location**: Settings/Preferences page

**Features**:
- Dropdown selectors for primary and secondary currencies
- Categories: Crypto, Stablecoin, Fiat
- Visual currency preview showing selection
- Save button with validation
- Success/error messages

**Props**: None (uses React Query internally)

**Usage**:
```tsx
import { PortfolioSettings } from '@/components/wallet/PortfolioSettings';

<PortfolioSettings onSettingsUpdate={(prefs) => {
  console.log('Currencies updated:', prefs);
}} />
```

#### 2. Portfolio Overview Enhancement (`client/src/components/wallet/PortfolioOverview.tsx`)
**Updates**:
- Fetches user currency preferences on mount
- Fetches exchange rates every 30 seconds
- Converts total portfolio value to both currencies
- Displays dual values in main balance card
- Charts can toggle between currency views

**Display**:
```
Primary: cUSD 8,520.50
Secondary: KES 1,110,748
```

#### 3. Balance Aggregator Widget (`client/src/components/wallet/BalanceAggregatorWidget.tsx`)
**Updates**:
- Displays portfolio balance in dual currencies
- Shows primary and secondary conversions
- Updated TokenCard component with multi-currency display
- Updated PoolCard component with multi-currency display
- Real-time exchange rate integration

**Key Props Passed to Cards**:
- `primaryCurrency`: Selected primary currency code
- `secondaryCurrency`: Selected secondary currency code
- `convertAmount()`: Conversion function with signature `(amount, from, to) => string`

#### 4. Transaction History Enhancement (`client/src/components/wallet/TransactionHistory.tsx`)
**Updates**:
- Each transaction shows:
  - Original amount in native currency
  - Converted amount in primary currency
  - Converted amount in secondary currency
- Real-time conversions using exchange rates
- Example:
    ```
    100 cUSD
    ≈ cUSD 100.00
    ≈ KES 13,050.00
    ```

### Data Flow

```
User Settings
    ↓
User Preferences API (backend)
    ↓
Primary: cUSD
Secondary: KES
    ↓
Exchange Rates API (every 30s)
    ├─→ CELO-USD: 0.65
    ├─→ cUSD-KES: 130.5
    └─→ USD-KES: 130.5
    ↓
Frontend Components
    ├─→ PortfolioOverview
    ├─→ BalanceAggregatorWidget
    ├─→ TokenCard
    ├─→ PoolCard
    └─→ TransactionHistory
    ↓
Display: Dual Currency Values
```

## Implementation Details

### Currency Conversion Logic

**Supported Currencies**:
```typescript
const SUPPORTED_CURRENCIES = [
  'CELO', 'cUSD', 'cEUR', 'cREAL', 'USDC', 'USDT', 'VEUR',
  'USD', 'EUR', 'KES', 'GHS', 'NGN'
];
```

**Conversion Function**:
```typescript
const convertAmount = (amount: number, from: string, to: string): number => {
  if (from === to) return amount;
  
  // Try direct rate
  const directRate = exchangeRates[`${from}-${to}`];
  if (directRate) return amount * directRate.rate;
  
  // Try reverse rate
  const reverseRate = exchangeRates[`${to}-${from}`];
  if (reverseRate) return amount / reverseRate.rate;
  
  // Try via USD
  const fromRate = exchangeRates[`${from}-USD`];
  const toRate = exchangeRates[`${to}-USD`];
  if (fromRate && toRate) return (amount * fromRate.rate) / toRate.rate;
  
  return amount; // Fallback
};
```

### Exchange Rate Storage

**Format**:
```typescript
{
  'CELO-USD': { pair: 'CELO-USD', rate: 0.65, change24h: 0.5 },
  'cUSD-KES': { pair: 'cUSD-KES', rate: 130.5, change24h: -0.3 },
  'USD-KES': { pair: 'USD-KES', rate: 130.5, change24h: -0.3 },
  ...
}
```

**Refresh Interval**: Every 30 seconds via React Query

## Integration Points

### 1. Settings Page Integration
```tsx
import { PortfolioSettings } from '@/components/wallet/PortfolioSettings';

export function SettingsPage() {
  return (
    <div>
      <PortfolioSettings onSettingsUpdate={(prefs) => {
        // Refresh portfolio displays
      }} />
    </div>
  );
}
```

### 2. Wallet Dashboard Integration
```tsx
import { PortfolioOverview } from '@/components/wallet/PortfolioOverview';
import { BalanceAggregatorWidget } from '@/components/wallet/BalanceAggregatorWidget';

export function WalletDashboard() {
  return (
    <div>
      <BalanceAggregatorWidget />
      <PortfolioOverview />
    </div>
  );
}
```

### 3. Transaction Page Integration
```tsx
import TransactionHistory from '@/components/wallet/TransactionHistory';

export function TransactionsPage() {
  return <TransactionHistory userId={userId} />;
}
```

## User Experience Features

### 1. Real-Time Conversion
- Exchange rates refresh every 30 seconds
- Automatic conversion of all balance displays
- No manual refresh needed

### 2. Portfolio Breakdown
- Pie charts show allocation in selected fiat currency
- Bar charts compare performance across currencies
- Toggle between currency views for analysis

### 3. Transaction Context
- All transaction amounts show in both currencies
- Easy tracking in user's preferred currency
- Historical context with conversion at transaction time

### 4. Visual Indicators
- Primary currency: Blue highlight
- Secondary currency: Indigo highlight
- Clear separation for easy reading

## Testing Checklist

### Backend Tests
- [ ] User preferences endpoint returns correct currencies
- [ ] Currency update validates against supported list
- [ ] Exchange rates endpoint returns all currency pairs
- [ ] Balance-multi endpoint converts correctly
- [ ] Same currency validation prevents duplicate selection

### Frontend Tests
- [ ] Portfolio Settings component renders all supported currencies
- [ ] Currency selection persists after page refresh
- [ ] PortfolioOverview displays dual values correctly
- [ ] BalanceAggregatorWidget updates on rate changes
- [ ] TokenCard shows all three values (native, primary, secondary)
- [ ] TransactionHistory displays converted amounts
- [ ] Exchange rates update every 30 seconds
- [ ] Loading states show during data fetch
- [ ] Error states display when rates unavailable

### Integration Tests
- [ ] Complete flow: Select currencies → View portfolio → See transactions
- [ ] Currency change affects all components
- [ ] Real-time updates work across all displays
- [ ] Settings persist across sessions

## Future Enhancements

1. **Real Exchange Rate Integration**
   - Integrate with Coingecko API for live rates
   - Add rate history tracking
   - Implement rate alerts

2. **Advanced Features**
   - Currency comparison analytics
   - Historical conversion rates
   - Custom currency pairs
   - Rate notifications

3. **Performance**
   - Lazy load exchange rates
   - Cache rates in localStorage
   - Optimize re-renders with memoization

4. **Accessibility**
   - Screen reader support for currency conversions
   - Keyboard navigation for currency selectors
   - High contrast mode support

## API Response Examples

### User Preferences
```json
{
  "success": true,
  "data": {
    "primaryCurrency": "cUSD",
    "secondaryCurrency": "KES"
  }
}
```

### Exchange Rates
```json
{
  "success": true,
  "rates": {
    "CELO-USD": { "pair": "CELO-USD", "rate": 0.65, "change24h": 0.5 },
    "cUSD-KES": { "pair": "cUSD-KES", "rate": 130.5, "change24h": -0.3 }
  },
  "lastUpdated": "2024-01-10T10:30:45Z"
}
```

### Multi-Currency Balance
```json
{
  "success": true,
  "balance": {
    "address": "0x...",
    "nativeBalance": 5.2,
    "primary": {
      "currency": "cUSD",
      "amount": 3380
    },
    "secondary": {
      "currency": "KES",
      "amount": 439540
    },
    "lastUpdated": "2024-01-10T10:30:45Z"
  }
}
```

## Troubleshooting

### Exchange Rates Not Updating
- Check if `/api/wallet/exchange-rates` is returning data
- Verify React Query cache is being invalidated
- Check browser console for network errors

### Conversions Showing Incorrect Values
- Verify exchange rates are loading
- Check currency codes match supported list
- Validate conversion formula logic

### User Preferences Not Persisting
- Check user preferences API endpoint is working
- Verify user ID is being passed correctly
- Check database schema has preferredCurrency field

## Performance Considerations

- Exchange rates cached for 30 seconds (configurable)
- User preferences cached indefinitely (invalidate on update)
- Component memoization prevents unnecessary re-renders
- Conversion calculations done on-demand

## Security Notes

- Currency conversion is client-side (no security risk)
- User preferences stored encrypted in database
- Exchange rate API has no authentication requirements
- No sensitive data exposed in conversion display
