# Phase 3.2 Revised: Morio-Led Onboarding + Feature Gating

**Status:** Updated Design (replaces traditional modal onboarding)  
**Focus:** Morio as the intelligent guide, not separate tutorials

---

## The Shift: From Modals to Conversation

### Old Approach (Modal Onboarding)
```
Step 1 of 5: [Next] [Skip]
Step 2 of 5: [Next] [Skip]
...
User feels: Forced through tutorial
Result: 60% complete, 40% skip
```

### New Approach (Morio-Led)
```
USER: "What should I do first?"
MORIO: "Here's your path..." 
       [Offers options, explains context]
USER: "Tell me more about this"
MORIO: [Deep dive, personalized guidance]
USER: "Ready to try?"
MORIO: [Guides step-by-step in real time]
Result: User drives conversation, 90% complete
```

---

## Phase 3.2 Components (Simplified)

Instead of 4 frontend components, we need:

### 1. Persona Selection at Signup ✅
- Same: 3-choice card interface (Okedi/Yuki/Amara)
- New: Morio explains each persona
- Result: User picks role → Morio takes over from there

### 2. Morio Integration with Gating ✅
- Add gating context to Morio
- Morio answers "Why is this locked?"
- Morio suggests next steps
- Morio celebrates unlocks

### 3. Settings: Persona & Progress (Simplified)
- Show user's current persona
- Option to switch
- **Timeline view:** Gating status for next 3 unlocks
- No tutorial modals (Morio handles)

### 4. (Optional) Feature Info Modals
- Users can still click "Learn More" on locked features
- Modal shows: Description + gating requirements + Morio chat link
- But **modals are not required** (Morio handles it)

---

## What Gets Built (Revised)

### Backend (Same as Planned)
```
✅ server/services/personaService.ts
   - Set user persona
   - Get persona progress
   - Track milestones

✅ server/routes/personas.ts  
   - GET /api/personas
   - POST /api/personas/select
   - GET /api/personas/progress

✅ Database tables
   - user_personas
   - feature_milestones  
   - tutorial_progress (tracks completion via Morio)
```

### Frontend (Simplified)
```
✅ PersonaSelector.tsx
   - Signup flow (3 cards)
   - Morio introduces each
   - User selects

✅ PersonaProfile.tsx
   - Settings: "Persona & Progress" tab
   - Timeline of next 3 unlocks
   - Switch persona button
   - (No tutorial steps needed!)

⏸️ TutorialModal.tsx - SKIP
   - Morio handles tutorials in chat
   - Modals only for complex visuals

⏸️ MilestoneTracker.tsx - SIMPLIFY
   - Timeline component (show next unlocks)
   - That's it!
```

### Morio Changes (New)
```
✅ morio/handlers/gatingHandler.ts
   - Explain why feature is locked
   - Suggest next steps
   - Guide toward unlock

✅ API endpoint: /api/morio/user-context
   - Returns gating status
   - Available features
   - Persona info
   - All for Morio to use in responses

✅ morio/prompts/gating-context.ts
   - System prompt about gating
   - Rules + persona context
   - How to explain locked features

✅ Cron job: dailyMorioCheckIn
   - Notify when features unlock
   - Send motivational messages
   - Suggest next milestones
```

---

## User Journey: Morio-Led Onboarding

### Day 0: Signup

```
1️⃣ Create Account
   EMAIL + PASSWORD

2️⃣ Choose Role (Morio Guides)
   
   MORIO: "Let me help you choose your path!
   
   🎤 OKEDI - Community Leader
       → Build DAOs, govern, grow communities
       
   🛠️ YUKI - Developer  
       → Build apps, trade, technical tools
       
   💰 AMARA - Investor
       → Yield farming, portfolio management
       
   Who are you?"
   
   USER: [Clicks Amara]
   
   MORIO: "Smart choice! 💰
           You'll focus on investment opportunities
           and growing your wealth.
           
           Ready to get started?"

3️⃣ Welcome to Amara Path
   
   MORIO: "Welcome to your investment journey! 📈
   
   ✅ AVAILABLE NOW:
   • Deposit funds
   • View marketplace
   • Track portfolio
   
   🔓 NEXT MILESTONE (100K balance):
   • Vault Yield (20% APY)
   • Investment Pools (15% APY)
   
   💡 FASTEST START:
   1. Deposit 100K KES (earn 20K/year)
   2. Refer friends (each friend = 25K bonus)
   3. Both features earning together
   
   How much would you like to invest today?"
```

### Week 1: First Feature Unlock

```
USER: 💳 Deposits 100K KES

MORIO: "🎉 VAULT YIELD UNLOCKED!
        You now have access to earn passive income.
        
        Want a quick walkthrough on how it works?
        (Takes about 5 minutes)
        
        Or jump in and I'll guide you step-by-step?"

USER: "How does it work?"

MORIO: "Here's the 30-second version:
        1. You deposit KES
        2. We invest it in safe, high-yield strategies  
        3. You earn 15-20% APY
        4. Can withdraw anytime
        
        For INVESTORS like you:
        • $100K → $20K/year passive income
        • Zero management needed
        • Automated reinvestment
        
        Ready to set up your first vault?"

USER: "Yes"

MORIO: "Perfect! Step 1/3:
        Go to: Wallet → Vault Yield
        
        You should see the deposit button.
        Click it when ready and tell me! ↓"
```

### Week 2: Progress Check

```
MORIO: (automated daily check-in)
       "You've been with us 14 days! 📅
        
        📊 Progress:
        • Balance: 100K KES ✅
        • Current earnings: 384 KES/month
        • Reputation: 12 ⭐
        
        🔓 NEXT UNLOCK:
        • Investment Pools (5K more reputation)
        • Or earn 10 reputation in 5 days
        
        Want to accelerate? Refer a friend!
        Each referral = 25K KES bonus"
```

### Month 1: Multi-Feature State

```
USER: "What should I do next?"

MORIO: "Great question! Look at your options:

        🟢 ACTIVE (Earning):
        • Vault Yield: $20K/year 
        
        🔓 UNLOCK IN 5 DAYS:
        • Investment Pools (15% APY)
        • 5 more reputation points needed
        
        💡 QUICK WINS:
        • Refer 1 friend → unlock instantly
        • Complete voting tutorial → 3 reputation
        
        PATH FORWARD:
        → Refer 1 friend (instant unlock + 25K bonus)
        → Set up Investment Pools
        → Both earning = 35K-40K/year
        
        Sound good?"
```

---

## Why This Works Better

### vs Modal Tutorials:
- ✅ Conversation feels natural (not forced steps)
- ✅ User drives the pace (ask when ready)
- ✅ Personalized to persona (Okedi gets different advice)
- ✅ Morio remembers context (no repeating)
- ✅ Reduces friction (gating feels like guidance)

### vs Separate Personas System:
- ✅ No new complex UI
- ✅ Simpler backend (personas stored, rest is Morio)
- ✅ Integrated with existing Morio system
- ✅ Fewer files to build

### vs Gating Alone (no onboarding):
- ✅ Users understand "why" (Morio explains)
- ✅ Clear path forward (Morio suggests next steps)
- ✅ Feels supported (not just blocked)
- ✅ Higher satisfaction & retention

---

## Implementation Scope (Revised)

### Week 1: Integration (2-3 hours)

**Files to create/modify:**

Backend:
```
✅ server/services/personaService.ts (new) - 150 lines
✅ server/routes/personas.ts (new) - 100 lines
✅ server/routes/morio.ts (add endpoint) - 40 lines
✅ database migrations - 100 lines
✅ morio/handlers/gatingHandler.ts (new) - 150 lines
✅ morio/prompts/gating-context.ts (new) - 50 lines
```

Frontend:
```
✅ frontend/components/PersonaSelector.tsx (new) - 100 lines
✅ frontend/components/PersonaProfile.tsx (new) - 120 lines
   (or add as Settings tab)
✅ Modify Morio chat UI for gating responses - 30 lines
```

**Total:** ~750 lines, ~5 files (much simpler!)

### What Gets Skipped (vs Original Plan)

```
❌ TutorialModal.tsx - Morio does this in chat
❌ MilestoneTracker.tsx - Simplified to timeline component
❌ TutorialService.ts - Not needed, Morio handles
❌ Complex milestone reward system - Simpler: just reputation
❌ Persona-specific tutorials content - Morio generates contextually
```

---

## Database Schema (Simplified)

Only 2 tables needed (vs 3):

```sql
-- 1. User personas (simple)
CREATE TABLE user_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  persona VARCHAR NOT NULL, -- 'okedi', 'yuki', 'amara'
  selected_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Tutorial completion (track in Morio conversation)
CREATE TABLE tutorial_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  feature_key VARCHAR NOT NULL,
  completed_at TIMESTAMP,
  morio_conversation_id VARCHAR, -- Link to Morio chat
  created_at TIMESTAMP DEFAULT NOW()
);

-- ❌ feature_milestones NOT NEEDED
-- Milestones come from gating rules + persona path
-- Morio determines next milestone dynamically
```

---

## Morio Knows Your Persona

**Morio system prompt updated:**

```
You have access to user's persona and gating status.

USER PERSONA:
- okedi: Community Manager → governance focused
- yuki: Developer → technical focused  
- amara: Investor → yield/wealth focused

GATING RULES (stored amounts in KES):
- trading.dex: Manual (Advanced Mode)
- vault.yield: Balance (100K KES)
- proposal.create: Age (7 days)
- ai.assistant: Reputation (1+)
- ... more rules

FOR EACH PERSONA, PRIORITIZE:
- Okedi: governance, proposals, community building
- Yuki: trading, APIs, smart contracts, development
- Amara: yield, investment pools, portfolio, wealth

When user asks about a locked feature:
1. Explain why it's locked (with gating reason)
2. Show timeline (when they can access)
3. Suggest persona-relevant path forward
4. Celebrate if they just unlocked something

REMEMBER: Make gating feel like guidance, not restriction.
```

---

## Success Metrics

After implementation:

✅ **Adoption:** 85%+ users select persona at signup (vs 60% modal completion)
✅ **Engagement:** Users ask 5+ gating questions per week
✅ **Satisfaction:** "Morio explains gating well" rating 4.5/5
✅ **Feature usage:** 90% of newly unlocked features get used (vs 60% modal)
✅ **Retention:** 15% increase in day-7+ retention
✅ **Time-to-value:** 50% faster to first feature unlock

---

## Timeline

```
REVISED PHASE 3.2: MORIO-LED ONBOARDING

Week 1: Backend Setup (2-3 hours)
  ├─ personaService.ts
  ├─ personas.ts routes
  ├─ morio/gatingHandler.ts
  └─ Database migrations

Week 2: Frontend + Morio Integration (2 hours)
  ├─ PersonaSelector.tsx
  ├─ PersonaProfile.tsx
  ├─ Morio system prompt update
  └─ Test end-to-end

Week 3: Polish & Deployment (1 hour)
  ├─ UI refinements
  ├─ Error handling
  └─ Go live

TOTAL: 5-6 hours (vs 8-10 original)
QUALITY: Higher (Morio integration is stronger)
SCOPE: Cleaner (fewer separate systems)
```

---

## Decision: Modal vs Morio

**Option A (Original):** Separate onboarding modals
- Pros: Visual tutorials, step-by-step UI guides
- Cons: More complex, can feel forced, 40% skip rate

**Option B (Revised):** Morio-led onboarding
- Pros: Natural conversation, personalized, user-driven, integrates with existing Morio
- Cons: Less visual (but Morio can link to docs/videos)

**Recommendation:** Option B (Morio-led)
- Leverages existing Morio system
- Better user satisfaction
- Simpler implementation
- More aligned with your product philosophy

---

## Next Step

Ready to build Phase 3.2 with Morio?

This revised approach:
1. ✅ Uses Morio (already onboard via chat)
2. ✅ Simplifies feature gating (Morio explains)
3. ✅ Personalizes by persona (Okedi/Yuki/Amara)
4. ✅ Faster implementation (5-6 hours vs 8-10)
5. ✅ Higher user satisfaction (conversation > modals)

**Build or adjust first?**

