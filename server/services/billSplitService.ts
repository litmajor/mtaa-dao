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
  users,
  daos,
  type BillSplit,
  type BillSplitParticipant,
  type BillSplitPayment,
} from "../../shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

const logger = Logger.getLogger();

export interface CreateBillSplitInput {
  creatorId: string;
  daoId?: string;
  title: string;
  description?: string;
  totalAmount: string;
  currency?: string;
  splitMethod: "equal" | "custom" | "percentage";
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
  const totalUnits = amountToUnits(input.totalAmount);
  if (totalUnits <= 0n || input.participants.length === 0) {
    throw new Error("Bill split requires a positive total and at least one participant");
  }

  const participantKeys = new Set<string>();
  for (const [index, participant] of input.participants.entries()) {
    const destinations = [participant.userId, participant.daoId, participant.walletAddress].filter(Boolean);
    if (destinations.length !== 1) {
      throw new Error(`Participant ${index + 1} must identify exactly one user, DAO, or wallet`);
    }
    const key = participant.userId
      ? `user:${participant.userId}`
      : participant.daoId
        ? `dao:${participant.daoId}`
        : `wallet:${participant.walletAddress!.toLowerCase()}`;
    if (participantKeys.has(key)) throw new Error(`Duplicate bill split participant: ${key}`);
    participantKeys.add(key);

    if (participant.userId && !await db.query.users.findFirst({ where: eq(users.id, participant.userId), columns: { id: true } })) {
      throw new Error(`Participant user ${participant.userId} does not exist`);
    }
    if (participant.daoId && !await db.query.daos.findFirst({ where: eq(daos.id, participant.daoId), columns: { id: true } })) {
      throw new Error(`Participant DAO ${participant.daoId} does not exist`);
    }
  }
  if (input.splitMethod === "custom") {
    const customTotal = input.participants.reduce((sum, participant) => sum + (participant.customAmount ? amountToUnits(participant.customAmount) : 0n), 0n);
    if (input.participants.some((participant) => !participant.customAmount || amountToUnits(participant.customAmount) <= 0n) || customTotal !== totalUnits) {
      throw new Error("Custom participant amounts must be positive and equal the bill total");
    }
  }
  if (input.splitMethod === "percentage") {
    const percentageUnits = input.participants.map((participant) => {
      const percentage = participant.sharePercentage;
        if (percentage === undefined || !Number.isFinite(percentage) || percentage < 0 || percentage > 100 ||
          Math.abs(percentage * 100 - Math.round(percentage * 100)) >= 1e-8) {
        throw new Error("Participant percentages must be non-negative with at most two decimal places");
      }
      return BigInt(Math.round(percentage * 100));
    });
    if (percentageUnits.reduce((sum, percentage) => sum + percentage, 0n) !== 10_000n) {
      throw new Error("Participant percentages must be non-negative and total 100");
    }
  }

  // Create participants. Distribute percentage-rounding remainder to the
  // recipients with the largest fractional remainders, so 0%-share recipients
  // never receive rounding dust.
  const percentageUnits = input.participants.map((participant) => BigInt(Math.round((participant.sharePercentage ?? 0) * 100)));
  const percentageAllocations = input.splitMethod === 'percentage'
    ? apportionUnits(totalUnits, percentageUnits)
    : [];
  let allocatedUnits = 0n;
  const allocations = input.participants.map((participant, index) => {
    let amountOwedUnits: bigint;

    if (input.splitMethod === 'equal') {
      const baseUnits = totalUnits / BigInt(input.participants.length);
      amountOwedUnits = index === input.participants.length - 1 ? totalUnits - allocatedUnits : baseUnits;
    } else if (input.splitMethod === 'custom' && participant.customAmount) {
      amountOwedUnits = amountToUnits(participant.customAmount);
    } else if (input.splitMethod === 'percentage' && participant.sharePercentage !== undefined) {
      amountOwedUnits = percentageAllocations[index];
    } else {
      throw new Error(`Participant ${index + 1} has an invalid allocation`);
    }
    allocatedUnits += amountOwedUnits;
    return { participant, amountOwed: unitsToAmount(amountOwedUnits) };
  });

  const createdSplit = await db.transaction(async (tx) => {
    const [split] = await tx
      .insert(billSplits)
      .values({
        id: billSplitId as any,
        creatorId: input.creatorId,
        daoId: input.daoId as any,
        title: input.title,
        description: input.description,
        totalAmount: unitsToAmount(totalUnits),
        currency: input.currency || 'cUSD',
        splitMethod: input.splitMethod,
        status: 'active',
      })
      .returning();

    if (!split) throw new Error('Failed to create bill split');

    for (const { participant, amountOwed } of allocations) {
      await tx.insert(billSplitParticipants).values({
        id: uuidv4() as any,
        billSplitId: billSplitId as any,
        userId: participant.userId as any,
        daoId: participant.daoId as any,
        walletAddress: participant.walletAddress,
        sharePercentage: input.splitMethod === 'percentage' ? participant.sharePercentage?.toString() as any : null,
        customAmount: input.splitMethod === 'custom' ? participant.customAmount : null,
        amountOwed,
        status: 'pending',
      });
    }
    return split;
  });

  for (const { participant, amountOwed } of allocations) {
    if (!participant.userId) continue;
    try {
      await notificationService.createNotification({
        userId: participant.userId,
        title: "You've been added to a bill split",
        message: `${input.title}: You owe ${amountOwed} ${input.currency || "cUSD"}`,
        type: "bill_split_created",
        metadata: { billSplitId },
      });
    } catch (error) {
      logger.error('Failed to notify bill split participant after creation', { billSplitId, participantId: participant.userId, error });
    }
  }

  logger.info(`Bill split created: ${billSplitId}`);
  return createdSplit;
}

/**
 * Get bill splits for a user
 */
export async function getUserBillSplits(
  userId: string,
  status?: string
): Promise<BillSplit[]> {
  const statusCondition = status ? eq(billSplits.status, status) : undefined;
  const createdConditions = statusCondition
    ? and(eq(billSplits.creatorId, userId), statusCondition)
    : eq(billSplits.creatorId, userId);
  const participantConditions = statusCondition
    ? and(eq(billSplitParticipants.userId, userId), statusCondition)
    : eq(billSplitParticipants.userId, userId);

  const created = await db
    .select()
    .from(billSplits)
    .where(createdConditions)
    .orderBy(desc(billSplits.createdAt));
  const participating = await db
    .select({ split: billSplits })
    .from(billSplitParticipants)
    .innerJoin(billSplits, eq(billSplitParticipants.billSplitId, billSplits.id))
    .where(participantConditions)
    .orderBy(desc(billSplits.createdAt));

  const uniqueSplits = new Map<string, BillSplit>();
  for (const split of created) uniqueSplits.set(split.id, split);
  for (const row of participating) uniqueSplits.set(row.split.id, row.split);
  return [...uniqueSplits.values()].sort((left, right) =>
    (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0)
  );
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
  amount: number | string,
  transactionHash: string,
  currency?: string
): Promise<void> {
  const amountUnits = amountToUnits(String(amount));
  if (amountUnits <= 0n || !transactionHash.trim()) {
    throw new Error("A positive payment amount and transaction hash are required");
  }
  // Fetch bill split to get currency
  const billSplit = await db
    .select()
    .from(billSplits)
    .where(eq(billSplits.id, billSplitId as any))
    .limit(1);

  if (!billSplit[0]) {
    throw new Error(`Bill split not found`);
  }
  if (billSplit[0].status !== 'active') {
    throw new Error(`Cannot record payment for a ${billSplit[0].status} bill split`);
  }

  // Validate currency if provided
  if (currency && currency !== billSplit[0].currency) {
    throw new Error(
      `Currency mismatch: expected ${billSplit[0].currency}, got ${currency}`
    );
  }

  await db.transaction(async (tx) => {
    const [participant] = await tx
      .select()
      .from(billSplitParticipants)
      .where(and(
        eq(billSplitParticipants.billSplitId, billSplitId as any),
        eq(billSplitParticipants.userId, participantName)
      ))
      .limit(1)
      .for('update');

    if (!participant) throw new Error('Participant not found for bill split');
    if (!participant.userId) throw new Error('Bill payment confirmation is limited to participants linked to an authenticated user account');

    const [duplicate] = await tx.select({ id: billSplitPayments.id })
      .from(billSplitPayments)
      .where(and(
        eq(billSplitPayments.billSplitId, billSplitId as any),
        eq(billSplitPayments.transactionHash, transactionHash)
      ))
      .limit(1);
    if (duplicate) throw new Error('Transaction hash has already been recorded for this bill split');

    const alreadyPaid = amountToUnits(participant.amountPaid ?? '0');
    const amountOwed = amountToUnits(participant.amountOwed);
    const priorSubmissions = await tx.select({ amount: billSplitPayments.amount })
      .from(billSplitPayments)
      .where(and(
        eq(billSplitPayments.paymentId, participant.id as any),
        inArray(billSplitPayments.status, ['pending', 'confirmed'])
      ));
    const submitted = priorSubmissions.reduce((sum, payment) => sum + amountToUnits(payment.amount), 0n);
    if (amountUnits > amountOwed - alreadyPaid - submitted) {
      throw new Error('Payment exceeds the participant outstanding balance');
    }

    // A client-supplied transaction hash is not proof of an on-chain transfer.
    // Keep this submission pending until a chain verifier confirms it.
    await tx.insert(billSplitPayments).values({
      id: uuidv4() as any,
      billSplitId: billSplitId as any,
      paymentId: participant.id as any,
      amount: unitsToAmount(amountUnits),
      transactionHash,
      status: 'pending',
      confirmedAt: null,
    });
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

  const totalOwedUnits = participants.reduce((sum, participant) => sum + amountToUnits(participant.amountOwed), 0n);
  const totalPaidUnits = participants.reduce((sum, participant) => sum + amountToUnits(participant.amountPaid ?? '0'), 0n);
  const totalOwed = Number(unitsToAmount(totalOwedUnits));
  const totalPaid = Number(unitsToAmount(totalPaidUnits));
  const outstanding = Number(unitsToAmount(totalOwedUnits - totalPaidUnits));

  return {
    billSplit: split[0],
    participants,
    totalOwed,
    totalPaid,
    outstanding,
    settled: totalOwedUnits === totalPaidUnits,
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

  if (!settlement.settled) {
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

function amountToUnits(value: string | number): bigint {
  const normalized = String(value).trim();
  if (!/^\d+(?:\.\d{1,8})?$/.test(normalized)) {
    throw new Error('Amount must be a non-negative decimal with at most eight fractional digits');
  }
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole) * 100_000_000n + BigInt(fraction.padEnd(8, '0'));
}

function unitsToAmount(units: bigint): string {
  if (units < 0n) throw new Error('Amount cannot be negative');
  const whole = units / 100_000_000n;
  const fraction = (units % 100_000_000n).toString().padStart(8, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function apportionUnits(totalUnits: bigint, percentageUnits: bigint[]): bigint[] {
  const shares = percentageUnits.map((percentage) => totalUnits * percentage / 10_000n);
  let remainder = totalUnits - shares.reduce((sum, share) => sum + share, 0n);
  const remainderOrder = percentageUnits
    .map((percentage, index) => ({
      index,
      fraction: totalUnits * percentage % 10_000n,
    }))
    .sort((left, right) => left.fraction === right.fraction
      ? left.index - right.index
      : left.fraction > right.fraction ? -1 : 1);

  for (let i = 0; remainder > 0n; i++, remainder--) {
    const index = remainderOrder[i % remainderOrder.length].index;
    shares[index] += 1n;
  }
  return shares;
}
