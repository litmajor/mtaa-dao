# Wallet Redesign - Developer Quick Reference

## 🎯 Quick Facts

| Aspect | Details |
|--------|---------|
| **File** | `client/src/pages/wallet.tsx` |
| **Lines Modified** | ~150 lines added/modified |
| **New State Variables** | 4 (settingsOpen, selectedCurrency, requestFundsOpen, userKycStatus) |
| **New Modals** | 1 (RequestFunds) |
| **Breaking Changes** | None |
| **API Changes** | None (all new features are additive) |
| **Styling** | Tailwind CSS (no new CSS files) |
| **Dependencies** | No new npm packages |

---

## 🔧 State Variables Reference

### New States Added

```typescript
// Settings menu toggle
const [settingsOpen, setSettingsOpen] = useState(false);

// Selected currency for display
const [selectedCurrency, setSelectedCurrency] = useState('cUSD');

// Request funds modal toggle
const [requestFundsOpen, setRequestFundsOpen] = useState(false);

// User KYC verification status
const [userKycStatus, setUserKycStatus] = useState<'verified' | 'pending' | 'not-started'>('not-started');
```

### Existing States (Still Used)
```typescript
const [activeTab, setActiveTab] = useState("overview");
const [balanceVisible, setBalanceVisible] = useState(true);
const [depositOpen, setDepositOpen] = useState(false);
const [withdrawOpen, setWithdrawOpen] = useState(false);
const [paymentOpen, setPaymentOpen] = useState(false);
const [vaults, setVaults] = useState<any[]>([]);
// ... and more
```

---

## 🎨 Key UI Components

### 1. Balance Card with Three Buttons
**Location**: Lines 476-539

```tsx
// Main balance display card
<div className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white p-8 rounded-3xl">
  // Balance display with toggle
  // Currency selector dropdown
  // Three action buttons (Add/Withdraw/Request)
</div>
```

**To Modify**:
- Colors: Change the `from-blue-600 via-purple-600 to-pink-600` classes
- Button spacing: Adjust `gap-3` in `grid grid-cols-3 gap-3`
- Border radius: Change `rounded-3xl`

---

### 2. Settings Dropdown Menu
**Location**: Lines 429-468

```tsx
<div className="relative">
  <Button 
    variant="outline" 
    size="icon"
    onClick={() => setSettingsOpen(!settingsOpen)}
  >
    <Settings className="w-4 h-4" />
  </Button>
  
  {settingsOpen && (
    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-50">
      {/* Menu items */}
    </div>
  )}
</div>
```

**To Add Menu Items**:
```tsx
<button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center space-x-2">
  <IconComponent className="w-4 h-4" />
  <span>Menu Item</span>
</button>
```

---

### 3. Token List
**Location**: Lines 524-539

```tsx
<div className="bg-white rounded-2xl shadow-sm border border-gray-100">
  <div className="divide-y">
    {vaults?.map((vault) => (
      <div key={vault.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
        {/* Token icon, name, balance */}
      </div>
    ))}
  </div>
</div>
```

**To Customize**:
- Change list styling: Modify classes on outer div
- Token icon: Update `{vault.currency.substring(0, 1)}`
- Balance calculation: Change `parseFloat(vault.balance.replace(/,/g, ''))`

---

### 4. Features Grid (4 Columns)
**Location**: Lines 625-660

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <div className="bg-white p-6 rounded-xl border border-gray-100 hover:shadow-lg cursor-pointer">
    {/* Feature card content */}
  </div>
</div>
```

**To Add/Remove Features**:
- Add new `<div>` within the grid
- Adjust grid columns: `lg:grid-cols-4` → `lg:grid-cols-5` (etc.)
- Update icon colors

---

### 5. Request Funds Modal
**Location**: Lines 797-824

```tsx
{requestFundsOpen && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
    <CustomCard className="p-8 max-w-md w-full mx-4">
      {/* Form content */}
    </CustomCard>
  </div>
)}
```

**To Extend Modal**:
```tsx
// Add state for form fields
const [requesterName, setRequesterName] = useState('');
const [amountRequested, setAmountRequested] = useState('');

// Add submit handler
const handleGenerateRequest = async () => {
  const request = { requesterName, amountRequested, /*...*/ };
  await apiPost('/api/payment-requests', request);
};
```

---

## 🚀 Common Modifications

### Change Balance Card Color
```tsx
// Current
className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600"

// Alternative: Green theme
className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600"

// Alternative: Orange theme
className="bg-gradient-to-br from-orange-600 via-red-600 to-pink-600"
```

### Add New Feature Card
```tsx
<div className="bg-white p-6 rounded-xl border border-gray-100 hover:shadow-lg transition-all cursor-pointer" onClick={handleNewFeature}>
  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
    <IconName className="w-5 h-5 text-blue-600" />
  </div>
  <h3 className="font-semibold text-gray-900 mb-1">Feature Name</h3>
  <p className="text-sm text-gray-500">Feature description</p>
</div>
```

### Modify Settings Menu Items
```tsx
{settingsOpen && (
  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-50">
    <div className="p-2 space-y-1">
      <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center space-x-2" onClick={handleYourAction}>
        <YourIcon className="w-4 h-4" />
        <span>Your Item</span>
      </button>
    </div>
  </div>
)}
```

### Integrate Real KYC Check
```tsx
useEffect(() => {
  async function checkKycStatus() {
    try {
      const response = await apiGet(`/api/kyc/status/${user?.id}`);
      setUserKycStatus(response.verified ? 'verified' : 'not-started');
    } catch (error) {
      setUserKycStatus('not-started');
    }
  }
  if (user?.id) checkKycStatus();
}, [user?.id]);
```

### Add Currency Conversion
```tsx
const handleCurrencyChange = async (newCurrency) => {
  setSelectedCurrency(newCurrency);
  try {
    const rates = await apiGet(`/api/exchange-rates?from=cUSD&to=${newCurrency}`);
    // Update balance display with conversion
    const convertedBalance = totalBalance * rates[newCurrency];
    // Update display...
  } catch (error) {
    console.error('Currency conversion failed:', error);
  }
};
```

---

## 📋 Testing Checklist

### Manual Testing
- [ ] Balance toggle shows/hides amount
- [ ] Currency dropdown changes value
- [ ] Settings icon toggles dropdown open/closed
- [ ] All three action buttons open correct modals
- [ ] Token list shows all vaults correctly
- [ ] Feature cards are clickable
- [ ] Request Funds modal displays and closes
- [ ] Send Money appears on Transactions tab
- [ ] KYC gate blocks escrow access when not verified
- [ ] Mobile layout stacks correctly

### Automated Testing (Example Jest)
```typescript
describe('EnhancedWalletPage', () => {
  it('should toggle balance visibility', () => {
    render(<EnhancedWalletPage />);
    const toggleBtn = screen.getByRole('button', { name: /eye/i });
    fireEvent.click(toggleBtn);
    expect(screen.getByText('••••••')).toBeInTheDocument();
  });

  it('should display token list', () => {
    render(<EnhancedWalletPage />);
    expect(screen.getByText('Your Assets')).toBeInTheDocument();
  });

  it('should open request funds modal', () => {
    render(<EnhancedWalletPage />);
    const requestBtn = screen.getByText('Request');
    fireEvent.click(requestBtn);
    expect(screen.getByText('Request Funds')).toBeInTheDocument();
  });
});
```

---

## 🔗 API Integration Points

### Endpoints Used
```typescript
// Existing
GET /api/wallet/balance
POST /api/wallet/portfolio
GET /api/wallet/tx-status/:address

// For Future Integration
POST /api/kyc/check        // Check KYC status
POST /api/payment-requests  // Create payment request
GET /api/exchange-rates     // Get currency rates
```

### Example: Adding KYC Integration
```typescript
// Before: hardcoded status
const [userKycStatus, setUserKycStatus] = useState<'verified' | 'pending' | 'not-started'>('not-started');

// After: fetch from API
useEffect(() => {
  async function fetchKycStatus() {
    try {
      const { status } = await apiGet(`/api/kyc/status/${user?.id}`);
      setUserKycStatus(status);
    } catch {
      setUserKycStatus('not-started');
    }
  }
  if (user?.id) fetchKycStatus();
}, [user?.id]);
```

---

## 🎯 Feature Flags (Implementation Ready)

```typescript
// Easy to add feature flags for gradual rollout
const FEATURES = {
  SHOW_REQUEST_FUNDS: true,           // New feature
  REQUIRE_KYC_FOR_ESCROW: true,       // New feature
  SHOW_CURRENCY_SELECTOR: true,       // New feature
  SHOW_SETTINGS_MENU: true,           // New feature
  USE_NEW_BALANCE_DESIGN: true,       // New design
};

// In JSX:
{FEATURES.SHOW_SETTINGS_MENU && <SettingsMenu />}
```

---

## 📊 Styling Reference

### Tailwind Classes Used

| Purpose | Classes |
|---------|---------|
| **Balance Card** | `bg-gradient-to-br`, `from-blue-600`, `via-purple-600`, `to-pink-600`, `text-white`, `p-8`, `rounded-3xl` |
| **Action Buttons** | `bg-white/20`, `hover:bg-white/30`, `border`, `border-white/30`, `text-white` |
| **Feature Cards** | `bg-white`, `p-6`, `rounded-xl`, `border`, `border-gray-100`, `hover:shadow-lg`, `cursor-pointer` |
| **Settings Menu** | `absolute`, `right-0`, `mt-2`, `w-48`, `bg-white`, `rounded-lg`, `shadow-lg`, `z-50` |
| **Token List** | `divide-y`, `p-4`, `hover:bg-gray-50`, `transition-colors` |

---

## 🐛 Debugging Tips

### Settings Menu Not Opening
```typescript
// Check if setSettingsOpen is wired correctly
console.log('Settings open state:', settingsOpen);

// Verify onClick handler
onClick={() => setSettingsOpen(!settingsOpen)}
```

### Token Balance Calculation Off
```typescript
// Debug balance calculation
const totalBalance = vaults?.reduce((sum, vault) => {
  console.log(`Adding vault ${vault.currency}: ${vault.balance}`);
  return sum + parseFloat((vault.balance || '0').replace(/,/g, ''));
}, 0) || 0;
console.log('Total balance:', totalBalance);
```

### Modal Not Closing
```typescript
// Ensure state setter is called
onClick={() => setRequestFundsOpen(false)}

// Check z-index not being overridden
className="fixed inset-0 z-50"
```

---

## 📚 File Navigation

Quick jump to important sections:

```
Lines 1-40:       Imports
Lines 43-65:      Component definition & state variables
Lines 100-215:    Data fetching & handlers
Lines 217-220:    CustomCard utility component
Lines 280+:       Main JSX render
Lines 429-468:    Header with settings icon
Lines 476-539:    Balance card + token list
Lines 625-660:    Features grid
Lines 689-722:    Pay Your Way section
Lines 753-793:    Tabs with Send button
Lines 797-824:    Request Funds modal
Lines 797-900:    All other modals
```

---

## ✅ Deployment Checklist

- [ ] All 8 features implemented
- [ ] No console errors or warnings
- [ ] Responsive design tested on mobile/tablet/desktop
- [ ] All modals close properly
- [ ] Settings menu toggles correctly
- [ ] Token list displays all vaults
- [ ] Balance visibility toggle works
- [ ] KYC gate functional
- [ ] No breaking changes to existing features
- [ ] Documentation updated
- [ ] Code review passed
- [ ] Unit tests written (if applicable)
- [ ] E2E tests passing (if applicable)
- [ ] Performance acceptable (<3s load time)

---

## 📞 Support

### Common Issues & Solutions

**Issue**: Settings dropdown not visible
- **Solution**: Check z-index is `z-50`, not behind other elements

**Issue**: Balance not updating
- **Solution**: Verify `fetchWalletData()` is called in useEffect, check API endpoint

**Issue**: Modals stacking
- **Solution**: Ensure only one `{open && <Modal />}` per modal, use proper z-index layering

**Issue**: Mobile layout broken
- **Solution**: Check responsive classes: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`

---

## 📖 Related Documentation

- Main Documentation: `WALLET_REDESIGN_COMPLETE.md`
- Visual Guide: `WALLET_REDESIGN_VISUAL_GUIDE.md`
- API Docs: `API_REPLACEMENT_SUMMARY.md`
- Auth Docs: `AUTH_INTEGRATION_GUIDE.md`

---

**Last Updated**: January 2024
**Status**: Ready for Development
**Questions?** Check the main documentation files above
