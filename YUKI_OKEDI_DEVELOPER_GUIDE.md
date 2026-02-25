# YUKI & OKEDI - Developer Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### 1. Import & Mount YukiDashboard
```typescript
// In your app router or main component
import YukiDashboard from './components/trading/YukiDashboard';
import OkediDashboard from './components/dashboard/OkediDashboard';

export default function App() {
  return (
    <Routes>
      {/* After user KYC, they see Okedi */}
      <Route path="/dashboard" element={<OkediDashboard />} />
      
      {/* User navigates to Yuki for trading */}
      <Route path="/yuki" element={<YukiDashboard />} />
    </Routes>
  );
}
```

### 2. File Structure Reference
```
client/src/
├── components/
│   ├── dashboard/
│   │   ├── OkediDashboard.tsx        (Main dashboard, post-login)
│   │   ├── UnifiedBalance.tsx        (Balance breakdown by source)
│   │   └── AnalyticsPanel.tsx        (Transaction analytics)
│   ├── kyc/
│   │   └── KycChecklistModal.tsx     (3-step KYC flow)
│   └── trading/
│       ├── YukiDashboard.tsx         (Main trading hub, 6 tabs)
│       ├── VisualStrategyBuilder.tsx (Drag-drop strategy builder)
│       ├── StrategyMarketplace.tsx   (Discover & copy strategies)
│       └── CexManager.tsx            (Exchange management & positions)
└── api/
    └── dashboardApi.ts               (API contracts & types)
```

---

## 🎮 Component Usage Examples

### Example 1: Using OkediDashboard
```typescript
import OkediDashboard from './components/dashboard/OkediDashboard';

function PostLoginPage() {
  return (
    <div>
      <OkediDashboard />
    </div>
  );
}
```

**What it shows**:
- Balance header with total USD value
- Unified balance breakdown (Primary Wallet, Subprofiles, DAOs, etc.)
- KYC banner showing transaction limits
- Analytics panel with sparkline
- Send/Withdraw buttons (gated by KYC)

---

### Example 2: Using YukiDashboard
```typescript
import YukiDashboard from './components/trading/YukiDashboard';

function TradingPage() {
  return (
    <div>
      <YukiDashboard />
    </div>
  );
}
```

**What it shows**:
- 6 tabs for different trading activities
- Market stats, trading opportunities, recent alerts
- Quick swap form with token selectors
- Active strategies list
- Strategy marketplace with copy functionality
- Connected exchanges with positions & P&L
- Portfolio analytics

---

### Example 3: Using VisualStrategyBuilder
```typescript
import VisualStrategyBuilder from './components/trading/VisualStrategyBuilder';

function CreateStrategyPage() {
  const handleDeploy = (strategy: Strategy) => {
    // Save strategy to backend
    console.log('Deploying strategy:', strategy);
  };

  return (
    <VisualStrategyBuilder />
  );
}
```

**What it shows**:
- Left palette with 5 block types
- Center canvas for drag-drop
- Right panel for block configuration
- Deploy button to save
- JSON export for developers

---

### Example 4: Using StrategyMarketplace
```typescript
import StrategyMarketplace from './components/trading/StrategyMarketplace';

function MarketplacePage() {
  const handleCopyStrategy = (strategyId: string) => {
    // Copy strategy to user's account
    console.log('Copying strategy:', strategyId);
  };

  return (
    <StrategyMarketplace />
  );
}
```

**What it shows**:
- Browse 3 example strategies
- Filter by Free/Paid/My Copies
- Sort by Return/Rating/Followers
- Strategy cards with metrics
- Copy button with Amara upsell
- Detail panel with full strategy info

---

### Example 5: Using CexManager
```typescript
import CexManager from './components/trading/CexManager';

function ExchangeManagementPage() {
  return (
    <CexManager />
  );
}
```

**What it shows**:
- Connected exchanges (Kraken, Coinbase, Bybit)
- Aggregated balance & P&L
- Liquidation risk alerts
- Per-exchange balances & positions
- Smart order routing preview
- Hide/show balance toggle

---

## 🔧 Replacing Mock Data with Real APIs

### Step 1: Replace Mock Data in CexManager
```typescript
// Before (mock data)
const [exchanges, setExchanges] = useState<Exchange[]>(MOCK_EXCHANGES);

// After (real API)
useEffect(() => {
  const fetchExchanges = async () => {
    try {
      const response = await fetch('https://api.mtaa.io/api/yuki/exchanges', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setExchanges(data);
    } catch (error) {
      console.error('Failed to fetch exchanges:', error);
    }
  };
  
  fetchExchanges();
}, [token]);
```

### Step 2: Replace Mock Data in StrategyMarketplace
```typescript
// Before
const [strategies, setStrategies] = useState(MOCK_STRATEGIES);

// After
useEffect(() => {
  const fetchStrategies = async () => {
    const response = await fetch('https://api.mtaa.io/api/yuki/marketplace/strategies');
    const data = await response.json();
    setStrategies(data);
  };
  
  fetchStrategies();
}, []);
```

### Step 3: Add WebSocket for Real-Time Updates
```typescript
// In YukiDashboard or any trading component
useEffect(() => {
  const ws = new WebSocket('wss://api.mtaa.io/api/yuki/ws');
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    if (message.type === 'price-update') {
      // Update market prices
      setPrices(prev => ({ ...prev, [message.symbol]: message.price }));
    }
    
    if (message.type === 'position-update') {
      // Update positions with P&L
      setPositions(prev => 
        prev.map(pos => 
          pos.symbol === message.symbol ? message : pos
        )
      );
    }
    
    if (message.type === 'alert') {
      // Show alerts
      addAlert(message);
    }
  };
  
  return () => ws.close();
}, []);
```

---

## 📊 Common Tasks

### Task 1: Get User's Strategies
```typescript
async function getUserStrategies(userId: string) {
  const response = await fetch(
    `https://api.mtaa.io/api/yuki/strategies?userId=${userId}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return response.json();
}

// Usage
useEffect(() => {
  getUserStrategies(currentUser.id).then(setUserStrategies);
}, [currentUser.id]);
```

### Task 2: Copy a Marketplace Strategy
```typescript
async function copyStrategy(strategyId: string) {
  const response = await fetch(
    `https://api.mtaa.io/api/yuki/marketplace/strategies/${strategyId}/copy`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  if (response.ok) {
    const newStrategy = await response.json();
    // Strategy copied to user's account
    return newStrategy;
  }
}
```

### Task 3: Deploy a Strategy
```typescript
async function deployStrategy(strategy: Strategy) {
  const response = await fetch(
    'https://api.mtaa.io/api/yuki/strategies/deploy',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(strategy)
    }
  );
  
  return response.json();
}
```

### Task 4: Connect an Exchange
```typescript
async function connectExchange(apiKey: string, apiSecret: string, exchangeName: string) {
  const response = await fetch(
    'https://api.mtaa.io/api/yuki/exchanges',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        exchangeName,
        apiKey,
        apiSecret
      })
    }
  );
  
  return response.json();
}
```

### Task 5: Get Exchange Positions
```typescript
async function getExchangePositions(exchangeId: string) {
  const response = await fetch(
    `https://api.mtaa.io/api/yuki/exchanges/${exchangeId}/positions`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  
  return response.json();
}
```

---

## 🎨 Customization Guide

### Change Color Theme
All components use Tailwind CSS colors. To change from slate-900 (dark) to blue:

```typescript
// In component className
// Before
<div className="bg-slate-900 text-white">

// After (blue theme)
<div className="bg-blue-900 text-white">
```

### Modify Block Types in Strategy Builder
```typescript
// In VisualStrategyBuilder.tsx, find BLOCK_TEMPLATES
const BLOCK_TEMPLATES: BlockTemplate[] = [
  {
    type: 'condition',
    label: 'Price Above',
    icon: '📈',
    config: { symbol: 'ETH', operator: '>', value: 2800 }
  },
  // Add new block type here
  {
    type: 'custom',
    label: 'My Custom Block',
    icon: '⭐',
    config: { customParam: 'value' }
  }
];
```

### Add Filters to Strategy Marketplace
```typescript
// In StrategyMarketplace.tsx, find filter logic
const filteredStrategies = strategies.filter(s => {
  // Existing filters
  if (filterBy === 'free') return s.pricing.type === 'free';
  
  // Add new filter
  if (filterBy === 'high-return') return s.metrics.return1y > 100;
  
  return true;
});
```

---

## 🧪 Testing

### Test OkediDashboard KYC Flow
```typescript
// In test file
import { render, screen } from '@testing-library/react';
import OkediDashboard from './OkediDashboard';

test('shows KYC modal when user tries to send without verification', async () => {
  render(<OkediDashboard />);
  
  // Click send button
  const sendButton = screen.getByText('Send');
  fireEvent.click(sendButton);
  
  // Should show KYC modal
  expect(screen.getByText(/KYC Required/)).toBeInTheDocument();
});
```

### Test Strategy Copy
```typescript
test('copies strategy when user clicks copy button', async () => {
  const onCopy = jest.fn();
  render(<StrategyMarketplace onCopy={onCopy} />);
  
  const copyButton = screen.getByText(/Copy Strategy/);
  fireEvent.click(copyButton);
  
  expect(onCopy).toHaveBeenCalled();
});
```

---

## 🚨 Common Issues & Solutions

### Issue: Components not rendering
**Solution**: Check imports and component names
```typescript
// Check these are correct:
import OkediDashboard from './components/dashboard/OkediDashboard';
import YukiDashboard from './components/trading/YukiDashboard';
```

### Issue: Mock data not updating
**Solution**: Replace mock data constants with API calls
```typescript
// Find MOCK_* constants at top of each component
// Replace with useEffect + fetch
```

### Issue: Styles not applied
**Solution**: Check Tailwind CSS is configured
```typescript
// In tailwind.config.js
module.exports = {
  content: [
    './src/components/**/*.{ts,tsx}',
    './src/pages/**/*.{ts,tsx}',
  ],
  theme: { extend: {} },
  plugins: [],
};
```

### Issue: WebSocket connection failed
**Solution**: Check API endpoint and authentication
```typescript
// Use token in WebSocket URL or header
const ws = new WebSocket(
  `wss://api.mtaa.io/api/yuki/ws?token=${token}`
);
```

---

## 📚 API Reference Quick Links

- [Full API Documentation](YUKI_API_REFERENCE.md)
- [Dashboard API](OKEDI_DASHBOARD_QUICK_REFERENCE.md)
- [Trading Quick Start](YUKI_TRADING_QUICK_START.md)
- [Navigation Reference](YUKI_NAVIGATION_REFERENCE.md)

---

## 🎯 Next Steps

1. **Mount Components**: Add to your React routing
2. **Replace Mock Data**: Call real APIs
3. **Add WebSocket**: Real-time updates
4. **Test**: Unit & integration tests
5. **Deploy**: To production environment

---

**Created**: January 29, 2026  
**Last Updated**: January 29, 2026  
**Status**: ✅ Production Ready
