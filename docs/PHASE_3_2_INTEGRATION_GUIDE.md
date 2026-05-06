# Phase 3.2 Integration Guide

**Status:** Ready for Integration  
**Date:** January 26, 2026

---

## Quick Start Integration

### Step 1: Database Migration
```bash
# Run the migration
psql -U [user] -d [database] -f server/migrations/002_add_persona_system.sql

# Verify tables created
\dt user_personas
\dt tutorial_progress
```

### Step 2: Register Personas Route
In `server/index.ts` (or main app file):

```typescript
import personasRouter from './routes/personas';

// Add this route
app.use('/api/personas', personasRouter);
```

### Step 3: Add Persona Selector to Signup
In your signup page/flow (e.g., `client/src/pages/signup.tsx`):

```tsx
import PersonaSelector from '@/components/PersonaSelector';

export default function SignupPage() {
  const [step, setStep] = useState('persona'); // or 'form', 'confirm'
  
  if (step === 'persona') {
    return (
      <PersonaSelector 
        isSignupFlow={true}
        onSuccess={() => setStep('form')}
      />
    );
  }
  
  // ... rest of signup form
}
```

### Step 4: Add Persona Profile to Settings
In `client/src/pages/settings.tsx` or settings layout:

```tsx
import PersonaProfile from '@/components/PersonaProfile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SettingsPage() {
  return (
    <Tabs defaultValue="general">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="preferences">Preferences</TabsTrigger>
        <TabsTrigger value="persona">Persona & Progress</TabsTrigger>
      </TabsList>
      
      <TabsContent value="persona">
        <PersonaProfile />
      </TabsContent>
    </Tabs>
  );
}
```

### Step 5: Integrate Gating Handler into Morio
In `server/agents/morio/api/response_generator.ts`:

```typescript
import { handleGatingQuestion } from '../../handlers/gatingHandler';

export class ResponseGenerator {
  async generate(understanding: any, context: UserContext) {
    // ... existing code ...

    // Check if this is a gating question
    const gatingResult = await handleGatingQuestion(
      context.userId,
      understanding.rawInput
    );

    if (gatingResult.isGatingQuestion) {
      return {
        content: gatingResult.response,
        metadata: {
          gatingContext: gatingResult.context,
          type: 'gating-guidance'
        }
      };
    }

    // ... continue with normal response generation
  }
}
```

### Step 6: Update Morio System Prompt
In Morio's initialization:

```typescript
import { GATING_CONTEXT_PROMPT } from './prompts/gating-context';

const systemPrompt = `
${existingSystemPrompt}

${GATING_CONTEXT_PROMPT}
`;
```

---

## Testing Checklist

### Frontend Tests
- [ ] PersonaSelector renders with 3 personas
- [ ] Click persona highlights it with checkmark
- [ ] "Continue as [Name]" button enables when selected
- [ ] POST /api/personas/select called on confirmation
- [ ] Success callback fires and navigates to next step
- [ ] PersonaProfile shows current persona in settings
- [ ] "Change Persona" dialog appears
- [ ] Can switch between personas in settings
- [ ] Progress bar updates correctly
- [ ] Next milestone card shows correct feature & requirements
- [ ] Feature timeline displays all features in order

### Backend Tests
- [ ] POST /api/personas/select creates user_personas record
- [ ] GET /api/personas returns all 3 personas
- [ ] GET /api/personas/current returns user's persona
- [ ] GET /api/personas/progress calculates unlock percentage correctly
- [ ] GET /api/personas/next-milestone returns correct next feature
- [ ] GET /api/morio/user-context returns full gating status
- [ ] Feature gating correctly identifies locked/available features
- [ ] Currency conversion works (KES → user's preferredCurrency)

### Morio Integration Tests
- [ ] "Can I access vault?" → Detects vault.yield question
- [ ] "Why is trading locked?" → Generates gating explanation
- [ ] Response includes unlock paths (deposit, refer, wait)
- [ ] Response includes persona-specific advice
- [ ] "What should I do next?" → Shows next milestone from persona path
- [ ] Feature unlock celebration message sends

### End-to-End Tests
1. **Signup Flow:**
   - User signs up
   - PersonaSelector shows
   - User picks Yuki (Developer)
   - Completes signup
   - Verify user_personas table has `{ user_id: X, persona: 'yuki' }`

2. **Ask About Feature:**
   - User (Yuki): "Can I trade?"
   - Morio detects trading.dex question
   - Gets gating status (requires Advanced Mode)
   - Returns: "Enable Advanced Mode to trade immediately!"
   - Includes Yuki-specific advice

3. **Unlock Feature:**
   - User deposits balance to 100K
   - User asks about vault
   - Morio says vault.yield is now available
   - Celebration message shown

4. **Change Persona:**
   - User in settings → Persona & Progress
   - Clicks "Change Persona"
   - Selects Amara instead of Yuki
   - user_personas updated
   - PersonaProfile shows Amara's unlock path

---

## API Reference

### Personas Endpoints

#### GET /api/personas
Returns all available personas
```json
[
  {
    "id": "okedi",
    "name": "Okedi",
    "role": "Community Manager",
    "description": "...",
    "icon": "🎤",
    "color": "#8B5CF6",
    "focusAreas": ["dao.create", "proposal.create", ...]
  },
  // ... other 2 personas
]
```

#### GET /api/personas/current
Returns user's current persona
```json
{
  "persona": "yuki",
  "details": { /* persona object */ }
}
```

#### POST /api/personas/select
Set user's persona
```json
{
  "persona": "yuki"
}
```
Response:
```json
{
  "success": true,
  "persona": "yuki",
  "details": { /* persona object */ }
}
```

#### GET /api/personas/progress
Get feature unlock progress
```json
{
  "persona": "yuki",
  "personaName": "Yuki",
  "totalFeatures": 8,
  "unlockedFeatures": 3,
  "progressPercentage": 37.5,
  "nextMilestone": {
    "feature": "vault.yield",
    "name": "Available when balance exceeds 100K",
    "isAvailable": false,
    "amountNeeded": 50000,
    "currency": "KES",
    "priority": 2
  },
  "progress": [
    // Array of all features with status
  ]
}
```

#### GET /api/personas/next-milestone
Get next feature to unlock
```json
{
  "feature": "vault.yield",
  "name": "Available when balance exceeds 100K",
  "daysUntilAvailable": null,
  "amountNeeded": 50000,
  "currency": "KES",
  "personaAdvice": "Accumulate 100K KES to access yield farming..."
}
```

### Morio Endpoint

#### GET /api/morio/user-context
Get user's context for Morio
```json
{
  "userId": "user123",
  "persona": "yuki",
  "accountAge": 3,
  "balance": 50000,
  "balanceCurrency": "KES",
  "preferredCurrency": "USD",
  "reputation": 1,
  "advancedMode": false,
  "availableFeatures": ["dao.join", "governance.vote"],
  "lockedFeatures": ["vault.yield", "trading.dex"],
  "gatingStatus": {
    "vault.yield": {
      "isAvailable": false,
      "reason": "Available when balance exceeds 100K",
      "amountNeeded": 50000,
      "currency": "KES"
    },
    // ... other features
  },
  "timestamp": "2026-01-26T10:30:00Z"
}
```

---

## Troubleshooting

### PersonaSelector not showing
- Check if route `/api/personas/select` is registered
- Verify component import path is correct
- Check browser console for CORS errors

### POST /api/personas/select returns 401
- Ensure user is authenticated
- Check if `req.user` middleware is properly configured
- Verify JWT/session is valid

### Database migration fails
- Check PostgreSQL version (need 9.6+)
- Verify user has CREATE TABLE permissions
- Check if tables already exist (run with `IF NOT EXISTS`)

### Gating questions not detected
- Check keyword list in gatingHandler.ts
- Verify user message is being passed to handleGatingQuestion()
- Look for detection confidence threshold (current: any match)

### Currency conversion showing KES instead of user's currency
- Check user's preferredCurrency field is set
- Verify exchangeRateService has the currency mapping
- Check conversion rates in GATING_RULES values (must be KES amounts)

---

## File Locations

### Backend
```
server/
├── services/
│   └── personaService.ts ✅
├── routes/
│   ├── personas.ts ✅
│   └── morio.ts (modified) ✅
├── agents/morio/
│   ├── handlers/
│   │   └── gatingHandler.ts ✅
│   └── prompts/
│       └── gating-context.ts ✅
└── migrations/
    └── 002_add_persona_system.sql ✅
```

### Frontend
```
client/src/
└── components/
    ├── PersonaSelector.tsx ✅
    └── PersonaProfile.tsx ✅
```

---

## Performance Considerations

### Database
- `user_personas` has UNIQUE constraint on user_id → O(1) lookup
- Indexes on user_id and persona for fast queries
- `tutorial_progress` indexed for feature tracking

### API
- `/api/personas/progress` queries all features → ~8 DB calls per request
- Consider caching with 5-minute TTL for frequent views
- `/api/morio/user-context` is called by Morio → keep fast

### Frontend
- PersonaProfile uses React Query → cached automatically (5 min default)
- PersonaSelector single query on mount
- PersonaProfile refetch on "Change Persona" action

---

## Next Steps

1. ✅ **Run database migration** → Creates tables
2. ✅ **Register personas route** → Enable API endpoints
3. ✅ **Integrate into signup** → PersonaSelector component
4. ✅ **Integrate into settings** → PersonaProfile component
5. ✅ **Hook up Morio** → gatingHandler in response pipeline
6. ⏳ **Test thoroughly** → Follow testing checklist
7. ⏳ **Monitor adoption** → Track which personas are selected
8. ⏳ **Collect feedback** → User satisfaction with gating explanations

---

## Success Metrics

Track these after deployment:

1. **Persona Selection**
   - What % of users select each persona? (target: balanced across 3)
   - Okedi: 30%, Yuki: 35%, Amara: 35%

2. **Feature Adoption**
   - Did locked features get unlocked faster? (target: +25% vs baseline)
   - Time-to-unlock by persona (should differ based on paths)

3. **Morio Engagement**
   - How many gating questions asked? (target: 1-5 per user)
   - Avg message count when feature is locked vs unlocked

4. **User Satisfaction**
   - Would you recommend MTAA? (target: 4.5/5 vs 3.5/5 before)
   - Feature unlock satisfaction (target: 4/5)

---

## Support

Questions during integration? Reference:
- **Architecture:** PHASE_3_2_MORIO_LED_REVISED.md
- **Implementation:** PHASE_3_2_IMPLEMENTATION_COMPLETE.md
- **Gating System:** CURRENCY_CONVERSION_GATING.md
- **Morio Integration:** MORIO_GATING_INTEGRATION_CHECKLIST.md

🚀 **Ready to ship!**
