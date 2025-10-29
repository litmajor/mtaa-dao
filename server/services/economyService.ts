
import { db } from '../db';
import { 
  users, 
  walletTransactions, 
  vaultTransactions,
  escrowAccounts,
  paymentTransactions 
} from '../../shared/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { tokenService } from './tokenService';
import { paymentGatewayService } from './paymentGatewayService';

interface EarnOpportunity {
  id: string;
  type: 'task' | 'governance' | 'referral' | 'community';
  description: string;
  reward: string;
  currency: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime?: string;
}

interface SpendOption {
  merchantId: string;
  merchantName: string;
  category: 'groceries' | 'transport' | 'airtime' | 'utilities' | 'services';
  acceptsMTAA: boolean;
  discountForMTAA?: number;
}

interface RedemptionRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  fee: number;
  minAmount: string;
  maxAmount: string;
}

export class EconomyService {
  /**
   * Calculate GDP Effect - measures economic activity
   */
  async calculateGDPEffect(period: 'daily' | 'weekly' | 'monthly' = 'weekly'): Promise<{
    totalVolume: number;
    uniqueParticipants: number;
    transactionCount: number;
    velocityScore: number;
    earnVolume: number;
    spendVolume: number;
    redeemVolume: number;
  }> {
    const startDate = this.getStartDate(period);

    // Get all economic activity
    const [walletTx, vaultTx, escrowTx, paymentTx] = await Promise.all([
      db.select().from(walletTransactions).where(gte(walletTransactions.createdAt, startDate)),
      db.select().from(vaultTransactions).where(gte(vaultTransactions.createdAt, startDate)),
      db.select().from(escrowAccounts).where(gte(escrowAccounts.createdAt, startDate)),
      db.select().from(paymentTransactions).where(gte(paymentTransactions.createdAt, startDate))
    ]);

    // Calculate volumes
    const earnVolume = this.calculateEarnVolume(walletTx);
    const spendVolume = this.calculateSpendVolume(paymentTx);
    const redeemVolume = this.calculateRedeemVolume(paymentTx);

    const totalVolume = earnVolume + spendVolume + redeemVolume;
    const transactionCount = walletTx.length + vaultTx.length + escrowTx.length + paymentTx.length;

    // Unique participants
    const participants = new Set([
      ...walletTx.map(tx => tx.fromUserId).filter(Boolean),
      ...walletTx.map(tx => tx.toUserId).filter(Boolean),
      ...vaultTx.map(tx => tx.userId).filter(Boolean),
      ...escrowTx.map(tx => tx.payerId).filter(Boolean),
      ...escrowTx.map(tx => tx.payeeId).filter(Boolean),
      ...paymentTx.map(tx => tx.userId).filter(Boolean)
    ]);

    // Velocity = transactions per participant per day
    const days = this.getDaysInPeriod(period);
    const velocityScore = participants.size > 0 
      ? transactionCount / (participants.size * days)
      : 0;

    return {
      totalVolume,
      uniqueParticipants: participants.size,
      transactionCount,
      velocityScore,
      earnVolume,
      spendVolume,
      redeemVolume
    };
  }

  /**
   * Get available earning opportunities
   */
  async getEarnOpportunities(userId: string): Promise<EarnOpportunity[]> {
    const opportunities: EarnOpportunity[] = [];

    // Task opportunities
    const tasks = await db.execute(sql`
      SELECT id, title, description, reward_amount, difficulty, estimated_time
      FROM tasks
      WHERE status = 'open'
      AND id NOT IN (
        SELECT task_id FROM task_claims WHERE user_id = ${userId}
      )
      ORDER BY reward_amount DESC
      LIMIT 10
    `);

    for (const task of tasks.rows) {
      opportunities.push({
        id: task.id as string,
        type: 'task',
        description: task.description as string,
        reward: task.reward_amount as string,
        currency: 'MTAA',
        difficulty: task.difficulty as 'easy' | 'medium' | 'hard',
        estimatedTime: task.estimated_time as string
      });
    }

    // Governance opportunities
    const activeProposals = await db.execute(sql`
      SELECT id, title, description
      FROM proposals
      WHERE status = 'active'
      AND id NOT IN (
        SELECT proposal_id FROM proposal_votes WHERE user_id = ${userId}
      )
      LIMIT 5
    `);

    for (const proposal of activeProposals.rows) {
      opportunities.push({
        id: proposal.id as string,
        type: 'governance',
        description: `Vote on: ${proposal.title}`,
        reward: '10',
        currency: 'MTAA',
        difficulty: 'easy'
      });
    }

    // Referral opportunity
    opportunities.push({
      id: 'referral',
      type: 'referral',
      description: 'Invite new members to earn rewards',
      reward: '200',
      currency: 'MTAA',
      difficulty: 'easy'
    });

    // Community opportunities
    opportunities.push({
      id: 'street-mural',
      type: 'community',
      description: 'Paint community street mural',
      reward: '5000',
      currency: 'MTAA',
      difficulty: 'hard',
      estimatedTime: '1 week'
    });

    opportunities.push({
      id: 'merchant-verify',
      type: 'community',
      description: 'Verify local merchants for MTAA acceptance',
      reward: '50',
      currency: 'MTAA',
      difficulty: 'easy',
      estimatedTime: '30 minutes'
    });

    return opportunities;
  }

  /**
   * Get merchants accepting MTAA
   */
  async getSpendOptions(location?: string): Promise<SpendOption[]> {
    const merchants = await db.execute(sql`
      SELECT id, username, "fullName", metadata
      FROM users
      WHERE "isMerchant" = true
      AND "isActive" = true
      ORDER BY "createdAt" DESC
    `);

    return merchants.rows.map(merchant => ({
      merchantId: merchant.id as string,
      merchantName: merchant.fullName as string || merchant.username as string,
      category: this.getMerchantCategory(merchant.metadata),
      acceptsMTAA: true,
      discountForMTAA: 5 // 5% discount for MTAA payments
    }));
  }

  /**
   * Get redemption rates for converting MTAA to fiat
   */
  async getRedemptionRates(): Promise<RedemptionRate[]> {
    return [
      {
        fromCurrency: 'MTAA',
        toCurrency: 'KES',
        rate: 10, // 1 MTAA = 10 KES
        fee: 2, // 2% redemption fee
        minAmount: '100',
        maxAmount: '1000000'
      },
      {
        fromCurrency: 'MTAA',
        toCurrency: 'cUSD',
        rate: 0.1, // 1 MTAA = 0.1 cUSD
        fee: 1, // 1% redemption fee
        minAmount: '100',
        maxAmount: '1000000'
      },
      {
        fromCurrency: 'MTAA',
        toCurrency: 'USDT',
        rate: 0.1,
        fee: 1,
        minAmount: '100',
        maxAmount: '1000000'
      }
    ];
  }

  /**
   * Process merchant redemption (MTAA → KES)
   */
  async redeemMerchantTokens(
    merchantId: string,
    amount: string,
    toCurrency: 'KES' | 'cUSD' | 'USDT',
    method: 'mpesa' | 'bank' | 'crypto'
  ): Promise<{
    success: boolean;
    transactionId: string;
    amountReceived: string;
    fee: string;
  }> {
    const merchant = await db.select().from(users).where(eq(users.id, merchantId)).limit(1);
    
    if (!merchant.length || !merchant[0].isMerchant) {
      throw new Error('Invalid merchant');
    }

    // Get redemption rate
    const rates = await this.getRedemptionRates();
    const rate = rates.find(r => r.fromCurrency === 'MTAA' && r.toCurrency === toCurrency);
    
    if (!rate) {
      throw new Error('Redemption rate not found');
    }

    const amountNum = parseFloat(amount);
    const convertedAmount = amountNum * rate.rate;
    const feeAmount = convertedAmount * (rate.fee / 100);
    const netAmount = convertedAmount - feeAmount;

    // Process payment based on method
    let paymentResult;
    if (method === 'mpesa') {
      paymentResult = await paymentGatewayService.initiateWithdrawal('mpesa', {
        userId: merchantId,
        amount: netAmount.toString(),
        currency: toCurrency,
        method: 'mobile_money',
        metadata: {
          phone: merchant[0].phoneNumber,
          reason: 'MTAA merchant redemption'
        }
      });
    } else if (method === 'bank') {
      paymentResult = await paymentGatewayService.initiateWithdrawal('flutterwave', {
        userId: merchantId,
        amount: netAmount.toString(),
        currency: toCurrency,
        method: 'bank_transfer',
        metadata: merchant[0].metadata
      });
    } else {
      // Crypto redemption - direct token transfer
      const txHash = await tokenService.sendToken(
        toCurrency === 'cUSD' ? 'cUSD' : 'USDT',
        merchant[0].walletAddress!,
        netAmount.toString()
      );
      paymentResult = {
        success: true,
        transactionId: txHash,
        reference: txHash,
        status: 'completed'
      };
    }

    // Record redemption transaction
    await db.insert(paymentTransactions).values({
      userId: merchantId,
      reference: paymentResult.reference,
      type: 'redemption',
      amount: amount,
      currency: 'MTAA',
      provider: method,
      status: paymentResult.status,
      metadata: {
        convertedAmount: netAmount.toString(),
        toCurrency,
        rate: rate.rate,
        fee: feeAmount
      }
    });

    return {
      success: paymentResult.success,
      transactionId: paymentResult.transactionId,
      amountReceived: netAmount.toString(),
      fee: feeAmount.toString()
    };
  }

  /**
   * Record an earn transaction
   */
  async recordEarn(
    userId: string,
    amount: string,
    source: 'task' | 'governance' | 'referral' | 'community',
    metadata?: any
  ): Promise<void> {
    await db.insert(walletTransactions).values({
      fromUserId: 'system',
      toUserId: userId,
      walletAddress: 'earn',
      amount,
      currency: 'MTAA',
      type: 'reward',
      status: 'completed',
      description: `Earned from ${source}`,
      metadata
    });

    Logger.getLogger().info(`User ${userId} earned ${amount} MTAA from ${source}`);
  }

  /**
   * Record a spend transaction
   */
  async recordSpend(
    userId: string,
    merchantId: string,
    amount: string,
    productDescription: string
  ): Promise<void> {
    await db.insert(walletTransactions).values({
      fromUserId: userId,
      toUserId: merchantId,
      walletAddress: 'spend',
      amount,
      currency: 'MTAA',
      type: 'payment',
      status: 'completed',
      description: productDescription
    });

    Logger.getLogger().info(`User ${userId} spent ${amount} MTAA at merchant ${merchantId}`);
  }

  // Helper methods
  private getStartDate(period: 'daily' | 'weekly' | 'monthly'): Date {
    const now = new Date();
    switch (period) {
      case 'daily':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  private getDaysInPeriod(period: 'daily' | 'weekly' | 'monthly'): number {
    switch (period) {
      case 'daily': return 1;
      case 'weekly': return 7;
      case 'monthly': return 30;
    }
  }

  private calculateEarnVolume(transactions: any[]): number {
    return transactions
      .filter(tx => tx.type === 'reward' || tx.type === 'transfer' && tx.fromUserId === 'system')
      .reduce((sum, tx) => sum + parseFloat(tx.amount || '0'), 0);
  }

  private calculateSpendVolume(transactions: any[]): number {
    return transactions
      .filter(tx => tx.type === 'payment' || tx.type === 'purchase')
      .reduce((sum, tx) => sum + parseFloat(tx.amount || '0'), 0);
  }

  private calculateRedeemVolume(transactions: any[]): number {
    return transactions
      .filter(tx => tx.type === 'redemption' || tx.type === 'withdrawal')
      .reduce((sum, tx) => sum + parseFloat(tx.amount || '0'), 0);
  }

  private getMerchantCategory(metadata: any): SpendOption['category'] {
    if (!metadata || !metadata.category) return 'services';
    return metadata.category as SpendOption['category'];
  }
}

export const economyService = new EconomyService();
