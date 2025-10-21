
import { db } from '../storage';
import { escrowAccounts, escrowMilestones, escrowDisputes } from '../../shared/escrowSchema';
import { walletTransactions, users } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
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
}

export const escrowService = new EscrowService();
