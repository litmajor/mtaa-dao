# Multi-Wallet & Balance Aggregation System

## Overview

The enhanced wallet system now supports:
- **Multiple wallet providers**: MetaMask, Valora, MiniPay, Internal Wallet
- **Balance aggregation**: Across wallets, pools, vaults, and staking
- **Portfolio tracking**: Real-time view of all investments
- **Multi-tab interface**: Category-based breakdown

---

## Wallet Providers Supported

### 1. **MetaMask** (🦊)
- **Type**: Browser extension
- **Networks**: EVM-compatible chains (Ethereum, Polygon, Arbitrum, etc.)
- **Use Case**: Desktop users, advanced traders
- **Connection Method**: `window.ethereum` API
- **Status Check**: `window.ethereum?.isMetaMask`

```typescript
// MetaMask connection
const connectMetaMask = async () => {
  const accounts = await window.ethereum.request({
    method: 'eth_requestAccounts',
  });
  return accounts[0];
};
```

### 2. **Valora** (💳)
- **Type**: Mobile wallet (Celo-native)
- **Networks**: Celo, Ethereum L2s
- **Use Case**: Mobile-first, emerging markets
- **Connection Method**: `window.celo` API
- **Status Check**: `window.celo?.isValora`

```typescript
// Valora connection
const connectValora = async () => {
  const accounts = await window.celo.request({
    method: 'eth_requestAccounts',
  });
  return accounts[0];
};
```

### 3. **MiniPay** (💰)
- **Type**: USSD-based wallet
- **Networks**: Celo blockchain
- **Use Case**: Feature phone users, financial inclusion
- **Connection Method**: USSD bridge or API
- **Status Check**: `window.minipay?.isConnected`

```typescript
// MiniPay connection
const connectMiniPay = async () => {
  if (window.minipay?.isConnected) {
    return window.minipay.address;
  }
};
```

### 4. **Internal Wallet** (🔐)
- **Type**: Managed wallet (backend-controlled)
- **Networks**: All supported chains
- **Use Case**: Users without external wallets
- **Connection Method**: Backend authentication
- **Status Check**: Always available if authenticated

```typescript
// Internal wallet (always available)
const internalWallet = {
  address: userData.walletAddress,
  isConnected: true,
  type: 'internal',
};
```

---

## Balance Aggregation Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  User Connected                            │
│              (Any wallet provider)                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
        ┌────────────────┐
        │  useAccount()  │  ← wagmi hook
        │  from wagmi    │     (gets address, chainId)
        └────────┬───────┘
                 │
                 ▼
    ┌────────────────────────────┐
    │ useBalanceAggregator()     │  ← Custom hook
    │                            │
    │ - Detects all providers    │
    │ - Fetches all balances     │
    │ - Aggregates by category   │
    └────────┬───────────────────┘
             │
             ▼
    ┌──────────────────────────────────┐
    │ POST /api/wallet/balances-aggregated
    │ (Backend service)                │
    │                                  │
    │ Fetches from:                   │
    │ • Native wallet balance         │
    │ • Token holdings (ERC20)        │
    │ • Investment pool shares        │
    │ • Vault shares & balances       │
    │ • Staking positions & rewards   │
    └──────────┬───────────────────────┘
               │
               ▼
    ┌────────────────────────────────┐
    │  Aggregated Balance Data       │
    │  (BalanceAggregatorWidget)     │
    │                                │
    │ Tabs:                         │
    │ • Overview (all summary)       │
    │ • Wallet (native & tokens)    │
    │ • Pools (investment pools)    │
    │ • Vaults (personal & shared)  │
    │ • Staking (positions & APY)   │
    └────────────────────────────────┘
```

### Backend API Endpoint

```typescript
POST /api/wallet/balances-aggregated

Request:
{
  userAddress: "0x1234...5678",
  chainId: 1,
  includeCategories: [
    "native",
    "tokens",
    "investment-pools",
    "vaults",
    "staking"
  ]
}

Response:
{
  breakdown: {
    nativeBalance: {
      amount: "5.23",
      symbol: "ETH",
      valueUSD: "8975.42"
    },
    tokens: [
      {
        symbol: "USDC",
        address: "0xA0b86991...",
        amount: "1000.50",
        valueUSD: "1000.50",
        decimals: 6
      }
    ],
    investmentPools: [
      {
        poolId: "pool-1",
        poolName: "Bitcoin Pool",
        shares: "100.5",
        sharePrice: "1.25",
        valueUSD: "125.62",
        apy: "12.5",
        poolAddress: "0x5678..."
      }
    ],
    vaults: [
      {
        vaultId: "vault-1",
        vaultName: "Yield Vault",
        type: "personal",
        shares: "50",
        sharePrice: "2.0",
        valueUSD: "100.00",
        apy: "8.5",
        vaultAddress: "0x9012..."
      }
    ],
    stakingRewards: {
      totalStaked: "10.0",
      totalRewards: "0.5",
      valueUSD: "850.00"
    }
  },
  providers: [
    {
      id: "metamask",
      isConnected: true,
      address: "0x1234...5678"
    },
    {
      id: "valora",
      isConnected: false,
      address: null
    }
  ],
  totalValueUSD: "11051.54"
}
```

---

## Component Structure

### useBalanceAggregator Hook

**Location**: `client/src/pages/hooks/useBalanceAggregator.ts`

**Features**:
- Detects all connected wallet providers
- Fetches aggregated balances from backend
- Auto-refresh every 30 seconds
- Category-specific total calculations
- Provider-specific balance queries

**Usage**:
```typescript
const aggregator = useBalanceAggregator();

// Access data
console.log(aggregator.totalValueUSD);        // "11051.54"
console.log(aggregator.breakdown.nativeBalance);  // Native balance
console.log(aggregator.providers);            // Connected wallets
console.log(aggregator.isLoading);            // Loading state

// Methods
await aggregator.refetch();                   // Manual refresh
const poolsTotal = aggregator.getCategoryTotal('investmentPools');
const metamaskBalance = aggregator.getProviderBalance('metamask');
```

### BalanceAggregatorWidget Component

**Location**: `client/src/components/wallet/BalanceAggregatorWidget.tsx`

**Features**:
- Multi-tab interface (Overview, Wallet, Pools, Vaults, Staking)
- Connected wallet providers display
- Category breakdown cards
- Hide/show balance toggle
- Manual refresh button
- Real-time updates

**Tabs**:

1. **Overview**: Summary of all categories
   - Native balance
   - Token holdings count
   - Investment pools count
   - Vaults count
   - Staking rewards

2. **Wallet**: Native & token balances
   - Native currency (ETH, CELO, etc.)
   - All ERC20 token holdings
   - Real-time values

3. **Pools**: Investment pools
   - Pool name & contract address
   - Your shares & APY
   - USD value
   - Pool performance

4. **Vaults**: Personal & shared vaults
   - Vault name & type
   - Share balance
   - APY percentage
   - Total USD value

5. **Staking**: Staking positions
   - Total staked amount
   - Pending rewards
   - Total USD value

### Provider Selection Dialog

**In Investment Pools Page**:

When user is not connected, shows all available wallet options:

```
┌─────────────────────────────────┐
│  Connect Your Wallet            │
├─────────────────────────────────┤
│  🦊 MetaMask      [Connect]    │
│  💳 Valora        [Connect]    │
│  💰 MiniPay       [Connect]    │
│  🔐 Internal      [Connect]    │
└─────────────────────────────────┘
```

---

## Wallet Provider Capabilities

| Feature | MetaMask | Valora | MiniPay | Internal |
|---------|----------|--------|---------|----------|
| Desktop | ✅ | ✅ | ❌ | ✅ |
| Mobile | ⚠️ | ✅ | ✅ | ✅ |
| EVM Chains | ✅ | ✅ | ⚠️ | ✅ |
| Celo | ⚠️ | ✅ | ✅ | ✅ |
| Transaction Signing | ✅ | ✅ | ✅ | ✅ |
| Contract Interaction | ✅ | ✅ | ⚠️ | ✅ |
| Balance Query | ✅ | ✅ | ✅ | ✅ |
| Token Swap | ✅ | ✅ | ⚠️ | ✅ |
| Staking | ✅ | ✅ | ⚠️ | ✅ |

---

## Balance Categories

### 1. Native Balance
- Cryptocurrency in wallet (ETH, CELO, etc.)
- Directly holds at wallet address
- Immediately liquid

### 2. Tokens (ERC20)
- Fungible tokens
- Held at token contract
- Easily tradeable
- Examples: USDC, DAI, USDT

### 3. Investment Pools
- Shares of pooled investments
- Held in pool smart contract
- Proportional to capital contributed
- Share price appreciates with pool growth
- Can withdraw proportional value

### 4. Vaults
- **Personal Vaults**: User's yield farming positions
- **Shared Vaults**: Community vaults with multiple users
- Shares represent stake
- Earn yield on deposited capital
- Managed by vault contract

### 5. Staking
- Cryptocurrency locked for validation
- Earns rewards over time
- May have lock-up period
- Visible but not liquid

---

## Multi-Wallet User Flow

### Scenario: User has MetaMask + MiniPay

```
1. User visits /investment-pools
   └─ Not connected

2. User clicks "Connect Wallet"
   └─ Opens provider selection dialog

3. User selects MiniPay
   └─ MiniPay connection initiated
   └─ User approves in MiniPay
   └─ Connected: 0x5555...5555 (MiniPay)

4. Backend fetches balances:
   ├─ MiniPay native balance: 100 CELO
   ├─ MiniPay tokens: 500 USDC
   ├─ MiniPay pools: 10 shares in Bitcoin Pool
   └─ Total value: $2,500

5. User switches to MetaMask in browser
   └─ wagmi detects change
   └─ address updates to 0x1111...1111
   └─ useBalanceAggregator re-fetches

6. Backend fetches MetaMask balances:
   ├─ MetaMask native: 5.23 ETH
   ├─ MetaMask tokens: 1000 USDC, 500 DAI
   ├─ MetaMask pools: Different pools
   ├─ MetaMask vaults: 2 vaults
   └─ Total value: $8,500

7. UI shows:
   - Both wallets in "Connected Wallets" section
   - Combined portfolio totaling all balances
   - Separate tabs for each category
```

---

## Key Features

### ✅ Real-Time Balance Updates
- Refreshes every 30 seconds automatically
- Manual refresh button available
- Shows last update timestamp

### ✅ Multiple Balance Views
- By category (wallet, pools, vaults, staking)
- By wallet provider
- Total aggregated view

### ✅ Security
- No private keys exposed
- No transaction data visible until user initiates
- Read-only balance queries
- Each provider manages its own key storage

### ✅ User Control
- Can connect multiple wallets
- Can switch between wallets
- Can disconnect anytime
- Balance visibility toggle

### ✅ Responsive Design
- Works on desktop and mobile
- Wallet provider icons
- Tab interface collapses to fit screens
- Touch-friendly buttons

---

## Backend Integration Requirements

### API Endpoints Needed

#### 1. Aggregate Balances
```
POST /api/wallet/balances-aggregated
```
- Fetches from all categories
- Aggregates into single response
- Filters by chain if needed

#### 2. Native Balance
```
GET /api/wallet/balance?address=0x...&chain=1
```
- Gets native cryptocurrency balance
- Returns symbol and value

#### 3. Token Holdings
```
POST /api/wallet/tokens
```
- Lists all ERC20 tokens
- Returns balance and USD value

#### 4. Investment Pool Shares
```
GET /api/wallet/pools?userAddress=0x...&chainId=1
```
- User's pool shares
- Share prices and APY

#### 5. Vault Holdings
```
GET /api/wallet/vaults?userAddress=0x...&chainId=1
```
- User's vault positions
- Share balances and yields

#### 6. Staking Positions
```
GET /api/wallet/staking?userAddress=0x...
```
- Active staking positions
- Rewards accrued

---

## Configuration

### Environment Variables
```env
# Wallet provider RPC endpoints
VITE_ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/...
VITE_POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/...
VITE_CELO_RPC_URL=https://forno.celo.org

# Price feeds
VITE_COINGECKO_API_KEY=...
VITE_CHAINLINK_PRICE_FEED_URL=...

# Balance refresh interval
VITE_BALANCE_REFRESH_INTERVAL=30000  # ms
```

---

## Future Enhancements

### Phase 1: Current Implementation ✅
- Multi-wallet detection
- Balance aggregation
- Tab-based UI
- Category breakdown

### Phase 2: Advanced Features
- Cross-chain balance aggregation
- Portfolio performance analytics
- Historical balance charts
- Automated DCA (Dollar Cost Averaging)

### Phase 3: Trading & Management
- Swap between pools/vaults
- Rebalance allocations
- Automated yield harvesting
- Tax reporting

### Phase 4: Social & Community
- Share portfolio stats
- Compare with friends
- Community pools
- Governance participation

---

## Files Modified/Created

### New Files
- `useBalanceAggregator.ts` - Balance aggregation hook
- `BalanceAggregatorWidget.tsx` - UI component

### Modified Files
- `investment-pools.tsx` - Multi-wallet provider support
- `useWallet.ts` - Added `connectValora`, `connectMiniPay`

### Expected Future Files
- `poolService.ts` - Pool-specific API calls
- `vaultService.ts` - Vault balance queries
- `stakingService.ts` - Staking data
- `priceService.ts` - Price conversion
