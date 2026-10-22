import type { Request, Response } from 'express';
import { db } from '../db';
import {
  daos,
  daoContributions,
  daoMemberships,
  daoRotationCycles,
  daoRotationPayoutConfirmations,
  daoRotationPayouts,
  daoContributionTypes,
  users,
} from '../../shared/schema';
import { eq, and, inArray, or, sql } from 'drizzle-orm';
import { ethers } from 'ethers';
import { timingSafeEqual } from 'node:crypto';
import { Logger } from '../utils/logger';
import { evaluateRotationRules, formatRuleRejectionMessage, logRuleEvaluation } from '../services/rules-integration';
import {
  distributeToRecipientOnChain,
  getCurrentRotationCycleOnChain,
  getRotationConfigOnChain,
  getRotationMemberAddress,
  getStablecoinDecimals,
  getStablecoinSymbol,
  inspectRotationContribution,
  initializeRotationOnChain,
  recordContributionOnChain,
  verifyStablecoinTransfer,
} from '../services/rotation_contract';
import {
  getB2cCallbackToken,
  initiateDarajaB2cPayout,
  MAX_B2C_AMOUNT_KES,
} from '../services/mpesaB2cPayoutService';

const logger = new Logger('rotation-service');

// In-process lock map
const rotationLocks: Map<string, boolean> = new Map();

export enum RotationSelectionMethod {
  SEQUENTIAL = 'sequential',
  LOTTERY = 'lottery',
  PROPORTIONAL = 'proportional',
}

export interface RotationRecipient {
  userId: string;
  cycleNumber: number;
  amountToReceive: string;
  distributedAt?: Date;
}

export function shouldUseOnChainRotationRail(expectedPoolKes: number): boolean {
  return Number.isSafeInteger(expectedPoolKes) && expectedPoolKes > MAX_B2C_AMOUNT_KES;
}

async function processHighValueOnChainRotation(input: {
  dao: typeof daos.$inferSelect;
  daoId: string;
  recipientUserId: string;
  selectionMethod: RotationSelectionMethod;
  eligibleMembers: Awaited<ReturnType<typeof getRotationEligibleMembers>>;
  expectedPoolKes: number;
}) {
  const { dao, daoId, recipientUserId, selectionMethod, eligibleMembers, expectedPoolKes } = input;
  if (!dao.chamaTreasuryAddress || !process.env.ROTATION_MODULE_ADDRESS) {
    return {
      status: 'configuration_required',
      reason: 'This pool exceeds the M-Pesa B2C ceiling. Configure a ChamaTreasury and RotationModule for direct stablecoin contributions; KES is not converted automatically.',
      amountKes: expectedPoolKes,
    };
  }
  if (dao.rotationFrequency !== 'monthly') {
    return {
      status: 'configuration_required',
      reason: 'On-chain rotations currently use a 30-day schedule. Set the high-value rotation frequency to monthly.',
      amountKes: expectedPoolKes,
    };
  }
  if (selectionMethod !== RotationSelectionMethod.SEQUENTIAL) {
    return {
      status: 'configuration_required',
      reason: 'On-chain rotations currently support sequential recipient selection only.',
      amountKes: expectedPoolKes,
    };
  }

  const cycleNumber = (dao.currentRotationCycle || 0) + 1;
  const [currentCycleKesContribution] = await db
    .select({ id: daoContributions.id })
    .from(daoContributions)
    .where(and(
      eq(daoContributions.daoId, daoId),
      eq(daoContributions.currency, 'KES'),
      inArray(daoContributions.status, ['pending', 'approved', 'completed', 'rotation_pending']),
      sql`${daoContributions.metadata}->>'cycle' = ${String(cycleNumber)}`
    ))
    .limit(1);
  if (currentCycleKesContribution) {
    return {
      status: 'rail_conflict',
      reason: 'KES payments already exist for this cycle. Reconcile or refund them before starting a stablecoin cycle; the app will not convert or mix the two rails.',
      amountKes: expectedPoolKes,
    };
  }

  let config: Awaited<ReturnType<typeof getRotationConfigOnChain>>;
  try {
    config = await getRotationConfigOnChain(dao.chamaTreasuryAddress);
  } catch (error) {
    logger.error(`Unable to read high-value rotation configuration for DAO ${daoId}: ${error}`);
    return {
      status: 'configuration_required',
      reason: 'Unable to verify the on-chain rotation configuration. Check the configured RPC and RotationModule before proceeding.',
      amountKes: expectedPoolKes,
    };
  }
  if (Number(config.totalMembers) === 0) {
    return {
      status: 'configuration_required',
      reason: 'Initialize the on-chain rotation before collecting stablecoin contributions. Existing KES contributions are never converted automatically.',
      amountKes: expectedPoolKes,
    };
  }
  if (Number(config.totalMembers) !== eligibleMembers.length) {
    return {
      status: 'roster_mismatch',
      reason: 'The initialized on-chain roster does not match the current approved member list. Resolve membership changes before this payout.',
      amountKes: expectedPoolKes,
    };
  }
  const currentBindings = await getRotationMemberBindings(daoId);
  const currentAddresses = await Promise.all(currentBindings.map((binding) =>
    getRotationMemberAddress(dao.chamaTreasuryAddress!, binding.memberId)
  ));
  if (currentBindings.some((binding, index) =>
    currentAddresses[index].toLowerCase() !== binding.address.toLowerCase()
  )) {
    return {
      status: 'roster_mismatch',
      reason: 'An approved member wallet no longer matches the initialized on-chain roster. Resolve the roster before this payout.',
      amountKes: expectedPoolKes,
    };
  }

  const configuredStablecoin = process.env.STABLECOIN_ADDRESS;
  if (!configuredStablecoin || !ethers.isAddress(configuredStablecoin) ||
      String(config.stablecoin).toLowerCase() !== configuredStablecoin.toLowerCase()) {
    return {
      status: 'configuration_required',
      reason: 'The configured stablecoin does not match the token used by the on-chain rotation.',
      amountKes: expectedPoolKes,
    };
  }

  const registeredRecipient = await getRotationMemberAddress(
    dao.chamaTreasuryAddress,
    getRotationMemberId(recipientUserId)
  );
  const [recipient] = await db.select({ walletAddress: users.walletAddress })
    .from(users)
    .where(eq(users.id, recipientUserId))
    .limit(1);
  if (!recipient?.walletAddress ||
      registeredRecipient.toLowerCase() !== recipient.walletAddress.toLowerCase()) {
    return {
      status: 'roster_mismatch',
      reason: 'The next recipient is not registered at their current wallet address in the on-chain rotation.',
      amountKes: expectedPoolKes,
    };
  }

  const contractCycle = await getCurrentRotationCycleOnChain(dao.chamaTreasuryAddress);
  if (Number(contractCycle.cycleNumber) !== cycleNumber ||
      String(contractCycle.currentRecipientId).toLowerCase() !== getRotationMemberId(recipientUserId).toLowerCase()) {
    return {
      status: 'cycle_mismatch',
      reason: 'The database rotation order does not match the active on-chain cycle. No payout was submitted.',
      amountKes: expectedPoolKes,
    };
  }

  const paidContributions = await db
    .select({
      contributorId: daoContributions.contributorId,
      metadata: daoContributions.metadata,
    })
    .from(daoContributions)
    .where(and(
      eq(daoContributions.daoId, daoId),
      eq(daoContributions.currency, await getStablecoinSymbol(configuredStablecoin)),
      inArray(daoContributions.status, ['approved', 'completed']),
      sql`${daoContributions.metadata}->>'method' = 'on-chain stablecoin'`,
      sql`${daoContributions.metadata}->>'chainStatus' = 'recorded'`,
      sql`${daoContributions.metadata}->>'cycleNumber' = ${String(cycleNumber)}`
    ));
  const paidMemberIds = new Set(paidContributions.map((contribution) => contribution.contributorId));
  if (paidContributions.length !== eligibleMembers.length ||
      paidMemberIds.size !== eligibleMembers.length ||
      eligibleMembers.some((member) => !paidMemberIds.has(member.userId))) {
    return {
      status: 'contributions_incomplete',
      reason: `Waiting for all ${eligibleMembers.length} approved members to transfer the exact on-chain stablecoin contribution.`,
      paidMembers: paidMemberIds.size,
      totalMembers: eligibleMembers.length,
      amountKes: expectedPoolKes,
    };
  }

  const nextDistributionDate = Number(contractCycle.nextDistributionDate);
  if (!Number.isSafeInteger(nextDistributionDate) || Date.now() < nextDistributionDate * 1000) {
    return {
      status: 'skipped',
      reason: 'The on-chain rotation cycle is not yet due.',
      nextRotationDate: Number.isSafeInteger(nextDistributionDate)
        ? new Date(nextDistributionDate * 1000).toISOString()
        : null,
    };
  }

  const decimals = await getStablecoinDecimals(configuredStablecoin);
  const symbol = await getStablecoinSymbol(configuredStablecoin);
  const amountDistributed = ethers.formatUnits(
    BigInt(config.monthlyContribution) * BigInt(eligibleMembers.length),
    decimals
  );
  const [cycle] = await db.insert(daoRotationCycles).values({
    daoId,
    cycleNumber,
    recipientUserId,
    status: 'pending_on_chain_confirmation',
    startDate: dao.nextRotationDate ?? new Date(),
    endDate: new Date(),
    amountDistributed,
    notes: `Direct ${symbol} rotation payout proposal - ${selectionMethod} method; KES pool estimate ${expectedPoolKes} is not converted.`,
  }).returning({ id: daoRotationCycles.id });
  if (!cycle) throw new Error(`Failed to create high-value on-chain rotation cycle for DAO ${daoId}`);

  try {
    const onchainResult = await distributeToRecipientOnChain(dao.chamaTreasuryAddress);
    await db.update(daoRotationCycles).set({
      transactionHash: onchainResult.txHash,
      notes: `Awaiting ChamaTreasury execution in ${symbol}; direct stablecoin rail. KES pool estimate ${expectedPoolKes} was not converted.`,
      updatedAt: new Date(),
    }).where(eq(daoRotationCycles.id, cycle.id));
    return {
      status: 'pending_on_chain_confirmation',
      cycleId: cycle.id,
      cycleNumber,
      recipientUserId,
      amountDistributed,
      currency: symbol,
      transactionHash: onchainResult.txHash,
      message: 'Treasury payout proposal created. The cycle completes only after the ChamaTreasury executes it.',
    };
  } catch (error) {
    logger.error(`Failed to dispatch high-value on-chain rotation for DAO ${daoId}: ${error}`);
    await db.update(daoRotationCycles).set({
      status: 'failed',
      updatedAt: new Date(),
      notes: `On-chain payout proposal failed: ${error instanceof Error ? error.message : String(error)}`,
    }).where(eq(daoRotationCycles.id, cycle.id));
    throw error;
  }
}

function getPayoutConfirmerRole(role: string | null | undefined): 'treasurer' | 'elder' | null {
  const normalizedRole = (role || '').toLowerCase();
  if (normalizedRole === 'elder') return 'elder';
  if (['treasurer', 'admin', 'owner', 'founder'].includes(normalizedRole)) return 'treasurer';
  return null;
}

/**
 * Get all members eligible for rotation
 */
async function getRotationEligibleMembers(daoId: string) {
  try {
    const members = await db
      .select()
      .from(daoMemberships)
      .where(
        and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.status, 'approved'),
          eq(daoMemberships.isBanned, false)
        )
      );

    logger.info(`Found ${members.length} eligible members for rotation in DAO ${daoId}`);
    return members;
  } catch (err) {
    logger.error(`Error getting rotation eligible members: ${err}`);
    throw err;
  }
}

/**
 * Select next rotation recipient based on configured method
 */
export async function selectRotationRecipient(
  daoId: string,
  rotationMethod: RotationSelectionMethod
): Promise<string> {
  try {
    const [dao] = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao) {
      throw new Error(`DAO not found: ${daoId}`);
    }

    const members = await getRotationEligibleMembers(daoId);

    if (members.length === 0) {
      throw new Error('No eligible members for rotation');
    }

    let selectedMember;

    switch (rotationMethod) {
      case RotationSelectionMethod.SEQUENTIAL:
        selectedMember = selectSequential(members, dao.currentRotationCycle || 0);
        break;

      case RotationSelectionMethod.LOTTERY:
        selectedMember = selectLottery(members);
        break;

      case RotationSelectionMethod.PROPORTIONAL:
        selectedMember = await selectProportional(daoId, members);
        break;

      default:
        selectedMember = members[0];
    }

    logger.info(`Selected ${selectedMember.userId} for rotation cycle ${dao.currentRotationCycle || 0}`);
    return selectedMember.userId;
  } catch (err) {
    logger.error(`Error selecting rotation recipient: ${err}`);
    throw err;
  }
}

/**
 * Sequential: Order by join date (immutably)
 */
function selectSequential(members: any[], cycleNumber: number) {
  // Immutably copy array before sorting
  const sorted = [...members].sort(
    (a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
  );

  const index = cycleNumber % sorted.length;
  return sorted[index];
}

/**
 * Lottery: Random selection
 */
function selectLottery(members: any[]) {
  const randomIndex = Math.floor(Math.random() * members.length);
  return members[randomIndex];
}

/**
 * Proportional: Weighted random selection based on past contributions
 */
async function selectProportional(daoId: string, members: any[]) {
  try {
    const { ContributionAnalyzer } = await import('../core/nuru/analytics/contribution_analyzer');
    const analyzer = new ContributionAnalyzer();

    const memberIds = members.map((m) => m.userId || m.id);
    const weights = await analyzer.getContributionWeights(daoId, memberIds, '90d');

    const totalWeight = Object.values(weights).reduce((a: number, b: any) => a + Number(b || 0), 0);

    if (totalWeight === 0) {
      return selectLottery(members);
    }

    let random = Math.random() * totalWeight;
    for (const member of members) {
      const memberId = member.userId || member.id;
      const weight = weights[memberId] || 1;
      random -= weight;

      if (random <= 0) {
        return member;
      }
    }

    return members[members.length - 1];
  } catch (error) {
    logger.error('Error in selectProportional, falling back to random selection:', error);
    return selectLottery(members);
  }
}

/**
 * Process rotation and update state
 */
export async function processRotation(daoId: string) {
  let acquiredDbLock = false;

  try {
    const [dao] = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao) {
      throw new Error(`DAO not found: ${daoId}`);
    }

    if (dao.durationModel !== 'rotation') {
      throw new Error('DAO does not use rotation model');
    }

    // Acquire in-process memory lock
    if (rotationLocks.get(daoId)) {
      logger.warn(`Rotation already in progress for DAO ${daoId} (in-memory lock)`);
      return { status: 'skipped', reason: 'Rotation already in progress' };
    }

    rotationLocks.set(daoId, true);

    // Acquire atomic DB lock
    const updated = await db
      .update(daos)
      .set({ rotationProcessing: true, updatedAt: new Date() })
      .where(and(eq(daos.id, daoId), eq(daos.rotationProcessing, false)))
      .returning();

    if (!updated || updated.length === 0) {
      logger.warn(`Rotation already in progress for DAO ${daoId} (database lock)`);
      rotationLocks.delete(daoId);
      return { status: 'skipped', reason: 'Rotation already in progress (db lock)' };
    }

    acquiredDbLock = true;

    const [pendingManualCycle] = await db
      .select()
      .from(daoRotationCycles)
      .where(and(
        eq(daoRotationCycles.daoId, daoId),
        inArray(daoRotationCycles.status, ['pending_manual_payout', 'pending_b2c_payout'])
      ))
      .limit(1);
    if (pendingManualCycle) {
      return {
        status: pendingManualCycle.status,
        cycleId: pendingManualCycle.id,
        cycleNumber: pendingManualCycle.cycleNumber,
        recipientUserId: pendingManualCycle.recipientUserId,
        amountDistributed: pendingManualCycle.amountDistributed,
      };
    }

    const [pendingOnChainCycle] = await db
      .select()
      .from(daoRotationCycles)
      .where(and(
        eq(daoRotationCycles.daoId, daoId),
        eq(daoRotationCycles.status, 'pending_on_chain_confirmation')
      ))
      .limit(1);
    if (pendingOnChainCycle) {
      return {
        status: 'pending_on_chain_confirmation',
        cycleId: pendingOnChainCycle.id,
        cycleNumber: pendingOnChainCycle.cycleNumber,
        recipientUserId: pendingOnChainCycle.recipientUserId,
        transactionHash: pendingOnChainCycle.transactionHash,
      };
    }

    // Verify rotation timing eligibility
    if (!dao.nextRotationDate || new Date() < new Date(dao.nextRotationDate)) {
      logger.info(`Not yet time for rotation. Next rotation: ${dao.nextRotationDate}`);
      return { status: 'skipped', reason: 'Not yet time for rotation' };
    }

    const selectionMethod = (dao.rotationSelectionMethod || 'sequential') as RotationSelectionMethod;
    const recipientUserId = await selectRotationRecipient(daoId, selectionMethod);

    // Evaluate business rules
    const ruleResult = await evaluateRotationRules(daoId, {
      nextLeader: recipientUserId,
      rotationFrequency: dao.rotationFrequency || 'monthly',
      rotationDate: new Date(),
    });

    if (!ruleResult.approved) {
      const reason = formatRuleRejectionMessage(ruleResult.results);
      logger.warn(`Rotation rejected by rules for DAO ${daoId}: ${reason}`);
      logRuleEvaluation(daoId, 'rotation', recipientUserId, ruleResult.results);
      return { status: 'rejected', reason, rules: ruleResult.results };
    }

    const availableKesContributions = await db
      .select({
        id: daoContributions.id,
        contributorId: daoContributions.contributorId,
        amount: daoContributions.amount,
        status: daoContributions.status,
        metadata: daoContributions.metadata,
        approvalsCount: daoContributions.approvalsCount,
        requiredApprovals: daoContributions.requiredApprovals,
      })
      .from(daoContributions)
      .where(and(
        eq(daoContributions.daoId, daoId),
        eq(daoContributions.currency, 'KES'),
        inArray(daoContributions.status, ['approved', 'completed']),
        sql`${daoContributions.metadata}->>'rotationCycleId' IS NULL`,
        sql`(
          (
            ${daoContributions.metadata}->>'paymentStatus' = 'confirmed'
            AND NULLIF(${daoContributions.metadata}->>'mpesaReceipt', '') IS NOT NULL
          )
          OR ${daoContributions.approvalsCount} >= GREATEST(${daoContributions.requiredApprovals}, 2)
        )`
      ));

    let merryGoRoundMembers: Awaited<ReturnType<typeof getRotationEligibleMembers>> | null = null;
    if (dao.daoType === 'merryGoRound' && dao.rotationContributionAmountKes != null) {
        const fixedContribution = Number(dao.rotationContributionAmountKes);
        if (!Number.isSafeInteger(fixedContribution) || fixedContribution <= 0) {
          return {
            status: 'configuration_required',
            reason: 'Set a positive whole-KES contribution amount in the merry-go-round configuration.',
          };
        }
        merryGoRoundMembers = await getRotationEligibleMembers(daoId);
        const expectedPoolKes = fixedContribution * merryGoRoundMembers.length;
        if (!Number.isSafeInteger(expectedPoolKes)) {
          return {
            status: 'configuration_required',
            reason: 'The expected rotation pool is outside the supported amount range.',
          };
        }
        if (shouldUseOnChainRotationRail(expectedPoolKes)) {
          return processHighValueOnChainRotation({
            dao,
            daoId,
            recipientUserId,
            selectionMethod,
            eligibleMembers: merryGoRoundMembers,
            expectedPoolKes,
          });
        }
    }

    let amountDistributed: string | null = null;
    if (dao.daoType === 'merryGoRound' && dao.rotationContributionAmountKes != null) {
      const fixedContribution = Number(dao.rotationContributionAmountKes);
      if (!Number.isSafeInteger(fixedContribution) || fixedContribution <= 0) {
        return {
          status: 'configuration_required',
          reason: 'Set a positive whole-KES contribution amount in the merry-go-round configuration.',
        };
      }

      const rotationMembers = merryGoRoundMembers || await getRotationEligibleMembers(daoId);
      if (rotationMembers.length < 2) {
        return {
          status: 'contributions_incomplete',
          reason: 'At least two approved members are required for a rotation.',
          paidMembers: 0,
          totalMembers: rotationMembers.length,
        };
      }

      const eligibleMemberIds = new Set(rotationMembers.map((member) => member.userId));
      const memberContributions = new Map<string, number>();
      for (const contribution of availableKesContributions) {
        const contributorId = contribution.contributorId;
        if (!contributorId || !eligibleMemberIds.has(contributorId)) {
          return {
            status: 'contributions_incomplete',
            reason: 'An available contribution does not belong to an active rotation member.',
          };
        }
        if (memberContributions.has(contributorId)) {
          return {
            status: 'contributions_incomplete',
            reason: 'Each member must have exactly one approved contribution for the current cycle.',
          };
        }
        const amount = Number(contribution.amount);
        if (!Number.isSafeInteger(amount) || amount !== fixedContribution) {
          return {
            status: 'contributions_incomplete',
            reason: `Each active member must contribute exactly ${fixedContribution} KES.`,
          };
        }
        memberContributions.set(contributorId, amount);
      }

      if (memberContributions.size !== rotationMembers.length) {
        return {
          status: 'contributions_incomplete',
          reason: `Waiting for all ${rotationMembers.length} active members to contribute ${fixedContribution} KES.`,
          paidMembers: memberContributions.size,
          totalMembers: rotationMembers.length,
          requiredContributionKes: fixedContribution,
        };
      }

      const payoutAmount = fixedContribution * rotationMembers.length;
      if (!Number.isSafeInteger(payoutAmount) || payoutAmount < 10 || payoutAmount > MAX_B2C_AMOUNT_KES) {
        return {
          status: 'payout_amount_out_of_range',
          reason: `The complete rotation pool must be between 10 and ${MAX_B2C_AMOUNT_KES.toLocaleString()} KES for M-Pesa B2C.`,
          amountKes: payoutAmount,
        };
      }
      amountDistributed = String(payoutAmount);
    } else if (availableKesContributions.length > 0) {
      const { Decimal } = await import('decimal.js');
      const contributionTotal = availableKesContributions.reduce(
        (total, contribution) => total.plus(contribution.amount?.toString() || '0'),
        new Decimal(0)
      );
      if (contributionTotal.gt(0)) amountDistributed = contributionTotal.toFixed(2);
    }

    if (amountDistributed) {
      const manualCycle = await db.transaction(async (tx) => {
        const [daoTx] = await tx
          .select()
          .from(daos)
          .where(eq(daos.id, daoId))
          .limit(1);
        if (!daoTx) throw new Error(`DAO not found in transaction: ${daoId}`);

        const cycleNumber = (daoTx.currentRotationCycle || 0) + 1;
        const [cycle] = await tx
          .insert(daoRotationCycles)
          .values({
            daoId,
            cycleNumber,
            recipientUserId,
            status: 'pending_manual_payout',
            startDate: daoTx.nextRotationDate ?? new Date(),
            endDate: new Date(),
            amountDistributed,
            notes: `Awaiting M-Pesa B2C payout - ${selectionMethod} method`,
          })
          .returning({ id: daoRotationCycles.id });
        if (!cycle) throw new Error(`Failed to create rotation payout cycle for DAO ${daoId}`);

        let assignedCount = 0;
        for (const contribution of availableKesContributions) {
          const assigned = await tx
            .update(daoContributions)
            .set({
              status: 'rotation_pending',
              metadata: {
                ...((contribution.metadata || {}) as Record<string, unknown>),
                rotationCycleId: cycle.id,
                rotationPreviousStatus: contribution.status,
              },
              updatedAt: new Date(),
            })
            .where(and(
              eq(daoContributions.id, contribution.id),
              inArray(daoContributions.status, ['approved', 'completed']),
              sql`${daoContributions.metadata}->>'rotationCycleId' IS NULL`
            ))
            .returning({ id: daoContributions.id });
          assignedCount += assigned.length;
        }
        if (assignedCount !== availableKesContributions.length) {
          throw new Error('Contribution ledger changed while preparing the rotation payout');
        }

        return { cycleId: cycle.id, cycleNumber };
      });

      return {
        status: 'pending_manual_payout',
        cycleId: manualCycle.cycleId,
        cycleNumber: manualCycle.cycleNumber,
        recipientUserId,
        amountDistributed,
        currency: 'KES',
        message: 'Rotation payout is ready for the required treasurer and elder authorizations.',
      };
    }

    // Validate treasury units
    const vaultAddress = dao.chamaTreasuryAddress || '';
    if (!vaultAddress) {
      logger.warn(`No ChamaTreasury configured for DAO ${daoId}; creating manual payout cycle to track a manual distribution.`);

      // Create a manual payout cycle so treasurer can perform and confirm the M-Pesa payout.
      const manualCycle = await db.transaction(async (tx) => {
        const [daoTx] = await tx
          .select()
          .from(daos)
          .where(eq(daos.id, daoId))
          .limit(1);
        if (!daoTx) throw new Error(`DAO not found in transaction: ${daoId}`);

        const cycleNumber = (daoTx.currentRotationCycle || 0) + 1;
        const [cycle] = await tx
          .insert(daoRotationCycles)
          .values({
            daoId,
            cycleNumber,
            recipientUserId,
            status: 'pending_manual_payout',
            startDate: daoTx.nextRotationDate ?? new Date(),
            endDate: new Date(),
            amountDistributed: '0',
            notes: `Manual rotation payout required - no on-chain vault configured. Treasurer should send M-Pesa and confirm. Selection method: ${selectionMethod}`,
          })
          .returning({ id: daoRotationCycles.id });

        return { cycleId: cycle.id, cycleNumber };
      });

      return {
        status: 'pending_manual_payout',
        cycleId: manualCycle.cycleId,
        cycleNumber: manualCycle.cycleNumber,
        recipientUserId,
        amountDistributed: '0',
        currency: 'KES',
        message: 'No ChamaTreasury configured. Treasurer must perform manual KES payout (e.g., M-Pesa) and then confirm it with the cycle confirmation endpoint.',
      };
    }
    const rotationConfig = await getRotationConfigOnChain(vaultAddress);
    if (Number(rotationConfig.totalMembers) === 0) {
      throw new Error('On-chain rotation is not initialized for this ChamaTreasury');
    }
    const [recipient] = await db.select({ walletAddress: users.walletAddress })
      .from(users)
      .where(eq(users.id, recipientUserId))
      .limit(1);
    const registeredRecipient = await getRotationMemberAddress(vaultAddress, getRotationMemberId(recipientUserId));
    if (!recipient?.walletAddress ||
        registeredRecipient.toLowerCase() !== recipient.walletAddress.toLowerCase()) {
      throw new Error('Selected recipient is not registered in the initialized on-chain rotation');
    }

    // Execute atomic cycle insertion & DAO schedule updates inside SQL transaction
    const result = await db.transaction(async (tx) => {
      const [daoTx] = await tx
        .select()
        .from(daos)
        .where(eq(daos.id, daoId))
        .limit(1);

      if (!daoTx) throw new Error(`DAO not found in transaction: ${daoId}`);

      const cycleNumber = (daoTx.currentRotationCycle || 0) + 1;

      const [cycle] = await tx
        .insert(daoRotationCycles)
        .values({
          daoId,
          cycleNumber,
          recipientUserId,
          status: 'pending_on_chain_confirmation',
          startDate: daoTx.nextRotationDate ?? new Date(),
          endDate: new Date(),
          amountDistributed: '0',
          notes: `Automatic rotation distribution - ${selectionMethod} method`,
        })
        .returning();

      return { cycleNumber, cycleId: cycle.id };
    });

    // Execute on-chain payout
    let onchainResult: { txHash: string; blockNumber: number };
    try {
      onchainResult = await distributeToRecipientOnChain(vaultAddress);
      logger.info(`On-chain payout success: tx ${onchainResult.txHash} @ block ${onchainResult.blockNumber}`);

      await db
        .update(daoRotationCycles)
        .set({
          status: 'pending_on_chain_confirmation',
          transactionHash: onchainResult.txHash,
          notes: `Awaiting ChamaTreasury proposal execution - ${selectionMethod} method`,
          updatedAt: new Date(),
        })
        .where(eq(daoRotationCycles.id, result.cycleId));
    } catch (err: any) {
      logger.error(`Failed to dispatch on-chain rotation for DAO ${daoId}: ${err}`);
      await db
        .update(daoRotationCycles)
        .set({ status: 'failed', updatedAt: new Date(), notes: `on-chain error: ${err?.message || String(err)}` })
        .where(eq(daoRotationCycles.id, result.cycleId));

      throw err;
    }

    logger.info(`Rotation completed for DAO ${daoId}: Cycle ${result.cycleNumber}, Recipient: ${recipientUserId}`);
    logRuleEvaluation(daoId, 'rotation', recipientUserId, ruleResult.results);

    return {
      status: 'pending_on_chain_confirmation',
      cycleNumber: result.cycleNumber,
      recipientUserId,
      transactionHash: onchainResult.txHash,
      message: 'Treasury payout proposal created. The cycle completes after the treasury executes it.',
    };
  } catch (err) {
    logger.error(`Error processing rotation for DAO ${daoId}: ${err}`);
    throw err;
  } finally {
    if (acquiredDbLock) {
      try {
        await db
          .update(daos)
          .set({ rotationProcessing: false, updatedAt: new Date() })
          .where(eq(daos.id, daoId));
      } catch (e) {
        logger.warn(`Failed to release DB rotation lock for DAO ${daoId}: ${e}`);
      }
    }
    rotationLocks.delete(daoId);
  }
}

/**
 * Get rotation status for a DAO
 */
export async function getRotationStatus(daoId: string) {
  try {
    const [dao] = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao) {
      throw new Error(`DAO not found: ${daoId}`);
    }

    const cycles = await db
      .select()
      .from(daoRotationCycles)
      .where(eq(daoRotationCycles.daoId, daoId))
      .orderBy(daoRotationCycles.cycleNumber);

    const members = await getRotationEligibleMembers(daoId);
    const expectedPoolKes = dao.daoType === 'merryGoRound' && dao.rotationContributionAmountKes
      ? Number(dao.rotationContributionAmountKes) * members.length
      : null;
    const highValueOnChain = expectedPoolKes !== null && shouldUseOnChainRotationRail(expectedPoolKes);
    const nextCycleNumber = String((dao.currentRotationCycle || 0) + 1);
    const currentCycleKesContributions = highValueOnChain
      ? await db.select({ id: daoContributions.id })
          .from(daoContributions)
          .where(and(
            eq(daoContributions.daoId, daoId),
            eq(daoContributions.currency, 'KES'),
            inArray(daoContributions.status, ['pending', 'approved', 'completed', 'rotation_pending']),
            sql`${daoContributions.metadata}->>'cycle' = ${nextCycleNumber}`
          ))
      : [];
    const currentCycleOnChainContributions = highValueOnChain
      ? await db.select({
          contributorId: daoContributions.contributorId,
          metadata: daoContributions.metadata,
        })
          .from(daoContributions)
          .where(and(
            eq(daoContributions.daoId, daoId),
            inArray(daoContributions.status, ['approved', 'completed']),
            sql`${daoContributions.metadata}->>'method' = 'on-chain stablecoin'`,
            sql`${daoContributions.metadata}->>'chainStatus' = 'recorded'`,
            sql`${daoContributions.metadata}->>'cycleNumber' = ${nextCycleNumber}`
          ))
      : [];
    const onChainPaidMembers = new Set(
      currentCycleOnChainContributions.map((contribution) => contribution.contributorId)
    ).size;
    const availableContributions = await db
      .select({ amount: daoContributions.amount })
      .from(daoContributions)
      .where(and(
        eq(daoContributions.daoId, daoId),
        eq(daoContributions.currency, 'KES'),
        inArray(daoContributions.status, ['approved', 'completed']),
        sql`${daoContributions.metadata}->>'rotationCycleId' IS NULL`
      ));
    const { Decimal } = await import('decimal.js');
    const availableKesBalance = availableContributions
      .reduce((total, contribution) => total.plus(contribution.amount?.toString() || '0'), new Decimal(0))
      .toFixed(2);
    const hasKesBalance = new Decimal(availableKesBalance).gt(0);
    const pendingManualCycle = cycles.find((cycle) =>
      cycle.status === 'pending_manual_payout' || cycle.status === 'pending_b2c_payout'
    );
    const [pendingB2cPayout] = pendingManualCycle
      ? await db.select({
          status: daoRotationPayouts.status,
          attemptNumber: daoRotationPayouts.attemptNumber,
          resultDescription: daoRotationPayouts.resultDescription,
        })
          .from(daoRotationPayouts)
          .where(eq(daoRotationPayouts.cycleId, pendingManualCycle.id))
          .limit(1)
      : [];
    const [pendingManualConfirmation] = pendingManualCycle
      ? await db.select({ id: daoRotationPayoutConfirmations.id })
          .from(daoRotationPayoutConfirmations)
          .where(eq(daoRotationPayoutConfirmations.cycleId, pendingManualCycle.id))
          .limit(1)
      : [];
    const pendingOnChainCycle = cycles.find((cycle) => cycle.status === 'pending_on_chain_confirmation');
    let onChainRotationStatus: 'not_configured' | 'not_initialized' | 'initialized' | 'unknown' =
      dao.chamaTreasuryAddress ? 'unknown' : 'not_configured';
    let onChainRotationDetails: { monthlyContribution: string; currency: string; totalMembers: number } | null = null;
    let onChainNextRotationDate: string | null = null;
    if (dao.chamaTreasuryAddress && process.env.ROTATION_MODULE_ADDRESS) {
      try {
        const config = await getRotationConfigOnChain(dao.chamaTreasuryAddress);
        onChainRotationStatus = Number(config.totalMembers) > 0 ? 'initialized' : 'not_initialized';
        if (onChainRotationStatus === 'initialized') {
          const tokenAddress = String(config.stablecoin);
          const [decimals, symbol, currentCycle] = await Promise.all([
            getStablecoinDecimals(tokenAddress),
            getStablecoinSymbol(tokenAddress),
            getCurrentRotationCycleOnChain(dao.chamaTreasuryAddress),
          ]);
          onChainRotationDetails = {
            monthlyContribution: ethers.formatUnits(BigInt(config.monthlyContribution), decimals),
            currency: symbol,
            totalMembers: Number(config.totalMembers),
          };
          const nextDateSeconds = Number(currentCycle.nextDistributionDate);
          if (Number.isSafeInteger(nextDateSeconds) && nextDateSeconds > 0) {
            onChainNextRotationDate = new Date(nextDateSeconds * 1000).toISOString();
          }
        }
      } catch (error) {
        logger.warn(`Unable to read on-chain rotation configuration for DAO ${daoId}: ${error}`);
      }
    }

    return {
      daoId,
      daoType: dao.daoType,
      durationModel: dao.durationModel,
      rotationFrequency: dao.rotationFrequency,
      rotationContributionAmountKes: dao.rotationContributionAmountKes,
      expectedPoolKes,
      recommendedPayoutRail: highValueOnChain || expectedPoolKes === null ? 'on_chain' : 'mpesa',
      hasCurrentCycleKesContributions: currentCycleKesContributions.length > 0,
      onChainPaidMembers,
      stableInflowTrackingEnabled: process.env.STABLE_INFLOW_ENABLED === 'true',
      stableOutflowTrackingEnabled: process.env.STABLE_OUTFLOW_ENABLED === 'true',
      b2cEnabled: process.env.MPESA_B2C_ENABLED === 'true',
      selectionMethod: dao.rotationSelectionMethod,
      currentCycle: dao.currentRotationCycle || 0,
      totalCycles: dao.totalRotationCycles,
      nextRotationDate: highValueOnChain ? onChainNextRotationDate || dao.nextRotationDate : dao.nextRotationDate,
      treasuryBalance: hasKesBalance ? availableKesBalance : dao.treasuryBalance,
      treasuryCurrency: hasKesBalance ? 'KES' : 'cUSD',
      onChainRotationStatus,
      onChainRotationDetails,
      pendingManualPayout: pendingManualCycle
        ? {
            cycleId: pendingManualCycle.id,
            cycleNumber: pendingManualCycle.cycleNumber,
            recipientUserId: pendingManualCycle.recipientUserId,
            amount: pendingManualCycle.amountDistributed,
            cycleStatus: pendingManualCycle.status as 'pending_manual_payout' | 'pending_b2c_payout',
            confirmationsReceived: pendingManualConfirmation ? 1 : 0,
            payoutStatus: pendingB2cPayout?.status ?? null,
            payoutAttempt: pendingB2cPayout?.attemptNumber ?? null,
            payoutMessage: pendingB2cPayout?.resultDescription ?? null,
          }
        : null,
      pendingOnChainPayout: pendingOnChainCycle
        ? {
            cycleId: pendingOnChainCycle.id,
            cycleNumber: pendingOnChainCycle.cycleNumber,
            recipientUserId: pendingOnChainCycle.recipientUserId,
            transactionHash: pendingOnChainCycle.transactionHash,
          }
        : null,
      totalMembers: members.length,
      cycleHistory: cycles.map((c) => ({
        id: c.id,
        cycleNumber: c.cycleNumber,
        recipient: c.recipientUserId,
        amountDistributed: c.amountDistributed,
        currency: c.notes?.includes('KES') ? 'KES' : 'cUSD',
        status: c.status,
        distributedAt: c.distributedAt,
      })),
    };
  } catch (err) {
    logger.error(`Error getting rotation status: ${err}`);
    throw err;
  }
}

export async function completeManualRotation(
  daoId: string,
  cycleId: string,
  confirmerUserId: string
) {
  const result = await db.transaction(async (tx) => {
    const [cycle] = await tx
      .select()
      .from(daoRotationCycles)
      .where(and(
        eq(daoRotationCycles.id, cycleId),
        eq(daoRotationCycles.daoId, daoId),
        inArray(daoRotationCycles.status, ['pending_manual_payout'])
      ))
      .for('update')
      .limit(1);
    if (!cycle) throw new Error('Pending manual rotation cycle not found');
    if (cycle.recipientUserId === confirmerUserId) {
      throw new Error('The payout recipient cannot confirm their own payout');
    }

    const [confirmerMembership] = await tx
      .select({
        role: daoMemberships.role,
        status: daoMemberships.status,
        isBanned: daoMemberships.isBanned,
      })
      .from(daoMemberships)
      .where(and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, confirmerUserId)
      ))
      .limit(1);
    const confirmerRole = getPayoutConfirmerRole(confirmerMembership?.role);
    if (!confirmerMembership || confirmerMembership.status !== 'approved' || confirmerMembership.isBanned || !confirmerRole) {
      throw new Error('An approved, active DAO treasurer or elder is required to confirm a payout');
    }

    const [existingConfirmation] = await tx
      .select()
      .from(daoRotationPayoutConfirmations)
      .where(eq(daoRotationPayoutConfirmations.cycleId, cycleId))
      .for('update')
      .limit(1);
    let firstConfirmerRole: 'treasurer' | 'elder' | null = null;
    if (existingConfirmation) {
      if (existingConfirmation.confirmerId === confirmerUserId) {
        return {
          status: 'awaiting_second_confirmation',
          cycleId,
          cycleNumber: cycle.cycleNumber,
          recipientUserId: cycle.recipientUserId,
          amountDistributed: cycle.amountDistributed,
          confirmationsReceived: 1,
        };
      }
      const [firstConfirmerMembership] = await tx
        .select({
          role: daoMemberships.role,
          status: daoMemberships.status,
          isBanned: daoMemberships.isBanned,
        })
        .from(daoMemberships)
        .where(and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.userId, existingConfirmation.confirmerId)
        ))
        .limit(1);
      firstConfirmerRole = getPayoutConfirmerRole(firstConfirmerMembership?.role);
      if (!firstConfirmerMembership || firstConfirmerMembership.status !== 'approved' ||
          firstConfirmerMembership.isBanned || !firstConfirmerRole) {
        throw new Error('The first confirmer must remain an approved, active treasurer or elder');
      }
      if (firstConfirmerRole === confirmerRole) {
        throw new Error('Payout confirmation requires one treasurer and one elder');
      }
    } else {
      await tx.insert(daoRotationPayoutConfirmations).values({
        daoId,
        cycleId,
        confirmerId: confirmerUserId,
      });
      return {
        status: 'awaiting_second_confirmation',
        cycleId,
        cycleNumber: cycle.cycleNumber,
        recipientUserId: cycle.recipientUserId,
        amountDistributed: cycle.amountDistributed,
        confirmationsReceived: 1,
      };
    }

    const assignedContributions = await tx
      .select({ id: daoContributions.id })
      .from(daoContributions)
      .where(and(
        eq(daoContributions.daoId, daoId),
        eq(daoContributions.status, 'rotation_pending'),
        sql`${daoContributions.metadata}->>'rotationCycleId' = ${cycleId}`
      ));
    if (assignedContributions.length === 0) {
      throw new Error('No contributions are assigned to this rotation cycle');
    }
    const [recipient] = await tx
      .select({ phone: users.phone })
      .from(users)
      .where(eq(users.id, cycle.recipientUserId))
      .limit(1);
    const phone = normalizeKenyanPhone(recipient?.phone);
    if (!phone) throw new Error('The rotation recipient does not have a valid Kenyan mobile number');
    const amount = Number(cycle.amountDistributed);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error('M-Pesa B2C requires a positive whole-KES payout amount');
    }
    const [dao] = await tx
      .select({ rotationFrequency: daos.rotationFrequency })
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);
    if (!dao) throw new Error(`DAO not found: ${daoId}`);

    return {
      status: 'ready_to_initiate' as const,
      cycleId,
      cycleNumber: cycle.cycleNumber,
      recipientUserId: cycle.recipientUserId,
      amountDistributed: cycle.amountDistributed,
      cycleNotes: cycle.notes,
      phone,
      amountKes: amount,
      treasurerId: confirmerRole === 'treasurer' ? confirmerUserId : existingConfirmation.confirmerId,
      elderId: confirmerRole === 'elder' ? confirmerUserId : existingConfirmation.confirmerId,
      rotationFrequency: dao.rotationFrequency || 'monthly',
    };
  });

  if (result.status !== 'ready_to_initiate') return result;
  if (!result.phone || !Number.isSafeInteger(result.amountKes) ||
      !result.treasurerId || !result.elderId) {
    throw new Error('Rotation payout authorization is incomplete; no B2C request was initiated');
  }

  let payout = await db.transaction(async (tx) => {
    const [existingPayout] = await tx
      .select()
      .from(daoRotationPayouts)
      .where(eq(daoRotationPayouts.cycleId, cycleId))
      .for('update')
      .limit(1);
    if (existingPayout && !['failed'].includes(existingPayout.status)) {
      return existingPayout;
    }

    const values = {
      daoId,
      cycleId,
      recipientPhone: result.phone,
      amountKes: result.amountKes,
      treasurerId: result.treasurerId,
      elderId: result.elderId,
      status: 'queued',
      conversationId: null,
      originatorConversationId: null,
      transactionId: null,
      resultCode: null,
      resultDescription: null,
      callbackMetadata: {},
      requestedAt: new Date(),
      completedAt: null,
      updatedAt: new Date(),
    };
    if (existingPayout) {
      const [retried] = await tx.update(daoRotationPayouts)
        .set({ ...values, attemptNumber: existingPayout.attemptNumber + 1 })
        .where(eq(daoRotationPayouts.id, existingPayout.id))
        .returning();
      await tx.update(daoRotationCycles)
        .set({
          status: 'pending_b2c_payout',
          notes: `${result.cycleNotes || ''}\nB2C attempt ${existingPayout.attemptNumber + 1} authorized by treasurer ${result.treasurerId} and elder ${result.elderId}.`.trim(),
          updatedAt: new Date(),
        })
        .where(eq(daoRotationCycles.id, cycleId));
      return retried;
    }
    const [created] = await tx.insert(daoRotationPayouts).values(values).returning();
    await tx.update(daoRotationCycles)
      .set({
        status: 'pending_b2c_payout',
        notes: `${result.cycleNotes || ''}\nB2C payout authorized by treasurer ${result.treasurerId} and elder ${result.elderId}.`.trim(),
        updatedAt: new Date(),
      })
      .where(eq(daoRotationCycles.id, cycleId));
    return created;
  });

  if (!payout || payout.status !== 'queued') {
    return { status: payout?.status || 'payout_unknown', cycleId, payoutId: payout?.id };
  }

  const [initiating] = await db.update(daoRotationPayouts)
    .set({ status: 'initiating', updatedAt: new Date() })
    .where(and(eq(daoRotationPayouts.id, payout.id), eq(daoRotationPayouts.status, 'queued')))
    .returning();
  if (!initiating) {
    const [current] = await db.select().from(daoRotationPayouts)
      .where(eq(daoRotationPayouts.id, payout.id)).limit(1);
    return { status: current?.status || 'payout_unknown', cycleId, payoutId: payout.id };
  }

  let initiation;
  try {
    initiation = await initiateDarajaB2cPayout({
      phone: result.phone,
      amountKes: result.amountKes,
      payoutId: payout.id,
      cycleNumber: result.cycleNumber,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await failRotationB2cPayout(payout.id, reason);
    return { status: 'payout_failed', cycleId, payoutId: payout.id, message: reason };
  }

  if (initiation.ambiguous) {
    await db.update(daoRotationPayouts)
      .set({ status: 'unknown', resultDescription: initiation.description, updatedAt: new Date() })
      .where(eq(daoRotationPayouts.id, payout.id));
    return { status: 'payout_unknown', cycleId, payoutId: payout.id, message: initiation.description };
  }
  if (!initiation.accepted) {
    await failRotationB2cPayout(payout.id, initiation.description);
    return { status: 'payout_failed', cycleId, payoutId: payout.id, message: initiation.description };
  }

  await db.update(daoRotationPayouts)
    .set({
      status: 'accepted',
      conversationId: initiation.conversationId,
      originatorConversationId: initiation.originatorConversationId,
      resultDescription: initiation.description,
      updatedAt: new Date(),
    })
    .where(and(eq(daoRotationPayouts.id, payout.id), eq(daoRotationPayouts.status, 'initiating')));

  return {
    status: 'payout_pending',
    cycleId,
    payoutId: payout.id,
    attemptNumber: payout.attemptNumber,
    message: 'Safaricom accepted the B2C request; payout completes only after its verified result callback.',
  };
}

function normalizeKenyanPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  return null;
}

async function failRotationB2cPayout(payoutId: string, reason: string, resultCode?: number) {
  await db.transaction(async (tx) => {
    const [payout] = await tx.select().from(daoRotationPayouts)
      .where(eq(daoRotationPayouts.id, payoutId)).for('update').limit(1);
    if (!payout || ['succeeded', 'failed'].includes(payout.status)) return;
    await tx.update(daoRotationPayouts).set({
      status: 'failed',
      resultCode: resultCode ?? null,
      resultDescription: reason,
      updatedAt: new Date(),
    }).where(eq(daoRotationPayouts.id, payoutId));
    await tx.update(daoRotationCycles).set({
      status: 'pending_manual_payout',
      paymentReference: null,
      updatedAt: new Date(),
    }).where(eq(daoRotationCycles.id, payout.cycleId));
    await tx.delete(daoRotationPayoutConfirmations)
      .where(eq(daoRotationPayoutConfirmations.cycleId, payout.cycleId));
  });
}

function callbackTokenMatches(suppliedToken: string | undefined): boolean {
  let configuredToken: string;
  try {
    configuredToken = getB2cCallbackToken();
  } catch {
    return false;
  }
  if (!suppliedToken) return false;
  const expected = Buffer.from(configuredToken);
  const supplied = Buffer.from(suppliedToken);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export async function reconcileRotationB2cCallback(
  payload: Record<string, unknown>,
  suppliedToken: string | undefined,
  isTimeout = false
) {
  if (!callbackTokenMatches(suppliedToken)) {
    throw new Error('Invalid B2C callback token');
  }
  const result = (payload?.Result && typeof payload.Result === 'object'
    ? payload.Result
    : payload) as Record<string, unknown>;
  const originatorConversationId = typeof result.OriginatorConversationID === 'string'
    ? result.OriginatorConversationID
    : undefined;
  const conversationId = typeof result.ConversationID === 'string' ? result.ConversationID : undefined;
  if (!originatorConversationId && !conversationId) {
    throw new Error('B2C callback is missing conversation identifiers');
  }
  const resultCode = Number(result.ResultCode);
  if (!isTimeout && !Number.isInteger(resultCode)) {
    throw new Error('B2C result callback is missing a valid ResultCode');
  }
  const resultDescription = typeof result.ResultDesc === 'string' ? result.ResultDesc.slice(0, 1000) : '';
  const parameters = (result.ResultParameters as { ResultParameter?: Array<{ Key?: string; Value?: unknown }> } | undefined)
    ?.ResultParameter || [];
  const parameter = (key: string) => parameters.find((item) => item.Key === key)?.Value;

  return db.transaction(async (tx) => {
    const [payout] = await tx.select().from(daoRotationPayouts)
      .where(or(
        ...(originatorConversationId ? [eq(daoRotationPayouts.originatorConversationId, originatorConversationId)] : []),
        ...(conversationId ? [eq(daoRotationPayouts.conversationId, conversationId)] : [])
      ))
      .for('update')
      .limit(1);
    if (!payout) throw new Error('B2C payout not found for callback conversation');

    if (payout.status === 'succeeded' || payout.status === 'failed') {
      return { status: payout.status, duplicate: true, payoutId: payout.id };
    }
    if (isTimeout) {
      await tx.update(daoRotationPayouts).set({
        status: 'unknown',
        resultDescription: resultDescription || 'Daraja queue timeout; awaiting result reconciliation',
        updatedAt: new Date(),
      }).where(eq(daoRotationPayouts.id, payout.id));
      return { status: 'unknown', duplicate: false, payoutId: payout.id };
    }
    if (payout.status !== 'accepted' && payout.status !== 'unknown') {
      throw new Error(`B2C payout cannot be reconciled while it is ${payout.status}`);
    }
    if (resultCode !== 0) {
      await tx.update(daoRotationPayouts).set({
        status: 'failed',
        resultCode,
        resultDescription,
        callbackMetadata: {
          transactionAmount: parameter('TransactionAmount') ?? null,
          transactionReceipt: parameter('TransactionReceipt') ?? null,
        },
        updatedAt: new Date(),
      }).where(eq(daoRotationPayouts.id, payout.id));
      await tx.update(daoRotationCycles).set({
        status: 'pending_manual_payout',
        paymentReference: null,
        updatedAt: new Date(),
      }).where(eq(daoRotationCycles.id, payout.cycleId));
      await tx.delete(daoRotationPayoutConfirmations)
        .where(eq(daoRotationPayoutConfirmations.cycleId, payout.cycleId));
      return { status: 'failed', duplicate: false, payoutId: payout.id };
    }

    const transactionId = typeof result.TransactionID === 'string' ? result.TransactionID : '';
    const receipt = parameter('TransactionReceipt');
    const actualAmount = Number(parameter('TransactionAmount'));
    if (!transactionId || typeof receipt !== 'string' || !receipt || actualAmount !== payout.amountKes) {
      throw new Error('Successful B2C callback is missing the expected receipt or exact amount');
    }
    const [cycle] = await tx.select().from(daoRotationCycles)
      .where(eq(daoRotationCycles.id, payout.cycleId))
      .for('update')
      .limit(1);
    if (!cycle || cycle.status !== 'pending_b2c_payout') {
      throw new Error('B2C callback does not match a pending rotation cycle');
    }
    const [assigned] = await tx.select({ id: daoContributions.id })
      .from(daoContributions)
      .where(and(
        eq(daoContributions.daoId, payout.daoId),
        eq(daoContributions.status, 'rotation_pending'),
        sql`${daoContributions.metadata}->>'rotationCycleId' = ${payout.cycleId}`
      ))
      .limit(1);
    if (!assigned) throw new Error('No contributions are assigned to the B2C rotation payout');
    const [dao] = await tx.select({ rotationFrequency: daos.rotationFrequency })
      .from(daos)
      .where(eq(daos.id, payout.daoId))
      .limit(1);
    if (!dao) throw new Error('DAO for the B2C payout no longer exists');

    const completedAt = new Date();
    await tx.update(daoRotationPayouts).set({
      status: 'succeeded',
      resultCode,
      resultDescription,
      transactionId,
      callbackMetadata: {
        transactionAmount: actualAmount,
        transactionReceipt: receipt,
        transactionCompletedDateTime: parameter('TransactionCompletedDateTime') ?? null,
      },
      completedAt,
      updatedAt: completedAt,
    }).where(eq(daoRotationPayouts.id, payout.id));
    await tx.update(daoContributions).set({
      status: 'completed',
      updatedAt: completedAt,
    }).where(and(
      eq(daoContributions.daoId, payout.daoId),
      eq(daoContributions.status, 'rotation_pending'),
      sql`${daoContributions.metadata}->>'rotationCycleId' = ${payout.cycleId}`
    ));
    await tx.update(daoRotationCycles).set({
      status: 'completed',
      paymentReference: receipt,
      transactionHash: transactionId,
      distributedAt: completedAt,
      notes: `${cycle.notes || ''}\nSafaricom B2C payout confirmed: ${receipt}.`.trim(),
      updatedAt: completedAt,
    }).where(and(
      eq(daoRotationCycles.id, payout.cycleId),
      eq(daoRotationCycles.status, 'pending_b2c_payout')
    ));
    await tx.update(daos).set({
      currentRotationCycle: cycle.cycleNumber,
      nextRotationDate: calculateNextRotationDate(completedAt, dao.rotationFrequency || 'monthly'),
      updatedAt: completedAt,
    }).where(eq(daos.id, payout.daoId));

    return { status: 'succeeded', duplicate: false, payoutId: payout.id, transactionId, receipt };
  });
}

export async function rotationB2cCallbackHandler(req: Request, res: Response) {
  try {
    const result = await reconcileRotationB2cCallback(req.body || {}, req.query.token as string | undefined);
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted', payoutStatus: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('M-Pesa B2C result reconciliation failed', { message });
    return res.status(500).json({ ResultCode: 1, ResultDesc: 'Callback reconciliation failed' });
  }
}

export async function rotationB2cTimeoutHandler(req: Request, res: Response) {
  try {
    const result = await reconcileRotationB2cCallback(req.body || {}, req.query.token as string | undefined, true);
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Timeout recorded', payoutStatus: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('M-Pesa B2C timeout reconciliation failed', { message });
    return res.status(500).json({ ResultCode: 1, ResultDesc: 'Timeout reconciliation failed' });
  }
}

function calculateNextRotationDate(from: Date, frequency: string): Date {
  const next = new Date(from);

  switch (frequency.toLowerCase()) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'bi-weekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }

  return next;
}

// -----------------------------------------------------------------------------
// Route Handlers
// -----------------------------------------------------------------------------

export async function getRotationStatusHandler(req: Request, res: Response) {
  try {
    const { daoId } = req.params;
    const status = await getRotationStatus(daoId);
    return res.json(status);
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    return res.status(500).json({ error: 'Failed to get rotation status' });
  }
}

export async function processRotationHandler(req: Request, res: Response) {
  try {
    const { daoId } = req.params;
    const result = await processRotation(daoId);
    return res.json(result);
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    return res.status(500).json({ error: 'Failed to process rotation' });
  }
}

export async function completeManualRotationHandler(req: Request, res: Response) {
  try {
    const { daoId, cycleId } = req.params;
    const confirmerUserId = (req as any).user?.id as string | undefined;
    if (!confirmerUserId) return res.status(401).json({ error: 'Authentication required' });
    const result = await completeManualRotation(daoId, cycleId, confirmerUserId);
    return res.json(result);
  } catch (err) {
    logger.error(`Handler error completing manual rotation: ${err}`);
    const message = err instanceof Error ? err.message : 'Failed to complete manual payout';
    const code = (err as { code?: string } | null)?.code;
    const status = message.includes('not found') || message.includes('No contributions') ? 404 :
      message.includes('cannot confirm') || message.includes('treasurer or elder is required') ||
        message.includes('confirmation requires one treasurer and one elder') ||
        message.includes('first confirmer must remain') ? 403 :
      message.includes('already') || code === '23505' ? 409 :
      message.includes('valid Kenyan mobile') || message.includes('whole-KES') ? 400 : 500;
    return res.status(status).json({ error: message });
  }
}

/**
 * Mark a rotation cycle as paid by a treasurer/elder (ledger-first flow)
 * Expects { reference: string } in body (e.g., M-Pesa transaction code)
 */
export async function markRotationCyclePaid(
  daoId: string,
  cycleId: string,
  confirmedByUserId: string,
  reference: string
) {
  // Atomic operation to mark a ledger-mode cycle as paid, update contributions and schedule
  return db.transaction(async (tx) => {
    const [cycle] = await tx
      .select()
      .from(daoRotationCycles)
      .where(and(eq(daoRotationCycles.id, cycleId), eq(daoRotationCycles.daoId, daoId)))
      .for('update')
      .limit(1);

    if (!cycle) return { status: 'not_found' as const };
    if (cycle.status === 'completed') return { status: 'already_paid' as const, cycle };
    if (cycle.status !== 'pending_manual_payout') return { status: 'invalid_state' as const, cycle };
    if (cycle.recipientUserId === confirmedByUserId) return { status: 'forbidden_self' as const };

    const assignedContributions = await tx
      .select({ id: daoContributions.id })
      .from(daoContributions)
      .where(and(
        eq(daoContributions.daoId, daoId),
        eq(daoContributions.status, 'rotation_pending'),
        sql`${daoContributions.metadata}->>'rotationCycleId' = ${cycleId}`
      ));

    if (Number(cycle.amountDistributed || 0) > 0 && assignedContributions.length === 0) {
      throw new Error('No contributions are assigned to this rotation cycle');
    }

    const completedAt = new Date();

    const [updatedCycle] = await tx
      .update(daoRotationCycles)
      .set({
        status: 'completed',
        distributedAt: completedAt,
        paymentReference: reference,
        notes: `${cycle.notes || ''}\nManual payout confirmed: ${reference}`.trim(),
        updatedAt: completedAt,
      })
      .where(and(eq(daoRotationCycles.id, cycleId), eq(daoRotationCycles.status, 'pending_manual_payout')))
      .returning();

    if (!updatedCycle) {
      // Lost a race with another updater
      return { status: 'already_paid' as const, cycle };
    }

    await tx.update(daoContributions).set({
      status: 'completed',
      updatedAt: completedAt,
    }).where(and(
      eq(daoContributions.daoId, daoId),
      eq(daoContributions.status, 'rotation_pending'),
      sql`${daoContributions.metadata}->>'rotationCycleId' = ${cycleId}`
    ));

    const [daoRow] = await tx
      .select({ rotationFrequency: daos.rotationFrequency })
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!daoRow) throw new Error(`DAO not found: ${daoId}`);

    await tx.update(daos).set({
      currentRotationCycle: cycle.cycleNumber,
      nextRotationDate: calculateNextRotationDate(completedAt, daoRow.rotationFrequency || 'monthly'),
      updatedAt: completedAt,
    }).where(eq(daos.id, daoId));

    return { status: 'paid' as const, cycle: updatedCycle };
  });
}

export async function markCyclePaidHandler(req: Request, res: Response) {
  try {
    const { daoId, cycleId } = req.params;
    const user = (req as any).user;
    const userId = (user?.userId || user?.claims?.sub || user?.id) as string | undefined;
    const reference = typeof req.body?.reference === 'string' ? req.body.reference.trim() : '';

    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    if (reference.length < 3 || reference.length > 200) {
      return res.status(400).json({ error: 'reference (e.g. M-Pesa code) is required, 3-200 characters' });
    }

    const result = await markRotationCyclePaid(daoId, cycleId, userId, reference);

    switch (result.status) {
      case 'not_found':
        return res.status(404).json({ error: 'Cycle not found' });
      case 'forbidden_self':
        return res.status(403).json({ error: 'The recipient cannot confirm their own payout' });
      case 'invalid_state':
        return res.status(409).json({ error: `Cycle is ${result.cycle.status}, not pending manual payout` });
      case 'already_paid':
        return res.json({ success: true, alreadyPaid: true, cycle: result.cycle });
      default:
        return res.json({ success: true, cycle: result.cycle });
    }
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    return res.status(500).json({ error: 'Failed to mark cycle as paid' });
  }
}

export async function getNextRecipientHandler(req: Request, res: Response) {
  try {
    const { daoId } = req.params;

    const [dao] = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    const selectionMethod = (dao.rotationSelectionMethod || 'sequential') as RotationSelectionMethod;
    const nextRecipientId = await selectRotationRecipient(daoId, selectionMethod);

    const [recipient] = await db
      .select()
      .from(daoMemberships)
      .where(eq(daoMemberships.userId, nextRecipientId))
      .limit(1);

    return res.json({
      nextRecipient: nextRecipientId,
      cycleNumber: (dao.currentRotationCycle || 0) + 1,
      estimatedDistributionDate: dao.nextRotationDate,
      estimatedAmount: dao.treasuryBalance,
      memberInfo: {
        role: recipient?.role,
        joinedAt: recipient?.joinedAt,
      },
    });
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    return res.status(500).json({ error: 'Failed to get next recipient' });
  }
}

export function getRotationMemberId(userId: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(userId));
}

export async function getRotationMemberBindings(daoId: string) {
  const members = (await getRotationEligibleMembers(daoId))
    .sort((a, b) => new Date(a.joinedAt || 0).getTime() - new Date(b.joinedAt || 0).getTime());
  const bindings = await Promise.all(members.map(async (member) => {
    const [user] = await db
      .select({ id: users.id, walletAddress: users.walletAddress })
      .from(users)
      .where(eq(users.id, member.userId))
      .limit(1);

    if (!user?.walletAddress) {
      throw new Error(`Rotation member ${member.userId} has no wallet address`);
    }

    return {
      userId: member.userId,
      memberId: getRotationMemberId(member.userId),
      address: user.walletAddress,
    };
  }));

  return bindings;
}

export async function initializeRotationForDao(
  daoId: string,
  options: {
    monthlyContribution: bigint | string | number;
    minimumParticipationBps: bigint | string | number;
    stablecoin: string;
  }
) {
  const [dao] = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
  if (!dao) throw new Error(`DAO not found: ${daoId}`);
  if (dao.rotationFrequency !== 'monthly') {
    throw new Error('On-chain rotation currently uses a 30-day schedule; monthly frequency is required');
  }
  if (!dao.chamaTreasuryAddress) throw new Error('DAO has no deployed ChamaTreasury address');
  if (!ethers.isAddress(dao.chamaTreasuryAddress)) throw new Error('DAO ChamaTreasury address is invalid');
  if (dao.rotationSelectionMethod && dao.rotationSelectionMethod !== 'sequential') {
    throw new Error('On-chain rotation currently supports sequential selection only');
  }
  const existingConfig = await getRotationConfigOnChain(dao.chamaTreasuryAddress);
  if (Number(existingConfig.totalMembers) > 0) {
    throw new Error('On-chain rotation is already initialized');
  }

  const bindings = await getRotationMemberBindings(daoId);
  if (bindings.length < 2) throw new Error('At least two approved members with wallet addresses are required');
  if (dao.daoType === 'merryGoRound' && dao.rotationContributionAmountKes) {
    const expectedPoolKes = Number(dao.rotationContributionAmountKes) * bindings.length;
    if (shouldUseOnChainRotationRail(expectedPoolKes)) {
      const expectedCycle = String((dao.currentRotationCycle || 0) + 1);
      const [existingKesContribution] = await db.select({ id: daoContributions.id })
        .from(daoContributions)
        .where(and(
          eq(daoContributions.daoId, daoId),
          eq(daoContributions.currency, 'KES'),
          inArray(daoContributions.status, ['pending', 'approved', 'completed', 'rotation_pending']),
          sql`${daoContributions.metadata}->>'cycle' = ${expectedCycle}`
        ))
        .limit(1);
      if (existingKesContribution) {
        throw new Error('KES payments already exist for this cycle. Reconcile or refund them before initializing the direct stablecoin rail.');
      }
    }
  }
  const result = await initializeRotationOnChain({
    ...options,
    vaultAddress: dao.chamaTreasuryAddress,
    chamaTreasury: dao.chamaTreasuryAddress,
    memberIds: bindings.map((binding) => binding.memberId),
    memberAddresses: bindings.map((binding) => binding.address),
    selectionMethod: 0,
  });

  return { daoId, bindings, result };
}

export async function initializeRotationHandler(req: Request, res: Response) {
  try {
    const { daoId } = req.params;
    const { monthlyContribution, minimumParticipationBps } = req.body || {};
    if (typeof monthlyContribution !== 'string' || !/^\d{1,18}(?:\.\d{1,18})?$/.test(monthlyContribution) ||
        Number(monthlyContribution) <= 0) {
      return res.status(400).json({ error: 'monthlyContribution must be a positive decimal string' });
    }
    if (!Number.isInteger(minimumParticipationBps) ||
        minimumParticipationBps < 1 || minimumParticipationBps > 10000) {
      return res.status(400).json({ error: 'minimumParticipationBps must be an integer from 1 to 10000' });
    }
    const stablecoin = process.env.STABLECOIN_ADDRESS;
    if (!stablecoin || !ethers.isAddress(stablecoin)) {
      return res.status(503).json({ error: 'A valid STABLECOIN_ADDRESS is required to initialize on-chain rotation' });
    }

    const decimals = await getStablecoinDecimals(stablecoin);
    const monthlyContributionUnits = ethers.parseUnits(monthlyContribution, decimals);
    const result = await initializeRotationForDao(daoId, {
      monthlyContribution: monthlyContributionUnits,
      minimumParticipationBps,
      stablecoin,
    });
    return res.status(201).json({
      success: true,
      daoId,
      memberCount: result.bindings.length,
      transactionHash: result.result?.hash || result.result?.transactionHash || null,
      monthlyContribution,
      minimumParticipationBps,
    });
  } catch (error) {
    logger.error(`Failed to initialize on-chain rotation for DAO ${req.params.daoId}: ${error}`);
    const message = error instanceof Error ? error.message : 'Failed to initialize on-chain rotation';
    const status = message.includes('already initialized') ? 409 :
      message.includes('not found') ? 404 :
      message.includes('no deployed') || message.includes('invalid') || message.includes('required') ||
      message.includes('At least') || message.includes('supports') ? 400 : 502;
    return res.status(status).json({ error: message });
  }
}

export async function recordRotationContributionForUser(daoId: string, userId: string, transactionHash: string) {
  const [dao] = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
  if (!dao) throw new Error(`DAO not found: ${daoId}`);
  if (!dao.chamaTreasuryAddress) throw new Error('DAO has no deployed ChamaTreasury address');
  if (dao.daoType === 'merryGoRound' && dao.rotationContributionAmountKes) {
    const members = await getRotationEligibleMembers(daoId);
    const expectedPoolKes = Number(dao.rotationContributionAmountKes) * members.length;
    if (!shouldUseOnChainRotationRail(expectedPoolKes)) {
      throw new Error('Direct stablecoin contributions are reserved for merry-go-round pools above the M-Pesa B2C ceiling');
    }
  }

  const stablecoin = process.env.STABLECOIN_ADDRESS;
  if (!stablecoin || !ethers.isAddress(stablecoin)) throw new Error('A valid STABLECOIN_ADDRESS is required');
  const [membership] = await db.select().from(daoMemberships).where(and(
    eq(daoMemberships.daoId, daoId),
    eq(daoMemberships.userId, userId),
    eq(daoMemberships.status, 'approved'),
    eq(daoMemberships.isBanned, false)
  )).limit(1);
  if (!membership) throw new Error('Approved DAO membership is required to record a rotation contribution');

  const [user] = await db.select({ walletAddress: users.walletAddress }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.walletAddress || !ethers.isAddress(user.walletAddress)) {
    throw new Error('A valid registered wallet address is required for on-chain contributions');
  }

  const contributionState = await inspectRotationContribution(
    dao.chamaTreasuryAddress,
    getRotationMemberId(userId)
  );
  if (contributionState.totalMembers === 0) throw new Error('On-chain rotation is not initialized');
  if (contributionState.stablecoin.toLowerCase() !== stablecoin.toLowerCase()) {
    throw new Error('Configured stablecoin does not match the on-chain rotation token');
  }

  const transfer = await verifyStablecoinTransfer({
    transactionHash,
    stablecoin,
    sender: user.walletAddress,
    recipient: dao.chamaTreasuryAddress,
    amount: contributionState.monthlyContribution,
    notBeforeTimestamp: contributionState.cycleStartTimestamp,
  });
  const decimals = await getStablecoinDecimals(stablecoin);
  const symbol = await getStablecoinSymbol(stablecoin);
  const { stableInflowModule } = await import('../services/stableInflowModule');
  let stableInflowResult: Awaited<ReturnType<typeof stableInflowModule.processStableInflow>> | undefined;
  if (stableInflowModule.isEnabled()) {
    stableInflowResult = await stableInflowModule.processStableInflow({
      source: 'dao_rotation_contribution',
      chain: 'celo',
      chainId: transfer.chainId,
      txHash: transactionHash,
      logIndex: transfer.logIndex,
      tokenAddress: stablecoin,
      tokenSymbol: symbol,
      decimals,
      rawAmount: contributionState.monthlyContribution.toString(),
      fromAddress: user.walletAddress,
      toAddress: dao.chamaTreasuryAddress,
      blockTimestamp: transfer.blockTimestamp,
      confirmations: transfer.confirmations,
      provider: 'rotation_module',
      metadata: {
        daoId,
        userId,
        rotationCycleNumber: contributionState.cycleNumber,
      },
    });
    if (!stableInflowResult.success) {
      throw new Error(
        `Stable inflow tracking failed for this verified transfer: ${stableInflowResult.error}. The transfer is already in the ChamaTreasury; do not send it again.`
      );
    }
    if (stableInflowResult.confirmationState !== 'confirmed') {
      throw new Error(
        `Stablecoin transfer has ${transfer.confirmations} confirmations and needs more before it can count. The transfer is already in the ChamaTreasury; do not send it again.`
      );
    }
    if (stableInflowResult.riskFlags?.depegDetected ||
        stableInflowResult.riskFlags?.delayedConfirmation ||
        stableInflowResult.riskFlags?.lowLiquidity ||
        stableInflowResult.riskFlags?.highRiskScore) {
      logger.warn(
        `Stable inflow risk flags were raised for rotation contribution ${transactionHash}: ${stableInflowResult.riskFlags.notes.join('; ')}`
      );
    }
  }
  const contribution = await db.transaction(async (tx) => {
    await tx.select({ id: daos.id }).from(daos).where(eq(daos.id, daoId)).for('update');
    const [existingContribution] = await tx.select().from(daoContributions)
      .where(sql`${daoContributions.metadata}->>'onChainTransactionHash' = ${transactionHash}`)
      .for('update')
      .limit(1);
    if (existingContribution) {
      if (existingContribution.daoId !== daoId || existingContribution.contributorId !== userId) {
        throw new Error('This deposit transaction is already associated with another contribution');
      }
      if (['approved', 'completed', 'rotation_pending'].includes(existingContribution.status || '')) {
        return existingContribution;
      }
      return existingContribution;
    }
    if (contributionState.hasPaid) {
      throw new Error('Member has already contributed to the current on-chain rotation cycle');
    }

    let [type] = await tx.select().from(daoContributionTypes)
      .where(and(eq(daoContributionTypes.daoId, daoId), eq(daoContributionTypes.isActive, true)))
      .limit(1);
    if (!type) {
      [type] = await tx.insert(daoContributionTypes).values({
        daoId,
        name: 'On-chain Rotation Contribution',
        description: 'Verified stablecoin contribution to the active rotation cycle',
        minimumAmount: '0',
        requiresApproval: false,
        approvalsNeeded: 1,
        isActive: true,
      }).returning();
    }
    const [createdContribution] = await tx.insert(daoContributions).values({
      daoId,
      contributorId: userId,
      contributionTypeId: type.id,
      amount: ethers.formatUnits(contributionState.monthlyContribution, decimals),
      currency: symbol,
      status: 'processing',
      approvalStatus: 'awaiting',
      requiredApprovals: 1,
      description: `On-chain rotation contribution for cycle ${contributionState.cycleNumber}`,
      metadata: {
        method: 'on-chain stablecoin',
        chainStatus: 'recording',
        onChainTransactionHash: transactionHash,
        cycleNumber: contributionState.cycleNumber,
        stablecoin,
        transferBlockNumber: transfer.blockNumber,
        stableInflowEventId: stableInflowResult?.stableInflowEventId,
        stableInflowError: stableInflowResult && !stableInflowResult.success
          ? stableInflowResult.error
          : undefined,
      },
    }).returning();
    return createdContribution;
  });

  if (['approved', 'completed', 'rotation_pending'].includes(contribution.status || '')) {
    if (stableInflowResult?.success && stableInflowResult.stableInflowEventId) {
      await stableInflowModule.markCredited(stableInflowResult.stableInflowEventId, {
        daoContributionId: contribution.id,
        daoId,
        rotationCycleNumber: contributionState.cycleNumber,
      });
    }
    return { contributionId: contribution.id, status: 'already_recorded', cycleNumber: contributionState.cycleNumber };
  }

  const completion = await db.transaction(async (tx) => {
    await tx.select({ id: daos.id }).from(daos).where(eq(daos.id, daoId)).for('update');
    const [currentContribution] = await tx.select().from(daoContributions)
      .where(eq(daoContributions.id, contribution.id))
      .for('update')
      .limit(1);
    if (!currentContribution) throw new Error('Rotation contribution disappeared while being recorded');
    if (['approved', 'completed', 'rotation_pending'].includes(currentContribution.status || '')) {
      return { alreadyRecorded: true };
    }

    const currentContributionState = await inspectRotationContribution(
      dao.chamaTreasuryAddress!,
      getRotationMemberId(userId)
    );
    if (currentContributionState.cycleNumber !== contributionState.cycleNumber) {
      throw new Error('Rotation cycle changed while verifying the stablecoin deposit; submit it again');
    }
    if (currentContributionState.hasPaid) {
      const [otherRecordedContribution] = await tx.select({ id: daoContributions.id })
        .from(daoContributions)
        .where(and(
          eq(daoContributions.daoId, daoId),
          eq(daoContributions.contributorId, userId),
          inArray(daoContributions.status, ['approved', 'completed', 'rotation_pending']),
          sql`${daoContributions.metadata}->>'cycleNumber' = ${String(contributionState.cycleNumber)}`,
          sql`${daoContributions.metadata}->>'onChainTransactionHash' <> ${transactionHash}`
        ))
        .limit(1);
      if (otherRecordedContribution) {
        throw new Error('Member has already contributed with a different transaction for the current cycle');
      }
    } else {
      await recordContributionOnChain(
        dao.chamaTreasuryAddress!,
        getRotationMemberId(userId),
        contributionState.monthlyContribution
      );
    }

    await tx.update(daoContributions).set({
      status: 'approved',
      approvalStatus: 'unanimousApproval',
      approvalsCount: 1,
      metadata: {
        ...((currentContribution.metadata || {}) as Record<string, unknown>),
        chainStatus: 'recorded',
      },
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(daoContributions.id, contribution.id));
    return { alreadyRecorded: false };
  });

  if (completion.alreadyRecorded) {
    if (stableInflowResult?.success && stableInflowResult.stableInflowEventId) {
      await stableInflowModule.markCredited(stableInflowResult.stableInflowEventId, {
        daoContributionId: contribution.id,
        daoId,
        rotationCycleNumber: contributionState.cycleNumber,
      });
    }
    return { contributionId: contribution.id, status: 'already_recorded', cycleNumber: contributionState.cycleNumber };
  }

  if (stableInflowResult?.success && stableInflowResult.stableInflowEventId) {
    await stableInflowModule.markCredited(stableInflowResult.stableInflowEventId, {
      daoContributionId: contribution.id,
      daoId,
      rotationCycleNumber: contributionState.cycleNumber,
    });
  }

  return {
    contributionId: contribution.id,
    status: 'approved',
    cycleNumber: contributionState.cycleNumber,
    transactionHash,
    stableInflowEventId: stableInflowResult?.stableInflowEventId,
    stableInflowTrackingError: stableInflowResult?.success ? undefined : stableInflowResult?.error,
  };
}

export async function recordRotationContributionHandler(req: Request, res: Response) {
  try {
    const { daoId } = req.params;
    const userId = (req as any).user?.id as string | undefined;
    const { transactionHash } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    if (typeof transactionHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) {
      return res.status(400).json({ error: 'A valid stablecoin transfer transaction hash is required' });
    }
    const result = await recordRotationContributionForUser(daoId, userId, transactionHash);
    return res.status(result.status === 'already_recorded' ? 200 : 201).json({ success: true, ...result });
  } catch (error) {
    logger.error(`Failed to record on-chain rotation contribution for DAO ${req.params.daoId}: ${error}`);
    const message = error instanceof Error ? error.message : 'Failed to record on-chain rotation contribution';
    const status = message.includes('not found') ? 404 :
      message.includes('required') || message.includes('valid') || message.includes('already contributed') ||
      message.includes('already associated') || message.includes('already contributed') ||
      message.includes('different transaction') ||
      message.includes('predates') || message.includes('must contain') ||
      message.includes('does not match') || message.includes('not initialized') ? 400 : 502;
    return res.status(status).json({ error: message });
  }
}