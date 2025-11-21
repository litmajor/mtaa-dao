# Vaults vs Investment Pools - Architecture Overview

## Summary

Both **Vaults** and **Investment Pools** are now **Web3-first on-chain features** with full wallet integration. However, they serve different purposes in the ecosystem.

---

## Key Differences

| Feature | **Vaults** | **Investment Pools** |
|---------|-----------|---------------------|
| **Purpose** | Professional DeFi vault management for individual asset growth | Community pooled investments with shared capital |
| **Use Case** | Personal yield generation, automated strategies | Group investing, friends pooling money together |
| **User Model** | Individual deposits → personal vault shares | Multiple users → shared pool shares |
| **Capital Structure** | Solo investment account | Collective fund management |
| **Governance** | Manager/operator controlled | Democratic (multi-user consensus) |
| **Exit Strategy** | Individual withdrawal anytime | Proportional to share ownership |
| **Fee Model** | Performance fees on individual returns | Pool-level management fees |

---

## Web3 Implementation

### Both Require:
- ✅ **Wallet Connection** (`useAccount()` from wagmi)
- ✅ **Chain ID Detection** (multi-chain support)
- ✅ **Smart Contract Interaction** (on-chain state management)
- ✅ **Share Tokens** (ERC20-based shares)
- ✅ **Transaction Signing** (user approves on-chain operations)

### Vaults Features:
```typescript
// vault.tsx
const { address, isConnected } = useAccount();
const { connectMetaMask } = useWallet();

// Requires wallet before rendering dashboard
if (!isConnected) {
  return <ConnectWalletPrompt />;
}

// Uses vault contract hooks
const { data: vaultInfo } = useVaultInfo(VAULT_ADDRESS);
const { data: vaultBalance } = useVaultBalance(address, VAULT_ADDRESS);
const { data: performance } = useVaultPerformance(VAULT_ADDRESS, period);
```

### Investment Pools Features:
```typescript
// investment-pools.tsx
const { address, isConnected, chainId } = useAccount();

// Query includes chain and user context
const { data, isLoading } = useQuery({
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

---

## Backend Integration

### Vaults
- Directly interact with smart contracts
- Minimal backend API requirements
- Focus on displaying on-chain contract data
- Uses wagmi hooks for Web3 interactions

### Investment Pools
- **Hybrid approach**: Backend orchestrates pool management
- Backend API endpoints:
  - `GET /api/investment-pools` - List pools (filters by chain/user)
  - `POST /api/investment-pools/{id}/invest` - Create investment transaction
  - `POST /api/investment-pools/{id}/withdraw` - Process withdrawal
  - `GET /api/investment-pools/{id}/analytics` - Pool performance data
  - `GET /api/investment-pools/{id}/my-investment` - User's stake in pool

- Smart contracts handle:
  - Share token minting/burning
  - Fund deposits/withdrawals
  - Balance tracking
  - Yield accumulation

---

## Wallet Display & Status

Both pages now show:
```
✓ Web3 Connected
0x1234...5678
Chain ID: 1
```

This indicates the user's active wallet connection that governs all on-chain interactions.

---

## User Experience Flow

### Vaults
1. User visits `/vault`
2. Wallet connection check
3. Display vault dashboard with personal metrics
4. User can deposit/withdraw directly to/from vault
5. Shares are managed individually

### Investment Pools
1. User visits `/investment-pools`
2. Wallet connection check (required for on-chain participation)
3. Browse available pools (filtered by chain)
4. Join pool → creates wallet signature for participation
5. User's shares managed by pool smart contract
6. Can withdraw proportionally to share ownership

---

## Smart Contract Architecture

### Vaults
- Single-user vault contracts
- Direct interaction: User ↔ Vault Contract
- Higher gas efficiency for individual users
- Personal share tracking

### Investment Pools
- Multi-user pool contracts
- Shared state: Multiple Users ↔ Pool Contract
- Democratic share management
- Event logs for all member activities

---

## API Endpoints Differences

### Vault Endpoints (if centralized)
- `GET /api/vault/transactions` - Vault transaction history
- `GET /api/dashboard/vaults` - User's vaults
- `GET /api/vault/{address}/info` - Vault contract state

### Investment Pool Endpoints
- `GET /api/investment-pools` - Browse pools
- `GET /api/investment-pools/{id}` - Pool details
- `POST /api/investment-pools/{id}/invest` - Join pool
- `GET /api/investment-pools/{id}/my-investment` - Your share
- `POST /api/investment-pools/{id}/withdraw` - Exit pool
- `GET /api/investment-pools/{id}/analytics` - Performance

---

## Security Model

### Vaults
- User has private key control
- Withdrawals signed directly by user
- No intermediary required
- Potential for self-liquidation

### Investment Pools
- Funds held in pool smart contract
- User withdrawals proportional to shares
- Pool governance decisions may affect timing
- Multi-signature approvals possible

---

## Roadmap Updates

### Short Term (Current)
- ✅ Both require Web3 wallet connection
- ✅ Both display wallet address and chain ID
- ✅ Both support chain-specific queries
- ✅ Both link user identity to wallet

### Medium Term
- Add on-chain transaction history
- Implement real wallet balance checking
- Add gas estimation for transactions
- Support multi-chain pool discovery

### Long Term
- Cross-chain pool synchronization
- Vault-to-Pool migration features
- Advanced portfolio analytics
- DAO governance for pool management

---

## File Changes Made

### investment-pools.tsx
- Added `useAccount()` from wagmi
- Added `useWallet()` hook integration
- Requires wallet connection before rendering
- Shows connected wallet address and chain ID
- Updated UI to emphasize on-chain nature
- Added pool metadata fields: `poolAddress`, `tokenAddress`, `chainId`, `members`, `apy`
- Implemented filter tabs for pool discovery

### Key Imports Added
```typescript
import { useAccount } from 'wagmi';
import { useWallet } from './hooks/useWallet';
import { Lock, Users, Zap } from 'lucide-react';
```

### Updated Interface
```typescript
interface InvestmentPool {
  // ... existing fields
  poolAddress?: string;      // Smart contract address
  tokenAddress?: string;     // Share token address
  chainId?: number;          // Blockchain network
  members?: number;          // Number of participants
  apy?: string;             // Annual percentage yield
}
```

---

## Next Steps

1. **Investment Pool Detail Page**: Update `investment-pool-detail.tsx` to include Web3 interactions
2. **Pool Creation**: Build wizard for on-chain pool deployment
3. **Transaction Handling**: Add wallet transaction signing flow
4. **Analytics**: Display on-chain transaction history
5. **Governance**: Implement voting for pool decisions

