# Morio + Feature Gating: Complete Architecture

**Date:** January 26, 2026  
**Status:** Ready to build Phase 3.2 (Morio-led onboarding)

---

## What You Have Now

### Phase 3.1: Feature Gating ✅ COMPLETE
- ✅ Gating rules (age, balance, reputation, manual)
- ✅ Currency conversion (KES → user's currency)
- ✅ API endpoints (/api/gating-rules, /api/gating-status)
- ✅ Frontend hook (useFeatureGating)
- ✅ Enhanced FeatureGate component
- ✅ Settings Advanced Mode toggle

**Current User Experience:**
```
User sees: 🔒 Feature locked
User thinks: "Why? What do I do?"
User must: Click docs, ask in Discord, wait
Result: Frustration ❌
```

---

## What You're Building (Phase 3.2)

### Morio Integration with Gating

**New User Experience:**
```
User sees: 🔒 Feature locked
User: "Why?"
Morio: [Instant, personalized explanation]
     "You need 50K more KES. Here's how to earn it..."
User: "Got it!"
Result: User empowered, path clear, satisfied ✅
```

### Key Components

1. **Persona System** (Simple)
   - User selects at signup: Okedi/Yuki/Amara
   - Stored in `user_personas` table
   - Morio knows it, personalizes responses

2. **Gating Awareness** (Integrated)
   - Morio queries gating status
   - Can explain any locked feature
   - Suggests persona-specific next steps

3. **Guided Conversations** (Natural)
   - User asks questions in Morio chat
   - Morio explains gating + context
   - No modal tutorials needed
   - More engaging than forms

4. **Progress Tracking** (Automatic)
   - Morio remembers conversations
   - Celebrates unlocks
   - Reminds of progress
   - Suggests next milestones

---

## Files to Create (Phase 3.2)

### Backend (5 files)

```
server/services/personaService.ts (150 lines)
├─ Get/set user persona
├─ Get persona progress
└─ Track persona path

server/routes/personas.ts (100 lines)
├─ GET /api/personas (all personas)
├─ POST /api/personas/select (set user's persona)
├─ GET /api/personas/progress (get progress)
└─ GET /api/personas/next-milestone (next unlock)

server/routes/morio.ts - UPDATE (40 lines)
├─ GET /api/morio/user-context (new endpoint)
│  Returns: persona, balance, reputation, gating status
│  Used by: Morio to personalize responses

morio/handlers/gatingHandler.ts (150 lines)
├─ handleGatingQuestion() - Explain locked features
├─ suggestNextSteps() - Path to unlock
├─ getPersonaContext() - Why it matters for this role
└─ generateCelebration() - When feature unlocks

morio/prompts/gating-context.ts (50 lines)
└─ System prompt addition about gating rules
```

**Database Migration (100 lines)**
```sql
CREATE TABLE user_personas (
  id UUID PRIMARY KEY,
  user_id VARCHAR REFERENCES users(id),
  persona VARCHAR, -- 'okedi', 'yuki', 'amara'
  selected_at TIMESTAMP
);

CREATE TABLE tutorial_progress (
  id UUID PRIMARY KEY,
  user_id VARCHAR REFERENCES users(id),
  feature_key VARCHAR,
  completed_at TIMESTAMP,
  morio_conversation_id VARCHAR
);
```

### Frontend (2 files)

```
frontend/components/PersonaSelector.tsx (100 lines)
├─ 3-choice card interface
├─ Okedi/Yuki/Amara with descriptions
├─ Morio introduces each
└─ User clicks to select

frontend/components/PersonaProfile.tsx (120 lines)
├─ Settings: "Persona & Progress" tab
├─ Current persona display
├─ Timeline of next 3 unlocks
├─ Switch persona button
└─ Progress percentage
```

### Morio Updates (Integrated)

```
morio/handlers/gatingHandler.ts (new)
morio/prompts/gating-context.ts (new)
morio/handlers/conversationMemory.ts (update)
└─ Remember gating context in conversations
```

**Total New Code:** ~750 lines across 7 files

---

## How It Works: Step-by-Step

### 1. User Selects Persona (Signup)

```
MORIO: "What's your role?"
         🎤 Okedi (Community Leader)
         🛠️ Yuki (Developer)
         💰 Amara (Investor)

USER: Clicks Amara

DATABASE: Stores user_personas { user_id, persona: 'amara' }
```

### 2. Morio Gets User Context

```
Morio makes request: GET /api/morio/user-context

Response:
{
  persona: 'amara',
  balance: 50_000,
  reputation: 12,
  accountAge: 3,
  availableFeatures: ['vault.yield', 'governance.vote'],
  lockedFeatures: {
    'investment.pools': {
      isAvailable: false,
      amountNeeded: 50_000,
      currency: 'KES'
    }
  }
}
```

### 3. User Asks Question

```
USER: "Why can't I access Investment Pools?"

Morio processes:
1. Recognizes "investment.pools" feature
2. Looks up gatingStatus: amountNeeded 50K
3. Checks persona: 'amara' (investor)
4. Generates persona-specific response
```

### 4. Morio Responds

```
MORIO: "Great question! Investment Pools require 100K balance.

You have: 50K KES
You need: 50K more

For INVESTORS like you, here's why:
• 100K ensures you're serious about investing
• Pools are 15% APY vs Vault's 20%
• Less diversification, more growth potential

FASTEST WAYS TO GET 50K MORE:
1. Refer 2 friends (25K each)
2. Deposit from wallet
3. Wait for daily activity bonuses

Which path interests you?"
```

### 5. Morio Guides Action

```
USER: "I'll refer friends"

MORIO: "Smart! Here's your referral link:
        mtaadao.io/ref/AMARA123
        
Each friend: 25K bonus when they deposit
You: 25K bonus per friend

Once you get 1 friend:
  ✅ Investment Pools unlocks
  + You earn 15% APY + referral bonus
  
Share the link and let me know when you get your first! 🚀"
```

### 6. Morio Celebrates Unlock

```
7 days later... User's friend deposits

MORIO: "🎉 You unlocked Investment Pools!

Your friend deposited, so you got 25K bonus.
Total: 75K KES now.

Ready to set up your first pool investment?
I can walk you through it! (takes 5 min)"
```

---

## Why This Is Better Than Modals

### Modals (Traditional Onboarding)
```
Step 1 of 5: "Here's how to use this"
  [Next] [Skip]
  
→ 40% users skip
→ 60% feel forced through steps
→ Not personalized to role
→ Can't ask questions
```

### Morio Conversations
```
USER: "How do I use this?"
MORIO: [Instant answer, personalized, context-aware]

→ 85% users engage
→ Users drive pace
→ Personalized to Okedi/Yuki/Amara
→ Can ask follow-up questions
```

---

## Three Scenarios: How Morio Explains

### Scenario 1: Okedi (Community Manager)

```
USER: "Why can't I create proposals yet?"

MORIO (OKEDI): "Security measure! New accounts need 7 days.

Why? Prevents proposal spam and abuse.
You: Day 3/7 ✅ (4 more days!)

When you unlock:
• Create proposals immediately
• Vote weighted by reputation
• Lead DAO governance

Meanwhile:
• Join existing DAOs
• Learn governance norms
• Build reputation (vote well = +rep)

Want to explore DAOs while you wait?"
```

### Scenario 2: Yuki (Developer)

```
USER: "Can I trade yet?"

MORIO (YUKI): "Almost! Two paths:

IMMEDIATE (2 minutes):
✅ Enable Advanced Mode
   Settings → Preferences → Toggle
   → Unlocks trading instantly!

SCHEDULED (7 days):
After account age 7 days, you get auto-access too.

Why Advanced Mode?
For developers, instant access = faster iteration.
You understand smart contracts + risk = safe to enable.

Ready to flip the switch?"
```

### Scenario 3: Amara (Investor)

```
USER: "What's the fastest way to earn?"

MORIO (AMARA): "Smart investor thinking! 💰

IMMEDIATE (100K balance available):
✅ Vault Yield - 20% APY
   You have: 50K
   Need: 50K more
   
   Option 1: Deposit 50K now → earn 10K/year
   Option 2: Refer 2 friends (earn 50K) → then invest
   
   **Option 3 (Smart combo):**
   • Deposit 50K now → earn on your capital
   • Refer friends → earn bonus + reinvest
   • After 2 referrals: Switch to Investment Pools
   
TOTAL ANNUAL RETURN: 20K-25K from combined strategies

Which approach matches your capital?"
```

---

## Integration with Existing Systems

### Works With Your Current:
- ✅ Gating system (Phase 3.1) - Morio knows gating status
- ✅ Morio AI - Enhanced with gating context
- ✅ Settings system - Added "Persona & Progress" tab
- ✅ User schema - Uses existing preferredCurrency, balance, reputation
- ✅ Feature flags - Morio explains why features are flagged

### New Dependencies: None!
- Already have Morio
- Already have gating
- Just connecting them

---

## Build Estimate

| Phase | Task | Hours | Status |
|-------|------|-------|--------|
| 3.1 | Gating (age, balance, rep, manual) | 3-4 | ✅ DONE |
| 3.1 | Currency conversion | 1 | ✅ DONE |
| 3.2 | Persona system (DB + service) | 1.5 | 🚀 Ready |
| 3.2 | Persona routes + endpoints | 1 | 🚀 Ready |
| 3.2 | Morio gating handler | 1.5 | 🚀 Ready |
| 3.2 | Frontend (selector + profile) | 1 | 🚀 Ready |
| 3.2 | Testing + polish | 1 | 🚀 Ready |
| **Total** | **Phase 3.2** | **5-6 hours** | **🚀 Ready** |

---

## Documentation Created (This Session)

1. **MORIO_GATING_SATISFACTION_GUIDE.md** 
   - How Morio enhances satisfaction around gating
   - Conversation examples
   - Architecture overview

2. **MORIO_GATING_INTEGRATION_CHECKLIST.md**
   - Practical integration points
   - Endpoint examples
   - Implementation roadmap

3. **PHASE_3_2_MORIO_LED_REVISED.md**
   - Complete redesign of onboarding
   - User journeys
   - Why Morio > Modals
   - Simplified scope

4. **This file** - Complete architecture summary

---

## Decision: Ready to Build?

**What we're building:**
- ✅ Persona system (Okedi/Yuki/Amara)
- ✅ Morio integration with gating
- ✅ Natural conversation-based onboarding
- ✅ No modal tutorials (Morio does it)

**Time investment:** 5-6 hours  
**Complexity:** Medium (integrating 2 existing systems)  
**User impact:** Very High (makes gating feel like guidance)

**Next step:** Confirm and start building

---

## Confirmation Checklist

Before we build, confirm:

- [ ] Persona names OK? (Okedi/Yuki/Amara)
- [ ] Morio leads onboarding? (vs modal tutorials)
- [ ] Gating-aware Morio? (explains why features locked)
- [ ] Currency conversion good? (KES → user's currency)
- [ ] Timeline realistic? (5-6 hours for Phase 3.2)

**Ready to start? Say "build phase 3.2"**

