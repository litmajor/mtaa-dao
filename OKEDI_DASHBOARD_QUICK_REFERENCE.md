# OkediDashboard Production API - Quick Reference

## 🚀 What Changed

**Mock Data → Real API Integration**

The OkediDashboard now pulls live data from your backend instead of hardcoded test data.

## 📍 Key Files

| File | Purpose |
|------|---------|
| `client/src/api/dashboardApi.ts` | API functions (NEW) |
| `client/src/components/dashboard/OkediDashboard.tsx` | Dashboard component |
| `server/routes/dashboard.ts` | API endpoints |
| `server/services/dashboardService.ts` | Backend logic |

## 🔌 API Usage

### In Components
```typescript
import { getOkediDashboard } from '@/api/dashboardApi';

// Fetch data
const data = await getOkediDashboard();
```

### Available Functions
```typescript
// Main dashboard data
getOkediDashboard()           // Beginner dashboard
getYukiDashboard()            // Intermediate dashboard
getAmaraDashboard()           // Advanced dashboard

// Individual endpoints
getUserPersona()              // User type & metrics
getUserDAOs()                 // List of user's DAOs
getActiveProposals()          // Current proposals
getRecentTransactions(limit)  // User transactions
getActiveEscrows()            // Escrow deals
getGovernanceStats()          // Voting power, etc.
getReferralStats()            // Referral earnings
getDAOChat(daoId)            // Chat messages

// Actions
voteOnProposal(id, vote)     // Submit vote
```

## 📊 Data Flow

```
Component (OkediDashboard)
    ↓
API Module (dashboardApi.ts)
    ↓ 
Backend Routes (/api/dashboard/okedi)
    ↓
Database (Drizzle ORM)
```

## ✅ Error Handling

```typescript
try {
  const data = await getOkediDashboard();
  setData(data);
} catch (error) {
  setError(error.message);
  // Error UI displayed to user
}
```

## 🧪 Testing

### Manual
1. Open dashboard
2. Check Network tab → `/api/dashboard/okedi`
3. Verify response has all fields
4. Check dashboard displays data

### Automated
```bash
# Test endpoint
curl http://localhost:3000/api/dashboard/okedi \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔐 Authentication

All requests include cookies automatically:
```typescript
credentials: 'include'  // Sends auth cookies
```

No need to add auth headers manually.

## 📱 Response Format

```json
{
  "totalBalance": 12847.50,
  "trustScore": 92,
  "governanceScore": 485,
  "myDAOs": [...],
  "activeProposals": [...],
  "recentTransactions": [...],
  "tipOfTheDay": "..."
}
```

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Login required, session expired |
| 404 Not Found | API endpoint missing/wrong path |
| 500 Error | Check server logs, database issue |
| No data shown | Check Network tab → API response |
| Loading forever | API slow, check backend performance |

## 📝 Making Changes

### To Add New Data Field:
1. **Backend** → Update `OkediDashboardData` interface in `dashboardService.ts`
2. **Backend** → Add field to `getOkediDashboard()` function
3. **Frontend** → Field automatically available (typed)
4. **Frontend** → Use in component: `data.newField`

### To Add New API Endpoint:
1. **Backend** → Create route in `server/routes/dashboard.ts`
2. **Frontend** → Add function to `dashboardApi.ts`
3. **Frontend** → Import and use in component

## 🚨 Important Notes

⚠️ **Authentication Required**
- All endpoints require user to be logged in
- Requests with invalid auth will return 401

⚠️ **Data Consistency**
- Dashboard reflects current database state
- Changes in other components affect dashboard
- May need refresh if data updated elsewhere

⚠️ **Performance**
- Single API call loads all dashboard data
- ~2-3 second load time typical
- Consider caching for repeated loads

### Onboarding & KYC (Signup flow)

- Wallet creation: a wallet is created/connected when the user completes signup. Ensure the UX clarifies whether the wallet is auto-created or the user must connect an external wallet.
- Choose profile: user selects a profile on first sign-up — default should be `OKEDI` if the user accepts defaults.
- Onboarding / profile completion: after signup, prompt users to complete profile (username, display profile, settings, preferences). Guide users through necessary configuration for first use.
- KYC enforcement for financial operations: KYC must be completed before users can perform high-risk financial operations (send/withdraw beyond minimal limits). When a non-KYC user attempts to send/withdraw, show a clear prompt explaining current limits and a CTA to "Complete KYC to increase limits". Consider disabling high-value transfer actions until KYC is finished, but allow low-value test transfers if desired.

UX suggestions:

- Show an onboarding checklist in the dashboard header until all steps are completed (Wallet ✓, Profile ✓, KYC ✗).
- For send/withdraw screens show a banner when KYC is incomplete: "Complete KYC to increase your transfer limits" with a link to the KYC flow.
- Surface current transfer limits in the send flow and explain how KYC raises those limits.

## 🔗 Related Docs

- [Full Migration Guide](OKEDI_DASHBOARD_API_MIGRATION.md)
- [Backend Routes](server/ROUTES.md)
- [Database Schema](shared/schema.ts)
- [Lucide Icons Reference](LUCIDE_REACT_ICONS_VERIFIED.md)

## ❓ FAQ

**Q: How do I refresh the dashboard data?**  
A: Call `window.location.reload()` or re-trigger the `useEffect` hook

**Q: Can I cache the data?**  
A: Yes, use React Query or add caching in `dashboardApi.ts`

**Q: What if API is slow?**  
A: Add loading skeletons, pagination, or lazy-load sections

**Q: How do I add real-time updates?**  
A: Implement WebSocket in `dashboardApi.ts` or use Server-Sent Events

**Q: Is authentication automatic?**  
A: Yes, cookies are sent with `credentials: 'include'`

---

**Last Updated:** January 28, 2026  
**Status:** ✅ Production Ready
