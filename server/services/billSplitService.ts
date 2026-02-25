/**
 * Bill Split Service - Utility for partitioning expenses and managing payments
 * Handles splitting expenses among multiple participants, tracking payments, and settlements
 */

import { db } from "../db";
import { notificationService } from "../notificationService";
import { Logger } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";
import {
  billSplits,
  billSplitParticipants,
  billSplitPayments,
  BillSplit,
  BillSplitParticipant,
  BillSplitPayment,
} from "../../shared/schema";
import { eq, and, or, desc } from "drizzle-orm";

const logger = Logger.getLogger();

export interface CreateBillSplitInput {
  creatorId: string;
  daoId?: string;
  title: string;
  description?: string;
  totalAmount: string;
  currency?: string;
  splitMethod: "equal" | "custom" | "percentage" | "weighted";
  participants: ParticipantInput[];
}

export interface ParticipantInput {
  userId?: string;
  daoId?: string;
  walletAddress?: string;
  sharePercentage?: number;
  customAmount?: string;
}

/**
 * Create a new bill split utility
 */
export async function createBillSplit(input: CreateBillSplitInput): Promise<BillSplit> {
  const billSplitId = uuidv4();
  const totalAmountNum = parseFloat(input.totalAmount);

  // Insert bill split
  const split = await db
    .insert(billSplits)
    .values({
      id: billSplitId as any,
      creatorId: input.creatorId,
      daoId: input.daoId as any,
      title: input.title,
      description: input.description,
      totalAmount: totalAmountNum.toString(),
      currency: input.currency || "cUSD",
      splitMethod: input.splitMethod,
      status: "active",
    })
    .returning();

  if (!split[0]) {
    throw new Error("Failed to create bill split");
  }

  // Create participants
  for (let i = 0; i < input.participants.length; i++) {
    const participant = input.participants[i];
    let amountOwed = 0;

    if (input.splitMethod === "equal") {
      amountOwed = totalAmountNum / input.participants.length;
    } else if (input.splitMethod === "custom" && participant.customAmount) {
      amountOwed = parseFloat(participant.customAmount);
    } else if (input.splitMethod === "percentage" && participant.sharePercentage) {
      amountOwed = (totalAmountNum * participant.sharePercentage) / 100;
    } else if (input.splitMethod === "weighted") {
      amountOwed = totalAmountNum / input.participants.length;
    }

    await db.insert(billSplitParticipants).values({
      id: uuidv4() as any,
      billSplitId: billSplitId as any,
      userId: participant.userId as any,
      daoId: participant.daoId as any,
      walletAddress: participant.walletAddress,
      sharePercentage: input.splitMethod === "percentage" ? participant.sharePercentage?.toString() as any : null,
      customAmount: input.splitMethod === "custom" ? participant.customAmount : null,
      amountOwed: amountOwed.toString(),
      status: "pending",
    });

    // Notify participant
    if (participant.userId) {
      await notificationService.createNotification({
        userId: participant.userId,
        title: "You've been added to a bill split",
        message: `${input.title}: You owe ${amountOwed.toFixed(2)} ${input.currency || "cUSD"}`,
        type: "bill_split_created",
        metadata: { billSplitId },
      });
    }
  }

  logger.info(`Bill split created: ${billSplitId}`);
  return split[0];
}

/**
 * Get bill splits for a user
 */
export async function getUserBillSplits(
  userId: string,
  status?: string
): Promise<BillSplit[]> {
  const conditions = [eq(billSplits.creatorId, userId)];
  if (status) {
    conditions.push(eq(billSplits.status, status));
  }

  return db
    .select()
    .from(billSplits)
    .where(and(...(conditions as any)))
    .orderBy(desc(billSplits.createdAt));
}

/**
 * Get bill split details with participants
 */
export async function getBillSplitDetails(billSplitId: string) {
  const split = await db
    .select()
    .from(billSplits)
    .where(eq(billSplits.id, billSplitId as any))
    .limit(1);

  if (!split[0]) {
    throw new Error("Bill split not found");
  }

  const participants = await db
    .select()
    .from(billSplitParticipants)
    .where(eq(billSplitParticipants.billSplitId, billSplitId as any));

  return {
    ...split[0],
    participants,
  };
}

/**
 * Record payment for bill split
 */
export async function recordBillSplitPayment(
  billSplitId: string,
  participantName: string,
  amount: number,
  transactionHash: string,
  currency?: string
): Promise<void> {
  // Fetch bill split to get currency
  const billSplit = await db
    .select()
    .from(billSplits)
    .where(eq(billSplits.id, billSplitId as any))
    .limit(1);

  if (!billSplit[0]) {
    throw new Error(`Bill split not found`);
  }

  // Validate currency if provided
  if (currency && currency !== billSplit[0].currency) {
    throw new Error(
      `Currency mismatch: expected ${billSplit[0].currency}, got ${currency}`
    );
  }

  // Find participant by name/walletAddress/userId
  const participant = await db
    .select()
    .from(billSplitParticipants)
    .where(
      and(
        eq(billSplitParticipants.billSplitId, billSplitId as any),
        or(
          eq(billSplitParticipants.walletAddress, participantName),
          eq(billSplitParticipants.userId, participantName)
        )
      )
    )
    .limit(1);

  if (!participant[0]) {
    throw new Error(`Participant not found for bill split`);
  }

  const billSplitParticipantId = participant[0].id;

  // Update participant
  await db
    .update(billSplitParticipants)
    .set({
      amountPaid: amount.toString(),
      status: "paid",
      paidAt: new Date(),
      transactionHash,
      updatedAt: new Date(),
    })
    .where(eq(billSplitParticipants.id, billSplitParticipantId as any));

  // Record payment
  await db.insert(billSplitPayments).values({
    id: uuidv4() as any,
    billSplitId: billSplitId as any,
    paymentId: billSplitParticipantId as any,
    amount: amount.toString(),
    transactionHash,
    status: "confirmed",
    confirmedAt: new Date(),
  });

  logger.info(`Bill split payment recorded: ${transactionHash}`);
}

/**
 * Get settlement summary for bill split
 */
export async function getBillSplitSettlement(billSplitId: string) {
  const split = await db
    .select()
    .from(billSplits)
    .where(eq(billSplits.id, billSplitId as any))
    .limit(1);

  if (!split[0]) {
    throw new Error("Bill split not found");
  }

  const participants = await db
    .select()
    .from(billSplitParticipants)
    .where(eq(billSplitParticipants.billSplitId, billSplitId as any));

  const totalOwed = participants.reduce(
    (sum, p) => sum + parseFloat(p.amountOwed.toString()),
    0
  );
  const totalPaid = participants.reduce(
    (sum, p) => sum + parseFloat((p.amountPaid?.toString() || "0")),
    0
  );
  const outstanding = totalOwed - totalPaid;

  return {
    billSplit: split[0],
    participants,
    totalOwed,
    totalPaid,
    outstanding,
    settled: outstanding === 0,
  };
}

/**
 * Cancel bill split
 */
export async function cancelBillSplit(billSplitId: string): Promise<void> {
  await db
    .update(billSplits)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(eq(billSplits.id, billSplitId as any));

  logger.info(`Bill split cancelled: ${billSplitId}`);
}

/**
 * Mark bill split as settled
 */
export async function settleBillSplit(billSplitId: string): Promise<void> {
  const settlement = await getBillSplitSettlement(billSplitId);

  if (settlement.outstanding > 0) {
    throw new Error("Cannot settle bill split with outstanding amounts");
  }

  await db
    .update(billSplits)
    .set({
      status: "settled",
      updatedAt: new Date(),
    })
    .where(eq(billSplits.id, billSplitId as any));

  logger.info(`Bill split settled: ${billSplitId}`);
}
