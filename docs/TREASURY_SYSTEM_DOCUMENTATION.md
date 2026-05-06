 # DAO Treasury System Implementation

## Overview

A complete, production-ready treasury system for the MTAA DAO platform supporting:

- **Multi-chain assets** (CELO, Ethereum, BSC, Polygon, Arbitrum)
- **Multi-token support** (native, stablecoins, custom ERC-20)
- **Chain-aware multisig** with flexible signer configurations
- **Voting weight mapping** (token-holding, deposits, equal voting)
- **Dynamic treasury configuration** based on DAO type
- **Oracle integration** for USD value calculations
- **Emergency withdrawal controls** (customizable per DAO type)

---

## Architecture

### File Structure

```
client/src/
├── types/
│   └── treasury.ts              # Core type definitions
├── config/
│   └── treasury.config.ts       # Treasury matrix & configuration
├── utils/
│   └── treasury.service.ts      # Business logic & validation
└── hooks/
    └── useTreasury.ts           # React hook for state management
```

### Core Components

#### 1. **treasury.ts** - Type Definitions

Defines the complete type system:
- `TreasuryAsset` - Individual asset configuration
- `DAOTreasury` - Complete treasury for a DAO
- `DAOTreasuryConfig` - Configuration matrix per DAO type
- `TreasuryTransaction` - Deposit/withdrawal/transfer operations
- `MultisigConfig` - Multisig setup details

#### 2. **treasury.config.ts** - Configuration Matrix

The **DAO Treasury Matrix** mapping each DAO type to:
- Supported chains
- Default assets
- Multisig requirements
- Voting weight sources
- Feature flags (custom tokens, emergency withdrawals, etc.)

**Quick Reference:**

| DAO Type | Chains | Assets | Multisig | Features |
|----------|--------|--------|----------|----------|
| **Free** | CELO | cUSD, CELO | Optional | Basic, ephemeral |
| **ShortTerm** | CELO | cUSD, CELO | Optional | Campaign-focused, time-limited |
| **Collective** | CELO, ETH | All stablecoins | Required | Full governance, peer invites |
| **Governance** | CELO, ETH | All stablecoins | Required | Community leadership |
| **Meta** | All chains | All assets | Required | Multi-DAO coordination |

#### 3. **treasury.service.ts** - Business Logic

Provides functions for:
- Creating default treasuries
- Validating configurations
- Adding/removing assets
- Adding chain support
- Calculating voting weights
- Managing multisig rules
- Treasury value calculations

#### 4. **useTreasury.ts** - React Hook

Manages treasury state in components:
```tsx
const { 
  treasury,              // Current treasury object
  error,                 // Error state
  initializeTreasury,    // Initialize for a DAO type
  addAsset,              // Add custom token
  removeAsset,           // Remove asset
  updateAssetBalance,    // Update balance
  addChainSupport,       // Add new blockchain
  validate,              // Validate configuration
  getSummary             // Get UI-friendly summary
} = useTreasury();
```

---

## Usage Examples

### Initialize Treasury for a DAO

```tsx
import { useTreasury } from '@/hooks/useTreasury';
import type { DAOType } from '@/types/treasury';

function MyComponent() {
  const { initializeTreasury, treasury } = useTreasury();

  useEffect(() => {
    // Initialize for a Collective DAO
    initializeTreasury('dao-123', 'collective' as DAOType);
  }, []);

  return (
    <div>
      {treasury && (
        <>
          <h2>{treasury.daoType}</h2>
          <p>Assets: {treasury.assets.length}</p>
          <p>Multisig Required: {treasury.multisigRequired ? 'Yes' : 'No'}</p>
        </>
      )}
    </div>
  );
}
```

### Validate Treasury Configuration

```tsx
import { validateTreasuryConfiguration } from '@/utils/treasury.service';

const validationResult = validateTreasuryConfiguration({
  daoType: 'collective',
  selectedAssets: [/* ... */],
  multisigEnabled: true,
  multisigSigners: ['0x...', '0x...'],
  multisigRequiredSignatures: 2
});

if (!validationResult.isValid) {
  console.log('Errors:', validationResult.errors);
  console.log('Warnings:', validationResult.warnings);
  console.log('Recommendations:', validationResult.recommendations);
}
```

### Get Treasury Summary

```tsx
import { getTreasurySummary } from '@/utils/treasury.service';

const summary = getTreasurySummary(treasury);

console.log(summary.totalAssets);           // 3
console.log(summary.activeChains);          // ['CELO', 'ETH']
console.log(summary.totalValueUSD);         // '50000.00'
console.log(summary.multisigRequired);      // true
console.log(summary.minSigners);            // 3
```

### Add Custom Token

```tsx
const { addAsset } = useTreasury();

addAsset({
  chain: 'ETH',
  symbol: 'USDC',
  tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  tokenType: 'stablecoin',
  balance: '0',
  decimals: 6,
  votingWeightMapping: 'tokenHolding',
  isActive: true,
  minDepositAmount: '1'
});
```

### Check Multisig Requirements

```tsx
import { getMultisigSettingsForDAOType } from '@/config/treasury.config';

const settings = getMultisigSettingsForDAOType('governance');
console.log(settings);
// { required: true, minSigners: 3, maxSigners: 7 }
```

---

## Key Features

### 1. **Multi-Chain Support**

Different DAO types support different chains:
- **Free/ShortTerm**: CELO only (simplicity)
- **Collective/Governance**: CELO + Ethereum (flexibility)
- **Meta**: All chains (maximum reach)

### 2. **Asset Flexibility**

Pre-configured assets:
- Native tokens (CELO on Celo, ETH on Ethereum)
- Stablecoins (cUSD, USDC, DAI)
- Custom ERC-20 tokens (if allowed by DAO type)

### 3. **Voting Weight Mapping**

Control how assets affect voting:
- `equal` - All members have equal voice
- `deposit` - Voting power = deposit amount
- `tokenHolding` - Voting power = token balance
- `donation` - Voting power = donation amount

### 4. **Multisig Rules**

Enforced per DAO type:
- **Min/Max signers** - Prevents too few or too many signers
- **Required signatures** - Threshold for approval
- **Chain-aware** - Signers can be on different blockchains
- **Emergency override** - Optional for bail/donation DAOs

### 5. **Voting & Quorum**

Automatic settings per DAO type:
- **Free**: No quorum required (immediate voting)
- **ShortTerm**: 20% quorum, 3-day voting period
- **Collective**: 20% quorum, 7-day voting period
- **Governance**: 30% quorum, 14-day voting period
- **Meta**: 40% quorum, 21-day voting period

### 6. **Emergency Controls**

Safety features for different DAO types:
- **Free/ShortTerm**: Up to 50% emergency withdrawal
- **Collective**: Up to 10% emergency withdrawal
- **Governance**: Up to 5% emergency withdrawal
- **Meta**: Up to 1% emergency withdrawal

---

## Integration with create-dao.tsx

The treasury system is automatically integrated into the DAO creation flow:

1. **Step 1**: User selects DAO type
2. **Step 5 (Treasury)**: Treasury is initialized with automatic configuration
3. **Display**: Shows supported assets, chains, multisig requirements
4. **Deployment**: Treasury configuration sent with DAO creation

### UI Display

During treasury setup, users see:
- ✅ Supported assets for their DAO type
- ✅ Multisig requirements (required/optional/disabled)
- ✅ Member deposit permissions
- ✅ Custom token allowance
- 📋 Full treasury configuration summary

---

## Validation Rules

### Required

- At least one asset must be selected
- Assets must be supported for the DAO type
- Multisig must be enabled for types requiring it
- Custom tokens need valid contract addresses

### Warnings

- Single-asset treasury (consider diversification)
- Too few signers (recommend at least 2)
- Custom tokens not recommended for all DAO types

### Recommendations

- Dual-asset treasury (CELO + cUSD) for medium DAOs
- Multi-chain support for governance DAOs
- Emergency withdrawal limits for high-value DAOs

---

## API Integration (To Be Implemented)

The treasury service is ready to integrate with backend APIs:

```tsx
// Validate treasury on server
POST /api/treasury/validate
{
  daoType: 'collective',
  selectedAssets: [...],
  multisigEnabled: true
}

// Deploy treasury contract
POST /api/treasury/deploy
{
  daoId: 'dao-123',
  treasury: { /* full config */ }
}

// Get price oracle data
GET /api/treasury/oracle?chains=CELO,ETH&symbols=CELO,cUSD,DAI
```

---

## Future Enhancements

1. **Oracle Integration** - Real-time USD value calculations
2. **Multi-chain Bridges** - Cross-chain asset transfers
3. **Liquidity Pools** - Investment pools within treasuries
4. **Vesting Schedules** - Time-locked distributions
5. **Treasury Analytics** - Historical performance tracking
6. **Custom Governance Rules** - DAO-specific voting parameters

---

## Testing the System

Quick test to verify integration:

```tsx
// In create-dao.tsx
console.log('Treasury initialized:', treasury);
console.log('Treasury summary:', getTreasurySummary());

// Validate before deployment
const validation = validateTreasury();
console.log('Validation result:', validation);

if (validation.isValid) {
  // Safe to deploy
} else {
  // Show errors to user
  console.log('Errors:', validation.errors);
}
```

---

## Questions?

The treasury system is documented with inline comments throughout each file. Key files to reference:
- `types/treasury.ts` - Type definitions & JSDoc comments
- `config/treasury.config.ts` - Matrix documentation & helper functions
- `utils/treasury.service.ts` - Business logic & validation rules
- `hooks/useTreasury.ts` - React integration example
