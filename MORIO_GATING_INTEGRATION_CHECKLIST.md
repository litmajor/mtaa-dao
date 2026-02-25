# Morio + Feature Gating: Integration Checklist

**Purpose:** Make Morio the primary interface for feature discovery, gating explanations, and onboarding guidance

---

## Quick Integration Points

### 1. Morio Becomes Aware of Gating Status

**Add to Morio's context:**

```typescript
// morio/config/systemPrompt.ts - ADD THIS

export const GATING_CONTEXT = `
You have access to user's feature gating status.

GATING RULES:
- trading.dex: Requires Advanced Mode (manual)
- vault.yield: Requires 100K KES balance
- proposal.create: Requires 7 days account age
- ai.assistant (Morio): Requires 1+ reputation
- governance.vote: No gating (available immediately)

USER CONTEXT (available in memory):
- persona: 'okedi' | 'yuki' | 'amara'
- accountAge: number (days)
- balance: number (KES)
- reputation: number
- advancedMode: boolean
- availableFeatures: string[]
- lockedFeatures: { feature: GatingStatus }[]

WHEN USER ASKS ABOUT FEATURES:
1. Check if feature is in lockedFeatures
2. Explain why it's locked (gating reason)
3. Tell them how long until available
4. Suggest alternative available features
5. Offer to guide them toward unlock
`;
```

### 2. Morio Queries Gating System

**New Morio endpoint:**

```typescript
// server/routes/morio.ts - ADD ENDPOINT

router.get('/api/morio/user-context', requireAuth, async (req, res) => {
  const user = req.user;
  
  // Get gating status for all features
  const gatingStatus = Object.keys(GATING_RULES).reduce((acc, feature) => {
    acc[feature] = checkFeatureGating(feature, user);
    return acc;
  }, {});
  
  // Get user's persona
  const persona = await getUserPersona(user.id);
  
  res.json({
    persona,
    accountAge: Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
    balance: user.balance || 0,
    reputation: user.reputation || 0,
    advancedMode: user.advancedMode || false,
    preferredCurrency: user.preferredCurrency || 'KES',
    
    // Feature status
    availableFeatures: Object.entries(gatingStatus)
      .filter(([_, status]) => status.isAvailable)
      .map(([feature]) => feature),
    
    lockedFeatures: Object.entries(gatingStatus)
      .filter(([_, status]) => !status.isAvailable)
      .reduce((acc, [feature, status]) => ({
        ...acc,
        [feature]: status
      }), {}),
  });
});
```

### 3. Morio Responds to Gating Questions

**User asks: "Why can't I access vault yield?"**

```typescript
// morio/api/handlers/gatingHandler.ts - NEW FILE

export async function handleGatingQuestion(question: string, userContext: UserContext): Promise<string> {
  // Extract feature name from question
  const featureName = extractFeature(question);
  
  if (!featureName) {
    return "Which feature are you interested in?";
  }
  
  const gatingStatus = userContext.lockedFeatures[featureName];
  
  if (!gatingStatus) {
    return `${featureName} is available to you! 🎉`;
  }
  
  // Build personalized explanation
  let explanation = `Here's why ${featureName} is locked:\n\n`;
  
  if (gatingStatus.reason) {
    explanation += `📌 ${gatingStatus.reason}\n\n`;
  }
  
  if (gatingStatus.daysUntilAvailable) {
    explanation += `⏱️ Available in ${gatingStatus.daysUntilAvailable} days\n`;
    explanation += `📅 You've been with us ${userContext.accountAge} days\n\n`;
  }
  
  if (gatingStatus.amountNeeded) {
    explanation += `💰 You need ${gatingStatus.amountNeeded} ${gatingStatus.currency} more\n`;
    explanation += `💳 Your balance: ${userContext.balance} KES\n\n`;
  }
  
  // Add persona-specific context
  const personaContext = getPersonaContext(featureName, userContext.persona);
  if (personaContext) {
    explanation += `\n📋 Why this matters for ${userContext.persona}:\n`;
    explanation += personaContext;
  }
  
  // Suggest next steps
  explanation += `\n\n🚀 What you can do:\n`;
  explanation += suggestNextSteps(featureName, userContext);
  
  return explanation;
}

function getPersonaContext(feature: string, persona: string): string {
  const contexts = {
    'vault.yield': {
      okedi: 'Your DAO treasury can earn extra income to fund community rewards.',
      yuki: 'Passive income lets you focus on development while earning returns.',
      amara: 'Core investment vehicle for building wealth through yield farming.'
    },
    'trading.dex': {
      okedi: 'Limited use for governance, but helpful for managing DAO assets.',
      yuki: 'Essential for developers building financial applications.',
      amara: 'Primary way to execute investment strategies and rebalance portfolio.'
    },
    // ... more features
  };
  
  return contexts[feature]?.[persona] || '';
}

function suggestNextSteps(feature: string, context: UserContext): string {
  if (context.amountNeeded) {
    return `1. Earn ${context.amountNeeded} ${context.currency}\n   • Refer friends (+25K KES each)\n   • Complete tutorials (+reputation)\n   • Daily activity bonuses\n\n2. Once unlocked, I'll guide you through setup!`;
  }
  
  if (context.daysUntilAvailable) {
    return `1. Wait ${context.daysUntilAvailable} more days\n2. Meanwhile, explore available features\n3. I'll remind you when it unlocks! ✨`;
  }
  
  return `Ready to get started? I can walk you through the setup! 🚀`;
}
```

### 4. Morio Celebrates Unlocks

**When feature becomes available:**

```typescript
// When gating status changes from locked → available
router.post('/api/features/:feature/unlocked', requireAuth, async (req, res) => {
  const { feature } = req.params;
  const user = req.user;
  
  // Notify Morio
  const celebration = generateCelebration(feature, user.persona);
  
  // Send to Morio chat
  await sendMorioMessage(user.id, celebration);
  
  // Add achievement badge
  await addAchievement(user.id, `unlocked_${feature}`);
});

function generateCelebration(feature: string, persona: string): string {
  const celebrations = {
    vault.yield: {
      okedi: '🎉 Your DAO can now earn passive income! Want to set it up?',
      yuki: '🎉 Time to start earning on your holdings!',
      amara: '🎉 Vault Yield is ready! Let me help you set up your first investment.'
    },
    trading.dex: {
      okedi: '🎉 You can now trade to manage DAO assets!',
      yuki: '🎉 DEX access unlocked! Time to build.',
      amara: '🎉 Trading ready! Need help with your first trade?'
    },
    // ... more features
  };
  
  return celebrations[feature]?.[persona] || '🎉 New feature unlocked!';
}
```

### 5. Morio Remembers Gating Context

**Track conversation history with gating context:**

```typescript
// morio/services/conversationMemory.ts - UPDATE

interface ConversationContext {
  persona: string;
  accountAge: number;
  
  // Gating-aware memory
  askedAboutFeature?: {
    feature: string;
    gatingStatus: GatingStatus;
    timeAsked: Date;
  };
  
  tutorialsCompleted: string[];
  featuresToExplore: string[];
  nextMilestones: string[];
  
  // Personality memory
  userPrefers?: 'quick_summary' | 'detailed_explanation' | 'code_examples';
}

// Morio remembers:
// "User asked about vault.yield 2 hours ago"
// "They need 50K more KES"
// "I should check if they've deposited more"
```

### 6. Morio Proactively Guides Toward Unlocks

**Periodic check-in:**

```typescript
// server/cron/morio-check-ins.ts - NEW CRON JOB

// Run every 24 hours
export async function dailyMorioCheckIn() {
  const users = await getAllUsers();
  
  for (const user of users) {
    // Check if any new features became available
    const newlyUnlocked = await checkNewlyUnlockedFeatures(user.id);
    
    if (newlyUnlocked.length > 0) {
      for (const feature of newlyUnlocked) {
        await notifyMorio(user.id, `New feature unlocked: ${feature}`);
      }
    }
    
    // Check if user is close to unlocking something
    const almostUnlocked = await checkAlmostUnlockedFeatures(user.id);
    
    if (almostUnlocked.length > 0) {
      const message = buildMotivationalMessage(almostUnlocked, user.persona);
      await sendMorioMessage(user.id, message);
    }
  }
}

function buildMotivationalMessage(almostUnlocked: Feature[], persona: string): string {
  if (almostUnlocked.some(f => f.name === 'vault.yield')) {
    if (persona === 'amara') {
      return `💫 You're SO close to Vault Yield! Just 20K KES more.
              Want tips on the fastest way to earn that amount?`;
    }
  }
  
  return `🚀 You're close to unlocking something big!
          Want a hint on which feature to pursue next?`;
}
```

### 7. Morio Explains Feature Relationships

**When user asks about feature interactions:**

```
USER: "Should I learn trading first or vault yield?"

MORIO (YUKI): "Great question! Here's the flow:

1️⃣ Trading (unlocks first - Enable Advanced Mode)
   → You learn swaps & market dynamics
   
2️⃣ Vault Yield (100K balance)
   → Put your swapped tokens to earn
   
3️⃣ API Access (5+ reputation)
   → Automate both of the above
   
Best path: Master trading → Build balance → Automate with API

Want to start with the trading tutorial?"
```

---

## Implementation Roadmap

### Week 1: Foundation
- [ ] Add gating context to Morio system prompt
- [ ] Create `/api/morio/user-context` endpoint
- [ ] Update Morio to query gating status
- [ ] Test basic gating Q&A

### Week 2: Enhancement
- [ ] Add persona-specific gating explanations
- [ ] Create gating question handler
- [ ] Add "almost unlocked" notifications
- [ ] Track conversation context around gating

### Week 3: Celebration & Motivation
- [ ] Add unlock celebration messages
- [ ] Create achievement badges
- [ ] Build proactive guidance system
- [ ] Add motivational messages for "close to unlock"

### Week 4: Advanced
- [ ] Feature relationship explanations
- [ ] Personalized unlock recommendations
- [ ] Learning path suggestions
- [ ] Analytics on gating Q&A patterns

---

## Example Conversations

### Conversation 1: New User (Day 1)

```
USER: "What can I do now?"

MORIO (OKEDI): "Welcome! You're a Community Manager at heart. 👋

✅ HERE & NOW:
  • Vote on proposals
  • Join DAOs
  • Participate in governance discussions

🔒 ALMOST READY (in 6 days):
  • Create your own proposals
  • Lead governance votes

💰 WHEN YOU HIT 50K KES:
  • Treasury management
  • DAO fund operations

What would you like to start with?"
```

### Conversation 2: Close to Unlock

```
USER: "How long until I can trade?"

MORIO (YUKI): "Very close! 🚀

You have two paths:

PATH 1 - Immediate (2 minutes)
  ✅ Advanced Mode is ready for you
  Settings → Preferences → Enable
  → Unlocks trading immediately!

PATH 2 - Just earned
  ⭐ You reached 1 reputation!
  Combined with Advanced Mode → Trading unlocked

Want to enable Advanced Mode right now?"
```

### Conversation 3: Budget Question

```
USER: "I only have 50K KES. What can I do?"

MORIO (AMARA): "Perfect! Here's the smart move:

🎯 IMMEDIATE (no deposit needed):
  • Vote on proposals
  • Monitor marketplace
  • Learn about vaults

💡 QUICK WINS:
  • Deposit 50K KES → Earn ~10K/year in Vault
  • Refer 1 friend → Earn 25K bonus
  • Refer 2 → Total 100K (unlocks more features!)

🚀 FASTEST PATH:
  1. Deposit your 50K (today)
  2. Refer 1 friend (earn 25K)
  3. Access investment pools with 75K
  4. Both features earning for you

Ready to deploy your capital?"
```

---

## Morio + Gating = User Delight

**Result:**
- Users don't feel restricted, they feel guided
- Gating becomes a narrative ("You're on the path to...") not a wall
- Morio explains why, not just that it's locked
- Clear path forward always visible
- Persona-specific context makes it feel personal
- User satisfaction increases dramatically

**Integration Effort:** Low (mainly prompt updates + endpoint)  
**User Impact:** Very High (turns friction into guidance)

