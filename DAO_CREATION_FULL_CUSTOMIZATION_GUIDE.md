# DAO Creation Full Customization - Implementation Guide

## Quick Answers to Your Questions

### 1. Is DAO Creation User-Friendly? ❌ Partially
**Current**: Same 6-step flow for ALL DAO types
**Problem**: Savings groups shouldn't see governance options; governance DAOs need advanced settings
**Solution**: Type-first approach (Step 1: Choose DAO type)

### 2. Reflects Your Project? ❌ Missing Key Categories
**Current**: Generic (savings, chama, investment)
**Missing**: 
- Merry-go-round (core to Mtaa)
- Harambee funds (community contribution)
- Table banking (microfinance)
- Traders cooperatives
**Solution**: Replace with Mtaa-specific categories per DAO type

### 3. Different Groups/DAOs Supported? ⚠️ Not Yet Configured
**Have**: Database fields for `daoType` (free, short_term, collective, meta)
**Missing**: Frontend differentiation based on type
**Solution**: Add DAO Type selector, conditional rendering per type

### 4. Treasury Selection Wallet Type? ⚠️ Exists but Not Structured
**Current**: 
- cUSD, CELO, dual all available to all DAOs
- No limits or defaults per type
**Missing**: 
- Linking treasury options to DAO type requirements
- Spending limits based on type
- Multisig configuration

### 5. Multisig Setup Location? ❌ Wrong Place + Mocked
**Current**: Setup in `/api/wallet/multisig/create` AFTER DAO creation
**Problem**: 
- Not part of DAO creation flow
- Uses mock multisig (not real)
- Doesn't integrate with treasury service
**Solution**: Move to DAO deployment handler, use `treasuryMultisigService`

### 6. Short-Term DAOs Don't Need Governance? ✅ CORRECT
**Current**: All DAOs get governance options
**Correct**: Short-term DAOs (30-90 days) should skip governance entirely
**Implementation**: Conditional Step 2 (only show if not short-term)

---

## Full Implementation Plan

## STEP 1: Update Create-DAO Frontend (create-dao.tsx)

### 1.1 Add DAO Type Selector (New Step 1)
```typescript
// Add to create-dao.tsx - BEFORE Basic Info step

const daoTypeOptions = [
  {
    id: 'shortTerm',
    label: 'Short-Term Fund',
    icon: '⏱️',
    duration: '3-6 months',
    description: 'Quick rotating funds, burial support, harambee',
    examples: ['Merry-go-round', 'Burial fund', 'Event contribution'],
    requiresGovernance: false,
    defaultTreasuryType: 'cUSD'
  },
  {
    id: 'collective',
    label: 'Collective / Savings Group',
    icon: '🤝',
    duration: 'Ongoing',
    description: 'Regular savings, investment clubs, cooperatives',
    examples: ['Savings group', 'Table banking', 'Traders coop'],
    requiresGovernance: true,
    defaultTreasuryType: 'cUSD'
  },
  {
    id: 'governance',
    label: 'Governance DAO',
    icon: '🏛️',
    duration: 'Ongoing',
    description: 'Community leadership, major decisions',
    examples: ['Community council', 'District leadership'],
    requiresGovernance: true,
    defaultTreasuryType: 'dual'
  }
];

// Add to DaoData interface
interface DaoData {
  // ... existing fields
  daoType: 'shortTerm' | 'collective' | 'governance';
  duration?: number; // For short-term: 30, 60, or 90 days
}

// Add step to steps array
const steps = [
  { id: 1, title: 'DAO Type', icon: Settings },      // NEW
  { id: 2, title: 'Basic Info', icon: Settings },    // Was 1
  { id: 3, title: 'Governance', icon: Shield },      // Was 2 - CONDITIONAL
  { id: 4, title: 'Treasury', icon: Wallet },        // Was 3
  { id: 5, title: 'Members', icon: Users },          // Was 4
  { id: 6, title: 'Preview', icon: Eye },            // Was 5
  { id: 7, title: 'Success', icon: CheckCircle }     // Was 6
];

// Render DAO Type Selection
const renderDaoTypeSelection = () => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        What type of group is this?
      </h2>
      <p className="text-gray-600 dark:text-gray-400">
        Choose the structure that best fits your community
      </p>
    </div>

    <div className="grid gap-4">
      {daoTypeOptions.map(type => (
        <Card
          key={type.id}
          className={`cursor-pointer transition-all ${
            daoData.daoType === type.id
              ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/30'
              : 'hover:border-gray-300'
          }`}
          onClick={() => {
            updateDaoData('daoType', type.id);
            // Apply defaults
            updateDaoData('treasuryType', type.defaultTreasuryType);
          }}
        >
          <CardContent className="p-6">
            <div className="flex gap-4">
              <div className="text-4xl">{type.icon}</div>
              <div className="flex-1">
                <h3 className="text-lg font-bold">{type.label}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {type.description}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  ⏱️ Duration: {type.duration}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {type.examples.map(ex => (
                    <Badge key={ex} variant="outline" className="text-xs">
                      {ex}
                    </Badge>
                  ))}
                </div>
              </div>
              {daoData.daoType === type.id && (
                <CheckCircle className="w-6 h-6 text-teal-500 flex-shrink-0" />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);
```

### 1.2 Update Categories Per Type
```typescript
// Replace static categories with dynamic ones

const getCategoriesForType = (type: string) => {
  const categoriesByType = {
    shortTerm: [
      { value: 'merry-go-round', label: 'Merry-Go-Round', emoji: '🎡', description: 'Rotating savings group' },
      { value: 'harambee', label: 'Harambee Fund', emoji: '🙌', description: 'Community contribution event' },
      { value: 'burial', label: 'Burial/Bereavement', emoji: '🕊️', description: 'Support in loss' },
      { value: 'event', label: 'Event Fund', emoji: '🎉', description: 'Wedding, graduation, etc.' },
      { value: 'emergency', label: 'Emergency Relief', emoji: '🆘', description: 'Quick response fund' },
      { value: 'harvest', label: 'Harvest Pool', emoji: '🌾', description: 'Agricultural sharing' }
    ],
    collective: [
      { value: 'savings', label: 'Savings Group', emoji: '💰', description: 'Regular deposits with growth' },
      { value: 'table-banking', label: 'Table Banking', emoji: '🏦', description: 'Microfinance circle' },
      { value: 'investment', label: 'Investment Club', emoji: '📈', description: 'Pool for investments' },
      { value: 'traders-coop', label: 'Traders Cooperative', emoji: '🛍️', description: 'Market vendors' },
      { value: 'farmers-union', label: 'Farmers Union', emoji: '🚜', description: 'Agricultural collective' },
      { value: 'labor-group', label: 'Labor Group', emoji: '👷', description: 'Communal work' }
    ],
    governance: [
      { value: 'governance', label: 'Community Governance', emoji: '🏛️', description: 'Decision making body' },
      { value: 'social', label: 'Social Impact', emoji: '🌍', description: 'Community welfare' },
      { value: 'education', label: 'Education Fund', emoji: '🎓', description: 'Scholarships' },
      { value: 'health', label: 'Health Initiative', emoji: '🏥', description: 'Community health' }
    ]
  };
  return categoriesByType[type] || [];
};

// Update Step 2 Basic Info
const renderBasicInfo = () => {
  const categories = getCategoriesForType(daoData.daoType);
  return (
    // ... same as before but use categories instead of static
  );
};
```

### 1.3 Update Treasury Options Per Type
```typescript
// Dynamic treasury options based on type

const getTreasuryOptionsForType = (type: string) => {
  const optionsByType = {
    shortTerm: [
      { value: 'cusd', label: 'cUSD Vault', desc: 'Stable, simple' }
      // Only cUSD for short-term
    ],
    collective: [
      { value: 'cusd', label: 'cUSD Vault', desc: 'Stable treasury' },
      { value: 'dual', label: 'CELO + cUSD', desc: 'Stable + growth' }
    ],
    governance: [
      { value: 'cusd', label: 'cUSD Vault', desc: 'Stable treasury' },
      { value: 'dual', label: 'CELO + cUSD', desc: 'Stable + growth' },
      { value: 'custom', label: 'Custom Token', desc: 'USDT, DAI, etc.' }
    ]
  };
  return optionsByType[type] || [];
};
```

### 1.4 Conditional Governance Step
```typescript
// In renderGovernance or in steps calculation

// ONLY show governance for collective and governance types
const showGovernanceStep = ['collective', 'governance'].includes(daoData.daoType);

// Update nextStep function
const nextStep = () => {
  if (currentStep === 2 && !showGovernanceStep) {
    // Skip governance step for short-term
    setCurrentStep(4);  // Jump to Treasury
  } else {
    setCurrentStep(currentStep + 1);
  }
};

const prevStep = () => {
  if (currentStep === 4 && !showGovernanceStep) {
    // Skip governance step when going back
    setCurrentStep(2);  // Jump back to Basic Info
  } else {
    setCurrentStep(currentStep - 1);
  }
};

// In main render, conditionally render governance
{currentStep === 3 && showGovernanceStep && renderGovernance()}

// For short-term, add duration selector in Treasury step
if (daoData.daoType === 'shortTerm') {
  // Add before Initial Funding
  <div>
    <Label>Duration</Label>
    <Select value={daoData.duration?.toString()} 
            onValueChange={(val) => updateDaoData('duration', parseInt(val))}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="30">30 days</SelectItem>
        <SelectItem value="60">60 days</SelectItem>
        <SelectItem value="90">90 days</SelectItem>
      </SelectContent>
    </Select>
  </div>
}
```

### 1.5 Update Preview Step
```typescript
// Show different preview based on type

const renderPreview = () => {
  const govEnabled = ['collective', 'governance'].includes(daoData.daoType);
  
  return (
    <div className="space-y-6">
      {/* ... existing sections ... */}
      
      {/* Show type-specific info */}
      {daoData.daoType === 'shortTerm' && (
        <Card>
          <CardHeader>
            <CardTitle>⏱️ Short-Term Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>Duration: {daoData.duration} days</p>
              <p>Auto-resolve after duration expires</p>
              <p>Members can withdraw remaining funds</p>
              <p>No governance votes required</p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {!govEnabled && (
        <Card className="bg-blue-50 dark:bg-blue-950/30">
          <CardContent className="pt-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              ✓ This short-term fund doesn't require governance setup. Members will share equally when the period ends.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
```

## STEP 2: Update Backend (dao_deploy.ts)

```typescript
// Add to imports
import { v4 as uuidv4 } from 'uuid';

// Update interface
export interface DaoDeployRequest {
  daoType: 'shortTerm' | 'collective' | 'governance';  // ADD
  duration?: number;  // For short-term only
  // ... rest of existing fields
}

// Add treasury config constants
const TREASURY_CONFIG = {
  shortTerm: {
    multisigEnabled: false,
    requiredSignatures: 1,
    dailyLimit: '1000',
    monthlyBudget: null
  },
  collective: {
    multisigEnabled: true,
    requiredSignatures: 3,
    dailyLimit: '5000',
    monthlyBudget: '50000'
  },
  governance: {
    multisigEnabled: true,
    requiredSignatures: 5,
    dailyLimit: '10000',
    monthlyBudget: null
  }
};

// Update daoDeployHandler function
export async function daoDeployHandler(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const daoData: DaoDeployRequest = req.body;
    const { daoType = 'collective' } = daoData;  // ADD

    // Validate
    if (!daoData.name || !daoData.founderWallet) {
      return res.status(400).json({
        error: 'Missing required fields: name and founderWallet'
      });
    }

    if (!isAddress(daoData.founderWallet)) {
      return res.status(400).json({
        error: 'Invalid founder wallet address'
      });
    }

    logger.info(`Creating ${daoType} DAO: ${daoData.name}`);

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get treasury config for this DAO type
    const treasuryConfig = TREASURY_CONFIG[daoType];

    // Create DAO with treasury config
    const daoRecord = await db.insert(daos).values({
      id: uuidv4(),
      name: daoData.name,
      description: daoData.description || '',
      creatorId: userId,
      founderId: userId,
      category: daoData.category || 'other',
      visibility: daoData.visibility || 'public',
      treasuryBalance: daoData.initialFunding ? parseFloat(daoData.initialFunding).toString() : '0',
      quorumPercentage: Math.max(20, Math.min(100, daoData.quorum || 50)),
      votingPeriod: parseToDays(daoData.votingPeriod),
      status: 'active',
      subscriptionPlan: daoType === 'shortTerm' ? 'short_term' : 'collective',
      daoType: daoType,  // ADD - Store type
      plan: daoType === 'shortTerm' ? 'short_term' : 'collective',  // ADD
      
      // ADD Treasury configuration based on type
      treasuryMultisigEnabled: treasuryConfig.multisigEnabled,
      treasuryRequiredSignatures: treasuryConfig.requiredSignatures,
      treasuryDailyLimit: treasuryConfig.dailyLimit,
      treasuryMonthlyBudget: treasuryConfig.monthlyBudget,
      
      // ADD For short-term DAOs
      originalDuration: daoType === 'shortTerm' ? daoData.duration || 30 : null,
      
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    if (!daoRecord[0]) {
      throw new Error('Failed to create DAO record');
    }

    const createdDao = daoRecord[0];
    logger.info(`${daoType} DAO created with ID: ${createdDao.id}`);

    // Create treasury vault
    const vaultRecord = await db.insert(vaults).values({
      daoId: createdDao.id,
      userId: null,
      name: `${createdDao.name} Treasury`,
      description: `Treasury vault for ${createdDao.name}`,
      currency: daoData.treasuryType === 'dual' ? 'CELO' : (daoData.treasuryType || 'cUSD'),
      address: daoData.founderWallet,
      balance: daoData.initialFunding ? parseFloat(daoData.initialFunding).toString() : '0',
      vaultType: 'dao_treasury',
      isActive: true,
      riskLevel: 'low',
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    if (!vaultRecord[0]) {
      throw new Error('Failed to create DAO treasury vault');
    }

    logger.info(`Treasury vault created for ${daoType} DAO: ${createdDao.id}`);

    // Add founder as admin
    await db.insert(daoMemberships).values({
      daoId: createdDao.id,
      userId: userId,
      role: 'admin',
      status: 'approved',
      joinedAt: new Date(),
      createdAt: new Date()
    });

    // ADD founder as first treasury signer if multisig enabled
    if (treasuryConfig.multisigEnabled) {
      await db.update(daos)
        .set({
          treasurySigners: [userId]  // Founder is first signer
        })
        .where(eq(daos.id, createdDao.id));
    }

    logger.info(`Founder added as admin to ${daoType} DAO`);

    // Add invited members
    if (daoData.members && Array.isArray(daoData.members)) {
      for (const member of daoData.members) {
        if (member.address?.toLowerCase() === daoData.founderWallet.toLowerCase()) {
          continue;
        }

        const memberUser = await db.query.users.findFirst({
          where: eq(users.walletAddress, member.address)
        });

        if (memberUser) {
          await db.insert(daoMemberships).values({
            daoId: createdDao.id,
            userId: memberUser.id,
            role: member.role || 'member',
            status: 'pending',
            joinedAt: new Date(),
            createdAt: new Date()
          }).catch(err => {
            logger.warn(`Failed to add member to ${daoType} DAO: ${err.message}`);
          });
        }
      }
    }

    logger.info(`${daoType} DAO deployment complete: ${createdDao.id}`);

    // Return response
    res.status(201).json({
      success: true,
      message: `${daoType} DAO created successfully`,
      data: {
        daoId: createdDao.id,
        daoAddress: daoData.founderWallet,
        daoType: daoType,  // ADD
        name: createdDao.name,
        description: createdDao.description,
        founderId: createdDao.founderId,
        treasuryVaultId: vaultRecord[0].id,
        treasuryAddress: daoData.founderWallet,
        treasuryType: daoData.treasuryType || 'cUSD',
        multisigEnabled: treasuryConfig.multisigEnabled,  // ADD
        status: createdDao.status,
        createdAt: createdDao.createdAt,
        memberCount: 1
      }
    });

  } catch (error: any) {
    logger.error(`DAO deployment failed: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to deploy DAO',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
```

## STEP 3: Test the Implementation

### Test Case 1: Short-Term DAO (Merry-Go-Round)
```
1. Select "Short-Term Fund"
2. Should see only: Merry-Go-Round, Harambee, Burial, Event, Emergency, Harvest
3. Basic Info step shows these categories
4. Governance step should be SKIPPED
5. Treasury step should ONLY show cUSD option
6. Add duration (30/60/90 days)
7. Preview should show NO governance info
```

### Test Case 2: Collective DAO (Savings Group)
```
1. Select "Collective / Savings Group"
2. Should see: Savings, Table Banking, Investment, Traders, Farmers, Labor
3. Governance step SHOWN with 1-person-1-vote and weighted options
4. Treasury step shows cUSD and CELO options
5. Preview shows governance AND multisig enabled
6. Database shows treasuryMultisigEnabled: true, requiredSignatures: 3
```

### Test Case 3: Governance DAO
```
1. Select "Governance DAO"
2. Should see: Governance, Social Impact, Education, Health
3. Governance step SHOWN with all 3 options
4. Treasury step shows ALL options (cUSD, CELO, custom)
5. Preview shows governance AND multisig with 5 signers
6. Database shows treasuryMultisigEnabled: true, requiredSignatures: 5
```

## Database Verification Queries

```sql
-- Verify short-term DAO
SELECT id, name, dao_type, plan, original_duration, treasury_multisig_enabled
FROM daos 
WHERE dao_type = 'short_term'
LIMIT 1;

-- Verify collective DAO multisig
SELECT id, name, dao_type, treasury_multisig_enabled, treasury_required_signatures
FROM daos 
WHERE dao_type = 'collective'
LIMIT 1;

-- Verify treasury settings
SELECT d.id, d.name, d.treasury_daily_limit, d.treasury_monthly_budget, d.treasury_signers
FROM daos d
WHERE d.id = 'DAO_ID';
```

## Summary

This customization provides:

✅ **User-Friendly**: Different flows per DAO type
✅ **Project-Specific**: Mtaa categories (merry-go-round, harambee, etc.)
✅ **Flexible Treasury**: Currency and limits per type
✅ **Smart Governance**: Only when needed
✅ **Multisig Setup**: During creation, not after
✅ **Complete**: Short-term DAOs don't need governance

**Ready to implement?** This guide covers all required changes to make DAO creation fully customized per your needs!
