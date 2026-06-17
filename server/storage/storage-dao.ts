import { db } from '../db';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { daos, daoMemberships, users, contributions, daoSettings, referralRewards } from '../../shared/schema';

// Type aliases
type Dao = typeof daos.$inferSelect;
type DaoMembership = typeof daoMemberships.$inferSelect;

/**
 * Storage module for DAO management
 * Handles: DAO CRUD, membership management, member lists, admin functions
 */
export class DaoStorage {
  private db = db;

  /**
   * Create a new DAO
   */
  async createDao(dao: any): Promise<Dao> {
    if (!dao.name || !dao.creatorId) throw new Error('Name and creatorId required');
    dao.createdAt = new Date();
    dao.updatedAt = new Date();
    dao.memberCount = 1; // Creator is the first member
    const result = await this.db.insert(daos).values(dao).returning();
    if (!result[0]) throw new Error('Failed to create DAO');
    await this.createDaoMembership({ 
      daoId: result[0].id, 
      userId: dao.creatorId, 
      status: 'approved', 
      role: 'admin' 
    });
    return result[0];
  }

  /**
   * Get DAO by ID
   */
  async getDao(daoId: string): Promise<any> {
    if (!daoId) throw new Error('DAO ID required');
    const result = await this.db.select().from(daos).where(eq(daos.id, daoId));
    if (!result[0]) throw new Error('DAO not found');
    return result[0];
  }

  /**
   * Get all DAOs with pagination
   */
  async getAllDaos({ limit = 10, offset = 0 }: { limit?: number; offset?: number } = {}): Promise<Dao[]> {
    return await this.db.select().from(daos)
      .orderBy(desc(daos.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get total DAO count
   */
  async getDaoCount(): Promise<number> {
    const result = await this.db.select({ count: sql`count(*)` }).from(daos);
    return Number(result[0]?.count) || 0;
  }

  /**
   * Increment DAO member count
   */
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

  /**
   * Set DAO invite code
   */
  async setDaoInviteCode(daoId: string, code: string): Promise<any> {
    if (!code) throw new Error('Invite code required');
    const result = await this.db.update(daos)
      .set({ inviteCode: code, updatedAt: new Date() })
      .where(eq(daos.id, daoId))
      .returning();
    if (!result[0]) throw new Error('DAO not found');
    return result[0];
  }

  /**
   * Update DAO invite code
   */
  // `updateDaoInviteCode` removed; `setDaoInviteCode` is canonical.

  /**
   * Get DAO by invite code
   */
  async getDaoByInviteCode(code: string): Promise<any> {
    if (!code) throw new Error('Invite code required');
    const result = await this.db.select().from(daos)
      .where(eq(daos.inviteCode, code));
    if (!result[0]) throw new Error('DAO not found');
    return result[0];
  }

  /**
   * Create DAO membership
   */
  async createDaoMembership(args: any): Promise<any> {
    if (!args.daoId || !args.userId) throw new Error('Membership must have daoId and userId');
    args.createdAt = new Date();
    args.updatedAt = new Date();
    const result = await this.db.insert(daoMemberships).values(args).returning();
    if (!result[0]) throw new Error('Failed to create membership');
    return result[0];
  }

  /**
   * Get DAO membership for a user
   */
  async getDaoMembership(daoId: string, userId: string): Promise<any> {
    if (!daoId || !userId) throw new Error('DAO ID and User ID required');
    const result = await this.db.select().from(daoMemberships)
      .where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, userId)));
    if (!result[0]) throw new Error('Membership not found');
    return result[0];
  }

  /**
   * Get all members of a DAO with optional filtering
   * ⚠️ PERSISTENCE GAP: No permissions matrix or detailed role capabilities
   */
  async getDaoMembers(
    daoId: string, 
    userId?: string, 
    status?: string, 
    role?: string, 
    limit: number = 10, 
    offset: number = 0
  ): Promise<any[]> {
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

  /**
   * Get memberships by status
   */
  async getDaoMembershipsByStatus(daoId: string, status: any): Promise<any> {
    if (!daoId || !status) throw new Error('DAO ID and status required');
    return await this.db.select().from(daoMemberships)
      .where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.status, status)));
  }

  /**
   * Update DAO membership status
   */
  async updateDaoMembershipStatus(membershipId: string, status: any): Promise<any> {
    const result = await this.db.update(daoMemberships)
      .set({ status, updatedAt: new Date() })
      .where(eq(daoMemberships.id, membershipId))
      .returning();
    return result[0];
  }

  /**
   * Get DAO subscription plan
   * ⚠️ PERSISTENCE GAP: No DAO-specific settings table
   */
  async getDaoPlan(daoId: string): Promise<any> {
    if (!daoId) throw new Error('DAO ID required');
    const result = await this.db.select().from(daos)
      .where(eq(daos.id, daoId));
    if (!result[0]) throw new Error('DAO not found');
    return result[0].plan;
  }

  /**
   * Set DAO subscription plan
   */
  async setDaoPlan(daoId: string, plan: string, planExpiresAt: Date | null): Promise<any> {
    if (!daoId || !plan) throw new Error('DAO ID and plan required');
    const result = await this.db.update(daos)
      .set({ plan, planExpiresAt, updatedAt: new Date() })
      .where(eq(daos.id, daoId))
      .returning();
    if (!result[0]) throw new Error('Failed to set DAO plan');
    return result[0];
  }

  /**
   * Get DAO settings by key (Gap #1: DAO settings persistence)
   */
  async getDaoSetting(daoId: string, settingKey: string): Promise<any> {
    if (!daoId || !settingKey) throw new Error('DAO ID and setting key required');
    const result = await this.db.select().from(daoSettings)
      .where(and(eq(daoSettings.daoId, daoId), eq(daoSettings.settingKey, settingKey)));
    return result[0] || null;
  }

  /**
   * Get all DAO settings
   */
  async getDaoSettings(daoId: string): Promise<any[]> {
    if (!daoId) throw new Error('DAO ID required');
    return await this.db.select().from(daoSettings)
      .where(eq(daoSettings.daoId, daoId));
  }

  /**
   * Update or create DAO setting
   */
  async upsertDaoSetting(daoId: string, settingKey: string, settingValue: any, metadata: any = {}): Promise<any> {
    if (!daoId || !settingKey) throw new Error('DAO ID and setting key required');
    
    const existing = await this.getDaoSetting(daoId, settingKey);
    if (existing) {
      const result = await this.db.update(daoSettings)
        .set({ settingValue, updatedAt: new Date() })
        .where(and(eq(daoSettings.daoId, daoId), eq(daoSettings.settingKey, settingKey)))
        .returning();
      return result[0];
    } else {
      const result = await this.db.insert(daoSettings).values({
        daoId,
        settingKey,
        settingValue,
        settingType: metadata.settingType || 'json',
        category: metadata.category || 'general',
        description: metadata.description,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      return result[0];
    }
  }

  /**
   * Delete DAO setting
   */
  async deleteDaoSetting(daoId: string, settingKey: string): Promise<boolean> {
    if (!daoId || !settingKey) throw new Error('DAO ID and setting key required');
    const result = await this.db.delete(daoSettings)
      .where(and(eq(daoSettings.daoId, daoId), eq(daoSettings.settingKey, settingKey)));
    return (result?.rowCount ?? 0) > 0;
  }

  /**
   * Create or track referral reward per DAO (Medium Gap #2: Referral rewards per DAO)
   */
  async createDaoReferralReward(rewardData: any): Promise<any> {
    if (!rewardData.daoId || !rewardData.referrerId || !rewardData.referredUserId || !rewardData.rewardAmount) {
      throw new Error('DAO ID, referrer ID, referred user ID, and reward amount required');
    }
    const result = await this.db.insert(referralRewards).values({
      daoId: rewardData.daoId,
      referrerId: rewardData.referrerId,
      referredUserId: rewardData.referredUserId,
      rewardAmount: rewardData.rewardAmount.toString(),
      rewardType: rewardData.rewardType || 'signup',
      status: 'pending',
      awardedAt: rewardData.awardedAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  /**
   * Get DAO referral rewards for user
   */
  async getDaoReferralRewards(daoId: string, userId?: string): Promise<any[]> {
    if (!daoId) throw new Error('DAO ID required');
    if (userId) {
      return await this.db.select().from(referralRewards)
        .where(and(
          eq(referralRewards.daoId, daoId),
          eq(referralRewards.referrerId, userId)
        ))
        .orderBy(desc(referralRewards.createdAt));
    }
    return await this.db.select().from(referralRewards)
      .where(eq(referralRewards.daoId, daoId))
      .orderBy(desc(referralRewards.createdAt));
  }

  /**
   * Claim DAO referral reward
   */
  async claimDaoReferralReward(rewardId: string, userId: string): Promise<any> {
    if (!rewardId || !userId) throw new Error('Reward ID and user ID required');
    const result = await this.db.update(referralRewards)
      .set({
        status: 'claimed',
        claimed: true,
        claimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(referralRewards.id, rewardId))
      .returning();
    return result[0];
  }

  /**
   * Get DAO referral leaderboard
   */
  async getDaoReferralLeaderboard(daoId: string, limit: number = 10): Promise<any[]> {
    if (!daoId) throw new Error('DAO ID required');
    return await this.db.select({
      referrerId: referralRewards.referrerId,
      totalReferrals: sql<number>`count(*)`,
      totalRewards: sql<string>`sum(reward_amount)`,
    })
      .from(referralRewards)
      .where(eq(referralRewards.daoId, daoId))
      .groupBy(referralRewards.referrerId)
      .orderBy(sql`total_referrals DESC`)
      .limit(limit);
  }

  /**
   * Get DAO referral rewards by referrer (additional method for Medium Gap #2)
   */
  async getDaoReferralRewardsByReferrer(referrerId: string, daoId: string): Promise<any[]> {
    if (!referrerId || !daoId) throw new Error('Referrer ID and DAO ID required');
    return await this.db.select().from(referralRewards)
      .where(and(
        eq(referralRewards.referrerId, referrerId),
        eq(referralRewards.daoId, daoId)
      ))
      .orderBy(desc(referralRewards.createdAt));
  }

  /**
   * Get total referral rewards for referrer in DAO
   */
  async getDaoReferralRewardsTotal(daoId: string, referrerId: string): Promise<number> {
    if (!daoId || !referrerId) throw new Error('DAO ID and referrer ID required');
    const result = await this.db.select({
      total: sql<number>`cast(sum(cast(reward_amount as decimal)) as decimal)`,
    })
      .from(referralRewards)
      .where(and(
        eq(referralRewards.daoId, daoId),
        eq(referralRewards.referrerId, referrerId)
      ));
    return result[0]?.total || 0;
  }

  /**
   * Update DAO referral reward status (additional method for Medium Gap #2)
   */
  async updateDaoReferralRewardStatus(rewardId: string, status: string): Promise<any> {
    if (!rewardId || !status) throw new Error('Reward ID and status required');
    const result = await this.db.update(referralRewards)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(referralRewards.id, rewardId))
      .returning();
    return result[0];
  }
}

// Export singleton instance
export const daoStorage = new DaoStorage();
