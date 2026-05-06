# 🚀 Ready for Phase 3.2 Onboarding - Quick Start

**Status:** ✅ READY TO BUILD  
**Estimated Time:** 4-5 hours  
**Complexity:** Medium (3 new services, 4 UI components, 3 database tables)

---

## What You're About to Build

A **persona-based feature onboarding system** that:

1. **At Signup:** User selects their role (Okedi/Yuki/Amara)
2. **Personalized Path:** Each persona has custom feature unlock sequence
3. **Guided Tutorials:** Step-by-step walkthroughs when features unlock
4. **Progress Tracking:** Milestone timeline in Settings
5. **Rewards:** Reputation & badges for completing tutorials

---

## Quick Overview (5 min read)

### Personas

```
🟢 OKEDI (Community Manager)
   Role: Govern DAOs, create proposals, manage governance
   Features unlock order: voting → DAO creation → governance advanced
   Speed: 📅 Slower (week-long ramp)

🔵 YUKI (Developer)
   Role: Build, trade, access developer tools
   Features unlock order: trading → vault yield → API access
   Speed: ⚡ Moderate (feature-rich, quick access)

🟡 AMARA (Investor)
   Role: Invest, earn yield, portfolio management
   Features unlock order: vault → investment pools → advanced strategies
   Speed: 💨 Fast (capital features available sooner)
```

### What They Unlock (Examples)

| Day | Okedi | Yuki | Amara |
|-----|-------|------|-------|
| 0 | Vote, Create | Trading | Vault Yield |
| 7 | DAO Join | Portfolio | Advanced |
| 14 | Advanced Gov | Minting | - |
| 30 | NFT Tools | - | - |

### Gating (Already Implemented ✅)

All features are gated by one of:
- **Age** (7 days old) → `proposal.create`
- **Balance** (100K+ KES) → `vault.yield`
- **Reputation** (1+) → `ai.assistant` (Morio)
- **Manual** (Advanced Mode) → `trading.dex`

Now we add: **Persona-specific sequences** on top of gating

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│ USER AT SIGNUP                          │
│ "What's your role?"                     │
│ [Okedi] [Yuki] [Amara]                 │
└─────────────────────┬───────────────────┘
                      ↓
┌─────────────────────────────────────────┐
│ PersonaService (Backend)                │
│ ├─ setUserPersona(userId, 'yuki')       │
│ ├─ getPersonaProgress(userId)           │
│ └─ getNextMilestone(userId)             │
└─────────────────────┬───────────────────┘
                      ↓
┌─────────────────────────────────────────┐
│ Database Tables (New)                   │
│ ├─ user_personas                        │
│ ├─ feature_milestones                   │
│ └─ tutorial_progress                    │
└─────────────────────┬───────────────────┘
                      ↓
┌─────────────────────────────────────────┐
│ TutorialService (Backend)               │
│ ├─ getTutorial(featureKey, persona)     │
│ ├─ completeTutorial(userId, featureKey) │
│ └─ getProgress(userId, featureKey)      │
└─────────────────────┬───────────────────┘
                      ↓
┌─────────────────────────────────────────┐
│ Frontend Components                     │
│ ├─ PersonaSelector (signup)             │
│ ├─ MilestoneTracker (Settings)          │
│ ├─ TutorialModal (onscreen guide)       │
│ └─ PersonaProfile (progress view)       │
└─────────────────────────────────────────┘
```

---

## Build Breakdown (Hour by Hour)

### Hour 1: Database Setup (30 min)
- Create 3 tables: `user_personas`, `feature_milestones`, `tutorial_progress`
- Add migrations
- Add types to shared/schema

### Hour 2: Backend Services (1 hour)
- `server/services/personaService.ts` → Get/set personas, track progress
- `server/services/tutorialService.ts` → Manage tutorial content & completion

### Hour 3: API Endpoints (45 min)
- `server/routes/personas.ts` → 6 new endpoints
  - GET /api/personas
  - POST /api/personas/select
  - GET /api/personas/progress
  - GET /api/tutorials/:feature
  - POST /api/tutorials/:feature/complete

### Hour 4: Frontend Components (1.5 hours)
- `PersonaSelector.tsx` → Signup flow (3 choice cards)
- `MilestoneTracker.tsx` → Progress timeline in Settings
- `TutorialModal.tsx` → Step-by-step guided walkthrough
- `PersonaProfile.tsx` → New Settings tab for persona view

### Hour 5: Integration & Testing (30 min)
- Wire components together
- Test full user journey (signup → select persona → unlock features → complete tutorial)
- Verify reputation awards

---

## Key Decisions to Confirm

### 1. Persona Names
Are these good, or change?
- **Okedi** → Community Manager (DAO governance)
- **Yuki** → Developer (Trading, technical)
- **Amara** → Investor (Yield, portfolio)

### 2. Unlock Timing
Should milestones unlock at these times?
```
Day 0: Initial features
Day 7: Second tier (after week-long account age)
Day 30: Third tier (after month-long tenure)
```

Or different (e.g., 3 days, 14 days)?

### 3. Tutorial Content
Each feature needs a persona-specific guide:
- Trading tutorial for Yuki vs Amara (different use case)
- DAO tutorial for Okedi vs Yuki (different perspective)
- Governance tutorial for Okedi vs Amara (investor voting)

Need to write ~15 tutorials total (5 features × 3 personas)

### 4. Reputation Awards
How much reputation for completing tutorials?
- First tutorial: +10 reputation
- Subsequent: +5 reputation each
- Completing persona path: +50 bonus reputation

---

## Files to Create (7 new files)

```
Backend (2 services):
├─ server/services/personaService.ts
└─ server/services/tutorialService.ts

Backend (1 route):
├─ server/routes/personas.ts

Frontend (4 components):
├─ frontend/components/Onboarding/PersonaSelector.tsx
├─ frontend/components/Onboarding/MilestoneTracker.tsx
├─ frontend/components/Onboarding/TutorialModal.tsx
└─ frontend/components/Onboarding/PersonaProfile.tsx

Shared (1 types):
├─ shared/types/persona.ts

Database (1 migration):
└─ server/migrations/001_create_persona_tables.ts
```

---

## Existing Systems You'll Use

✅ **Gating System** (we just built)
- `useFeatureGating()` hook
- `<FeatureGate>` component
- Balance/age/reputation/manual checks

✅ **User Schema** (already has)
- `preferredCurrency` (for display)
- `reputation` field (for awards)
- `balance` in KES
- `advancedMode` toggle

✅ **Currency Conversion** (we just added)
- Converts KES → user's currency automatically
- 8 supported currencies
- Works in gating system

✅ **Settings System** (we built last session)
- Can add "Persona & Progress" tab
- Milestone tracker component
- Persona switch UI

---

## Success Criteria

After 4-5 hours, you'll have:

✅ Users can select persona at signup
✅ Each persona shows custom feature unlock path
✅ Features unlock based on persona + gating conditions
✅ Tutorial modal appears when feature unlocks
✅ Users can complete tutorials for reputation
✅ Settings shows "Persona & Progress" tab
✅ Users can view their milestone timeline
✅ Users can switch personas (resets progress)
✅ Analytics tracking tutorial completion
✅ Full TypeScript coverage

---

## Next Phase After This

**Phase 3.3: Analytics & Metrics**
- Track feature adoption by persona
- Measure tutorial completion rates
- Identify drop-off points
- Heatmap user journeys

---

## Resources

📖 **Full Onboarding Guide:** `PHASE_3_TASK_3_2_ONBOARDING.md`
📖 **Currency System:** `CURRENCY_CONVERSION_GATING.md`
📖 **Gating System:** `PHASE_3_COMPLETE.md`
📖 **Quick Test:** `PHASE_3_GATING_TESTING_GUIDE.md`

---

## Questions Before We Start?

1. Persona names OK? (Okedi/Yuki/Amara)
2. Unlock timing OK? (Days 0, 7, 30)
3. Tutorial content ready? (Need copy for features)
4. Reputation awards amounts? (10, 5, 50?)

Once you confirm, I'll build all 7 files in parallel!

---

**Ready to start Phase 3.2? Say "build onboarding" and we'll begin!**

Current Status:
- ✅ Phase 3.1 (Gating) - COMPLETE
- 🚀 Phase 3.2 (Onboarding) - READY
- ⏳ Phase 3.3 (Analytics) - NEXT
