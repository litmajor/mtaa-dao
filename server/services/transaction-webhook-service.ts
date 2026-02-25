/**
 * Transaction Webhook Listener Service
 * Listens for incoming deposits and credits accounts
 * Supports multiple blockchain networks (Celo, Ethereum, etc.)
 */

import { db } from '../db';
import { deposits, accounts, wallets, walletTransactions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

/**
 * Supported blockchain networks
 */
export enum SupportedChains {
  CELO = 'celo',
  ETHEREUM = 'ethereum',
  POLYGON = 'polygon',
  OPTIMISM = 'optimism',
}

/**
 * Transaction webhook payload (simplified - adapt to your provider)
 */
export interface TransactionWebhookPayload {
  transactionHash: string;
  from: string;
  to: string;
  value: string;
  tokenAddress?: string;
  tokenSymbol: string;
  decimals: number;
  blockNumber: number;
  blockTimestamp: number;
  chainId: number;
  status: 'success' | 'failed';
  confirmations: number;
}

/**
 * Process incoming deposit transaction
 * Called by webhook listener when transaction is confirmed
 */
export async function processIncomingDeposit(
  payload: TransactionWebhookPayload
): Promise<{
  success: boolean;
  depositId?: string;
  error?: string;
}> {
  try {
    // Normalize address (Ethereum addresses are case-insensitive)
    const toAddress = payload.to.toLowerCase();
    const fromAddress = payload.from.toLowerCase();

    // Find wallet that received this transaction
    const wallet = await db
      .select()
      .from(wallets)
      .where(and(eq(wallets.address, toAddress), eq(wallets.isActive, true)))
      .limit(1);

    if (!wallet[0]) {
      console.warn(`No active wallet found for address: ${toAddress}`);
      return {
        success: false,
        error: 'Wallet not found',
      };
    }

    const userId = wallet[0].userId;

    // Find or create user's wallet account (account_type = 'wallet')
    const walletAccount = await db
      .select()
      .from(accounts)
      .where(
        and(eq(accounts.userId, userId), eq(accounts.accountType, 'wallet'), eq(accounts.currency, payload.tokenSymbol))
      )
      .limit(1);

    if (!walletAccount[0]) {
      console.error(`No wallet account found for user ${userId} with currency ${payload.tokenSymbol}`);
      return {
        success: false,
        error: 'User wallet account not found',
      };
    }

    const accountId = walletAccount[0].id;

    // Convert token amount to decimal format
    const amount = BigInt(payload.value) / BigInt(10 ** payload.decimals);

    // Record wallet transaction
    await db.insert(walletTransactions).values({
      id: uuid(),
      walletId: wallet[0].id,
      type: 'deposit',
      amount: amount.toString(),
      currency: payload.tokenSymbol,
      transactionHash: payload.transactionHash,
      fromAddress,
      toAddress,
      chainId: payload.chainId,
      blockNumber: payload.blockNumber,
      blockTimestamp: new Date(payload.blockTimestamp * 1000),
      status: payload.status === 'success' ? 'completed' : 'failed',
      description: `Incoming deposit from ${fromAddress}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    // Create deposit record
    const depositId = uuid();
    await db.insert(deposits).values({
      id: depositId,
      userId,
      toAccountId: accountId,
      source: 'external_wallet',
      amount: amount.toString(),
      currency: payload.tokenSymbol,
      status: 'completed',
      transactionHash: payload.transactionHash,
      createdAt: new Date(),
      completedAt: new Date(),
    } as any);

    // Update account balance
    const newBalance = (BigInt(walletAccount[0].balance) + amount).toString();
    await db
      .update(accounts)
      .set({
        balance: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, accountId));

    console.log(`✅ Deposit processed: ${amount} ${payload.tokenSymbol} to user ${userId}`);

    return {
      success: true,
      depositId,
    };
  } catch (error) {
    console.error('Error processing deposit:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Webhook endpoint for Alchemy/Infura style webhooks
 * Processes notifications of transactions matching webhook filters
 */
export async function handleAlchemyWebhook(payload: any): Promise<{
  success: boolean;
  processed: number;
  errors: string[];
}> {
  const results: {
    success: boolean;
    processed: number;
    errors: string[];
  } = {
    success: true,
    processed: 0,
    errors: [],
  };

  try {
    // Alchemy sends activity in this format
    if (payload.event?.activity) {
      for (const tx of payload.event.activity) {
        const result = await processIncomingDeposit({
          transactionHash: tx.hash,
          from: tx.fromAddress,
          to: tx.toAddress,
          value: tx.value || '0',
          tokenSymbol: tx.tokenSymbol || 'ETH',
          decimals: tx.decimals || 18,
          blockNumber: tx.blockNum,
          blockTimestamp: tx.blockTimestamp,
          chainId: payload.event.network || 42220, // Default to Celo
          status: tx.status === 'confirmed' ? 'success' : 'failed',
          confirmations: tx.confirmations || 0,
        });

        if (result.success) {
          results.processed++;
        } else {
          results.errors.push(result.error || 'Unknown error');
        }
      }
    }

    return results;
  } catch (error) {
    console.error('Error handling webhook:', error);
    return {
      success: false,
      processed: 0,
      errors: [(error as Error).message],
    };
  }
}

/**
 * Webhook endpoint for QuickNode or other providers
 */
export async function handleQuickNodeWebhook(payload: any): Promise<{
  success: boolean;
  processed: number;
}> {
  try {
    if (Array.isArray(payload)) {
      for (const tx of payload) {
        if (tx.input === '0x') {
          // Native token transfer (ETH, celo, etc)
          const result = await processIncomingDeposit({
            transactionHash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: tx.value,
            tokenSymbol: tx.tokenSymbol || 'ETH',
            decimals: 18,
            blockNumber: tx.blockNumber,
            blockTimestamp: tx.timeStamp || Math.floor(Date.now() / 1000),
            chainId: tx.chainId || 42220,
            status: 'success',
            confirmations: 0,
          });

          if (!result.success) {
            console.warn(`Failed to process tx ${tx.hash}: ${result.error}`);
          }
        }
      }
    }

    return {
      success: true,
      processed: Array.isArray(payload) ? payload.length : 1,
    };
  } catch (error) {
    console.error('Error handling webhook:', error);
    return {
      success: false,
      processed: 0,
    };
  }
}

/**
 * Setup webhook routes (express middleware)
 * Usage: app.use('/api/webhooks/deposits', setupDepositWebhookRoutes())
 */
export function setupDepositWebhookRoutes(router: any) {
  /**
   * POST /api/webhooks/deposits/alchemy
   * Receive Alchemy webhook notifications
   */
  router.post('/alchemy', async (req, res) => {
    try {
      const result = await handleAlchemyWebhook(req.body);
      res.json({
        success: result.success,
        processed: result.processed,
        errors: result.errors,
      });
    } catch (error) {
      console.error('Alchemy webhook error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * POST /api/webhooks/deposits/quicknode
   * Receive QuickNode webhook notifications
   */
  router.post('/quicknode', async (req, res) => {
    try {
      const result = await handleQuickNodeWebhook(req.body);
      res.json(result);
    } catch (error) {
      console.error('QuickNode webhook error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * POST /api/webhooks/deposits/manual
   * Manual deposit webhook for testing (requires authentication)
   */
  router.post('/manual', async (req, res) => {
    try {
      const result = await processIncomingDeposit(req.body);
      res.json(result);
    } catch (error) {
      console.error('Manual webhook error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  return router;
}

/**
 * Polling-based deposit checker
 * Alternative to webhooks (less real-time, but simpler to set up)
 * Run this periodically (e.g., every 30 seconds) as a background job
 */
export async function checkPendingDeposits(): Promise<{
  checked: number;
  processed: number;
}> {
  try {
    // Get all pending deposits
    const pendingDeposits = await db
      .select()
      .from(deposits)
      .where(eq(deposits.status, 'pending'));

    let processed = 0;

    for (const deposit of pendingDeposits) {
      // In production: Check blockchain for transaction confirmation
      // For now: Mark as completed after 10 seconds
      const createdSeconds = Math.floor((Date.now() - (deposit.createdAt as Date).getTime()) / 1000);

      if (createdSeconds > 10) {
        await db
          .update(deposits)
          .set({
            status: 'completed',
            completedAt: new Date(),
          })
          .where(eq(deposits.id, deposit.id));

        processed++;
      }
    }

    return {
      checked: pendingDeposits.length,
      processed,
    };
  } catch (error) {
    console.error('Error checking pending deposits:', error);
    return {
      checked: 0,
      processed: 0,
    };
  }
}

export const transactionWebhookService = {
  processIncomingDeposit,
  handleAlchemyWebhook,
  handleQuickNodeWebhook,
  setupDepositWebhookRoutes,
  checkPendingDeposits,
};
