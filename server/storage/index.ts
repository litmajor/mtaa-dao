/**
 * Storage Module Index - Aggregates all storage submodules
 * Maintains backwards compatibility with legacy DatabaseStorage API
 */

import { userStorage, UserStorage } from './storage-user';
import { daoStorage, DaoStorage } from './storage-dao';
import { proposalStorage, ProposalStorage } from './storage-proposals';
import { contributionStorage, ContributionStorage, isDaoPremium, type WalletTransactionInput } from './storage-contributions';
import { taskStorage, TaskStorage } from './storage-tasks';
import { financialStorage, FinancialStorage, type DaoAnalytics } from './storage-financial';
import { lowPriorityStorage, LowPriorityStorage } from './storage-low-priority';
import { db } from '../db';

/**
 * Combined storage interface for backwards compatibility
 * Each module is responsible for its own domain
 */
export interface IStorage {
  // User methods
  getUser(userId: string): Promise<any>;
  getUserByEmail(email: string): Promise<any>;
  getUserByPhone(phone: string): Promise<any>;
  createUser(userData: any): Promise<any>;
  updateUser(userId: string, update: any): Promise<any>;
  loginUser(email: string): Promise<any>;
  getUserProfile(userId: string): Promise<any>;
  updateUserProfile(userId: string, data: any): Promise<any>;
  getUserSocialLinks(userId: string): Promise<any>;
  updateUserSocialLinks(userId: string, data: any): Promise<any>;
  getUserWallet(userId: string): Promise<any>;
  updateUserWallet(userId: string, data: any): Promise<any>;
  getUserSettings(userId: string): Promise<any>;
  updateUserSettings(userId: string, data: any): Promise<any>;
  getUserSessions(userId: string): Promise<any[]>;
  revokeUserSession(userId: string, sessionId: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<void>;
  deleteUserAccount(userId: string): Promise<void>;
  getUserReferralStats(userId: string): Promise<any>;
  getReferralLeaderboard(limit?: number): Promise<any>;
  updateUserTelegramInfo(userId: string, telegramInfo: any): Promise<any>;
  getUserTelegramInfo(userId: string): Promise<any>;
  // Medium Gap #1: Session audit logs
  createSessionAuditLog(logData: any): Promise<any>;
  getSessionAuditLogs(userId: string, options?: any): Promise<any[]>;
  getCriticalSessionEvents(userId: string, daysBack?: number): Promise<any[]>;
  // Gap #4: Wallet addresses
  addWalletAddress(userId: string, walletData: any): Promise<any>;
  getWalletAddresses(userId: string, chainId?: number): Promise<any[]>;
  setPrimaryWallet(userId: string, walletId: string, chainId: number): Promise<any>;
  verifyWalletAddress(walletId: string, signature: string): Promise<any>;
  deleteWalletAddress(walletId: string): Promise<boolean>;

  // DAO methods
  createDao(dao: any): Promise<any>;
  getDao(daoId: string): Promise<any>;
  getAllDaos(args?: { limit?: number; offset?: number }): Promise<any[]>;
  getDaoCount(): Promise<number>;
  incrementDaoMemberCount(daoId: string): Promise<any>;
  setDaoInviteCode(daoId: string, code: string): Promise<any>;
  updateDaoInviteCode(daoId: string, code: string): Promise<any>;
  getDaoByInviteCode(code: string): Promise<any>;
  createDaoMembership(args: any): Promise<any>;
  getDaoMembership(daoId: string, userId: string): Promise<any>;
  getDaoMembers(daoId: string, userId?: string, status?: string, role?: string, limit?: number, offset?: number): Promise<any[]>;
  getDaoMembershipsByStatus(daoId: string, status: any): Promise<any>;
  updateDaoMembershipStatus(membershipId: string, status: any): Promise<any>;
  getDaoPlan(daoId: string): Promise<any>;
  setDaoPlan(daoId: string, plan: string, planExpiresAt: Date | null): Promise<any>;
  // Gap #1: DAO settings
  getDaoSetting(daoId: string, settingKey: string): Promise<any>;
  getDaoSettings(daoId: string): Promise<any[]>;
  upsertDaoSetting(daoId: string, settingKey: string, settingValue: any, metadata?: any): Promise<any>;
  deleteDaoSetting(daoId: string, settingKey: string): Promise<boolean>;
  // Medium Gap #2: Referral rewards per DAO
  createDaoReferralReward(rewardData: any): Promise<any>;
  getDaoReferralRewards(daoId: string, options?: any): Promise<any[]>;
  getDaoReferralRewardsByReferrer(referrerId: string, daoId: string): Promise<any[]>;
  getDaoReferralRewardsTotal(daoId: string, referrerId: string): Promise<number>;
  updateDaoReferralRewardStatus(rewardId: string, status: string): Promise<any>;

  // Proposal methods
  createProposal(proposal: any): Promise<any>;
  getProposals(): Promise<any>;
  getProposal(id: string): Promise<any>;
  updateProposal(id: string, data: any, userId: string): Promise<any>;
  deleteProposal(id: string, userId: string): Promise<void>;
  updateProposalVotes(proposalId: string, voteType: string): Promise<any>;
  createVote(vote: any): Promise<any>;
  getVote(proposalId: string, userId: string): Promise<any>;
  getVotesByProposal(proposalId: string): Promise<any>;
  getVotesByUserAndDao(userId: string, daoId: string): Promise<any>;
  getVotesCount(daoId: string, proposalId: string): Promise<number>;
  createProposalComment(comment: any): Promise<any>;
  getProposalComments(proposalId: string, limit?: number, offset?: number): Promise<any[]>;
  updateProposalComment(commentId: string, updates: any): Promise<any>;
  deleteProposalComment(commentId: string): Promise<boolean>;
  toggleProposalLike(proposalId: string, userId: string): Promise<any>;
  getProposalLikes(proposalId: string): Promise<any[]>;
  toggleCommentLike(commentId: string, userId: string): Promise<any>;
  getCommentLikes(commentId: string): Promise<any[]>;
  // Gap #3: Proposal drafts
  saveProposalDraft(draftData: any): Promise<any>;
  getDraftProposals(daoId: string, proposerId?: string): Promise<any[]>;
  publishDraft(proposalId: string, publishData?: any): Promise<any>;
  deleteDraft(proposalId: string): Promise<boolean>;

  // Contribution methods
  createContribution(contribution: any): Promise<any>;
  getContributions(userId?: string, daoId?: string): Promise<any>;
  getContributionsCount(userId: string, daoId: string): Promise<number>;
  getUserContributionStats(userId: string): Promise<any>;
  hasActiveContributions(userId: string, daoId: string): Promise<boolean>;
  getUserVaults(userId: string): Promise<any>;
  upsertVault(vault: any): Promise<any>;
  getVaultTransactions(vaultId: string, limit?: number, offset?: number): Promise<any[]>;
  createWalletTransaction(data: WalletTransactionInput): Promise<any>;
  deductVaultFee(vaultId: string, fee: number): Promise<boolean>;
  // Gap #5: Vault balance history
  recordBalanceChange(vaultId: string, changeData: any): Promise<any>;
  getBalanceHistory(vaultId: string, options?: any): Promise<any[]>;
  getVaultBalanceAtDate(vaultId: string, date: Date): Promise<any | null>;
  getBalanceChangeStats(vaultId: string, timeframeInDays?: number): Promise<any>;
  // Medium Gap #3: Budget detail tracking
  createBudgetDetail(detailData: any): Promise<any>;
  getBudgetDetails(budgetPlanId: string): Promise<any[]>;
  updateBudgetDetailSpending(detailId: string, spentAmount: number): Promise<any>;
  getBudgetDetailsByCategory(budgetPlanId: string, category: string): Promise<any[]>;
  getBudgetDetailsByUser(budgetPlanId: string, userId: string): Promise<any[]>;

  // Task methods
  getTasks(daoId?: string, status?: string): Promise<any>;
  createTask(task: any): Promise<any>;
  updateTask(id: string, data: any, userId: string): Promise<any>;
  claimTask(taskId: string, userId: string): Promise<any>;
  getTaskCount(daoId: string, status?: string): Promise<number>;
  // Gap #2: Task attachments
  attachFileToTask(taskId: string, fileData: any): Promise<any>;
  getTaskAttachments(taskId: string): Promise<any[]>;
  deleteTaskAttachment(attachmentId: string): Promise<boolean>;
  updateAttachmentStatus(attachmentId: string, verificationStatus: string): Promise<any>;
  // Medium Gap #4: Notification metadata
  createNotificationMetadata(metadataData: any): Promise<any>;
  getNotificationMetadata(userId: string, options?: any): Promise<any[]>;
  markNotificationMetadataAsRead(metadataId: string): Promise<any>;
  recordNotificationAction(metadataId: string, actionTaken: string): Promise<any>;
  getHighPriorityNotifications(userId: string): Promise<any[]>;
  getUnactionedNotifications(userId: string): Promise<any[]>;

  // Notification methods
  createNotification(data: any): Promise<any>;
  createBulkNotifications(userIds: string[], notificationData: any): Promise<any[]>;
  getUserNotifications(userId: string, read?: boolean, limit?: number, offset?: number, type?: string): Promise<any[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationAsRead(notificationId: string, userId: string): Promise<any>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  deleteNotification(notificationId: string, userId: string): Promise<boolean>;
  getUserNotificationPreferences(userId: string): Promise<any>;
  updateUserNotificationPreferences(userId: string, updates: any): Promise<any>;
  createNotificationHistory(userId: string, type: string, title: string, message: string, metadata?: any): Promise<any>;
  getUserNotificationHistory(userId: string, args?: { limit?: number; offset?: number }): Promise<any[]>;

  // Proposal comment methods  
  // Medium Gap #5: Comment edit history
  recordCommentEditHistory(commentId: string, previousContent: string, newContent: string, editedBy: string): Promise<any>;
  getCommentEditHistory(commentId: string): Promise<any>;
  getCommentsByEditor(userId: string): Promise<any[]>;
  updateProposalComment(commentId: string, newContent: string, userId: string): Promise<any>;

  // Financial/Analytics methods
  getPlatformFeeInfo(): Promise<any>;
  getDaoBillingHistory(daoId: string): Promise<any>;
  getAllDaoBillingHistory(): Promise<any>;
  addDaoBillingHistory(entry: any): Promise<any>;
  getBillingCount(): Promise<number>;
  getDAOStats(): Promise<any>;
  getDaoAnalytics(daoId: string): Promise<DaoAnalytics>;
  getTopMembers(args?: { limit?: number }): Promise<any>;
  getAllUsers(args?: { limit?: number; offset?: number }): Promise<any[]>;
  getUserCount(): Promise<number>;
  createAuditLog(entry: any): Promise<any>;
  getAuditLogs(args?: { limit?: number; offset?: number; userId?: string; severity?: string }): Promise<any[]>;
  createSystemLog(level: string, message: string, service?: string, metadata?: any): Promise<any>;
  getSystemLogs(args?: { limit?: number; offset?: number; level?: string; service?: string }): Promise<any[]>;
  getLogCount(): Promise<number>;
  getChainInfo(): Promise<any>;

  // ===== LOW-PRIORITY GAPS =====
  // Gap #1: Snapshot History
  createSnapshotHistory(snapshotData: any): Promise<any>;
  getSnapshotHistory(daoId: string, snapshotType?: string, limit?: number, offset?: number): Promise<any[]>;
  getSnapshotById(snapshotId: string): Promise<any>;
  
  // Gap #2: Activity Feeds
  createActivityFeed(feedData: any): Promise<any>;
  getUserActivityFeed(userId: string, limit?: number, offset?: number): Promise<any[]>;
  getDaoActivityFeed(daoId: string, limit?: number, offset?: number): Promise<any[]>;
  getActivityFeedByType(activityType: string, limit?: number): Promise<any[]>;
  
  // Gap #3: Message Logs
  createMessageLog(messageData: any): Promise<any>;
  getConversation(userId1: string, userId2: string, limit?: number, offset?: number): Promise<any[]>;
  markMessagesAsRead(userId: string, senderId: string): Promise<any>;
  getUnreadMessageCount(userId: string): Promise<number>;
  
  // Gap #4: Type Definitions
  createTypeDefinition(typeData: any): Promise<any>;
  getTypeDefinitions(daoId: string, entityType: string): Promise<any[]>;
  getTypeDefinitionById(typeId: string): Promise<any>;
  
  // Gap #5: Feature Flags
  createFeatureFlag(flagData: any): Promise<any>;
  getFeatureFlag(flagName: string, context?: { daoId?: string; userId?: string }): Promise<any>;
  updateFeatureFlag(flagId: string, updates: any): Promise<any>;
  
  // Gap #6: Analytics Events
  logAnalyticsEvent(eventData: any): Promise<any>;
  getAnalyticsEvents(filters: any, limit?: number): Promise<any[]>;
  
  // Gap #7: API Keys
  createApiKey(keyData: any): Promise<any>;
  getApiKeysByUser(userId: string): Promise<any[]>;
  updateApiKeyUsage(keyId: string): Promise<any>;
  
  // Gap #8: User Preferences
  createOrUpdateUserPreferences(userId: string, preferences: any): Promise<any>;
  getUserPreferences(userId: string): Promise<any>;
  
  // Gap #9: Caching Metadata
  recordCacheHit(cacheKey: string): Promise<any>;
  recordCacheMiss(cacheKey: string): Promise<any>;
  invalidateCache(cacheKey: string, reason: string): Promise<any>;
  getCacheMetadata(cacheKey: string): Promise<any>;
  
  // Gap #10: Audit Events
  createAuditEvent(auditData: any): Promise<any>;
  getAuditEvents(daoId?: string, filters?: any, limit?: number): Promise<any[]>;
  getCriticalAuditEvents(daoId: string, daysBack?: number): Promise<any[]>;
}

/**
 * Aggregated DatabaseStorage - combines all modules into one unified interface
 * This maintains backwards compatibility while using modular internals
 */
export class DatabaseStorage implements IStorage {
  private userStorage = userStorage;
  private daoStorage = daoStorage;
  private proposalStorage = proposalStorage;
  private contributionStorage = contributionStorage;
  private taskStorage = taskStorage;
  private financialStorage = financialStorage;
  private lowPriorityStorage = lowPriorityStorage;

  // User methods
  async getUser(userId: string) { return this.userStorage.getUser(userId); }
  async getUserByEmail(email: string) { return this.userStorage.getUserByEmail(email); }
  async getUserByPhone(phone: string) { return this.userStorage.getUserByPhone(phone); }
  async createUser(userData: any) { return this.userStorage.createUser(userData); }
  async updateUser(userId: string, update: any) { return this.userStorage.updateUser(userId, update); }
  async loginUser(email: string) { return this.userStorage.loginUser(email); }
  async getUserProfile(userId: string) { return this.userStorage.getUserProfile(userId); }
  async updateUserProfile(userId: string, data: any) { return this.userStorage.updateUserProfile(userId, data); }
  async getUserSocialLinks(userId: string) { return this.userStorage.getUserSocialLinks(userId); }
  async updateUserSocialLinks(userId: string, data: any) { return this.userStorage.updateUserSocialLinks(userId, data); }
  async getUserWallet(userId: string) { return this.userStorage.getUserWallet(userId); }
  async updateUserWallet(userId: string, data: any) { return this.userStorage.updateUserWallet(userId, data); }
  async getUserSettings(userId: string) { return this.userStorage.getUserSettings(userId); }
  async updateUserSettings(userId: string, data: any) { return this.userStorage.updateUserSettings(userId, data); }
  async getUserSessions(userId: string) { return this.userStorage.getUserSessions(userId); }
  async revokeUserSession(userId: string, sessionId: string) { return this.userStorage.revokeUserSession(userId, sessionId); }
  async revokeAllUserSessions(userId: string) { return this.userStorage.revokeAllUserSessions(userId); }
  async deleteUserAccount(userId: string) { return this.userStorage.deleteUserAccount(userId); }
  async getUserReferralStats(userId: string) { return this.userStorage.getUserReferralStats(userId); }
  async getReferralLeaderboard(limit?: number) { return this.userStorage.getReferralLeaderboard(limit); }
  async updateUserTelegramInfo(userId: string, telegramInfo: any) { return this.userStorage.updateUserTelegramInfo(userId, telegramInfo); }
  async getUserTelegramInfo(userId: string) { return this.userStorage.getUserTelegramInfo(userId); }
  // Medium Gap #1: Session audit logs
  async createSessionAuditLog(logData: any) { return this.userStorage.createSessionAuditLog(logData); }
  async getSessionAuditLogs(userId: string, options?: any) { return this.userStorage.getSessionAuditLogs(userId, options); }
  async getCriticalSessionEvents(userId: string, daysBack?: number) { return this.userStorage.getCriticalSessionEvents(userId, daysBack); }
  // Gap #4: Wallet addresses
  async addWalletAddress(userId: string, walletData: any) { return this.userStorage.addWalletAddress(userId, walletData); }
  async getWalletAddresses(userId: string, chainId?: number) { return this.userStorage.getWalletAddresses(userId, chainId); }
  async setPrimaryWallet(userId: string, walletId: string, chainId: number) { return this.userStorage.setPrimaryWallet(userId, walletId, chainId); }
  async verifyWalletAddress(walletId: string, signature: string) { return this.userStorage.verifyWalletAddress(walletId, signature); }
  async deleteWalletAddress(walletId: string) { return this.userStorage.deleteWalletAddress(walletId); }

  // DAO methods
  async createDao(dao: any) { return this.daoStorage.createDao(dao); }
  async getDao(daoId: string) { return this.daoStorage.getDao(daoId); }
  async getAllDaos(args?: any) { return this.daoStorage.getAllDaos(args); }
  async getDaoCount() { return this.daoStorage.getDaoCount(); }
  async incrementDaoMemberCount(daoId: string) { return this.daoStorage.incrementDaoMemberCount(daoId); }
  async setDaoInviteCode(daoId: string, code: string) { return this.daoStorage.setDaoInviteCode(daoId, code); }
  async updateDaoInviteCode(daoId: string, code: string) { return this.daoStorage.updateDaoInviteCode(daoId, code); }
  async getDaoByInviteCode(code: string) { return this.daoStorage.getDaoByInviteCode(code); }
  async createDaoMembership(args: any) { return this.daoStorage.createDaoMembership(args); }
  async getDaoMembership(daoId: string, userId: string) { return this.daoStorage.getDaoMembership(daoId, userId); }
  async getDaoMembers(daoId: string, userId?: string, status?: string, role?: string, limit?: number, offset?: number) { 
    return this.daoStorage.getDaoMembers(daoId, userId, status, role, limit, offset); 
  }
  async getDaoMembershipsByStatus(daoId: string, status: any) { return this.daoStorage.getDaoMembershipsByStatus(daoId, status); }
  async updateDaoMembershipStatus(membershipId: string, status: any) { return this.daoStorage.updateDaoMembershipStatus(membershipId, status); }
  async getDaoPlan(daoId: string) { return this.daoStorage.getDaoPlan(daoId); }
  async setDaoPlan(daoId: string, plan: string, planExpiresAt: Date | null) { return this.daoStorage.setDaoPlan(daoId, plan, planExpiresAt); }
  // Gap #1: DAO settings
  async getDaoSetting(daoId: string, settingKey: string) { return this.daoStorage.getDaoSetting(daoId, settingKey); }
  async getDaoSettings(daoId: string) { return this.daoStorage.getDaoSettings(daoId); }
  async upsertDaoSetting(daoId: string, settingKey: string, settingValue: any, metadata?: any) { return this.daoStorage.upsertDaoSetting(daoId, settingKey, settingValue, metadata); }
  async deleteDaoSetting(daoId: string, settingKey: string) { return this.daoStorage.deleteDaoSetting(daoId, settingKey); }
  // Medium Gap #2: Referral rewards per DAO
  async createDaoReferralReward(rewardData: any) { return this.daoStorage.createDaoReferralReward(rewardData); }
  async getDaoReferralRewards(daoId: string, options?: any) { return this.daoStorage.getDaoReferralRewards(daoId, options); }
  async getDaoReferralRewardsByReferrer(referrerId: string, daoId: string) { return this.daoStorage.getDaoReferralRewardsByReferrer(referrerId, daoId); }
  async getDaoReferralRewardsTotal(daoId: string, referrerId: string) { return this.daoStorage.getDaoReferralRewardsTotal(daoId, referrerId); }
  async updateDaoReferralRewardStatus(rewardId: string, status: string) { return this.daoStorage.updateDaoReferralRewardStatus(rewardId, status); }

  // Proposal methods
  async createProposal(proposal: any) { return this.proposalStorage.createProposal(proposal); }
  async getProposals() { return this.proposalStorage.getProposals(); }
  async getProposal(id: string) { return this.proposalStorage.getProposal(id); }
  async updateProposal(id: string, data: any, userId: string) { return this.proposalStorage.updateProposal(id, data, userId); }
  async deleteProposal(id: string, userId: string) { return this.proposalStorage.deleteProposal(id, userId); }
  async updateProposalVotes(proposalId: string, voteType: string) { return this.proposalStorage.updateProposalVotes(proposalId, voteType); }
  async createVote(vote: any) { return this.proposalStorage.createVote(vote); }
  async getVote(proposalId: string, userId: string) { return this.proposalStorage.getVote(proposalId, userId); }
  async getVotesByProposal(proposalId: string) { return this.proposalStorage.getVotesByProposal(proposalId); }
  async getVotesByUserAndDao(userId: string, daoId: string) { return this.proposalStorage.getVotesByUserAndDao(userId, daoId); }
  async getVotesCount(daoId: string, proposalId: string) { return this.proposalStorage.getVotesCount(daoId, proposalId); }
  async createProposalComment(comment: any) { return this.proposalStorage.createProposalComment(comment); }
  async getProposalComments(proposalId: string, limit?: number, offset?: number) { return this.proposalStorage.getProposalComments(proposalId, limit, offset); }
  async updateProposalComment(commentId: string, updates: any) { return this.proposalStorage.updateProposalComment(commentId, updates); }
  async deleteProposalComment(commentId: string) { return this.proposalStorage.deleteProposalComment(commentId); }
  async toggleProposalLike(proposalId: string, userId: string) { return this.proposalStorage.toggleProposalLike(proposalId, userId); }
  async getProposalLikes(proposalId: string) { return this.proposalStorage.getProposalLikes(proposalId); }
  async toggleCommentLike(commentId: string, userId: string) { return this.proposalStorage.toggleCommentLike(commentId, userId); }
  async getCommentLikes(commentId: string) { return this.proposalStorage.getCommentLikes(commentId); }
  // Gap #3: Proposal drafts
  async saveProposalDraft(draftData: any) { return this.proposalStorage.saveProposalDraft(draftData); }
  async getDraftProposals(daoId: string, proposerId?: string) { return this.proposalStorage.getDraftProposals(daoId, proposerId); }
  async publishDraft(proposalId: string, publishData?: any) { return this.proposalStorage.publishDraft(proposalId, publishData); }
  async deleteDraft(proposalId: string) { return this.proposalStorage.deleteDraft(proposalId); }
  // Medium Gap #5: Comment edit history
  async recordCommentEditHistory(commentId: string, previousContent: string, newContent: string, editedBy: string) { 
    return this.proposalStorage.recordCommentEditHistory(commentId, previousContent, newContent, editedBy); 
  }
  async getCommentEditHistory(commentId: string) { return this.proposalStorage.getCommentEditHistory(commentId); }
  async getCommentsByEditor(userId: string) { return this.proposalStorage.getCommentsByEditor(userId); }
  async updateCommentWithEditTracking(commentId: string, newContent: string, userId: string) { 
    return this.proposalStorage.updateProposalComment(commentId, newContent, userId); 
  }

  // Contribution methods
  async createContribution(contribution: any) { return this.contributionStorage.createContribution(contribution); }
  async getContributions(userId?: string, daoId?: string) { return this.contributionStorage.getContributions(userId, daoId); }
  async getContributionsCount(userId: string, daoId: string) { return this.contributionStorage.getContributionsCount(userId, daoId); }
  async getUserContributionStats(userId: string) { return this.contributionStorage.getUserContributionStats(userId); }
  async hasActiveContributions(userId: string, daoId: string) { return this.contributionStorage.hasActiveContributions(userId, daoId); }
  async getUserVaults(userId: string) { return this.contributionStorage.getUserVaults(userId); }
  async upsertVault(vault: any) { return this.contributionStorage.upsertVault(vault); }
  async getVaultTransactions(vaultId: string, limit?: number, offset?: number) { return this.contributionStorage.getVaultTransactions(vaultId, limit, offset); }
  async createWalletTransaction(data: WalletTransactionInput) { return this.contributionStorage.createWalletTransaction(data); }
  async deductVaultFee(vaultId: string, fee: number) { return this.contributionStorage.deductVaultFee(vaultId, fee); }
  // Gap #5: Vault balance history
  async recordBalanceChange(vaultId: string, changeData: any) { return this.contributionStorage.recordBalanceChange(vaultId, changeData); }
  async getBalanceHistory(vaultId: string, options?: any) { return this.contributionStorage.getBalanceHistory(vaultId, options); }
  async getVaultBalanceAtDate(vaultId: string, date: Date) { return this.contributionStorage.getVaultBalanceAtDate(vaultId, date); }
  async getBalanceChangeStats(vaultId: string, timeframeInDays?: number) { return this.contributionStorage.getBalanceChangeStats(vaultId, timeframeInDays); }
  // Medium Gap #3: Budget detail tracking
  async createBudgetDetail(detailData: any) { return this.contributionStorage.createBudgetDetail(detailData); }
  async getBudgetDetails(budgetPlanId: string) { return this.contributionStorage.getBudgetDetails(budgetPlanId); }
  async updateBudgetDetailSpending(detailId: string, spentAmount: number) { return this.contributionStorage.updateBudgetDetailSpending(detailId, spentAmount); }
  async getBudgetDetailsByCategory(budgetPlanId: string, category: string) { return this.contributionStorage.getBudgetDetailsByCategory(budgetPlanId, category); }
  async getBudgetDetailsByUser(budgetPlanId: string, userId: string) { return this.contributionStorage.getBudgetDetailsByUser(budgetPlanId, userId); }

  // Task methods
  async getTasks(daoId?: string, status?: string) { return this.taskStorage.getTasks(daoId, status); }
  async createTask(task: any) { return this.taskStorage.createTask(task); }
  async updateTask(id: string, data: any, userId: string) { return this.taskStorage.updateTask(id, data, userId); }
  async claimTask(taskId: string, userId: string) { return this.taskStorage.claimTask(taskId, userId); }
  async getTaskCount(daoId: string, status?: string) { return this.taskStorage.getTaskCount(daoId, status); }
  // Gap #2: Task attachments
  async attachFileToTask(taskId: string, fileData: any) { return this.taskStorage.attachFileToTask(taskId, fileData); }
  async getTaskAttachments(taskId: string) { return this.taskStorage.getTaskAttachments(taskId); }
  async deleteTaskAttachment(attachmentId: string) { return this.taskStorage.deleteTaskAttachment(attachmentId); }
  async updateAttachmentStatus(attachmentId: string, verificationStatus: string) { return this.taskStorage.updateAttachmentStatus(attachmentId, verificationStatus); }

  // Medium Gap #4: Notification metadata (delegated to taskStorage)
  async createNotificationMetadata(metadataData: any) { return this.taskStorage.createNotificationMetadata(metadataData); }
  async getNotificationMetadata(userId: string, options?: any) { return this.taskStorage.getNotificationMetadata(userId, options); }
  async markNotificationMetadataAsRead(metadataId: string) { return this.taskStorage.markNotificationMetadataAsRead(metadataId); }
  async recordNotificationAction(metadataId: string, actionTaken: string) { return this.taskStorage.recordNotificationAction(metadataId, actionTaken); }
  async getHighPriorityNotifications(userId: string) { return this.taskStorage.getHighPriorityNotifications(userId); }
  async getUnactionedNotifications(userId: string) { return this.taskStorage.getUnactionedNotifications(userId); }

  // Notification methods
  async createNotification(data: any) { return this.taskStorage.createNotification(data); }
  async createBulkNotifications(userIds: string[], notificationData: any) { return this.taskStorage.createBulkNotifications(userIds, notificationData); }
  async getUserNotifications(userId: string, read?: boolean, limit?: number, offset?: number, type?: string) { return this.taskStorage.getUserNotifications(userId, read, limit, offset, type); }
  async getUnreadNotificationCount(userId: string) { return this.taskStorage.getUnreadNotificationCount(userId); }
  async markNotificationAsRead(notificationId: string, userId: string) { return this.taskStorage.markNotificationAsRead(notificationId, userId); }
  async markAllNotificationsAsRead(userId: string) { return this.taskStorage.markAllNotificationsAsRead(userId); }
  async deleteNotification(notificationId: string, userId: string) { return this.taskStorage.deleteNotification(notificationId, userId); }
  async getUserNotificationPreferences(userId: string) { return this.taskStorage.getUserNotificationPreferences(userId); }
  async updateUserNotificationPreferences(userId: string, updates: any) { return this.taskStorage.updateUserNotificationPreferences(userId, updates); }
  async createNotificationHistory(userId: string, type: string, title: string, message: string, metadata?: any) { return this.taskStorage.createNotificationHistory(userId, type, title, message, metadata); }
  async getUserNotificationHistory(userId: string, args?: any) { return this.taskStorage.getUserNotificationHistory(userId, args); }

  // Financial/Analytics methods
  async getPlatformFeeInfo() { return this.financialStorage.getPlatformFeeInfo(); }
  async getDaoBillingHistory(daoId: string) { return this.financialStorage.getDaoBillingHistory(daoId); }
  async getAllDaoBillingHistory() { return this.financialStorage.getAllDaoBillingHistory(); }
  async addDaoBillingHistory(entry: any) { return this.financialStorage.addDaoBillingHistory(entry); }
  async getBillingCount() { return this.financialStorage.getBillingCount(); }
  async getDAOStats() { return this.financialStorage.getDAOStats(); }
  async getDaoAnalytics(daoId: string) { return this.financialStorage.getDaoAnalytics(daoId); }
  async getTopMembers(args?: any) { return this.financialStorage.getTopMembers(args); }
  async getAllUsers(args?: any) { return this.financialStorage.getAllUsers(args); }
  async getUserCount() { return this.financialStorage.getUserCount(); }
  async createAuditLog(entry: any) { return this.financialStorage.createAuditLog(entry); }
  async getAuditLogs(args?: any) { return this.financialStorage.getAuditLogs(args); }
  async createSystemLog(level: string, message: string, service?: string, metadata?: any) { return this.financialStorage.createSystemLog(level, message, service, metadata); }
  async getSystemLogs(args?: any) { return this.financialStorage.getSystemLogs(args); }
  async getLogCount() { return this.financialStorage.getLogCount(); }
  async getChainInfo() { return this.financialStorage.getChainInfo(); }

  // ===== LOW-PRIORITY GAP DELEGATIONS =====
  // Gap #1: Snapshot History
  async createSnapshotHistory(snapshotData: any) { return this.lowPriorityStorage.createSnapshotHistory(snapshotData); }
  async getSnapshotHistory(daoId: string, snapshotType?: string, limit: number = 50, offset: number = 0) { return this.lowPriorityStorage.getSnapshotHistory(daoId, snapshotType, limit, offset); }
  async getSnapshotById(snapshotId: string) { return this.lowPriorityStorage.getSnapshotById(snapshotId); }

  // Gap #2: Activity Feeds
  async createActivityFeed(feedData: any) { return this.lowPriorityStorage.createActivityFeed(feedData); }
  async getUserActivityFeed(userId: string, limit: number = 50, offset: number = 0) { return this.lowPriorityStorage.getUserActivityFeed(userId, limit, offset); }
  async getDaoActivityFeed(daoId: string, limit: number = 50, offset: number = 0) { return this.lowPriorityStorage.getDaoActivityFeed(daoId, limit, offset); }
  async getActivityFeedByType(activityType: string, limit: number = 50) { return this.lowPriorityStorage.getActivityFeedByType(activityType, limit); }

  // Gap #3: Message Logs
  async createMessageLog(messageData: any) { return this.lowPriorityStorage.createMessageLog(messageData); }
  async getConversation(userId1: string, userId2: string, limit: number = 50, offset: number = 0) { return this.lowPriorityStorage.getConversation(userId1, userId2, limit, offset); }
  async markMessagesAsRead(userId: string, senderId: string) { return this.lowPriorityStorage.markMessagesAsRead(userId, senderId); }
  async getUnreadMessageCount(userId: string) { return this.lowPriorityStorage.getUnreadMessageCount(userId); }

  // Gap #4: Type Definitions
  async createTypeDefinition(typeData: any) { return this.lowPriorityStorage.createTypeDefinition(typeData); }
  async getTypeDefinitions(daoId: string, entityType: string) { return this.lowPriorityStorage.getTypeDefinitions(daoId, entityType); }
  async getTypeDefinitionById(typeId: string) { return this.lowPriorityStorage.getTypeDefinitionById(typeId); }

  // Gap #5: Feature Flags
  async createFeatureFlag(flagData: any) { return this.lowPriorityStorage.createFeatureFlag(flagData); }
  async getFeatureFlag(flagName: string, context?: any) { return this.lowPriorityStorage.getFeatureFlag(flagName, context); }
  async updateFeatureFlag(flagId: string, updates: any) { return this.lowPriorityStorage.updateFeatureFlag(flagId, updates); }

  // Gap #6: Analytics Events
  async logAnalyticsEvent(eventData: any) { return this.lowPriorityStorage.logAnalyticsEvent(eventData); }
  async getAnalyticsEvents(filters: any, limit: number = 1000) { return this.lowPriorityStorage.getAnalyticsEvents(filters, limit); }

  // Gap #7: API Keys
  async createApiKey(keyData: any) { return this.lowPriorityStorage.createApiKey(keyData); }
  async getApiKeysByUser(userId: string) { return this.lowPriorityStorage.getApiKeysByUser(userId); }
  async updateApiKeyUsage(keyId: string) { return this.lowPriorityStorage.updateApiKeyUsage(keyId); }

  // Gap #8: User Preferences
  async createOrUpdateUserPreferences(userId: string, preferences: any) { return this.lowPriorityStorage.createOrUpdateUserPreferences(userId, preferences); }
  async getUserPreferences(userId: string) { return this.lowPriorityStorage.getUserPreferences(userId); }

  // Gap #9: Caching Metadata
  async recordCacheHit(cacheKey: string) { return this.lowPriorityStorage.recordCacheHit(cacheKey); }
  async recordCacheMiss(cacheKey: string) { return this.lowPriorityStorage.recordCacheMiss(cacheKey); }
  async invalidateCache(cacheKey: string, reason: string) { return this.lowPriorityStorage.invalidateCache(cacheKey, reason); }
  async getCacheMetadata(cacheKey: string) { return this.lowPriorityStorage.getCacheMetadata(cacheKey); }

  // Gap #10: Audit Events
  async createAuditEvent(auditData: any) { return this.lowPriorityStorage.createAuditEvent(auditData); }
  async getAuditEvents(daoId?: string, filters?: any, limit: number = 100) { return this.lowPriorityStorage.getAuditEvents(daoId, filters, limit); }
  async getCriticalAuditEvents(daoId: string, daysBack: number = 7) { return this.lowPriorityStorage.getCriticalAuditEvents(daoId, daysBack); }
}

// Export singleton instance
export const storage = new DatabaseStorage();

// Export type definitions
export type { DaoAnalytics, WalletTransactionInput, IStorage };

// Export utility functions
export { isDaoPremium };

// Re-export all submodules for direct access if needed
export { userStorage, daoStorage, proposalStorage, contributionStorage, taskStorage, financialStorage, lowPriorityStorage };
export { UserStorage, DaoStorage, ProposalStorage, ContributionStorage, TaskStorage, FinancialStorage, LowPriorityStorage };

// Export db for convenience
export { db };

// Re-export all methods as standalone functions for backwards compatibility
export const getUser = (userId: string) => storage.getUser(userId);
export const getUserByEmail = (email: string) => storage.getUserByEmail(email);
export const getUserByPhone = (phone: string) => storage.getUserByPhone(phone);
export const createUser = (userData: any) => storage.createUser(userData);
export const updateUser = (userId: string, update: any) => storage.updateUser(userId, update);
export const loginUser = (email: string) => storage.loginUser(email);
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
export const revokeAllUserSessions = (userId: string) => storage.revokeAllUserSessions(userId);
export const deleteUserAccount = (userId: string) => storage.deleteUserAccount(userId);
export const getUserReferralStats = (userId: string) => storage.getUserReferralStats(userId);
export const getReferralLeaderboard = (limit?: number) => storage.getReferralLeaderboard(limit);
export const updateUserTelegramInfo = (userId: string, telegramInfo: any) => storage.updateUserTelegramInfo(userId, telegramInfo);
export const getUserTelegramInfo = (userId: string) => storage.getUserTelegramInfo(userId);
export const createDao = (dao: any) => storage.createDao(dao);
export const getDao = (daoId: string) => storage.getDao(daoId);
export const getAllDaos = (args?: any) => storage.getAllDaos(args);
export const getDaoCount = () => storage.getDaoCount();
export const incrementDaoMemberCount = (daoId: string) => storage.incrementDaoMemberCount(daoId);
export const setDaoInviteCode = (daoId: string, code: string) => storage.setDaoInviteCode(daoId, code);
export const updateDaoInviteCode = (daoId: string, code: string) => storage.updateDaoInviteCode(daoId, code);
export const getDaoByInviteCode = (code: string) => storage.getDaoByInviteCode(code);
export const createDaoMembership = (args: any) => storage.createDaoMembership(args);
export const getDaoMembership = (daoId: string, userId: string) => storage.getDaoMembership(daoId, userId);
export const getDaoMembers = (daoId: string, userId?: string, status?: string, role?: string, limit?: number, offset?: number) => storage.getDaoMembers(daoId, userId, status, role, limit, offset);
export const getDaoMembershipsByStatus = (daoId: string, status: any) => storage.getDaoMembershipsByStatus(daoId, status);
export const updateDaoMembershipStatus = (membershipId: string, status: any) => storage.updateDaoMembershipStatus(membershipId, status);
export const getDaoPlan = (daoId: string) => storage.getDaoPlan(daoId);
export const setDaoPlan = (daoId: string, plan: string, planExpiresAt: Date | null) => storage.setDaoPlan(daoId, plan, planExpiresAt);
export const createProposal = (proposal: any) => storage.createProposal(proposal);
export const getProposals = () => storage.getProposals();
export const getProposal = (id: string) => storage.getProposal(id);
export const updateProposal = (id: string, data: any, userId: string) => storage.updateProposal(id, data, userId);
export const deleteProposal = (id: string, userId: string) => storage.deleteProposal(id, userId);
export const updateProposalVotes = (proposalId: string, voteType: string) => storage.updateProposalVotes(proposalId, voteType);
export const createVote = (vote: any) => storage.createVote(vote);
export const getVote = (proposalId: string, userId: string) => storage.getVote(proposalId, userId);
export const getVotesByProposal = (proposalId: string) => storage.getVotesByProposal(proposalId);
export const getVotesByUserAndDao = (userId: string, daoId: string) => storage.getVotesByUserAndDao(userId, daoId);
export const getVotesCount = (daoId: string, proposalId: string) => storage.getVotesCount(daoId, proposalId);
export const createProposalComment = (comment: any) => storage.createProposalComment(comment);
export const getProposalComments = (proposalId: string, limit?: number, offset?: number) => storage.getProposalComments(proposalId, limit, offset);
export const updateProposalComment = (commentId: string, updates: any) => storage.updateProposalComment(commentId, updates);
export const deleteProposalComment = (commentId: string) => storage.deleteProposalComment(commentId);
export const toggleProposalLike = (proposalId: string, userId: string) => storage.toggleProposalLike(proposalId, userId);
export const getProposalLikes = (proposalId: string) => storage.getProposalLikes(proposalId);
export const toggleCommentLike = (commentId: string, userId: string) => storage.toggleCommentLike(commentId, userId);
export const getCommentLikes = (commentId: string) => storage.getCommentLikes(commentId);
export const createContribution = (contribution: any) => storage.createContribution(contribution);
export const getContributions = (userId?: string, daoId?: string) => storage.getContributions(userId, daoId);
export const getContributionsCount = (userId: string, daoId: string) => storage.getContributionsCount(userId, daoId);
export const getUserContributionStats = (userId: string) => storage.getUserContributionStats(userId);
export const hasActiveContributions = (userId: string, daoId: string) => storage.hasActiveContributions(userId, daoId);
export const getUserVaults = (userId: string) => storage.getUserVaults(userId);
export const upsertVault = (vault: any) => storage.upsertVault(vault);
export const getVaultTransactions = (vaultId: string, limit?: number, offset?: number) => storage.getVaultTransactions(vaultId, limit, offset);
export const createWalletTransaction = (data: WalletTransactionInput) => storage.createWalletTransaction(data);
export const deductVaultFee = (vaultId: string, fee: number) => storage.deductVaultFee(vaultId, fee);
export const getTasks = (daoId?: string, status?: string) => storage.getTasks(daoId, status);
export const createTask = (task: any) => storage.createTask(task);
export const updateTask = (id: string, data: any, userId: string) => storage.updateTask(id, data, userId);
export const claimTask = (taskId: string, userId: string) => storage.claimTask(taskId, userId);
export const getTaskCount = (daoId: string, status?: string) => storage.getTaskCount(daoId, status);
export const createNotification = (data: any) => storage.createNotification(data);
export const createBulkNotifications = (userIds: string[], notificationData: any) => storage.createBulkNotifications(userIds, notificationData);
export const getUserNotifications = (userId: string, read?: boolean, limit?: number, offset?: number, type?: string) => storage.getUserNotifications(userId, read, limit, offset, type);
export const getUnreadNotificationCount = (userId: string) => storage.getUnreadNotificationCount(userId);
export const markNotificationAsRead = (notificationId: string, userId: string) => storage.markNotificationAsRead(notificationId, userId);
export const markAllNotificationsAsRead = (userId: string) => storage.markAllNotificationsAsRead(userId);
export const deleteNotification = (notificationId: string, userId: string) => storage.deleteNotification(notificationId, userId);
export const getUserNotificationPreferences = (userId: string) => storage.getUserNotificationPreferences(userId);
export const updateUserNotificationPreferences = (userId: string, updates: any) => storage.updateUserNotificationPreferences(userId, updates);
export const createNotificationHistory = (userId: string, type: string, title: string, message: string, metadata?: any) => storage.createNotificationHistory(userId, type, title, message, metadata);
export const getUserNotificationHistory = (userId: string, args?: any) => storage.getUserNotificationHistory(userId, args);
export const getPlatformFeeInfo = () => storage.getPlatformFeeInfo();
export const getDaoBillingHistory = (daoId: string) => storage.getDaoBillingHistory(daoId);
export const getAllDaoBillingHistory = () => storage.getAllDaoBillingHistory();
export const addDaoBillingHistory = (entry: any) => storage.addDaoBillingHistory(entry);
export const getBillingCount = () => storage.getBillingCount();
export const getDAOStats = () => storage.getDAOStats();
export const getDaoAnalytics = (daoId: string) => storage.getDaoAnalytics(daoId);
export const getTopMembers = (args?: any) => storage.getTopMembers(args);
export const getAllUsers = (args?: any) => storage.getAllUsers(args);
export const getUserCount = () => storage.getUserCount();
export const createAuditLog = (entry: any) => storage.createAuditLog(entry);
export const getAuditLogs = (args?: any) => storage.getAuditLogs(args);
export const createSystemLog = (level: string, message: string, service?: string, metadata?: any) => storage.createSystemLog(level, message, service, metadata);
export const getSystemLogs = (args?: any) => storage.getSystemLogs(args);
export const getLogCount = () => storage.getLogCount();
export const getChainInfo = () => storage.getChainInfo();
export const getBudgetPlanCount = (userId: string, month: string) => storage.getBudgetPlanCount?.(userId, month) || Promise.resolve(0);
// Medium Gap #1: Session audit logs
export const createSessionAuditLog = (logData: any) => storage.createSessionAuditLog(logData);
export const getSessionAuditLogs = (userId: string, options?: any) => storage.getSessionAuditLogs(userId, options);
export const getCriticalSessionEvents = (userId: string, daysBack?: number) => storage.getCriticalSessionEvents(userId, daysBack);

// Medium Gap #2: DAO Referral rewards
export const createDaoReferralReward = (rewardData: any) => storage.createDaoReferralReward(rewardData);
export const getDaoReferralRewards = (daoId: string, options?: any) => storage.getDaoReferralRewards(daoId, options);
export const getDaoReferralRewardsByReferrer = (referrerId: string, daoId: string) => storage.getDaoReferralRewardsByReferrer(referrerId, daoId);
export const getDaoReferralRewardsTotal = (daoId: string, referrerId: string) => storage.getDaoReferralRewardsTotal(daoId, referrerId);
export const updateDaoReferralRewardStatus = (rewardId: string, status: string) => storage.updateDaoReferralRewardStatus(rewardId, status);

// Medium Gap #3: Budget detail tracking
export const createBudgetDetail = (detailData: any) => storage.createBudgetDetail(detailData);
export const getBudgetDetails = (budgetPlanId: string) => storage.getBudgetDetails(budgetPlanId);
export const updateBudgetDetailSpending = (detailId: string, spentAmount: number) => storage.updateBudgetDetailSpending(detailId, spentAmount);
export const getBudgetDetailsByCategory = (budgetPlanId: string, category: string) => storage.getBudgetDetailsByCategory(budgetPlanId, category);
export const getBudgetDetailsByUser = (budgetPlanId: string, userId: string) => storage.getBudgetDetailsByUser(budgetPlanId, userId);

// Medium Gap #4: Notification metadata
export const createNotificationMetadata = (metadataData: any) => storage.createNotificationMetadata(metadataData);
export const getNotificationMetadata = (userId: string, options?: any) => storage.getNotificationMetadata(userId, options);
export const markNotificationMetadataAsRead = (metadataId: string) => storage.markNotificationMetadataAsRead(metadataId);
export const recordNotificationAction = (metadataId: string, actionTaken: string) => storage.recordNotificationAction(metadataId, actionTaken);
export const getHighPriorityNotifications = (userId: string) => storage.getHighPriorityNotifications(userId);
export const getUnactionedNotifications = (userId: string) => storage.getUnactionedNotifications(userId);

// Medium Gap #5: Comment edit history
export const recordCommentEditHistory = (commentId: string, previousContent: string, newContent: string, editedBy: string) => 
  storage.recordCommentEditHistory(commentId, previousContent, newContent, editedBy);
export const getCommentEditHistory = (commentId: string) => storage.getCommentEditHistory(commentId);
export const getCommentsByEditor = (userId: string) => storage.getCommentsByEditor(userId);
export const updateCommentWithEditTracking = (commentId: string, newContent: string, userId: string) => 
  storage.updateCommentWithEditTracking(commentId, newContent, userId);

// ===== LOW-PRIORITY GAP EXPORT FUNCTIONS =====
// Gap #1: Snapshot History
export const createSnapshotHistory = (snapshotData: any) => storage.createSnapshotHistory(snapshotData);
export const getSnapshotHistory = (daoId: string, snapshotType?: string, limit?: number, offset?: number) => 
  storage.getSnapshotHistory(daoId, snapshotType, limit, offset);
export const getSnapshotById = (snapshotId: string) => storage.getSnapshotById(snapshotId);

// Gap #2: Activity Feeds
export const createActivityFeed = (feedData: any) => storage.createActivityFeed(feedData);
export const getUserActivityFeed = (userId: string, limit?: number, offset?: number) => 
  storage.getUserActivityFeed(userId, limit, offset);
export const getDaoActivityFeed = (daoId: string, limit?: number, offset?: number) => 
  storage.getDaoActivityFeed(daoId, limit, offset);
export const getActivityFeedByType = (activityType: string, limit?: number) => 
  storage.getActivityFeedByType(activityType, limit);

// Gap #3: Message Logs
export const createMessageLog = (messageData: any) => storage.createMessageLog(messageData);
export const getConversation = (userId1: string, userId2: string, limit?: number, offset?: number) => 
  storage.getConversation(userId1, userId2, limit, offset);
export const markMessagesAsRead = (userId: string, senderId: string) => 
  storage.markMessagesAsRead(userId, senderId);
export const getUnreadMessageCount = (userId: string) => storage.getUnreadMessageCount(userId);

// Gap #4: Type Definitions
export const createTypeDefinition = (typeData: any) => storage.createTypeDefinition(typeData);
export const getTypeDefinitions = (daoId: string, entityType: string) => 
  storage.getTypeDefinitions(daoId, entityType);
export const getTypeDefinitionById = (typeId: string) => storage.getTypeDefinitionById(typeId);

// Gap #5: Feature Flags
export const createFeatureFlag = (flagData: any) => storage.createFeatureFlag(flagData);
export const getFeatureFlag = (flagName: string, context?: any) => storage.getFeatureFlag(flagName, context);
export const updateFeatureFlag = (flagId: string, updates: any) => storage.updateFeatureFlag(flagId, updates);

// Gap #6: Analytics Events
export const logAnalyticsEvent = (eventData: any) => storage.logAnalyticsEvent(eventData);
export const getAnalyticsEvents = (filters: any, limit?: number) => storage.getAnalyticsEvents(filters, limit);

// Gap #7: API Keys
export const createApiKey = (keyData: any) => storage.createApiKey(keyData);
export const getApiKeysByUser = (userId: string) => storage.getApiKeysByUser(userId);
export const updateApiKeyUsage = (keyId: string) => storage.updateApiKeyUsage(keyId);

// Gap #8: User Preferences
export const createOrUpdateUserPreferences = (userId: string, preferences: any) => 
  storage.createOrUpdateUserPreferences(userId, preferences);
export const getUserPreferences = (userId: string) => storage.getUserPreferences(userId);

// Gap #9: Caching Metadata
export const recordCacheHit = (cacheKey: string) => storage.recordCacheHit(cacheKey);
export const recordCacheMiss = (cacheKey: string) => storage.recordCacheMiss(cacheKey);
export const invalidateCache = (cacheKey: string, reason: string) => storage.invalidateCache(cacheKey, reason);
export const getCacheMetadata = (cacheKey: string) => storage.getCacheMetadata(cacheKey);

// Gap #10: Audit Events
export const createAuditEvent = (auditData: any) => storage.createAuditEvent(auditData);
export const getAuditEvents = (daoId?: string, filters?: any, limit?: number) => 
  storage.getAuditEvents(daoId, filters, limit);
export const getCriticalAuditEvents = (daoId: string, daysBack?: number) => 
  storage.getCriticalAuditEvents(daoId, daysBack);