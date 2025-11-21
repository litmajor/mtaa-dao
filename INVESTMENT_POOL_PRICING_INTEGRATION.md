
# Investment Pool Pricing Integration

## Overview

Investment Pools have **tier-based platform fees** that are automatically enforced based on the DAO's subscription tier.

## Fee Structure by Tier

| Tier | Platform Fee | Performance Fee | Management Fee |
|------|--------------|-----------------|----------------|
| **Community** | 2.0% | 8% on profits | 1% annual |
| **Growth** | 1.5% | 8% on profits | 1% annual |
| **Professional** | 1.0% | 8% on profits | 1% annual |
| **Enterprise** | 0.5-0.75% | 8% on profits | 1% annual |

## How Fees Are Enforced

### 1. **Platform Transaction Fee** (Applied on all deposits/withdrawals)

```typescript
// Automatically calculated when user invests
const feeCalc = await investmentPoolPricingService.calculateInvestmentFees(poolId, amount);

// For $100 investment on Growth tier:
{
  grossAmount: 100,
  platformFee: 1.50,      // 1.5%
  netAmount: 98.50,
  tier: 'growth'
}
```

### 2. **Performance Fee** (Only on profits during withdrawal)

```typescript
// Calculated during withdrawal
const feeCalc = await investmentPoolPricingService.calculateWithdrawalFees(
  poolId,
  withdrawalValue,
  initialInvestment
);

// Example: $150 withdrawal on $100 initial investment (Growth tier)
{
  grossAmount: 150,
  platformFee: 2.25,        // 1.5% of withdrawal
  profit: 50,               // $150 - $100
  performanceFee: 4.00,     // 8% of $50 profit
  totalFees: 6.25,
  netAmount: 143.75,
  tier: 'growth'
}
```

## Usage Tracking

### Automatic Tracking

Every investment/withdrawal automatically:
1. Calculates tier-based fees
2. Records revenue in `platform_revenue` table
3. Tracks transaction count and volume

### Usage Metrics API

```typescript
// Get DAO's pool usage for current month
const usage = await investmentPoolPricingService.trackPoolUsage(daoId, 'month');

// Response:
{
  period: 'month',
  poolCount: 3,
  investments: {
    count: 45,
    volume: 125000
  },
  withdrawals: {
    count: 12,
    volume: 35000
  },
  totalTransactions: 57,
  totalVolume: 160000
}
```

## Revenue Recording

All pool fees are automatically recorded:

```sql
-- platform_revenue table
INSERT INTO platform_revenue (
  source,              -- 'investment_pool'
  dao_id,              -- Which DAO's pool
  revenue_type,        -- 'pool_investment_fee' or 'pool_withdrawal_fee'
  amount_ksh,          -- Fee amount
  tier,                -- 'growth', 'professional', etc.
  metadata,            -- {poolId, platformFee, performanceFee}
  created_at
) VALUES (...);
```

## How Tiers Are Determined

1. System looks up the **DAO** that owns the investment pool
2. Fetches the DAO's **current subscription tier** from `dao_subscriptions`
3. Applies the corresponding fee structure from `PLATFORM_FEES`
4. Defaults to **Community tier** if no subscription found

## Upgrading Benefits

When a DAO upgrades their subscription:
- ✅ Lower platform fees **immediately** apply to all pool transactions
- ✅ No manual changes needed to pools
- ✅ Automatic revenue tracking reflects new tier

Example:
```
Community tier: 2.0% fee on $10,000 investment = $200 fee
Upgrade to Growth: 1.5% fee on $10,000 = $150 fee
Savings: $50 per $10,000 invested
```

## Integration Points

### Backend
- ✅ `investmentPoolPricingService.ts` - Fee calculation engine
- ✅ `investment-pools.ts` routes - Applies fees during invest/withdraw
- ✅ `platform_revenue` table - Stores all fee revenue

### Frontend
- Need to display tier-based fees in pool detail page
- Show fee savings when comparing tiers
- Display usage metrics in DAO dashboard

## Next Steps

1. Add tier fee display to investment pool UI
2. Create admin dashboard for pool revenue analytics
3. Add usage alerts when approaching tier limits
4. Implement fee discount campaigns for high-volume DAOs
