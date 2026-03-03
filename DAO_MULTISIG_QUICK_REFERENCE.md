# DAO Multi-Sig Quick Reference

## 🚀 TL;DR - Get Started in 5 Steps

### 1. Create DAO
```bash
# Existing flow, unchanged
POST /api/daos { name, description, daoType }
```

### 2. Configure Multi-Sig
```bash
POST /api/dao/:daoId/treasury/multisig-config
{
  "requiredApprovals": 2,
  "totalSigners": 3,
  "withdrawalThreshold": "1000.00",
  "rolesAllowedToApprove": ["admin", "elder"],
  "autoCompleteOnThreshold": true
}
```

### 3. Create Contribution Types
```bash
POST /api/dao/:daoId/treasury/contribution-types
{
  "name": "contribution",
  "minimumAmount": "100",
  "requiresApproval": false
}
```

### 4. Members Deposit
```bash
# ANY member can do this (changed from admin-only!)
POST /api/dao/:daoId/treasury/deposit
{
  "amount": 500,
  "contributionType": "contribution",
  "description": "My monthly contribution"
}
```

### 5. Approve Withdrawal (Multi-Sig)
```bash
# Step 5a: Admin initiates
POST /api/dao/:daoId/treasury/withdraw
{
  "amount": 2000,
  "recipient": "treasury@example.com",
  "reason": "Operational budget",
  "requiresMultiSig": true
}

# Step 5b: Other admins approve
POST /api/dao/:daoId/treasury/approve
{
  "withdrawalId": "uuid-here",
  "approved": true,
  "approverComment": "Verified"
}
# Auto-completes when threshold reached!
```

---

## 📚 Common API Actions

### Check Treasury Balance
```bash
GET /api/dao/:daoId/treasury/balance
→ { total, available, pending, currency }
```

### List All Contributions
```bash
GET /api/dao/:daoId/treasury/contributions?status=completed
→ [{ id, contributor, amount, type, status, approvedAt }]
```

### List Contribution Types
```bash
GET /api/dao/:daoId/treasury/contribution-types
→ [{ id, name, minimumAmount, requiresApproval, approvalsNeeded }]
```

### Approve Contribution (If Required)
```bash
POST /api/dao/:daoId/treasury/contributions/:contributionId/approve
{ "approved": true, "comment": "Looks good" }
```

---

## 🔑 Key Changes from Previous System

| Aspect | Before | After | Impact |
|--------|--------|-------|--------|
| **Deposits** | Admin-only | All members | ✅ Inclusive funding |
| **Multi-Sig** | TODO | Implemented | ✅ Safe withdrawals |
| **Contribution Types** | Fixed | Configurable | ✅ Flexible models |
| **Approvals** | None | Per-type | ✅ Flexible control |
| **Member Tracking** | Limited | Full records | ✅ Better auditing |

---

## 🎯 Common Scenarios

### Monthly Contributions (Auto-Accepted)
```
Member deposits → Status immediately 'completed'
No approval needed → Added to treasury instantly
```

### Investment Round (2 Approvals Required)
```
Member contributes → Status 'pending'
Admin1 approves ✓ (1/2)
Admin2 approves ✓ (2/2) → Auto-completes!
```

### Treasury Withdrawal (2-of-3 Multi-Sig)
```
Admin1 initiates withdrawal → Status 'pending'
Admin2 approves ✓ (1/2)
Admin3 approves ✓ (2/2) → Auto-completes!
```

---

## 🔒 Permission Model

```
View balance/history:     ✅ All members
Make deposits:            ✅ All members (CHANGED!)
Approve contributions:    👤 Admin/Elder only
Withdraw funds:           👤 Admin/Elder only
Approve withdrawal:       👤 Admin/Elder only
Configure multisig:       👮 Admin only
Create contrib types:     👮 Admin only
```

---

## ⚠️ Important Notes

1. **Member deposits now open to all** - no more admin-only restriction
2. **Multi-sig auto-completes** - no manual step needed
3. **Contributions are immutable** - once created, can't be edited
4. **Types can't be modified** - create new type or deactivate old one
5. **Approvals are one-vote-per-person** - can't change vote

---

## 🐛 Troubleshooting

**Q: Why is my contribution still pending?**  
A: Check the contribution type's `requiresApproval` flag and `approvalsNeeded` count.

**Q: Why did my withdrawal auto-complete?**  
A: You reached the `requiredApprovals` threshold. Check `approvalStats` in response.

**Q: Can I change my approval vote?**  
A: No. One vote per person. Contact DAO admin if you need to change.

**Q: What if we add new admins?**  
A: Update `totalSigners` in multisig config to reflect new count.

---

## 📞 Need Help?

See full documentation: `DAO_MULTISIG_MEMBER_CONTRIBUTIONS_COMPLETE.md`

Key files:
- Schema: `shared/schema.ts` (new tables)
- Routes: `server/routes/dao/treasury.ts` (all endpoints)
- Router: `server/routes/dao/index.ts` (consolidation)
