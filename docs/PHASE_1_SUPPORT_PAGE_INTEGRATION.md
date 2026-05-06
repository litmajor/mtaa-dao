# Phase 1 Feature Integration Map

## Support Page Layout & Integration Points

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SUPPORT PAGE (/support)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  📦 NOTIFICATION SYSTEM (NEW - Top Right Corner)                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Notification Toast Container (useMorioNotifications hook)            │  │
│  │ • Displays in fixed top-right position                              │  │
│  │ • Priority-colored toasts (high=red, medium=blue, low=green)        │  │
│  │ • Auto-dismisses after 5 seconds                                    │  │
│  │ • Shows: Proposal alerts, voting updates, treasury milestones       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ SUPPORT CENTER - Header                                              │   │
│  │ "Get help from our team or chat with Morio AI for instant answers"  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌───────────────────────┬──────────────────────┬───────────────────────┐  │
│  │ 💬 CHAT WITH MORIO AI │  ✉️ EMAIL SUPPORT   │  📱 WHATSAPP SUPPORT  │  │
│  │ (Enhanced)            │  24-48 hours        │  Mon-Fri 8AM-6PM      │  │
│  │                       │                      │                       │  │
│  │ • Session Persist     │ • Standard response  │ • Quick questions     │  │
│  │ • See previous chat   │ • support@mtaa.com   │ • +254 XXX XXXXXX     │  │
│  │ • Swahili support     │                      │                       │  │
│  │ • [Start Chat Button] │                      │                       │  │
│  └───────────────────────┴──────────────────────┴───────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ⏱️ EXPECTED RESPONSE TIMES                                             │   │
│  │ [Free] 3-5 days | [Short-Term] 2-3 days | [Collective] 24-48hrs    │   │
│  │ [MetaDAO] <24 hours                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📋 SUBMIT A SUPPORT TICKET                                            │   │
│  │ ┌─────────────────────┬─────────────────────────────────────────┐   │   │
│  │ │ Name                │ Email                                   │   │   │
│  │ └─────────────────────┴─────────────────────────────────────────┘   │   │
│  │ ┌─────────────────────┬─────────────────────────────────────────┐   │   │
│  │ │ Category            │ Priority                                │   │   │
│  │ │ • General           │ • Low, Normal, High, Urgent            │   │   │
│  │ │ • Technical         │                                         │   │   │
│  │ │ • Billing           │                                         │   │   │
│  │ │ • Account           │                                         │   │   │
│  │ │ • DAO Management    │                                         │   │   │
│  │ │ • Security          │                                         │   │   │
│  │ └─────────────────────┴─────────────────────────────────────────┘   │   │
│  │ Subject: ________________________________________________________________  │   │
│  │ Message: ________________________________________________________________  │   │
│  │          ________________________________________________________________  │   │
│  │          ________________________________________________________________  │   │
│  │ [Submit Ticket Button]                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ MORIO CHAT MODAL (When "Start Chat" is clicked)                    │   │
│  │ ┌───────────────────────────────────────────────────────────────┐  │   │
│  │ │ Chat with Morio AI                                     [✕]    │  │   │
│  │ ├───────────────────────────────────────────────────────────────┤  │   │
│  │ │                                                               │  │   │
│  │ │  Morio: Habari! Welcome back. Last time we talked about...   │  │   │
│  │ │  (Previous messages from localStorage - SESSION PERSIST)      │  │   │
│  │ │                                                               │  │   │
│  │ │  You: How do I create a proposal?                            │  │   │
│  │ │  Morio: Asante! Let me help...                               │  │   │
│  │ │  (Swahili responses available - SWAHILI ENHANCEMENT)          │  │   │
│  │ │                                                               │  │   │
│  │ │  [Type message...]  [Send →]                                 │  │   │
│  │ │                                                               │  │   │
│  │ └───────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1 Integration Points on Support Page

### 1. **Notification Toast Container** (Top-Right Corner)
**What Shows:** 
- Proposal expiring alerts
- New voting notifications
- Treasury milestones
- High contribution alerts
- Event reminders
- Vault opportunities

**When It Appears:**
- Always polling in background (30-second intervals)
- Toast appears when new notification arrives
- Auto-dismisses after 5 seconds
- User can manually close

**Location in Code:**
```tsx
// In support.tsx, add at top level:
import { useMorioNotifications } from '@/hooks/useMorioNotifications';
import { NotificationContainer } from '@/components/morio/NotificationToast';

export default function SupportPage() {
  const { user } = useAuth();
  const { notifications, dismiss } = useMorioNotifications(user?.id || '');
  
  return (
    <>
      {/* Notification container shows above all content */}
      <NotificationContainer 
        notifications={notifications} 
        onDismiss={dismiss}
      />
      
      {/* Rest of support page... */}
    </>
  );
}
```

---

### 2. **Chat with Morio AI Section** (3-Column Grid)
**Enhanced Features:**
- ✅ **Session Persistence**: Users see previous chat history
- ✅ **Swahili Support**: Full Swahili responses available
- ✅ **Smart Continuation**: "Welcome back! Last time we talked about..."

**Current Code:**
```tsx
<Card>
  <CardHeader>
    <MessageCircle className="w-8 h-8 mb-2 text-purple-600" />
    <CardTitle>Chat with Morio AI</CardTitle>
    <CardDescription>Instant answers 24/7</CardDescription>
  </CardHeader>
  <CardContent>
    <Button
      onClick={() => setShowMorio(true)}
      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600"
    >
      <Sparkles className="w-4 h-4 mr-2" />
      Start Chat
    </Button>
  </CardContent>
</Card>
```

**Enhanced (Added Features):**
```tsx
<Card>
  <CardHeader>
    <MessageCircle className="w-8 h-8 mb-2 text-purple-600" />
    <CardTitle>Chat with Morio AI</CardTitle>
    <CardDescription>
      Instant answers 24/7 • Swahili supported • 💾 Sessions persist
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-3">
    <p className="text-sm text-gray-600 dark:text-gray-400">
      ✨ Your conversation history is saved automatically
    </p>
    <Button
      onClick={() => setShowMorio(true)}
      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600"
    >
      <Sparkles className="w-4 h-4 mr-2" />
      Start Chat
    </Button>
  </CardContent>
</Card>
```

---

### 3. **Morio Chat Modal** (When "Start Chat" Button Clicked)
**Already Exists:** Yes ✅
**Enhancement:** Now includes session persistence and Swahili

**Current:**
```tsx
{showMorio && user && (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-xl font-bold">Chat with Morio AI</h2>
        <Button variant="ghost" onClick={() => setShowMorio(false)}>✕</Button>
      </div>
      <div className="h-[600px]">
        <MorioChat userId={user.id.toString()} />
      </div>
    </div>
  </div>
)}
```

**What Changed in MorioChat Component:**
- Added `useMorioSessionStorage` hook → loads previous messages
- Added `useMorioNotifications` hook → can receive notifications while chatting
- Enhanced with Swahili responses → `swahili_responses.ts`

---

## Visual Flow: Where Each Feature Shows

### Flow 1: User Visits Support Page
```
1. Page loads
2. Notifications hook starts polling (every 30 seconds)
3. If user has unread notifications → Toast appears top-right
4. MorioChat card visible with "Start Chat" button
```

### Flow 2: User Clicks "Start Chat"
```
1. Modal opens with MorioChat component
2. Component mounts
3. useMorioSessionStorage loads previous messages from localStorage
4. User sees conversation history immediately
5. Can continue chatting (messages auto-save)
6. Notifications continue polling in background
```

### Flow 3: Notification Arrives While User is Chatting
```
1. Backend triggers notification (e.g., proposal expiring)
2. Notification fetched by 30-second polling
3. Toast appears in top-right of modal
4. User can dismiss or let it auto-dismiss
5. Chat continues uninterrupted
```

### Flow 4: User Changes Language to Swahili
```
1. User preference saved as "sw" or "Swahili"
2. User sends message: "Habari, angalia hazina"
3. ResponseGenerator uses swahili_responses.ts
4. Response appears in natural Swahili
5. Message saved to localStorage with timestamp
```

---

## Integration Checklist for Support Page

- [x] Import `useMorioNotifications` hook
- [x] Import `NotificationContainer` component
- [x] Add notification display to top level
- [x] Optional: Update card description to highlight features
- [x] Test session persistence in modal
- [x] Test Swahili input in modal
- [x] Test notifications while modal is open
- [x] Verify notifications don't block chat
- [x] Mobile responsive testing
- [x] Dark mode compatibility

---

## Where Else Notifications Will Show

**Not Just on Support Page:**

### 1. **Morio Hub Page** (/morio)
```
Primary location for notifications
Full-featured notification panel
```

### 2. **Dashboard** (if integrated)
```
Notification bell icon in header
Shows unread count badge
```

### 3. **Mobile Nav**
```
Notification badge on Morio link
Quick access to new alerts
```

### 4. **Any Page with MorioChat**
```
All notifications visible globally
Toast appears wherever user is
```

---

## Summary: Support Page Integration

**Current State:**
- ✅ Support page exists with email/WhatsApp/Morio chat
- ✅ Morio chat in modal already implemented
- ✅ Pre-populated form for tickets

**After Phase 1 Implementation:**
- ✅ **Notifications** - Toast alerts in top-right
- ✅ **Session Persistence** - Chat history remembered across visits
- ✅ **Swahili Support** - Full translations available in chat
- ✅ **Seamless UX** - Everything works together smoothly

**No Breaking Changes:**
- Support page works exactly as before
- New features are additive
- Can be disabled via feature flags
- Backward compatible with old browsers

---

## Code Implementation (Quick Reference)

To enable Phase 1 features on support page:

```tsx
import { useMorioNotifications } from '@/hooks/useMorioNotifications';
import { NotificationContainer } from '@/components/morio/NotificationToast';

export default function SupportPage() {
  const { user } = useAuth();
  const { notifications, dismiss } = useMorioNotifications(user?.id || '');
  const [showMorio, setShowMorio] = useState(false);
  
  // ... rest of component

  return (
    <>
      {/* NEW: Notification toasts appear here */}
      <NotificationContainer 
        notifications={notifications} 
        onDismiss={dismiss}
      />
      
      {/* Existing support page content */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* ... */}
      </div>
    </>
  );
}
```

That's it! Notifications are automatically displayed anywhere on the page.
