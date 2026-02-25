# Vault vs Wallet: Clear Architecture Definition

## Core Distinction

### **WALLET** (User's Private Key Management)
- **Purpose**: Hold private keys, sign transactions, control funds
- **Scope**: Single user/agent entity
- **Creation**: Via Web3.js or wallet providers (MetaMask, Ledger, WalletConnect, Minipay)
- **Lifecycle**: Tied to user login/authentication
- **Ownership**: Individual user or agent
- **Storage**: Browser (injected), app (Minipay), hardware device (Ledger)
- **Responsibility**: User controls and secures

### **VAULT** (Smart Contract Financial Container)
- **Purpose**: Hold and manage funds for specific strategy/purpose
- **Scope**: Single purpose (savings, trading, governance, yield farming)
- **Creation**: Via smart contract deployment on blockchain
- **Lifecycle**: Persistent on-chain, survives user logout
- **Ownership**: User, DAO, or smart contract
- **Storage**: Blockchain (immutable ledger)
- **Responsibility**: Smart contract logic enforces rules

---

## Architecture Decision: **ONE WALLET → MANY VAULTS**

```
┌─────────────────────────────────────────────────────────┐
│                    USER / AGENT                         │
└─────────────────────────────────────────────────────────┘
                          │
                    ┌─────▼─────┐
                    │   WALLET   │
                    │  (1 only)  │
                    │            │
                    │ Address:   │
                    │ 0x1234...  │
                    │            │
                    │ Providers: │
                    │ -MetaMask  │
                    │ -Ledger    │
                    │ -Minipay   │
                    └─────┬─────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
    ┌─────▼──────┐ ┌──────▼────┐ ┌──────▼────┐
    │  VAULT 1   │ │  VAULT 2  │ │  VAULT 3  │
    │ (Savings)  │ │ (Trading) │ │ (Yield)   │
    └────────────┘ └───────────┘ └───────────┘
```

### Why This Architecture?

1. **Single Point of Key Management**: One wallet = one private key source
2. **Multiple Strategies**: Different vaults for different purposes
3. **Parallel Operations**: Wallet can interact with multiple vaults simultaneously
4. **Clear Separation**: Wallet manages access, vaults manage funds
5. **User Mental Model**: "I have one wallet with multiple accounts/strategies"

---

## WALLET Creation Flow

### 1. Browser Extension (MetaMask, Coinbase Wallet)
```typescript
// server/agent-wallet/wallet-provider-integrations.ts

// DETECTION - Check if extension exists
if (window.ethereum?.isMetaMask) {
  // MetaMask is installed
}

// CONNECTION - Request accounts
const accounts = await window.ethereum.request({
  method: 'eth_requestAccounts'
});
const walletAddress = accounts[0]; // 0x1234...

// INITIALIZATION
const wallet = new Web3(window.ethereum); // Injected provider
```

### 2. WalletConnect (QR Code - Any Mobile Wallet)
```typescript
// client/hooks/useWalletProviders.tsx

import { EthereumProvider } from "@walletconnect/ethereum-provider";

// INITIALIZATION - Setup WalletConnect
const provider = await EthereumProvider.init({
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  chains: [1, 42220, 137, ...otherChains],
  showQrModal: true
});

// CONNECTION - User scans QR with mobile wallet
const accounts = await provider.enable();
const walletAddress = accounts[0];

// INITIALIZATION
const wallet = new Web3(provider);
```

### 3. Mobile App (Minipay on Celo)
```typescript
// client/hooks/useWalletProviders.tsx - Mobile detection

// DETECTION - Check if on mobile + Celo chain
const isMobile = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);
const onCelo = chainId === 42220 || chainId === 44787;

if (isMobile && onCelo) {
  // Offer Minipay
}

// CONNECTION - Deep link or WalletConnect
const minipayDeepLink = `minipay://pay?address=${address}&amount=${amount}`;
window.location.href = minipayDeepLink;

// Or fallback to WalletConnect QR
```

### 4. Hardware Wallet (Ledger via WalletConnect)
```typescript
// server/agent-wallet/wallet-provider-integrations.ts

// Ledger integrates through WalletConnect
// User scans QR with Ledger Live mobile app
// Ledger Live connects to browser via WalletConnect session
// Hardware wallet signs transactions
```

---

## VAULT Creation Flow

### 1. Smart Contract Deployment
```typescript
// server/services/vault/vault-creation.ts

export class VaultCreationService {
  async createVault(request: CreateVaultRequest): Promise<Vault> {
    // VALIDATION
    const token = TokenRegistry.getToken(request.primaryCurrency);
    const yieldStrategy = YIELD_STRATEGIES[request.yieldStrategy];
    
    // DEPLOYMENT - Deploy smart contract
    const vaultContract = await ethers.deployContract('Vault', [
      request.name,
      request.primaryCurrency,
      request.yieldStrategy,
      request.minDeposit,
      request.maxDeposit
    ]);
    
    // DATABASE - Record vault details
    const [newVault] = await db.insert(vaults).values({
      name: request.name,
      address: vaultContract.address,  // Smart contract address
      chainId: request.chainId,
      userId: request.userId,          // Who owns this vault
      daoId: request.daoId,            // Or DAO owns it
      primaryCurrency: request.primaryCurrency,
      yieldStrategy: request.yieldStrategy,
      createdAt: new Date()
    });
    
    return newVault;
  }
}
```

### 2. Database Registration
```typescript
// shared/schema.ts - Vault table

export const vaults = pgTable('vaults', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address').notNull(),        // Smart contract address
  chainId: integer('chain_id').notNull(),    // Which blockchain
  userId: uuid('user_id'),                   // Personal vault
  daoId: uuid('dao_id'),                     // DAO vault
  primaryCurrency: text('primary_currency'), // CELO, USDC, etc.
  yieldStrategy: text('yield_strategy'),     // aave, curve, etc.
  minDeposit: text('min_deposit'),
  maxDeposit: text('max_deposit'),
  lockedUntil: timestamp('locked_until'),    // For locked_savings
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at')
});
```

### 3. Vault Activation
```typescript
// server/services/vault/vault-operations.ts

export class VaultOperationsService {
  async depositToVault(
    vaultAddress: string,
    amount: string,
    walletAddress: string,  // User's wallet - not vault specific!
    chainId: number
  ): Promise<TransactionResult> {
    // Wallet signs transaction to interact with vault
    // Same wallet can interact with MULTIPLE vaults
    
    const vaultContract = new ethers.Contract(
      vaultAddress,
      VAULT_ABI,
      this.signer  // From wallet
    );
    
    const tx = await vaultContract.deposit(
      ethers.parseUnits(amount, token.decimals)
    );
    
    return {
      hash: tx.hash,
      vaultAddress: vaultAddress,
      walletAddress: walletAddress,
      amount: amount
    };
  }
}
```

---

## Interaction Matrix: Wallet ↔ Vault

```
┌──────────────────────────────────────────────────────────┐
│              USER'S WALLET (0x1234...)                    │
│                 (Holds Private Key)                       │
└──────────────────────────────────────────────────────────┘

    ↓ Signs transaction with wallet key ↓

┌──────────────────────────────────────────────────────────┐
│  TRANSACTION: Deposit $1000 CELO to Vault#1              │
│  ├─ Method: vault.deposit(1000e18)                       │
│  ├─ From: 0x1234... (wallet)                             │
│  ├─ To: 0x5678... (vault smart contract)                 │
│  ├─ Gas: Paid by wallet                                  │
│  └─ Signed: By wallet's private key                      │
└──────────────────────────────────────────────────────────┘

    ↓ Smart contract executes ↓

┌──────────────────────────────────────────────────────────┐
│      VAULT #1 STATE CHANGE (On-chain)                    │
│  ├─ Depositor: 0x1234... (wallet address)                │
│  ├─ Amount: 1000 CELO                                    │
│  ├─ Balance Update: 1000 → 2000 CELO                     │
│  └─ Yield Strategy: Activated (e.g., Aave)               │
└──────────────────────────────────────────────────────────┘

Wallet can now:
├─ Deposit to Vault#2
├─ Withdraw from Vault#1
├─ Stake tokens in Vault#3
└─ All with the SAME wallet address & key
```

---

## Creation Methods: Never Mix Them Up!

### ❌ WRONG: Creating vault without wallet
```typescript
// DON'T DO THIS
const newVault = await vaultService.createVault({
  name: "My Vault",
  primaryCurrency: "CELO"
  // Missing: Who controls this vault?
  // Missing: What wallet will interact with it?
});
```

### ✅ CORRECT: Wallet first, then vault
```typescript
// Step 1: User connects wallet
const { walletAddress } = await useWallet();
// Result: 0x1234...

// Step 2: Create vault tied to that wallet user
const newVault = await vaultService.createVault({
  name: "My Vault",
  primaryCurrency: "CELO",
  userId: currentUser.id,    // Who owns this vault
  chainId: 42220             // On which chain
});
// Result: Vault smart contract deployed

// Step 3: Wallet deposits to vault
const deposit = await walletService.depositToVault(
  walletAddress,     // User's wallet (from step 1)
  vaultAddress,      // Vault contract (from step 2)
  "1000"             // Amount in CELO
);
// Result: Transaction signed by wallet, executed on vault
```

---

## File Structure: Clear Separation

```
server/
├── agent-wallet/                  ← WALLET MANAGEMENT
│   ├── index.ts                   (Exports all wallet services)
│   ├── types.ts                   (Wallet types, no vault types)
│   ├── wallet-operations.ts        (Send native tokens, approvals)
│   ├── token-utilities.ts          (Get token info, balances)
│   ├── wallet-gas-manager.ts       (Gas estimation)
│   ├── wallet-info.ts              (Wallet address, balance)
│   ├── wallet-persistence.ts       (Save/restore wallet config)
│   ├── wallet-provider-integrations.ts (9 wallet providers)
│   ├── networks-config.ts          (RPC endpoints, chain config)
│   └── defi-service.ts             (DeFi operations)
│
└── services/vault/                ← VAULT MANAGEMENT
    ├── vault-creation.ts           (Deploy new vault contracts)
    ├── vault-operations.ts         (Deposit, withdraw, stake)
    ├── vault-utilities.ts          (Vault info, calculations)
    ├── vault-governance.ts         (DAO voting, proposals)
    ├── vault-helpers.ts            (Helper functions)
    ├── vault-analytics.ts          (Performance, metrics)
    └── types.ts                    (Vault types only)

NO MIXING: Never import vault types into agent-wallet or vice versa
```

---

## Database Schema: Ownership Clarity

```sql
-- Wallet table (user authentication)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  walletAddress TEXT UNIQUE,   -- 0x1234...
  walletProvider TEXT,         -- 'metamask', 'walletconnect', 'minipay'
  createdAt TIMESTAMP
);

-- Vault table (fund containers)
CREATE TABLE vaults (
  id UUID PRIMARY KEY,
  address TEXT UNIQUE,         -- 0x5678... (smart contract)
  userId UUID REFERENCES users(id),  -- Who owns this vault
  daoId UUID,                  -- Or DAO owns it
  primaryCurrency TEXT,
  yieldStrategy TEXT,
  chainId INTEGER
);

-- Vault interactions (wallet using vault)
CREATE TABLE vaultDeposits (
  id UUID PRIMARY KEY,
  vaultId UUID REFERENCES vaults(id),
  depositorAddress TEXT,       -- From wallet (0x1234...)
  amount TEXT,
  txHash TEXT,
  createdAt TIMESTAMP
);

KEY POINT: 
- users.walletAddress = Wallet address
- vaults.address = Smart contract address
- vaultDeposits.depositorAddress = Transaction came from THIS wallet
```

---

## Sequence Diagram: Full Flow

```
User                Browser              Agent Wallet         Vault Service
 │                    │                      │                     │
 │ 1. "Connect Wallet"│                      │                     │
 ├──────────────────→ │                      │                     │
 │                    │ 2. Check MetaMask   │                      │
 │                    ├──────────────────→ │                      │
 │                    │ Installed: YES      │                      │
 │                    │ ← ─ ─ ─ ─ ─ ─ ─ ─ ─┤                      │
 │                    │ 3. Connect Request │                      │
 │                    ├──────────────────→ │                      │
 │ 4. Authorize in    │ ← ─ ─ ─ ─ ─ ─ ─ ─ ─┤                      │
 │    MetaMask        │                      │                      │
 ├ ─ ─ ─ ─ ─ ─ ─ ─ ─>│                      │                      │
 │                    │ 5. Account: 0x1234..│                      │
 │                    │ ← ─ ─ ─ ─ ─ ─ ─ ─ ─┤                      │
 │ 6. Wallet Connected│ Show "0x...4"       │                      │
 │ (address visible)  │ ← ─ ─ ─ ─ ─ ─ ─ ─ ─┤                      │
 │                    │                      │                      │
 │ 7. "Create Vault"  │                      │                      │
 ├──────────────────→ │                      │                      │
 │                    │ 8. Create Vault Req │                      │
 │                    ├─────────────────────────────────────────→ │
 │                    │                      │                      │
 │                    │                      │ 9. Deploy Smart    │
 │                    │                      │    Contract         │
 │                    │                      │ 10. Vault: 0x5678..│
 │                    │                      │ ← ─ ─ ─ ─ ─ ─ ─ ─ ─┤
 │ 11. Vault Created  │                      │                      │
 │ (0x5678...)        │ ← ─ ─ ─ ─ ─ ─ ─ ─ ─┤                      │
 │                    │                      │                      │
 │ 12. "Deposit 1000" │                      │                      │
 ├──────────────────→ │                      │                      │
 │                    │ 13. Wallet signs tx │                      │
 │                    │     (0x1234 → 0x5678)                     │
 │ 14. Sign in        │                      │                      │
 │     MetaMask       │                      │                      │
 ├ ─ ─ ─ ─ ─ ─ ─ ─ ─>│                      │                      │
 │                    │ 15. Deposit request │                      │
 │                    ├─────────────────────────────────────────→ │
 │                    │                      │ 16. Execute deposit │
 │                    │                      │     Update balance  │
 │                    │                      │ ← ─ ─ ─ ─ ─ ─ ─ ─ ─┤
 │ 17. "Deposit       │                      │                      │
 │      Complete!"    │ ← ─ ─ ─ ─ ─ ─ ─ ─ ─┤                      │
 │                    │                      │                      │
```

---

## API Endpoints: Wallet vs Vault

### Wallet Endpoints (User Authentication)
```
POST   /api/wallet/connect
       Body: { provider: 'metamask' | 'walletconnect' | 'minipay' }
       Returns: { walletAddress, chainId, balance }

POST   /api/wallet/disconnect
       Returns: { success: true }

GET    /api/wallet/info
       Returns: { address, balance, chainId, provider }

POST   /api/wallet/switch-chain
       Body: { chainId: number }
       Returns: { chainId, gasPrice }
```

### Vault Endpoints (Fund Management)
```
POST   /api/vaults/create
       Body: { name, primaryCurrency, yieldStrategy, userId }
       Returns: { vaultId, address, createdAt }

POST   /api/vaults/:vaultId/deposit
       Body: { amount, walletAddress }  ← Wallet address, not vault-specific
       Returns: { txHash, amount, deposited }

GET    /api/vaults/:vaultId
       Returns: { vaultId, address, balance, yieldStrategy, deposits }

POST   /api/vaults/:vaultId/withdraw
       Body: { amount, walletAddress }
       Returns: { txHash, amount, withdrawn }
```

---

## Summary

| Aspect | WALLET | VAULT |
|--------|--------|-------|
| **What** | Private key holder | Smart contract container |
| **Who Creates** | User (MetaMask/Ledger/Minipay) | Developer/Admin (smart contract) |
| **How Many** | 1 per user | Many (one per strategy) |
| **Storage** | Browser/Phone/Hardware | Blockchain |
| **Lifetime** | Session-based | Permanent on-chain |
| **Controls** | Keys & signatures | Smart contract logic |
| **Per Chain** | Same across chains | One per chain+purpose |
| **File Location** | `server/agent-wallet/` | `server/services/vault/` |
| **DB Table** | `users` (walletAddress) | `vaults` (address) |
| **Creation Order** | **FIRST** (user connects) | **SECOND** (after wallet) |

### 🎯 Rule: Always Create Wallet BEFORE Vault

```typescript
// Correct sequence
1. Connect wallet (from browser extension/app)
2. Get wallet address: 0x1234...
3. Create vault (smart contract)
4. Wallet deposits to vault

// Wrong sequence (will fail)
1. Create vault ❌ (no owner)
2. Then connect wallet ❌ (too late)
```

---

## Next Steps

1. **Review Current Implementation**: Check if vaults being created without wallet owner reference
2. **Separate Creation Methods**: Ensure separate flows in UI/API for wallet vs vault
3. **Update Documentation**: Point devs to this file for clarity
4. **Audit Database**: Verify every vault has userId or daoId (clear ownership)
5. **Test Flows**: Verify user must connect wallet before creating vault
