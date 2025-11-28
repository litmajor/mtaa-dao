/**
 * KotaniPay Integration Service
 * Handles deposits (M-Pesa → cUSD) and withdrawals (cUSD → M-Pesa)
 * Manages balance reconciliation, fee tracking, and transaction lifecycle
 */

import { db } from '../db';
import { walletTransactions } from '../../shared/schema';
import { userBalances as userBalancesTable, transactionFees as transactionFeesTable, mpesaTransactions as mpesaTransactionsTable } from '../../shared/financialEnhancedSchema';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { notificationService } from '../notificationService';
import { config } from '../../shared/config';
import { exchangeRateService } from './exchangeRateService';

interface DepositRequest {
  userId: string;
  phone: string;
  amountKES: number; // Amount in KES from M-Pesa
  reference?: string;
  daoId?: string;
}

interface DepositResponse {
  success: boolean;
  transactionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amountKES: number;
  estimatedCUSD: number;
  exchangeRate: number;
  fee: number;
  message: string;
}

interface WithdrawalRequest {
  userId: string;
  phone: string;
  amountCUSD: number; // Amount in cUSD to withdraw
  daoId?: string;
}

interface WithdrawalResponse {
  success: boolean;
  transactionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amountCUSD: number;
  estimatedKES: number;
  exchangeRate: number;
  fee: number;
  message: string;
}

const KOTANI_BASE_URL = process.env.KOTANI_API_URL || 'https://sandbox.kotaniapi.com';
const KOTANI_API_KEY = process.env.KOTANIPAY_API_KEY;
const KOTANI_SECRET_KEY = process.env.KOTANIPAY_SECRET_KEY;

// Fee configuration
const DEPOSIT_FEE_PERCENTAGE = 0.015; // 1.5% for M-Pesa deposits
const WITHDRAWAL_FEE_PERCENTAGE = 0.02; // 2% for M-Pesa withdrawals

export class KotanipayService {
  /**
   * Initiate a deposit: M-Pesa → cUSD
   * User sends money via M-Pesa, receives cUSD in wallet
   */
  static async initiateDeposit(request: DepositRequest): Promise<DepositResponse> {
    const transactionId = `DEP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Validate request
      if (!request.userId || !request.phone || request.amountKES <= 0) {
        throw new Error('Invalid deposit request');
      }

      // Get current exchange rate
      const exchangeRate = await exchangeRateService.getUSDtoKESRate();

      // Calculate conversion and fees
      const fee = request.amountKES * DEPOSIT_FEE_PERCENTAGE;
      const netKES = request.amountKES - fee;
      const estimatedCUSD = netKES / exchangeRate;

      // Record pending transaction
      const transaction = await (db as any).insert(mpesaTransactionsTable).values({
        userId: request.userId,
        phoneNumber: request.phone,
        transactionType: 'stk_push',
        amount: request.amountKES.toString(),
        accountReference: `MtaaDAO-${request.userId.substring(0, 8)}`,
        transactionDesc: `MtaaDAO Deposit - ${transactionId}`,
        status: 'pending',
        metadata: {
          transactionId,
          reference: request.reference,
          daoId: request.daoId,
          amountCUSD: estimatedCUSD.toString(),
          exchangeRate: exchangeRate.toString(),
          estimatedKES: request.amountKES,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      // Record fee
      await this.recordFee({
        transactionId,
        transactionType: 'wallet',
        feeType: 'platform_fee',
        feeCategory: 'mpesa_deposit',
        baseAmount: request.amountKES,
        feeAmount: fee,
        feePercentage: DEPOSIT_FEE_PERCENTAGE,
        currency: 'KES',
        userId: request.userId,
      });

      // Initiate M-Pesa STK push
      await this.initiateMpesaSTKPush({
        phone: request.phone,
        amount: request.amountKES,
        transactionId,
        accountReference: `MtaaDAO-${request.userId.substring(0, 8)}`,
      });

      // Send notification
      await notificationService.sendPaymentNotification(request.phone, {
        type: 'payment_pending',
        amount: request.amountKES,
        currency: 'KES',
        transactionId,
      });

      return {
        success: true,
        transactionId,
        status: 'pending',
        amountKES: request.amountKES,
        estimatedCUSD,
        exchangeRate,
        fee,
        message: 'Deposit initiated. Please enter M-Pesa PIN to confirm.',
      };
    } catch (error) {
      console.error('Deposit initiation error:', error);
      throw error;
    }
  }

  /**
   * Complete a deposit after M-Pesa confirmation
   * Called from KotaniPay webhook callback
   */
  static async completeDeposit(
    transactionId: string,
    mpesaReceipt: string,
    mpesaData: any
  ): Promise<void> {
    try {
      // Get pending transaction
      const [transaction] = await (db as any)
        .select()
        .from(mpesaTransactionsTable)
        .where(eq(mpesaTransactionsTable.checkoutRequestId, transactionId));

      if (!transaction) {
        throw new Error(`Transaction not found: ${transactionId}`);
      }

      if (transaction.status !== 'pending') {
        throw new Error(`Transaction already processed: ${transactionId}`);
      }

      const amountCUSD = parseFloat(transaction.amount);

      // Update transaction status
      await (db as any)
        .update(mpesaTransactionsTable)
        .set({
          status: 'completed',
          mpesaReceiptNumber: mpesaReceipt,
          metadata: { ...transaction.metadata, confirmedAt: new Date().toISOString() },
          updatedAt: new Date(),
        })
        .where(eq(mpesaTransactionsTable.checkoutRequestId, transactionId));

      // Update user balance - add to available balance
      await this.updateUserBalance(
        transaction.userId,
        'cUSD',
        amountCUSD,
        'add',
        (transaction.metadata as any)?.daoId
      );

      // Record wallet transaction
      await (db as any).insert(walletTransactions).values({
        id: `${transactionId}-cUSD`,
        fromUserId: 'SYSTEM',
        toUserId: transaction.userId,
        amount: amountCUSD.toString(),
        currency: 'cUSD',
        transactionHash: mpesaReceipt,
        status: 'completed',
        metadata: {
          mpesaReceipt,
          kotaniTransactionId: transactionId,
          exchangeRate: EXCHANGE_RATE,
        },
      });

      // Send success notification
      await notificationService.sendPaymentNotification(transaction.phoneNumber, {
        type: 'payment_success',
        amount: amountCUSD,
        currency: 'cUSD',
        transactionId,
      });

      console.log(`✅ Deposit completed: ${transactionId} - ${amountCUSD} cUSD`);
    } catch (error) {
      console.error('Deposit completion error:', error);
      await this.failDeposit(transactionId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Initiate a withdrawal: cUSD → M-Pesa
   * User sends cUSD from wallet, receives money on M-Pesa
   */
  static async initiateWithdrawal(request: WithdrawalRequest): Promise<WithdrawalResponse> {
    const transactionId = `WD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Validate request
      if (!request.userId || !request.phone || request.amountCUSD <= 0) {
        throw new Error('Invalid withdrawal request');
      }

      // Check user balance
      const [balance] = await (db as any)
        .select()
        .from(userBalancesTable)
        .where(
          and(
            eq(userBalancesTable.userId, request.userId),
            eq(userBalancesTable.currency, 'cUSD')
          )
        );

      const availableBalance = balance ? parseFloat(balance.availableBalance) : 0;
      if (availableBalance < request.amountCUSD) {
        throw new Error(`Insufficient balance. Available: ${availableBalance} cUSD`);
      }

      // Calculate conversion and fees
      const fee = request.amountCUSD * WITHDRAWAL_FEE_PERCENTAGE;
      const netCUSD = request.amountCUSD - fee;
      const estimatedKES = netCUSD * EXCHANGE_RATE;

      // Deduct from balance immediately (lock funds)
      await this.updateUserBalance(
        request.userId,
        'cUSD',
        request.amountCUSD,
        'subtract',
        request.daoId
      );

      // Record pending transaction
      await (db as any).insert(mpesaTransactionsTable).values({
        userId: request.userId,
        phoneNumber: request.phone,
        transactionType: 'b2c',
        amount: estimatedKES,
        checkoutRequestId: transactionId,
        status: 'pending',
        metadata: {
          amountCUSD: request.amountCUSD.toString(),
          exchangeRate: EXCHANGE_RATE.toString(),
          daoId: request.daoId,
        },
      }).returning();

      // Record fee
      await this.recordFee({
        transactionId,
        transactionType: 'wallet',
        feeType: 'platform_fee',
        feeCategory: 'mpesa_withdrawal',
        baseAmount: request.amountCUSD,
        feeAmount: fee,
        feePercentage: WITHDRAWAL_FEE_PERCENTAGE,
        currency: 'cUSD',
        userId: request.userId,
      });

      // Initiate M-Pesa B2C transfer
      await this.initiateMpesaB2CTransfer({
        phone: request.phone,
        amountKES: Math.floor(estimatedKES),
        transactionId,
        commandId: 'BusinessPayment',
      });

      // Send notification
      await notificationService.sendPaymentNotification(request.phone, {
        type: 'payment_pending',
        amount: request.amountCUSD,
        currency: 'cUSD',
        transactionId,
      });

      return {
        success: true,
        transactionId,
        status: 'pending',
        amountCUSD: request.amountCUSD,
        estimatedKES,
        exchangeRate: EXCHANGE_RATE,
        fee,
        message: 'Withdrawal initiated. You will receive M-Pesa notification shortly.',
      };
    } catch (error) {
      console.error('Withdrawal initiation error:', error);
      throw error;
    }
  }

  /**
   * Complete a withdrawal after M-Pesa B2C confirmation
   */
  static async completeWithdrawal(
    transactionId: string,
    mpesaResponse: any
  ): Promise<void> {
    try {
      // Get pending transaction
      const [transaction] = await (db as any)
        .select()
        .from(mpesaTransactionsTable)
        .where(eq(mpesaTransactionsTable.checkoutRequestId, transactionId));

      if (!transaction) {
        throw new Error(`Transaction not found: ${transactionId}`);
      }

      if (transaction.status !== 'pending') {
        throw new Error(`Transaction already processed: ${transactionId}`);
      }

      // Update transaction status
      await (db as any)
        .update(mpesaTransactionsTable)
        .set({
          status: 'completed',
          conversationId: mpesaResponse.ConversationID,
          metadata: { ...transaction.metadata, confirmedAt: new Date().toISOString() },
          updatedAt: new Date(),
        })
        .where(eq(mpesaTransactionsTable.checkoutRequestId, transactionId));

      // Record wallet transaction (debit)
      await (db as any).insert(walletTransactions).values({
        id: `${transactionId}-debit`,
        fromUserId: transaction.userId,
        toUserId: 'SYSTEM',
        amount: (transaction.metadata as any)?.amountCUSD || transaction.amount.toString(),
        currency: 'cUSD',
        transactionHash: mpesaResponse.ConversationID,
        status: 'completed',
        metadata: {
          mpesaReceipt: mpesaResponse.ConversationID,
          kotaniTransactionId: transactionId,
          exchangeRate: EXCHANGE_RATE,
        },
      });

      // Send success notification
      await notificationService.sendPaymentNotification(transaction.phoneNumber, {
        type: 'payment_success',
        amount: (transaction.metadata as any)?.amountCUSD,
        currency: 'cUSD',
        transactionId,
      });

      console.log(`✅ Withdrawal completed: ${transactionId} - ${transaction.amountKES} KES`);
    } catch (error) {
      console.error('Withdrawal completion error:', error);
      // Refund balance on failure
      await this.refundWithdrawal(transactionId);
      throw error;
    }
  }

  /**
   * Update user balance in real-time
   */
  static async updateUserBalance(
    userId: string,
    currency: string,
    amount: number,
    operation: 'add' | 'subtract',
    daoId?: string
  ): Promise<void> {
    try {
      // Get current balance
      const [currentBalance] = await (db as any)
        .select()
        .from(userBalancesTable)
        .where(
          and(
            eq(userBalancesTable.userId, userId),
            eq(userBalancesTable.currency, currency),
            daoId ? eq(userBalancesTable.daoId, daoId) : isNull(userBalancesTable.daoId)
          )
        );

      const available = currentBalance ? parseFloat(currentBalance.availableBalance) : 0;
      const newBalance = operation === 'add' ? available + amount : available - amount;

      if (newBalance < 0) {
        throw new Error(`Insufficient balance. Current: ${available}, Requested: ${amount}`);
      }

      // Update or create balance
      if (currentBalance) {
        await (db as any)
          .update(userBalancesTable)
          .set({
            availableBalance: newBalance.toString(),
            totalBalance: newBalance.toString(),
            lastUpdated: new Date(),
          })
          .where(eq(userBalancesTable.id, currentBalance.id));
      } else {
        await (db as any).insert(userBalancesTable).values({
          userId,
          currency,
          availableBalance: newBalance.toString(),
          totalBalance: newBalance.toString(),
          daoId,
          createdAt: new Date(),
          lastUpdated: new Date(),
        });
      }

      console.log(
        `💰 Balance updated: ${userId} ${currency} ${operation} ${amount} = ${newBalance}`
      );
    } catch (error) {
      console.error('Balance update error:', error);
      throw error;
    }
  }

  /**
   * Record transaction fees
   */
  static async recordFee(feeData: {
    transactionId: string;
    transactionType: string;
    feeType: string;
    feeCategory: string;
    baseAmount: number;
    feeAmount: number;
    feePercentage: number;
    currency: string;
    userId: string;
  }): Promise<void> {
    try {
      await (db as any).insert(transactionFeesTable).values({
        transactionId: feeData.transactionId,
        transactionType: feeData.transactionType,
        feeType: feeData.feeType,
        feeCategory: feeData.feeCategory,
        baseAmount: feeData.baseAmount.toString(),
        feeAmount: feeData.feeAmount.toString(),
        feePercentage: feeData.feePercentage.toString(),
        currency: feeData.currency,
        paidBy: feeData.userId,
        platformRevenue: feeData.feeAmount.toString(),
        createdAt: new Date(),
      });

      console.log(
        `💵 Fee recorded: ${feeData.feeCategory} - ${feeData.feeAmount} ${feeData.currency}`
      );
    } catch (error) {
      console.error('Fee recording error:', error);
      throw error;
    }
  }

  /**
   * Fail a deposit and send notification
   */
  static async failDeposit(transactionId: string, reason: string): Promise<void> {
    try {
      const [transaction] = await (db as any)
        .select()
        .from(mpesaTransactionsTable)
        .where(eq(mpesaTransactionsTable.checkoutRequestId, transactionId));

      if (!transaction) return;

      await (db as any)
        .update(mpesaTransactionsTable)
        .set({
          status: 'failed',
          metadata: { ...transaction.metadata, failureReason: reason },
          updatedAt: new Date(),
        })
        .where(eq(mpesaTransactionsTable.checkoutRequestId, transactionId));

      await notificationService.sendPaymentNotification(transaction.phoneNumber, {
        type: 'payment_failed',
        amount: transaction.amount,
        currency: 'KES',
        transactionId,
      });

      console.log(`❌ Deposit failed: ${transactionId} - ${reason}`);
    } catch (error) {
      console.error('Fail deposit error:', error);
    }
  }

  /**
   * Refund a failed withdrawal (return cUSD to user)
   */
  static async refundWithdrawal(transactionId: string): Promise<void> {
    try {
      const [transaction] = await (db as any)
        .select()
        .from(mpesaTransactionsTable)
        .where(eq(mpesaTransactionsTable.checkoutRequestId, transactionId));

      if (!transaction) return;

      // Return full amount to user balance
      const amountCUSD = (transaction.metadata as any)?.amountCUSD
        ? parseFloat((transaction.metadata as any).amountCUSD)
        : 0;
      const daoId = (transaction.metadata as any)?.daoId;

      await this.updateUserBalance(
        transaction.userId,
        'cUSD',
        amountCUSD,
        'add',
        daoId
      );

      await (db as any)
        .update(mpesaTransactionsTable)
        .set({
          status: 'refunded',
          updatedAt: new Date(),
        })
        .where(eq(mpesaTransactionsTable.checkoutRequestId, transactionId));

      await notificationService.sendPaymentNotification(transaction.phoneNumber, {
        type: 'payment_failed',
        amount: amountCUSD,
        currency: 'cUSD',
        transactionId,
      });

      console.log(`💸 Withdrawal refunded: ${transactionId}`);
    } catch (error) {
      console.error('Refund withdrawal error:', error);
    }
  }

  /**
   * Initiate M-Pesa STK Push for deposits
   */
  private static async initiateMpesaSTKPush(params: {
    phone: string;
    amount: number;
    transactionId: string;
    accountReference: string;
  }): Promise<void> {
    try {
      if (!KOTANI_API_KEY) {
        console.warn('KOTANI_API_KEY not configured, skipping STK push');
        return;
      }

      const response = await fetch(`${KOTANI_BASE_URL}/api/v1/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${KOTANI_API_KEY}`,
        },
        body: JSON.stringify({
          phoneNumber: params.phone,
          amount: params.amount,
          accountReference: params.accountReference,
          transactionDesc: `MtaaDAO Deposit - ${params.transactionId}`,
          callbackUrl: `${config.BACKEND_URL}/api/kotanipay-status/callback`,
          transactionId: params.transactionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`M-Pesa STK push failed: ${response.statusText}`);
      }

      console.log(`📱 M-Pesa STK push sent: ${params.phone}`);
    } catch (error) {
      console.error('STK push error:', error);
      throw error;
    }
  }

  /**
   * Initiate M-Pesa B2C transfer for withdrawals
   */
  private static async initiateMpesaB2CTransfer(params: {
    phone: string;
    amountKES: number;
    transactionId: string;
    commandId: string;
  }): Promise<void> {
    try {
      if (!KOTANI_API_KEY) {
        console.warn('KOTANI_API_KEY not configured, skipping B2C transfer');
        return;
      }

      const response = await fetch(`${KOTANI_BASE_URL}/api/v1/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${KOTANI_API_KEY}`,
        },
        body: JSON.stringify({
          phoneNumber: params.phone,
          amount: params.amountKES,
          commandId: params.commandId,
          callbackUrl: `${config.BACKEND_URL}/api/kotanipay-status/callback`,
          transactionId: params.transactionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`M-Pesa B2C transfer failed: ${response.statusText}`);
      }

      console.log(`💳 M-Pesa B2C transfer initiated: ${params.phone} - ${params.amountKES} KES`);
    } catch (error) {
      console.error('B2C transfer error:', error);
      throw error;
    }
  }
}
