/**
 * VAULT & STAKING COMPONENTS - INTEGRATION GUIDE
 * 
 * Step-by-step instructions for integrating the new components
 * into your React application
 */

# Component Integration Guide

## Step 1: Import Components into Main App Router

**File**: `client/src/App.tsx` or `client/src/routes.tsx`

```typescript
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Import vault components
import VaultListPage from './components/vaults/VaultListPage';
import VaultDetailPage from './components/vaults/VaultDetailPage';
import MyVaultsPage from './components/vaults/MyVaultsPage';

// Import staking component
import StakingComponent from './components/staking/StakingComponent';

// Import existing components
import YukiDashboard from './components/trading/YukiDashboard';
import StrategyMarketplace from './components/trading/StrategyMarketplace';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Trading Routes */}
        <Route path="/yuki" element={<YukiDashboard />} />
        <Route path="/marketplace" element={<StrategyMarketplace />} />

        {/* Vault Routes */}
        <Route path="/vaults" element={<VaultListPage />} />
        <Route path="/vaults/:vaultId" element={<VaultDetailPage />} />
        <Route path="/my-vaults" element={<MyVaultsPage />} />

        {/* Staking Routes */}
        <Route path="/staking" element={<StakingComponent />} />

        {/* Default redirect */}
        <Route path="/" element={<VaultListPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## Step 2: Create Navigation Menu

**File**: `client/src/components/Navigation.tsx`

```typescript
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wallet, TrendingUp, Gift, BarChart3 } from 'lucide-react';

export default function Navigation() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <nav className="bg-slate-800 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="text-2xl font-bold text-blue-400">
            🚀 MTAA DAO
          </Link>

          {/* Navigation Links */}
          <div className="flex gap-8">
            <Link
              to="/vaults"
              className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
                isActive('/vaults')
                  ? 'text-blue-400 bg-blue-900/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Wallet className="h-4 w-4" />
              Vaults
            </Link>

            <Link
              to="/my-vaults"
              className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
                isActive('/my-vaults')
                  ? 'text-blue-400 bg-blue-900/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              My Vaults
            </Link>

            <Link
              to="/staking"
              className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
                isActive('/staking')
                  ? 'text-green-400 bg-green-900/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Gift className="h-4 w-4" />
              Stake
            </Link>

            <Link
              to="/yuki"
              className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
                isActive('/yuki')
                  ? 'text-purple-400 bg-purple-900/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              Yuki
            </Link>
          </div>

          {/* User Menu (placeholder) */}
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors">
              👤 Account
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
```

---

## Step 3: Update Main App Layout

**File**: `client/src/App.tsx`

```typescript
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import VaultListPage from './components/vaults/VaultListPage';
import VaultDetailPage from './components/vaults/VaultDetailPage';
import MyVaultsPage from './components/vaults/MyVaultsPage';
import StakingComponent from './components/staking/StakingComponent';
import YukiDashboard from './components/trading/YukiDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Navigation />
      <Routes>
        <Route path="/vaults" element={<VaultListPage />} />
        <Route path="/vaults/:vaultId" element={<VaultDetailPage />} />
        <Route path="/my-vaults" element={<MyVaultsPage />} />
        <Route path="/staking" element={<StakingComponent />} />
        <Route path="/yuki" element={<YukiDashboard />} />
        <Route path="/" element={<VaultListPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## Step 4: Add VaultDetailPage Dynamic Route

Update VaultListPage to navigate to vault details:

**File**: `client/src/components/vaults/VaultListPage.tsx`

Add this onClick handler to the vault cards:

```typescript
import { useNavigate } from 'react-router-dom';

export default function VaultListPage() {
  const navigate = useNavigate();

  const handleViewVault = (vaultId: string) => {
    navigate(`/vaults/${vaultId}`);
  };

  // In the vault card render:
  return (
    <button
      onClick={() => handleViewVault(vault.vaultId)}
      className="...vault card styles..."
    >
      {/* Vault card content */}
    </button>
  );
}
```

---

## Step 5: Setup Backend Routes

**File**: `server/app.ts` or `server/server.ts`

```typescript
import express from 'express';
import vaultsRouter from './routes/vaults';
import stakingRouter from './routes/staking';
import yukiRouter from './routes/yuki';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Routes
app.use('/api/vaults', vaultsRouter);
app.use('/api/staking', stakingRouter);
app.use('/api/yuki', yukiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3001, () => {
  console.log('✅ Server running on port 3001');
});
```

---

## Step 6: Environment Variables

**File**: `.env` (Frontend)

```env
REACT_APP_API_URL=http://localhost:3001
REACT_APP_JWT_SECRET=your-secret-key
REACT_APP_NETWORK=mainnet
```

**File**: `.env` (Backend)

```env
DATABASE_URL=postgresql://user:password@localhost/mtaa_dao
JWT_SECRET=your-secret-key
PORT=3001
NODE_ENV=development
```

---

## Step 7: Create Database Tables

**File**: `server/migrations/001_init_schema.sql`

```sql
-- Stakes Table
CREATE TABLE IF NOT EXISTS stakes (
  stake_id VARCHAR PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(20,8) NOT NULL,
  duration INTEGER NOT NULL, -- days
  staked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unlock_at TIMESTAMP NOT NULL,
  apy NUMERIC(5,2) NOT NULL,
  status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'matured', 'unlocking')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Positions Table (Vault deposits)
CREATE TABLE IF NOT EXISTS positions (
  position_id VARCHAR PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vault_id VARCHAR NOT NULL REFERENCES vaults(vault_id) ON DELETE CASCADE,
  shares NUMERIC(20,8) NOT NULL,
  deposited_amount NUMERIC(20,8) NOT NULL,
  deposited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, vault_id)
);

-- Vault Performance History Table
CREATE TABLE IF NOT EXISTS vault_performance (
  id BIGSERIAL PRIMARY KEY,
  vault_id VARCHAR NOT NULL REFERENCES vaults(vault_id) ON DELETE CASCADE,
  daily_return NUMERIC(5,2) NOT NULL,
  total_aum NUMERIC(20,2) NOT NULL,
  depositor_count INTEGER NOT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_stakes_user_id ON stakes(user_id);
CREATE INDEX idx_stakes_status ON stakes(status);
CREATE INDEX idx_positions_user_id ON positions(user_id);
CREATE INDEX idx_positions_vault_id ON positions(vault_id);
CREATE INDEX idx_vault_performance_vault_id ON vault_performance(vault_id);
CREATE INDEX idx_vault_performance_recorded_at ON vault_performance(recorded_at);
```

---

## Step 8: Install Dependencies (if not already installed)

```bash
# Frontend
npm install recharts lucide-react react-router-dom

# Backend
npm install express pg dotenv jsonwebtoken bcryptjs cors
npm install --save-dev @types/express @types/pg typescript
```

---

## Step 9: Testing the Integration

### Test 1: Verify Routes Load

```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Start frontend
npm start
```

Visit: `http://localhost:3000/vaults` → Should see VaultListPage

### Test 2: Test Vault Deposit Flow

1. Navigate to `/vaults`
2. Click on a vault card
3. Click "Deposit More"
4. Enter amount and click "Deposit"
5. Verify modal shows share calculation
6. Monitor network tab for API call

### Test 3: Test Staking Flow

1. Navigate to `/staking`
2. Enter stake amount
3. Select lockup duration
4. Verify APY calculation
5. Click "Stake MTAA"
6. Check user's stakes in "My Stakes" tab

### Test 4: Test Portfolio Dashboard

1. Navigate to `/my-vaults`
2. Should show all user vault positions
3. Verify portfolio stats calculated
4. Check performance chart loads

---

## Step 10: Error Handling Setup

Create an error boundary component:

**File**: `client/src/components/ErrorBoundary.tsx`

```typescript
import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('Error caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-400 mb-2">Oops! Something went wrong</h1>
            <p className="text-slate-400 mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded font-semibold"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

Wrap your app:

```typescript
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

---

## Step 11: Add Loading States

Create a loading hook:

**File**: `client/src/hooks/useAsync.ts`

```typescript
import { useState, useEffect } from 'react';

export function useAsync<T>(
  fn: () => Promise<T>,
  deps: any[] = []
) {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    fn()
      .then((data) => {
        if (mounted) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (mounted) setState({ data: null, loading: false, error });
      });

    return () => {
      mounted = false;
    };
  }, deps);

  return state;
}
```

Usage:

```typescript
const { data: vaults, loading, error } = useAsync(
  () => fetch('/api/vaults').then(r => r.json()),
  []
);

if (loading) return <Spinner />;
if (error) return <Error message={error.message} />;
return <VaultGrid vaults={vaults} />;
```

---

## Step 12: Add Toast Notifications

Create a toast context:

**File**: `client/src/context/ToastContext.tsx`

```typescript
import React, { createContext, useState, useCallback } from 'react';

export const ToastContext = createContext<{
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}>({ showToast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<any[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-2 rounded text-white ${
              toast.type === 'success' ? 'bg-green-600' :
              toast.type === 'error' ? 'bg-red-600' :
              'bg-blue-600'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

---

## DEPLOYMENT CHECKLIST

- [ ] All components imported and routed
- [ ] Navigation menu created and styled
- [ ] Database tables created
- [ ] Backend routes tested with Postman
- [ ] Frontend can call backend endpoints
- [ ] Error handling implemented
- [ ] Loading states added
- [ ] Toast notifications working
- [ ] JWT authentication verified
- [ ] CORS configured properly
- [ ] Environment variables set
- [ ] Test all flows end-to-end
- [ ] Performance optimized
- [ ] Ready for production deployment

---

**Integration Complete! 🎉**

All vault and staking components are now integrated and ready to use.
