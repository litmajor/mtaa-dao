# Escrow Decision Matrix: Which System to Use?

## Quick Decision Tree

```
Are you a DAO treasurer paying from treasury?
├─ YES → Use DAO Escrow (/escrow or DAO Dashboard)
└─ NO → Are you paying from your personal wallet?
        ├─ YES → Use Wallet Escrow (/wallet → "Initiate Escrow")
        └─ NO → Not applicable
```

---

## System Selection Guide

### **Use DAO Escrow When:**

- 💰 **Funding Source**: Money comes from DAO treasury
- 👥 **Recipients**: Other DAO members only
- 🎯 **Purpose**: Paying for DAO-approved work, services, or tasks
- 🔐 **Governance**: Needs community voting/approval
- 📋 **Tracking**: Tied to DAO tasks and treasury accounting
- 💸 **Amount**: Large amounts, formal compensation
- ⏱️ **Timeline**: Typically longer (weeks/months for task completion)

**Examples:**
- "Fund developer to build smart contract module"
- "Pay contractor for marketing campaign"
- "Hold funds for grant recipient deliverables"
- "Treasury distribution to members"

**Access:** `/escrow` or DAO Dashboard → Treasury → Escrow

---

### **Use Wallet Escrow When:**

- 💳 **Funding Source**: Money from your personal wallet
- 👤 **Recipients**: Anyone (DAO members, non-members, friends, vendors)
- 🤝 **Purpose**: Personal/peer-to-peer payments with protection
- 🚀 **Simplicity**: No governance needed, instant setup
- 📱 **Sharing**: Send shareable invite link to recipient
- 💵 **Amount**: Any amount ($1 minimum), flexible
- ⚡ **Timeline**: Quick (can complete in minutes)

**Examples:**
- "Send $50 to freelancer for editing work"
- "Split a project cost with friend ($25 each)"
- "Pay non-DAO member for service"
- "Send gift money with condition (milestone-based)"
- "Store funds safely pending agreement"

**Access:** Wallet page → Advanced Features → "Initiate Escrow"

---

## Feature Comparison Matrix

| Feature | **DAO Escrow** | **Wallet Escrow** |
|---------|---|---|
| **Funding From** | DAO Treasury | Personal Wallet |
| **Recipient Must Be** | DAO Member | Anyone |
| **Approval Required** | ✅ Governance vote | ❌ Just payer |
| **Invite Link** | ❌ No | ✅ Yes (shareable) |
| **Auto-Signup** | ❌ No | ✅ Yes (recipient) |
| **Minimum Amount** | Variable (DAO sets) | $1 |
| **Maximum Amount** | Treasury balance | Wallet balance |
| **Milestones** | ✅ DAO-defined | ✅ Payer-defined |
| **Referral Tracking** | ❌ No | ✅ Yes |
| **Setup Time** | Days (voting) | Minutes |
| **Visible To** | All DAO members | Only payer/payee |

---

## Workflow Comparison

### DAO Escrow Flow

```
Treasurer → Create Task Escrow → Community Vote → Approved 
→ Fund from Treasury → Recipient Works → Milestones Verified 
→ Disputes if needed → Release Funds
```

**Decision Points:** Multiple (voting, governance)
**Transparency:** High (DAO sees all)
**Speed:** Slow (requires voting)

---

### Wallet Escrow Flow

```
Payer → Create Escrow → Generate Link → Share Invite 
→ Recipient Signs Up (optional) → Accept Terms 
→ Milestone Tracking (optional) → Release Funds
```

**Decision Points:** Two (payer creates, payee accepts)
**Transparency:** Low (private to parties)
**Speed:** Fast (minutes)

---

## Real-World Scenarios

### Scenario 1: DAO Needs Smart Contract Developer

```
Question: Where is the money?
Answer: In DAO treasury

→ Use DAO Escrow
- Post task on DAO
- Community votes to approve
- Fund from treasury
- Developer delivers
- Release payment
```

---

### Scenario 2: Personal Payment to Freelancer

```
Question: Is the freelancer a DAO member?
Answer: No, they're external

→ Use Wallet Escrow
- Click "Initiate Escrow" in wallet
- Enter their email
- Send invite link
- They sign up + accept
- Pay when work is complete
```

---

### Scenario 3: Informal Team Budget

```
Question: Multiple payouts from personal funds?
Answer: Yes, various small amounts

→ Use Wallet Escrow for Each
- Create separate escrow per person
- Each gets personal invite
- Track by person/project
- Pay on milestone completion
```

---

### Scenario 4: DAO Member Bonus

```
Question: Money from treasury, recipient is member?
Answer: Yes to both

→ Use DAO Escrow
- Create escrow from treasury
- Set conditions (if any)
- Fund it
- Member accepts and completes milestones
- Release payment
```

---

## Technical Details

### Data Isolation

Both systems use the same database table but are **completely isolated**:

```
DAO Escrow:     metadata.createdFromWallet = false/null
Wallet Escrow:  metadata.createdFromWallet = true
```

Each system has its own query filters, so:
- DAO members don't see personal wallet escrows
- Wallet users don't see DAO treasury escrows
- No data conflicts or security issues

---

### Integration Points

Currently, the systems are **intentionally separate**:

✅ **What's Working:** Each system operates independently  
🔮 **Future Enhancement:** Could allow "fund DAO escrow from wallet" (requires API enhancement)

---

## Checklist: How to Choose

1. **Is the money from DAO treasury?**
   - YES → DAO Escrow
   - NO → Wallet Escrow

2. **Do you need community approval?**
   - YES → DAO Escrow
   - NO → Wallet Escrow

3. **Is the recipient a DAO member?**
   - YES (+ treasury funding) → DAO Escrow
   - YES (+ personal funding) → Wallet Escrow
   - NO → Wallet Escrow

4. **Do you need shareable invite links?**
   - YES → Wallet Escrow
   - NO → DAO Escrow (built-in member access)

5. **Should this be public/transparent?**
   - YES → DAO Escrow
   - NO → Wallet Escrow

---

## FAQ: Which One Should I Use?

**Q: I want to pay someone outside the DAO**  
A: Wallet Escrow (they don't need DAO membership)

**Q: I want the community to approve the payment**  
A: DAO Escrow (requires governance vote)

**Q: I want to send a shareable link**  
A: Wallet Escrow (built-in link sharing with auto-signup)

**Q: It's treasury money**  
A: DAO Escrow (funds come from DAO, not personal)

**Q: It's a small informal payment ($5-$50)**  
A: Wallet Escrow (fast, simple, any amount)

**Q: It's a big formal contract ($1000+)**  
A: DAO Escrow (if treasury funded) or Wallet Escrow (if personal)

**Q: I want referral tracking**  
A: Wallet Escrow (auto-signup creates referral program record)

**Q: I want milestones**  
A: Both support milestones (DAO-defined vs payer-defined)

---

## Key Takeaway

```
Think of it this way:

DAO Escrow     = Formal, treasury-based, community-approved
Wallet Escrow  = Informal, personal, quick, shareable
```

Both are available. Choose based on:
1. **Money source** (treasury vs personal)
2. **Recipient** (DAO member vs anyone)
3. **Governance need** (approval required vs simple)
4. **Speed** (can wait for voting vs need it now)

