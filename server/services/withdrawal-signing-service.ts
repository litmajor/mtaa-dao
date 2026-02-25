/**
 * Withdrawal Signing Service
 * Handles transaction signing for blockchain withdrawals
 * Supports both EOA (Externally Owned Accounts) and smart wallets
 */

import { db } from '../db';
import { wallets, walletPrivateKeys, accounts, withdrawals, walletAccessLog } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { walletGenerationService } from './wallet-generation-service';

/**
 * Supported withdrawal destinations
 */
export enum WithdrawalDestination {
  EXTERNAL_WALLET = 'external_wallet',
  OFFRAMP_STRIPE = 'offramp_stripe',
  MICRO_WITHDRAWAL = 'micro_withdrawal',
  INTERNAL_TRANSFER = 'internal_transfer',
}

/**
 * Transaction signing payload
 */
export interface TransactionToSign {
  from: string;
  to: string;
  value: string;
  data?: string; // For contract calls
  gasLimit?: string;
  gasPrice?: string;
  nonce?: number;
  chainId: number;
}

/**
 * Signed transaction result
 */
export interface SignedTransaction {
  hash: string;
  signature: string;
  raw: string;
  from: string;
  to: string;
  value: string;
}

/**
 * Prepare withdrawal for signing
 */
export async function prepareWithdrawalForSigning(
  userId: string,
  accountId: string,
  destination: string,
  recipientAddress: string,
  amount: string,
  currency: string,
  chainId: number = 42220 // Celo mainnet
): Promise<{
  success: boolean;
  withdrawalId?: string;
  transaction?: TransactionToSign;
  error?: string;
}> {
  try {
    // Verify user's account and wallet exist
    const account = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);

    if (!account[0] || account[0].userId !== userId) {
      throw new Error('Account not found');
    }

    // Check sufficient balance
    const balance = BigInt(account[0].balance);
    const withdrawAmount = BigInt(Math.floor(parseFloat(amount) * 10 ** 8)); // 8 decimals

    if (balance < withdrawAmount) {
      throw new Error('Insufficient balance');
    }

    // Get user's wallet
    const wallet = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);

    if (!wallet[0] || !wallet[0].isActive) {
      throw new Error('Wallet not found or inactive');
    }

    // Create withdrawal record (in pending state)
    const withdrawalId = uuid();
    await db.insert(withdrawals).values({
      id: withdrawalId,
      userId,
      fromAccountId: accountId,
      destination,
      amount,
      currency,
      status: 'pending',
      createdAt: new Date(),
    } as any);

    // Log wallet access
    await logWalletAccess(wallet[0].id, userId, 'initiate_withdrawal', 'withdrawal_preparation');

    // Prepare transaction for signing
    const transaction: TransactionToSign = {
      from: wallet[0].address,
      to: recipientAddress,
      value: withdrawAmount.toString(),
      chainId,
    };

    return {
      success: true,
      withdrawalId,
      transaction,
    };
  } catch (error) {
    console.error('Error preparing withdrawal:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Sign transaction with wallet private key
 * CRITICAL: This should only be called in secure context (server-side only)
 */
export async function signWithdrawalTransaction(
  userId: string,
  walletId: string,
  withdrawalId: string,
  transaction: TransactionToSign
): Promise<{
  success: boolean;
  signedTransaction?: SignedTransaction;
  error?: string;
}> {
  try {
    // Verify authorization
    const wallet = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);

    if (!wallet[0] || wallet[0].userId !== userId) {
      throw new Error('Unauthorized: Wallet does not belong to user');
    }

    // Log access attempt
    await logWalletAccess(walletId, userId, 'sign_transaction', 'withdrawal_signing');

    // Get encrypted private key
    const privateKeyRecord = await db
      .select()
      .from(walletPrivateKeys)
      .where(eq(walletPrivateKeys.walletId, walletId))
      .limit(1);

    if (!privateKeyRecord[0]) {
      throw new Error('Private key not found');
    }

    // Decrypt private key
    const decryptedKey = walletGenerationService.decryptSensitiveData(
      privateKeyRecord[0].encryptedPrivateKey,
      privateKeyRecord[0].encryptionIv,
      privateKeyRecord[0].encryptionSalt,
      privateKeyRecord[0].authTag
    );

    // Sign transaction using ethers.js (Celo compatible)
    const signedTx = await signTransactionWithKey(decryptedKey, transaction);

    // Update withdrawal record with signature
    await db
      .update(withdrawals)
      .set({
        transactionHash: signedTx.hash,
        status: 'signed',
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, withdrawalId));

    // Log successful signing
    await logWalletAccess(walletId, userId, 'sign_success', 'transaction_signed');

    return {
      success: true,
      signedTransaction: signedTx,
    };
  } catch (error) {
    console.error('Error signing transaction:', error);

    // Log failed signing attempt
    try {
      await logWalletAccess(walletId, userId, 'sign_failed', `Error: ${(error as Error).message}`);
    } catch {}

    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Sign transaction with private key using ethers.js
 */
async function signTransactionWithKey(privateKey: string, transaction: TransactionToSign): Promise<SignedTransaction> {
  try {
    // Dynamic import
    const { ethers } = await import('ethers');

    // Create wallet from private key
    const wallet = new ethers.Wallet(privateKey);

    // Sign transaction
    const signedTx = await wallet.signTransaction(transaction);

    // Parse transaction
    const parsedTx = ethers.Transaction.from(signedTx);

    return {
      hash: parsedTx.hash || '',
      signature: parsedTx.signature || '',
      raw: signedTx,
      from: wallet.address,
      to: transaction.to,
      value: transaction.value,
    };
  } catch (error) {
    throw new Error(`Transaction signing failed: ${(error as Error).message}`);
  }
}

/**
 * Execute signed withdrawal (submit to blockchain)
 * Uses RPC provider to broadcast transaction
 */
export async function executeSignedWithdrawal(
  userId: string,
  withdrawalId: string,
  signedTransaction: string,
  rpcProvider: string = process.env.CELO_RPC_URL || 'https://forno.celo.org'
): Promise<{
  success: boolean;
  transactionHash?: string;
  error?: string;
}> {
  try {
    const { ethers } = await import('ethers');

    // Connect to RPC provider
    const provider = new ethers.JsonRpcProvider(rpcProvider);

    // Send signed transaction
    const result = await provider.broadcastTransaction(signedTransaction);

    // Update withdrawal record
    await db
      .update(withdrawals)
      .set({
        transactionHash: result.hash,
        status: 'processing',
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, withdrawalId));

    console.log(`✅ Withdrawal submitted: ${result.hash}`);

    return {
      success: true,
      transactionHash: result.hash,
    };
  } catch (error) {
    console.error('Error executing withdrawal:', error);

    // Update withdrawal record with error
    await db
      .update(withdrawals)
      .set({
        status: 'failed',
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, withdrawalId));

    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Monitor withdrawal confirmation
 */
export async function checkWithdrawalConfirmation(
  withdrawalId: string,
  rpcProvider: string = process.env.CELO_RPC_URL || 'https://forno.celo.org',
  requiredConfirmations: number = 12
): Promise<{
  success: boolean;
  status: string;
  confirmations?: number;
  error?: string;
}> {
  try {
    const withdrawal = await db.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId)).limit(1);

    if (!withdrawal[0]) {
      throw new Error('Withdrawal not found');
    }

    if (!withdrawal[0].transactionHash) {
      return {
        success: true,
        status: withdrawal[0].status,
      };
    }

    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(rpcProvider);

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(withdrawal[0].transactionHash);

    if (!receipt) {
      return {
        success: true,
        status: 'pending',
        confirmations: 0,
      };
    }

    // Get current block number
    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - (receipt.blockNumber || 0);

    // Update status based on confirmations
    const newStatus = confirmations >= requiredConfirmations ? 'completed' : 'processing';

    if (newStatus !== withdrawal[0].status) {
      await db
        .update(withdrawals)
        .set({
          status: newStatus,
          completedAt: newStatus === 'completed' ? new Date() : withdrawal[0].completedAt,
          updatedAt: new Date(),
        })
        .where(eq(withdrawals.id, withdrawalId));
    }

    return {
      success: true,
      status: newStatus,
      confirmations,
    };
  } catch (error) {
    console.error('Error checking confirmation:', error);
    return {
      success: false,
      status: 'error',
      error: (error as Error).message,
    };
  }
}

/**
 * Log wallet access (audit trail)
 */
async function logWalletAccess(
  walletId: string,
  userId: string,
  action: string,
  description: string
): Promise<void> {
  try {
    await db.insert(walletAccessLog).values({
      id: uuid(),
      walletId,
      userId,
      action,
      ipAddress: '0.0.0.0', // Should capture from request
      userAgent: 'API',
      deviceId: null,
      description,
      createdAt: new Date(),
    } as any);
  } catch (error) {
    console.warn('Failed to log wallet access:', error);
  }
}

/**
 * Batch process pending withdrawals
 * Runs periodically to check and confirm transactions
 */
export async function processPendingWithdrawals(): Promise<{
  processed: number;
  confirmed: number;
  failed: number;
}> {
  let processed = 0;
  let confirmed = 0;
  let failed = 0;

  try {
    // Get all non-final withdrawals
    const pendingWithdrawals = await db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.status, 'processing'));

    for (const withdrawal of pendingWithdrawals) {
      const result = await checkWithdrawalConfirmation(withdrawal.id);

      if (result.success) {
        processed++;
        if (result.status === 'completed') {
          confirmed++;
        }
      } else {
        failed++;
      }
    }

    console.log(`✅ Withdrawal processing complete: ${processed} processed, ${confirmed} confirmed, ${failed} failed`);
  } catch (error) {
    console.error('Error in batch withdrawal processing:', error);
  }

  return { processed, confirmed, failed };
}

export const withdrawalSigningService = {
  prepareWithdrawalForSigning,
  signWithdrawalTransaction,
  executeSignedWithdrawal,
  checkWithdrawalConfirmation,
  processPendingWithdrawals,
  WithdrawalDestination,
};
