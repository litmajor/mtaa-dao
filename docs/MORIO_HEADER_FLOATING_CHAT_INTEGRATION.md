# Morio Always-Visible UI Integration Guide

## Overview

Two new components make Morio accessible everywhere:
- **MorioHeaderButton**: Quick context-aware access from headers
- **MorioFloatingChat**: Always-visible persistent chat in bottom-right

Both components are context-aware and persona-specific.

---

## Component: MorioHeaderButton

**File**: `client/src/components/MorioHeaderButton.tsx`

### Features
- Shows context-specific help message based on page
- Displays relevant quick questions for current context
- Opens modal with suggestions
- One-click access to full Morio chat

### Context Messages by Page
- **Account**: "Questions about your profile, security, or preferences?"
- **Finance**: "Need help with vault yields, trading, or investment pools?"
- **DAOs**: "Want to learn about proposals, voting, or creating a DAO?"
- **Dashboard**: "Welcome! Ask me about any feature..."
- **Settings**: "Looking for help with your account settings?"

### Usage

```tsx
import MorioHeaderButton from '@/components/MorioHeaderButton';

// In any header component:
<MorioHeaderButton context="finance" />
```

### Props
```typescript
interface MorioHeaderButtonProps {
  context?: 'account' | 'finance' | 'daos' | 'dashboard' | 'settings';
}
```

---

## Component: MorioFloatingChat

**File**: `client/src/components/MorioFloatingChat.tsx`

### Features
- Always-visible in bottom-right corner
- Minimizable with unread badge
- Persistent chat history (localStorage)
- Quick action buttons (Help, Features, Persona)
- Real-time API integration with gatingHandler
- Dark mode support
- Responsive design

### Usage

```tsx
import MorioFloatingChat from '@/components/MorioFloatingChat';

// Add to root layout (renders once, available everywhere):
export default function RootLayout() {
  return (
    <>
      {/* Page content */}
      {children}
      
      {/* Morio always available */}
      <MorioFloatingChat />
    </>
  );
}
```

### Features
- Saves chat history to localStorage
- Calls `/api/morio/respond` endpoint
- Shows typing indicator while loading
- Handles errors gracefully

---

## Integration Locations

### 1. Add to Root Layout (for floating chat)

**File**: `client/src/layouts/RootLayout.tsx` (or wherever your root app is)

```tsx
import MorioFloatingChat from '@/components/MorioFloatingChat';

export default function RootLayout({ children }) {
  return (
    <div>
      {children}
      
      {/* Always-visible Morio chat */}
      <MorioFloatingChat />
    </div>
  );
}
```

---

### 2. Add to Account Header

**File**: `client/src/components/headers/AccountHeader.tsx`

```tsx
import MorioHeaderButton from '@/components/MorioHeaderButton';

export default function AccountHeader() {
  return (
    <header>
      {/* Existing header content */}
      <div className="flex items-center gap-4 ml-auto">
        <MorioHeaderButton context="account" />
        {/* Other buttons */}
      </div>
    </header>
  );
}
```

---

### 3. Add to Finance Header

**File**: `client/src/components/headers/FinanceHeader.tsx`

```tsx
import MorioHeaderButton from '@/components/MorioHeaderButton';

export default function FinanceHeader() {
  return (
    <header>
      {/* Existing header content */}
      <div className="flex items-center gap-4 ml-auto">
        <MorioHeaderButton context="finance" />
        {/* Other buttons */}
      </div>
    </header>
  );
}
```

---

### 4. Add to DAOs Header

**File**: `client/src/components/headers/DAOsHeader.tsx`

```tsx
import MorioHeaderButton from '@/components/MorioHeaderButton';

export default function DAOsHeader() {
  return (
    <header>
      {/* Existing header content */}
      <div className="flex items-center gap-4 ml-auto">
        <MorioHeaderButton context="daos" />
        {/* Other buttons */}
      </div>
    </header>
  );
}
```

---

### 5. Add to Settings Page

**File**: `client/src/pages/Settings.tsx`

```tsx
import MorioHeaderButton from '@/components/MorioHeaderButton';

export default function Settings() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1>Settings</h1>
        <MorioHeaderButton context="settings" />
      </div>
      
      {/* Existing settings content */}
    </div>
  );
}
```

---

### 6. Add to Dashboard Header

**File**: `client/src/components/headers/DashboardHeader.tsx`

```tsx
import MorioHeaderButton from '@/components/MorioHeaderButton';

export default function DashboardHeader() {
  return (
    <header>
      {/* Existing header content */}
      <div className="flex items-center gap-4 ml-auto">
        <MorioHeaderButton context="dashboard" />
        {/* Other buttons */}
      </div>
    </header>
  );
}
```

---

## API Integration

Both components call existing Morio endpoints:

### Header Button
- Links to `/morio-hub` (existing Morio page)
- Passes `?q=` parameter for suggested questions

### Floating Chat
- Calls `POST /api/morio/respond`
- Passes: `{ message: string }`
- Returns: `{ response: string, metadata?: { type: string } }`

**Note**: The gatingHandler in `response_generator.ts` already checks for gating questions first, so Morio automatically provides persona-specific unlock guidance.

---

## Styling

### Required Tailwind Classes
Both components use standard Tailwind CSS:
- Colors: `blue-`, `gray-`, `red-`
- Layout: `flex`, `fixed`, `absolute`, `z-`
- Effects: `animate-`, `transition-`, `shadow-`
- Dark mode: `dark:` variants

No additional CSS files needed.

---

## Persona Integration

### Current Personas (Updated)
- **MTAA Community** (okedi) - 🎤 #8B5CF6
- **MTAA Trader** (yuki) - 🛠️ #06B6D4
- **MTAA Investor** (amara) - 💰 #EC4899

### Morio Knows
- Current user's persona (via gatingHandler context)
- Current page/section
- Which features are locked for this persona
- Next milestone to unlock

### Persona-Specific Tips
Morio automatically suggests different help based on persona:

```
MTAA Community on DAOs → "Ready to create your first proposal?"
MTAA Trader on Finance → "Interested in yield farming opportunities?"
MTAA Investor on Finance → "Check your passive income streams"
```

This is handled by `gatingHandler.generateGatingExplanation()` which receives persona context.

---

## User Experience Flow

### 1. User Lands on Finance Page
- MorioHeaderButton shows: "Need help with vault yields, trading, or investment pools? 💰"
- MorioFloatingChat is minimized in bottom-right

### 2. User Clicks Header Button
- Modal opens showing quick questions for Finance
- Sees options like "How do I start yield farming?"
- Can click quick action or open full chat

### 3. User Asks Locked Feature Question
- "How do I unlock advanced trading?"
- gatingHandler detects gating question
- Morio responds with persona-specific unlock path
- Tells user exactly what they need (e.g., "Get to Tier 2: Need KES 50,000")

### 4. User Clicks "Open Full Chat"
- Redirects to `/morio-hub`
- Chat persists across pages
- Can continue conversation

---

## Testing Checklist

- [ ] MorioHeaderButton appears in each header
- [ ] Context messages match page type
- [ ] Quick questions are relevant to page
- [ ] Modal opens/closes smoothly
- [ ] Full chat link works
- [ ] MorioFloatingChat appears in bottom-right
- [ ] Messages send to `/api/morio/respond`
- [ ] Chat history persists (localStorage)
- [ ] Unread badge appears when closed
- [ ] Dark mode styling works
- [ ] Mobile responsive (header button stacks properly)
- [ ] Gating questions return persona-specific responses

---

## Known Limitations

1. **Chat persistence**: localStorage limited by browser (usually 5-10MB)
2. **Mobile**: Floating chat might overlap on small screens
3. **Accessibility**: Should add ARIA labels for screen readers
4. **Mobile optimization**: Header button text hidden on small screens

---

## Future Enhancements

- [ ] Morio "favorite" frequent questions
- [ ] Video tutorials linked from quick actions
- [ ] Persona-specific tutorial series
- [ ] Analytics: Track which help topics are most used
- [ ] Contextual tooltips for locked features (e.g., hover on "Unlock")
- [ ] Export chat history
- [ ] Morio suggestions based on user behavior (e.g., "Did you know about...")
