import { db } from '../db';
import { eq, or, and, desc, sql } from 'drizzle-orm';
import { users, sessions, walletAddresses, sessionAuditLogs } from '../../shared/schema';

// Type aliases
type User = typeof users.$inferSelect;

/**
 * Storage module for user management operations
 * Handles: CRUD, authentication, profiles, sessions, Telegram integration
 */
export class UserStorage {
  private db = db;

  /**
   * Create a new user
   */
  async createUser(userData: any): Promise<any> {
    const allowed: any = (({ firstName, lastName, email, phone, googleId, telegramId }) => 
      ({ firstName, lastName, email, phone, googleId, telegramId }))(userData);
    allowed.createdAt = new Date();
    allowed.updatedAt = new Date();
    const result = await this.db.insert(users).values(allowed).returning();
    if (!result[0]) throw new Error('Failed to create user');
    return result[0];
  }

  /**
   * Update user info by userId
   */
  async updateUser(userId: string, update: Partial<User>): Promise<User> {
    if (!userId) throw new Error('User ID required');
    if (!update || typeof update !== 'object') throw new Error('Update object required');
    
    const allowedFields = [
      'name', 'avatar', 'email', 'phone', 'lastLoginAt', 'profile', 
      'authProvider', 'authProviderId', 'emailVerified', 'updatedAt'
    ];
    const allowedUpdate: any = {};
    for (const key of allowedFields) {
      if (key in update) allowedUpdate[key] = (update as any)[key];
    }
    allowedUpdate.updatedAt = new Date();
    
    const result = await this.db.update(users)
      .set(allowedUpdate)
      .where(eq(users.id, userId))
      .returning();
    
    if (!result[0]) throw new Error('Failed to update user');
    return result[0];
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<any> {
    if (!userId) throw new Error('User ID required');
    const result = await this.db.select().from(users).where(eq(users.id, userId));
    if (!result[0]) throw new Error('User not found');
    return result[0];
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<any> {
    if (!email) throw new Error('Email required');
    const result = await this.db.select().from(users).where(eq(users.email, email));
    if (!result[0]) throw new Error('User not found');
    return result[0];
  }

  /**
   * Get user by phone
   */
  async getUserByPhone(phone: string): Promise<any> {
    if (!phone) throw new Error('Phone required');
    const result = await this.db.select().from(users).where(eq(users.phone, phone));
    if (!result[0]) throw new Error('User not found');
    return result[0];
  }

  /**
   * Get user by ID (alias)
   */
  async getUserById(userId: string): Promise<any> {
    if (!userId) throw new Error('User ID required');
    const result = await this.db.select().from(users).where(eq(users.id, userId));
    if (!result[0]) throw new Error('User not found');
    return result[0];
  }

  /**
   * Get user by email OR phone
   */
  async getUserByEmailOrPhone(emailOrPhone: string): Promise<any> {
    if (!emailOrPhone) throw new Error('Email or phone required');
    const result = await this.db.select().from(users).where(
      or(eq(users.email, emailOrPhone), eq(users.phone, emailOrPhone))
    );
    if (!result[0]) throw new Error('User not found');
    return result[0];
  }

  /**
   * OAuth login - fetch user by email
   */
  async loginUser(email: string): Promise<any> {
    return this.getUserByEmail(email);
  }

  /**
   * Get user profile (alias for getUser)
   */
  async getUserProfile(userId: string): Promise<any> {
    return this.getUser(userId);
  }

  /**
   * Update user profile fields
   */
  async updateUserProfile(userId: string, data: any): Promise<any> {
    const allowed = (({ firstName, lastName, email, phone }) => 
      ({ firstName, lastName, email, phone }))(data);
    (allowed as any).updatedAt = new Date();
    
    const result = await this.db.update(users)
      .set(allowed)
      .where(eq(users.id, userId))
      .returning();
    
    if (!result[0]) throw new Error('Failed to update user');
    return result[0];
  }

  /**
   * Get user social links (Google ID, Telegram ID)
   */
  async getUserSocialLinks(userId: string): Promise<any> {
    const user = await this.getUser(userId);
    return { google: user.googleId || null, telegram: user.telegramId || null };
  }

  /**
   * Update user social links
   */
  async updateUserSocialLinks(userId: string, data: any): Promise<any> {
    const allowed = (({ phone, email }) => 
      ({ phone, email }))(data);
    (allowed as any).updatedAt = new Date();
    
    const result = await this.db.update(users)
      .set(allowed)
      .where(eq(users.id, userId))
      .returning();
    
    if (!result[0]) throw new Error('Failed to update social links');
    return result[0];
  }

  /**
   * Get user wallet info (currently returns phone/email, should return blockchain address)
   * ⚠️ PERSISTENCE GAP: No dedicated wallet address field - using phone/email as fallback
   */
  async getUserWallet(userId: string): Promise<any> {
    const user = await this.getUser(userId);
    return { address: user.phone || user.email || null };
  }

  /**
   * Update user wallet info
   * ⚠️ PERSISTENCE GAP: Should persist actual blockchain wallet addresses
   */
  async updateUserWallet(userId: string, data: any): Promise<any> {
    const allowed = (({ phone, email }) => 
      ({ phone, email }))(data);
    (allowed as any).updatedAt = new Date();
    
    const result = await this.db.update(users)
      .set(allowed)
      .where(eq(users.id, userId))
      .returning();
    
    if (!result[0]) throw new Error('Failed to update wallet');
    return result[0];
  }

  /**
   * Get user settings (theme, language)
   */
  async getUserSettings(userId: string): Promise<any> {
    const user = await this.getUser(userId);
    return { 
      theme: user.darkMode ? 'dark' : 'light', 
      language: user.language || 'en' 
    };
  }

  /**
   * Update user settings
   */
  async updateUserSettings(userId: string, data: any): Promise<any> {
    const allowed: any = {};
    if (data.theme) allowed.darkMode = data.theme === 'dark';
    if (data.language) allowed.language = data.language;
    allowed.updatedAt = new Date();
    
    const result = await this.db.update(users)
      .set(allowed)
      .where(eq(users.id, userId))
      .returning();
    
    if (!result[0]) throw new Error('Failed to update settings');
    return result[0];
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId: string): Promise<any[]> {
    const result = await this.db.select().from(sessions)
      .where(eq(sessions.userId, userId));
    return result;
  }

  /**
   * Revoke a specific user session
   * ⚠️ PERSISTENCE GAP: Minimal session tracking (no IP, user agent, device info)
   */
  async revokeUserSession(userId: string, sessionId: string): Promise<void> {
    if (!userId || !sessionId) throw new Error('User ID and session ID required');
    const result = await this.db.delete(sessions).where(
      and(eq(sessions.userId, userId), eq(sessions.id, sessionId))
    );
    if (!result) throw new Error('Session not found or already revoked');
  }

  /**
   * Revoke all user sessions
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    if (!userId) throw new Error('User ID required');
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }

  /**
   * Delete user account
   */
  async deleteUserAccount(userId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, userId));
  }

  /**
   * Get user referral statistics
   * ⚠️ PERSISTENCE GAP: No referral reward tracking, only referredBy field
   */
  async getUserReferralStats(userId: string): Promise<any> {
    if (!userId) throw new Error('User ID required');
    const referred = await this.db.select().from(users)
      .where(eq(users.referredBy, userId));
    return {
      userId,
      referredCount: referred.length,
      referredUsers: referred.map(u => ({ 
        id: u.id, 
        firstName: u.firstName, 
        lastName: u.lastName, 
        email: u.email 
      }))
    };
  }

  /**
   * Get referral leaderboard
   */
  async getReferralLeaderboard(limit = 10): Promise<any> {
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

  /**
   * Update Telegram integration info
   */
  async updateUserTelegramInfo(userId: string, telegramInfo: { 
    telegramId: string; 
    chatId: string; 
    username?: string 
  }) {
    return await this.db.update(users)
      .set({ 
        telegramId: telegramInfo.telegramId,
        telegramChatId: telegramInfo.chatId,
        telegramUsername: telegramInfo.username
      })
      .where(eq(users.id, userId))
      .returning();
  }

  /**
   * Get user Telegram info
   * ⚠️ PERSISTENCE GAP: No Telegram message log persistence
   */
  async getUserTelegramInfo(userId: string) {
    const user = await this.db.select({
      telegramId: users.telegramId,
      chatId: users.telegramChatId,
      username: users.telegramUsername
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
    
    return user[0] ? {
      telegramId: user[0].telegramId || '',
      chatId: user[0].chatId || '',
      username: user[0].username || ''
    } : null;
  }

  /**
   * Add wallet address for user (Gap #4: Wallet addresses persistence)
   */
  async addWalletAddress(userId: string, walletData: any): Promise<any> {
    if (!userId || !walletData.address || !walletData.chainId) {
      throw new Error('User ID, address, and chain ID required');
    }
    const result = await this.db.insert(walletAddresses).values({
      userId,
      chainId: walletData.chainId,
      chainName: walletData.chainName,
      address: walletData.address,
      addressLabel: walletData.addressLabel,
      isPrimary: walletData.isPrimary || false,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  /**
   * Get user wallet addresses
   */
  async getWalletAddresses(userId: string, chainId?: number): Promise<any[]> {
    if (!userId) throw new Error('User ID required');
    if (chainId) {
      return await this.db.select().from(walletAddresses)
        .where(and(eq(walletAddresses.userId, userId), eq(walletAddresses.chainId, chainId)))
        .orderBy(desc(walletAddresses.isPrimary));
    }
    return await this.db.select().from(walletAddresses)
      .where(eq(walletAddresses.userId, userId))
      .orderBy(desc(walletAddresses.isPrimary));
  }

  /**
   * Set primary wallet for a chain
   */
  async setPrimaryWallet(userId: string, walletId: string, chainId: number): Promise<any> {
    if (!userId || !walletId || !chainId) {
      throw new Error('User ID, wallet ID, and chain ID required');
    }
    // Clear primary for this chain
    await this.db.update(walletAddresses)
      .set({ isPrimary: false })
      .where(and(eq(walletAddresses.userId, userId), eq(walletAddresses.chainId, chainId)));
    
    // Set new primary
    const result = await this.db.update(walletAddresses)
      .set({ isPrimary: true, updatedAt: new Date() })
      .where(eq(walletAddresses.id, walletId))
      .returning();
    return result[0];
  }

  /**
   * Verify wallet address
   */
  async verifyWalletAddress(walletId: string, signature: string): Promise<any> {
    if (!walletId || !signature) throw new Error('Wallet ID and signature required');
    const result = await this.db.update(walletAddresses)
      .set({ 
        isVerified: true, 
        verificationSignature: signature,
        updatedAt: new Date() 
      })
      .where(eq(walletAddresses.id, walletId))
      .returning();
    return result[0];
  }

  /**
   * Delete wallet address
   */
  async deleteWalletAddress(walletId: string): Promise<boolean> {
    if (!walletId) throw new Error('Wallet ID required');
    const result = await this.db.delete(walletAddresses)
      .where(eq(walletAddresses.id, walletId));
    return result.rowCount > 0;
  }

  /**
   * Create session audit log (Medium Gap #1: Session audit logs)
   */
  async createSessionAuditLog(auditData: any): Promise<any> {
    if (!auditData.sessionId || !auditData.userId || !auditData.action) {
      throw new Error('Session ID, user ID, and action required');
    }
    const result = await this.db.insert(sessionAuditLogs).values({
      sessionId: auditData.sessionId,
      userId: auditData.userId,
      daoId: auditData.daoId,
      action: auditData.action,
      resource: auditData.resource,
      resourceId: auditData.resourceId,
      method: auditData.method,
      endpoint: auditData.endpoint,
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
      status: auditData.status,
      duration: auditData.duration,
      metadata: auditData.metadata,
      severity: auditData.severity || 'info',
      createdAt: new Date(),
    }).returning();
    return result[0];
  }

  /**
   * Get session audit logs
   */
  async getSessionAuditLogs(userId: string, options: any = {}): Promise<any[]> {
    if (!userId) throw new Error('User ID required');
    const { limit = 100, offset = 0, daoId } = options;
    
    let whereClause = eq(sessionAuditLogs.userId, userId);
    if (daoId) {
      whereClause = and(whereClause, eq(sessionAuditLogs.daoId, daoId));
    }

    return await this.db.select().from(sessionAuditLogs)
      .where(whereClause)
      .orderBy(desc(sessionAuditLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get session audit logs by session ID
   */
  async getSessionAuditLogsBySessionId(sessionId: string): Promise<any[]> {
    if (!sessionId) throw new Error('Session ID required');
    return await this.db.select().from(sessionAuditLogs)
      .where(eq(sessionAuditLogs.sessionId, sessionId))
      .orderBy(desc(sessionAuditLogs.createdAt));
  }

  /**
   * Get critical session audit logs
   */
  async getCriticalAuditLogs(userId: string, days: number = 7): Promise<any[]> {
    if (!userId) throw new Error('User ID required');
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    
    return await this.db.select().from(sessionAuditLogs)
      .where(and(
        eq(sessionAuditLogs.userId, userId),
        eq(sessionAuditLogs.severity, 'critical'),
        sql`"created_at" >= ${sinceDate}`
      ))
      .orderBy(desc(sessionAuditLogs.createdAt));
  }

  /**
   * Alias for getCriticalAuditLogs (Medium Gap #1: Session audit logs)
   */
  async getCriticalSessionEvents(userId: string, daysBack: number = 7): Promise<any[]> {
    return this.getCriticalAuditLogs(userId, daysBack);
  }
}

// Export singleton instance
export const userStorage = new UserStorage();
