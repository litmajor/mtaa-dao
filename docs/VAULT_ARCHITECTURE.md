
# MtaaDAO Vault Architecture - Separation of Concerns

## Overview
MtaaDAO implements multiple vault types, each serving different purposes with clear boundaries and responsibilities.

## 1. Personal Vaults (Wallet System)
**Location**: `client/src/components/wallet/PesonalVaultBalance.tsx`
**Purpose**: Individual user wallet management and basic savings

### Features:
- Individual CELO/cUSD balance tracking
- Send/Receive transactions
- Basic deposit/withdrawal (off-ramp integration planned)
- Personal savings goals and locked savings

### Key Components:
```typescript
// Personal wallet balance and transactions
VaultBalanceCard() - Shows CELO/cUSD balances
VaultSendCard() - Send tokens to other addresses
VaultReceiveCard() - Display address and QR code
LockedSavingsSection - Time-locked personal savings
```

### Database Tables:
- `users` - User profiles and wallet addresses
- `user_activities` - Transaction history tracking
- Personal vault records in `vaults` table with `userId` set

---

## 2. MaonoVault (Flagship ERC4626 Vault)
**Location**: `contracts/MaonoVault.sol`, `server/services/vaultService.ts`
**Purpose**: Professional, managed DeFi vault with yield strategies

### Features:
- ERC4626 compliant vault shares
- Professional fund management
- Performance and management fees
- NAV (Net Asset Value) tracking
- Yield strategy allocation
- Risk assessment and management

### Smart Contract Functions:
```solidity
// Core ERC4626 functions
deposit(assets, receiver) - Deposit tokens, get shares
withdraw(assets, receiver, owner) - Withdraw assets
redeem(shares, receiver, owner) - Redeem shares for assets

// Management functions
updateNAV(newNAV) - Manager updates net asset value
setPerformanceFee(fee) - Set performance fee percentage
allocateToStrategy() - Allocate funds to yield strategies
```

### Backend Service:
```typescript
// VaultService handles business logic
createVault() - Deploy new vault instance
depositToken() - Process deposits with proper validation
withdrawToken() - Handle withdrawals with risk checks
performRiskAssessment() - Analyze vault risk factors
```

### Database Tables:
- `vaults` - Vault metadata and configuration
- `vault_token_holdings` - Asset balances per vault
- `vault_transactions` - All vault operations
- `vault_performance` - Historical performance data
- `vault_strategy_allocations` - Yield strategy distributions
- `vault_risk_assessments` - Risk analysis results

---

## 3. Community/DAO Vaults
**Location**: `client/src/components/wallet/CommunityVaultSection.tsx`
**Purpose**: Shared treasury management with governance

### Features:
- Multi-signature governance
- Proposal-based withdrawals
- Community voting on fund allocation
- Disbursement verification
- Transparent treasury management

### Key Components:
```typescript
// Community governance features
ProposalViewerCard() - Display and vote on proposals
VaultSelector() - Choose which DAO vault to interact with
DisbursementModal() - Verify fund distributions
```

### Governance Flow:
1. DAO members can deposit to shared treasury
2. Withdrawals require governance proposals
3. Members vote on disbursement proposals
4. Approved proposals trigger automatic distributions

### Database Tables:
- `vaults` with `daoId` set (instead of `userId`)
- `dao_memberships` - Controls access permissions
- `proposals` - Governance proposals for fund management
- `proposal_votes` - Member voting records

---

## 4. Vault Factory System
**Location**: `contracts/MaonoVaultFactory.sol`
**Purpose**: Deploy and manage multiple vault instances

### Features:
- Deploy new MaonoVault contracts
- Support multiple asset types
- Platform fee collection
- Vault registry and discovery

### Factory Functions:
```solidity
deployVault() - Create new vault instance
addSupportedAsset() - Add new token support
getVaultInfo() - Retrieve vault metadata
```

---

## 5. Cross-Chain & Multi-Asset Support (Planned)
**Location**: `docs/vault-roadmap.md`
**Purpose**: Future expansion to multiple blockchains

### Phases:
- **Phase 2**: Wrapped multi-asset vaults (BTC, ETH, BNB via bridges)
- **Phase 3**: Native cross-chain vaults
- **Phase 4**: Privacy asset support
- **Phase 5**: Universal DAO finance layer

---

## API Endpoints by Vault Type

### Personal Vaults:
```
GET /api/wallet/balance/celo - Get CELO balance
GET /api/wallet/balance/cusd - Get cUSD balance
POST /api/wallet/send - Send tokens to address
```

### MaonoVault Operations:
```
POST /api/vault/deposit - Deposit to ERC4626 vault
POST /api/vault/withdraw - Withdraw from vault
GET /api/vault/performance - Get vault performance data
GET /api/vault/transactions - Get vault transaction history
```

### Community Vaults:
```
GET /api/proposals/list - Get governance proposals
POST /api/proposals/vote - Vote on proposals
POST /api/proposals/resolve - Execute approved proposals
```

---

## Security & Permissions Model

### Personal Vaults:
- User has full control over their wallet
- Direct ownership model
- No governance required for transactions

### MaonoVault:
- Professional management by designated manager
- Owner can change fees and policies
- Users own shares, not direct assets
- Automated risk management

### DAO Vaults:
- Multi-signature governance required
- Role-based permissions:
  - `member` - Can view and deposit
  - `elder` - Can withdraw and manage strategies
  - `admin` - Full vault control
- All major operations require proposals and voting

---

## Integration Points

### Wallet ↔ MaonoVault:
- Users deposit personal funds into managed vaults
- Vault shares tracked in user's wallet balance
- Automatic yield accrual

### DAO ↔ MaonoVault:
- DAOs can deploy their own MaonoVault instances
- Community funds managed professionally
- DAO governance controls vault policies

### Cross-Vault Transfers:
- Users can move funds between vault types
- Proper authorization checks at each level
- Audit trail maintained across all operations

---

## Development Guidelines

### Adding New Vault Types:
1. Define purpose and use case
2. Create database schema extensions
3. Implement service layer logic
4. Add API endpoints with proper validation
5. Create frontend components
6. Add comprehensive tests
7. Update this documentation

### Security Considerations:
- Always validate user permissions before operations
- Use database transactions for multi-step operations
- Implement proper error handling and logging
- Regular security audits for smart contracts
- Rate limiting on sensitive operations

This architecture ensures clear separation of concerns while maintaining interoperability between different vault types.
