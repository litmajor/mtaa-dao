  import { db } from '../storage';
import { escrowAccounts, escrowMilestones, escrowDisputes } from '../../shared/escrowSchema';
import { walletTransactions, users, daoMemberships } from '../../shared/schema';
import { eq, and, inArray, notInArray, desc, isNull, or } from 'drizzle-orm';
import { notificationService } from '../notificationService';

export class EscrowService {
  async createEscrow(data: {
    taskId?: string;
    payerId: string;
    payeeId: string;
    amount: string;
    currency: string;
    milestones?: Array<{ description: string; amount: string }>;
  }) {
    const [escrow] = await db.insert(escrowAccounts).values({
      taskId: data.taskId,
      payerId: data.payerId,
      payeeId: data.payeeId,
      amount: data.amount,
      currency: data.currency,
      status: 'pending',
      milestones: data.milestones || []
    }).returning();

    // Create milestone records if provided
    if (data.milestones && data.milestones.length > 0) {
      for (let i = 0; i < data.milestones.length; i++) {
        await db.insert(escrowMilestones).values({
          escrowId: escrow.id,
          milestoneNumber: i.toString(),
          description: data.milestones[i].description,
          amount: data.milestones[i].amount,
          status: 'pending'
        });
      }
    }

    await notificationService.createNotification({
      userId: data.payeeId,
      type: 'escrow',
      title: 'Escrow Created',
      message: `An escrow of ${data.amount} ${data.currency} has been created for you`,
      metadata: { escrowId: escrow.id }
    });

    return escrow;
  }

  async fundEscrow(escrowId: string, payerId: string, transactionHash: string) {
    const escrow = await db.select().from(escrowAccounts)
      .where(eq(escrowAccounts.id, escrowId))
      .limit(1);

    if (!escrow.length || escrow[0].payerId !== payerId) {
      throw new Error('Unauthorized or escrow not found');
    }

    if (escrow[0].status !== 'pending') {
      throw new Error('Escrow already funded or completed');
    }

    const [updated] = await db.update(escrowAccounts)
      .set({
        status: 'funded',
        fundedAt: new Date(),
        transactionHash,
        updatedAt: new Date()
      })
      .where(eq(escrowAccounts.id, escrowId))
      .returning();

    // Record wallet transaction
    await db.insert(walletTransactions).values({
      fromUserId: payerId,
      toUserId: escrow[0].payeeId,
      walletAddress: 'escrow',
      amount: escrow[0].amount,
      currency: escrow[0].currency,
      type: 'transfer',
      status: 'completed',
      transactionHash,
      description: `Escrow funding for ${escrowId}`
    });

    await notificationService.createNotification({
      userId: escrow[0].payeeId,
      type: 'escrow',
      title: 'Escrow Funded',
      message: `Escrow of ${escrow[0].amount} ${escrow[0].currency} has been funded`,
      metadata: { escrowId, transactionHash }
    });

    return updated;
  }

  async approveMilestone(escrowId: string, milestoneNumber: string, approverId: string, proofUrl?: string) {
    const escrow = await db.select().from(escrowAccounts)
      .where(eq(escrowAccounts.id, escrowId))
      .limit(1);

    if (!escrow.length) {
      throw new Error('Escrow not found');
    }

    if (escrow[0].payerId !== approverId) {
      throw new Error('Only payer can approve milestones');
    }

    const [milestone] = await db.update(escrowMilestones)
      .set({
        status: 'approved',
        approvedBy: approverId,
        approvedAt: new Date(),
        proofUrl,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(escrowMilestones.escrowId, escrowId),
          eq(escrowMilestones.milestoneNumber, milestoneNumber)
        )
      )
      .returning();

    await notificationService.createNotification({
      userId: escrow[0].payeeId,
      type: 'escrow',
      title: 'Milestone Approved',
      message: `Milestone ${milestoneNumber} has been approved`,
      metadata: { escrowId, milestoneNumber }
    });

    return milestone;
  }

  async releaseMilestone(escrowId: string, milestoneNumber: string, transactionHash: string) {
    const milestone = await db.select().from(escrowMilestones)
      .where(
        and(
          eq(escrowMilestones.escrowId, escrowId),
          eq(escrowMilestones.milestoneNumber, milestoneNumber)
        )
      )
      .limit(1);

    if (!milestone.length || milestone[0].status !== 'approved') {
      throw new Error('Milestone not approved');
    }

    const [updated] = await db.update(escrowMilestones)
      .set({
        status: 'released',
        releasedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(escrowMilestones.id, milestone[0].id))
      .returning();

    const escrow = await db.select().from(escrowAccounts)
      .where(eq(escrowAccounts.id, escrowId))
      .limit(1);

    // Record payment transaction
    await db.insert(walletTransactions).values({
      fromUserId: escrow[0].payerId,
      toUserId: escrow[0].payeeId,
      walletAddress: 'escrow_release',
      amount: milestone[0].amount,
      currency: escrow[0].currency,
      type: 'transfer',
      status: 'completed',
      transactionHash,
      description: `Milestone ${milestoneNumber} release for escrow ${escrowId}`
    });

    return updated;
  }

  async releaseFullEscrow(escrowId: string, transactionHash: string) {
    const escrow = await db.select().from(escrowAccounts)
      .where(eq(escrowAccounts.id, escrowId))
      .limit(1);

    if (!escrow.length || escrow[0].status !== 'funded') {
      throw new Error('Escrow not funded or already completed');
    }

    const [updated] = await db.update(escrowAccounts)
      .set({
        status: 'released',
        releasedAt: new Date(),
        transactionHash,
        updatedAt: new Date()
      })
      .where(eq(escrowAccounts.id, escrowId))
      .returning();

    await db.insert(walletTransactions).values({
      fromUserId: escrow[0].payerId,
      toUserId: escrow[0].payeeId,
      walletAddress: 'escrow_release',
      amount: escrow[0].amount,
      currency: escrow[0].currency,
      type: 'transfer',
      status: 'completed',
      transactionHash,
      description: `Full escrow release for ${escrowId}`
    });

    await notificationService.createNotification({
      userId: escrow[0].payeeId,
      type: 'escrow',
      title: 'Escrow Released',
      message: `Full escrow of ${escrow[0].amount} ${escrow[0].currency} has been released`,
      metadata: { escrowId, transactionHash }
    });

    return updated;
  }

  async raiseDispute(escrowId: string, userId: string, reason: string, evidence: any[]) {
    const [dispute] = await db.insert(escrowDisputes).values({
      escrowId,
      raisedBy: userId,
      reason,
      evidence,
      status: 'open'
    }).returning();

    await db.update(escrowAccounts)
      .set({
        status: 'disputed',
        disputeReason: reason,
        disputedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(escrowAccounts.id, escrowId));

    const escrow = await db.select().from(escrowAccounts)
      .where(eq(escrowAccounts.id, escrowId))
      .limit(1);

    const otherParty = escrow[0].payerId === userId ? escrow[0].payeeId : escrow[0].payerId;

    await notificationService.createNotification({
      userId: otherParty,
      type: 'escrow',
      title: 'Dispute Raised',
      message: `A dispute has been raised on escrow ${escrowId}`,
      metadata: { escrowId, disputeId: dispute.id }
    });

    return dispute;
  }

  async refundEscrow(escrowId: string, transactionHash: string) {
    const escrow = await db.select().from(escrowAccounts)
      .where(eq(escrowAccounts.id, escrowId))
      .limit(1);

    if (!escrow.length) {
      throw new Error('Escrow not found');
    }

    const [updated] = await db.update(escrowAccounts)
      .set({
        status: 'refunded',
        refundedAt: new Date(),
        transactionHash,
        updatedAt: new Date()
      })
      .where(eq(escrowAccounts.id, escrowId))
      .returning();

    await db.insert(walletTransactions).values({
      fromUserId: escrow[0].payeeId,
      toUserId: escrow[0].payerId,
      walletAddress: 'escrow_refund',
      amount: escrow[0].amount,
      currency: escrow[0].currency,
      type: 'transfer',
      status: 'completed',
      transactionHash,
      description: `Escrow refund for ${escrowId}`
    });

    await notificationService.createNotification({
      userId: escrow[0].payerId,
      type: 'escrow',
      title: 'Escrow Refunded',
      message: `Escrow of ${escrow[0].amount} ${escrow[0].currency} has been refunded`,
      metadata: { escrowId, transactionHash }
    });

    return updated;
  }

  // OKEDI: Suggest mediators from DAO
  async suggestMediators(daoId: string, excludeUserIds: string[]) {
    const mediators = await db.select({
      id: users.id,
      username: users.username,
      profileImageUrl: users.profileImageUrl,
      reputationScore: users.reputationScore,
      role: daoMemberships.role
    })
      .from(users)
      .innerJoin(daoMemberships, eq(users.id, daoMemberships.userId))
      .where(
        and(
          eq(daoMemberships.daoId, daoId),
          inArray(daoMemberships.role, ["elder", "treasurer", "admin"]),
          notInArray(users.id, excludeUserIds.length > 0 ? excludeUserIds : [""])
        )
      )
      .orderBy(desc(users.reputationScore))
      .limit(10);

    return mediators;
  }

  // OKEDI: Set mediator for escrow
  async setMediator(escrowId: string, mediatorId: string, initiatorId: string) {
    const escrow = await db.select().from(escrowAccounts)
      .where(eq(escrowAccounts.id, escrowId))
      .limit(1);

    if (!escrow.length) throw new Error('Escrow not found');
    if (escrow[0].payerId !== initiatorId) throw new Error('Only payer can set mediator');

    const [updated] = await db.update(escrowAccounts)
      .set({ mediatorId, updatedAt: new Date() })
      .where(eq(escrowAccounts.id, escrowId))
      .returning();

    // Notify mediator
    await notificationService.createNotification({
      userId: mediatorId,
      type: 'escrow',
      title: 'You are assigned as mediator',
      message: `You have been assigned as mediator for escrow ${escrowId}`,
      metadata: { escrowId, role: 'mediator' }
    });

    return updated;
  }

  // OKEDI: Mediator approves escrow
  async approveAsMediator(escrowId: string, mediatorId: string) {
    const escrow = await db.select().from(escrowAccounts)
      .where(eq(escrowAccounts.id, escrowId))
      .limit(1);

    if (!escrow.length) throw new Error('Escrow not found');
    if (escrow[0].mediatorId !== mediatorId) throw new Error('Not assigned as mediator');

    const [updated] = await db.update(escrowAccounts)
      .set({ 
        mediatorApprovedAt: new Date(), 
        updatedAt: new Date() 
      })
      .where(eq(escrowAccounts.id, escrowId))
      .returning();

    return updated;
  }

  // OKEDI: Update reputation scores on escrow completion
  async completeWithReputationBoost(escrowId: string) {
    const escrow = await db.select().from(escrowAccounts)
      .where(eq(escrowAccounts.id, escrowId))
      .limit(1);

    if (!escrow.length) throw new Error('Escrow not found');

    // Both parties get +2 reputation for successful escrow
    const payer = await db.select().from(users)
      .where(eq(users.id, escrow[0].payerId))
      .limit(1);

    const payee = await db.select().from(users)
      .where(eq(users.id, escrow[0].payeeId))
      .limit(1);

    if (payer.length > 0) {
      const currentScore = payer[0].reputationScore ? parseFloat(payer[0].reputationScore.toString()) : 0;
      await db.update(users)
        .set({ reputationScore: (currentScore + 2).toString() })
        .where(eq(users.id, escrow[0].payerId));
    }

    if (payee.length > 0) {
      const currentScore = payee[0].reputationScore ? parseFloat(payee[0].reputationScore.toString()) : 0;
      await db.update(users)
        .set({ reputationScore: (currentScore + 2).toString() })
        .where(eq(users.id, escrow[0].payeeId));
    }

    // Update escrow status
    const [updated] = await db.update(escrowAccounts)
      .set({ 
        status: 'released', 
        releasedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(escrowAccounts.id, escrowId))
      .returning();

    return updated;
  }

  // OKEDI: Resolve dispute with mediator decision
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
    if (escrow[0].mediatorId !== mediatorId) throw new Error('Not assigned as mediator');
    if (escrow[0].status !== 'disputed') throw new Error('Escrow not in disputed state');

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

    // Update reputation scores based on outcome
    const payer = await db.select().from(users)
      .where(eq(users.id, escrow[0].payerId))
      .limit(1);

    const payee = await db.select().from(users)
      .where(eq(users.id, escrow[0].payeeId))
      .limit(1);

    const mediator = await db.select().from(users)
      .where(eq(users.id, mediatorId))
      .limit(1);

    // Award/deduct reputation based on dispute outcome
    if (payer.length > 0) {
      const payerWon = winner === "payer" || (winner === "split" && payerPercentage > 50);
      const reputationChange = payerWon ? 2 : -2;
      const currentScore = payer[0].reputationScore ? parseFloat(payer[0].reputationScore.toString()) : 0;
      await db.update(users)
        .set({ reputationScore: (currentScore + reputationChange).toString() })
        .where(eq(users.id, escrow[0].payerId));
    }

    if (payee.length > 0) {
      const payeeWon = winner === "payee" || (winner === "split" && payeePercentage > 50);
      const reputationChange = payeeWon ? 2 : -2;
      const currentScore = payee[0].reputationScore ? parseFloat(payee[0].reputationScore.toString()) : 0;
      await db.update(users)
        .set({ reputationScore: (currentScore + reputationChange).toString() })
        .where(eq(users.id, escrow[0].payeeId));
    }

    // Mediator gets +5 reputation for resolving dispute
    if (mediator.length > 0) {
      const currentScore = mediator[0].reputationScore ? parseFloat(mediator[0].reputationScore.toString()) : 0;
      await db.update(users)
        .set({ reputationScore: (currentScore + 5).toString() })
        .where(eq(users.id, mediatorId));
    }

    return updated;
  }

  // GUARDIANS: Add guardians to an escrow
  async addGuardians(escrowId: string, userId: string, guardians: string[]) {
    const escrow = await db.select().from(escrowAccounts).where(eq(escrowAccounts.id, escrowId)).limit(1);
    if (!escrow.length) throw new Error('Escrow not found');
    if (escrow[0].payerId !== userId && escrow[0].payeeId !== userId) throw new Error('Only parties can add guardians');
    const current = Array.isArray(escrow[0].guardians) ? escrow[0].guardians : [];
    const newGuardians = [...new Set([...current, ...guardians])];
    const [updated] = await db.update(escrowAccounts)
      .set({ guardians: newGuardians, updatedAt: new Date() })
      .where(eq(escrowAccounts.id, escrowId)).returning();
    return updated;
  }

  // GUARDIANS: Remove a guardian from an escrow
  async removeGuardian(escrowId: string, userId: string, guardian: string) {
    const escrow = await db.select().from(escrowAccounts).where(eq(escrowAccounts.id, escrowId)).limit(1);
    if (!escrow.length) throw new Error('Escrow not found');
    if (escrow[0].payerId !== userId && escrow[0].payeeId !== userId) throw new Error('Only parties can remove guardians');
    const current = Array.isArray(escrow[0].guardians) ? escrow[0].guardians : [];
    const newGuardians = current.filter((g: string) => g !== guardian);
    const [updated] = await db.update(escrowAccounts)
      .set({ guardians: newGuardians, updatedAt: new Date() })
      .where(eq(escrowAccounts.id, escrowId)).returning();
    return updated;
  }

  // GUARDIANS: List guardians for an escrow
  async listGuardians(escrowId: string, userId: string) {
    const escrow = await db.select().from(escrowAccounts).where(eq(escrowAccounts.id, escrowId)).limit(1);
    if (!escrow.length) throw new Error('Escrow not found');
    const guardians = Array.isArray(escrow[0].guardians) ? (escrow[0].guardians as string[]) : [];
    if (escrow[0].payerId !== userId && escrow[0].payeeId !== userId && !guardians.includes(userId)) throw new Error('Unauthorized');
    return guardians;
  }

  // GUARDIANS: Guardian approves recovery (majority required)
  async approveRecovery(escrowId: string, guardianId: string) {
    const escrow = await db.select().from(escrowAccounts).where(eq(escrowAccounts.id, escrowId)).limit(1);
    if (!escrow.length) throw new Error('Escrow not found');
    const guardians = Array.isArray(escrow[0].guardians) ? (escrow[0].guardians as string[]) : [];
    if (!guardians.includes(guardianId)) throw new Error('Not a guardian');
    // Track approvals in metadata
    const metadata = (escrow[0].metadata as any) || {};
    const approvals = Array.isArray(metadata.recoveryApprovals) ? (metadata.recoveryApprovals as string[]) : [];
    if (approvals.includes(guardianId)) throw new Error('Already approved');
    approvals.push(guardianId);
    // If majority, mark as recovered and update reputation
    let recovered = false;
    if (approvals.length >= Math.ceil(guardians.length / 2)) {
      recovered = true;
      // Update reputation for all approving guardians
      for (const g of approvals) {
        const guardianUser = await db.select().from(users).where(eq(users.id, g)).limit(1);
        if (guardianUser.length > 0) {
          const currentScore = guardianUser[0].reputationScore ? parseFloat(guardianUser[0].reputationScore.toString()) : 0;
          await db.update(users).set({ reputationScore: (currentScore + 2).toString() }).where(eq(users.id, g));
        }
      }
    }
    const [updated] = await db.update(escrowAccounts)
      .set({ metadata: { ...metadata, recoveryApprovals: approvals, recovered }, updatedAt: new Date() })
      .where(eq(escrowAccounts.id, escrowId)).returning();
    return { updated, recovered, approvals };
  }
}

export const escrowService = new EscrowService();
