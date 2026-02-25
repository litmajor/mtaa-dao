# Layer 3 Treasury Intelligence - Quick Reference

## File Structure

```
server/
├── services/
│   ├── price.service.ts                 # Real price fetching
│   ├── treasury-intelligence.service.ts # Real intelligence
│   └── treasury-monitoring.service.ts   # Background monitoring
├── api/
│   └── treasury.ts                      # REST endpoints
├── routes/
│   └── treasury.ts                      # Route mount
└── index.ts                             # Server boot (monitoring init)

shared/
└── schema.ts                            # treasuryHealthHistory table

client/
└── src/
    ├── utils/
    │   └── treasury-intelligence.ts     # Client-side (for UI)
    └── hooks/
        └── useTreasuryIntelligence.ts   # React hook
```

## Key Functions

### Price Service

```typescript
import { getAssetPrice, getAssetPrices } from '@/services/price.service';

// Single price
const price = await getAssetPrice('CELO', 'CELO');
// → { symbol: 'CELO', priceUsd: 0.75, timestamp, source }

// Multiple prices
const prices = await getAssetPrices(['CELO', 'cUSD', 'ETH']);
// → { 'CELO': {...}, 'cUSD': {...}, ... }
```

### Intelligence Service

```typescript
import { generateTreasuryIntelligence } from '@/services/treasury-intelligence.service';

const intelligence = await generateTreasuryIntelligence(treasury, priceData);
// → {
//     assetClassifications: [...],
//     behavior: {...},
//     crossChainState: {...},
//     risks: [...],
//     opportunities: [...]
//   }
```

### Monitoring Service

```typescript
import { 
  initTreasuryMonitoring,
  stopTreasuryMonitoring,
  monitorDaoTreasuryNow,
  getTreasuryHealthHistory
} from '@/services/treasury-monitoring.service';

// Auto-start (done in server/index.ts)
initTreasuryMonitoring({ enabled: true });

// Manual trigger for specific DAO
await monitorDaoTreasuryNow('dao-id');

// Get historical data
const history = await getTreasuryHealthHistory('dao-id', 30);
// → [{timestamp, score, status, ...}, ...]
```

## API Endpoints

### Analyze Treasury

```bash
POST /api/treasury/analyze
Content-Type: application/json
Authorization: Bearer {token}

{
  "daoId": "uuid",
  "priceData": {                          # Optional
    "CELO-CELO": 0.75,
    "cUSD-CELO": 1.0
  }
}
```

**Response:**
```json
{
  "success": true,
  "intelligence": {
    "assetClassifications": [...],
    "assetClassBreakdown": {"stable": 2, "volatile": 1, ...},
    "behavior": {"mode": "accumulative", "confidence": 85, ...},
    "crossChainState": {
      "totalValueUSD": 2500,
      "stableExposure": 80,
      "volatileExposure": 20,
      ...
    },
    "risks": ["High chain concentration..."],
    "opportunities": ["Enable yield strategies..."],
    "semanticSummary": {
      "treasuryCharacter": "balanced-accumulative",
      "healthStatus": "healthy",
      "keyInsights": [...]
    }
  },
  "timestamp": "2026-02-19T10:30:00Z"
}
```

### Recommend Governor Formula

```bash
POST /api/treasury/recommend-formula
Content-Type: application/json
Authorization: Bearer {token}

{
  "daoId": "uuid",
  "daoType": "collective"
}
```

**Response:**
```json
{
  "success": true,
  "recommendedFormula": "timeWeighted",
  "rationale": "Time-weighted voting rewards long-term commitment...",
  "alternatives": [
    {"formula": "hybrid", "reason": "Combines deposit + time..."},
    {"formula": "quadratic", "reason": "Reduces whale voting power..."}
  ],
  "supportedFactors": ["joinDate", "depositAmount", "memberCount"],
  "implementationNotes": "Encourages long-term participation"
}
```

### Get Treasury Health

```bash
GET /api/treasury/health/{daoId}?includeHistory=true&timeframe=30d
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "daoId": "uuid",
  "health": {
    "status": "healthy",
    "score": 78,
    "timestamp": "2026-02-19T10:30:00Z",
    "metrics": {
      "assetConcentration": 0.35,
      "chainFragmentation": 0.65,
      "volatileExposure": 0.25,
      "governanceDistribution": 0.65,
      "liquidityScore": 0.85
    },
    "alerts": [
      {
        "severity": "medium",
        "type": "treasury-risk",
        "message": "Moderate chain concentration",
        "recommendedAction": "Consider diversifying..."
      }
    ],
    "recommendations": ["Monitor exposures", "Enable yield strategies..."]
  },
  "history": [
    {"timestamp": "2026-02-18T10:30:00Z", "score": 76, "status": "healthy"},
    {"timestamp": "2026-02-17T10:30:00Z", "score": 74, "status": "caution"},
    ...
  ]
}
```

## Database

### treasuryHealthHistory Table

```sql
CREATE TABLE treasury_health_history (
  id UUID PRIMARY KEY,
  dao_id UUID NOT NULL REFERENCES daos(id),
  health_status VARCHAR(20),       -- 'healthy', 'caution', 'critical'
  health_score INTEGER,            -- 0-100
  asset_count INTEGER,
  total_value_usd DECIMAL,
  stable_exposure_percent DECIMAL,
  volatile_exposure_percent DECIMAL,
  yield_exposure_percent DECIMAL,
  asset_concentration DECIMAL,
  chain_concentration DECIMAL,
  chain_count INTEGER,
  alert_count INTEGER,
  recommendation_count INTEGER,
  snapshot_reason VARCHAR(50),     -- 'scheduled', 'manual', 'webhook'
  metadata JSONB,                  -- Full intelligence stored
  recorded_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Common Patterns

### Check Treasury Health in Controller

```typescript
import { getTreasuryHealthHandler } from '@/api/treasury';

// Called via GET /api/treasury/health/:daoId
app.get('/api/treasury/health/:daoId', getTreasuryHealthHandler);
```

### Manual Monitoring Trigger

```typescript
import { monitorDaoTreasuryNow } from '@/services/treasury-monitoring.service';

// After significant treasury change
await monitorDaoTreasuryNow(daoId);
```

### Fetch Price for UI

```typescript
import { getAssetPrice } from '@/services/price.service';

// In dashboard component
const price = await getAssetPrice(asset.symbol, asset.chain);
const usdValue = (asset.amount * price.priceUsd).toFixed(2);
```

### Historical Trending (Dashboard)

```typescript
import { getTreasuryHealthHistory } from '@/services/treasury-monitoring.service';

const history = await getTreasuryHealthHistory(daoId, 30);
// Plot line chart: history.map(h => ({
//   date: h.timestamp,
//   score: h.healthScore,
//   status: h.healthStatus
// }))
```

## Configuration

### Monitoring Schedule

Edit `/server/index.ts` line ~730:

```typescript
initTreasuryMonitoring({
  enabled: true,
  scheduleExpression: '0 */6 * * *',  // Cron: every 6 hours
  includeMetadata: false,              // Store full intelligence
  batchSize: 10                        // DAOs per batch
});
```

### Price Sources Priority

1. Local cache (1 hour TTL)
2. Coingecko API
3. Hardcoded fallbacks

Edit `/server/services/price.service.ts` lines 30-50 for fallback prices.

## Troubleshooting

### "Price fetch failed" logs

- **Check:** Is Coingecko API accessible?
- **Fix:** Add token to COINGECKO_IDS map if missing
- **Fallback:** System uses fallback prices automatically

### Health scores always same

- **Check:** Is monitoring job running? Check logs for "Treasury health monitoring cycle completed"
- **Fix:** Restart server, ensure `initTreasuryMonitoring()` is called
- **Manual:** Call `monitorDaoTreasuryNow(daoId)` API

### Empty history

- **Check:** Is treasuryHealthHistory table created?
- **Fix:** Run database migration
- **Test:** Call health endpoint, wait 1 minute, call again

### Missing vault holdings

- **Check:** Are token amounts stored in vaultTokenHoldings?
- **Fix:** Ensure UI is storing holdings when creating DAOs
- **Test:** Query `SELECT * FROM vault_token_holdings WHERE vault_id = ?`

## Performance Tips

1. **Batch Monitoring:** Default batch size 10 works for <500 DAOs
2. **Cache Prices:** Prices cached for 1 hour, adjust if needed
3. **Metadata Storage:** Disable in production (`includeMetadata: false`)
4. **History Cleanup:** Delete old records >90 days (optional task)

## Testing

```bash
# Test analyze endpoint
curl -X POST http://localhost:5000/api/treasury/analyze \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"daoId": "test-id"}'

# Test formula recommendation
curl -X POST http://localhost:5000/api/treasury/recommend-formula \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"daoId": "test-id", "daoType": "collective"}'

# Test health endpoint
curl http://localhost:5000/api/treasury/health/test-id?includeHistory=true \
  -H "Authorization: Bearer {token}"
```

## Production Checklist

- [ ] Database: treasuryHealthHistory table created
- [ ] Environment: NODE_ENV=production
- [ ] Monitoring: initTreasuryMonitoring() called in server/index.ts
- [ ] Prices: Coingecko API accessible or fallback tested
- [ ] Logging: Check /var/log/app.log for monitoring cycle logs
- [ ] Graceful shutdown: Server stops cleanly (monitoring cleanup)
- [ ] Cron: Verify monitoring runs at configured intervals
