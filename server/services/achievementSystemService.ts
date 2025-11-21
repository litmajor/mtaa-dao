import { db } from '../storage';
import { eq, and, gte, sql, desc, lt, isNotNull, inArray, count } from 'drizzle-orm';
import {
  achievements,
  userAchievementProgress,
  achievementBadges,
  userAchievementBadges,
  achievementMilestones,
  userMilestoneProgress,
  achievementLeaderboard,
  achievementEvents,
  specialEventAchievements,
  achievementStatusEnum,
  achievementTierEnum
} from '../../shared/achievementSystemSchema';
import { ethers } from 'ethers';

export class AchievementSystemService {
  private static nftContract: any;
  
  // Initialize NFT contract connection
  static async initializeContract(contractAddress: string, abi: any[]) {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);
    this.nftContract = new ethers.Contract(contractAddress, abi, signer);
  }
  
  // ============ Achievement Management ============
  
  /**
   * Create new achievement definition
   */
  static async createAchievement(data: {
    name: string;
    description: string;
    category: string;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legendary';
    criteria: any;
    rewardPoints: number;
    rewardTokens: string;
    nftMintable?: boolean;
    nftRarity?: string;
    nftImageUrl?: string;
    nftMetadataUri?: string;
    icon?: string;
    badgeColor?: string;
    tags?: string[];
  }) {
    const [achievement] = await db
      .insert(achievements)
      .values({
        name: data.name,
        description: data.description,
        category: data.category as any,
        tier: data.tier,
        criteria: data.criteria,
        rewardPoints: data.rewardPoints,
        rewardTokens: data.rewardTokens,
        nftMintable: data.nftMintable || false,
        nftRarity: data.nftRarity,
        nftImageUrl: data.nftImageUrl,
        nftMetadataUri: data.nftMetadataUri,
        icon: data.icon,
        badgeColor: data.badgeColor,
      })
      .returning();
    
    return achievement;
  }
  
  /**
   * Get all active achievements
   */
  static async getAllAchievements(options?: { category?: string; tier?: string; hidden?: boolean }) {
    const whereConditions: any[] = [eq(achievements.isActive, true)];
    
    if (options?.category) {
      whereConditions.push(eq(achievements.category, options.category as any));
    }
    
    if (options?.tier) {
      whereConditions.push(eq(achievements.tier, options.tier as any));
    }
    
    if (!options?.hidden) {
      whereConditions.push(eq(achievements.isHidden, false));
    }
    
    const result = await db
      .select()
      .from(achievements)
      .where(and(...whereConditions));
    
    return result;
  }
  
  /**
   * Get achievement by ID
   */
  static async getAchievementById(achievementId: string) {
    const [achievement] = await db
      .select()
      .from(achievements)
      .where(eq(achievements.id, achievementId))
      .limit(1);
    
    return achievement;
  }
  
  /**
   * Update achievement
   */
  static async updateAchievement(achievementId: string, updates: Partial<typeof achievements.$inferInsert>) {
    await db
      .update(achievements)
      .set(updates)
      .where(eq(achievements.id, achievementId));
  }
  
  // ============ User Progress Tracking ============
  
  /**
   * Get user achievement progress
   */
  static async getUserAchievementProgress(userId: string) {
    const progress = await db
      .select({
        progress: userAchievementProgress,
        achievement: achievements
      })
      .from(userAchievementProgress)
      .leftJoin(achievements, eq(userAchievementProgress.achievementId, achievements.id))
      .where(eq(userAchievementProgress.userId, userId));
    
    return progress;
  }
  
  /**
   * Update user achievement progress
   */
  static async updateUserProgress(
    userId: string,
    achievementId: string,
    progressValue: number,
    progressPercent: number
  ) {
    // Get or create progress record
    const existing = await db
      .select()
      .from(userAchievementProgress)
      .where(
        and(
          eq(userAchievementProgress.userId, userId),
          eq(userAchievementProgress.achievementId, achievementId)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      await db
        .update(userAchievementProgress)
        .set({
          progressValue: progressValue.toString(),
          progressPercent,
          lastCheckedAt: new Date()
        })
        .where(eq(userAchievementProgress.id, existing[0].id));
      
      return existing[0];
    } else {
      const [newProgress] = await db
        .insert(userAchievementProgress)
        .values({
          userId,
          achievementId,
          status: 'locked',
          progressValue: progressValue.toString(),
          progressPercent,
          lastCheckedAt: new Date()
        })
        .returning();
      
      return newProgress;
    }
  }
  
  /**
   * Unlock achievement for user
   */
  static async unlockAchievement(
    userId: string,
    achievementId: string,
    metadata?: any
  ) {
    const achievement = await this.getAchievementById(achievementId);
    if (!achievement) throw new Error('Achievement not found');
    
    // Check if already unlocked
    const existing = await db
      .select()
      .from(userAchievementProgress)
      .where(
        and(
          eq(userAchievementProgress.userId, userId),
          eq(userAchievementProgress.achievementId, achievementId),
          isNotNull(userAchievementProgress.unlockedAt)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0]; // Already unlocked
    }
    
    // Update or create progress
    const progressRecords = await db
      .select()
      .from(userAchievementProgress)
      .where(
        and(
          eq(userAchievementProgress.userId, userId),
          eq(userAchievementProgress.achievementId, achievementId)
        )
      )
      .limit(1);
    
    let progressId: string;
    if (progressRecords.length > 0) {
      await db
        .update(userAchievementProgress)
        .set({
          status: 'unlocked',
          progressPercent: 100,
          unlockedAt: new Date(),
          notificationSent: false
        })
        .where(eq(userAchievementProgress.id, progressRecords[0].id));
      
      progressId = progressRecords[0].id;
    } else {
      const [newProgress] = await db
        .insert(userAchievementProgress)
        .values({
          userId,
          achievementId,
          status: 'unlocked',
          progressValue: '1',
          progressPercent: 100,
          unlockedAt: new Date(),
          notificationSent: false
        })
        .returning();
      
      progressId = newProgress.id;
    }
    
    // Record event
    await this.recordAchievementEvent(userId, achievementId, 'unlocked', metadata);
    
    return progressId;
  }
  
  /**
   * Claim achievement reward
   */
  static async claimAchievementReward(userId: string, achievementId: string) {
    const progress = await db
      .select()
      .from(userAchievementProgress)
      .where(
        and(
          eq(userAchievementProgress.userId, userId),
          eq(userAchievementProgress.achievementId, achievementId),
          eq(userAchievementProgress.status, 'unlocked')
        )
      )
      .limit(1);
    
    if (progress.length === 0) {
      throw new Error('Achievement not unlocked');
    }
    
    // Update status to claimed
    await db
      .update(userAchievementProgress)
      .set({
        status: 'claimed',
        claimedAt: new Date()
      })
      .where(eq(userAchievementProgress.id, progress[0].id));
    
    // Record event
    await this.recordAchievementEvent(userId, achievementId, 'claimed');
    
    return true;
  }
  
  // ============ NFT Minting ============
  
  /**
   * Mint achievement NFT
   */
  static async mintAchievementNFT(
    userId: string,
    achievementId: string,
    walletAddress: string
  ) {
    const achievement = await this.getAchievementById(achievementId);
    if (!achievement || !achievement.nftMintable) {
      throw new Error('Achievement not eligible for NFT minting');
    }
    
    if (!this.nftContract) {
      throw new Error('NFT contract not initialized');
    }
    
    try {
      // Call contract to mint
      const tx = await this.nftContract.mintAchievement(
        walletAddress,
        achievement.name,
        achievement.category,
        this.tierToNumber(achievement.tier),
        this.rarityToNumber(achievement.nftRarity || 'common'),
        achievement.rewardPoints,
        achievement.rewardTokens,
        achievement.nftImageUrl,
        achievement.nftMetadataUri,
        achievement.nftTradeableAfterDays === 0,
        false // burnable
      );
      
      const receipt = await tx.wait();
      const tokenId = receipt?.events?.[0]?.args?.tokenId?.toString();
      
      // Update progress
      await db
        .update(userAchievementProgress)
        .set({
          status: 'nft_minted',
          nftMintedAt: new Date(),
          nftTokenId: tokenId,
          nftContractAddress: this.nftContract.address,
          nftTransactionHash: receipt?.transactionHash,
          nftTradeableAt: new Date(Date.now() + (achievement.nftTradeableAfterDays || 0) * 24 * 60 * 60 * 1000)
        })
        .where(
          and(
            eq(userAchievementProgress.userId, userId),
            eq(userAchievementProgress.achievementId, achievementId)
          )
        );
      
      // Record event
      await this.recordAchievementEvent(userId, achievementId, 'nft_minted', {
        tokenId,
        transactionHash: receipt?.transactionHash
      });
      
      return {
        tokenId,
        transactionHash: receipt?.transactionHash,
        success: true
      };
    } catch (err) {
      console.error('NFT minting failed:', err);
      throw err;
    }
  }
  
  // ============ Milestones ============
  
  /**
   * Create achievement milestone
   */
  static async createMilestone(data: {
    achievementId: string;
    level: number;
    name: string;
    description?: string;
    thresholdValue: number;
    rewardBonus?: number;
    nftMintable?: boolean;
    icon?: string;
  }) {
    const [milestone] = await db
      .insert(achievementMilestones)
      .values({
        ...data,
        thresholdValue: data.thresholdValue.toString(),
        order: data.level
      })
      .returning();
    
    return milestone;
  }
  
  /**
   * Check and unlock milestones for user
   */
  static async checkMilestones(userId: string, achievementId: string, currentValue: number) {
    const milestones = await db
      .select()
      .from(achievementMilestones)
      .where(eq(achievementMilestones.achievementId, achievementId))
      .orderBy(achievementMilestones.order);
    
    const unlockedMilestones = [];
    
    for (const milestone of milestones) {
      if (Number(milestone.thresholdValue) <= currentValue) {
        // Check if already unlocked
        const existing = await db
          .select()
          .from(userMilestoneProgress)
          .where(
            and(
              eq(userMilestoneProgress.userId, userId),
              eq(userMilestoneProgress.milestoneId, milestone.id),
              eq(userMilestoneProgress.completed, true)
            )
          )
          .limit(1);
        
        if (existing.length === 0) {
          // Unlock milestone
          await db
            .insert(userMilestoneProgress)
            .values({
              userId,
              milestoneId: milestone.id,
              completed: true,
              completedAt: new Date()
            });
          
          unlockedMilestones.push(milestone);
        }
      }
    }
    
    return unlockedMilestones;
  }
  
  // ============ Badges ============
  
  /**
   * Create achievement badge
   */
  static async createBadge(data: {
    name: string;
    description?: string;
    requiredAchievementIds: string[];
    icon?: string;
    badgeColor?: string;
    imageUrl?: string;
  }) {
    const [badge] = await db
      .insert(achievementBadges)
      .values(data)
      .returning();
    
    return badge;
  }
  
  /**
   * Check and award badges for user
   */
  static async checkAndAwardBadges(userId: string) {
    const allBadges = await db
      .select()
      .from(achievementBadges)
      .where(eq(achievementBadges.isActive, true));
    
    const awardedBadges = [];
    
    for (const badge of allBadges) {
      if (!badge.requiredAchievementIds || badge.requiredAchievementIds.length === 0) {
        continue;
      }
      
      // Check if user has all required achievements
      const userProgress = await db
        .select({ count: sql<number>`count(*)` })
        .from(userAchievementProgress)
        .where(
          and(
            eq(userAchievementProgress.userId, userId),
            eq(userAchievementProgress.status, 'unlocked'),
            inArray(userAchievementProgress.achievementId, badge.requiredAchievementIds)
          )
        );
      
      if (userProgress[0]?.count === badge.requiredAchievementIds.length) {
        // Check if already awarded
        const existing = await db
          .select()
          .from(userAchievementBadges)
          .where(
            and(
              eq(userAchievementBadges.userId, userId),
              eq(userAchievementBadges.badgeId, badge.id)
            )
          )
          .limit(1);
        
        if (existing.length === 0) {
          // Award badge
          await db
            .insert(userAchievementBadges)
            .values({
              userId,
              badgeId: badge.id,
              isEquipped: false
            });
          
          awardedBadges.push(badge);
        }
      }
    }
    
    return awardedBadges;
  }
  
  /**
   * Get user badges
   */
  static async getUserBadges(userId: string) {
    const badges = await db
      .select({
        badge: achievementBadges,
        userBadge: userAchievementBadges
      })
      .from(userAchievementBadges)
      .leftJoin(achievementBadges, eq(userAchievementBadges.badgeId, achievementBadges.id))
      .where(eq(userAchievementBadges.userId, userId));
    
    return badges;
  }
  
  // ============ Leaderboard ============
  
  /**
   * Update leaderboard rankings
   */
  static async updateLeaderboard() {
    // Get all users with achievements
    const userAchievementCounts = await db
      .select({
        userId: userAchievementProgress.userId,
        count: sql<number>`count(${userAchievementProgress.id})`,
        totalRewardPoints: sql<number>`sum(${achievements.rewardPoints})`,
      })
      .from(userAchievementProgress)
      .leftJoin(achievements, eq(userAchievementProgress.achievementId, achievements.id))
      .where(eq(userAchievementProgress.status, 'unlocked'))
      .groupBy(userAchievementProgress.userId)
      .orderBy(desc(sql`count`));
    
    // Clear and rebuild leaderboard
    await db.delete(achievementLeaderboard);
    
    for (let i = 0; i < userAchievementCounts.length; i++) {
      const userData = userAchievementCounts[i];
      const tier = this.calculateTier(userData.count || 0);
      
      await db.insert(achievementLeaderboard).values({
        userId: userData.userId,
        totalAchievements: userData.count || 0,
        unlockedAchievements: userData.count || 0,
        totalRewardPoints: userData.totalRewardPoints || 0,
        totalRewardTokens: '0',
        nftCount: 0,
        tier: tier as any,
        rank: i + 1,
        percentile: Math.round(((i + 1) / userAchievementCounts.length) * 100)
      });
    }
  }
  
  /**
   * Get top achievers
   */
  static async getTopAchievers(limit: number = 10) {
    const topAchievers = await db
      .select()
      .from(achievementLeaderboard)
      .orderBy(desc(achievementLeaderboard.rank))
      .limit(limit);
    
    return topAchievers;
  }
  
  // ============ Events & Analytics ============
  
  /**
   * Record achievement event
   */
  static async recordAchievementEvent(
    userId: string,
    achievementId: string,
    eventType: 'unlocked' | 'claimed' | 'nft_minted' | 'shared',
    metadata?: any
  ) {
    await db.insert(achievementEvents).values({
      userId,
      achievementId,
      eventType,
      metadata: JSON.stringify(metadata || {})
    });
  }
  
  /**
   * Get user achievement stats
   */
  static async getUserAchievementStats(userId: string) {
    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(userAchievementProgress)
      .where(
        and(
          eq(userAchievementProgress.userId, userId),
          isNotNull(userAchievementProgress.unlockedAt)
        )
      );
    
    const claimed = await db
      .select({ count: sql<number>`count(*)` })
      .from(userAchievementProgress)
      .where(
        and(
          eq(userAchievementProgress.userId, userId),
          eq(userAchievementProgress.status, 'claimed')
        )
      );
    
    const nftMinted = await db
      .select({ count: sql<number>`count(*)` })
      .from(userAchievementProgress)
      .where(
        and(
          eq(userAchievementProgress.userId, userId),
          eq(userAchievementProgress.status, 'nft_minted')
        )
      );
    
    return {
      totalUnlocked: total[0]?.count || 0,
      totalClaimed: claimed[0]?.count || 0,
      totalNFTMinted: nftMinted[0]?.count || 0,
      completionRate: total[0]?.count ? ((claimed[0]?.count || 0) / (total[0]?.count || 1)) * 100 : 0
    };
  }
  
  // ============ Helper Functions ============
  
  private static tierToNumber(tier: string): number {
    const tierMap: { [key: string]: number } = {
      'bronze': 1,
      'silver': 2,
      'gold': 3,
      'platinum': 4,
      'diamond': 5,
      'legendary': 6
    };
    return tierMap[tier] || 1;
  }
  
  private static rarityToNumber(rarity: string): number {
    const rarityMap: { [key: string]: number } = {
      'common': 1,
      'uncommon': 2,
      'rare': 3,
      'epic': 4
    };
    return rarityMap[rarity] || 1;
  }
  
  private static calculateTier(achievementCount: number): 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legendary' {
    if (achievementCount >= 100) return 'legendary';
    if (achievementCount >= 80) return 'diamond';
    if (achievementCount >= 60) return 'platinum';
    if (achievementCount >= 40) return 'gold';
    if (achievementCount >= 20) return 'silver';
    return 'bronze';
  }
}
