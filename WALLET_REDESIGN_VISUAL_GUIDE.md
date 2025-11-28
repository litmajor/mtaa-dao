# Wallet Redesign - Visual & UX Guide

## 🎨 Design Philosophy

The redesigned wallet follows Trust Wallet's proven UX patterns while maintaining brand consistency and adding powerful features for emerging markets (peer-to-peer escrow, social payments, DeFi).

---

## 📐 Layout Structure

### Header Section
```
┌─────────────────────────────────────────────────────────────────────┐
│ [Wallet Icon] Personal Wallet    [Community] [DeFi Portfolio]       │
│ Secure digital asset management  [🔒 Secured]  [⚙️ Settings ▼]     │
└─────────────────────────────────────────────────────────────────────┘
```

**Components**:
- Left: Logo + title + navigation breadcrumbs
- Right: Security badge + settings dropdown menu

---

### Balance Card (Trust Wallet Style)
```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  Total Balance      [👁️]     [USD ▼]                                 │
│                                                                      │
│  $15,234.56                                                          │
│  Across all tokens                                                   │
│                                                                      │
│  ┌──────────────────┬──────────────────┬──────────────────┐         │
│  │ ➕ Add Funds     │ 🔼 Withdraw     │ ⬇️ Request       │         │
│  └──────────────────┴──────────────────┴──────────────────┘         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

Color: Blue → Purple → Pink gradient
Text: White
Style: Rounded corners with subtle glass effect
```

---

### Token List (New)
```
┌──────────────────────────────────────────────────────────────────────┐
│ Your Assets                                                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [U] cUSD                            $10,234.56                      │
│      Personal                        +2.5%                           │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  [C] CELO                             $3,000.00                      │
│      Token                            +1.2%                          │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  [E] cEUR                             $2,000.00                      │
│      Token                            -0.5%                          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

Layout: Vertical list with hover effect
Spacing: 4px padding between items
Divider: Subtle gray line between tokens
Icons: Circular gradient badges with currency initials
```

---

### Features & Services Grid
```
┌─────────────────────────────────────────────────────────────────┐
│ Features & Services                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 🔄 Swap      │  │ 📈 Stake     │  │ 🛡️ Vaults   │          │
│  │ Tokens       │  │ & Earn       │  │ Secure       │          │
│  │ Exchange     │  │ Earn rewards │  │ savings     │          │
│  │ instantly    │  │ from assets  │  │ with vaults │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌──────────────┐                                              │
│  │ 📤 Peer      │                                              │
│  │ Escrow       │                                              │
│  │ Safe         │                                              │
│  │ transfers    │                                              │
│  └──────────────┘                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Grid: 4 columns (desktop), 2 columns (tablet), 1 column (mobile)
Card Style: White with subtle shadow, hover lift effect
Icons: Colored backgrounds (blue, green, purple, orange)
```

---

### Pay Your Way Section
```
┌─────────────────────────────────────────────────────────────────┐
│ Pay Your Way                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ 👤 Pay by    │  │ 👥 Split     │  │ 🔲 Request  │         │
│  │ Phone        │  │ Bill         │  │ Payment     │         │
│  │ Send money   │  │ Share        │  │ Ask others  │         │
│  │ using phone  │  │ expenses     │  │ to send     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Grid: 3 columns (desktop), 2 columns (tablet), 1 column (mobile)
Similar card styling to Features grid
```

---

## 🎯 Settings Dropdown Menu

```
┌────────────────────────────┐
│ [⚙️] (in top-right)        │
│      │                     │
│      ▼                     │
│  ┌──────────────────────┐  │
│  │ 🔄 Refresh           │  │
│  │ ⬇️ Backup Wallet      │  │
│  │ 🔁 Recurring Payments│  │
│  ├──────────────────────┤  │
│  │ 🚪 Disconnect        │  │ (Red text)
│  └──────────────────────┘  │
└────────────────────────────┘

Position: Absolute, top-right of page
Background: White with shadow
Border: Subtle gray
Hover: Light gray background
```

---

## 🔐 KYC Gate Example

### Before KYC Verification
```
┌──────────────────┐
│ 📤 Peer Escrow   │
│ Safe transfers   │
│ with escrow      │
│                  │
│ ⚠️ KYC required  │
│ to access        │
└──────────────────┘
```

### After KYC Verification
```
┌──────────────────┐
│ 📤 Peer Escrow   │
│ Safe transfers   │
│ with escrow      │
│                  │
│ [Start Escrow ➜] │
└──────────────────┘
```

---

## 💬 Modals

### Add Funds Modal
```
┌────────────────────────────────────────┐
│ ✕                                      │
│ ┌─────────────────────────────────────┐│
│ │ ➕ Add Funds                        ││
│ └─────────────────────────────────────┘│
│                                        │
│ Recipient Address                      │
│ [________________________]              │
│                                        │
│ Amount                                 │
│ [________________________]              │
│                                        │
│ ┌──────────────┐ ┌──────────────┐    │
│ │ Deposit      │ │ Close        │    │
│ └──────────────┘ └──────────────┘    │
│                                        │
└────────────────────────────────────────┘
```

### Withdraw Modal
```
Similar layout with:
- Orange/red icon
- "Withdraw Funds" title
- Amount and recipient fields
- "Withdraw" button
```

### Request Funds Modal (NEW)
```
┌────────────────────────────────────────┐
│ ✕                                      │
│ ┌─────────────────────────────────────┐│
│ │ ⬇️ Request Funds                    ││
│ │ Create a payment request and share  ││
│ └─────────────────────────────────────┘│
│                                        │
│ Requester Name                         │
│ [________________________]              │
│                                        │
│ Amount Requested                       │
│ [________________________]              │
│                                        │
│ Currency                               │
│ [▼ cUSD        ]                       │
│                                        │
│ Message (optional)                     │
│ [_______________________________]       │
│ [_______________________________]       │
│                                        │
│ ┌──────────────────┐ ┌──────────────┐│
│ │ Generate Request │ │ Close        ││
│ └──────────────────┘ └──────────────┘│
│                                        │
└────────────────────────────────────────┘
```

---

## 📊 Transactions Tab

```
┌──────────────────────────────────────────────────────┐
│ Overview │ Transactions │ Recurring │ Vouchers      │
├──────────────────────────────────────────────────────┤
│ Transaction History        [Send Money ➜]           │
│                                                      │
│ ✓ Received $100 from John      2 hours ago         │
│ → Sent $50 to Jane             5 hours ago         │
│ ✓ Received $200 from Store     Yesterday           │
│ → Swapped 10 CELO for cUSD     3 days ago          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 🎨 Color Scheme

| Element | Color | Hex |
|---------|-------|-----|
| Balance Card Background | Gradient Blue-Purple-Pink | #2563EB → #9333EA → #EC4899 |
| Add Funds Button | White/20 | rgba(255, 255, 255, 0.2) |
| Features Grid - Swap | Blue Icon | #2563EB |
| Features Grid - Stake | Green Icon | #059669 |
| Features Grid - Vaults | Purple Icon | #7C3AED |
| Features Grid - Escrow | Orange Icon | #EA580C |
| KYC Warning Text | Yellow | #B45309 |
| Disconnect Button | Red | #DC2626 |
| Border Color | Light Gray | #E5E7EB |
| Hover Background | Very Light Gray | #F9FAFB |

---

## ✨ Interactive States

### Button Hover
```
Default: bg-white/20
Hover:   bg-white/30 (increased opacity)
Active:  scale-95 (slight press effect)
```

### Card Hover (Features/Pay Your Way)
```
Default: border-gray-100, shadow-sm
Hover:   shadow-lg (increased shadow), scale-[1.02] (slight zoom)
```

### Settings Dropdown
```
Default: Closed, Settings icon visible
Open:    Dropdown menu appears with 4px top margin
Click Outside: Closes automatically
```

---

## 📱 Responsive Breakpoints

### Mobile (< 768px)
```
┌─────────────────────┐
│ [Wallet] Title  [⚙️]│
├─────────────────────┤
│ Balance Card        │
│ [Add] [Withdraw]    │
│ [Request]           │
├─────────────────────┤
│ Your Assets         │
│ Token 1 - $$$       │
│ Token 2 - $$$       │
├─────────────────────┤
│ Features            │
│ [Card]              │
│ [Card]              │
│ [Card]              │
│ [Card]              │
└─────────────────────┘
```

### Tablet (768px - 1024px)
```
┌──────────────────────────────────┐
│ [Wallet] Title    [⚙️] [🔒 Sec]  │
├──────────────────────────────────┤
│ Balance Card                     │
│ [Add] [Withdraw] [Request]       │
├──────────────────────────────────┤
│ Your Assets (list format)        │
├──────────────────────────────────┤
│ Features (2 columns)             │
│ [Card] [Card]                    │
│ [Card] [Card]                    │
└──────────────────────────────────┘
```

### Desktop (> 1024px)
Full layout as shown above with all 4 feature columns

---

## 🔄 User Flows

### Flow 1: Send Money
```
1. View Wallet Page
   ↓
2. Click "Send Money" button
   - From balance action bar, OR
   - From Transactions tab
   ↓
3. Modal opens with form
   ↓
4. Enter recipient & amount
   ↓
5. Confirm and send
```

### Flow 2: Request Funds
```
1. View Wallet Page
   ↓
2. Click "Request" button in action bar
   ↓
3. Request Funds modal opens
   ↓
4. Fill requester name, amount, currency, message
   ↓
5. Click "Generate Request"
   ↓
6. Get shareable link
   ↓
7. Share with others
```

### Flow 3: Use Escrow (Locked)
```
1. View Wallet Page
   ↓
2. See "Peer Escrow" card
   ↓
3. Check KYC status
   ↓
4. If not verified:
   - See "⚠️ KYC required to access" message
   ↓
5. If verified:
   - Click "Start Escrow" button
   - EscrowInitiator component loads
```

---

## 🔧 Component Dependencies

```
EnhancedWalletPage
├── Header (Settings Dropdown)
├── Balance Card
│   ├── Currency Selector
│   ├── Three Action Buttons (Add/Withdraw/Request)
│   └── Visibility Toggle
├── Token List
│   └── Vault Items (from vaults array)
├── Features Grid
│   ├── Swap Card
│   ├── Stake Card
│   ├── Vaults Card
│   └── Escrow Card (with KYC gate)
├── Pay Your Way Grid
│   ├── Pay by Phone Card
│   ├── Split Bill Card
│   └── Request Payment Card
├── Tabs
│   ├── Overview Tab
│   ├── Transactions Tab (with Send button)
│   ├── Recurring Tab
│   └── Vouchers Tab
├── Modals
│   ├── Add Funds Modal
│   ├── Withdraw Modal
│   ├── Request Funds Modal (NEW)
│   ├── Payment Request Modal
│   ├── Phone Payment Modal
│   ├── Split Bill Modal
│   ├── Payment Link Modal
│   ├── Backup Wallet Modal
│   ├── Token Swap Modal
│   └── Staking Modal
└── Exchange Rate Widget
```

---

## 📊 Information Hierarchy

1. **Primary**: Aggregated balance (large, centered, prominent)
2. **Secondary**: Action buttons (3 equal prominence buttons)
3. **Tertiary**: Individual token balances (list format)
4. **Quaternary**: Feature cards (grid layout)
5. **Quinary**: Settings & advanced options (dropdown menu)

---

## ♿ Accessibility

- ✅ Color contrast ratios meet WCAG AA standards
- ✅ Icons paired with text labels
- ✅ Keyboard navigation supported
- ✅ Screen reader friendly (semantic HTML)
- ✅ Focus indicators visible on interactive elements
- ✅ Modal dialogs marked with role="dialog"

---

## 🚀 Performance Considerations

- Settings dropdown only rendered when open (conditional rendering)
- Token list virtualizes for large numbers of tokens (future optimization)
- Images lazy-loaded
- CSS classes minified in production
- Component memoization for expensive renders

---

**Design Authority**: Trust Wallet UX + Modern Mobile Wallets
**Last Updated**: January 2024
**Status**: Ready for Implementation
