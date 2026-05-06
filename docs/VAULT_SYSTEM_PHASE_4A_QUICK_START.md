# Vault System Phase 4A - Developer Quick Start

**Status:** 🟢 Implementation Complete - Ready for Testing  
**Version:** 4.0  
**Last Updated:** 2025-02-24

---

## 📚 What's New This Phase

### Core Additions:
1. ✅ **Real DB allocate endpoints** (DAO + user vaults)
2. ✅ **Real DB rebalance endpoints** (DAO + user vaults)
3. ✅ **Vault ownership middleware** (access + operation guards)
4. ✅ **Type validators** (7 vault types with constraints)
5. ✅ **Role-based permission model** (user/member/elder/admin)

---

## 🔌 Using the New Endpoints

### Allocate to Vault

**User Vault:**
```bash
POST /api/vaults/:vaultId/allocate
Authorization: Bearer {token}

{
  "amount": "1000.50",
  "currency": "cUSD",
  "assetId": "asset_eth_mainnet",
  "strategyId": "yield_strategy_1"  // optional
}

Response:
{
  "success": true,
  "allocation": {
    "vaultId": "vault_123",
    "amount": "1000.50",
    "currency": "cUSD",
    "transactionId": "alloc_1708707200_abc123",
    "allocatedAt": "2025-02-24T10:00:00Z"
  }
}
```

**DAO Vault:**
```bash
POST /v1/daos/:daoId/treasury/vaults/:vaultId/allocate
Authorization: Bearer {token}

{
  "amount": "50000",
  "currency": "cUSD",
  "assetId": "asset_dai_polygon",
  "strategyId": "pool_strategy_lending"
}

Response:
{
  "success": true,
  "allocation": {
    "id": "alloc_123",
    "amount": "50000",
    "currency": "cUSD",
    "strategyId": "pool_strategy_lending",
    "transactionId": "tx_456",
    "allocatedAt": "2025-02-24T10:00:00Z"
  }
}
```

### Rebalance Vault

**User Vault:**
```bash
POST /api/vaults/:vaultId/rebalance
Authorization: Bearer {token}

{
  "targetAllocations": {
    "ETH": 40,      // 40% in Ethereum
    "USDC": 30,     // 30% in stablecoin
    "DAI": 30       // 30% in DAI
  }
}

Response:
{
  "success": true,
  "rebalance": {
    "vaultId": "vault_123",
    "rebalanceId": "rebal_1708707200_xyz789",
    "targetAllocations": {
      "ETH": 40,
      "USDC": 30,
      "DAI": 30
    },
    "executedAt": "2025-02-24T10:05:00Z",
    "status": "completed"
  }
}
```

**DAO Vault:**
```bash
POST /v1/daos/:daoId/treasury/vaults/:vaultId/rebalance
Authorization: Bearer {token}

{
  "newAllocation": {
    "USDC": 50,     // Operations fund
    "DAI": 30,      // Growth reserve
    "cEUR": 20      // International
  }
}

Response:
{
  "success": true,
  "rebalance": {
    "vaultId": "vault_ops",
    "rebalanceId": "rebal_ops_123",
    "previousAllocation": {...},
    "newAllocation": {...},
    "executedAt": "2025-02-24T10:05:00Z",
    "status": "completed"
  }
}
```

---

## 🛡️ Middleware Usage

### Basic Access Check:
```typescript
import { vaultAccessGuard } from '../middleware/vaultOwnershipGuard';

router.get('/:vaultId', vaultAccessGuard, async (req, res) => {
  // req.vaultContext has:
  // - vaultId, ownerType, ownerId, vaultType, isActive
  // - userRole (for DAO vaults)
  // Only authenticated vault owner reaches here
});
```

### Operation-Specific Check:
```typescript
import { vaultOperationGuard } from '../middleware/vaultOwnershipGuard';

router.post('/:vaultId/withdraw', 
  vaultOperationGuard('withdraw'),  // Enforces role + operation
  async (req, res) => {
    // Only admins/elders can withdraw from DAO vaults
    // Only owners can withdraw from user vaults
});
```

### Multisig Enforcement:
```typescript
import { vaultOperationGuard, multisigEnforcer } from '../middleware/vaultOwnershipGuard';

router.post('/:vaultId/rebalance',
  vaultOperationGuard('rebalance'),
  multisigEnforcer,  // Verifies multisig if required
  async (req, res) => {
    if (req.multisigData) {
      // DAO DAO vault rebalance - multisig applied
      console.log(req.multisigData.approvers.length + ' approvals');
    }
});
```

---

## ✔️ Type Validation

### Validate Vault Operation:
```typescript
import { validateVaultOperation } from '../utils/vaultTypeValidators';

// User wants to allocate to a savings vault
const result = validateVaultOperation('savings', 'allocate');
// { allowed: false, reason: "savings vault does not allow manual allocations" }

// User wants to deposit to investment vault
const result2 = validateVaultOperation('investment', 'deposit');
// { allowed: true }
```

### Use Zod Schemas:
```typescript
import { depositSchema, rebalanceSchema } from '../utils/vaultTypeValidators';

// Validate deposit request
try {
  const validated = depositSchema.parse(req.body);
  // Safe to use validated.amount, validated.currency
} catch (error) {
  res.status(400).json({ error: error.message });
}
```

---

## 📋 Vault Type Reference

| Type | Deposit | Withdraw | Allocate | Rebalance | Lock | Use Case |
|------|---------|----------|----------|-----------|------|----------|
| **savings** | ✅ | ❌ | ❌ | ❌ | 30d | Fixed yield |
| **investment** | ✅ | ✅ | ✅ | ✅ | - | Active trading |
| **strategy** | ✅ | ✅ | ❌ | ❌ | - | Auto-execute |
| **investment-pool** | ✅ | ✅ | ❌ | ❌ | - | Multi-member fund |
| **escrow** | ✅ | ❌ | ❌ | ❌ | Var | Time-locked |
| **deployment** | ✅ | ❌ | ❌ | ❌ | - | Smart contract |
| **custom** | ✅ | ✅ | ✅ | ✅ | - | No constraints |

---

## 🔐 Permission Matrix

### User Vault Operations:
- ✅ Owner can: view, deposit, withdraw, allocate, rebalance, pause, resume, delete
- ❌ Others: No access

### DAO Vault Operations:
| Operation | Member | Elder+ | Admin | Multisig? |
|-----------|--------|--------|-------|----------|
| view | ✅ | ✅ | ✅ | - |
| deposit | ✅ | ✅ | ✅ | - |
| withdraw | ❌ | ✅ | ✅ | ✅ |
| allocate | ❌ | ✅ | ✅ | - |
| rebalance | ❌ | ✅ | ✅ | ✅ |
| pause | ❌ | ❌ | ✅ | - |
| resume | ❌ | ❌ | ✅ | - |
| delete | ❌ | ❌ | ✅ | - |

---

## 🗄️ Database Records Created

### Allocations:
```javascript
// vaultStrategyAllocations table
{
  id: 'alloc_123',
  vaultId: 'vault_456',
  strategyId: 'yield_eth',
  tokenSymbol: 'ETH',
  allocatedAmount: '10.5',
  allocationPercentage: '40',
  lastRebalance: '2025-02-24T10:00:00Z'
}
```

### Transactions:
```javascript
// vaultTransactions table
{
  id: 'tx_789',
  vaultId: 'vault_456',
  userId: 'user_123',
  transactionType: 'allocation',
  tokenSymbol: 'ETH',
  amount: '10.5',
  valueUSD: '28350',
  status: 'completed',
  createdAt: '2025-02-24T10:00:00Z'
}
```

---

## 🧪 Testing Examples

### Test Allocate with Type Validation:
```typescript
it('should allow allocation on investment vault', async () => {
  const vault = await createVault('investment');
  const res = await request(app)
    .post(`/api/vaults/${vault.id}/allocate`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      amount: '500',
      currency: 'cUSD',
      assetId: 'asset_eth'
    });
  
  expect(res.status).toBe(200);
  expect(res.body.allocation.transactionId).toBeDefined();
});

it('should reject allocation on savings vault', async () => {
  const vault = await createVault('savings');
  const res = await request(app)
    .post(`/api/vaults/${vault.id}/allocate`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      amount: '500',
      currency: 'cUSD',
      assetId: 'asset_eth'
    });
  
  expect(res.status).toBe(403);
  expect(res.body.error).toMatch(/savings vault does not allow/);
});
```

### Test Rebalance with Validation:
```typescript
it('should rebalance with valid percentages', async () => {
  const res = await request(app)
    .post(`/api/vaults/${vault.id}/rebalance`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      targetAllocations: {
        ETH: 50,
        USDC: 50
      }
    });
  
  expect(res.status).toBe(200);
  expect(res.body.rebalance.rebalanceId).toBeDefined();
});

it('should reject invalid allocation percentages', async () => {
  const res = await request(app)
    .post(`/api/vaults/${vault.id}/rebalance`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      targetAllocations: {
        ETH: 75,
        USDC: 15  // Total != 100
      }
    });
  
  expect(res.status).toBe(400);
});
```

---

## 📖 Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| `server/routes/vaults.ts` | Main vault endpoints | +170 |
| `server/routes/v1/daos/.../vaults.ts` | DAO vault endpoints | +200 |
| `server/middleware/vaultOwnershipGuard.ts` | Access control | 350 |
| `server/utils/vaultTypeValidators.ts` | Type constraints | 400 |

---

## 🚀 Next Steps

1. **Apply Middleware:** Add to all vault routes
2. **Run Tests:** Execute deposit/allocate/rebalance workflows
3. **Verify Multisig:** Test DAO operation thresholds
4. **Performance Test:** Load test allocation/rebalance operations
5. **Security Audit:** Verify access control boundaries

---

**Ready for Phase 4B: Testing & Integration** ✅

