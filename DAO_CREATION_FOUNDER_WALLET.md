# DAO Creation with Real Founder Wallet Implementation

## Overview

The DAO creation system has been updated to support **real founder wallet implementation** instead of mocking. When a user creates a DAO, their connected wallet becomes the DAO's treasury address.

## Architecture

### Client Flow (create-dao.tsx)

```
User connects wallet
    ↓
User fills DAO creation form
    ↓
Form sends founderWallet = walletAddress to API
    ↓
POST /api/dao-deploy with DAO data including founderWallet
```

**Key Data Sent:**
```typescript
{
  name: string;                    // DAO name
  description: string;             // DAO description
  founderWallet: string;           // User's connected wallet address (0x...)
  category: string;                // DAO category (savings, chama, investment, etc.)
  treasuryType: string;            // cUSD, CELO, or dual
  initialFunding?: string;         // Optional initial funding amount
  governanceModel: string;         // 1-person-1-vote, weighted-stake, delegated
  quorum: number;                  // 20-100%
  votingPeriod: string;            // '7d', '3d', etc.
  visibility: string;              // 'public' or 'private'
  members: Array<{                 // Invited members
    address: string;               // Wallet address
    role: string;                  // member, moderator, treasurer, governor
    name: string;                  // Display name
  }>;
}
```

### Backend Flow (dao_deploy.ts)

#### Step 1: Authentication & Validation
```typescript
// Verify user is authenticated
const userId = (req.user as any)?.id;
if (!userId) return error;

// Validate required fields
if (!daoData.name || !daoData.founderWallet) return error;

// Validate wallet address format (must be valid EVM address)
if (!isAddress(daoData.founderWallet)) return error;
```

#### Step 2: DAO Record Creation
```typescript
const daoRecord = await db.insert(daos).values({
  id: uuidv4(),                              // Unique DAO ID
  name: daoData.name,
  description: daoData.description,
  creatorId: userId,                         // User who created it
  founderId: userId,                         // Founder (creator)
  category: daoData.category,
  visibility: daoData.visibility || 'public',
  treasuryBalance: daoData.initialFunding || '0',
  quorumPercentage: daoData.quorum,          // Validated 20-100%
  votingPeriod: parseToDays(daoData.votingPeriod), // Convert to days
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date()
});
```

#### Step 3: Treasury Vault Creation
```typescript
// Create vault linked to founder wallet
const vaultRecord = await db.insert(vaults).values({
  daoId: createdDao.id,                      // Link to DAO
  userId: null,                              // DAO vault (not personal)
  name: `${createdDao.name} Treasury`,
  currency: daoData.treasuryType || 'cUSD',
  address: daoData.founderWallet,            // ✅ Real wallet address
  balance: daoData.initialFunding || '0',
  vaultType: 'dao_treasury',                 // Identifies as DAO treasury
  isActive: true,
  riskLevel: 'low',
  createdAt: new Date(),
  updatedAt: new Date()
});
```

**Key Point**: The founder's connected wallet address is stored in `vaults.address`. This is the **real wallet address** that will receive/hold DAO treasury funds.

#### Step 4: Founder Membership
```typescript
// Add founder as admin
await db.insert(daoMemberships).values({
  daoId: createdDao.id,
  userId: userId,                            // Founder user ID
  role: 'admin',                             // Admin privileges
  status: 'approved',                        // Immediately approved
  joinedAt: new Date(),
  createdAt: new Date()
});
```

#### Step 5: Invite Other Members
```typescript
// For each invited member
for (const member of daoData.members) {
  // Find user by wallet address
  const memberUser = await db.query.users.findFirst({
    where: eq(users.walletAddress, member.address)
  });

  if (memberUser) {
    // Add as pending member (needs approval)
    await db.insert(daoMemberships).values({
      daoId: createdDao.id,
      userId: memberUser.id,
      role: member.role || 'member',
      status: 'pending',                     // Must be approved by user
      joinedAt: new Date(),
      createdAt: new Date()
    });
  }
}
```

#### Step 6: Return Response
```typescript
res.status(201).json({
  success: true,
  message: 'DAO created successfully',
  data: {
    daoId: createdDao.id,
    daoAddress: daoData.founderWallet,       // Founder wallet as DAO address
    name: createdDao.name,
    treasuryVaultId: vaultRecord[0].id,
    treasuryAddress: daoData.founderWallet,  // Real wallet address for treasury
    treasuryType: daoData.treasuryType,
    status: createdDao.status,
    createdAt: createdDao.createdAt,
    memberCount: 1                            // Just founder
  }
});
```

## Database Schema

### daos Table
```typescript
{
  id: uuid,                          // Unique DAO identifier
  name: varchar,                     // DAO name
  description: text,
  creatorId: varchar,                // User who created DAO
  founderId: varchar,                // Founder/creator
  category: varchar,
  visibility: varchar,               // 'public' | 'private'
  treasuryBalance: decimal,          // Total treasury balance
  quorumPercentage: integer,         // Voting quorum (20-100%)
  votingPeriod: integer,             // In days
  status: varchar,                   // 'active' | 'archived' | 'suspended'
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### vaults Table (DAO Treasury)
```typescript
{
  id: uuid,
  daoId: uuid,                       // Links to DAO (NOT null for DAO vaults)
  userId: varchar,                   // NULL for DAO treasury (not personal)
  name: varchar,                     // "DAO Name Treasury"
  currency: varchar,                 // 'cUSD' | 'CELO' | 'dual'
  address: varchar,                  // ✅ Founder wallet address (real wallet)
  balance: decimal,                  // Current balance
  vaultType: varchar,                // 'dao_treasury'
  isActive: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### daoMemberships Table
```typescript
{
  daoId: uuid,
  userId: varchar,
  role: varchar,                     // 'admin' | 'governor' | 'treasurer' | 'moderator' | 'member'
  status: varchar,                   // 'approved' | 'pending' | 'rejected'
  joinedAt: timestamp,
  createdAt: timestamp
}
```

## Key Features

### 1. Real Wallet Integration
- ✅ Founder wallet address is stored in `vaults.address`
- ✅ Treasury vault is created with real wallet as the address
- ✅ No mock addresses or placeholders

### 2. Wallet Validation
- Uses `viem`'s `isAddress()` to validate EVM addresses
- Ensures only valid Celo addresses are accepted (0x format)

### 3. Member Management
- Founder is automatically added as admin
- Invited members are added as pending
- Members must accept invitation to join

### 4. Configuration Flexibility
```typescript
// Governance Model (defined in frontend, stored in DAO)
- '1-person-1-vote': Equal voting power
- 'weighted-stake': Vote weight by contribution
- 'delegated': Can delegate votes

// Quorum (20-100% range)
- Validated and clamped to 20-100%

// Voting Period
- Supports '7d', '3d', '24h' etc.
- Converted to days for storage
```

## API Routes

### POST /api/dao-deploy
**Endpoint**: Create new DAO with founder wallet

**Route Aliases**:
- `/api/dao-deploy` (for client compatibility)
- `/api/dao/deploy` (alternative)

**Authentication**: Required (`isAuthenticated` middleware)

**Request Body**:
```typescript
{
  name: string;
  description: string;
  founderWallet: string;              // Connected wallet
  category: string;
  treasuryType: string;
  initialFunding?: string;
  governanceModel: string;
  quorum: number;
  votingPeriod: string;
  visibility: string;
  members: Array<{ address, role, name }>;
}
```

**Success Response** (201):
```typescript
{
  success: true,
  message: 'DAO created successfully',
  data: {
    daoId: string;
    daoAddress: string;                // Founder wallet
    name: string;
    treasuryVaultId: string;
    treasuryAddress: string;           // Real wallet address
    treasuryType: string;
    status: string;
    createdAt: Date;
    memberCount: number;
  }
}
```

**Error Response** (400/401/500):
```typescript
{
  success: false,
  error: string;                       // Error message
  details?: string;                    // Stack trace (dev only)
}
```

## Error Handling

### Validation Errors (400)
- Missing required fields (name, founderWallet)
- Invalid wallet address format
- Invalid input data

### Authentication Errors (401)
- User not authenticated
- Invalid or expired token

### Server Errors (500)
- Database operation failures
- Unexpected exceptions

## Security Considerations

1. **Wallet Validation**: All wallet addresses are validated using `viem`'s `isAddress()`
2. **Authentication**: All requests require authenticated user
3. **Founder Privilege**: Only creator can act as founder
4. **Member Status**: Invited members must accept before joining
5. **Treasury Isolation**: DAO treasury vault is separate from personal vaults

## Transaction Flow

```
1. User connects wallet (MetaMask, WalletConnect, etc.)
2. User fills DAO form with founderWallet = their connected wallet
3. Form submitted to POST /api/dao-deploy
4. Backend validates wallet address
5. Backend creates DAO record
6. Backend creates treasury vault with real wallet address
7. Backend creates founder membership (admin role)
8. Backend adds invited members (pending status)
9. Response includes daoId and treasuryAddress
10. Frontend navigates to DAO success page (step 6)
```

## Testing Checklist

### Unit Tests
- [ ] Validate wallet address format
- [ ] Parse voting period string to days
- [ ] Clamp quorum to 20-100% range

### Integration Tests
- [ ] Create DAO with all fields
- [ ] Create DAO with minimal fields
- [ ] Add founder as admin
- [ ] Add invited members as pending
- [ ] Return correct DAO ID and treasury address

### End-to-End Tests
- [ ] Connect wallet
- [ ] Fill form and submit
- [ ] Verify DAO created
- [ ] Verify treasury vault created
- [ ] Verify founder is admin
- [ ] Verify invited members pending

### Error Cases
- [ ] Missing name or founderWallet
- [ ] Invalid wallet address format
- [ ] Unauthenticated request
- [ ] Database connection failure

## Migration from Mock

### Before (Mocked)
```typescript
// Stub endpoint
export async function daoDeployHandler(req: Request, res: Response) {
  res.json({ message: 'DAO deploy endpoint migrated to Express.' });
}
```

### After (Real Implementation)
```typescript
// Full implementation with:
// 1. Wallet validation
// 2. DAO creation
// 3. Treasury vault creation
// 4. Member management
// 5. Error handling
```

## Future Enhancements

1. **Smart Contract Deployment**: Deploy actual DAO governance contract to blockchain
2. **On-Chain Treasury**: Store vault address on-chain
3. **Multi-Sig Support**: Allow multiple signers for treasury
4. **Token Issuance**: Mint governance tokens for DAO
5. **Proposal System**: Create initial proposals for new DAOs
6. **Webhook Integration**: Notify team when DAO created
7. **Analytics**: Track DAO creation metrics

## Related Files

- `server/api/dao_deploy.ts` - Handler implementation
- `server/routes.ts` - Route registration
- `client/src/pages/create-dao.tsx` - Frontend form
- `shared/schema.ts` - Database schemas
- `server/utils/logger.ts` - Logging service

## Debugging

### Enable Debug Logging
```typescript
// In dao_deploy.ts
logger.info(`Creating DAO: ${daoData.name} with founder wallet: ${daoData.founderWallet}`);
logger.info(`DAO created with ID: ${createdDao.id}`);
logger.info(`Treasury vault created for DAO: ${createdDao.id}`);
logger.error(`DAO deployment failed: ${error.message}`, error);
```

### Check Database
```sql
-- Verify DAO created
SELECT * FROM daos WHERE name = 'My DAO';

-- Verify treasury vault
SELECT * FROM vaults WHERE dao_id = 'dao-id' AND vault_type = 'dao_treasury';

-- Verify founder membership
SELECT * FROM dao_memberships WHERE dao_id = 'dao-id' AND role = 'admin';
```

## Support

For issues with DAO creation:
1. Check error message in API response
2. Verify wallet address format (0x + 40 hex chars)
3. Verify user is authenticated
4. Check server logs with debug enabled
5. Verify database connection
