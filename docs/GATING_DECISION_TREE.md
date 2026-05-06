# Architecture Decision Tree: Should Feature Be Gated?

When deciding whether to gate a feature, use this flowchart:

---

## Decision Flow

```
┌─────────────────────────────────────────┐
│  Should this feature be GATED?          │
└─────────────────────────────────────────┘
                    │
                    ▼
        ┌─────────────────────────┐
        │ Does it cause SPAM?     │
        │ (DAOs, proposals, etc)  │
        └─────────────────────────┘
              ✅ YES         ❌ NO
                │             │
                ▼             ▼
        ┌────────────┐  ┌──────────────────┐
        │ Time Gate: │  │ Could it cause   │
        │ 7 days+    │  │ FINANCIAL HARM?  │
        │ ✅ GATE    │  │ (leverage, smart │
        └────────────┘  │  contracts)      │
                        └──────────────────┘
                              ✅ YES    ❌ NO
                                │       │
                                ▼       ▼
                        ┌──────────┐ ┌──────────┐
                        │Advanced  │ │ Amount   │
                        │ Mode +   │ │ Gate?    │
                        │7+ days   │ │          │
                        │✅ GATE   │ └──────────┘
                        └──────────┘    ✅ YES  ❌ NO
                                          │       │
                                          ▼       ▼
                                    ❌ REMOVE   ✅ NO GATE
                                    (too       (free access
                                     harsh)     for all)
```

---

## Example Decisions

### vault.yield
```
Current: Balance gate (100K KES min) ❌ WRONG

Decision tree:
  1. Causes spam? NO
  2. Could harm finances? NO (user deposits voluntarily)
  3. Amount-based gate? YES (currently)
  
Result: ❌ REMOVE gate
Reason: No reason to block small users
New: Anyone can start with 1 KES ✅
```

### proposal.create
```
Current: Age gate (7 days) ✅ CORRECT

Decision tree:
  1. Causes spam? YES (could create 100 proposals)
  2. Time gate? YES
  
Result: ✅ KEEP 7-day gate
Reason: Prevents spam while letting all users participate
```

### leverage.trading
```
Current: Advanced Mode gate ✅ CORRECT

Decision tree:
  1. Causes spam? NO (but risky)
  2. Could harm finances? YES (can lose more than deposited)
  3. Advanced Mode gate? YES
  4. Age gate? YES (7+ days)
  
Result: ✅ KEEP Advanced Mode + Age gate
Reason: Protects inexperienced users from liquidation
```

### trading.dex
```
Current: No gate ✅ CORRECT

Decision tree:
  1. Causes spam? NO
  2. Could harm finances? NO (basic trading, user controlled)
  3. Amount gate? NO
  
Result: ✅ NO GATE
Reason: Anyone should learn to trade
New: Any amount (1 KES+) ✅
```

### maonovault.access
```
Current: Balance gate (10K KES min) ❌ WRONG

Decision tree:
  1. Causes spam? NO
  2. Could harm finances? NO (user chooses investments)
  3. Amount gate? YES (currently)
  
Result: ❌ REMOVE gate
Reason: People want to explore before committing
New: Anyone can browse/join with any amount ✅
```

---

## The Gates That Stay

### Time-Based (GOOD)
```
Reason: Prevent spam/abuse
  ✅ proposal.create: 7 days old
  ✅ dao.create.cooldown: 5 days between DAOs
  ✅ leverage.trading: 7+ days old
  ✅ smart.contracts: 30+ days old
```

### Reputation-Based (GOOD)
```
Reason: Require engagement history
  ✅ nft.minting: Rep 5+ (requires history)
  ✅ ai.assistant: Rep 1+ (basically everyone)
```

### Mode-Based (GOOD)
```
Reason: Protect dangerous features
  ✅ leverage.trading: Requires Advanced Mode
  ✅ smart.contracts: Requires Advanced Mode
  ✅ beta.features: Requires Advanced Mode
```

### Role-Based (GOOD - DAO)
```
Reason: DAO creator control
  ✅ dao.createProposal: DAO members only
  ✅ dao.withdraw: DAO admin only
  ✅ dao.governance: DAO members only (can be restricted)
```

---

## The Gates That Go Away

### Amount-Based (REMOVE ALL)
```
❌ vault.yield: 100K minimum → Remove
❌ maonovault.access: 10K minimum → Remove
❌ investment.pools: Min balance → Remove
❌ trading.dex: Min amount → Remove
```

**Why remove:**
- Artificial barrier to entry
- Users want to learn with small amounts
- No technical reason to gate
- Hurts adoption
- Feels exclusive

---

## Gate Justification Matrix

| Gate | Type | Reason | Justified? |
|------|------|--------|-----------|
| proposal.create | Time | Prevent spam proposals | ✅ YES |
| dao.create.cooldown | Time | Prevent spam DAOs | ✅ YES |
| leverage.trading | Mode | Protect from liquidation | ✅ YES |
| smart.contracts | Mode | Protect from mistakes | ✅ YES |
| nft.minting | Reputation | Require engagement | ✅ YES |
| vault.yield | Amount | "Big players only" | ❌ NO |
| maonovault | Amount | "Wealthy users only" | ❌ NO |
| trading.dex | Amount | "Need balance" | ❌ NO |
| investment.pools | Amount | "Exclude small users" | ❌ NO |

---

## What We're Saying

### To Community Members (Okedi)
✅ "You can vote immediately"  
✅ "You can join DAOs immediately"  
✅ "You can trade anytime (just not in your main dashboard)"  
✅ "You can yield farm anytime (just not in your main dashboard)"  
❌ "You can't do X because you chose Community mode"  

### To Traders (Yuki)
✅ "You can trade immediately"  
✅ "You can use leverage (Advanced Mode + 7 days)"  
✅ "You can run smart contracts (Advanced Mode + 30 days)"  
✅ "You can still vote in DAOs (just not featured)"  
❌ "You can't governance because you're a Trader"  

### To Investors (Amara)
✅ "You can yield farm immediately"  
✅ "You can invest in DAOs immediately"  
✅ "You can vote in DAOs (as member)"  
✅ "You can trade (simplified tools, no leverage)"  
❌ "You can't trade because you're an Investor"  

---

## The Mental Shift

### OLD: Restriction Mindset
```
"User selects Okedi"
  → "They can't access trading"
  → "They can't access leverage"
  → "They need 100K to yield farm"
  
Result: Confused users wondering why
         features are blocked
```

### NEW: Organization Mindset
```
"User selects Okedi"
  → "Their dashboard shows governance first"
  → "But they can access trading from menu"
  → "And yield farm with any amount"
  → "They just see governance as priority 1"
  
Result: Happy users who feel empowered
         to do what they want
```

---

## Implementation Checklist

### Gates to REMOVE
- [ ] Remove `vault.yield` balance gate
- [ ] Remove `maonovault.access` balance gate
- [ ] Remove any amount-based gates
- [ ] Remove "Restricted by balance" error messages

### Gates to KEEP
- [ ] Keep `proposal.create` 7-day gate
- [ ] Keep `dao.create.cooldown` 5-day gate
- [ ] Keep `leverage.trading` Advanced Mode + age
- [ ] Keep `nft.minting` reputation gate

### Gates to ADD
- [ ] Add `smart.contracts` Advanced Mode + 30 days
- [ ] Add `beta.features` Advanced Mode toggle
- [ ] Add proper Advanced Mode documentation

### UX Changes
- [ ] Update error messages (don't say "blocked")
- [ ] Update onboarding (explain gates)
- [ ] Update Morio (explain gates contextually)
- [ ] Update Settings (show what's locked and why)

---

## Testing Gates

### Amount Gates (Should all fail - REMOVE)
```
Test: User with 100 KES tries to use vault.yield
Expected: ✅ Access granted (AFTER removal)
Current: ❌ Access denied (BEFORE removal)

Test: User with 5 KES tries to invest in pool
Expected: ✅ Access granted (AFTER removal)
Current: ❌ Access denied (BEFORE removal)
```

### Time Gates (Should work)
```
Test: User 3 days old tries to create proposal
Expected: ❌ Access denied (correct)

Test: User 7 days old tries to create proposal
Expected: ✅ Access granted (correct)
```

### Mode Gates (Should work)
```
Test: User without Advanced Mode tries leverage
Expected: ❌ Access denied (correct)

Test: User with Advanced Mode tries leverage
Expected: ✅ Access granted (correct)
```

---

## Final Decision

**Amount gates are OUT.** ❌

**Because:**
1. No technical reason (users voluntarily invest)
2. No abuse reason (can't spam with money)
3. Bad UX (feels exclusive and gatekeepy)
4. Hurts adoption (people want to learn with small amounts)
5. Unnecessary friction (one less barrier)

**What stays in:**
- Time gates (prevent spam)
- Reputation gates (require engagement)
- Mode gates (protect from harm)
- Role gates (DAO creator control)

**The message to users:**
"We protect you from spam and harm,  
but we don't exclude you based on wealth.  
You can do anything, we just organize the experience by your focus."
