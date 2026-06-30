import { db } from '../storage';
import { daos, billingHistory } from '../../shared/schema';
import { eq, and, lte, ne } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { ethers } from 'ethers';

// Assuming we have an ABI and provider
const DAOSubscriptionManagerABI = [
  "function processMonthlyPayment(address daoTreasury) external"
];

// Address of the deployed DAOSubscriptionManager
const SUBSCRIPTION_MANAGER_ADDRESS = process.env.DAO_SUBSCRIPTION_MANAGER_ADDRESS || "0x0000000000000000000000000000000000000000";

/**
 * Checks for DAOs whose subscription has expired and attempts to process
 * the monthly payment via the DAOSubscriptionManager smart contract.
 */
export async function processSubscriptions() {
  logger.info('[CRON] Starting monthly subscription processing...');

  if (!process.env.CELO_RPC_URL || !process.env.WALLET_PRIVATE_KEY) {
    logger.warn('[CRON] Missing RPC URL or wallet key for processing subscriptions.');
    return;
  }

  try {
    const provider = new ethers.JsonRpcProvider(process.env.CELO_RPC_URL);
    const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
    const subManager = new ethers.Contract(SUBSCRIPTION_MANAGER_ADDRESS, DAOSubscriptionManagerABI, wallet);

    // Find all DAOs that are not on the free plan and whose planExpiresAt is in the past
    const now = new Date();
    const expiringDaos = await db.select()
      .from(daos)
      .where(and(
        ne(daos.plan, 'free'),
        lte(daos.planExpiresAt, now)
      ));

    logger.info(`[CRON] Found ${expiringDaos.length} DAOs needing subscription renewal.`);

    for (const dao of expiringDaos) {
      if (!dao.chamaTreasuryAddress) {
        logger.warn(`[CRON] DAO ${dao.id} has no treasury address. Downgrading to free.`);
        await downgradeDAO(dao.id);
        continue;
      }

      logger.info(`[CRON] Processing renewal for DAO ${dao.id} (${dao.chamaTreasuryAddress})`);

      try {
        // Attempt on-chain payment deduction
        const tx = await subManager.processMonthlyPayment(dao.chamaTreasuryAddress);
        const receipt = await tx.wait();

        if (receipt && receipt.status === 1) {
          // Success: Update DB
          const nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          await db.update(daos)
            .set({ planExpiresAt: nextBillingDate, updatedAt: new Date() })
            .where(eq(daos.id, dao.id));

          await db.insert(billingHistory).values({
            daoId: dao.id,
            amount: '0', // Could be fetched from contract/tier pricing
            currency: 'USD',
            status: 'completed',
            description: `Automated subscription renewal for ${dao.plan}`,
            createdAt: new Date()
          });

          logger.info(`[CRON] Successfully renewed DAO ${dao.id}`);
        } else {
          throw new Error('Transaction reverted');
        }
      } catch (error: any) {
        logger.error(`[CRON] Failed to renew DAO ${dao.id}, downgrading. Error: ${error.message}`);
        // If payment fails (e.g., insufficient funds), downgrade the DAO to free tier
        await downgradeDAO(dao.id);
      }
    }
  } catch (error: any) {
    logger.error('[CRON] Error during subscription processing:', error);
  }
}

async function downgradeDAO(daoId: string) {
  await db.update(daos)
    .set({ plan: 'free', billingStatus: 'cancelled', updatedAt: new Date() })
    .where(eq(daos.id, daoId));

  await db.insert(billingHistory).values({
    daoId: daoId,
    amount: '0',
    currency: 'USD',
    status: 'failed',
    description: `Automated renewal failed. Downgraded to free tier.`,
    createdAt: new Date()
  });
}
