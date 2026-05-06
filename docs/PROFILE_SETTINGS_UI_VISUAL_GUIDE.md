# Profile & Settings UI - Visual Guide 🎨

## Settings Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Settings                                                   │
│  Manage your account and preferences            [Logout]   │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌──────────────┐     ┌──────────────────────────────────┐  │
│  │ Account      │     │                                  │  │
│  │ Appearance   │     │  [Active Section Content]        │  │
│  │ Localization │     │                                  │  │
│  │ Privacy      │     │  (Forms, settings, options)      │  │
│  │ Security     │────▶│                                  │  │
│  │ Notifications│     │  (Responsive grid layout)        │  │
│  │ Trading      │     │                                  │  │
│  │ Accessibility│     │                                  │  │
│  │ API Keys     │     │                                  │  │
│  │ Devices      │     │                                  │  │
│  └──────────────┘     └──────────────────────────────────┘  │
│                                                              │
│  Sidebar Navigation      Main Content Area                  │
│  (GitHub/Binance Style)  (Responsive & Mobile-Friendly)    │
└──────────────────────────────────────────────────────────────┘
```

### Active Section Indicators
```
🟦 Selected = Blue background with white text
⬜ Unselected = Gray text, white background, hover effect
```

---

## Profile Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Profile                                                    │
│  Manage your account and personal information  [Settings]  │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  [Avatar]  John Doe  [Member Badge]                         │
│            john@example.com                                 │
│            📅 Joined December 14, 2023                      │
│            📊 Member for 47 days  ✓ KYC Verified           │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌──────────────┐     ┌──────────────────────────────────┐  │
│  │ Overview     │     │                                  │  │
│  │ KYC          │     │  [Active Section Content]        │  │
│  │ Security     │────▶│                                  │  │
│  │ Activity     │     │  (Stats/Forms/Information)       │  │
│  │ Achievements │     │                                  │  │
│  └──────────────┘     │  (Responsive grid layout)        │  │
│                       │                                  │  │
│  Sidebar Navigation   └──────────────────────────────────┘  │
│  (5 Main Sections)    Main Content Area                     │
│                       (Responsive & Mobile-Friendly)        │
└──────────────────────────────────────────────────────────────┘
```

---

## KYC Verification Status Display

### Verified Status
```
┌─────────────────────────────────────────────┐
│ Verification Status              ✅ Verified │
├─────────────────────────────────────────────┤
│ Risk Level:        🟢 Low Risk              │
│ AML Status:        ✓ Passed                 │
│ Verified on:       Dec 14, 2023             │
└─────────────────────────────────────────────┘

Personal Information:
┌──────────────────────┬──────────────────────┐
│ Full Name            │ John Michael Doe     │
│ Date of Birth        │ January 1, 1995      │
│ Nationality          │ United States        │
│ ID Type              │ Passport             │
└──────────────────────┴──────────────────────┘

Address Information:
┌────────────────────────────────────────────┐
│ Address     | 123 Main St, Apt 4B         │
│ City        | San Francisco               │
│ Postal Code | 94105                       │
└────────────────────────────────────────────┘
```

### Pending Status
```
┌─────────────────────────────────────────────┐
│ Verification Status              ⏳ Pending  │
├─────────────────────────────────────────────┤
│ Risk Level:        🟡 Medium Risk           │
│ AML Status:        ⏳ Pending                │
│                                             │
│ Your KYC is being reviewed. This usually   │
│ takes 24-48 hours. We'll notify you when   │
│ complete!                                   │
└─────────────────────────────────────────────┘
```

### Rejected Status
```
┌─────────────────────────────────────────────┐
│ Verification Status              ❌ Rejected │
├─────────────────────────────────────────────┤
│ Risk Level:        🔴 High Risk             │
│ AML Status:        ✗ Failed                 │
│                                             │
│ Rejection Reason:                           │
│ "Document quality is too low. Please       │
│  resubmit with clearer images."           │
│                                             │
│ [Resubmit] [Contact Support]               │
└─────────────────────────────────────────────┘
```

### Not Started
```
┌─────────────────────────────────────────────┐
│ ⚠️  KYC Not Started                         │
├─────────────────────────────────────────────┤
│                                             │
│ Complete your Know Your Customer (KYC)    │
│ verification to unlock all platform       │
│ features and higher transaction limits.   │
│                                             │
│ [Start KYC Verification]                   │
└─────────────────────────────────────────────┘
```

---

## Overview Section - Stats & Achievements

```
┌──────────────────────┬──────────────────────┐
│ Total Contributions  │ Monthly Contributions │
│                      │                      │
│      $5,234.50       │       $423.00        │
│      All time        │      This month      │
└──────────────────────┴──────────────────────┘

┌──────────────────────┬──────────────────────┐
│ Day Streak           │ Voting Tokens        │
│                      │                      │
│        14 days       │        250 MVT       │
│    Days in a row     │   Available to use   │
└──────────────────────┴──────────────────────┘

How to Earn MsiaMo Points:
┌────────────────────────────────┬──────────┐
│ Active voting                  │   +10    │
│ Referring a new member         │   +25    │
│ Leading a successful proposal  │   +50    │
│ Elder/role participation       │    +5    │
└────────────────────────────────┴──────────┘
```

---

## Security Section

```
Security Settings:
┌────────────────────────────────────────────────┐
│ ┌──┐ Two-Factor Authentication          [Enable] │
│ │  │ Add an extra layer of security          │
│ └──┘                                           │
├────────────────────────────────────────────────┤
│ ┌──┐ Change Password                   [Change] │
│ │  │ Update your password regularly             │
│ └──┘                                           │
├────────────────────────────────────────────────┤
│ ┌──┐ Session Timeout                   [30 min] │
│ │  │ Automatically log out after inactivity   │
│ └──┘                                           │
├────────────────────────────────────────────────┤
│ ┌──┐ IP Whitelist                   [Configure] │
│ │  │ Only allow access from trusted IPs       │
│ └──┘                                           │
└────────────────────────────────────────────────┘

Active Sessions:
┌────────────────────────────────────────────┐
│ Chrome on Windows                [Active]   │
│ Current session                            │
└────────────────────────────────────────────┘
```

---

## Activity Section

```
Recent Activity (Last 10):
┌────────────────────────────────────────────┐
│ 📈 Contributed to General Fund     +$50.00 │
│    December 14, 2024                  USD  │
├────────────────────────────────────────────┤
│ 📈 Contributed to Marketing Fund   +$75.50 │
│    December 13, 2024                  USD  │
├────────────────────────────────────────────┤
│ 📈 Contributed to Development       +$25.00 │
│    December 12, 2024                  USD  │
└────────────────────────────────────────────┘
(Click to see more details)
```

---

## Achievements Section

```
Achievements & Badges:
┌────────────────────────────────────────────┐
│ 👑 Elder Status                       ⭐   │
│    Achieved high contribution ranking      │
├────────────────────────────────────────────┤
│ 📈 Consistent Contributor               ⭐   │
│    14-day contribution streak             │
├────────────────────────────────────────────┤
│ 👥 Community Builder                    ⭐   │
│    Active participant in governance       │
├────────────────────────────────────────────┤
│ 🛡️ Trusted Member                       ⭐   │
│    Completed KYC verification            │
└────────────────────────────────────────────┘
```

---

## Responsive Design Examples

### Mobile (< 768px)
```
Settings/Profile header
[Menu Icon]

Sidebar stacks above:
┌─────────────────┐
│ Account         │
│ Appearance      │
│ Localization    │
│ ...             │
└─────────────────┘

Full-width content:
┌─────────────────┐
│ Content Area    │
│ (Full Width)    │
│                 │
│                 │
└─────────────────┘
```

### Tablet (768px - 1024px)
```
┌──────────────────────────────┐
│ Settings        [Logout] [⚙️]│
├────────────────────────────────┤
│  Sidebar  │   Content Area     │
│  (narrow) │   (wider)          │
│           │                    │
└────────────────────────────────┘
```

### Desktop (> 1024px)
```
Full horizontal layout with proper spacing:
┌────────────────────────────────────────────┐
│ Settings & Profile   [Logout] [⚙️]         │
├────────────────────────────────────────────┤
│  Sidebar   │                               │
│  (sticky)  │     Main Content Area        │
│            │     (Responsive Grid)         │
│            │                               │
│            │  2-4 columns depending on    │
│            │  content type                 │
└────────────────────────────────────────────┘
```

---

## Color Scheme & Status Indicators

### KYC Status Colors
```
🟢 Verified    = Green (RGB: 34, 197, 94)
🟡 Pending     = Yellow (RGB: 234, 179, 8)
🔴 Rejected    = Red (RGB: 239, 68, 68)
⚫ Not Started  = Gray (RGB: 107, 114, 128)
```

### Risk Level Colors
```
🟢 Low Risk    = Green background
🟡 Medium Risk = Yellow background
🔴 High Risk   = Red background
```

### Button States
```
[Primary Button]    = Solid color, active
[Outline Button]    = Border only, secondary
[Destructive]       = Red background
[Secondary]         = Gray background
```

---

## Animation & Transitions

✨ **Smooth Transitions**:
- Sidebar active indicator: 200ms
- Hover effects: 150ms
- Card transitions: 200ms
- Fade in content: 300ms

🎯 **User Feedback**:
- Button press: Visual feedback
- Form validation: Real-time error display
- Loading states: Spinner animation
- Success confirmations: Green checkmark

---

## Accessibility Features

♿ **WCAG Compliant**:
- ✓ Semantic HTML
- ✓ ARIA labels
- ✓ Keyboard navigation
- ✓ Color contrast >= 4.5:1
- ✓ Focus indicators
- ✓ Screen reader support
- ✓ High contrast mode support

---

## Mobile-First Development

📱 **Optimized for all devices**:
- Responsive grid layouts
- Touch-friendly buttons (44px minimum)
- Readable font sizes on small screens
- Proper spacing for mobile interaction
- No horizontal scrolling needed

---

## Files Summary

| File | Lines | Status | Purpose |
|------|-------|--------|---------|
| `client/src/pages/settings.tsx` | 800+ | ✅ Complete | Settings with 10 sections |
| `client/src/pages/profile.tsx` | 550+ | ✅ Complete | Profile with KYC integration |

---

**All pages are fully functional, type-safe, and production-ready!** 🚀
