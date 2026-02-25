import { db } from '../db';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { billingHistory, config, daos, users, contributions, daoMemberships, proposals, vaults, auditLogs, systemLogs, logs, chains } from '../../shared/schema';

// Type aliases
type BillingHistory = typeof billingHistory.$inferSelect;
type InsertBillingHistory = typeof billingHistory.$inferInsert;

export interface DaoAnalytics {
  memberCount: number;
  activeProposals: number;
  totalContributions: number;
  vaultBalance: number;
  recentActivity: Array<{ type: 'proposal' | 'contribution' | 'membership'; createdAt: Date }>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Storage module for financial, billing, and analytics operations
 * Handles: Billing history, DAO plans, fees, analytics, logging
 */
export class FinancialStorage {
  private db = db;

  /**
   * Get platform fee configuration
   * ⚠️ PERSISTENCE GAP: No detailed fee tracking or audit trail
   */
  async getPlatformFeeInfo(): Promise<{
    vaultDisbursementFee: string;
    offrampWithdrawalFee: string;
    bulkPayoutFee: string;
    stakingYieldFee: string;
    notes: string;
    currency: string;
  }> {
    const keys = [
      'vaultDisbursementFee',
      'offrampWithdrawalFee',
      'bulkPayoutFee',
      'stakingYieldFee',
      'platformFeeCurrency'
    ];
    
    const configRows = await this.db.select().from(config)
      .where(inArray(config.key, keys));
    
    const configMap: Record<string, any> = {};
    configRows.forEach(row => {
      configMap[row.key] = typeof row.value === 'string' 
        ? JSON.parse(row.value) 
        : row.value;
    });
    
    return {
      vaultDisbursementFee: configMap.vaultDisbursementFee ?? '1–2% per action',
      offrampWithdrawalFee: configMap.offrampWithdrawalFee ?? '2–3% (DAO or user)',
      bulkPayoutFee: configMap.bulkPayoutFee ?? 'Flat or % fee',
      stakingYieldFee: configMap.stakingYieldFee ?? 'Platform takes cut (opt-in)',
      notes: 'Fees are paid by the DAO/group, not individuals. All fees are abstracted into vault mechanics for simplicity.',
      currency: configMap.platformFeeCurrency ?? 'USD',
    };
  }

  /**
   * Get DAO billing history
   */
  async getDaoBillingHistory(daoId: string): Promise<any> {
    if (!daoId) throw new Error('DAO ID required');
    return await this.db.select().from(billingHistory)
      .where(eq(billingHistory.daoId, daoId))
      .orderBy(desc(billingHistory.createdAt));
  }

  /**
   * Get all billing history
   */
  async getAllDaoBillingHistory(): Promise<any> {
    if (!billingHistory) throw new Error('Billing history table not found');
    return await this.db.select().from(billingHistory)
      .orderBy(desc(billingHistory.createdAt));
  }

  /**
   * Add billing history entry
   */
  async addDaoBillingHistory(entry: any): Promise<any> {
    if (!entry.daoId || !entry.amount || !entry.type) {
      throw new Error('Billing history must have daoId, amount, and type');
    }
    entry.createdAt = new Date();
    entry.updatedAt = new Date();
    const result = await this.db.insert(billingHistory)
      .values(entry)
      .returning();
    if (!result[0]) throw new Error('Failed to add billing history');
    return result[0];
  }

  /**
   * Count billing history entries
   */
  async getBillingCount(): Promise<number> {
    const result = await this.db.select().from(billingHistory);
    return result.length;
  }

  /**
   * Get DAO statistics
   */
  async getDAOStats(): Promise<any> {
    const daosList = await this.db.select().from(daos);
    const memberships = await this.db.select().from(daoMemberships);
    const activeDaoIds = new Set(memberships.map(m => m.daoId));
    
    return {
      daoCount: daosList.length,
      memberCount: memberships.length,
      activeDaoCount: activeDaoIds.size
    };
  }

  /**
   * Get comprehensive DAO analytics
   * ⚠️ PERSISTENCE GAP: No historical snapshots or trend tracking
   */
  async getDaoAnalytics(daoId: string): Promise<DaoAnalytics> {
    if (!daoId) throw new Error('DAO ID required');

    const [dao, members, allProposals, allContributions, allVaults] = await Promise.all([
      this.db.select().from(daos).where(eq(daos.id, daoId)),
      this.db.select().from(daoMemberships)
        .where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.status, 'approved'))),
      this.db.select().from(proposals),
      this.db.select().from(contributions),
      this.db.select().from(vaults),
    ]);

    const activeProposals = allProposals.filter(
      (p: any) => p.daoId === daoId && p.status === 'active'
    );
    
    const daoContributions = allContributions.filter(
      (c: any) => c.daoId === daoId
    );

    const recentActivity = [
      ...activeProposals.map((p: any) => ({ type: 'proposal' as const, createdAt: p.createdAt })),
      ...daoContributions.map((c: any) => ({ type: 'contribution' as const, createdAt: c.createdAt })),
      ...members.map((m: any) => ({ type: 'membership' as const, createdAt: m.createdAt })),
    ].sort((a: any, b: any) =>
      b.createdAt.getTime() - a.createdAt.getTime()
    ).slice(0, 10);

    const daoVaults = allVaults.filter((v: any) => v.daoId === daoId);
    const vaultBalance = daoVaults.reduce((sum: number, v: any) => 
      sum + (typeof v.balance === 'string' ? parseFloat(v.balance) || 0 : v.balance || 0), 0
    );

    return {
      memberCount: members.length,
      activeProposals: activeProposals.length,
      totalContributions: daoContributions.length,
      vaultBalance,
      recentActivity,
      createdAt: dao[0]?.createdAt || new Date(),
      updatedAt: dao[0]?.updatedAt || new Date(),
    };
  }

  /**
   * Get top contributing members
   */
  async getTopMembers({ limit = 10 }: { limit?: number } = {}): Promise<{ userId: string; count: number }[]> {
    const allContributions = await this.db.select().from(contributions);
    const counts: Record<string, number> = {};
    
    allContributions.forEach(c => {
      if (c.userId) counts[c.userId] = (counts[c.userId] || 0) + 1;
    });
    
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([userId, count]) => ({ userId, count }));
  }

  /**
   * Get admin user list
   */
  async getAllUsers({ limit = 10, offset = 0 }: { limit?: number; offset?: number } = {}): Promise<any[]> {
    return await this.db.select().from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Count total users
   */
  async getUserCount(): Promise<number> {
    const result = await this.db.select({ count: sql`count(*)` }).from(users);
    return Number(result[0]?.count) || 0;
  }

  /**
   * Create an audit log entry
   */
  async createAuditLog(entry: any): Promise<any> {
    const result = await this.db.insert(auditLogs).values({
      timestamp: entry.timestamp || new Date(),
      userId: entry.userId,
      userEmail: entry.userEmail,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      method: entry.method,
      endpoint: entry.endpoint,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      status: entry.status,
      details: entry.details,
      severity: entry.severity,
      category: entry.category,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }

  /**
   * Get audit logs with optional filtering
   */
  async getAuditLogs(
    { limit = 50, offset = 0, userId, severity }: 
    { limit?: number; offset?: number; userId?: string; severity?: string } = {}
  ): Promise<any[]> {
    let whereClause = undefined;
    
    if (userId && severity) {
      whereClause = and(eq(auditLogs.userId, userId), eq(auditLogs.severity, severity));
    } else if (userId) {
      whereClause = eq(auditLogs.userId, userId);
    } else if (severity) {
      whereClause = eq(auditLogs.severity, severity);
    }
    
    let query;
    if (whereClause) {
      query = this.db.select().from(auditLogs).where(whereClause);
    } else {
      query = this.db.select().from(auditLogs);
    }
    
    return await query
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Create a system log entry
   */
  async createSystemLog(
    level: string, 
    message: string, 
    service: string = 'api', 
    metadata?: any
  ): Promise<any> {
    const result = await this.db.insert(systemLogs).values({
      level,
      message,
      service,
      metadata,
      timestamp: new Date(),
    }).returning();
    return result[0];
  }

  /**
   * Get system logs with optional filtering
   */
  async getSystemLogs(
    args: { limit?: number; offset?: number; level?: string; service?: string } = {}
  ): Promise<any[]> {
    let whereClause = undefined;
    
    if (args.level && args.service) {
      whereClause = and(eq(systemLogs.level, args.level), eq(systemLogs.service, args.service));
    } else if (args.level) {
      whereClause = eq(systemLogs.level, args.level);
    } else if (args.service) {
      whereClause = eq(systemLogs.service, args.service);
    }
    
    let query;
    if (whereClause) {
      query = this.db.select().from(systemLogs).where(whereClause);
    } else {
      query = this.db.select().from(systemLogs);
    }
    
    return await query
      .orderBy(desc(systemLogs.timestamp))
      .limit(args.limit ?? 50)
      .offset(args.offset ?? 0);
  }

  /**
   * Get log count
   */
  async getLogCount(): Promise<number> {
    const result = await this.db.select().from(logs);
    return result.length;
  }

  /**
   * Get blockchain chain info
   */
  async getChainInfo(): Promise<{ chainId: number; name: string; rpcUrl: string }> {
    const result = await this.db.select().from(chains)
      .where(eq(chains.id, 1));
    if (!result[0]) throw new Error('Chain not found');
    return {
      chainId: result[0].id,
      name: result[0].name,
      rpcUrl: result[0].rpcUrl
    };
  }
}

// Export singleton instance
export const financialStorage = new FinancialStorage();
