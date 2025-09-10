import { db } from './db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { users, votes, proposals, contributions, daoMemberships } from '../shared/schema';
import { msiaMoPoints, userReputation, msiaMoConversions, airdropEligibility } from '../shared/reputationSchema';

// Reputation point values for different actions
export const REPUTATION_VALUES = {
  VOTE: 5,
  PROPOSAL_CREATED: 25,
  PROPOSAL_PASSED: 50,
  CONTRIBUTION: 10, // base points, scales with amount
  REFERRAL: 20,
  DAILY_STREAK: 5,
  WEEKLY_STREAK_BONUS: 25,
  MONTHLY_STREAK_BONUS: 100,
  DAO_MEMBERSHIP: 15,
  COMMENT: 3,
  LIKE_RECEIVED: 2,
  TASK_COMPLETION: 30,
} as const;

// Badge thresholds
export const BADGE_THRESHOLDS = {
  Bronze: 0,
  Silver: 100,
  Gold: 500,
  Platinum: 1500,
  Diamond: 5000,
} as const;

export class ReputationService {
  // Award points for specific actions
  static async awardPoints(
    userId: string,
    action: string,
    points: number,
    daoId?: string,
    description?: string,
    multiplier: number = 1.0
  ): Promise<void> {
    const finalPoints = Math.floor(points * multiplier);

    // Insert points record
    await db.insert(msiaMoPoints).values({
      userId,
      daoId,
      points: finalPoints,
      action,
      description,
      multiplier: multiplier.toString(),
    });

    // Update user reputation summary
    await this.updateUserReputation(userId);
  }

  // Calculate contribution points based on amount
  static async awardContributionPoints(userId: string, amount: number, daoId: string): Promise<void> {
    const basePoints = REPUTATION_VALUES.CONTRIBUTION;
    // Scale points with contribution amount (1 point per 10 cUSD contributed)
    const amountBonus = Math.floor(amount / 10);
    const totalPoints = basePoints + amountBonus;

    await this.awardPoints(
      userId,
      'CONTRIBUTION',
      totalPoints,
      daoId,
      `Contributed ${amount} cUSD`,
      1.0
    );
  }

  // Update user's overall reputation summary
  static async updateUserReputation(userId: string): Promise<void> {
    // Calculate total points
    const totalPointsResult = await db
      .select({ total: sql<number>`sum(${msiaMoPoints.points})` })
      .from(msiaMoPoints)
      .where(eq(msiaMoPoints.userId, userId));

    const totalPoints = totalPointsResult[0]?.total || 0;

    // Calculate weekly points (last 7 days)
    const weeklyPointsResult = await db
      .select({ total: sql<number>`sum(${msiaMoPoints.points})` })
      .from(msiaMoPoints)
      .where(
        and(
          eq(msiaMoPoints.userId, userId),
          sql`${msiaMoPoints.createdAt} >= NOW() - INTERVAL '7 days'`
        )
      );

    const weeklyPoints = weeklyPointsResult[0]?.total || 0;

    // Calculate monthly points (last 30 days)
    const monthlyPointsResult = await db
      .select({ total: sql<number>`sum(${msiaMoPoints.points})` })
      .from(msiaMoPoints)
      .where(
        and(
          eq(msiaMoPoints.userId, userId),
          sql`${msiaMoPoints.createdAt} >= NOW() - INTERVAL '30 days'`
        )
      );

    const monthlyPoints = monthlyPointsResult[0]?.total || 0;

    // Determine badge and level
    const badge = this.calculateBadge(totalPoints);
    const level = this.calculateLevel(totalPoints);
    const nextLevelPoints = this.getNextLevelThreshold(level);

    // Upsert user reputation
    const existingReputation = await db
      .select()
      .from(userReputation)
      .where(eq(userReputation.userId, userId));

    if (existingReputation.length > 0) {
      await db
        .update(userReputation)
        .set({
          totalPoints,
          weeklyPoints,
          monthlyPoints,
          badge,
          level,
          nextLevelPoints,
          lastActivity: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userReputation.userId, userId));
    } else {
      await db.insert(userReputation).values({
        userId,
        totalPoints,
        weeklyPoints,
        monthlyPoints,
        badge,
        level,
        nextLevelPoints,
        lastActivity: new Date(),
      });
    }
  }

  // Calculate badge based on total points
  static calculateBadge(totalPoints: number): string {
    if (totalPoints >= BADGE_THRESHOLDS.Diamond) return 'Diamond';
    if (totalPoints >= BADGE_THRESHOLDS.Platinum) return 'Platinum';
    if (totalPoints >= BADGE_THRESHOLDS.Gold) return 'Gold';
    if (totalPoints >= BADGE_THRESHOLDS.Silver) return 'Silver';
    return 'Bronze';
  }

  // Calculate level (every 100 points = 1 level)
  static calculateLevel(totalPoints: number): number {
    return Math.floor(totalPoints / 100) + 1;
  }

  // Get points needed for next level
  static getNextLevelThreshold(currentLevel: number): number {
    return currentLevel * 100;
  }

  // Apply reputation decay based on inactivity
  static async applyReputationDecay(userId: string): Promise<void> {
    const reputation = await db
      .select()
      .from(userReputation)
      .where(eq(userReputation.userId, userId));

    if (!reputation[0]) return;

  const lastActivityRaw = reputation[0].lastActivity;
  const lastActivity = lastActivityRaw ? new Date(lastActivityRaw) : new Date();
    const now = new Date();
    const daysSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceActivity > 7) {
      // Start decay after 7 days of inactivity
      // Lose 1% per day after the first week, max 50% total decay
      const decayDays = Math.min(daysSinceActivity - 7, 50);
      const decayFactor = 1 - (decayDays * 0.01);

    const totalPoints = reputation[0].totalPoints ?? 0;
    const decayedPoints = Math.floor(totalPoints * decayFactor);
    const pointsLost = totalPoints - decayedPoints;

      if (pointsLost > 0) {
        await db
          .update(userReputation)
          .set({
            totalPoints: decayedPoints,
            badge: this.calculateBadge(decayedPoints),
            level: this.calculateLevel(decayedPoints),
            nextLevelPoints: this.getNextLevelThreshold(this.calculateLevel(decayedPoints)),
            updatedAt: new Date(),
          })
          .where(eq(userReputation.userId, userId));

        // Log decay event
        await this.awardPoints(
          userId,
          'REPUTATION_DECAY',
          -pointsLost,
          undefined,
          `Reputation decay: ${pointsLost} points lost due to ${daysSinceActivity} days of inactivity`,
          1.0
        );
      }
    }
  }

  // Run decay for all users (scheduled job)
  static async runGlobalReputationDecay(): Promise<{ processed: number; decayed: number }> {
    const allUsers = await db.select().from(userReputation);
    let processed = 0;
    let decayed = 0;

    for (const user of allUsers) {
  const beforePoints = user.totalPoints ?? 0;
      await this.applyReputationDecay(user.userId);

      // Check if points actually decayed
      const afterReputation = await db
        .select()
        .from(userReputation)
        .where(eq(userReputation.userId, user.userId));

  if (afterReputation[0] && (afterReputation[0].totalPoints ?? 0) < beforePoints) {
        decayed++;
      }
      processed++;
    }

    return { processed, decayed };
  }

  // Get user's current reputation
  static async getUserReputation(userId: string): Promise<any> {
    const reputation = await db
      .select()
      .from(userReputation)
      .where(eq(userReputation.userId, userId));

    if (reputation.length === 0) {
      // Initialize reputation for new user
      await this.updateUserReputation(userId);
      return await this.getUserReputation(userId);
    }

    // Apply decay check when getting reputation
    await this.applyReputationDecay(userId);

    // Get updated reputation after potential decay
    const updatedReputation = await db
      .select()
      .from(userReputation)
      .where(eq(userReputation.userId, userId));

    return updatedReputation[0];
  }

  // Get leaderboard
  static async getLeaderboard(limit: number = 10): Promise<any[]> {
    return await db
      .select({
        userId: userReputation.userId,
        totalPoints: userReputation.totalPoints,
        badge: userReputation.badge,
        level: userReputation.level,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
      })
      .from(userReputation)
      .leftJoin(users, eq(userReputation.userId, users.id))
      .orderBy(desc(userReputation.totalPoints))
      .limit(limit);
  }

  // Convert MsiaMo points to tokens (for airdrops)
  static async convertPointsToTokens(
    userId: string,
    pointsToConvert: number,
    conversionRate: number = 100 // 100 points = 1 token by default
  ): Promise<{ tokensReceived: number; conversionId: string }> {
    const userRep = await this.getUserReputation(userId);

    if (userRep.totalPoints < pointsToConvert) {
      throw new Error('Insufficient reputation points');
    }

    const tokensReceived = pointsToConvert / conversionRate;

    // Record conversion
    const conversion = await db.insert(msiaMoConversions).values({
      userId,
      pointsConverted: pointsToConvert,
      tokensReceived: tokensReceived.toString(),
      conversionRate: conversionRate.toString(),
      status: 'pending',
    }).returning();

    return {
      tokensReceived,
      conversionId: conversion[0].id,
    };
  }

  // Check airdrop eligibility
  static async checkAirdropEligibility(
    userId: string,
    airdropId: string,
    minimumReputation: number,
    baseAmount: number
  ): Promise<{ eligible: boolean; amount: number; userReputation: number }> {
    const userRep = await this.getUserReputation(userId);
    const eligible = userRep.totalPoints >= minimumReputation;

    // Calculate airdrop amount based on reputation (bonus for higher reputation)
    let amount = baseAmount;
    if (eligible) {
      const reputationMultiplier = Math.min(userRep.totalPoints / minimumReputation, 5); // Max 5x multiplier
      amount = baseAmount * reputationMultiplier;
    }

    if (eligible) {
      // Record eligibility
      await db.insert(airdropEligibility).values({
        userId,
        airdropId,
        eligibleAmount: amount.toString(),
        minimumReputation,
        userReputation: userRep.totalPoints,
      });
    }

    return {
      eligible,
      amount,
      userReputation: userRep.totalPoints,
    };
  }

  // Automated point awarding for common actions
  static async onVote(userId: string, proposalId: string, daoId: string): Promise<void> {
    await this.awardPoints(userId, 'VOTE', REPUTATION_VALUES.VOTE, daoId, `Voted on proposal ${proposalId}`);
  }

  static async onProposalCreated(userId: string, proposalId: string, daoId: string): Promise<void> {
    await this.awardPoints(userId, 'PROPOSAL_CREATED', REPUTATION_VALUES.PROPOSAL_CREATED, daoId, `Created proposal ${proposalId}`);
  }

  static async onReferral(referrerId: string, referredId: string): Promise<void> {
    await this.awardPoints(referrerId, 'REFERRAL', REPUTATION_VALUES.REFERRAL, undefined, `Referred user ${referredId}`);
  }

  static async onDaoJoin(userId: string, daoId: string): Promise<void> {
    await this.awardPoints(userId, 'DAO_MEMBERSHIP', REPUTATION_VALUES.DAO_MEMBERSHIP, daoId, 'Joined DAO');
  }
}