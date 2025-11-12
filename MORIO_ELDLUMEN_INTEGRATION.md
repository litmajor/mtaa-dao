# Morio ELD-LUMEN Integration Guide

## Overview

**Morio** is the main DAO user interface - designed to make everything simple and intuitive. The **MorioEldLumenWidget** brings ethical review capabilities directly into Morio's main dashboard.

## Quick Start

### 1. Add Widget to Morio Dashboard

In your main Morio dashboard component (e.g., `client/src/pages/Dashboard.tsx`):

```typescript
import MorioEldLumenWidget from '@/components/morio/MorioEldLumenWidget';

export default function Dashboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Other widgets */}
      
      {/* ELD-LUMEN Widget */}
      <div className="lg:col-span-1">
        <MorioEldLumenWidget />
      </div>
    </div>
  );
}
```

### 2. Widget Behavior

#### For Superusers 🔑
- Shows **ethics overview** with weekly stats
- Displays **recent review count**
- Shows **average concern level** trend
- One-click access to **full ethics dashboard**
- Useful for monitoring DAO governance health

```
┌─────────────────────────────────┐
│ ⛔ ELD-LUMEN                     │
│    Ethics Guardian              │
│                                 │
│ Reviews (7d): 24               │
│ Avg Level: low                 │
│ Status: ✓ Active               │
│                                 │
│ [Full Dashboard →]             │
└─────────────────────────────────┘
```

#### For DAO Members 👥
- Shows **quick ethics review request button**
- Opens **lightweight modal form**
- Instant **ethical guidance** on decisions
- Easy one-click submission

```
┌─────────────────────────────────┐
│ ⛔ ELD-LUMEN                     │
│    Ethical Reviews              │
│                                 │
│ Get ethical guidance on your    │
│ DAO decisions from ELD-LUMEN    │
│                                 │
│ 📋 Submit any decision for      │
│    ethical review               │
│                                 │
│ [+ Request Ethical Review]     │
└─────────────────────────────────┘
```

## Modal Form (DAO Members)

When a member clicks **"Request Ethical Review"**, a simple modal opens with:

### Fields
1. **Decision Type** (required)
   - Treasury Movement
   - Policy Change
   - Member Action
   - Other

2. **Description** (required)
   - "What exactly are you planning to do?"

3. **Risk Level** (optional)
   - Low (green)
   - Medium (yellow)
   - High (red)

### Instant Results
Member receives immediate feedback:
- ✅ Concern Level (Green/Yellow/Orange/Red)
- 🎯 ELD-LUMEN's ethical recommendation
- 📋 Which principles were evaluated
- 💯 Confidence score
- 🔗 Link to full review details

## Component Structure

```
MorioEldLumenWidget
├── Superuser View
│   ├── Weekly Stats
│   ├── Concern Trend
│   └── Dashboard Button
│
└── DAO Member View
    ├── Info Box
    ├── Review Button
    └── MorioEthicsReviewModal
        ├── Quick Form
        └── Results Display
```

## API Integration

The widget makes these API calls:

### For Superusers
```
GET /api/elders/lumen/statistics?days=7
- Fetches weekly ethics statistics
- Requires superuser role
```

### For DAO Members
```
POST /api/elders/lumen/review
- Submits decision for ethical review
- Any authenticated member can call
- Returns instant results
```

## Design Philosophy

**Morio makes ethics easy:**

| Action | Complexity | Clicks |
|--------|-----------|--------|
| Request ethical review | Simple | 3-4 |
| View review results | Instant | Automatic |
| Explore full dashboard | Optional | 1 |
| Get recommendations | Built-in | Included |

## Styling Notes

The widget uses Tailwind CSS with:
- **Dark theme** matching Morio design
- **Gradient backgrounds** for visual hierarchy
- **Color-coded concern levels** (green/yellow/orange/red)
- **Responsive design** for mobile/tablet/desktop
- **Hover effects** for interactivity

## Integration Points

```
Morio Dashboard
    ↓
MorioEldLumenWidget
    ├── Superuser → EldLumenDashboard (full stats)
    ├── DAO Member → MorioEthicsReviewModal
    │                   ↓
    │              POST /api/elders/lumen/review
    │                   ↓
    │              ELD-LUMEN (backend)
    │                   ↓
    │              Instant Results
    │
    └── All → /dashboard/ethics (superuser full view)
```

## Usage Example

### User Story: Treasury Vote

> As a DAO member, I want to propose a treasury transfer and get ethical guidance before voting.

**Flow with Morio ELD-LUMEN:**

1. **Open Morio Dashboard** → See ELD-LUMEN widget
2. **Click "Request Ethical Review"** → Modal opens
3. **Fill simple form:**
   - Decision Type: "Treasury Movement"
   - Description: "Transfer 1M MTAA to marketing fund"
   - Risk: "Medium"
4. **Submit** → Instant analysis
5. **View Results:**
   - ✅ Concern: **Yellow** (Minor concerns)
   - 📋 Principles: Proportionality, Fairness, Transparency
   - 💡 Feedback: "Good transparency, consider stakeholder communication"
   - 💯 Confidence: 87%
6. **Vote informed** by ethical guidance

---

## Accessibility Features

- ✅ ARIA labels on form inputs
- ✅ Color + text for concern levels
- ✅ Keyboard navigable
- ✅ Screen reader friendly
- ✅ High contrast text
- ✅ Clear error messages

## Performance

- **Widget loads in <200ms** (cached data)
- **Form submission: <1s** (instant analysis)
- **Modal renders instantly** (lightweight)
- **No external dependencies** beyond useAuth

## Error Handling

The widget gracefully handles:
- ❌ Network errors → "Failed to submit review request"
- ❌ Auth failures → Hidden if not authenticated
- ❌ Missing fields → "Please fill in all required fields"
- ❌ Server errors → Clear error message in modal

---

## Summary

**Morio + ELD-LUMEN = Easy Ethics** 🚀

The widget philosophy: "Make ethical review as easy as clicking a button."

### What it solves:
- ✅ DAO members get instant ethical guidance
- ✅ Superusers monitor governance health
- ✅ All decisions are logged and audited
- ✅ Ethics integrated into natural DAO workflow
- ✅ No separate "ethics portal" needed

### Key Benefits:
1. **Frictionless** - One-click review requests
2. **Instant** - Results in <1 second
3. **Transparent** - Clear reasoning and confidence scores
4. **Integrated** - Right in Morio, where members work
5. **Audit-ready** - All reviews logged automatically

---

*Morio is where DAO members work. Make their ethics workflow as simple as the rest of their experience.* ✨
