// --- User Profile & Settings ---
// Add these methods to the main DatabaseStorage class below:
import { db } from './db';
import { eq, inArray, or, and, desc, sql } from 'drizzle-orm';
import { users, daos, daoMemberships, votes, contributions, vaults, budgetPlans, billingHistory, tasks, proposals, walletTransactions, config, logs, sessions, chains, notifications, taskHistory, proposalComments, proposalLikes, commentLikes, daoMessages, notificationPreferences, auditLogs, systemLogs, notificationHistory } from '../shared/schema';


// Deduct a fee from a vault's balance
export async function deductVaultFee(vaultId: string, fee: number): Promise<boolean> {
  // Fetch the vault
  const [vault] = await db.select().from(vaults).where(eq(vaults.id, vaultId));
  if (!vault || vault.balance == null) return false;
  const currentBalance = typeof vault.balance === 'string' ? parseFloat(vault.balance) : vault.balance;
  if (isNaN(currentBalance) || currentBalance < fee) return false;
  // Deduct the fee
  const newBalance = (currentBalance - fee).toString();
  await db.update(vaults)
    .set({ balance: newBalance, updatedAt: new Date() })
    .where(eq(vaults.id, vaultId));
  return true;
}

// Utility to check if a DAO is premium
export function isDaoPremium(dao: Dao): boolean {
  if (!dao || !dao.plan) return false;
  // Assuming 'plan' is a string field that can be 'free', 'premium',
  return dao.plan === 'premium';
}


// Drizzle type aliases
type Dao = typeof daos.$inferSelect;
type DaoMembership = typeof daoMemberships.$inferSelect;
type User = typeof users.$inferSelect;
type Vote = typeof votes.$inferSelect;
type Contribution = typeof contributions.$inferSelect;
type Vault = typeof vaults.$inferSelect;
type BudgetPlan = typeof budgetPlans.$inferSelect;
type BillingHistory = typeof billingHistory.$inferSelect;
type InsertBillingHistory = typeof billingHistory.$inferInsert;
type Task = typeof tasks.$inferSelect;
type InsertTask = typeof tasks.$inferInsert;
type Proposal = typeof proposals.$inferSelect;
type InsertProposal = typeof proposals.$inferInsert;
type InsertVote = typeof votes.$inferInsert;
type InsertContribution = typeof contributions.$inferInsert;
type InsertVault = typeof vaults.$inferInsert;
type InsertBudgetPlan = typeof budgetPlans.$inferInsert;
type UpsertUser = typeof users.$inferInsert;
type ProposalComment = typeof proposalComments.$inferSelect;
type InsertProposalComment = typeof proposalComments.$inferInsert;
type ProposalLike = typeof proposalLikes.$inferSelect;
type InsertProposalLike = typeof proposalLikes.$inferInsert;
type CommentLike = typeof commentLikes.$inferSelect;
type InsertCommentLike = typeof commentLikes.$inferInsert;
type DaoMessage = typeof daoMessages.$inferSelect;
type InsertDaoMessage = typeof daoMessages.$inferInsert;

// Wallet transaction input type
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
export type InsertWalletTransaction = typeof walletTransactions.$inferInsert;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export interface IStorage {
  getUserByEmail(email: string): Promise<any>;
  getUserByPhone(phone: string): Promise<any>;
  createWalletTransaction(data: WalletTransactionInput): Promise<any>;
  setDaoInviteCode(daoId: string, code: string): Promise<any>;
  getDaoByInviteCode(code: string): Promise<any>;
  getUserReferralStats(userId: string): Promise<any>;
  getReferralLeaderboard(limit?: number): Promise<any>;
  getUser(userId: string): Promise<any>;
  getDAOStats(): Promise<any>;
  getProposals(): Promise<any>;
  getProposal(id: string): Promise<any>;
  createProposal(proposal: any): Promise<any>;
  updateProposalVotes(proposalId: string, voteType: string): Promise<any>;
  getVote(proposalId: string, userId: string): Promise<any>;
  createVote(vote: any): Promise<any>;
  getVotesByProposal(proposalId: string): Promise<any>;
  getContributions(userId?: string, daoId?: string): Promise<any>;
  createContribution(contribution: any): Promise<any>;
  getUserContributionStats(userId: string): Promise<any>;
  getUserVaults(userId: string): Promise<any>;
  upsertVault(vault: any): Promise<any>;
  getUserBudgetPlans(userId: string, month: string): Promise<any>;
  upsertBudgetPlan(plan: any): Promise<any>;
  getTasks(): Promise<any>;
  createTask(task: any): Promise<any>;
  claimTask(taskId: string, userId: string): Promise<any>;
  getDao(daoId: string): Promise<any>;
  getDaoMembership(daoId: string, userId: string): Promise<any>;
  createDaoMembership(args: any): Promise<any>;
  getDaoMembershipsByStatus(daoId: string, status: any): Promise<any>;
  updateDaoMembershipStatus(membershipId: string, status: any): Promise<any>;
  getDaoPlan(daoId: string): Promise<any>;
  setDaoPlan(daoId: string, plan: string, planExpiresAt: Date | null): Promise<any>;
  getDaoBillingHistory(daoId: string): Promise<any>;
  addDaoBillingHistory(entry: any): Promise<any>;
  getVotesByUserAndDao(userId: string, daoId: string): Promise<any>;
  hasActiveContributions(userId: string, daoId: string): Promise<boolean>;
  // Notification functions
  getUserNotifications(userId: string, read?: boolean, limit?: number, offset?: number, type?: string): Promise<any[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  createNotification(data: any): Promise<any>;
  createBulkNotifications(userIds: string[], notificationData: any): Promise<any[]>;
  markNotificationAsRead(notificationId: string, userId: string): Promise<any>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  deleteNotification(notificationId: string, userId: string): Promise<boolean>;
  getUserNotificationPreferences(userId: string): Promise<any>;
  updateUserNotificationPreferences(userId: string, updates: any): Promise<any>;
  getAllActiveUsers(): Promise<any[]>;
  // Audit logging operations
  createAuditLog(entry: any): Promise<any>;
  getAuditLogs(args: { limit?: number; offset?: number; userId?: string; severity?: string }): Promise<any[]>;
  // System logging operations
  createSystemLog(level: string, message: string, service?: string, metadata?: any): Promise<any>;
  getSystemLogs(args?: { limit?: number; offset?: number; level?: string; service?: string }): Promise<any[]>;
  // Notification history operations
  createNotificationHistory(userId: string, type: string, title: string, message: string, metadata?: any): Promise<any>;
  getUserNotificationHistory(userId: string, args: { limit?: number; offset?: number }): Promise<any[]>;
  markNotificationAsRead(notificationId: string, userId: string): Promise<any>;
}

export interface DaoAnalytics {
  memberCount: number;
  activeProposals: number;
  totalContributions: number;
  vaultBalance: number;
  recentActivity: Array<{ type: 'proposal' | 'contribution' | 'membership'; createdAt: Date }>;
  createdAt: Date;
  updatedAt: Date;
}

export class DatabaseStorage implements IStorage {
  private db = db; // Make db instance available within the class

  async incrementDaoMemberCount(daoId: string): Promise<any> {
    if (!daoId) throw new Error('DAO ID required');
    const dao = await this.db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao[0]) throw new Error('DAO not found');
    const newCount = (dao[0].memberCount || 0) + 1;
    const result = await this.db.update(daos)
      .set({ memberCount: newCount, updatedAt: new Date() })
      .where(eq(daos.id, daoId))
      .returning();
    return result[0];
  }
  // --- Admin Functions ---
  async getAllDaos({ limit = 10, offset = 0 }: { limit?: number; offset?: number } = {}): Promise<Dao[]> {
    return await this.db.select().from(daos).orderBy(desc(daos.createdAt)).limit(limit).offset(offset);

  }

  async getDaoCount(): Promise<number> {
  // Efficient count using Drizzle
  const result = await this.db.select({ count: sql`count(*)` }).from(daos);
  return Number(result[0]?.count) || 0;
  }

  async getAllUsers({ limit = 10, offset = 0 }: { limit?: number; offset?: number } = {}): Promise<User[]> {
    return await this.db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
  }

  async getUserCount(): Promise<number> {
  const result = await this.db.select({ count: sql`count(*)` }).from(users);
  return Number(result[0]?.count) || 0;
  }

  async getPlatformFeeInfo(): Promise<{
    vaultDisbursementFee: string;
    offrampWithdrawalFee: string;
    bulkPayoutFee: string;
    stakingYieldFee: string;
    notes: string;
    currency: string;
  }> {
    // Try to fetch config values for each fee type
    const keys = [
      'vaultDisbursementFee',
      'offrampWithdrawalFee',
      'bulkPayoutFee',
      'stakingYieldFee',
      'platformFeeCurrency'
    ];
    const configRows = await this.db.select().from(config).where(inArray(config.key, keys));
    const configMap: Record<string, any> = {};
    configRows.forEach(row => {
      configMap[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
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

  async getSystemLogs(args: { limit?: number; offset?: number; level?: string; service?: string } = {}): Promise<any[]> {
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
    return await query.orderBy(desc(systemLogs.timestamp)).limit(args.limit ?? 50).offset(args.offset ?? 0);
  }

  async updateTask(id: string, data: any, userId: string): Promise<Task> {
    const task = await this.db.select().from(tasks).where(eq(tasks.id, id));
    if (!task[0]) throw new Error('Task not found');
    const membership = await this.getDaoMembership(task[0].daoId, userId);
    if (!membership || membership.role !== 'admin') throw new Error('Only DAO admins can update tasks');
    const result = await this.db.update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    if (!result[0]) throw new Error('Failed to update task');
    return result[0];
  }

  async getTaskCount(daoId: string, status?: string): Promise<number> {
     if (!daoId) throw new Error('DAO ID required');
     let whereClause;
     if (status) {
       whereClause = and(eq(tasks.daoId, daoId), eq(tasks.status, status));
     } else {
       whereClause = eq(tasks.daoId, daoId);
     }
     const result = await this.db.select().from(tasks).where(whereClause);
     return result.length;
}

  async getLogCount(): Promise<number> {
    const result = await this.db.select().from(logs);
    return result.length;
  }


  async getBillingCount(): Promise<number> {
    const result = await this.db.select().from(billingHistory);
    return result.length;
  }

  async getChainInfo(): Promise<{ chainId: number; name: string; rpcUrl: string }> {
    const result = await this.db.select().from(chains).where(eq(chains.id, 1));
    if (!result[0]) throw new Error('Chain not found');
    return {
      chainId: result[0].id,
      name: result[0].name,
      rpcUrl: result[0].rpcUrl
    };
  }


  async getTopMembers({ limit = 10 }: { limit?: number } = {}): Promise<{ userId: string; count: number }[]> {
    // Top members by contribution count
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
  async createUser(userData: any): Promise<any> {
    // Accept only allowed fields for user creation
    const allowed: any = (({ firstName, lastName, email, phone, googleId, telegramId }) => ({ firstName, lastName, email, phone, googleId, telegramId }))(userData);
    allowed.createdAt = new Date();
    allowed.updatedAt = new Date();
    const result = await this.db.insert(users).values(allowed).returning();
    if (!result[0]) throw new Error('Failed to create user');
    return result[0];
  }

  async loginUser(email: string): Promise<any> {
    // For OAuth, just fetch user by email
    return this.getUserByEmail(email);
  }
  async getUserByEmail(email: string): Promise<any> {
    if (!email) throw new Error('Email required');
    const result = await this.db.select().from(users).where(eq(users.email, email));
    if (!result[0]) throw new Error('User not found');
    return result[0];
  }
  async getUserByPhone(phone: string): Promise<any> {
    if (!phone) throw new Error('Phone required');
    const result = await this.db.select().from(users).where(eq(users.phone, phone));
    if (!result[0]) throw new Error('User not found');
    return result[0];
  }
  async getUserById(userId: string): Promise<any> {
    if (!userId) throw new Error('User ID required');
    const result = await this.db.select().from(users).where(eq(users.id, userId));
    if (!result[0]) throw new Error('User not found');
    return result[0];
  }
  async getUserByEmailOrPhone(emailOrPhone: string): Promise<any> {
    if (!emailOrPhone) throw new Error('Email or phone required');
    const result = await this.db.select().from(users).where(
      or(eq(users.email, emailOrPhone), eq(users.phone, emailOrPhone))
    );
    if (!result[0]) throw new Error('User not found');
    return result[0];
  }

  async getUserProfile(userId: string): Promise<any> {
    return this.getUser(userId);
  }
  async updateUserProfile(userId: string, data: any): Promise<any> {
    // Only allow certain fields
    const allowed = (({ firstName, lastName, email, phone }) => ({ firstName, lastName, email, phone }))(data);
    (allowed as any).updatedAt = new Date();
    const result = await this.db.update(users).set(allowed).where(eq(users.id, userId)).returning();
    if (!result[0]) throw new Error('Failed to update user');
    return result[0];
  }
  async getUserSocialLinks(userId: string): Promise<any> {
    const user = await this.getUser(userId);
    return { google: user.googleId || null, telegram: user.telegramId || null };
  }
  async updateUserSocialLinks(userId: string, data: any): Promise<any> {
    // Accept only fields that exist in your schema, e.g. phone, email, etc.
    const allowed = (({ phone, email }) => ({ phone, email }))(data);
    (allowed as any).updatedAt = new Date();
    const result = await this.db.update(users).set(allowed).where(eq(users.id, userId)).returning();
    if (!result[0]) throw new Error('Failed to update social links');
    return result[0];
  }
  async getUserWallet(userId: string): Promise<any> {
    // Example: return phone or email as wallet identifier
    const user = await this.getUser(userId);
    return { address: user.phone || user.email || null };
  }
  async updateUserWallet(userId: string, data: any): Promise<any> {
    // Accept only fields that exist in your schema, e.g. phone, email, etc.
    const allowed = (({ phone, email }) => ({ phone, email }))(data);
    (allowed as any).updatedAt = new Date();
    const result = await this.db.update(users).set(allowed).where(eq(users.id, userId)).returning();
    if (!result[0]) throw new Error('Failed to update wallet');
    return result[0];
  }
  async getUserSettings(userId: string): Promise<any> {
    const user = await this.getUser(userId);
    return { theme: user.darkMode ? 'dark' : 'light', language: user.language || 'en' };
  }
  async updateUserSettings(userId: string, data: any): Promise<any> {
    // Accept darkMode, language
    const allowed: any = {};
    if (data.theme) allowed.darkMode = data.theme === 'dark';
    if (data.language) allowed.language = data.language;
    allowed.updatedAt = new Date();
    const result = await this.db.update(users).set(allowed).where(eq(users.id, userId)).returning();
    if (!result[0]) throw new Error('Failed to update settings');
    return result[0];
  }
  async getUserSessions(userId: string): Promise<any[]> {
    // Implement real session storage next
    const result = await this.db.select().from(sessions).where(eq(sessions.userId, userId));
    return result;
  }
  async revokeUserSession(userId: string, sessionId: string): Promise<void> {
    // Implement real session revocation
    if (!userId || !sessionId) throw new Error('User ID and session ID required');
    const result = await this.db.delete(sessions).where(
      and(eq(sessions.userId, userId), eq(sessions.id, sessionId))
    );
    if (!result) throw new Error('Session not found or already revoked');
  }
  async deleteUserAccount(userId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, userId));
  }
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
    const result = await this.db.insert(walletTransactions).values(data as any).returning();
    if (!result[0]) throw new Error('Failed to create wallet transaction');
    return result[0];
  }
// Export a singleton instance for use in other modules
async getBudgetPlanCount(userId: string, month: string): Promise<number> {
    if (!userId || !month) throw new Error('User ID and month required');
    const result = await this.db.select({ count: sql`count(*)` }).from(budgetPlans)
      .where(and(eq(budgetPlans.userId, userId), eq(budgetPlans.month, month)));
    return Number(result[0]?.count) || 0;
  }

  async createDao(dao: any): Promise<Dao> {
    if (!dao.name || !dao.creatorId) throw new Error('Name and creatorId required');
     dao.createdAt = new Date();
     dao.updatedAt = new Date();
     dao.memberCount = 1; // Creator is the first member
     const result = await this.db.insert(daos).values(dao).returning();
     if (!result[0]) throw new Error('Failed to create DAO');
     await this.createDaoMembership({ daoId: result[0].id, userId: dao.creatorId, status: 'approved', role: 'admin' });
     return result[0];
   }

  async setDaoInviteCode(daoId: string, code: string): Promise<any> {
    if (!code) throw new Error('Invite code required');
    const result = await this.db.update(daos)
      .set({ inviteCode: code, updatedAt: new Date() })
      .where(eq(daos.id, daoId))
      .returning();
    if (!result[0]) throw new Error('DAO not found');
    return result[0];
  }

  async getDaoByInviteCode(code: string): Promise<any> {
    if (!code) throw new Error('Invite code required');
    const result = await this.db.select().from(daos).where(eq(daos.inviteCode, code));
    if (!result[0]) throw new Error('DAO not found');
    return result[0];
  }

  async getUserReferralStats(userId: string): Promise<any> {
    if (!userId) throw new Error('User ID required');
    const referred = await this.db.select().from(users).where(eq(users.referredBy, userId));
    return {
      userId,
      referredCount: referred.length,
      referredUsers: referred.map(u => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email }))
    };
  }

  async getReferralLeaderboard(limit = 10): Promise<any> {
    // Aggregate referrals and join user info
    const allUsers = await this.db.select().from(users);
    const counts: Record<string, { count: number, user: any }> = {};
    allUsers.forEach(u => {
      if (u.referredBy) {
        if (!counts[u.referredBy]) {
          const refUser = allUsers.find(x => x.id === u.referredBy);
          counts[u.referredBy] = { count: 0, user: refUser };
        }
        counts[u.referredBy].count++;
      }
    });
    const leaderboard = Object.entries(counts)
      .map(([userId, { count, user }]) => ({ userId, count, user }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
    return leaderboard;
  }

  async getUser(userId: string): Promise<any> {
    if (!userId) throw new Error('User ID required');
    const result = await this.db.select().from(users).where(eq(users.id, userId));
    if (!result[0]) throw new Error('User not found');
    return result[0];
  }

  async getDAOStats(): Promise<any> {
    // Return count of DAOs, members, and active DAOs (with at least 1 member)
    const daosList = await this.db.select().from(daos);
    const memberships = await this.db.select().from(daoMemberships);
    const activeDaoIds = new Set(memberships.map(m => m.daoId));
    return {
      daoCount: daosList.length,
      memberCount: memberships.length,
      activeDaoCount: activeDaoIds.size
    };
  }

  async getProposals(): Promise<any> {
    // Return proposals sorted by createdAt desc
    // Drizzle: use desc() for descending order
    return await this.db.select().from(proposals).orderBy(desc(proposals.createdAt));
  }

  async getProposal(id: string): Promise<any> {
    if (!id) throw new Error('Proposal ID required');
    const result = await this.db.select().from(proposals).where(eq(proposals.id, id));
    if (!result[0]) throw new Error('Proposal not found');
    return result[0];
  }

  async createProposal(proposal: any): Promise<any> {
    if (!proposal.title || !proposal.daoId) throw new Error('Proposal must have title and daoId');
    proposal.createdAt = new Date();
    proposal.updatedAt = new Date();
    const result = await this.db.insert(proposals).values(proposal).returning();
    if (!result[0]) throw new Error('Failed to create proposal');
    return result[0];
  }

  async updateProposal(id: string, data: any, userId: string): Promise<Proposal> {
    if (!id || !data.title) throw new Error('Proposal ID and title required');
    const proposal = await this.getProposal(id);
    if (proposal.userId !== userId) throw new Error('Only proposal creator can update');
    const result = await this.db.update(proposals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(proposals.id, id))
      .returning();
    if (!result[0]) throw new Error('Failed to update proposal');
    return result[0];
  }

  async deleteProposal(id: string, userId: string): Promise<void> {
    const proposal = await this.getProposal(id);
    const membership = await this.getDaoMembership(proposal.daoId, userId);
    if (proposal.userId !== userId && (!membership || membership.role !== 'admin')) {
      throw new Error('Only proposal creator or DAO admin can delete');
    }
    await this.db.delete(proposals).where(eq(proposals.id, id));
}

  async updateProposalVotes(proposalId: string, voteType: string): Promise<any> {
    // Transactionally increment vote count
    const proposal = await this.getProposal(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    const field = voteType === 'yes' ? 'yesVotes' : 'noVotes';
    const update: any = { updatedAt: new Date() };
    update[field] = (proposal[field] || 0) + 1;
    const result = await this.db.update(proposals)
      .set(update)
      .where(eq(proposals.id, proposalId))
      .returning();
    if (!result[0]) throw new Error('Failed to update proposal votes');
    return result[0];
  }

  async getVote(proposalId: string, userId: string): Promise<any> {
    if (!proposalId || !userId) throw new Error('Proposal ID and User ID required');
    const result = await this.db.select().from(votes)
      .where(and(eq(votes.proposalId, proposalId), eq(votes.userId, userId)));
    if (!result[0]) throw new Error('Vote not found');
    return result[0];
  }

  async createVote(vote: any): Promise<any> {
    if (!vote.proposalId || !vote.userId) throw new Error('Vote must have proposalId and userId');
    vote.createdAt = new Date();
    vote.updatedAt = new Date();
    const result = await this.db.insert(votes).values(vote).returning();
    if (!result[0]) throw new Error('Failed to create vote');
    return result[0];
  }

  async getVotesByProposal(proposalId: string): Promise<any> {
    if (!proposalId) throw new Error('Proposal ID required');
    return await this.db.select().from(votes).where(eq(votes.proposalId, proposalId));
  }

  async getContributions(userId?: string, daoId?: string): Promise<any> {
    let whereClause = undefined;
    if (userId && daoId) {
      return await this.db.select().from(contributions)
        .where(and(eq(contributions.userId, userId), eq(contributions.daoId, daoId)))
        .orderBy(desc(contributions.createdAt));
    } else if (userId) {
      return await this.db.select().from(contributions)
        .where(eq(contributions.userId, userId))
        .orderBy(desc(contributions.createdAt));
    } else if (daoId) {
      return await this.db.select().from(contributions)
        .where(eq(contributions.daoId, daoId))
        .orderBy(desc(contributions.createdAt));
    } else {
      return await this.db.select().from(contributions).orderBy(desc(contributions.createdAt));
    }
  }

  async getContributionsCount(userId: string, daoId: string): Promise<number> {
    if (!userId || !daoId) throw new Error('User ID and DAO ID required');
    const result = await this.db.select().from(contributions)
      .where(and(eq(contributions.userId, userId), eq(contributions.daoId, daoId)));
    return result.length;
  }
  async getVotesCount(daoId: string, proposalId: string): Promise<number> {
    if (!proposalId || !daoId) throw new Error('User ID and DAO ID required');
    const result = await this.db.select().from(votes)
      .where(and(eq(votes.userId, proposalId), eq(votes.daoId, daoId)));
    return result.length;
  }


  async getVotesByUserAndDao(userId: string, daoId: string): Promise<any> {
    if (!userId || !daoId) throw new Error('User ID and DAO ID required');
    // Now that votes has daoId, filter directly
    return await this.db.select().from(votes)
      .where(and(eq(votes.userId, userId), eq(votes.daoId, daoId)));
  }

  async createContribution(contribution: any): Promise<any> {
    if (!contribution.userId || !contribution.daoId) throw new Error('Contribution must have userId and daoId');
    contribution.createdAt = new Date();
    contribution.updatedAt = new Date();
    const result = await this.db.insert(contributions).values(contribution).returning();
    if (!result[0]) throw new Error('Failed to create contribution');
    return result[0];
  }

  async getUserContributionStats(userId: string): Promise<any> {
    if (!userId) throw new Error('User ID required');
    const all = await this.db.select().from(contributions).where(eq(contributions.userId, userId));
    const byDao: Record<string, number> = {};
    all.forEach(c => {
      const daoId = c.daoId;
      if (daoId) byDao[daoId] = (byDao[daoId] || 0) + 1;
    });
    return { userId, total: all.length, byDao };
  }

  async getUserVaults(userId: string): Promise<any> {
    if (!userId) throw new Error('User ID required');
    return await this.db.select().from(vaults).where(eq(vaults.userId, userId));
  }

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

  async getVaultTransactions(vaultId: string, limit = 10, offset = 0): Promise<any[]> {
    if (!vaultId) throw new Error('Vault ID required');
    return await this.db.select().from(walletTransactions)
      .where(eq(walletTransactions.vaultId, vaultId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(limit)
      .offset(offset);
}

  async getUserBudgetPlans(userId: string, month: string): Promise<any> {
    if (!userId || !month) throw new Error('User ID and month required');
    return await this.db.select().from(budgetPlans)
      .where(and(eq(budgetPlans.userId, userId), eq(budgetPlans.month, month)));
  }

  async upsertBudgetPlan(plan: any): Promise<any> {
    if (!plan.id) throw new Error('Budget plan must have id');
    plan.updatedAt = new Date();
    const updated = await this.db.update(budgetPlans)
      .set(plan)
      .where(eq(budgetPlans.id, plan.id))
      .returning();
    if (updated[0]) return updated[0];
    plan.createdAt = new Date();
    const inserted = await this.db.insert(budgetPlans).values(plan).returning();
    if (!inserted[0]) throw new Error('Failed to upsert budget plan');
    return inserted[0];
  }
  async updateDaoInviteCode(daoId: string, code: string): Promise<any> {
    if (!daoId || !code) throw new Error('DAO ID and code required');
    const result = await this.db.update(daos)
      .set({ inviteCode: code, updatedAt: new Date() })
      .where(eq(daos.id, daoId))
      .returning();
    if (!result[0]) throw new Error('Failed to update invite code');
    return result[0];
  }

  async getTasks(daoId?: string, status?: string): Promise<any> {
      let whereClause;
      if (daoId && status) {
        whereClause = and(eq(tasks.daoId, daoId), eq(tasks.status, status));
      } else if (daoId) {
        whereClause = eq(tasks.daoId, daoId);
      } else if (status) {
        whereClause = eq(tasks.status, status);
      }
      if (whereClause) {
        return await this.db.select().from(tasks).where(whereClause).orderBy(desc(tasks.createdAt));
      }
      return await this.db.select().from(tasks).orderBy(desc(tasks.createdAt));
    }

  async createTask(task: any): Promise<any> {
    if (!task.title || !task.daoId) throw new Error('Task must have title and daoId');
    task.createdAt = new Date();
    task.updatedAt = new Date();
    const result = await this.db.insert(tasks).values(task).returning();
    if (!result[0]) throw new Error('Failed to create task');
    return result[0];
  }

  async claimTask(taskId: string, userId: string): Promise<any> {
    if (!taskId || !userId) throw new Error('Task ID and User ID required');
    // Only claim if not already claimed
    const task = await this.db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task[0]) throw new Error('Task not found');
    if (task[0].claimedBy) throw new Error('Task already claimed');
    const result = await this.db.update(tasks)
      .set({ claimedBy: userId, status: 'claimed', updatedAt: new Date() })
      .where(eq(tasks.id, taskId))
      .returning();
    if (!result[0]) throw new Error('Failed to claim task');
    return result[0];
  }

  async getDao(daoId: string): Promise<any> {
    if (!daoId) throw new Error('DAO ID required');
    const result = await this.db.select().from(daos).where(eq(daos.id, daoId));
    if (!result[0]) throw new Error('DAO not found');
    return result[0];
  }

  async getDaoMembership(daoId: string, userId: string): Promise<any> {
    if (!daoId || !userId) throw new Error('DAO ID and User ID required');
    const result = await this.db.select().from(daoMemberships)
      .where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, userId)));
    if (!result[0]) throw new Error('Membership not found');
    return result[0];
  }

  async getDaoMembers(daoId: string, userId?: string, status?: string, role?: string, limit: number = 10, offset: number = 0): Promise<any[]> {
    if (!daoId) throw new Error('DAO ID required');
    let whereClause: any = eq(daoMemberships.daoId, daoId);
    if (userId) whereClause = and(whereClause, eq(daoMemberships.userId, userId));
    if (status) whereClause = and(whereClause, eq(daoMemberships.status, status));
    if (role) whereClause = and(whereClause, eq(daoMemberships.role, role));

    return await this.db.select().from(daoMemberships)
      .where(whereClause)
      .orderBy(desc(daoMemberships.createdAt))
      .limit(limit)
      .offset(offset);
  }


  async createDaoMembership(args: any): Promise<any> {
    if (!args.daoId || !args.userId) throw new Error('Membership must have daoId and userId');
    args.createdAt = new Date();
    args.updatedAt = new Date();
    const result = await this.db.insert(daoMemberships).values(args).returning();
    if (!result[0]) throw new Error('Failed to create membership');
    return result[0];
  }

  async getDaoMembershipsByStatus(daoId: string, status: any): Promise<any> {
    if (!daoId || !status) throw new Error('DAO ID and status required');
    return await this.db.select().from(daoMemberships)
      .where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.status, status)));
  }

  async updateDaoMembershipStatus(membershipId: string, status: any): Promise<any> {
    // Update the status of a DAO membership
    const result = await this.db.update(daoMemberships)
      .set({ status, updatedAt: new Date() })
      .where(eq(daoMemberships.id, membershipId))
      .returning();
    return result[0];
  }


  async getDaoPlan(daoId: string): Promise<any> {
    if (!daoId) throw new Error('DAO ID required');
    const result = await this.db.select().from(daos).where(eq(daos.id, daoId));
    if (!result[0]) throw new Error('DAO not found');
    return result[0].plan;
  }

  async setDaoPlan(daoId: string, plan: string, planExpiresAt: Date | null): Promise<any> {
    if (!daoId || !plan) throw new Error('DAO ID and plan required');
    const result = await this.db.update(daos)
      .set({ plan, planExpiresAt, updatedAt: new Date() })
      .where(eq(daos.id, daoId))
      .returning();
    if (!result[0]) throw new Error('Failed to set DAO plan');
    return result[0];
  }

  async getDaoBillingHistory(daoId: string): Promise<any> {
    if (!daoId) throw new Error('DAO ID required');
    return await this.db.select().from(billingHistory).where(eq(billingHistory.daoId, daoId)).orderBy(desc(billingHistory.createdAt));
  }

  async getAllDaoBillingHistory(): Promise<any> {
    // Return all billing history entries sorted by createdAt desc
    if (!billingHistory) throw new Error('Billing history table not found');
    return await this.db.select().from(billingHistory).orderBy(desc(billingHistory.createdAt));
  }

  async addDaoBillingHistory(entry: any): Promise<any> {
    if (!entry.daoId || !entry.amount || !entry.type) throw new Error('Billing history must have daoId, amount, and type');
    entry.createdAt = new Date();
    entry.updatedAt = new Date();
    const result = await this.db.insert(billingHistory).values(entry).returning();
    if (!result[0]) throw new Error('Failed to add billing history');
    return result[0];
  }

  async getDaoAnalytics(daoId: string): Promise<DaoAnalytics> {
    if (!daoId) throw new Error('DAO ID required');

    const [dao, members, proposals, contributions, vaults] = await Promise.all([
      this.getDao(daoId),
      this.getDaoMembershipsByStatus(daoId, 'approved'),
      this.getProposals().then((proposals: Proposal[]) =>
        proposals.filter((p: Proposal) => p.daoId === daoId && p.status === 'active')
      ),
      this.getContributions(undefined, daoId),
      this.getUserVaults(daoId),
    ]);

    const recentActivity = [
      ...proposals.map((p: Proposal) => ({ type: 'proposal' as const, createdAt: p.createdAt })),
      ...contributions.map((c: Contribution) => ({ type: 'contribution' as const, createdAt: c.createdAt })),
      ...members.map((m: DaoMembership) => ({ type: 'membership' as const, createdAt: m.createdAt })),
    ].sort((a: { createdAt: Date }, b: { createdAt: Date }) =>
      b.createdAt.getTime() - a.createdAt.getTime()
    ).slice(0, 10);

const vaultBalance = vaults.reduce((sum: number, v: Vault) => sum + (typeof v.balance === 'string' ? parseFloat(v.balance) || 0 : 0), 0);
    return {
      memberCount: members.length,
      activeProposals: proposals.length,
      totalContributions: contributions.length,
      vaultBalance,
      recentActivity,
      createdAt: dao.createdAt,
      updatedAt: dao.updatedAt,
    };
  }


  /**
   * Checks if a user has any active contributions or votes in a DAO.
   * Returns true if at least one exists, false otherwise.
   */
  async hasActiveContributions(userId: string, daoId: string): Promise<boolean> {
    // Example implementation: check for at least one contribution or vote
    const contributions = await this.getContributions(userId, daoId);
    if (contributions && contributions.length > 0) return true;
    if (typeof this.getVotesByUserAndDao === "function") {
      const votes = await this.getVotesByUserAndDao(userId, daoId);
      if (votes && votes.length > 0) return true;
    }
    return false;
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    if (!userId) throw new Error('User ID required');
    // Implement real session revocation logic here
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
    process.stdout.write(`Revoked all sessions for user ${userId}\n`);
  }

  async getUserNotifications(userId: string, read?: boolean, limit = 20, offset = 0, type?: string): Promise<any[]> {
    try {
      let whereClause: any = eq(notifications.userId, userId);
      if (read !== undefined) {
        whereClause = and(whereClause, eq(notifications.read, read));
      }
      if (type) {
        whereClause = and(whereClause, eq(notifications.type, type));
      }
      let query = this.db.select().from(notifications).where(whereClause);
      return await query
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      console.error('Error fetching user notifications:', error);
      return [];
    }
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    try {
      const result = await this.db.select({ count: sql`count(*)` })
        .from(notifications)
        .where(and(
          eq(notifications.userId, userId),
          eq(notifications.read, false)
        ));

      return Number(result[0]?.count) || 0;
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      return 0;
    }
  }

  async createNotification(data: any): Promise<any> {
    try {
      const [notification] = await this.db.insert(notifications).values({
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        priority: data.priority || 'medium',
        metadata: data.metadata || {},
        read: false,
      }).returning();

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  async createBulkNotifications(userIds: string[], notificationData: any): Promise<any[]> {
    try {
      const notificationsToInsert = userIds.map(userId => ({
        userId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        priority: notificationData.priority || 'medium',
        metadata: notificationData.metadata || {},
        read: false,
      }));

      return await this.db.insert(notifications).values(notificationsToInsert).returning();
    } catch (error) {
      console.error('Error creating bulk notifications:', error);
      throw error;
    }
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<any> {
    try {
      const [notification] = await this.db.update(notifications)
        .set({ read: true, updatedAt: new Date() })
        .where(and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        ))
        .returning();

      return notification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return null;
    }
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      await this.db.update(notifications)
        .set({ read: true, updatedAt: new Date() })
        .where(and(
          eq(notifications.userId, userId),
          eq(notifications.read, false)
        ));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.db.delete(notifications)
        .where(and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        ));
      // Drizzle returns number of deleted rows in result (if supported), otherwise check if result is not null
      return !!result;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }

  async getUserNotificationPreferences(userId: string): Promise<any> {
    try {
      const [preferences] = await this.db.select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId));

      if (!preferences) {
        // Create default preferences
        const [newPreferences] = await this.db.insert(notificationPreferences)
          .values({
            userId,
            emailNotifications: true,
            pushNotifications: true,
            daoUpdates: true,
            proposalUpdates: true,
            taskUpdates: true,
          })
          .returning();

        return newPreferences;
      }

      return preferences;
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      throw error;
    }
  }

  async updateUserNotificationPreferences(userId: string, updates: any): Promise<any> {
    try {
      const [preferences] = await this.db.update(notificationPreferences)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(notificationPreferences.userId, userId))
        .returning();

      return preferences;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  async getAllActiveUsers(): Promise<any[]> {
    try {
      return await this.db.select({ id: users.id })
        .from(users)
        .where(eq(users.isBanned, false));
    } catch (error) {
      console.error('Error fetching active users:', error);
      return [];
    }
  }

  // Audit logging operations
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

  async getAuditLogs({ limit = 50, offset = 0, userId, severity }: { limit?: number; offset?: number; userId?: string; severity?: string } = {}): Promise<any[]> {
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
    return await query.orderBy(desc(auditLogs.timestamp)).limit(limit).offset(offset);
  }

  // System logging operations
  async createSystemLog(level: string, message: string, service: string = 'api', metadata?: any): Promise<any> {
    const result = await this.db.insert(systemLogs).values({
      level,
      message,
      service,
      metadata,
      timestamp: new Date(),
    }).returning();
    return result[0];
  }


  // Notification history operations
  async createNotificationHistory(userId: string, type: string, title: string, message: string, metadata?: any): Promise<any> {
    const result = await this.db.insert(notificationHistory).values({
      userId,
      type,
      title,
      message,
      metadata,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }

  async getUserNotificationHistory(userId: string, { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {}): Promise<any[]> {
    return await this.db.select()
      .from(notificationHistory)
      .where(eq(notificationHistory.userId, userId))
      .orderBy(desc(notificationHistory.createdAt))
      .limit(limit)
      .offset(offset);
  }

}

// Export a singleton instance for use in other modules
export const storage = new DatabaseStorage();
export const getAllDaos = (args?: { limit?: number; offset?: number }) => storage.getAllDaos(args);
export const getDaoCount = () => storage.getDaoCount();
export const getAllUsers = (args?: { limit?: number; offset?: number }) => storage.getAllUsers(args);
export const getUserCount = () => storage.getUserCount();
export const getPlatformFeeInfo = () => storage.getPlatformFeeInfo();
export const getSystemLogs = (args?: { limit?: number; offset?: number }) => storage.getSystemLogs(args);
export const getLogCount = () => storage.getLogCount();
export const getAllDaoBillingHistory = (args?: { limit?: number; offset?: number }) => storage.getAllDaoBillingHistory();
export const getBillingCount = () => storage.getBillingCount();
export const getChainInfo = () => storage.getChainInfo();
export const getTopMembers = (args?: { limit?: number }) => storage.getTopMembers(args);
export const createUser = (userData: any) => storage.createUser(userData);
export const loginUser = (email: string) => storage.loginUser(email);
export const getUserByEmail = (email: string) => storage.getUserByEmail(email);
export const getUserByPhone = (phone: string) => storage.getUserByPhone(phone);
export const createWalletTransaction = (data: WalletTransactionInput) => storage.createWalletTransaction(data);
export const setDaoInviteCode = (daoId: string, code: string) => storage.setDaoInviteCode(daoId, code);
export const getDaoByInviteCode = (code: string) => storage.getDaoByInviteCode(code);
export const getUserReferralStats = (userId: string) => storage.getUserReferralStats(userId);
export const getReferralLeaderboard = (limit?: number) => storage.getReferralLeaderboard(limit);
export const getUser = (userId: string) => storage.getUser(userId);
export const getDAOStats = () => storage.getDAOStats();
export const getProposals = () => storage.getProposals();
export const getProposal = (id: string) => storage.getProposal(id);
export const createProposal = (proposal:  any) => storage.createProposal(proposal);
export const updateProposalVotes = (proposalId: string, voteType: string) => storage.updateProposalVotes(proposalId, voteType);
export const getVote = (proposalId: string, userId: string) => storage.getVote(proposalId, userId);
export const createVote = (vote: any) => storage.createVote(vote);
export const getVotesByProposal = (proposalId: string) => storage.getVotesByProposal(proposalId);
export const getContributions = (userId?: string, daoId?: string) => storage.getContributions(userId, daoId);
export const createContribution = (contribution: any) => storage.createContribution(contribution);
export const getUserContributionStats = (userId: string) => storage.getUserContributionStats(userId);
export const getUserVaults = (userId: string) => storage.getUserVaults(userId);
export const upsertVault = (vault: any) => storage.upsertVault(vault);
export const getUserBudgetPlans = (userId: string, month: string) => storage.getUserBudgetPlans(userId, month);
export const upsertBudgetPlan = (plan: any) => storage.upsertBudgetPlan(plan);
export const getTasks = () => storage.getTasks();
export const createTask = (task: any) => storage.createTask(task);
export const claimTask = (taskId: string, userId: string) => storage.claimTask(taskId, userId);
export const getDao = (daoId: string) => storage.getDao(daoId);
export const getDaoMembership = (daoId: string, userId: string) => storage.getDaoMembership(daoId, userId);
export const createDaoMembership = (args: any) => storage.createDaoMembership(args);
export const getDaoMembershipsByStatus = (daoId: string, status: any) => storage.getDaoMembershipsByStatus(daoId, status    );
export const updateDaoMembershipStatus = (membershipId: string, status: any) => storage.updateDaoMembershipStatus(membershipId, status);
export const getDaoPlan = (daoId: string) => storage.getDaoPlan(daoId);
export const setDaoPlan = (daoId: string, plan: string, planExpiresAt: Date | null) => storage.setDaoPlan(daoId, plan, planExpiresAt);
export const getDaoBillingHistory = (daoId: string) => storage.getDaoBillingHistory(daoId);
export const addDaoBillingHistory = (entry: any) => storage.addDaoBillingHistory(entry);
export const hasActiveContributions = (userId: string, daoId: string) => storage.hasActiveContributions(userId, daoId);
export const revokeAllUserSessions = (userId: string) => storage.revokeAllUserSessions(userId);
export const createNotification = (notification: { userId: string; type: string; message: string; createdAt?: Date; updatedAt?: Date }) => storage.createNotification(notification);
export const getUserNotifications = (userId: string, read?: boolean, limit?: number, offset?: number, type?: string) => storage.getUserNotifications(userId, read, limit, offset, type);
// Removed getTaskHistory export (not implemented)
export const getUserProfile = (userId: string) => storage.getUserProfile(userId);
export const updateUserProfile = (userId: string, data: any) => storage.updateUserProfile(userId, data);
export const getUserSocialLinks = (userId: string) => storage.getUserSocialLinks(userId);
export const updateUserSocialLinks = (userId: string, data: any) => storage.updateUserSocialLinks(userId, data);
export const getUserWallet = (userId: string) => storage.getUserWallet(userId);
export const updateUserWallet = (userId: string, data: any) => storage.updateUserWallet(userId, data);
export const getUserSettings = (userId: string) => storage.getUserSettings(userId);
export const updateUserSettings = (userId: string, data: any) => storage.updateUserSettings(userId, data);
export const getUserSessions = (userId: string) => storage.getUserSessions(userId);
export const revokeUserSession = (userId: string, sessionId: string) => storage.revokeUserSession(userId, sessionId);
export const deleteUserAccount = (userId: string) => storage.deleteUserAccount(userId);
export const getBudgetPlanCount = (userId: string, month: string) => storage.getBudgetPlanCount(userId, month);
export const createDao = (dao: any) => storage.createDao(dao);
export const updateDaoInviteCode = (daoId: string, code: string) => storage.updateDaoInviteCode(daoId, code);
export const deleteProposal = (id: string, userId: string) => storage.deleteProposal(id, userId);
export const updateProposal = (id: string, data: any, userId: string) => storage.updateProposal(id, data, userId);
export const getVaultTransactions = (vaultId: string, limit?: number, offset?: number) => storage.getVaultTransactions(vaultId, limit, offset);
export const getDaoAnalytics = (daoId: string) => storage.getDaoAnalytics(daoId);

// --- Engagement Features Exports ---
// Removed engagement feature exports (not implemented)

// Export the storage instance for use in other modules

// --- Proposal Comments & Likes Stubs ---
// --- DAO Message Stubs ---
export async function createDaoMessage(message: any): Promise<any> {
  throw new Error('createDaoMessage not implemented');
}
export async function getDaoMessages(daoId: string): Promise<any[]> {
  throw new Error('getDaoMessages not implemented');
}
export async function updateDaoMessage(messageId: string, data: any): Promise<any> {
  throw new Error('updateDaoMessage not implemented');
}
export async function deleteDaoMessage(messageId: string): Promise<any> {
  throw new Error('deleteDaoMessage not implemented');
}
export async function createProposalComment(comment: any): Promise<any> {
  throw new Error('createProposalComment not implemented');
}
export async function getProposalComments(proposalId: string): Promise<any[]> {
  throw new Error('getProposalComments not implemented');
}
export async function updateProposalComment(commentId: string, data: any): Promise<any> {
  throw new Error('updateProposalComment not implemented');
}
export async function deleteProposalComment(commentId: string): Promise<any> {
  throw new Error('deleteProposalComment not implemented');
}
export async function toggleProposalLike(proposalId: string, userId: string): Promise<any> {
  throw new Error('toggleProposalLike not implemented');
}
export async function getProposalLikes(proposalId: string): Promise<any[]> {
  throw new Error('getProposalLikes not implemented');
}
export async function toggleCommentLike(commentId: string, userId: string): Promise<any> {
  throw new Error('toggleCommentLike not implemented');
}
export async function getCommentLikes(commentId: string): Promise<any[]> {
  throw new Error('getCommentLikes not implemented');
}

export default storage;
export { Dao, User, Vote, Contribution, Vault, BudgetPlan, BillingHistory, InsertBillingHistory, Task, InsertTask, Proposal, InsertProposal, InsertVote, InsertContribution, InsertVault, InsertBudgetPlan, UpsertUser };
export { db }; // Export the database instance for direct access if needed

