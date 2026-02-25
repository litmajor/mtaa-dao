# Phase 3 Task 3.2 - Feature Onboarding System

**Status: READY TO BUILD** ✅ (Estimated: 4-5 hours)

---

## What We're Building

A **persona-based onboarding system** that guides users through feature unlocks based on their profile:

- **Okedi** (Community Manager) → DAO governance & proposals
- **Yuki** (Developer) → Trading, technical tools, APIs
- **Amara** (Investor) → Vault yield, investment pools, analytics

Each persona has:
- Unlock path (sequence of features to unlock)
- Specific unlock rewards & milestones
- Guided tutorials per feature
- Path-specific UI customization

---

## Phase 3 Roadmap

```
✅ Task 3.1 - Core Gating (DONE)
  ├─ Age-based unlocks
  ├─ Balance-based unlocks
  ├─ Reputation-based unlocks
  ├─ Manual Advanced Mode unlock
  └─ Currency conversion (KES → user's currency)

🚀 Task 3.2 - Feature Onboarding (READY)
  ├─ Persona selection at signup
  ├─ Path-specific feature sequences
  ├─ Tutorial system per feature
  ├─ Milestone tracking & rewards
  └─ Path switching in Settings

⏳ Task 3.3 - Analytics & Metrics (FUTURE)
  ├─ Feature adoption tracking
  ├─ Unlock rate monitoring
  ├─ User journey heatmaps
  └─ Persona performance analysis
```

---

## Data Structure

### 1. User Personas

```typescript
type UserPersona = 'okedi' | 'yuki' | 'amara' | 'custom' | null;

interface PersonaProfile {
  id: UserPersona;
  name: string; // "Okedi", "Yuki", "Amara"
  description: string;
  role: string; // "Community Manager", "Developer", "Investor"
  backgroundColor: string; // Personalize Settings UI
  unlocksPath: string[]; // Feature unlock sequence
  icon: string; // Emoji or icon identifier
  traits: string[]; // What defines this persona
}
```

### 2. Unlock Paths

Each persona follows a specific feature unlock sequence:

**Okedi (Community Manager)**
```
Day 0: governance.vote → governance.create → proposals
  ↓ (reputation > 10)
Week 1: dao.join → dao.create → treasury management
  ↓ (balance > 50K KES)
Week 3: dao.create.cooldown → governance advanced
  ↓ (reputation > 50)
Week 4: nft.minting → community NFT tools
```

**Yuki (Developer)**
```
Day 0: beta.features → trading.dex (manual via Advanced Mode)
  ↓ (balance > 100K KES)
Week 1: vault.yield → API access
  ↓ (reputation > 5)
Week 2: maonovault.access → portfolio analytics
  ↓ (balance > 500K KES)
Week 4: nft.minting → smart contract tools
```

**Amara (Investor)**
```
Day 0: vault.yield (balance > 100K KES)
  ↓ (reputation > 20)
Week 1: investment pools → portfolio tracking
  ↓ (balance > 500K KES)
Week 2: maonovault.access → advanced strategies
  ↓ (tenure > 30 days)
Week 4: governance.vote → investor governance
```

### 3. Milestone System

```typescript
interface Milestone {
  id: string;
  persona: UserPersona;
  feature: string;
  sequence: number; // Order in unlock path (1, 2, 3, ...)
  unlockCondition: string; // "age:7", "balance:100000", "reputation:10"
  reward?: {
    reputationBonus: number;
    bonusAmount?: number; // In KES
    badge?: string;
  };
  tutorialUrl?: string; // Link to feature guide
  estimatedTime?: number; // Minutes to complete
}
```

### 4. Tutorial Content

```typescript
interface FeatureTutorial {
  featureKey: string;
  persona: UserPersona;
  title: string;
  description: string;
  steps: TutorialStep[]; // 3-5 steps
  estimatedMinutes: number;
  videoUrl?: string;
  documentationUrl: string;
  completionReward?: {
    reputation: number;
  };
}

interface TutorialStep {
  number: number;
  title: string;
  content: string;
  action?: {
    type: 'click' | 'form' | 'read' | 'complete';
    target: string;
  };
  tips?: string[];
}
```

---

## Implementation Plan

### Hour 1: Database & Schema

**New Tables:**

1. **user_personas** - Track user's selected persona
```sql
CREATE TABLE user_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  persona VARCHAR NOT NULL, -- 'okedi', 'yuki', 'amara'
  selected_at TIMESTAMP DEFAULT NOW(),
  completed_milestones TEXT[] DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW()
);
```

2. **feature_milestones** - Milestone tracking
```sql
CREATE TABLE feature_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona VARCHAR NOT NULL,
  feature_key VARCHAR NOT NULL,
  sequence INTEGER NOT NULL,
  unlock_condition VARCHAR NOT NULL,
  reputation_bonus INTEGER DEFAULT 0,
  bonus_amount NUMERIC DEFAULT 0,
  badge VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);
```

3. **tutorial_progress** - Track which tutorials user completed
```sql
CREATE TABLE tutorial_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  feature_key VARCHAR NOT NULL,
  completed_at TIMESTAMP,
  skipped_at TIMESTAMP,
  viewed_steps INTEGER[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Hour 2: Persona & Milestone Services

**File:** `server/services/personaService.ts`

```typescript
interface PersonaConfig {
  okedi: PersonaProfile;
  yuki: PersonaProfile;
  amara: PersonaProfile;
}

export class PersonaService {
  // Get all available personas
  static getAvailablePersonas(): PersonaProfile[] { }
  
  // Set user's persona
  static async setUserPersona(userId: string, persona: UserPersona): Promise<void> { }
  
  // Get user's persona
  static async getUserPersona(userId: string): Promise<UserPersona | null> { }
  
  // Get next unlock milestone for user
  static async getNextMilestone(userId: string): Promise<Milestone | null> { }
  
  // Mark milestone as completed
  static async completeMilestone(userId: string, milestoneId: string): Promise<void> { }
  
  // Get user's progress on their persona path
  static async getPersonaProgress(userId: string): Promise<{
    persona: UserPersona;
    currentMilestone: number;
    completedMilestones: Milestone[];
    nextUnlocks: Milestone[];
    progressPercent: number;
  }> { }
}
```

### Hour 3: Tutorial Service

**File:** `server/services/tutorialService.ts`

```typescript
export class TutorialService {
  // Get tutorial for feature + persona
  static getTutorial(
    featureKey: string,
    persona: UserPersona
  ): FeatureTutorial | null { }
  
  // Get all tutorials for persona
  static getTutorialsByPersona(persona: UserPersona): FeatureTutorial[] { }
  
  // Mark tutorial as started
  static async startTutorial(
    userId: string,
    featureKey: string
  ): Promise<void> { }
  
  // Mark tutorial step as completed
  static async completeStep(
    userId: string,
    featureKey: string,
    stepNumber: number
  ): Promise<void> { }
  
  // Mark entire tutorial as completed
  static async completeTutorial(
    userId: string,
    featureKey: string
  ): Promise<void> { }
  
  // Get user's tutorial progress
  static async getTutorialProgress(
    userId: string,
    featureKey: string
  ): Promise<{ completedSteps: number; totalSteps: number }> { }
}
```

### Hour 4: API Endpoints

**File:** `server/routes/personas.ts` (new)

```typescript
router.get('/api/personas', (req, res) => {
  // Get all available personas with descriptions
  res.json({ personas: PersonaService.getAvailablePersonas() });
});

router.post('/api/personas/select', requireAuth, async (req, res) => {
  // Set user's persona at signup/onboarding
  const { persona } = req.body;
  await PersonaService.setUserPersona(req.user.id, persona);
  res.json({ success: true });
});

router.get('/api/personas/progress', requireAuth, async (req, res) => {
  // Get user's progress on persona path
  const progress = await PersonaService.getPersonaProgress(req.user.id);
  res.json(progress);
});

router.get('/api/personas/next-milestone', requireAuth, async (req, res) => {
  // Get next milestone to unlock
  const milestone = await PersonaService.getNextMilestone(req.user.id);
  res.json(milestone);
});

router.get('/api/tutorials/:featureKey', async (req, res) => {
  // Get tutorial for feature (no auth, public)
  const { persona } = req.query;
  const tutorial = TutorialService.getTutorial(req.params.featureKey, persona as UserPersona);
  res.json(tutorial);
});

router.post('/api/tutorials/:featureKey/complete', requireAuth, async (req, res) => {
  // Mark tutorial as completed + award reputation
  await TutorialService.completeTutorial(req.user.id, req.params.featureKey);
  // Award reputation bonus
  res.json({ success: true });
});
```

### Hour 5: Frontend Components

**File:** `frontend/components/Onboarding/PersonaSelector.tsx`

```typescript
// Component for signup flow
// Shows 3 persona cards: Okedi, Yuki, Amara
// User selects one → sets in database → unlocks path
// Tracks selection with analytics
```

**File:** `frontend/components/Onboarding/MilestoneTracker.tsx`

```typescript
// Component for Settings
// Shows current milestone progress
// Visual timeline of persona path
// Badges for completed milestones
// "Next unlock" countdown/requirements
```

**File:** `frontend/components/Onboarding/TutorialModal.tsx`

```typescript
// Shows when user unlocks new feature
// Step-by-step guided walkthrough
// "Skip Tutorial" + "Next" buttons
// Progress: "Step 2 of 5"
// Completion reward notification
```

**File:** `frontend/components/Onboarding/PersonaProfile.tsx`

```typescript
// New Settings page: Persona & Progress
// Current persona (with option to switch)
// Milestone timeline (completed ✅, current 🔄, upcoming 🔒)
// Tutorial library for persona
// Badges/achievements earned
```

---

## Currency System (Already Updated ✅)

The gating service now:
- Stores all gating amounts in **KES (Kenyan Shilling)** as base
- Converts to user's `preferredCurrency` when returning amountNeeded
- Supports: USD, EUR, GBP, GHS, ZAR, UGX, NGN

Example response:
```json
{
  "feature": "vault.yield",
  "isAvailable": false,
  "reason": "Available when balance exceeds 100K",
  "amountNeeded": 77.52,
  "currency": "USD"
}
```

---

## Personalization Strategy

### Colors by Persona
- **Okedi** (Community) → 🟢 Green (trust, community)
- **Yuki** (Dev) → 🔵 Blue (tech, stability)
- **Amara** (Investor) → 🟡 Gold (wealth, premium)

### Feature Unlock Speed
- **Okedi:** Slower (governance features take time to understand)
- **Yuki:** Moderate (dev features available sooner)
- **Amara:** Fastest (investors trusted with capital features)

### Notifications
- Milestone unlocked → Custom message by persona
- Tutorial available → Persona-specific "Want to learn?"
- Reward earned → Show reputation/badge gain

---

## Testing Scenarios

### Scenario 1: Okedi at Signup
1. Signup flow → Select Okedi (Community Manager)
2. Day 0: governance.vote, governance.create available
3. Suggestion: "Complete governance tutorial to learn voting"
4. Tutorial → 5 steps, ~8 minutes
5. Complete tutorial → +10 reputation
6. Check gating-status → Next milestone shows at Week 1

### Scenario 2: Yuki Reaches Milestone
1. User has been member for 7 days
2. Has balance > 100K KES
3. `/api/personas/next-milestone` returns trading.dex unlock
4. UI shows: "🎉 You've unlocked Trading! Complete tutorial?"
5. User clicks tutorial
6. Modal shows 6-step guide with live demo
7. Complete → +15 reputation + trading badge

### Scenario 3: Switch Personas
1. Current persona: Okedi (Week 2)
2. Go to Settings → Persona & Progress
3. Click "Switch Persona" → Confirm action
4. Select Yuki
5. Progress resets (now on Yuki path, Day 0)
6. Gating re-evaluated with Yuki's rules
7. Previous completed milestones marked as "skipped"

---

## File Structure

```
server/
├─ services/
│  ├─ personaService.ts (new)
│  └─ tutorialService.ts (new)
├─ routes/
│  └─ personas.ts (new)
└─ migrations/
   └─ 001_create_persona_tables.ts

frontend/
├─ components/
│  └─ Onboarding/
│     ├─ PersonaSelector.tsx (new)
│     ├─ MilestoneTracker.tsx (new)
│     ├─ TutorialModal.tsx (new)
│     └─ PersonaProfile.tsx (new)
├─ pages/
│  └─ onboarding.tsx (new)
└─ hooks/
   └─ usePersonaProgress.ts (new)

shared/
└─ types/
   └─ persona.ts (new)
```

---

## Success Criteria

✅ When complete, users will:
- Select persona at signup (Okedi/Yuki/Amara)
- See personalized feature unlock path
- Get guided tutorials for new features
- Earn reputation & badges for milestones
- Track progress in Settings
- Option to switch personas

✅ System will:
- Auto-assign next milestones based on conditions
- Award reputation bonuses for tutorial completion
- Track tutorial completion rates by persona
- Support future analytics on feature adoption
- Scale to new features by adding to GATING_RULES

---

## Next Steps

**Ready to start? You'll need to:**

1. **Confirm persona naming** - Okedi, Yuki, Amara good?
2. **Define unlock timings** - Days shown are estimates, adjust?
3. **Set tutorial content** - Need copy for each feature per persona?
4. **Choose analytics tracking** - What metrics matter most?

Then follow Hour-by-Hour build plan above.

**Estimated Total Time:** 4-5 hours

See `PHASE_3_QUICK_BUILD.md` for reference on similar builds.

