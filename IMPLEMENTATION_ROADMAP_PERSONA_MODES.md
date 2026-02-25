# Implementation Roadmap: From Current to New Architecture

## Current State vs. Proposed

### Current Issues (What We Have)

```
gatingService.ts:
  ✅ Time-based gates (good)
  ✅ Reputation gates (good)
  ✅ Manual mode gates (good)
  ❌ Amount-based gates (bad - remove)
    - vault.yield: 100K KES
    - maonovault.access: 10K KES

personaService.ts:
  ✅ Three personas defined
  ⚠️ Personas are cosmetic (don't affect feature access)
  ❌ No persona-specific dashboard configuration
  ❌ No switchable modes
  ❌ No personalized feature gates

App architecture:
  ❌ No "active mode" concept
  ❌ Dashboard same for all users
  ❌ No persona-based context
```

---

## The Changes Needed

### 1️⃣ Update User Schema (Database)

**Add to `user` table:**
```sql
ALTER TABLE users ADD COLUMN activePersona VARCHAR(50);
-- Defaults to NULL or primary persona
-- Can change anytime
```

**Or in TypeScript schema:**
```typescript
// In shared/schema.ts
export const users = sqliteTable('users', {
  // ... existing fields
  primaryPersona: text('primary_persona').references(() => personas.id),
  activePersona: text('active_persona'),  // NEW: Can differ from primary
  advancedMode: integer('advanced_mode').default(0),  // 0 = false, 1 = true
  // REMOVE these amount-based fields:
  // minVaultBalance: removed
  // minPoolBalance: removed
});
```

---

### 2️⃣ Update Gating Service

**File: `server/services/gatingService.ts`**

```typescript
// REMOVE:
'vault.yield': {
  type: 'balance',
  value: { minAmount: 100_000 },
  explanation: 'Available when balance exceeds 100K',
}

'maonovault.access': {
  type: 'balance',
  value: { minAmount: 10_000 },
  explanation: 'Access Maono Vault when Dao balance exceeds 10K',
}

// CHANGE to:
'vault.yield': {
  type: 'none',
  explanation: 'Available immediately to all users',
}

'maonovault.access': {
  type: 'none',
  explanation: 'Available immediately to all users',
}

// ADD new gates:
'leverage.trading': {
  type: 'manual',
  value: { requiresAdvancedMode: true },
  explanation: 'Enable Advanced Mode to access leverage trading',
}

'smart.contracts': {
  type: 'manual',
  value: { requiresAdvancedMode: true },
  explanation: 'Enable Advanced Mode to execute smart contracts',
}
```

---

### 3️⃣ Update Persona Service

**File: `server/services/personaService.ts`**

Add dashboard configuration:

```typescript
export interface Persona {
  id: PersonaType;
  name: string;
  displayName: string;
  role: string;
  description: string;
  icon: string;
  color: string;
  focusAreas: string[];
  unlockPriorities: string[];
  
  // NEW: Dashboard configuration
  dashboard: {
    primaryWidgets: string[];    // ['dao-overview', 'governance-activity', ...]
    secondaryWidgets: string[];  // ['trading-status', ...]
    hiddenWidgets: string[];     // ['advanced-trading', ...]
  };
}

// Update PERSONAS object:
export const PERSONAS: Record<PersonaType, Persona> = {
  okedi: {
    // ... existing fields
    dashboard: {
      primaryWidgets: [
        'dao-overview',
        'governance-activity',
        'reputation-progress',
        'proposal-drafts'
      ],
      secondaryWidgets: [
        'trading-overview',
        'yield-farms',
        'market-alerts'
      ],
      hiddenWidgets: [
        'leverage-trading',
        'smart-contracts'
      ]
    }
  },
  yuki: {
    // ... existing fields
    dashboard: {
      primaryWidgets: [
        'trading-overview',
        'open-positions',
        'market-alerts',
        'yield-farms'
      ],
      secondaryWidgets: [
        'governance-activity',
        'portfolio-health'
      ],
      hiddenWidgets: [
        'dao-creation'
      ]
    }
  },
  amara: {
    // ... existing fields
    dashboard: {
      primaryWidgets: [
        'wealth-overview',
        'dao-investments',
        'yield-ranking',
        'passive-income'
      ],
      secondaryWidgets: [
        'governance-activity',
        'portfolio-diversification'
      ],
      hiddenWidgets: [
        'leverage-trading'
      ]
    }
  }
};

// Add function to get dashboard config
export function getPersonaDashboardConfig(persona: PersonaType): DashboardConfig | null {
  return persona && PERSONAS[persona] ? PERSONAS[persona].dashboard : null;
}
```

---

### 4️⃣ Create Persona Context (Frontend)

**File: `client/src/contexts/persona-context.ts`**

```typescript
import React, { createContext, useContext, useState, useCallback } from 'react';

interface PersonaContextType {
  primaryPersona: 'okedi' | 'yuki' | 'amara' | null;
  activePersona: 'okedi' | 'yuki' | 'amara' | null;
  setActivePersona: (persona: 'okedi' | 'yuki' | 'amara') => void;
  isAdvancedMode: boolean;
  toggleAdvancedMode: () => void;
}

const PersonaContext = createContext<PersonaContextType | undefined>(undefined);

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [primaryPersona, setPrimaryPersona] = useState<'okedi' | 'yuki' | 'amara' | null>(null);
  const [activePersona, setActivePersona] = useState<'okedi' | 'yuki' | 'amara' | null>(null);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);

  const setActive = useCallback((persona: 'okedi' | 'yuki' | 'amara') => {
    setActivePersona(persona);
    localStorage.setItem('activePersona', persona);
  }, []);

  const toggle = useCallback(() => {
    setIsAdvancedMode(prev => !prev);
    localStorage.setItem('advancedMode', String(!isAdvancedMode));
  }, [isAdvancedMode]);

  return (
    <PersonaContext.Provider
      value={{
        primaryPersona,
        activePersona,
        setActivePersona: setActive,
        isAdvancedMode,
        toggleAdvancedMode: toggle
      }}
    >
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona() {
  const context = useContext(PersonaContext);
  if (!context) {
    throw new Error('usePersona must be used within PersonaProvider');
  }
  return context;
}
```

**Wrap App with PersonaProvider:**

```typescript
// App.tsx
<PersonaProvider>
  <MorioProvider>
    {/* existing content */}
  </MorioProvider>
</PersonaProvider>
```

---

### 5️⃣ Create Persona Switch Component

**File: `client/src/components/PersonaModeSelector.tsx`**

```typescript
import React from 'react';
import { Button } from './ui/button';
import { PERSONAS } from '@/lib/personaService';
import { usePersona } from '@/contexts/persona-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

export default function PersonaModeSelector() {
  const { primaryPersona, activePersona, setActivePersona } = usePersona();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Mode</CardTitle>
        <CardDescription>
          Switch your dashboard view anytime. All features remain accessible.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(PERSONAS).map(([id, persona]) => (
            <Button
              key={id}
              variant={activePersona === id ? 'default' : 'outline'}
              className={`h-auto p-4 flex flex-col items-center gap-2 ${
                activePersona === id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setActivePersona(id as any)}
            >
              <span className="text-2xl">{persona.icon}</span>
              <span className="font-semibold">{persona.displayName}</span>
              <span className="text-xs text-gray-500">{persona.role}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Add to Settings page:**
```typescript
// pages/settings.tsx
import PersonaModeSelector from '@/components/PersonaModeSelector';

export default function Settings() {
  return (
    <>
      {/* ... existing sections */}
      <PersonaModeSelector />
    </>
  );
}
```

---

### 6️⃣ Update Dashboard to Use Persona Layout

**File: `client/src/components/dashboard/PersonalizedDashboard.tsx`**

```typescript
import { usePersona } from '@/contexts/persona-context';
import { getPersonaDashboardConfig } from '@/lib/personaService';

export default function PersonalizedDashboard() {
  const { activePersona } = usePersona();
  const config = getPersonaDashboardConfig(activePersona);

  return (
    <div className="space-y-6">
      {/* Primary widgets (featured first) */}
      {config?.primaryWidgets.map(widgetId => (
        <Widget key={widgetId} id={widgetId} />
      ))}

      {/* Secondary widgets (less featured) */}
      <div className="border-t pt-6">
        <h3 className="text-sm font-semibold mb-4">More Options</h3>
        {config?.secondaryWidgets.map(widgetId => (
          <Widget key={widgetId} id={widgetId} />
        ))}
      </div>

      {/* Hidden widgets only in menu */}
      {/* Not shown by default, but accessible via "View All" menu */}
    </div>
  );
}
```

---

### 7️⃣ Update Morio Context

**File: `server/agents/morio/handlers/gatingHandler.ts`**

```typescript
// Update to include persona in context
export async function generateGatingExplanation(
  userId: string,
  context: GatingContext,
  persona?: string  // NEW parameter
): Promise<string> {
  const { feature, isAvailable, reason } = context;
  
  let explanation = '';

  // Persona-specific intro
  if (persona === 'okedi') {
    explanation += '🎤 **As a Community Leader:**\n';
  } else if (persona === 'yuki') {
    explanation += '🛠️ **As a Trader:**\n';
  } else if (persona === 'amara') {
    explanation += '💰 **As an Investor:**\n';
  }

  // Rest of explanation...
  return explanation;
}
```

---

### 8️⃣ Update API Endpoints

**File: `server/routes/personas.ts`**

Add new endpoints:

```typescript
import { Router } from 'express';
import { 
  setActivePersona, 
  getActivePersona,
  getUserPersona 
} from '../services/personaService';

const router = Router();

// NEW: Set active mode
router.post('/active-mode', async (req, res) => {
  const { persona } = req.body;
  const userId = req.user?.id;
  
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const success = await setActivePersona(userId, persona);
  res.json({ success });
});

// NEW: Get active mode
router.get('/active-mode', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const persona = await getActivePersona(userId);
  res.json({ persona });
});

// EXISTING: Get current persona
router.get('/current', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const persona = await getUserPersona(userId);
  res.json({ persona });
});

export default router;
```

---

### 9️⃣ Update Settings UI

**File: `client/src/components/sections/PreferencesSettings.tsx`**

Add Advanced Mode toggle:

```typescript
import { Toggle } from '@/components/ui/toggle';
import { usePersona } from '@/contexts/persona-context';

export function PreferencesSettings() {
  const { isAdvancedMode, toggleAdvancedMode } = usePersona();

  return (
    <div className="space-y-6">
      {/* ... existing preferences */}
      
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Advanced Mode</h3>
            <p className="text-sm text-gray-600">
              Unlock advanced trading, leverage, and smart contracts
            </p>
          </div>
          <Toggle
            pressed={isAdvancedMode}
            onPressedChange={toggleAdvancedMode}
            className="ml-4"
          />
        </div>
      </div>
    </div>
  );
}
```

---

## Summary of Changes

| Component | Change | Type | Impact |
|-----------|--------|------|--------|
| gatingService.ts | Remove amount gates | Code | Medium |
| personaService.ts | Add dashboard config | Code | Medium |
| User schema | Add activePersona field | Database | Low |
| PersonaContext | Create new context | New File | Medium |
| PersonaModeSelector | Add mode switcher | New Component | Low |
| Dashboard | Use persona layouts | Code | Medium |
| API endpoints | Add /active-mode routes | Code | Low |
| Settings page | Add mode selector | Code | Low |
| Morio handler | Add persona context | Code | Low |

---

## Testing Checklist

- [ ] User can change active persona in Settings
- [ ] Dashboard reorganizes when persona changes
- [ ] Amount gates removed - any balance can access vaults
- [ ] Community mode hides trading UI but doesn't block access
- [ ] Trader mode shows trading first but doesn't block governance
- [ ] Investor mode shows passive income first
- [ ] Advanced Mode toggle enables leverage/smart contracts
- [ ] Morio gives persona-specific advice
- [ ] localStorage persists active persona across sessions
- [ ] Mobile responsive for persona selector

---

## Rollout Plan

### Phase 1: Backend Changes (Week 1)
- [ ] Update database schema
- [ ] Remove amount-based gates
- [ ] Add dashboard configuration
- [ ] Deploy to staging

### Phase 2: Frontend Contexts (Week 2)
- [ ] Create PersonaContext
- [ ] Create PersonaModeSelector
- [ ] Update Settings page
- [ ] Deploy to staging

### Phase 3: Dashboard Updates (Week 3)
- [ ] Update PersonalizedDashboard
- [ ] Add widget conditional rendering
- [ ] Test all three layouts
- [ ] Deploy to staging

### Phase 4: Morio Integration (Week 4)
- [ ] Update gatingHandler
- [ ] Add persona-aware responses
- [ ] Test all combinations
- [ ] Deploy to production

---

## Success Metrics

✅ Users can switch personas without losing data  
✅ No amount-based barriers to entry (start with 1 KES)  
✅ Users can access all features from any mode  
✅ Dashboard changes based on active mode  
✅ Morio gives context-aware advice  
✅ No user confusion about feature access  
