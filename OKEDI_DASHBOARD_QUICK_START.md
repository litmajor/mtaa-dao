# OKEDI Dashboard Quick Start Guide

## What Changed?

✅ **Before:** PersonalizedDashboard.tsx (485 lines) with 3 internal dashboard functions mixed together  
✅ **After:** Clean architecture with separate files:
- PersonalizedDashboard.tsx - Router only (124 lines)
- OkediDashboard.tsx - OKEDI features (370 lines)
- YukiDashboard.tsx - Intermediate features (110 lines)
- AmaraDashboard.tsx - Advanced features (140 lines)

---

## Files Modified/Created

```
NEW FILES:
✅ client/src/components/dashboard/OkediDashboard.tsx (370 lines)
✅ client/src/components/dashboard/YukiDashboard.tsx (110 lines)
✅ client/src/components/dashboard/AmaraDashboard.tsx (140 lines)
✅ client/src/components/modals/SendToDAOMemberModal.tsx (380 lines)
✅ OKEDI_DASHBOARD_REFACTOR_COMPLETE.md (this guide)

MODIFIED FILES:
✅ client/src/components/dashboard/PersonalizedDashboard.tsx (485→124 lines)
✅ server/services/dashboardService.ts (+80 lines for OKEDI enhancements)
```

---

## OkediDashboard Features

### 1. Balance Card
```
🎤 Personal Balance: $12,345.67
  Trust Score: 85
  +2.5% this week
```

### 2. Quick Actions (4 buttons)
- Receive (Get funds from friends)
- Send (Send to anyone)
- Escrow (Secure payment)
- Vote (Vote on proposals)

### 3. My DAOs Section
```
[DAO Card] [DAO Card]
  - Name
  - Role (Member/Proposer/Admin/Elder)
  - Member count
```

### 4. Active Proposals
```
[Proposal 1] - 7/10 votes (progress bar)
[Proposal 2] - 5/10 votes
[Proposal 3] - 3/10 votes
```

### 5. Active Escrows
```
$100 USD - "Payment for design work"
Status: In Progress | 5 days left
```

### 6. Recent Transactions
```
Send     -$50.00    Jan 15, 2024
Receive  +$100.00   Jan 14, 2024
Escrow   -$75.00    Jan 13, 2024
```

### 7. Tip of the Day
Random rotating tips about features

---

## Using SendToDAOMemberModal

### Import
```typescript
import { SendToDAOMemberModal } from '@/components/modals/SendToDAOMemberModal';
```

### Usage
```typescript
const [open, setOpen] = useState(false);

return (
  <>
    <Button onClick={() => setOpen(true)}>
      💳 Send to DAO Member
    </Button>
    
    <SendToDAOMemberModal
      open={open}
      onOpenChange={setOpen}
      daoId={selectedDAOId} // Optional - pre-select DAO
      onSuccess={(txId) => {
        console.log('Payment sent!', txId);
        showSuccessToast();
      }}
    />
  </>
);
```

### Modal Steps
1. **Select DAO** - Choose which DAO member to pay
2. **Select Member** - Search for recipient
3. **Enter Amount** - Amount, note, escrow toggle
4. **Review** - Confirm before sending

### Escrow Options
- **On** (default): Funds held for 1-30 days, mediator can resolve disputes
- **Off**: Direct transfer, no protection

---

## Backend Integration

### OkediDashboard Data Structure
```typescript
{
  totalBalance: 12345.67,
  recentTransactions: [
    { id, type, amount, from, to, timestamp, status },
    ...
  ],
  myDAOs: [
    { id, name, description, role, memberCount },
    ...
  ],
  activeProposals: [
    { id, title, votesRequired, currentVotes, status },
    ...
  ],
  activeEscrows: [
    { id, amount, currency, description, status, daysLeft },
    ...
  ],
  trustScore: 85,
  tipOfTheDay: "..."
}
```

### API Endpoints
```
GET /api/dashboard/okedi          → OkediDashboardData
GET /api/dashboard/yuki           → YukiDashboardData
GET /api/dashboard/amara          → AmaraDashboardData
GET /api/users/my-daos            → DAO[]
GET /api/users/persona-data       → PersonaData (for detection)
```

### Required (Not Yet Implemented)
```
POST /api/wallet/send-to-member   → { success, transactionId }
GET /api/dao/{id}/members         → DAOMember[]
```

---

## Styling & Theme

### Colors Used
- Blue: CTAs, primary actions (`bg-blue-600`)
- Green: Positive metrics, success (`text-green-400`)
- Purple: DAO/governance (`from-purple-600`)
- Amber: Warnings, tips (`text-amber-600`)
- Slate: Background/borders (`bg-slate-800`, `border-slate-700`)

### Responsive Breakpoints
- Mobile: Single column
- Tablet (md): 2 columns where applicable
- Desktop (lg): 3-4 columns for grids

---

## Common Tasks

### Add Quick Action to OkediDashboard
```typescript
// In OkediDashboard.tsx, update quickActions array:
const quickActions: QuickAction[] = [
  // ... existing
  {
    id: 'new-action',
    label: 'New',
    icon: <NewIcon className="h-5 w-5" />,
    href: '/new-page',
    color: 'bg-indigo-600',
    description: 'Do something new'
  }
];
```

### Change Dashboard Data Source
```typescript
// In PersonalizedDashboard.tsx, loadDashboardData:
async function loadDashboardData() {
  const response = await apiRequest(
    "GET", 
    `/api/dashboard/${currentPersona}`
    // Can add query params: ?includeEscrows=true&limit=10
  );
  setDashboardData(response);
}
```

### Customize Trust Score Display
```typescript
// In OkediDashboard.tsx, balance card:
<div className="bg-white/20 rounded-lg px-4 py-2">
  <p className="text-xs text-blue-100 mb-1">Trust Score</p>
  <p className="text-2xl font-bold">{data?.trustScore || 50}</p>
  {/* Add tier display */}
  {data?.trustScore > 80 && <span className="text-green-300">🟢 Excellent</span>}
  {data?.trustScore > 60 && <span className="text-blue-300">🔵 Good</span>}
</div>
```

---

## Debugging

### Component Not Rendering?
1. Check `PersonalizedDashboard.tsx` - verify imports are correct
2. Check browser console for import errors
3. Verify persona is correctly set: `useActiveSubprofile()`

### SendToDAOMemberModal Not Loading Members?
1. Check network tab - `/api/dao/{id}/members` should return data
2. If 404: Endpoint not implemented yet, need to create backend handler
3. If empty: DAO might not have members, check daoMembers table

### Data Not Updating?
1. Check `/api/dashboard/okedi` response in network tab
2. Verify backend service has new fields in OkediDashboardData
3. Clear localStorage and reload: `localStorage.clear()`

---

## Testing Checklist

- [ ] Dashboard loads without errors
- [ ] All 7 sections of OkediDashboard visible
- [ ] Trust score displays correctly
- [ ] Click through SendToDAOMemberModal wizard
- [ ] Select DAO, member, amount, review
- [ ] Escrow toggle works
- [ ] Error handling on invalid inputs
- [ ] Mobile view responsive
- [ ] Switching personas reloads dashboard
- [ ] Recent transactions show correct icons

---

## Performance Tips

1. **Limit DAO Fetches:** Dashboard loads max 4 DAOs
2. **Limit Proposals:** Only loads active proposals for user's DAOs
3. **Limit Transactions:** Only shows 5 most recent
4. **Memoization:** useCallback on button handlers if needed
5. **Virtual Scrolling:** Add if lists grow beyond 20 items

---

## Browser Support

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

---

## Troubleshooting

**Problem:** "OkediDashboard is not exported"
**Solution:** Check import path in PersonalizedDashboard.tsx:
```typescript
import { OkediDashboard } from "./OkediDashboard";  // ✓
import { OkediDashboard } from "./okedi-dashboard"; // ✗
```

**Problem:** Data shows as 0 or empty
**Solution:** Check backend endpoint returns correct data:
```bash
curl http://localhost:3001/api/dashboard/okedi \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Problem:** Modal doesn't close after success
**Solution:** Verify `onOpenChange` is called:
```typescript
onSuccess?.((txId) => {
  onOpenChange(false);  // Must do this
});
```

---

## Contact & Support

- **Documentation:** See `OKEDI_DASHBOARD_REFACTOR_COMPLETE.md`
- **Issues:** Check console for errors, search error message in codebase
- **API Issues:** Verify endpoints exist in `server/routes/dashboard.ts`

---
