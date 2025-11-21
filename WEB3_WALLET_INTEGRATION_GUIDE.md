# Web3 Wallet Integration - Investment Pools

## Overview

Investment Pools have been restructured as **Web3-first on-chain features** with complete wallet integration, making them parallel to the Vault system in terms of blockchain connectivity.

---

## Wallet Connection Flow

```
User lands on /investment-pools
         ↓
isConnected check
         ↓
   ┌─────────┴──────────┐
   │                    │
 YES                   NO
   │                    │
   ↓                    ↓
Show Pools      Show Connect Wallet Modal
   │                    │
   │          User clicks "Connect Wallet"
   │                    ↓
   │          connectMetaMask() triggered
   │                    ↓
   │          Wallet popup appears
   │                    ↓
   │          User approves connection
   │                    ↓
   │          address & chainId captured
   │                    ↓
   └─────────┬──────────┘
             ↓
  Query pools with chain context
  (filters pools by user's network)
             ↓
  Display available pools
```

---

## Code Architecture

### 1. **Wallet Detection**
```typescript
const { address, isConnected, chainId } = useAccount();
```
- `isConnected`: Boolean indicating wallet connection status
- `address`: User's wallet address (or undefined if not connected)
- `chainId`: Current blockchain network ID

### 2. **Wallet Connection Handler**
```typescript
const { connectMetaMask, isLoading: isConnecting } = useWallet();
```
- Custom hook that handles MetaMask connection
- Shows loading state during connection
- Automatically updates `useAccount()` state

### 3. **Conditional Rendering**
```typescript
if (!isConnected) {
  return <ConnectWalletScreen />;
}
// Show pool content only if connected
return <PoolsView />;
```

### 4. **Chain-Aware Queries**
```typescript
const { data } = useQuery({
  queryKey: ['/api/investment-pools', { chainId, userAddress: address }],
  queryFn: async () => {
    const params = new URLSearchParams();
    params.append('chainId', chainId.toString());
    params.append('userAddress', address);
    return fetch(`/api/investment-pools?${params}`);
  },
  enabled: isConnected, // Only fetch when connected
});
```

**Key Points:**
- Query key includes `chainId` and `address` → automatic refetch if they change
- `enabled: isConnected` → prevents API calls before wallet connection
- Backend filters pools by user's current network
- Ensures pools shown match the user's active chain

---

## UI Components Update

### Connection Status Badge
```typescript
<Badge className="bg-gradient-to-r from-emerald-400 to-teal-500">
  <Lock className="w-3 h-3" />
  ✓ Web3 Connected
</Badge>
```

Shows:
- Visual confirmation of connection
- Lock icon for security
- Chain ID for network verification

### Wallet Display
```typescript
<p className="text-white/60 text-sm font-mono">
  {address?.slice(0, 6)}...{address?.slice(-4)}
</p>
<Badge className="bg-blue-500/30">Chain ID: {chainId}</Badge>
```

Shows:
- Shortened wallet address (0x1234...5678)
- Current blockchain network
- Monospace font for address clarity

---

## Investment Pool Interface Enhancement

### Extended Pool Data Model
```typescript
interface InvestmentPool {
  // Existing fields
  id: string;
  name: string;
  description: string;
  
  // Web3 fields (NEW)
  poolAddress?: string;        // Smart contract address
  tokenAddress?: string;       // Share token contract
  chainId?: number;            // Pool's blockchain
  members?: number;            // Active participants
  apy?: string;               // Annual yield %
}
```

### PoolCard Component Updates
```typescript
// Shows Web3 information
<Lock className="w-4 h-4 text-emerald-400" />  // On-chain indicator
<p className="font-mono text-xs">
  {pool.poolAddress?.slice(0, 6)}...{pool.poolAddress?.slice(-4)}
</p>
<Users className="w-3 h-3" /> {members} members
<TrendingUp className="w-4 h-4" /> {apy}% APY
```

---

## Security Considerations

### 1. **Wallet State Validation**
```typescript
// Ensure we have address and chain before querying
enabled: isConnected && !!address && !!chainId
```

### 2. **Chain ID Verification**
```typescript
// Query is keyed on chainId
// If user switches chains, pools automatically refetch
// Prevents showing pools from wrong network
```

### 3. **User Address Context**
```typescript
// Backend can verify user ownership via address
// Prevents unauthorized access to private pools
// Enables user-specific pool recommendations
```

### 4. **Transaction Signing**
- All future transactions will require wallet signature
- Backend cannot execute transactions on behalf of user
- User retains full custody of funds

---

## Backend Requirements

For Investment Pools to work with Web3, backend should:

### 1. **Accept Chain & User Parameters**
```
GET /api/investment-pools?chainId=1&userAddress=0x1234...
```

### 2. **Filter Pools by Chain**
```typescript
// Return only pools deployed on requested chain
.where('chainId', '==', params.chainId)
```

### 3. **Fetch Pool Metadata from On-Chain**
```typescript
// Get live TVL, share price, members from smart contract
const poolContract = new ethers.Contract(poolAddress);
const tvl = await poolContract.totalValueLocked();
const sharePrice = await poolContract.sharePrice();
```

### 4. **Track User Participation**
```typescript
// Verify if user has pool shares
const userShares = await poolContract.balanceOf(userAddress);
const userValue = userShares * sharePrice;
```

### 5. **Support Multi-Chain Discovery**
```typescript
// Query pools across all chains user can access
const ethereumPools = await fetchPoolsForChain(1);
const polygonPools = await fetchPoolsForChain(137);
const combinedPools = [...ethereumPools, ...polygonPools];
```

---

## Future Enhancements

### Phase 1: Current
- ✅ Wallet connection required
- ✅ Chain detection
- ✅ Pool display by network

### Phase 2: Transactions
- Transaction history from wallet
- Real-time balance updates
- Gas estimation for joins/exits

### Phase 3: Portfolio Integration
- Combined vault + pool portfolio view
- Cross-chain asset overview
- Performance analytics across all investments

### Phase 4: Advanced Features
- Swap pools between chains (cross-chain)
- Composite positions (vault + pool)
- Yield farming optimization
- Governance participation

---

## Comparison: Vaults vs Pools (Now Both Web3)

| Feature | Vaults | Pools |
|---------|--------|-------|
| Wallet Required | ✅ Yes | ✅ Yes |
| On-Chain | ✅ Direct SC | ✅ Smart Contracts |
| Multi-User | ❌ Individual | ✅ Shared |
| Share Tokens | ✅ Personal | ✅ Shared |
| Chain Awareness | ✅ Yes | ✅ Yes |
| Transaction Signing | ✅ Required | ✅ Required (future) |
| User Balance Tracking | ✅ Wallet | ✅ Pool SC |
| Governance | ⚠️ Manager | ✅ Democratic |

---

## Code Changes Summary

### File: `investment-pools.tsx`

**Imports Added:**
```typescript
import { useAccount } from 'wagmi';
import { useWallet } from './hooks/useWallet';
import { Lock, Users, Zap } from 'lucide-react';
```

**Hooks Used:**
```typescript
const { address, isConnected, chainId } = useAccount();
const { connectMetaMask, isLoading: isConnecting } = useWallet();
```

**Connection Check:**
```typescript
if (!isConnected) {
  return <ConnectWalletPrompt />;
}
```

**Chain-Aware Query:**
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['/api/investment-pools', { chainId, userAddress: address }],
  queryFn: async () => {
    const params = new URLSearchParams();
    if (chainId) params.append('chainId', chainId.toString());
    if (address) params.append('userAddress', address);
    const res = await fetch(`/api/investment-pools?${params}`);
    return res.json();
  },
  enabled: isConnected,
});
```

---

## Testing Checklist

- [ ] User without wallet sees "Connect Wallet" button
- [ ] Clicking button opens MetaMask
- [ ] After connection, pools load
- [ ] Wallet address displays correctly
- [ ] Chain ID shows correct network
- [ ] Switching chains re-queries pools
- [ ] Pool cards show on-chain indicators (lock icon)
- [ ] Pool addresses display in shortened format
- [ ] Member count shows correctly
- [ ] APY displays for each pool
- [ ] Empty state shows when no pools on chain
- [ ] Error state shows API failures
- [ ] Mobile responsive layout

