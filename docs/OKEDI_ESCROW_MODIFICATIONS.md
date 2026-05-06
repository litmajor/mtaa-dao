# OKEDI Escrow System - Modifications to Existing Implementation

## 📊 Current State vs OKEDI Goals

### What You Already Have ✅

Your existing escrow system (wallet + DAO) covers:
- ✅ Create escrow with invite links
- ✅ Multiple milestones
- ✅ Wallet peer-to-peer transfers
- ✅ Fund escrow from wallet
- ✅ Approve/release milestones
- ✅ Dispute system (basic)
- ✅ Transaction history

### What OKEDI Needs (Modifications Only) 🎯

1. **Mediator field** - Add `mediatorId` to escrow_accounts
2. **Mediator selection** - Auto-suggest from DAO elders
3. **Trust scores** - Award/deduct points based on escrow outcomes
4. **Dispute resolution** - Enhanced mediator decision making
5. **DAO context** - Link escrow to specific DAO (for mediator selection)

---

## 🔧 Required Modifications (10 hours total)

### 1. Database Schema Update (1 hour)

**File:** `shared/escrowSchema.ts`

**What to add to `escrowAccounts` table:**

```typescript
export const escrowAccounts = pgTable("escrow_accounts", {
  // ... existing fields ...
  
  // NEW FIELDS FOR OKEDI
  daoId: uuid("dao_id").references(() => daos.id),  // Link to DAO for mediator selection
  mediatorId: varchar("mediator_id").references(() => users.id),  // Chosen mediator (optional at creation)
  mediatorApprovedAt: timestamp("mediator_approved_at"),  // When mediator approved the escrow
  
  // Dispute resolution details
  disputeWinner: varchar("dispute_winner"),  // "payer" | "payee" | "split"
  disputePercentages: jsonb("dispute_percentages").default({ payer: 0, payee: 100 }),  // {payer: 30, payee: 70}
});
```

**Why these fields:**
- `daoId` - So we can auto-suggest mediators from that DAO's elders
- `mediatorId` - Track who's mediating (for trust score updates)
- `mediatorApprovedAt` - Track when mediator reviewed (SLA metric)
- `disputeWinner` - Outcome of dispute (for trust scores)
- `disputePercentages` - How funds are split if disputed

---

### 2. Escrow Service Updates (3 hours)

**File:** `server/services/escrowService.ts`

**Add these new methods:**

```typescript
export class EscrowService {
  // ... existing methods ...

  // NEW METHOD 1: Suggest mediators from DAO
  async suggestMediators(daoId: string, excludeUserIds: string[]) {
    // Get DAO elders (members with role = "elder" or "treasurer")
    const mediators = await db.select().from(users)
      .innerJoin(daoMemberships, eq(users.id, daoMemberships.userId))
      .where(
        and(
          eq(daoMemberships.daoId, daoId),
          inArray(daoMemberships.role, ["elder", "treasurer"]),
          notInArray(users.id, excludeUserIds)
        )
      )
      .orderBy(desc(users.trustScore));  // Highest trust score first

    return mediators.map(m => ({
      id: m.users.id,
      name: m.users.username,
      avatar: m.users.avatarUrl,
      trustScore: m.users.trustScore,
      role: m.daoMemberships.role
    }));
  }

  // NEW METHOD 2: Set mediator for escrow
  async setMediator(escrowId: string, mediatorId: string, initiatorId: string) {
    const escrow = await db.select().from(escrowAccounts)
      .where(eq(escrowAccounts.id, escrowId))
      .limit(1);

    if (!escrow.length) throw new Error('Escrow not found');
    if (escrow[0].payerId !== initiatorId) throw new Error('Only payer can set mediator');

    return await db.update(escrowAccounts)
      .set({ mediatorId, updatedAt: new Date() })
      .where(eq(escrowAccounts.id, escrowId))
      .returning();
  }

  // NEW METHOD 3: Mediator approves escrow
  async approveAsMediator(escrowId: string, mediatorId: string) {
    const escrow = await db.select().from(escrowAccounts)
      .where(eq(escrowAccounts.id, escrowId))
      .limit(1);

    if (!escrow.length) throw new Error('Escrow not found');
    if (escrow[0].mediatorId !== mediatorId) throw new Error('Not assigned mediator');

    return await db.update(escrowAccounts)
      .set({ mediatorApprovedAt: new Date(), updatedAt: new Date() })
      .where(eq(escrowAccounts.id, escrowId))
      .returning();
  }

  // NEW METHOD 4: Resolve dispute with mediator decision
  async resolveDisputeAsMediator(
    escrowId: string,
    mediatorId: string,
    winner: "payer" | "payee" | "split",
    payerPercentage: number = 0
  ) {
    const escrow = await db.select().from(escrowAccounts)
      .where(eq(escrowAccounts.id, escrowId))
      .limit(1);

    if (!escrow.length) throw new Error('Escrow not found');
    if (escrow[0].mediatorId !== mediatorId) throw new Error('Not assigned mediator');
    if (escrow[0].status !== 'disputed') throw new Error('Not in disputed state');

    // Calculate split percentages
    const payeePercentage = 100 - payerPercentage;
    
    // Update escrow with decision
    const [updated] = await db.update(escrowAccounts)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
        disputeWinner: winner,
        disputePercentages: { payer: payerPercentage, payee: payeePercentage },
        updatedAt: new Date()
      })
      .where(eq(escrowAccounts.id, escrowId))
      .returning();

    // Update trust scores based on outcome
    const payer = await db.select().from(users).where(eq(users.id, escrow[0].payerId)).limit(1);
    const payee = await db.select().from(users).where(eq(users.id, escrow[0].payeeId)).limit(1);
    const mediator = await db.select().from(users).where(eq(users.id, mediatorId)).limit(1);

    // Award trust points
    if (payer.length > 0) {
      const payerWon = winner === "payer" || (winner === "split" && payerPercentage > 50);
      const payerPoints = payerWon ? 2 : -2;
      await db.update(users)
        .set({ trustScore: (payer[0].trustScore || 0) + payerPoints })
        .where(eq(users.id, escrow[0].payerId));
    }

    if (payee.length > 0) {
      const payeeWon = winner === "payee" || (winner === "split" && payeePercentage > 50);
      const payeePoints = payeeWon ? 2 : -2;
      await db.update(users)
        .set({ trustScore: (payee[0].trustScore || 0) + payeePoints })
        .where(eq(users.id, escrow[0].payeeId));
    }

    // Award mediator for resolving dispute
    if (mediator.length > 0) {
      await db.update(users)
        .set({ trustScore: (mediator[0].trustScore || 0) + 5 })  // +5 for mediation
        .where(eq(users.id, mediatorId));
    }

    return updated;
  }

  // NEW METHOD 5: Update trust score on successful release
  async completedWithTrust(escrowId: string) {
    const escrow = await db.select().from(escrowAccounts)
      .where(eq(escrowAccounts.id, escrowId))
      .limit(1);

    if (!escrow.length) throw new Error('Escrow not found');

    // Both parties get +2 trust points for successful escrow
    await db.update(users)
      .set({ trustScore: sql`trust_score + 2` })
      .where(eq(users.id, escrow[0].payerId));

    await db.update(users)
      .set({ trustScore: sql`trust_score + 2` })
      .where(eq(users.id, escrow[0].payeeId));

    return true;
  }
}
```

---

### 3. API Endpoints (3 hours)

**File:** `server/routes/escrow.ts`

**Add these new endpoints:**

```typescript
// ENDPOINT 1: Get suggested mediators for DAO
router.get('/mediators/suggest/:daoId', authenticate, async (req, res) => {
  try {
    const { daoId } = req.params;
    
    // Exclude sender and recipient from suggestions
    const excludeIds = req.query.exclude?.split(',') || [];
    
    const mediators = await escrowService.suggestMediators(daoId, excludeIds);
    
    res.json({
      success: true,
      mediators,
      count: mediators.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ENDPOINT 2: Set mediator for escrow
router.post('/:id/set-mediator', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { mediatorId } = req.body;
    const payerId = req.user!.id;

    if (!mediatorId) {
      return res.status(400).json({ error: 'Mediator ID required' });
    }

    const escrow = await escrowService.setMediator(id, mediatorId, payerId);
    
    // Notify mediator
    await notifyMediatorAssigned(mediatorId, id);

    res.json({ success: true, escrow });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ENDPOINT 3: Mediator approves escrow
router.post('/:id/approve-as-mediator', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const mediatorId = req.user!.id;

    const escrow = await escrowService.approveAsMediator(id, mediatorId);

    res.json({ success: true, escrow });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ENDPOINT 4: Resolve dispute with mediator decision
router.post('/:id/resolve-dispute', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { winner, payerPercentage } = req.body;
    const mediatorId = req.user!.id;

    if (!winner || !['payer', 'payee', 'split'].includes(winner)) {
      return res.status(400).json({ error: 'Invalid winner' });
    }

    const escrow = await escrowService.resolveDisputeAsMediator(
      id,
      mediatorId,
      winner,
      payerPercentage || 0
    );

    // Notify both parties
    await notifyDisputeResolved(escrow.payerId, escrow.payeeId, id, winner);

    res.json({ success: true, escrow });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ENDPOINT 5: Complete escrow (update trust scores)
router.post('/:id/complete-with-trust', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify caller is one of the parties
    const escrow = await verifyEscrowParty(id, req.user!.id);

    // Update milestone release and trust scores
    if (escrow.status === 'funded') {
      await escrowService.completedWithTrust(id);
      
      const updated = await db.update(escrowAccounts)
        .set({ status: 'released', releasedAt: new Date() })
        .where(eq(escrowAccounts.id, id))
        .returning();

      res.json({ success: true, escrow: updated[0] });
    } else {
      res.status(400).json({ error: 'Escrow not in correct state' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

### 4. Frontend Components (2 hours)

**File:** `client/src/components/EscrowMediatorSelector.tsx` (NEW)

```typescript
import React, { useState, useEffect } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiGet } from '@/lib/api';

interface Mediator {
  id: string;
  name: string;
  avatar: string;
  trustScore: number;
  role: string;
}

interface EscrowMediatorSelectorProps {
  daoId: string;
  excludeUserIds: string[];
  onSelectMediator: (mediatorId: string) => void;
  selectedMediatorId?: string;
}

export default function EscrowMediatorSelector({
  daoId,
  excludeUserIds,
  onSelectMediator,
  selectedMediatorId
}: EscrowMediatorSelectorProps) {
  const [mediators, setMediators] = useState<Mediator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchMediators = async () => {
      try {
        const data = await apiGet(
          `/api/escrow/mediators/suggest/${daoId}?exclude=${excludeUserIds.join(',')}`
        );
        setMediators(data.mediators);
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to load mediators', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchMediators();
  }, [daoId, excludeUserIds]);

  const selected = mediators.find(m => m.id === selectedMediatorId);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        Select Mediator (Optional)
        <span className="text-xs text-gray-500 ml-2">
          Will help resolve disputes
        </span>
      </label>

      {selected && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={selected.avatar} alt={selected.name} className="w-8 h-8 rounded-full" />
            <div>
              <p className="font-medium">{selected.name}</p>
              <p className="text-xs text-gray-600">{selected.role}</p>
            </div>
          </div>
          <Badge variant="outline">Trust: {selected.trustScore}</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectMediator('')}
          >
            ✕
          </Button>
        </div>
      )}

      {!selected && (
        <Command className="border">
          <CommandInput placeholder="Search mediators..." />
          <CommandEmpty>
            {isLoading ? 'Loading...' : 'No mediators available'}
          </CommandEmpty>
          <CommandGroup>
            {mediators.map((mediator) => (
              <CommandItem
                key={mediator.id}
                value={mediator.id}
                onSelect={() => onSelectMediator(mediator.id)}
              >
                <img src={mediator.avatar} alt={mediator.name} className="w-6 h-6 rounded-full mr-2" />
                <div className="flex-1">
                  <p className="font-medium">{mediator.name}</p>
                  <p className="text-xs text-gray-500">{mediator.role}</p>
                </div>
                <Badge variant="outline">Trust: {mediator.trustScore}</Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      )}
    </div>
  );
}
```

---

### 5. Update Existing Components (1 hour)

**File:** `client/src/components/wallet/EscrowInitiator.tsx`

**Modify the form to include:**

```typescript
// Add this to form state
const [daoId, setDaoId] = useState<string>('');
const [mediatorId, setMediaatorId] = useState<string>('');

// In the form JSX, add:
<>
  <div>
    <label className="text-sm font-medium">
      Associated DAO (Optional)
      <span className="text-xs text-gray-500 ml-2">
        For mediator selection
      </span>
    </label>
    <DAOSelector value={daoId} onChange={setDaoId} />
  </div>

  {daoId && (
    <EscrowMediatorSelector
      daoId={daoId}
      excludeUserIds={[payerId, payeeId].filter(Boolean)}
      onSelectMediator={setMediaatorId}
      selectedMediatorId={mediatorId}
    />
  )}
</>

// In the submit handler, send mediatorId:
const escrow = await apiPost('/api/escrow/initiate', {
  recipient,
  amount,
  currency,
  description,
  milestones,
  daoId,      // NEW
  mediatorId  // NEW
});
```

---

## 🎯 Implementation Order (Ready-to-Execute)

### **Phase 1: Database (1 hour)**
1. Add 5 new fields to `escrowAccounts` table
2. Run migration
3. No data loss (all new fields have defaults)

### **Phase 2: Backend (3 hours)**
1. Add 5 new methods to `EscrowService`
2. Add 5 new API endpoints
3. Test with Postman

### **Phase 3: Frontend (2 hours)**
1. Create `EscrowMediatorSelector` component
2. Update `EscrowInitiator` to use it
3. Test with UI

---

## ✅ Testing Checklist

- [ ] Create escrow with mediator from DAO
- [ ] Mediator gets notified
- [ ] Mediator can approve escrow
- [ ] Both parties' trust scores +2 on completion
- [ ] Dispute filed → mediator decides → split funds
- [ ] Losing party gets -2 trust score
- [ ] Mediator gets +5 trust score

---

## 📝 Summary

**What stays the same:**
- Escrow creation flow ✅
- Milestone tracking ✅
- Invite links ✅
- Dispute filing ✅

**What's new for OKEDI:**
- ➕ Mediator selection from DAO elders
- ➕ Trust score system
- ➕ Enhanced dispute resolution (percentages, fund splitting)
- ➕ DAO context linkage

**Total effort:** 10 hours (vs 80 hours rebuild)
**Code impact:** ~200 lines service + ~100 lines API + ~150 lines components = ~450 lines
**Risk:** Low (extending existing system, no breaking changes)

