# Staking Absorption Monitoring Dashboard Implementation

**Status**: Ready for Development  
**Priority**: CRITICAL (first implementation task after testnet deployment)  
**Owner**: Analytics/Frontend Team  

---

## Dashboard Objectives

1. **Track vesting overhang threat** in real-time
2. **Alert operations team** if absorption drops below critical thresholds
3. **Show users** their participation in the absorption story
4. **Forecast** monthly vesting pressure vs staking rewards
5. **Enable governance proposals** based on live metrics

---

## Core Monitoring Functions (Implemented in MtaaToken.sol)

### 1. `getStakingAbsorptionRate()` → Absorption %

```solidity
function getStakingAbsorptionRate() external view returns (uint256 absorptionPercent)
```

**Returns**: Percentage of circulating supply currently staked (0-100)

**Example**:
- Total Supply: 1B MTAA
- Burned: 10M MTAA
- Circulating: 990M MTAA
- Staked: 200M MTAA
- **Absorption Rate: 20%**

**Dashboard Use**:
```
┌──────────────────────────┐
│ ABSORPTION RATE: 20%     │
│ ████░░░░░░░░░░░░░░░░░░  │
│ Target: 40%              │
│ Gap: 20 points needed    │
└──────────────────────────┘
```

---

### 2. `getStakingMetrics()` → Complete Status

```solidity
function getStakingMetrics() external view returns (
    uint256 rate,                    // 20 (20%)
    uint256 totalStaked,             // 200M MTAA
    uint256 circulatingSupply,       // 990M MTAA
    uint256 monthlyVestingPressure,  // 6.25M MTAA
    uint256 vestingRewardRatio       // 1800 (18.00 = healthy)
)
```

**Dashboard Use** - Health Card:
```
┌─────────────────────────────────────┐
│ ECOSYSTEM HEALTH                    │
├─────────────────────────────────────┤
│ Absorption Rate:         20%        │
│ Total Staked:            200M MTAA  │
│ Circulating Supply:      990M MTAA  │
│                                     │
│ Monthly Vesting:         6.25M      │
│ Staking Rewards:         3.0M       │
│ Vesting/Reward Ratio:    2.08x 🔴  │
│                          (needs >1.0x) │
└─────────────────────────────────────┘
```

**Understanding vestingRewardRatio**:
- **<1.0**: Staking rewards > vesting pressure ✅ GOOD
- **1.0-1.5**: Balanced, but tight ⚠️ CAUTION
- **1.5+**: Vesting pressure > rewards 🔴 CRISIS

---

### 3. `getAbsorptionAlert()` → Status + Action

```solidity
function getAbsorptionAlert() external view returns (
    bool isAlert,
    string memory severity,      // "OK", "WARNING", "CRITICAL"
    string memory recommendedAction
)
```

**Alert States**:

| Absorption | Severity | Action |
|------------|----------|--------|
| **≥40%** | OK | "Target achieved" |
| **35-40%** | CAUTION | "Monitor closely" |
| **30-35%** | WARNING | "Increase APY to 20%+ and launch campaigns" |
| **<30%** | CRITICAL | "Emergency APY increase + treasury buyback" |

**Dashboard Implementation - Alert Panel**:
```
┌─────────────────────────────────────┐
│ 🟢 STATUS: OK                        │
│                                     │
│ Absorption at 40%+                  │
│ Vesting pressure manageable         │
│ Recommend: Continue current APY     │
│                                     │
│ Last checked: 2 minutes ago         │
└─────────────────────────────────────┘
```

---

### 4. `getVestingForecast()` → 36-Month Projection

```solidity
function getVestingForecast() external pure returns (
    uint256[] memory months,           // [1,2,3,...,36]
    uint256[] memory monthlyReleases   // [6.25M, 6.25M, ..., 20.15M]
)
```

**Dashboard Use - Risk Timeline**:
```
Monthly Vesting Release Forecast
═════════════════════════════════════

20M │                              ╭─────
    │                         ╭────┤ ALL
    │                    ╭────┤    │ VESTING
15M │               ╭────┤    │    │ ACTIVE
    │          ╭────┤    │    │    │
    │     ╭────┤    │    │    │    │
10M │ ╱──╭┤    │    │    │    │    │
    │╱   │ Community + Ecosystem + Partners
5M  │────┘      + Partners  + Team
    │
    └─────────────────────────────────
      1  6  12  18  24  30  36 Months

CRITICAL ZONE: Month 18+ (20M/month)
Key Dates: 
  Month 6: Ecosystem cliff (10.81M/mo)
  Month 7: Partner cliff (15.98M/mo)
  Month 13: Team cliff (20.15M/mo)
```

---

## Dashboard Layout (React Component Sketch)

```javascript
// DashboardPage.jsx
import { useMtaaToken } from '@/hooks/useMtaaToken';
import { useEffect, useState } from 'react';

export function StakingAbsorptionDashboard() {
    const mtaa = useMtaaToken();
    const [metrics, setMetrics] = useState(null);
    const [alert, setAlert] = useState(null);
    const [forecast, setForecast] = useState(null);

    useEffect(() => {
        // Fetch metrics every 5 minutes
        const interval = setInterval(async () => {
            const [rate, metrics, alert, forecast] = await Promise.all([
                mtaa.getStakingAbsorptionRate(),
                mtaa.getStakingMetrics(),
                mtaa.getAbsorptionAlert(),
                mtaa.getVestingForecast(),
            ]);

            setMetrics({
                rate: rate / 100,
                ...metrics,
            });
            setAlert(alert);
            setForecast(forecast);
        }, 5 * 60 * 1000); // 5 minutes

        return () => clearInterval(interval);
    }, []);

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'OK': return '#10B981';
            case 'CAUTION': return '#F59E0B';
            case 'WARNING': return '#EF4444';
            case 'CRITICAL': return '#991B1B';
            default: return '#6B7280';
        }
    };

    return (
        <div className="dashboard">
            {/* Main Gauge */}
            <AbsorptionGauge rate={metrics?.rate || 0} />

            {/* Alert Banner */}
            <AlertBanner
                severity={alert?.severity}
                message={alert?.recommendedAction}
                color={getSeverityColor(alert?.severity)}
            />

            {/* Metrics Grid */}
            <MetricsGrid metrics={metrics} />

            {/* Vesting Timeline */}
            <VestingForecastChart forecast={forecast} />

            {/* User Participation */}
            <UserParticipationCard />

            {/* Raw Data Export */}
            <RawDataPanel metrics={metrics} />
        </div>
    );
}
```

---

## Data Collection Endpoints

### GraphQL Query (Subgraph)

```graphql
query StakingMetrics($blockNumber: Int) {
  mtaaToken(block: {number: $blockNumber}) {
    id
    totalSupply
    totalBurned
    totalStaked
    
    # Absorption metrics
    absorptionRate: staking_absorption_rate
    
    # Vesting info
    vestingSchedules {
      id
      amount
      cliff
      duration
      cliffMonths: cliff_period
      startTime
    }
    
    # APY info
    apyCalculator {
      id
      currentAPY
      latest {
        baseAPY: new_apy
        scaleDivisor: scale_divisor
        timestamp
      }
    }
    
    # Staker participation
    stakes(first: 1000) {
      user {
        id
      }
      amount
      lockPeriod
      stakeTime
    }
  }
}
```

### REST API Endpoint

```
GET /api/metrics/staking-absorption

Response:
{
  "timestamp": 1713880000,
  "rate": 20,
  "totalStaked": "200000000000000000000000000",
  "circulatingSupply": "990000000000000000000000000",
  "monthlyVestingPressure": "6250000000000000000000000",
  "vestingRewardRatio": 1800,
  "alert": {
    "severity": "CAUTION",
    "urgency": 5,
    "recommendedAction": "Monitor closely..."
  },
  "forecast": {
    "nextCriticalDate": "2026-07-01",
    "daysToCritical": 69,
    "estimatedAbsorptionAtCritical": 28
  }
}
```

---

## Real-time Alert System

### WebSocket Connection

```javascript
// Subscribe to live metrics
const ws = new WebSocket('wss://metrics.mtaadao.com/live');

ws.onmessage = (event) => {
    const update = JSON.parse(event.data);
    
    if (update.alert.severity !== 'OK') {
        // Show notification
        showAlert(update.alert.recommendedAction);
    }
    
    // Update dashboard in real-time
    updateDashboard(update);
};
```

---

## Critical Alerts for Ops Team

### Alert 1: Absorption Below 35%

**Conditions**:
- Absorption rate < 35%
- For 2+ consecutive checks (10+ minutes)

**Action**:
- Send email to operations team
- Slack message to #crisis-response
- Log incident in monitoring system
- Trigger Phase 2 of operational playbook

**Message Template**:
```
🚨 [ALERT] Staking Absorption Below 35%

Current: 32%
Target: 40% (by month 12)
Vesting/Reward Ratio: 1.8x (HIGH)

RECOMMENDED ACTIONS:
1. Increase APY from 18% to 22%
2. Launch "Boost Staking" partner campaign
3. Schedule community call (transparency)

Time to implement: Within 24 hours
Estimated cost: $50K in additional incentives
```

---

### Alert 2: Vesting Cliff Approaching

**Conditions**:
- Within 30 days of scheduled vesting cliff
- Absorption still <35%

**Action**:
- Daily monitoring (instead of weekly)
- Activate full emergency playbook
- Prepare governance vote for vesting adjustment

**Message Template**:
```
⚠️️ [WARNING] Vesting Cliff Approaching

Community Rewards cliff: 26 days
Expected release: 6.25M MTAA/month
Current absorption: 30%

If unchanged:
- Vesting/Reward ratio will jump to 2.1x
- Additional sell pressure: -5.13M/month
- Estimated price impact: -15% over month

ACTIONS REQUIRED:
1. Increase APY to 25% (temporary boost)
2. Partner announcements (show confidence)
3. Prepare governance vote for alternative
```

---

### Alert 3: DAU Trending Down

**Conditions**:
- Daily Active Users -20% week-over-week
- Absorption flat or declining

**Action**:
- Investigate cause (competitor? news? bug?)
- Engagement campaign launch
- Feature launch (if ready)

---

## Implementation Timeline

### Week 1 (Post-Testnet Deployment)
- [ ] Create React component for main gauge
- [ ] Connect to MtaaToken contract monitoring functions
- [ ] Query vesting forecast (static data, no contract call)
- [ ] Wire up basic alerts

### Week 2
- [ ] Build subgraph indexer for historical data
- [ ] Create GraphQL endpoint for dashboard queries
- [ ] Add WebSocket for real-time updates
- [ ] Implement email/Slack alerts

### Week 3
- [ ] Build user participation cards
- [ ] Create leaderboard (top stakers, highest rep)
- [ ] Implement vesting timeline chart
- [ ] Add raw data export (CSV)

### Week 4
- [ ] Load testing (ensure sub-1s queries)
- [ ] Mobile responsive design
- [ ] Community feedback session
- [ ] Launch internal beta

---

## Success Metrics (Dashboard Must Provide)

By **Month 6**, dashboard should:

✅ Load metrics in <1 second (p95)  
✅ Alert team within 2 minutes of threshold breach  
✅ Display 100% accurate absorption rate  
✅ Show accurate vesting forecast vs actual releases  
✅ Provide audit trail of all governance changes  
✅ Enable quick decision-making (no manual calculation needed)  

---

## Integration with Governance

Dashboard feeds should automatically populate governance proposals:

```solidity
// Example: Auto-generate proposal if absorption <30%
proposal {
    title: "Emergency APY Increase to 25%",
    description: "Absorption rate at 28%, below critical threshold.",
    actions: [
        {
            target: "FloatingAPYCalculator",
            method: "updateAPYParameters",
            params: [2500, 100]  // 25% APY, same scale
        }
    ],
    votingEndBlock: block.number + 21600,  // 7 days
    quorumRequired: 40,  // 40% of MTAA voting power
}
```

---

## Maintenance & Updates

### Monthly Review
- Check if forecast matches actual vesting releases
- Adjust model if there are systematic errors
- Update dashboard with new metrics if governance changes APY parameters

### Quarterly Audit
- Full validation of absorption calculation
- Historical accuracy verification
- User feedback incorporation
- Performance optimization

---

**Document Version**: 1.0  
**Last Updated**: April 23, 2026  
**Next Review**: May 6, 2026 (right after testnet deployment)
