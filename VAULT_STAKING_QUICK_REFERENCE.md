/**
 * VAULT & STAKING QUICK REFERENCE
 * 
 * Quick lookup guide for components, endpoints, and usage
 */

# 🚀 QUICK REFERENCE

## Components Created

| Component | Path | Purpose | Lines |
|-----------|------|---------|-------|
| VaultListPage | `client/src/components/vaults/VaultListPage.tsx` | Discover & deposit into vaults | 350+ |
| VaultDetailPage | `client/src/components/vaults/VaultDetailPage.tsx` | View vault details & positions | 400+ |
| MyVaultsPage | `client/src/components/vaults/MyVaultsPage.tsx` | Portfolio dashboard | 400+ |
| StakingComponent | `client/src/components/staking/StakingComponent.tsx` | Stake & manage rewards | 500+ |

## API Utilities

| File | Purpose | Functions |
|------|---------|-----------|
| `client/src/utils/stakingApi.ts` | Staking API calls | stakeTokens, claimRewards, unstakeTokens, getMyStakes, getStakingStats |

## Routes

### Vault Routes

```
GET  /api/vaults                    - List all vaults
GET  /api/vaults/:id                - Vault details
POST /api/vaults/:id/deposit         - Deposit & issue shares
GET  /api/vaults/:id/my-position     - User position
GET  /api/vaults/:id/performance     - Performance history
GET  /api/vaults/my-positions        - All user positions
GET  /api/vaults/portfolio-performance - Portfolio chart data
```

### Staking Routes

```
POST /api/staking/stake              - Create stake
GET  /api/staking/my-stakes          - User's stakes
GET  /api/staking/stats              - Staking stats
POST /api/staking/claim/:stakeId     - Claim rewards
POST /api/staking/unstake/:stakeId   - Unstake tokens
GET  /api/staking/vault-access       - Vault tier access
GET  /api/staking/leaderboard        - Top stakers
```

---

## Vault System

### Share-Based Accounting

```
User deposits $1,000:
  totalValue = $10,000  (all deposits in vault)
  totalShares = 800 (existing shares)
  sharePrice = $10,000 / 800 = $12.50
  
  User's shares = $1,000 / $12.50 = 80 shares
  User's new value = 80 * $12.50 = $1,000

After vault gains 10%:
  totalValue = $11,000
  User's value = 80 * ($11,000 / 880) = $1,000 + $100 = $1,100 ✅
```

### Vault Categories

| Vault | Min Deposit | AUM | APY (Est) | Risk |
|-------|-------------|-----|----------|------|
| Market Neutral | $100 | $2.5M | 24.5% | Low |
| Yield Farming | $100 | $1.8M | 18.7% | Medium |
| Momentum | $100 | $950K | 42.3% | High |
| Stablecoin | $100 | $3.2M | 4.2% | Very Low |

---

## Staking System

### APY by Duration

| Duration | Multiplier | Base APY | Total APY |
|----------|------------|----------|-----------|
| 7 days | 0.5x | 12% | 6% |
| 30 days | 1.0x | 12% | 12% |
| 90 days | 1.5x | 12% | 18% |
| 365 days | 2.5x | 12% | 30% |

### Vault Access Tiers

| Tier | Min MTAA | Max Vaults | Fee Discount |
|------|----------|-----------|--------------|
| 🥉 Bronze | 1,000 | 1 | 0% |
| 🥈 Silver | 5,000 | 5 | 5% |
| 🥇 Gold | 25,000 | 15 | 10% |
| 💎 Platinum | 100,000 | Unlimited | 25% |

### Projected Rewards Formula

```
periodRewards = amount × (apy / 100) × (duration / 365)

Example:
  amount = $1,000
  apy = 18% (90-day stake)
  duration = 90 days
  
  rewards = $1,000 × (18/100) × (90/365)
          = $1,000 × 0.18 × 0.247
          = $44.43
```

---

## Component Props

### VaultListPage
```typescript
<VaultListPage />
// No required props, loads data from /api/vaults
```

### VaultDetailPage
```typescript
<VaultDetailPage vaultId="vault_123" />
// Required: vaultId from URL param or prop
```

### MyVaultsPage
```typescript
<MyVaultsPage />
// No required props, loads data from /api/vaults/my-positions
```

### StakingComponent
```typescript
<StakingComponent />
// No required props, fully self-contained
```

---

## Data Structures

### VaultPosition
```typescript
{
  vaultId: "vault_123",
  vaultName: "Yield Farming Max",
  category: "yield",
  shares: 80,
  currentValue: 1100,        // 80 shares × current share price
  depositAmount: 1000,       // Original deposit
  profitLoss: 100,           // currentValue - depositAmount
  profitLossPercent: 10,     // (profitLoss / depositAmount) × 100
  depositedAt: Date,
  sharePrice: 13.75          // currentValue / totalShares
}
```

### UserStake
```typescript
{
  stakeId: "stake_123",
  amount: 5000,              // MTAA
  duration: 90,              // days
  stakedAt: Date,
  unlockAt: Date,            // stakedAt + (duration * 24h)
  rewards: 225,              // Accumulated rewards
  totalValue: 5225,          // amount + rewards
  status: "active" | "matured" | "unlocking"
}
```

---

## API Calls Cheat Sheet

### Deposit into Vault
```typescript
await fetch('/api/vaults/:vaultId/deposit', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ amount: 1000 })
});
// Returns: { vaultId, amount, shares, sharePrice, currentValue }
```

### Stake MTAA
```typescript
await fetch('/api/staking/stake', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ amount: 5000, duration: 90 })
});
// Returns: { stakeId, amount, apy, rewards, totalValue }
```

### Get User Stakes
```typescript
await fetch('/api/staking/my-stakes', {
  headers: { 'Authorization': `Bearer ${token}` }
});
// Returns: { data: [...], totalStaked, totalRewards }
```

### Claim Rewards
```typescript
await fetch('/api/staking/claim/:stakeId', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
// Returns: { amount }
```

---

## Routing Setup

```typescript
<BrowserRouter>
  <Navigation />
  <Routes>
    <Route path="/vaults" element={<VaultListPage />} />
    <Route path="/vaults/:vaultId" element={<VaultDetailPage />} />
    <Route path="/my-vaults" element={<MyVaultsPage />} />
    <Route path="/staking" element={<StakingComponent />} />
  </Routes>
</BrowserRouter>
```

---

## Common Task Solutions

### Get user's vault balance in a component
```typescript
const [positions, setPositions] = useState([]);

useEffect(() => {
  fetch('/api/vaults/my-positions', {
    headers: { 'Authorization': `Bearer ${sessionStorage.getItem('authToken')}` }
  }).then(r => r.json()).then(data => setPositions(data.data));
}, []);
```

### Calculate portfolio return
```typescript
const totalDeposited = positions.reduce((sum, p) => sum + p.depositAmount, 0);
const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
const return_ = ((totalValue - totalDeposited) / totalDeposited * 100).toFixed(2);
```

### Get projected rewards for a stake
```typescript
import { calculateProjectedRewards } from '../utils/stakingApi';

const { apy, dailyReward, periodReward } = calculateProjectedRewards(
  amount,
  duration
);
```

### Check if staking duration is mature
```typescript
const isMatured = new Date(stake.unlockAt) <= new Date();
```

---

## Error Handling

All API endpoints return:

**Success**:
```json
{ "data": {...}, "success": true }
```

**Error**:
```json
{ "error": "Error message", "success": false }
```

Common errors:
- `400 Bad Request` - Invalid input (missing amount, invalid duration)
- `401 Unauthorized` - Missing/invalid JWT token
- `404 Not Found` - Vault/stake not found
- `500 Server Error` - Database or server error

---

## Performance Tips

1. **Use React Query/SWR** for data fetching instead of useState+useEffect
2. **Memoize** expensive components with React.memo()
3. **Lazy load** vault performance charts with Suspense
4. **Cache** vault list for 1 minute
5. **Debounce** filter/search inputs

Example with React Query:
```typescript
import { useQuery } from 'react-query';

function MyVaultsPage() {
  const { data, isLoading } = useQuery('my-positions', () =>
    fetch('/api/vaults/my-positions').then(r => r.json())
  );
  
  if (isLoading) return <Spinner />;
  return <VaultGrid positions={data.data} />;
}
```

---

## Styling Classes Used

- **Containers**: `bg-slate-800`, `border-slate-700`, `rounded-lg`, `p-6`
- **Text**: `text-white`, `text-slate-400`, `font-bold`, `text-2xl`
- **Buttons**: `bg-blue-600 hover:bg-blue-700`, `px-4 py-2`, `transition-colors`
- **Status Colors**: 
  - Success: `text-green-400`, `bg-green-900/30`
  - Error: `text-red-400`, `bg-red-900/30`
  - Warning: `text-orange-400`, `bg-orange-900/30`

---

## Testing Checklist

- [ ] Vault list loads with 4 categories
- [ ] Deposit modal calculates shares correctly
- [ ] Share price updates after deposits
- [ ] Vault detail page shows positions
- [ ] Performance chart renders
- [ ] Staking amounts validate
- [ ] APY calculation is correct
- [ ] Vault tiers unlock properly
- [ ] My Vaults shows all positions
- [ ] Portfolio stats calculate correctly
- [ ] Toast notifications appear
- [ ] JWT auth works on all endpoints
- [ ] Loading states show while fetching
- [ ] Error messages display on failures

---

## Quick Deploy Steps

1. Create database tables (see INTEGRATION_GUIDE.md)
2. Import all components into App.tsx
3. Add Navigation component
4. Set up routes
5. Configure environment variables
6. Test /vaults endpoint
7. Test /staking endpoint
8. Run end-to-end tests
9. Deploy to production

---

**Need Help?**
- Check VAULT_STAKING_INTEGRATION_GUIDE.md for detailed setup
- Check VAULT_STAKING_UI_COMPLETE.md for full documentation
- Component files have inline comments
- API utilities are fully typed with TypeScript
