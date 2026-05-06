# MTAA DAO: Week 1 Backend API Specifications

**For:** Backend Engineering Team  
**Deadline:** End of Week 1 (February 2, 2026)  
**Backend Lead:** [NAME]  
**Effort:** ~6-8 hours

---

## Overview

Three API endpoints are needed to support Week 1 frontend components:
1. **Persona Detection** - Detect user type (Okedi/Yuki/Amara)
2. **User's DAOs** - List all DAOs user belongs to
3. **Dashboard Data** - Persona-specific data

**Tech Stack:**
- Express.js
- TypeScript
- PostgreSQL
- Drizzle ORM

---

## Endpoint 1: Persona Detection

### Route
```
GET /api/users/persona-data
```

### Authentication
- ✅ Required (JWT token in Authorization header)
- Scope: Read user's own data

### Response
```json
{
  "persona": "okedi|yuki|amara",
  "accountAge": 30,
  "totalBalance": 2500.50,
  "daoCount": 2,
  "daoRoles": ["member", "proposer"],
  "featuresUnlocked": ["wallet.basic", "vault.deposit"],
  "transactionCount": 15
}
```

### TypeScript Types

```typescript
// src/types/persona.ts
export type DashboardPersona = 'okedi' | 'yuki' | 'amara';

export interface PersonaData {
  persona: DashboardPersona;
  accountAge: number;           // days since account creation
  totalBalance: number;          // USD
  daoCount: number;
  daoRoles: string[];
  featuresUnlocked: string[];
  transactionCount: number;
}
```

### Implementation Logic

```typescript
// src/routes/users.ts or src/services/personaService.ts

export async function detectPersona(userId: string): Promise<PersonaData> {
  // 1. Get user creation date
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { createdAt: true }
  });
  
  const accountAge = Math.floor(
    (Date.now() - new Date(user!.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // 2. Calculate total balance across all wallets
  const wallets = await db.query.wallets.findMany({
    where: eq(wallets.userId, userId)
  });
  
  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  
  // 3. Count DAOs user belongs to
  const daoMemberships = await db.query.daoMembers.findMany({
    where: eq(daoMembers.userId, userId)
  });
  
  const daoCount = daoMemberships.length;
  const daoRoles = daoMemberships.map(m => m.role);
  
  // 4. Count transactions
  const transactionCount = await db.query.transactions.count({
    where: eq(transactions.userId, userId)
  });
  
  // 5. Determine unlocked features (based on user's feature_flags table)
  const featureFlags = await db.query.userFeatureFlags.findMany({
    where: and(
      eq(userFeatureFlags.userId, userId),
      eq(userFeatureFlags.enabled, true)
    )
  });
  
  const featuresUnlocked = featureFlags.map(f => f.featureName);
  
  // 6. Determine persona
  let persona: DashboardPersona = 'okedi';
  
  if (
    accountAge > 60 ||
    totalBalance > 50000 ||
    featuresUnlocked.includes('trading.dex') ||
    (daoRoles.includes('elder') || daoRoles.includes('proposer')) && daoCount > 2
  ) {
    persona = 'amara';
  } else if (
    (accountAge > 14 && (daoCount > 0 || daoRoles.includes('proposer'))) ||
    totalBalance > 5000
  ) {
    persona = 'yuki';
  }
  
  return {
    persona,
    accountAge,
    totalBalance,
    daoCount,
    daoRoles,
    featuresUnlocked,
    transactionCount
  };
}
```

### Error Handling

```typescript
// 401 Unauthorized
{ "error": "Authentication required" }

// 404 Not Found
{ "error": "User not found" }

// 500 Server Error
{ "error": "Failed to detect persona" }
```

---

## Endpoint 2: User's DAOs List

### Route
```
GET /api/users/my-daos
```

### Authentication
- ✅ Required (JWT token)
- Scope: Read user's DAO memberships

### Query Parameters
```
?limit=100&offset=0  (Optional pagination)
```

### Response
```json
[
  {
    "id": "dao_abc123",
    "name": "Kenya Tech Guild",
    "avatar": "https://ipfs.io/...",
    "role": "admin",
    "treasury": 125000.50
  },
  {
    "id": "dao_def456",
    "name": "Farmer's Cooperative",
    "avatar": null,
    "role": "member",
    "treasury": 45000.00
  }
]
```

### TypeScript Types

```typescript
// src/types/dao.ts
export interface DAO {
  id: string;
  name: string;
  avatar?: string;
  role: "member" | "proposer" | "admin" | "elder";
  treasury?: number; // USD
}
```

### Implementation Logic

```typescript
// src/routes/users.ts

export async function getUserDaos(userId: string): Promise<DAO[]> {
  const memberships = await db.query.daoMembers.findMany({
    where: eq(daoMembers.userId, userId),
    with: {
      dao: {
        columns: {
          id: true,
          name: true,
          avatar: true,
          treasuryAddress: true
        }
      }
    }
  });
  
  // Fetch treasury balances from blockchain or cache
  const daos = await Promise.all(
    memberships.map(async (membership) => {
      const treasuryBalance = await getTreasuryBalance(
        membership.dao.treasuryAddress
      );
      
      return {
        id: membership.dao.id,
        name: membership.dao.name,
        avatar: membership.dao.avatar,
        role: membership.role,
        treasury: treasuryBalance
      };
    })
  );
  
  return daos;
}

// Helper to get treasury balance from blockchain or cache
async function getTreasuryBalance(treasuryAddress: string): Promise<number> {
  // First check cache
  const cached = await redis.get(`treasury:${treasuryAddress}`);
  if (cached) return JSON.parse(cached);
  
  // Otherwise fetch from blockchain
  const balance = await getBalanceFromBlockchain(treasuryAddress);
  
  // Cache for 5 minutes
  await redis.setex(
    `treasury:${treasuryAddress}`,
    300,
    JSON.stringify(balance)
  );
  
  return balance;
}
```

### Error Handling

```typescript
// 401 Unauthorized
{ "error": "Authentication required" }

// 500 Server Error
{ "error": "Failed to fetch DAOs" }
```

---

## Endpoint 3: Dashboard Data (Per Persona)

### Route
```
GET /api/dashboard/{persona}
```

Where `{persona}` = `okedi` | `yuki` | `amara`

### Authentication
- ✅ Required (JWT token)
- Scope: Read user's dashboard data

### Response (OKEDI)

```json
{
  "totalBalance": 2500.50,
  "recentTransactions": [
    {
      "id": "tx_123",
      "type": "receive",
      "amount": 500,
      "from": "Alice Kipchoge",
      "timestamp": "2026-01-25T10:30:00Z",
      "status": "completed"
    },
    {
      "id": "tx_124",
      "type": "send",
      "amount": 100,
      "to": "Market Vendor",
      "timestamp": "2026-01-24T14:15:00Z",
      "status": "completed"
    },
    {
      "id": "tx_125",
      "type": "deposit",
      "amount": 1000,
      "timestamp": "2026-01-23T09:00:00Z",
      "status": "completed"
    }
  ],
  "tipOfTheDay": "Did you know? You can earn passive income by depositing to a vault. Your money grows while you sleep!"
}
```

### Response (YUKI)

```json
{
  "personalBalance": 2500.50,
  "daoTreasury": 125000.00,
  "pendingActions": [
    {
      "id": "action_1",
      "title": "Vote on 'Q2 Budget' proposal",
      "href": "/proposals/prop_123",
      "daoName": "Kenya Tech Guild"
    },
    {
      "id": "action_2",
      "title": "Review new member application",
      "href": "/daos/dao_abc/members",
      "daoName": "Kenya Tech Guild"
    }
  ],
  "latestProposal": {
    "id": "prop_456",
    "title": "Increase Treasury Allocation to Education Fund",
    "description": "Propose allocating 20% of quarterly revenue to education initiatives",
    "daoName": "Kenya Tech Guild",
    "status": "active",
    "votesRequired": 10,
    "currentVotes": 7
  }
}
```

### Response (AMARA)

```json
{
  "portfolioValue": 125000.50,
  "roiYtd": 18.5,
  "gainsSinceStart": 22000.00,
  "opportunities": [
    {
      "id": "opp_1",
      "title": "CELO Yield Farm",
      "description": "Earn 15% APY by providing liquidity",
      "type": "farming",
      "apr": 15.0,
      "risk": "medium",
      "href": "/trading/farm/celo"
    },
    {
      "id": "opp_2",
      "title": "Curve.fi Arbitrage",
      "description": "Low-risk stablecoin arbitrage opportunity",
      "type": "arbitrage",
      "apr": 8.5,
      "risk": "low",
      "href": "/trading/arb/curve"
    }
  ],
  "alerts": [
    "⚠️ Your CELO position is down 5% - consider rebalancing",
    "🟢 New farming opportunity: 20% APY on USDCxcUSDC",
    "📊 Your portfolio allocation suggests reducing DEX exposure"
  ]
}
```

### TypeScript Types

```typescript
// src/types/dashboard.ts

export interface OkediDashboard {
  totalBalance: number;
  recentTransactions: Transaction[];
  tipOfTheDay: string;
}

export interface YukiDashboard {
  personalBalance: number;
  daoTreasury: number;
  pendingActions: PendingAction[];
  latestProposal: ProposalSummary;
}

export interface AmaraDashboard {
  portfolioValue: number;
  roiYtd: number;
  gainsSinceStart: number;
  opportunities: Opportunity[];
  alerts: string[];
}

export interface Transaction {
  id: string;
  type: "send" | "receive" | "deposit" | "withdraw";
  amount: number;
  to?: string;
  from?: string;
  timestamp: string;
  status: "completed" | "pending" | "failed";
}

export interface PendingAction {
  id: string;
  title: string;
  href: string;
  daoName?: string;
}

export interface ProposalSummary {
  id: string;
  title: string;
  description: string;
  daoName: string;
  status: "pending" | "active" | "executed" | "rejected";
  votesRequired: number;
  currentVotes: number;
}

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  type: "yield" | "trading" | "arbitrage" | "farming";
  apr: number;
  risk: "low" | "medium" | "high";
  href: string;
}
```

### Implementation Logic (OKEDI)

```typescript
// src/routes/dashboard.ts

export async function getOkediDashboard(userId: string): Promise<OkediDashboard> {
  // Get total balance
  const wallets = await db.query.wallets.findMany({
    where: eq(wallets.userId, userId)
  });
  
  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  
  // Get recent transactions (limit 3, sorted by date DESC)
  const transactions = await db.query.transactions.findMany({
    where: eq(transactions.userId, userId),
    orderBy: desc(transactions.createdAt),
    limit: 3
  });
  
  // Rotate through tips
  const tips = [
    "Did you know? You can earn passive income by depositing to a vault. Your money grows while you sleep!",
    "💡 Set up automated savings with recurring deposits",
    "🔒 Enable 2FA for maximum account security",
    "📱 Download the mobile app for on-the-go management",
    "🤝 Refer friends and earn rewards!"
  ];
  
  const dayOfYear = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const tipOfTheDay = tips[dayOfYear % tips.length];
  
  return {
    totalBalance,
    recentTransactions: transactions.map(t => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      from: t.fromAddress,
      to: t.toAddress,
      timestamp: t.createdAt.toISOString(),
      status: t.status
    })),
    tipOfTheDay
  };
}
```

### Implementation Logic (YUKI)

```typescript
export async function getYukiDashboard(userId: string): Promise<YukiDashboard> {
  // Personal balance
  const personalBalance = await getUserTotalBalance(userId);
  
  // DAO treasury
  const daoMemberships = await db.query.daoMembers.findMany({
    where: eq(daoMembers.userId, userId),
    with: { dao: true }
  });
  
  const treasurySum = await Promise.all(
    daoMemberships.map(m => getTreasuryBalance(m.dao.treasuryAddress))
  ).then(balances => balances.reduce((a, b) => a + b, 0));
  
  // Pending actions
  const pendingActions = await getPendingActionsForUser(userId);
  
  // Latest proposal from user's DAOs
  const proposals = await db.query.proposals.findMany({
    where: inArray(proposals.daoId, daoMemberships.map(m => m.daoId)),
    orderBy: desc(proposals.createdAt),
    limit: 1,
    with: { dao: true }
  });
  
  const latestProposal = proposals[0];
  
  return {
    personalBalance,
    daoTreasury: treasurySum,
    pendingActions,
    latestProposal: {
      id: latestProposal.id,
      title: latestProposal.title,
      description: latestProposal.description,
      daoName: latestProposal.dao.name,
      status: latestProposal.status,
      votesRequired: latestProposal.votesRequired,
      currentVotes: latestProposal.currentVotes
    }
  };
}
```

### Implementation Logic (AMARA)

```typescript
export async function getAmaraDashboard(userId: string): Promise<AmaraDashboard> {
  // Portfolio value (sum of all holdings)
  const portfolioValue = await calculatePortfolioValue(userId);
  
  // ROI calculations
  const { roiYtd, gainsSinceStart } = await calculateReturns(userId);
  
  // Active opportunities (from cache or API)
  const opportunities = await getActiveOpportunities(userId);
  
  // Generate alerts based on portfolio
  const alerts = await generatePortfolioAlerts(userId);
  
  return {
    portfolioValue,
    roiYtd,
    gainsSinceStart,
    opportunities,
    alerts
  };
}

async function generatePortfolioAlerts(userId: string): Promise<string[]> {
  const portfolio = await getPortfolioDetails(userId);
  const alerts: string[] = [];
  
  // Check allocations
  if (portfolio.dexAllocation > 40) {
    alerts.push("📊 Your portfolio allocation suggests reducing DEX exposure");
  }
  
  // Check performance
  const underperformers = portfolio.positions.filter(p => p.change7d < -5);
  if (underperformers.length > 0) {
    alerts.push(`⚠️ ${underperformers[0].symbol} is down 5% - consider rebalancing`);
  }
  
  // Check for new opportunities
  const newOpportunities = await getNewOpportunitiesCount();
  if (newOpportunities > 0) {
    alerts.push(`🟢 New farming opportunity: 20% APY on USDCxcUSDC`);
  }
  
  return alerts.slice(0, 3); // Max 3 alerts
}
```

### Error Handling

```typescript
// 400 Bad Request (invalid persona)
{ "error": "Invalid persona. Must be 'okedi', 'yuki', or 'amara'" }

// 401 Unauthorized
{ "error": "Authentication required" }

// 500 Server Error
{ "error": "Failed to fetch dashboard data" }
```

---

## Implementation Timeline

### Day 1: Setup & Structure
- [ ] Create types files (`src/types/persona.ts`, `src/types/dashboard.ts`)
- [ ] Create service files (`src/services/personaService.ts`, `src/services/dashboardService.ts`)
- [ ] Create route files (`src/routes/users.ts`, `src/routes/dashboard.ts`)

### Day 2: Implement Endpoints
- [ ] Implement `/api/users/persona-data`
- [ ] Implement `/api/users/my-daos`
- [ ] Add database queries

### Day 3: Implement Dashboard Data
- [ ] Implement `/api/dashboard/okedi`
- [ ] Implement `/api/dashboard/yuki`
- [ ] Implement `/api/dashboard/amara`

### Day 4: Testing & Debugging
- [ ] Unit tests for each endpoint
- [ ] Integration tests with database
- [ ] Manual testing with frontend
- [ ] Performance optimization (caching)

---

## Database Queries Needed

### Get User Creation Date
```sql
SELECT created_at FROM users WHERE id = $1;
```

### Get User Wallets
```sql
SELECT * FROM wallets WHERE user_id = $1;
```

### Get DAO Memberships
```sql
SELECT * FROM dao_members WHERE user_id = $1;
```

### Get Recent Transactions
```sql
SELECT * FROM transactions 
WHERE user_id = $1 
ORDER BY created_at DESC 
LIMIT 3;
```

### Get DAO Treasury (needs blockchain query)
```typescript
// Query balance from blockchain
const balance = await ethers.provider.getBalance(treasuryAddress);
```

### Get Proposals
```sql
SELECT * FROM proposals 
WHERE dao_id IN (SELECT dao_id FROM dao_members WHERE user_id = $1)
ORDER BY created_at DESC 
LIMIT 1;
```

---

## Caching Strategy

To optimize performance, implement caching:

```typescript
// Cache persona for 1 hour
const cacheKey = `persona:${userId}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const result = await detectPersona(userId);
await redis.setex(cacheKey, 3600, JSON.stringify(result));
```

---

## Testing Checklist

- [ ] All endpoints return correct response format
- [ ] All TypeScript types are correct
- [ ] Error handling works for all error cases
- [ ] Authentication/authorization checks pass
- [ ] Database queries are optimized (use EXPLAIN ANALYZE)
- [ ] Response times are < 500ms
- [ ] Caching works correctly

---

**Backend Deadline:** February 2, 2026  
**Estimated Effort:** 6-8 hours  
**Dependencies:** None (can work in parallel with frontend)

Ready to implement? Let's go! 🚀
