# Integration Guide: BalanceAggregatorWidget

## Overview

The `BalanceAggregatorWidget` provides a comprehensive, multi-tab balance view that aggregates balances from:
- Multiple wallet providers (MetaMask, Valora, MiniPay, Internal)
- All investment categories (wallets, pools, vaults, staking)
- Real-time balance updates

## Installation

### 1. Import Component

```typescript
import BalanceAggregatorWidget from '@/components/wallet/BalanceAggregatorWidget';
```

### 2. Add to Wallet Page

**File**: `client/src/pages/wallet.tsx`

```typescript
export default function WalletPage() {
  // ... existing code ...

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900">
      <div className="max-w-7xl mx-auto p-6">
        {/* Existing wallet UI */}
        {isConnected ? (
          <>
            {/* NEW: Add Balance Aggregator Widget */}
            <BalanceAggregatorWidget />
            
            {/* Existing tabs/content below */}
            <Tabs defaultValue="overview" className="mt-8">
              {/* ... rest of wallet UI ... */}
            </Tabs>
          </>
        ) : (
          <WalletConnectionManager />
        )}
      </div>
    </div>
  );
}
```

## Component Props (Future Enhancement)

Currently, the component uses `useBalanceAggregator` internally. Future versions can accept props:

```typescript
interface BalanceAggregatorWidgetProps {
  // Optional: custom refresh interval (ms)
  refreshInterval?: number;  // default: 30000
  
  // Optional: initially visible categories
  visibleCategories?: Array<'wallet' | 'pools' | 'vaults' | 'staking'>;
  
  // Optional: hide certain tabs
  hiddenTabs?: string[];
  
  // Optional: custom styling
  className?: string;
  
  // Optional: callback when balance updates
  onBalanceUpdate?: (aggregate: AggregatedBalance) => void;
}
```

## Tab Structure

### Overview Tab
Shows summary cards for each category:
- **Native Balance**: Primary cryptocurrency
- **Token Holdings**: Count and total value
- **Investment Pools**: Count and total value
- **Vaults**: Count and total value
- **Staking**: Total staked and rewards

### Wallet Tab
Displays native and token balances:
- Native balance prominently at top
- Each token as separate card
- Shows amount and USD equivalent
- Quick balance visibility toggle

### Pools Tab
Shows investment pool holdings:
- Pool name and contract address
- Your share quantity
- Current share price
- Annual percentage yield (APY)
- Total USD value

### Vaults Tab
Lists vault positions:
- Vault name and type (personal/shared)
- Share quantity and price
- APY percentage
- Total investment value

### Staking Tab
Displays staking information:
- Total cryptocurrency staked
- Pending rewards
- Total value in USD
- Unlock timeline (future)

## Connected Wallets Display

The widget automatically detects and displays all connected wallet providers:

```
┌──────────────────────────────────────────────┐
│ Connected Wallets                            │
├──────────────────────────────────────────────┤
│ 🦊 MetaMask      [✓ Connected]              │
│ 0x1234...5678                                │
│                                              │
│ 💳 Valora        [✓ Connected]              │
│ 0x5555...5555                                │
│                                              │
│ 💰 MiniPay       [✗ Not Connected]          │
│                                              │
│ 🔐 Internal      [✓ Connected]              │
│ internal-wallet-1                            │
└──────────────────────────────────────────────┘
```

## Balance Visibility Toggle

Users can hide/show balances using the eye icon:

```typescript
const [balanceVisible, setBalanceVisible] = useState(true);

// Hides all numeric values, showing:
// "••••••" instead of "5.23"
// "$••••••" instead of "$8,975.42"
```

### Security Benefit
- Protects against shoulder surfing
- Privacy on shared screens
- User control over data exposure

## Real-Time Updates

The component automatically:
1. Fetches balances on mount
2. Refreshes every 30 seconds
3. Re-fetches when chain changes
4. Re-fetches when address changes
5. Shows loading state during refresh
6. Displays last update timestamp

### Manual Refresh
Users can click the refresh button to immediately update:

```typescript
const handleRefresh = async () => {
  // Button shows spinning icon during fetch
  // Disabled state prevents double-clicks
  await aggregator.refetch();
};
```

## Balance Categories

### Native Balance
```typescript
{
  amount: "5.23",
  symbol: "ETH",
  valueUSD: "8,975.42"
}
```
- Primary wallet currency
- Displayed at top of overview
- Always first in wallet tab

### Tokens (ERC20)
```typescript
[
  {
    symbol: "USDC",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    amount: "1000.50",
    valueUSD: "1000.50",
    decimals: 6
  },
  // ... more tokens
]
```
- Fungible token holdings
- Each token is a card
- Shows balance and USD value

### Investment Pools
```typescript
{
  poolId: "pool-1",
  poolName: "Bitcoin Pool",
  poolAddress: "0x...",
  shares: "100.5",
  sharePrice: "1.25",
  valueUSD: "125.62",
  apy: "12.5%"
}
```
- Pooled investment shares
- Owned with other investors
- Share price and APY tracked

### Vaults
```typescript
{
  vaultId: "vault-1",
  vaultName: "Yield Vault",
  type: "personal",
  vaultAddress: "0x...",
  shares: "50",
  sharePrice: "2.0",
  valueUSD: "100.00",
  apy: "8.5%"
}
```
- Personal or shared vaults
- Earns yield over time
- Share-based ownership

### Staking
```typescript
{
  totalStaked: "10.0",
  totalRewards: "0.5",
  valueUSD: "850.00"
}
```
- Locked cryptocurrency
- Generates rewards
- Validator participation

## API Data Flow

### Request to Backend

```typescript
POST /api/wallet/balances-aggregated
{
  userAddress: "0x1234...5678",
  chainId: 1,
  includeCategories: [
    "native",
    "tokens",
    "investment-pools",
    "vaults",
    "staking"
  ]
}
```

### Response Structure

```typescript
{
  breakdown: {
    nativeBalance: { /* ... */ },
    tokens: [ /* ... */ ],
    investmentPools: [ /* ... */ ],
    vaults: [ /* ... */ ],
    stakingRewards: { /* ... */ }
  },
  providers: [
    { id: "metamask", isConnected: true, address: "..." },
    { id: "valora", isConnected: true, address: "..." }
  ],
  totalValueUSD: "11051.54"
}
```

## Styling & Customization

### Dark Mode Support
The component automatically supports dark mode:

```typescript
// Light mode (default)
className="bg-blue-50 dark:bg-gray-900"

// Dark backgrounds
className="dark:bg-gray-800"

// Dark text
className="dark:text-gray-400"
```

### Card Styling
Each card type has unique gradients:

- **Native Balance**: Blue to indigo
- **Investment Pools**: Purple to pink
- **Vaults**: Blue to cyan
- **Staking**: Yellow to orange

### Responsive Layout
- **Desktop**: 4-column grid for providers, full tabs
- **Tablet**: 2-column grid, responsive tabs
- **Mobile**: 1-column grid, horizontal scrolling tabs

## Error Handling

### Loading State
```typescript
if (aggregator.isLoading && aggregator.totalValueUSD === '0') {
  return <LoadingAnimation />;
}
```

### Error Display
```typescript
{aggregator.error && (
  <p className="text-sm text-red-600 mt-2">
    {aggregator.error}
  </p>
)}
```

### Empty States
- No tokens: "No token holdings"
- No pools: "No investment pools"
- No vaults: "No vaults"
- No staking: "No staking positions"

## Performance Optimization

### Memoization
The component uses React.memo for sub-components:

```typescript
const BalanceCategory = React.memo(({ /* props */ }) => {
  // Prevents unnecessary re-renders
  return /* ... */;
});
```

### Lazy Loading
Categories with 0 items don't render:

```typescript
{aggregator.breakdown.tokens.length > 0 && (
  <BalanceCategory
    title="Token Holdings"
    count={aggregator.breakdown.tokens.length}
  />
)}
```

### Automatic Cleanup
Refresh interval stops on component unmount:

```typescript
useEffect(() => {
  // ... setup refresh interval
  
  return () => {
    clearInterval(interval);  // Cleanup
  };
}, []);
```

## Testing Checklist

- [ ] Component loads without errors
- [ ] All tabs render correctly
- [ ] Provider badges show correct status
- [ ] Balance visibility toggle works
- [ ] Refresh button updates balances
- [ ] Dark mode displays correctly
- [ ] Mobile layout is responsive
- [ ] Error messages display properly
- [ ] Loading state shows during fetch
- [ ] Last update timestamp updates

## Future Enhancements

### Phase 2 Features
- [ ] Cross-chain balance view
- [ ] Historical balance charts
- [ ] Portfolio performance metrics
- [ ] Balance change notifications
- [ ] Export balance report

### Phase 3 Features
- [ ] Automated rebalancing
- [ ] Yield optimization suggestions
- [ ] Tax reporting integration
- [ ] Multi-currency display

### Phase 4 Features
- [ ] Social sharing
- [ ] Portfolio comparison
- [ ] Community benchmarking
- [ ] DAO governance integration

## Support & Troubleshooting

### Balances Not Updating
1. Check wallet connection
2. Verify address is correct
3. Check network availability
4. Try manual refresh
5. Check browser console for errors

### Missing Categories
- Ensure backend includes all category endpoints
- Verify user has positions in that category
- Check chain/address parameters

### Styling Issues
- Clear browser cache
- Check Tailwind CSS configuration
- Verify dark mode toggle
- Check component imports

