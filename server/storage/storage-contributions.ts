import { db } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { contributions, vaults, walletTransactions, vaultBalanceHistory, budgetDetails } from '../../shared/schema';

// Type aliases
type Contribution = typeof contributions.$inferSelect;
type Vault = typeof vaults.$inferSelect;
type InsertVault = typeof vaults.$inferInsert;
type WalletTransaction = typeof walletTransactions.$inferSelect;

/**
 * Wallet transaction input type
 */
export type WalletTransactionInput = {
  userId: string;
  amount: number;
  currency: string;
  type: 'deposit' | 'withdrawal' | 'transfer';
  status: 'pending' | 'completed' | 'failed';
  provider: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

/**
 * Storage module for contributions and vault management
 * Handles: Contributions, vaults, wallet transactions, fees
 */
export class ContributionStorage {
  private db = db;

  /**
   * Create a contribution
   * ⚠️ PERSISTENCE GAP: No contribution types (work, ideas, funding, etc.)
   * ⚠️ PERSISTENCE GAP: No contribution metadata or work proof/evidence
   */
  async createContribution(contribution: any): Promise<any> {
    if (!contribution.userId || !contribution.daoId) {
      throw new Error('Contribution must have userId and daoId');
    }
    contribution.createdAt = new Date();
    contribution.updatedAt = new Date();
    const result = await this.db.insert(contributions)
      .values(contribution)
      .returning();
    if (!result[0]) throw new Error('Failed to create contribution');
    return result[0];
  }

  /**
   * Get contributions with optional filtering by user and/or DAO
   */
  async getContributions(userId?: string, daoId?: string): Promise<any> {
    let query = this.db.select().from(contributions);
    
    if (userId && daoId) {
      query = this.db.select().from(contributions)
        .where(and(eq(contributions.userId, userId), eq(contributions.daoId, daoId)));
    } else if (userId) {
      query = this.db.select().from(contributions)
        .where(eq(contributions.userId, userId));
    } else if (daoId) {
      query = this.db.select().from(contributions)
        .where(eq(contributions.daoId, daoId));
    }
    
    return await query.orderBy(desc(contributions.createdAt));
  }

  /**
   * Count contributions for a user in a DAO
   */
  async getContributionsCount(userId: string, daoId: string): Promise<number> {
    if (!userId || !daoId) throw new Error('User ID and DAO ID required');
    const result = await this.db.select().from(contributions)
      .where(and(eq(contributions.userId, userId), eq(contributions.daoId, daoId)));
    return result.length;
  }

  /**
   * Get user contribution statistics
   */
  async getUserContributionStats(userId: string): Promise<any> {
    if (!userId) throw new Error('User ID required');
    const all = await this.db.select().from(contributions)
      .where(eq(contributions.userId, userId));
    const byDao: Record<string, number> = {};
    
    all.forEach(c => {
      const daoId = c.daoId;
      if (daoId) byDao[daoId] = (byDao[daoId] || 0) + 1;
    });
    
    return { userId, total: all.length, byDao };
  }

  /**
   * Get user's vaults
   */
  async getUserVaults(userId: string): Promise<any> {
    if (!userId) throw new Error('User ID required');
    return await this.db.select().from(vaults)
      .where(eq(vaults.userId, userId));
  }

  /**
   * Create or update a vault
   * ⚠️ PERSISTENCE GAP: No vault balance history snapshots
   */
  async upsertVault(vault: any): Promise<any> {
    if (!vault.id) throw new Error('Vault must have id');
    vault.updatedAt = new Date();
    
    const updated = await this.db.update(vaults)
      .set(vault)
      .where(eq(vaults.id, vault.id))
      .returning();
    
    if (updated[0]) return updated[0];
    
    vault.createdAt = new Date();
    const inserted = await this.db.insert(vaults).values(vault).returning();
    if (!inserted[0]) throw new Error('Failed to upsert vault');
    return inserted[0];
  }

  /**
   * Get vault transactions
   * ⚠️ PERSISTENCE GAP: No transaction fee tracking details
   */
  async getVaultTransactions(
    vaultId: string, 
    limit = 10, 
    offset = 0
  ): Promise<any[]> {
    if (!vaultId) throw new Error('Vault ID required');
    return await this.db.select().from(walletTransactions)
      .where(eq(walletTransactions.vaultId, vaultId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Create a wallet transaction
   */
  async createWalletTransaction(data: WalletTransactionInput): Promise<any> {
    if (!data.amount || !data.currency || !data.type || !data.status || !data.provider) {
      throw new Error('Missing required wallet transaction fields');
    }
    data.createdAt = new Date();
    data.updatedAt = new Date();
    
    // Add walletAddress if missing
    if (!(data as any).walletAddress) {
      (data as any).walletAddress = '';
    }
    if (!(data as any).toUserId) {
      (data as any).toUserId = null;
    }
    
    const result = await this.db.insert(walletTransactions)
      .values(data as any)
      .returning();
    if (!result[0]) throw new Error('Failed to create wallet transaction');
    return result[0];
  }

  /**
   * Deduct a fee from a vault's balance
   * ⚠️ PERSISTENCE GAP: No fee transaction history or audit trail
   */
  async deductVaultFee(vaultId: string, fee: number): Promise<boolean> {
    const [vault] = await this.db.select().from(vaults)
      .where(eq(vaults.id, vaultId));
    
    if (!vault || vault.balance == null) return false;
    
    const currentBalance = typeof vault.balance === 'string' 
      ? parseFloat(vault.balance) 
      : vault.balance;
    
    if (isNaN(currentBalance) || currentBalance < fee) return false;
    
    const newBalance = (currentBalance - fee).toString();
    await this.db.update(vaults)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(vaults.id, vaultId));
    
    return true;
  }

  /**
   * Check if user has active contributions in a DAO
   */
  async hasActiveContributions(userId: string, daoId: string): Promise<boolean> {
    const contributions = await this.getContributions(userId, daoId);
    return contributions && contributions.length > 0;
  }

  /**
   * Record vault balance change (Gap #5: Vault balance history persistence)
   */
  async recordBalanceChange(vaultId: string, changeData: any): Promise<any> {
    if (!vaultId || !changeData.balance || !changeData.changeReason) {
      throw new Error('Vault ID, balance, and change reason required');
    }
    
    const vault = await this.db.select().from(vaults).where(eq(vaults.id, vaultId)).limit(1);
    if (!vault[0]) throw new Error('Vault not found');

    const previousBalance = typeof vault[0].balance === 'string' 
      ? parseFloat(vault[0].balance) 
      : vault[0].balance;
    
    const newBalance = typeof changeData.balance === 'string'
      ? parseFloat(changeData.balance)
      : changeData.balance;

    const changeAmount = newBalance - previousBalance;
    const changePercentage = previousBalance !== 0 
      ? ((changeAmount / previousBalance) * 100) 
      : 0;

    const result = await this.db.insert(vaultBalanceHistory).values({
      vaultId,
      balance: newBalance.toString(),
      previousBalance: previousBalance.toString(),
      changeAmount: changeAmount.toString(),
      changePercentage: changePercentage.toString(),
      changeReason: changeData.changeReason,
      transactionId: changeData.transactionId,
      userId: changeData.userId,
      notes: changeData.notes,
      tokenSymbol: changeData.tokenSymbol,
      recordedAt: new Date(),
    }).returning();
    
    return result[0];
  }

  /**
   * Get vault balance history
   */
  async getBalanceHistory(vaultId: string, options: any = {}): Promise<any[]> {
    if (!vaultId) throw new Error('Vault ID required');
    
    const { limit = 100, offset = 0 } = options;
    
    return await this.db.select().from(vaultBalanceHistory)
      .where(eq(vaultBalanceHistory.vaultId, vaultId))
      .orderBy(desc(vaultBalanceHistory.recordedAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get vault balance at specific date
   */
  async getVaultBalanceAtDate(vaultId: string, date: Date): Promise<any | null> {
    if (!vaultId || !date) throw new Error('Vault ID and date required');
    
    const result = await this.db.select().from(vaultBalanceHistory)
      .where(and(
        eq(vaultBalanceHistory.vaultId, vaultId),
        sql`"recorded_at" <= ${date}`
      ))
      .orderBy(desc(vaultBalanceHistory.recordedAt))
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * Get balance change statistics for vault
   */
  async getBalanceChangeStats(vaultId: string, timeframeInDays: number = 30): Promise<any> {
    if (!vaultId || timeframeInDays <= 0) throw new Error('Vault ID and valid timeframe required');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframeInDays);

    const records = await this.db.select().from(vaultBalanceHistory)
      .where(and(
        eq(vaultBalanceHistory.vaultId, vaultId),
        sql`"recorded_at" >= ${startDate}`
      ))
      .orderBy(desc(vaultBalanceHistory.recordedAt));

    if (records.length === 0) return null;

    const deposits = records
      .filter(r => r.changeReason === 'deposit')
      .reduce((sum, r) => sum + parseFloat(r.changeAmount || '0'), 0);

    const withdrawals = records
      .filter(r => r.changeReason === 'withdrawal')
      .reduce((sum, r) => sum + Math.abs(parseFloat(r.changeAmount || '0')), 0);

    const yields = records
      .filter(r => r.changeReason === 'yield')
      .reduce((sum, r) => sum + parseFloat(r.changeAmount || '0'), 0);

    return {
      totalDeposits: deposits,
      totalWithdrawals: withdrawals,
      totalYield: yields,
      netChange: deposits - withdrawals + yields,
      recordCount: records.length,
      timeframeInDays,
    };
  }

  /**
   * Create budget detail (Medium Gap #3: Budget detail tracking)
   */
  async createBudgetDetail(detailData: any): Promise<any> {
    if (!detailData.budgetPlanId || !detailData.userId || !detailData.category || !detailData.amount) {
      throw new Error('Budget plan ID, user ID, category, and amount required');
    }
    const result = await this.db.insert(budgetDetails).values({
      budgetPlanId: detailData.budgetPlanId,
      daoId: detailData.daoId,
      userId: detailData.userId,
      category: detailData.category,
      amount: detailData.amount.toString(),
      spent: detailData.spent ? detailData.spent.toString() : '0',
      remaining: (detailData.amount - (detailData.spent || 0)).toString(),
      description: detailData.description,
      source: detailData.source || 'manual_entry',
      tags: detailData.tags || [],
      priority: detailData.priority || 0,
      isRecurring: detailData.isRecurring || false,
      recurrencePattern: detailData.recurrencePattern,
      metadata: detailData.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  /**
   * Get budget details
   */
  async getBudgetDetails(budgetPlanId: string): Promise<any[]> {
    if (!budgetPlanId) throw new Error('Budget plan ID required');
    return await this.db.select().from(budgetDetails)
      .where(eq(budgetDetails.budgetPlanId, budgetPlanId))
      .orderBy(desc(budgetDetails.priority));
  }

  /**
   * Update budget detail spending
   */
  async updateBudgetDetailSpending(detailId: string, spentAmount: number): Promise<any> {
    if (!detailId || spentAmount == null) throw new Error('Detail ID and spent amount required');
    
    const detail = await this.db.select().from(budgetDetails)
      .where(eq(budgetDetails.id, detailId))
      .limit(1);
    
    if (!detail[0]) throw new Error('Budget detail not found');

    const budgetAmount = parseFloat(detail[0].amount?.toString() || '0');
    const remaining = budgetAmount - spentAmount;

    const result = await this.db.update(budgetDetails)
      .set({
        spent: spentAmount.toString(),
        remaining: remaining.toString(),
        updatedAt: new Date(),
      })
      .where(eq(budgetDetails.id, detailId))
      .returning();
    return result[0];
  }

  /**
   * Get budget detail analytics
   */
  async getBudgetDetailAnalytics(budgetPlanId: string): Promise<any> {
    if (!budgetPlanId) throw new Error('Budget plan ID required');
    
    const details = await this.getBudgetDetails(budgetPlanId);
    if (details.length === 0) return null;

    const totalAllocated = details.reduce((sum, d) => sum + parseFloat(d.amount || '0'), 0);
    const totalSpent = details.reduce((sum, d) => sum + parseFloat(d.spent || '0'), 0);
    const totalRemaining = details.reduce((sum, d) => sum + parseFloat(d.remaining || '0'), 0);

    return {
      totalAllocated,
      totalSpent,
      totalRemaining,
      utilizationPercentage: (totalSpent / totalAllocated) * 100,
      categoryBreakdown: details.map(d => ({
        category: d.category,
        allocated: parseFloat(d.amount || '0'),
        spent: parseFloat(d.spent || '0'),
        remaining: parseFloat(d.remaining || '0'),
      })),
      itemCount: details.length,
    };
  }

  /**
   * Get budget details by category (additional method for Medium Gap #3)
   */
  async getBudgetDetailsByCategory(budgetPlanId: string, category: string): Promise<any[]> {
    if (!budgetPlanId || !category) throw new Error('Budget plan ID and category required');
    return await this.db.select().from(budgetDetails)
      .where(and(
        eq(budgetDetails.budgetPlanId, budgetPlanId),
        eq(budgetDetails.category, category)
      ))
      .orderBy(desc(budgetDetails.priority));
  }

  /**
   * Get budget details by user (additional method for Medium Gap #3)
   */
  async getBudgetDetailsByUser(budgetPlanId: string, userId: string): Promise<any[]> {
    if (!budgetPlanId || !userId) throw new Error('Budget plan ID and user ID required');
    return await this.db.select().from(budgetDetails)
      .where(and(
        eq(budgetDetails.budgetPlanId, budgetPlanId),
        eq(budgetDetails.userId, userId)
      ))
      .orderBy(desc(budgetDetails.createdAt));
  }
}

// Export singleton instance
export const contributionStorage = new ContributionStorage();

/**
 * Utility function: Check if a DAO is premium
 */
export function isDaoPremium(dao: any): boolean {
  if (!dao || !dao.plan) return false;
  return dao.plan === 'premium';
}
