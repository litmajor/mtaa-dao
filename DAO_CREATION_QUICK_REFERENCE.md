# DAO Creation - Quick Reference

## What Changed?

The DAO creation endpoint (`/api/dao-deploy`) has been fully implemented with **real founder wallet support** instead of mocking.

### Before
```typescript
// Just a stub returning a message
export async function daoDeployHandler(req: Request, res: Response) {
  res.json({ message: 'DAO deploy endpoint migrated to Express.' });
}
```

### After
```typescript
// Complete implementation with:
✅ Wallet address validation
✅ DAO record creation
✅ Treasury vault creation with founder wallet
✅ Founder membership setup
✅ Invited members management
✅ Comprehensive error handling
```

## How It Works

### 1. User connects wallet
- MetaMask, WalletConnect, or other EVM wallet
- Gets wallet address (0x...)

### 2. User creates DAO via form
- Fills in: name, description, category, etc.
- Frontend includes `founderWallet: walletAddress`

### 3. API processes request
```
POST /api/dao-deploy
├─ Validate wallet address (viem.isAddress)
├─ Create DAO record in database
├─ Create treasury vault with founder wallet address
├─ Add founder as admin member
├─ Add invited members as pending
└─ Return DAO details
```

### 4. Response includes
```typescript
{
  daoId: "uuid",              // Unique DAO ID
  daoAddress: "0x...",        // Founder wallet (treasury address)
  treasuryAddress: "0x...",   // Real wallet address
  treasuryVaultId: "uuid",    // Database vault ID
  // ... more details
}
```

## Database Tables Involved

| Table | Purpose | Key Field |
|-------|---------|-----------|
| `daos` | DAO records | `id`, `founderId`, `createdAt` |
| `vaults` | Treasury storage | `daoId`, `address` (founder wallet), `vaultType: 'dao_treasury'` |
| `daoMemberships` | Member roles | `userId`, `role: 'admin'`, `status: 'approved'` |
| `users` | User data | `walletAddress` (for member lookup) |

## Key Implementation Details

### Wallet Validation
```typescript
import { isAddress } from 'viem';

if (!isAddress(daoData.founderWallet)) {
  return res.status(400).json({
    error: 'Invalid founder wallet address'
  });
}
```

### Treasury Vault Creation
```typescript
await db.insert(vaults).values({
  daoId: createdDao.id,
  address: daoData.founderWallet,        // ✅ Real wallet
  vaultType: 'dao_treasury',
  isActive: true,
  // ...
});
```

### Founder as Admin
```typescript
await db.insert(daoMemberships).values({
  daoId: createdDao.id,
  userId: userId,                        // Founder user
  role: 'admin',                         // Admin privileges
  status: 'approved',                    // Immediately approved
  // ...
});
```

## API Endpoint

**POST** `/api/dao-deploy`

**Aliases**: 
- `/api/dao-deploy` (client uses this)
- `/api/dao/deploy` (alternative)

**Auth**: Required

**Request**:
```typescript
{
  name: string;
  founderWallet: string;           // User's connected wallet
  category: string;
  treasuryType: string;            // 'cUSD' | 'CELO' | 'dual'
  governanceModel: string;
  quorum: number;                  // 20-100%
  votingPeriod: string;            // '7d', '3d', etc.
  members: Array<{                 // Invited members
    address: string;
    role: string;
    name: string;
  }>;
}
```

**Response** (201):
```typescript
{
  success: true,
  data: {
    daoId: string;
    daoAddress: string;            // Founder wallet
    treasuryAddress: string;       // Same as above
    name: string;
    // ...
  }
}
```

## Testing It

### 1. Setup
```bash
# Make sure backend is running
npm run dev

# Frontend should connect wallet
```

### 2. Create DAO
1. Go to `/create-dao`
2. Connect wallet (MetaMask, etc.)
3. Fill form with DAO details
4. Click create
5. Should redirect to success page (step 6)

### 3. Verify in Database
```sql
-- Check DAO was created
SELECT * FROM daos ORDER BY created_at DESC LIMIT 1;

-- Check treasury vault
SELECT * FROM vaults 
WHERE vault_type = 'dao_treasury' 
ORDER BY created_at DESC LIMIT 1;

-- Check founder membership
SELECT * FROM dao_memberships 
WHERE role = 'admin' 
ORDER BY created_at DESC LIMIT 1;
```

## Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| "Invalid founder wallet address" | Bad format | Use valid 0x address |
| "Missing required fields" | name or founderWallet missing | Fill all fields |
| "User not authenticated" | No auth token | Login first |
| "Failed to create DAO record" | DB error | Check database connection |

## Configuration

### Quorum Range
```typescript
// Automatically clamped to 20-100%
const quorum = Math.max(20, Math.min(100, userInput));
```

### Voting Period Conversion
```typescript
'7d'  → 7 days
'3d'  → 3 days
'24h' → 1 day
'48h' → 2 days
```

### Treasury Types
```typescript
'cUSD'  → Celo Dollars (stable)
'CELO'  → Native CELO token
'dual'  → Mix of CELO + cUSD
```

## Files Changed

1. **server/api/dao_deploy.ts** - Implemented full handler
2. **server/routes.ts** - Added route aliases for compatibility

## No Changes To

- Client-side form (`client/src/pages/create-dao.tsx`)
- Database schemas (already support DAOs + vaults)
- Wallet utilities (using existing crypto tools)
- Storage layer (createDao method unchanged)

## Next Steps

1. ✅ Founder wallet implementation
2. Next: Deploy smart contracts for DAO governance
3. Next: On-chain treasury tracking
4. Next: Proposal creation for new DAOs
5. Next: Webhook notifications

---

**Status**: ✅ **COMPLETE** - Real founder wallet implementation done
