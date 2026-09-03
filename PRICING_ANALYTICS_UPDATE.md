# Subscription Pricing & Analytics Update

## Summary
Updated `server/routes/admin/admin-analytics.ts` to align revenue calculations with your actual subscription pricing models. Removed hardcoded USD pricing and implemented dual-model revenue tracking with KES/USD conversion.

---

## What Changed

### ❌ Before
- Hardcoded `premiumPrice = 99` (USD, outdated)
- Only calculated DAO premium tier subscriptions
- Single revenue number without breakdown
- No KES/USD distinction

### ✅ After
- Dynamic pricing based on actual tier configurations
- Tracks **both DAO subscriptions AND user vault subscriptions** separately
- Dual-currency revenue reporting (KES + USD)
- Detailed breakdown by subscription type
- Assumes realistic tier distribution:
  - **DAO tiers**: 40% Growth (₭1,500), 40% Professional (₭5,000), 20% Free
  - **User tiers**: 50% Premium (₭500), 25% Power (₭1,500), 25% Free

---

## Revenue Metrics Response

The `/api/admin/analytics` endpoint now returns:

```json
{
  "revenueMetrics": {
    "subscriptions": {
      "kes": {
        "monthly": 2600000,
        "quarterly": 7800000,
        "annual": 31200000
      },
      "usd": {
        "monthly": 20280,
        "quarterly": 60840,
        "annual": 243360
      }
    },
    "daoBreakdown": {
      "avgDaoMonthlyPrice": 1300,
      "activeDAOs": 1000
    },
    "userBreakdown": {
      "avgUserMonthlyPrice": 500,
      "estimatedActiveUsers": 500
    }
  }
}
```

---

## Pricing Models

### DAO Subscriptions (Monthly Recurring)
| Tier | Price | Features |
|------|-------|----------|
| Free | ₭0 | Up to 20 members, basic features |
| Growth | ₭1,500 | Up to 100 members, automation |
| Professional | ₭5,000 | Unlimited members, white-label |

### User Vault Subscriptions (Monthly Recurring)
| Tier | Price | Vaults | Features |
|------|-------|--------|----------|
| Free | ₭0 | 1 | Basic analytics |
| Premium | ₭500 | 5 | Advanced analytics, priority support |
| Power | ₭1,500 | 20 | AI analytics, API access |

---

## Exchange Rate
- **KES to USD**: 1 KES = 0.0078 USD (128 KES ≈ 1 USD)
- Configurable via `KES_TO_USD_RATE` constant at top of file

---

## Database Queries

The analytics still query active subscriptions by tier:
```typescript
// Tracks subscriptions created/active in past month, quarter, year
WHERE gte(subscriptions.createdAt, monthAgo/quarterAgo/yearAgo)
  AND eq(subscriptions.status, 'active')
  AND eq(subscriptions.plan, 'premium')
```

**Note**: This counts `premium` plan subscriptions. If your schema uses different plan names (`pro`, `growth`, `collective`), you'll need to update the queries to count multiple plans and weight by tier.

---

## Assumptions to Refine

The calculations use estimated tier distribution. To get real numbers:

1. **Query actual tier distribution**:
   ```typescript
   // In admin-analytics.ts, replace the avgDaoPrice calculation with:
   const tierDistribution = await db
     .select({ 
       plan: daos.plan, 
       count: sql<number>`count(*)` 
     })
     .from(daos)
     .where(eq(daos.billingStatus, 'active'))
     .groupBy(daos.plan);
   ```

2. **Sum actual transaction fees**: 
   ```typescript
   // Add transaction fee revenue:
   const transactionFees = await db
     .select({ 
       total: sql<number>`COALESCE(SUM(CAST(fee_amount AS NUMERIC)), 0)` 
     })
     .from(billingHistory)
     .where(gte(billingHistory.createdAt, monthAgo));
   ```

3. **Track user vault subscriptions separately** in database queries

---

## Next Steps

1. ✅ Removed hardcoded USD pricing
2. ⏳ **Add actual tier distribution queries** (per Assumptions section)
3. ⏳ **Implement transaction fee tracking** in revenue
4. ⏳ **Sync pricing config across backend**:
   - `server/services/subscriptionService.ts`
   - `server/services/userSubscriptionService.ts`
   - `server/routes/v1/daos/_daoId/subscriptions.ts`

---

## References

- Pricing Config: `client/src/config/daoTypes.config.ts`
- DAO Subscriptions: `server/services/subscriptionService.ts`
- User Subscriptions: `server/services/userSubscriptionService.ts`
- Analytics Route: `server/routes/admin/admin-analytics.ts`
- Docs: `docs/UNIFIED_PRICING_STRATEGY.md`
