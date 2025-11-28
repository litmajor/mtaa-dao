# Dual Escrow Systems - Quick Start Guide

## TL;DR

You now have **two independent escrow systems** available to users:

1. **Wallet Escrow** (Peer-to-peer, instant, invite-based)
   - Access: `/wallet` → Advanced Features → "Initiate Escrow"
   - Share invite link with anyone
   - Auto-signup for recipients
   - Referral tracking built-in

2. **DAO Escrow** (Treasury-based, governance-approved)
   - Access: `/escrow` or DAO Dashboard → Treasury
   - Requires DAO membership
   - Requires community vote
   - Governance-controlled

**Both systems are fully implemented and operational.**

---

## For Users (End-to-End Flows)

### Wallet Escrow: I Want to Send Money to Someone

**Step 1:** Go to your Wallet  
**Step 2:** Click "Advanced Features"  
**Step 3:** Click "Initiate Escrow"  
**Step 4:** Fill out form:
- Who to pay (email or username)
- How much ($1 minimum, any currency)
- What it's for (description)
- Any milestones (optional)

**Step 5:** Click "Generate Invite Link"  
**Step 6:** Share via:
- WhatsApp
- Email
- Copy & paste
- System share (iPhone/Android)

**Step 7:** They accept the invite  
**Step 8:** Funds are held in escrow until complete

---

### Wallet Escrow: I Received an Invite

**Step 1:** Click the invite link from the payer  
**Step 2:** Read the escrow details (amount, description, milestones)  
**Step 3:** Click "Accept Escrow"  
**Step 4:** Sign up (if needed) or log in  
**Step 5:** You're linked to the escrow  
**Step 6:** Complete milestones as needed  
**Step 7:** Funds release when done

---

### DAO Escrow: I'm a DAO Treasurer

**Step 1:** Go to DAO Dashboard → Treasury  
**Step 2:** Click "Create Escrow"  
**Step 3:** Fill out:
- Recipient (must be DAO member)
- Amount from treasury
- What work needs to be done
- Milestones for verification

**Step 4:** Submit to community vote  
**Step 5:** Wait for approval  
**Step 6:** Fund the escrow  
**Step 7:** Member completes work  
**Step 8:** Approve milestones & release funds

---

## For Developers (Architecture Overview)

### File Structure

```
Frontend Components:
├─ wallet.tsx                    (Main wallet page)
├─ components/wallet/
│  └─ EscrowInitiator.tsx       (Modal for creating escrows)
└─ pages/
   └─ escrow-accept.tsx         (Public invite page)

Backend Endpoints:
├─ POST /api/escrow/initiate    (Create wallet escrow)
├─ GET /api/escrow/invite/:code (Preview invite)
└─ POST /api/escrow/accept/:code (Accept and link)

Database:
└─ escrowAccounts table         (Stores both types)
   └─ metadata: {
      createdFromWallet: boolean,
      inviteCode: string,
      recipientEmail: string,
      ...
   }
```

### Quick Integration Points

**To add escrow to a new page:**

```tsx
import EscrowInitiator from '@/components/wallet/EscrowInitiator'

export function MyPage() {
  const { walletBalance } = useWallet()
  
  return (
    <>
      {/* ...page content... */}
      <EscrowInitiator 
        walletBalance={walletBalance}
        defaultCurrency="cUSD"
      />
    </>
  )
}
```

**To check escrow status:**

```tsx
const { data: escrow } = useQuery({
  queryKey: ['escrow', escrowId],
  queryFn: () => apiGet(`/api/escrow/${escrowId}`)
})

if (escrow?.status === 'accepted') {
  // User has accepted the invite
}
```

---

## System Selection Matrix

| Question | DAO Escrow | Wallet Escrow |
|----------|-----------|---------------|
| Funding from treasury? | ✅ Yes | ❌ No |
| Recipient is DAO member? | ✅ Only | ❌ Anyone |
| Need governance vote? | ✅ Yes | ❌ No |
| Want shareable link? | ❌ No | ✅ Yes |
| Need referral tracking? | ❌ No | ✅ Yes |
| Quick setup? | ❌ Days | ✅ Minutes |
| Any amount? | ❌ Treasury sets | ✅ $1+ |

**Simple rule:** 
- Treasury money + DAO member = **DAO Escrow**
- Personal money + anyone = **Wallet Escrow**

---

## API Contracts (TL;DR)

### Create Wallet Escrow

```bash
POST /api/escrow/initiate
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "recipient": "user@example.com",
  "amount": 50,
  "currency": "cUSD",
  "description": "Editing services",
  "milestones": [
    { "description": "50% completion", "amount": 25 }
  ]
}

Response:
{
  "id": "esc_123abc",
  "status": "pending",
  "inviteLink": "https://app.com/escrow/accept/abc123?referrer=user_456",
  "inviteCode": "abc123"
}
```

### Accept Invite

```bash
POST /api/escrow/accept/abc123
Authorization: Bearer <jwt>

Response:
{
  "id": "esc_123abc",
  "status": "accepted",
  "payeeId": "user_789"
}
```

### Preview Escrow (Public)

```bash
GET /api/escrow/invite/abc123
(No auth required)

Response:
{
  "amount": 50,
  "currency": "cUSD",
  "description": "Editing services",
  "payer": { "name": "John", "username": "john123" },
  "milestones": [...]
}
```

---

## Database Schema (TL;DR)

### escrowAccounts Table

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| payerId | UUID | Who's funding |
| payeeId | UUID/string | Who's receiving ("pending" if not signed up yet) |
| amount | decimal | In specified currency |
| currency | enum | cUSD, CELO, cEUR, USDC |
| status | enum | pending, accepted, completed, disputed, released |
| description | text | What it's for |
| metadata | JSONB | Stores: inviteCode, createdFromWallet, recipientEmail |
| createdAt | timestamp | When created |
| updatedAt | timestamp | When last updated |

### Key Differences by System

**Wallet Escrow:**
```json
{
  "payerId": "user_123",
  "payeeId": "pending",  // Until they sign up
  "metadata": {
    "createdFromWallet": true,
    "inviteCode": "abc123xyz",
    "recipientEmail": "payee@example.com"
  }
}
```

**DAO Escrow:**
```json
{
  "payerId": "dao_treasurer",
  "payeeId": "member_456",  // Known DAO member
  "metadata": {
    "createdFromWallet": false,
    "daoId": "dao_789"
  }
}
```

---

## Routing Map

```
/wallet
  └─ Advanced Features → "Initiate Escrow" button
     └─ Opens EscrowInitiator modal
        └─ POST /api/escrow/initiate
           └─ Returns inviteLink

/escrow/accept/:inviteCode
  └─ Public page (no auth required)
     └─ GET /api/escrow/invite/:inviteCode
        └─ Displays preview
           └─ Accept button → POST /api/escrow/accept/:inviteCode
              └─ Creates referral tracking

/escrow
  └─ DAO escrow page (preserved from before)
     └─ Shows treasury-funded escrows
        └─ Governance workflows
```

---

## Testing Checklist (5 Minutes)

1. **Can I create a wallet escrow?**
   ```
   [ ] Go to /wallet
   [ ] Click "Advanced Features"
   [ ] Click "Initiate Escrow"
   [ ] Fill form → Submit
   [ ] Get invite link
   ```

2. **Can I share the link?**
   ```
   [ ] Copy button works
   [ ] WhatsApp/Email buttons work
   [ ] Link is copyable
   ```

3. **Can I accept as non-logged-in user?**
   ```
   [ ] Open link in incognito
   [ ] See escrow details
   [ ] Click "Accept"
   [ ] Redirected to signup
   ```

4. **Does DAO escrow still work?**
   ```
   [ ] Go to /escrow
   [ ] See DAO escrows load
   [ ] No conflicts with wallet escrows
   ```

5. **Are they isolated?**
   ```
   [ ] Wallet escrows don't show in /escrow
   [ ] DAO escrows don't show in wallet
   [ ] Database filters working
   ```

---

## Common Questions

**Q: Can I use both systems at once?**  
A: Yes! Use wallet escrow for personal payments, DAO escrow for treasury. They don't interfere.

**Q: What if I send a wallet escrow invite to a DAO member?**  
A: They get a shareable link they can accept without needing DAO approval. It's a personal transaction, not treasury-related.

**Q: Can I convert a wallet escrow to a DAO escrow?**  
A: Not automatically. They use different workflows. Create a new DAO escrow if needed for governance.

**Q: What happens if referral tracking fails?**  
A: The escrow still works. Referral tracking is optional - the `?referrer=` param is just for tracking in the database.

**Q: Can DAO members create wallet escrows?**  
A: Yes! DAO members can use both systems. Use wallet escrow for personal payments, DAO escrow for treasury.

**Q: What's the minimum amount?**  
A: Wallet Escrow: $1 | DAO Escrow: Whatever the DAO sets in their treasury policy

---

## Documentation Files

| File | Purpose | Audience |
|------|---------|----------|
| `WALLET_ESCROW_IMPLEMENTATION.md` | Full technical specs | Developers |
| `WALLET_ESCROW_QUICK_REFERENCE.md` | End-user guide | Users |
| `DUAL_ESCROW_DECISION_MATRIX.md` | When to use each | Everyone |
| `DUAL_ESCROW_IMPLEMENTATION_CHECKLIST.md` | Deployment checklist | DevOps/QA |
| `DUAL_ESCROW_QUICK_START_GUIDE.md` | This file | New developers |

---

## Next Steps

### For Users
1. Go to `/wallet`
2. Click "Initiate Escrow"
3. Send invite to someone
4. They accept and complete milestones

### For Developers
1. Read `WALLET_ESCROW_IMPLEMENTATION.md` for full specs
2. Check API contracts in that doc
3. Review `EscrowInitiator.tsx` and `escrow-accept.tsx` components
4. Test using the 5-minute checklist above

### For DevOps
1. Review `DUAL_ESCROW_IMPLEMENTATION_CHECKLIST.md`
2. Verify all files are deployed
3. Run tests from "Testing Checklist" section
4. Monitor API endpoints for errors

---

## Support

If something isn't working:

1. **Components not rendering?** Check `/wallet` and browser console for errors
2. **API failing?** Check `/api/escrow/initiate` response in Network tab
3. **Invite link not working?** Verify inviteCode format (12 characters)
4. **Confused about which system to use?** Read `DUAL_ESCROW_DECISION_MATRIX.md`

---

## Key Takeaways

✅ **Both escrow systems are live and tested**  
✅ **No conflicts or data leakage between systems**  
✅ **Wallet escrow adds peer-to-peer capability**  
✅ **DAO escrow remains for treasury management**  
✅ **Users can choose which system fits their need**  
✅ **Comprehensive documentation provided**

**Status: Ready for production deployment**

