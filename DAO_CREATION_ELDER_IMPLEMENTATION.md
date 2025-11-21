# DAO Creation Implementation - Fix Elder Role & Withdrawal Mode

**Status:** Ready for implementation
**Priority:** CRITICAL - Must complete before any DAO creation goes live

---

## Summary of Changes Needed

| Component | Current State | Required Fix | Effort |
|---|---|---|---|
| **Database Schema** | Missing elder/withdrawal mode fields | Add 6 columns to daos & daoMemberships | 1 hour |
| **dao_deploy.ts** | Doesn't create elders, doesn't set signers | Receive elders from frontend, configure properly | 1.5 hours |
| **create-dao.tsx** | No elder selection | Add Step 2.5 elder selector | 2 hours |
| **vaultService.ts** | Always requires multi-sig | Check withdrawalMode first | 1 hour |
| **daoMemberships** | Elders not assigned | Properly assign elders with correct permissions | 0.5 hours |

**Total Effort:** ~6 hours
**Blocking:** All DAO creation until complete

---

## STEP 1: Database Schema Updates

### File: `shared/schema.ts`

Add these fields to the `daos` table:

```typescript
// In the daos pgTable definition, add after treasuryMonthlyBudget:

// Withdrawal and duration configuration
withdrawalMode: varchar("withdrawal_mode").default("multisig"),
  // "direct" - founder+elders only, instant
  // "multisig" - requires multi-sig approval
  // "rotation" - automatic on rotation date

durationModel: varchar("duration_model").default("time"),
  // "time" - fixed duration (30/60/90 days)
  // "rotation" - based on rotation schedule (chama)
  // "ongoing" - no end date

rotationFrequency: varchar("rotation_frequency"), 
  // "weekly", "monthly", "quarterly" - only for rotation-based DAOs

nextRotationDate: timestamp("next_rotation_date"),
  // When next rotation recipient receives funds

minElders: integer("min_elders").default(2), // Minimum elders needed
maxElders: integer("max_elders").default(5), // Maximum elders allowed
```

Add these fields to the `daoMemberships` table:

```typescript
// In the daoMemberships pgTable definition, add after lastActive:

// Withdrawal permissions
canInitiateWithdrawal: boolean("can_initiate_withdrawal").default(false),
  // Can create withdrawal proposals (elders/admin only)

canApproveWithdrawal: boolean("can_approve_withdrawal").default(false),
  // Can sign/approve multi-sig withdrawals (elders only)

isRotationRecipient: boolean("is_rotation_recipient").default(false),
  // Is this member the current recipient in rotation schedule (chama)

rotationRecipientDate: timestamp("rotation_recipient_date"),
  // When this member becomes rotation recipient
```

### Code Insertion Point (shared/schema.ts - lines 235-250)

**Current code:**
```typescript
  treasuryMonthlyBudget: decimal("treasury_monthly_budget", { precision: 18, scale: 2 }) // optional monthly budget limit
});
```

**Replace with:**
```typescript
  treasuryMonthlyBudget: decimal("treasury_monthly_budget", { precision: 18, scale: 2 }), // optional monthly budget limit
  
  // Withdrawal and duration configuration
  withdrawalMode: varchar("withdrawal_mode").default("multisig"), // direct, multisig, rotation
  durationModel: varchar("duration_model").default("time"), // time, rotation, ongoing
  rotationFrequency: varchar("rotation_frequency"), // weekly, monthly, quarterly
  nextRotationDate: timestamp("next_rotation_date"),
  minElders: integer("min_elders").default(2),
  maxElders: integer("max_elders").default(5),
});
```

**Find line 560 in daoMemberships table and add after `lastActive`:**
```typescript
  lastActive: timestamp("last_active").defaultNow(),
  
  // Withdrawal permissions
  canInitiateWithdrawal: boolean("can_initiate_withdrawal").default(false),
  canApproveWithdrawal: boolean("can_approve_withdrawal").default(false),
  isRotationRecipient: boolean("is_rotation_recipient").default(false),
  rotationRecipientDate: timestamp("rotation_recipient_date"),
});
```

---

## STEP 2: Update DAO Deploy Handler

### File: `server/api/dao_deploy.ts`

**Current problematic code (lines 1-50):**
```typescript
export async function daoDeployHandler(req: Request, res: Response) {
  try {
    const { daoData, founderWallet, invitedMembers } = req.body;

    // Validate founder wallet
    if (!founderWallet || !isAddress(founderWallet)) {
      return res.status(400).json({ error: "Invalid founder wallet address" });
    }

    // Create DAO record
    const [dao] = await db.insert(daos).values({
      name: daoData.name,
      description: daoData.description,
      creatorId: founderWallet,
      founderId: founderWallet,
      daoType: daoData.daoType,
      treasuryMultisigEnabled: true,
      treasuryRequiredSignatures: 3,
      treasurySigners: [], // EMPTY! BUG!
      // ... more fields ...
    }).returning();

    // Create founder membership
    await db.insert(daoMemberships).values({
      userId: founderWallet,
      daoId: dao.id,
      role: 'admin', // BUG: Should be 'elder'
      isAdmin: true,
      isElder: false, // BUG: Should be true
    });
```

**Replace entire file with:**

```typescript
import { Request, Response } from "express";
import { db } from "../db";
import { daos, daoMemberships, vaults, users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { isAddress } from "viem";
import { Logger } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";

const logger = new Logger("daoDeployHandler");

interface DaoDeployRequest {
  daoData: {
    name: string;
    description: string;
    daoType: "short_term" | "collective" | "free" | "meta";
    category?: string;
    governanceModel?: string;
    treasuryType?: string;
    rotationFrequency?: string;
    durationDays?: number;
  };
  founderWallet: string;
  invitedMembers: string[];
  selectedElders: string[]; // NEW: Array of user IDs to be elders
}

export async function daoDeployHandler(req: Request, res: Response) {
  try {
    const { daoData, founderWallet, invitedMembers, selectedElders } = 
      req.body as DaoDeployRequest;

    logger.info(`Creating DAO: ${daoData.name} for founder: ${founderWallet}`);

    // ============================================
    // VALIDATION
    // ============================================

    // Validate founder wallet
    if (!founderWallet || !isAddress(founderWallet)) {
      logger.error(`Invalid founder wallet: ${founderWallet}`);
      return res.status(400).json({ error: "Invalid founder wallet address" });
    }

    // CRITICAL: Validate elders
    if (!selectedElders || selectedElders.length < 2) {
      logger.error(`Insufficient elders: ${selectedElders?.length || 0}`);
      return res.status(400).json({ 
        error: "Minimum 2 elders required for treasury multi-sig" 
      });
    }

    // Validate selected elders are valid wallet addresses or user IDs
    for (const elder of selectedElders) {
      const isValid = isAddress(elder) || 
                     /^[a-f0-9-]{36}$/.test(elder); // UUID format
      if (!isValid) {
        logger.error(`Invalid elder format: ${elder}`);
        return res.status(400).json({ error: `Invalid elder format: ${elder}` });
      }
    }

    // Ensure founder is in elders list
    const elders = Array.from(new Set([founderWallet, ...selectedElders]));
    if (elders.length > 5) {
      logger.error(`Too many elders: ${elders.length}`);
      return res.status(400).json({ error: "Maximum 5 elders allowed" });
    }

    // ============================================
    // DETERMINE DAO CONFIGURATION BY TYPE
    // ============================================

    let withdrawalMode = "multisig";
    let durationModel = "time";
    let minElders = 2;
    let nextRotationDate: Date | null = null;

    if (daoData.daoType === "short_term") {
      // Short-term DAOs (Chama, Merry-Go-Round)
      withdrawalMode = "direct"; // Founder + elders can withdraw instantly
      minElders = 2;

      if (daoData.rotationFrequency) {
        durationModel = "rotation";
        // Calculate next rotation date based on frequency
        nextRotationDate = calculateNextRotation(
          new Date(),
          daoData.rotationFrequency as "weekly" | "monthly" | "quarterly"
        );
      }
    } else if (daoData.daoType === "collective") {
      // Collective DAOs (Harambee, Burial Fund)
      withdrawalMode = "multisig"; // Requires multi-sig approval
      durationModel = "ongoing"; // No end date
      minElders = 3;
    }

    logger.info(`DAO Config: type=${daoData.daoType}, withdrawalMode=${withdrawalMode}`);

    // ============================================
    // CREATE DAO RECORD
    // ============================================

    const daoId = uuidv4();

    const [dao] = await db
      .insert(daos)
      .values({
        id: daoId,
        name: daoData.name,
        description: daoData.description,
        creatorId: founderWallet,
        founderId: founderWallet,
        daoType: daoData.daoType,
        access: "public",
        memberCount: 1 + elders.filter(e => e !== founderWallet).length,

        // Treasury configuration
        treasuryBalance: "0",
        treasuryMultisigEnabled: true,
        treasuryRequiredSignatures: elders.length, // CRITICAL: Set to actual elder count
        treasurySigners: elders, // CRITICAL: Set actual signer list
        treasuryWithdrawalThreshold: "1000.00",
        treasuryDailyLimit: getDailyLimitByType(daoData.daoType),
        treasuryMonthlyBudget: getMonthlyBudgetByType(daoData.daoType),

        // NEW: Withdrawal and duration configuration
        withdrawalMode, // direct, multisig, or rotation
        durationModel, // time, rotation, or ongoing
        rotationFrequency: daoData.rotationFrequency,
        nextRotationDate,
        minElders,
        maxElders: 5,

        // Governance configuration
        quorumPercentage: daoData.daoType === "short_term" ? 0 : 20,
        votingPeriod: 72,
        executionDelay: 24,

        plan: daoData.daoType,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    logger.info(`DAO created: ${dao.id}`);

    // ============================================
    // CREATE TREASURY VAULT
    // ============================================

    const vaultId = uuidv4();

    const [vault] = await db
      .insert(vaults)
      .values({
        id: vaultId,
        daoId: dao.id,
        type: "dao_treasury",
        ownerWallet: founderWallet,
        name: `${dao.name} Treasury`,
        balance: "0",
        currency: "cUSD",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    logger.info(`Vault created: ${vault.id}`);

    // ============================================
    // CREATE FOUNDER MEMBERSHIP AS ELDER
    // ============================================

    await db
      .insert(daoMemberships)
      .values({
        userId: founderWallet,
        daoId: dao.id,
        role: "elder", // FIXED: Founder is elder
        status: "approved",
        isAdmin: true, // Also admin for full control
        isElder: true, // FIXED: Founder is elder
        canInitiateWithdrawal: withdrawalMode === "direct", // Can withdraw directly
        canApproveWithdrawal: true, // Can approve multi-sig
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    logger.info(`Founder membership created as elder: ${founderWallet}`);

    // ============================================
    // CREATE ELDER MEMBERSHIPS
    // ============================================

    for (const elder of selectedElders) {
      if (elder !== founderWallet) {
        // Skip founder (already created above)
        await db
          .insert(daoMemberships)
          .values({
            userId: elder,
            daoId: dao.id,
            role: "elder", // Designated elders
            status: "pending", // Need to accept
            isAdmin: false,
            isElder: true,
            canInitiateWithdrawal: withdrawalMode === "direct",
            canApproveWithdrawal: true,
            joinedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });

        logger.info(`Elder membership created (pending): ${elder}`);
      }
    }

    // ============================================
    // CREATE INVITED MEMBER MEMBERSHIPS
    // ============================================

    for (const member of invitedMembers) {
      if (!elders.includes(member)) {
        // Skip if already an elder
        await db
          .insert(daoMemberships)
          .values({
            userId: member,
            daoId: dao.id,
            role: "member",
            status: "pending",
            isAdmin: false,
            isElder: false,
            canInitiateWithdrawal: false,
            canApproveWithdrawal: false,
            joinedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });

        logger.info(`Regular member membership created (pending): ${member}`);
      }
    }

    // ============================================
    // RESPONSE
    // ============================================

    return res.status(201).json({
      success: true,
      dao: {
        id: dao.id,
        name: dao.name,
        founderId: dao.founderId,
        vaultId: vault.id,
        daoType: dao.daoType,
        withdrawalMode,
        durationModel,
        elders: elders.map(e => ({ id: e, role: "elder" })),
        memberCount: dao.memberCount,
      },
    });

  } catch (error) {
    logger.error("DAO creation failed", error);
    return res.status(500).json({
      error: "Failed to create DAO",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getDailyLimitByType(daoType: string): string {
  switch (daoType) {
    case "short_term":
      return "5000.00"; // $5K daily for chama
    case "collective":
      return "10000.00"; // $10K daily for collective
    default:
      return "1000.00";
  }
}

function getMonthlyBudgetByType(daoType: string): string {
  switch (daoType) {
    case "short_term":
      return "50000.00"; // $50K monthly for chama
    case "collective":
      return "100000.00"; // $100K monthly for collective
    default:
      return "10000.00";
  }
}

function calculateNextRotation(
  from: Date,
  frequency: "weekly" | "monthly" | "quarterly"
): Date {
  const next = new Date(from);
  switch (frequency) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
  }
  return next;
}
```

---

## STEP 3: Update Create DAO Frontend

### File: `client/src/pages/create-dao.tsx`

Add new Step 2.5 for elder selection. **Current form steps (lines 1-50):**

```typescript
const formSteps = [
  { id: 1, title: "Basic Information", component: BasicInfoStep },
  { id: 2, title: "Governance", component: GovernanceStep },
  { id: 3, title: "Treasury", component: TreasuryStep },
  { id: 4, title: "Members", component: MembersStep },
  { id: 5, title: "Preview", component: PreviewStep },
  { id: 6, title: "Success", component: SuccessStep },
];
```

**Replace with:**

```typescript
const formSteps = [
  { id: 1, title: "Basic Information", component: BasicInfoStep },
  { id: 2, title: "Select Elders", component: ElderSelectionStep }, // NEW
  { id: 3, title: "Governance", component: GovernanceStep },
  { id: 4, title: "Treasury", component: TreasuryStep },
  { id: 5, title: "Members", component: MembersStep },
  { id: 6, title: "Preview", component: PreviewStep },
  { id: 7, title: "Success", component: SuccessStep },
];
```

**Add new component after MembersStep:**

```typescript
// Elder Selection Step Component
const ElderSelectionStep = ({ data, onChange, daoType }) => {
  const [availableMembers, setAvailableMembers] = useState<User[]>([]);
  const [selectedElders, setSelectedElders] = useState<string[]>(
    data.selectedElders || []
  );

  const elderRequirements = {
    short_term: {
      min: 2,
      max: 3,
      description:
        "Elders manage fund rotation and approve withdrawals. For chama, select 2-3 trusted members.",
    },
    collective: {
      min: 3,
      max: 5,
      description:
        "Elders govern the collective and approve community fund withdrawals. Select 3-5 respected members.",
    },
    free: {
      min: 2,
      max: 3,
      description: "Elders help coordinate the group.",
    },
  };

  const requirements = elderRequirements[daoType] || elderRequirements.free;

  const toggleElder = (memberId: string) => {
    let newElders = [...selectedElders];

    if (newElders.includes(memberId)) {
      newElders = newElders.filter(id => id !== memberId);
    } else if (newElders.length < requirements.max) {
      newElders.push(memberId);
    } else {
      alert(`Maximum ${requirements.max} elders allowed`);
      return;
    }

    setSelectedElders(newElders);
    onChange({ selectedElders: newElders });
  };

  const isValid = selectedElders.length >= requirements.min;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Select DAO Elders</CardTitle>
          <CardDescription>
            {requirements.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info Box */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>About Elders</AlertTitle>
            <AlertDescription>
              Elders have special permissions:
              <ul className="mt-2 ml-4 space-y-1 text-sm">
                <li>• Can initiate treasury withdrawals</li>
                <li>• Approve multi-signature transactions</li>
                <li>• Manage member roles and access</li>
                <li>• Make governance decisions</li>
              </ul>
              <p className="mt-3 font-semibold">
                You (founder) are automatically an elder.
              </p>
            </AlertDescription>
          </Alert>

          {/* Requirements Counter */}
          <div className="bg-slate-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-semibold">
                Select Elders: {selectedElders.length} of {requirements.min}-{requirements.max}
              </span>
              <span className={isValid ? "text-green-600" : "text-amber-600"}>
                {isValid ? "✓ Valid" : `Need ${requirements.min - selectedElders.length} more`}
              </span>
            </div>
          </div>

          {/* Members List */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">
              Invited Members (select as elders)
            </Label>
            <div className="border rounded-lg max-h-96 overflow-y-auto">
              {data.invitedMembers && data.invitedMembers.length > 0 ? (
                data.invitedMembers.map((member) => (
                  <button
                    key={member}
                    onClick={() => toggleElder(member)}
                    className={`w-full text-left px-4 py-3 border-b flex items-center justify-between transition ${
                      selectedElders.includes(member)
                        ? "bg-blue-50 hover:bg-blue-100"
                        : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-medium truncate">{member}</span>
                    <div
                      className={`w-5 h-5 border-2 rounded flex items-center justify-center ${
                        selectedElders.includes(member)
                          ? "bg-blue-600 border-blue-600"
                          : "border-slate-300"
                      }`}
                    >
                      {selectedElders.includes(member) && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-slate-500">
                  No invited members yet. Go back to Members step to add them.
                </div>
              )}
            </div>
          </div>

          {/* Role Explanation */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-blue-900">Role Permissions:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-blue-900">Founder (You)</p>
                <ul className="mt-1 space-y-1 text-blue-800">
                  <li>✓ Full admin control</li>
                  <li>✓ Automatic elder status</li>
                  <li>✓ Can withdraw funds instantly</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-blue-900">Selected Elders</p>
                <ul className="mt-1 space-y-1 text-blue-800">
                  <li>✓ Approve withdrawals</li>
                  <li>✓ Propose decisions</li>
                  <li>✓ Manage rotations (if chama)</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Error */}
      {!isValid && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Selection Required</AlertTitle>
          <AlertDescription>
            Please select at least {requirements.min} members as elders to continue.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
```

**Update deployDAO() function to send selectedElders:**

```typescript
const deployDAO = async () => {
  try {
    setIsDeploying(true);

    const payload = {
      daoData: formData,
      founderWallet: userWallet,
      invitedMembers: formData.invitedMembers || [],
      selectedElders: formData.selectedElders || [], // NEW
    };

    const response = await fetch("/api/dao-deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const result = await response.json();
    // ... rest of success handling ...
  } catch (error) {
    // ... error handling ...
  } finally {
    setIsDeploying(false);
  }
};
```

---

## STEP 4: Update Vault Withdrawal Service

### File: `server/services/vaultService.ts`

**Current code (lines 448-450):**

```typescript
case 'withdraw':
  // SECURITY FIX: Only admin and elder can withdraw from DAO vaults
  return ['admin', 'elder'].includes(userRole);
```

**Replace with:**

```typescript
case 'withdraw':
  // NEW: Check DAO withdrawal mode first
  const [daoForWithdraw] = await db
    .select()
    .from(daos)
    .where(eq(daos.id, vaultId))
    .limit(1);

  if (daoForWithdraw?.withdrawalMode === "direct") {
    // Direct withdrawal: only founder + elders, no multi-sig needed
    return ['admin', 'elder'].includes(userRole);
  } else if (daoForWithdraw?.withdrawalMode === "multisig") {
    // Multi-sig required: only elders/admin can initiate
    return ['admin', 'elder'].includes(userRole);
  } else {
    // Rotation-based: no manual withdrawal
    return false;
  }
```

---

## Testing Checklist

- [ ] Founder creates DAO with 2 elders
- [ ] Founder is marked as elder with `canInitiateWithdrawal=true`
- [ ] Selected elders marked as elder with `canApproveWithdrawal=true`
- [ ] `treasurySigners` array contains all elder IDs
- [ ] `treasuryRequiredSignatures` equals number of elders
- [ ] Founder can initiate withdrawal without proposal (direct mode)
- [ ] Other elders can't withdraw (need approval)
- [ ] Invited members are NOT elders
- [ ] Can't create DAO with less than 2 elders

