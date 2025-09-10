
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
import { db } from './storage';
import { 
  userReputation, 
  users,
  proposals,
  votes,
  contributions,
  tasks,
  daoMemberships
} from '../shared/schema';
import { eq, and, sum, desc, sql } from 'drizzle-orm';

export interface ReputationUpdate {
  userId: string;
  daoId?: string;
  action: 'proposal_created' | 'proposal_passed' | 'vote_cast' | 'contribution_made' | 'task_completed' | 'task_verified' | 'helpful_comment' | 'spam_penalty';
  points: number;
  metadata?: any;
}

export class ReputationService {
  
  // Reputation scoring constants
  static readonly SCORING = {
    PROPOSAL_CREATED: 10,
    PROPOSAL_PASSED: 25,
    PROPOSAL_FAILED: -5,
    VOTE_CAST: 2,
    EARLY_VOTE: 5, // Bonus for voting early
    CONTRIBUTION_MADE: 5, // Base points per cUSD contributed
    LARGE_CONTRIBUTION: 20, // Bonus for contributions > 100 cUSD
    TASK_COMPLETED: 15,
    TASK_VERIFIED: 10,
    TASK_REJECTED: -10,
    HELPFUL_COMMENT: 3,
    SPAM_PENALTY: -20,
    CONSECUTIVE_PARTICIPATION: 5, // Bonus for consecutive voting
    LEADERSHIP_BONUS: 50 // Bonus for being promoted to elder/admin
  };
  
  // Update user reputation
  static async updateReputation(update: ReputationUpdate): Promise<void> {
    try {
      const { userId, daoId, action, points, metadata } = update;
      
      // Get or create reputation record
      let reputationRecord = await db.query.userReputation.findFirst({
        where: daoId 
          ? and(eq(userReputation.userId, userId), eq(userReputation.daoId, daoId))
          : and(eq(userReputation.userId, userId), sql`dao_id IS NULL`)
      });
      
      if (!reputationRecord) {
        // Create new reputation record
        const [newRecord] = await db.insert(userReputation).values({
          userId,
          daoId: daoId || null,
          totalScore: points,
          proposalScore: action.includes('proposal') ? points : 0,
          voteScore: action.includes('vote') ? points : 0,
          contributionScore: action.includes('contribution') ? points : 0
        }).returning();
        
        reputationRecord = newRecord;
      } else {
        // Update existing record
        const updates: any = {
          totalScore: reputationRecord.totalScore + points,
          lastUpdated: new Date()
        };
        
        if (action.includes('proposal')) {
          updates.proposalScore = reputationRecord.proposalScore + points;
        } else if (action.includes('vote')) {
          updates.voteScore = reputationRecord.voteScore + points;
        } else if (action.includes('contribution')) {
          updates.contributionScore = reputationRecord.contributionScore + points;
        }
        
        await db.update(userReputation)
          .set(updates)
          .where(eq(userReputation.id, reputationRecord.id));
      }
      
      // Update user's global voting power based on reputation
      await this.updateVotingPower(userId, daoId);
      
      console.log(`Updated reputation for user ${userId}: ${action} (+${points} points)`);
      
    } catch (error) {
      console.error('Error updating reputation:', error);
    }
  }
  
  // Calculate and update voting power based on reputation
  static async updateVotingPower(userId: string, daoId?: string): Promise<void> {
    try {
      const reputationRecord = await db.query.userReputation.findFirst({
        where: daoId 
          ? and(eq(userReputation.userId, userId), eq(userReputation.daoId, daoId))
          : and(eq(userReputation.userId, userId), sql`dao_id IS NULL`)
      });
      
      if (!reputationRecord) return;
      
      // Calculate voting power based on reputation score
      // Base voting power is 1.0, can increase up to 3.0 based on reputation
      const baseVotingPower = 1.0;
      const maxVotingPower = 3.0;
      const reputationThreshold = 1000; // Max reputation for calculation
      
      const votingPowerMultiplier = Math.min(
        reputationRecord.totalScore / reputationThreshold,
        maxVotingPower - baseVotingPower
      );
      
      const newVotingPower = baseVotingPower + votingPowerMultiplier;
      
      if (daoId) {
        // Update DAO-specific voting power (if we implement per-DAO voting power)
        // For now, we'll update the global user voting power
        await db.update(users)
          .set({ votingPower: newVotingPower.toFixed(2) })
          .where(eq(users.id, userId));
      } else {
        // Update global voting power
        await db.update(users)
          .set({ votingPower: newVotingPower.toFixed(2) })
          .where(eq(users.id, userId));
      }
      
    } catch (error) {
      console.error('Error updating voting power:', error);
    }
  }
  
  // Process proposal-related reputation updates
  static async processProposalReputation(proposalId: string): Promise<void> {
    try {
      const proposal = await db.query.proposals.findFirst({
        where: eq(proposals.id, proposalId)
      });
      
      if (!proposal) return;
      
      // Award points to proposer based on outcome
      if (proposal.status === 'passed') {
        await this.updateReputation({
          userId: proposal.proposerId,
          daoId: proposal.daoId,
          action: 'proposal_passed',
          points: this.SCORING.PROPOSAL_PASSED
        });
      } else if (proposal.status === 'failed') {
        await this.updateReputation({
          userId: proposal.proposerId,
          daoId: proposal.daoId,
          action: 'proposal_created',
          points: this.SCORING.PROPOSAL_FAILED
        });
      }
      
      // Award points to voters
      const proposalVotes = await db.query.votes.findMany({
        where: eq(votes.proposalId, proposalId)
      });
      
      for (const vote of proposalVotes) {
        let votePoints = this.SCORING.VOTE_CAST;
        
        // Early voting bonus (voted in first 25% of voting period)
        const votingStart = new Date(proposal.voteStartTime);
        const votingEnd = new Date(proposal.voteEndTime);
        const voteTime = new Date(vote.createdAt);
        const votingDuration = votingEnd.getTime() - votingStart.getTime();
        const voteTimestamp = voteTime.getTime() - votingStart.getTime();
        
        if (voteTimestamp <= votingDuration * 0.25) {
          votePoints += this.SCORING.EARLY_VOTE;
        }
        
        await this.updateReputation({
          userId: vote.userId,
          daoId: proposal.daoId,
          action: 'vote_cast',
          points: votePoints
        });
      }
      
    } catch (error) {
      console.error('Error processing proposal reputation:', error);
    }
  }
  
  // Process contribution-related reputation updates
  static async processContributionReputation(contributionId: string): Promise<void> {
    try {
      const contribution = await db.query.contributions.findFirst({
        where: eq(contributions.id, contributionId)
      });
      
      if (!contribution) return;
      
      const amount = parseFloat(contribution.amount);
      let points = Math.floor(amount * this.SCORING.CONTRIBUTION_MADE);
      
      // Large contribution bonus
      if (amount >= 100) {
        points += this.SCORING.LARGE_CONTRIBUTION;
      }
      
      await this.updateReputation({
        userId: contribution.userId,
        daoId: contribution.daoId,
        action: 'contribution_made',
        points,
        metadata: { amount: contribution.amount, currency: contribution.currency }
      });
      
    } catch (error) {
      console.error('Error processing contribution reputation:', error);
    }
  }
  
  // Process task-related reputation updates
  static async processTaskReputation(taskId: string, action: 'completed' | 'verified' | 'rejected'): Promise<void> {
    try {
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, taskId)
      });
      
      if (!task || !task.claimerId) return;
      
      let points = 0;
      let reputationAction: ReputationUpdate['action'];
      
      switch (action) {
        case 'completed':
          points = this.SCORING.TASK_COMPLETED;
          reputationAction = 'task_completed';
          break;
        case 'verified':
          points = this.SCORING.TASK_VERIFIED;
          reputationAction = 'task_verified';
          break;
        case 'rejected':
          points = this.SCORING.TASK_REJECTED;
          reputationAction = 'task_completed'; // Use same action type
          break;
      }
      
      await this.updateReputation({
        userId: task.claimerId,
        daoId: task.daoId,
        action: reputationAction,
        points,
        metadata: { taskId, taskTitle: task.title, reward: task.reward }
      });
      
    } catch (error) {
      console.error('Error processing task reputation:', error);
    }
  }
  
  // Get user reputation across all DAOs
  static async getUserReputation(userId: string): Promise<any> {
    try {
      const reputationRecords = await db.query.userReputation.findMany({
        where: eq(userReputation.userId, userId)
      });
      
      const totalReputation = reputationRecords.reduce((sum, record) => sum + record.totalScore, 0);
      const globalRecord = reputationRecords.find(r => !r.daoId);
      const daoSpecific = reputationRecords.filter(r => r.daoId);
      
      return {
        totalReputation,
        globalReputation: globalRecord?.totalScore || 0,
        daoSpecificReputation: daoSpecific,
        breakdown: {
          proposalScore: reputationRecords.reduce((sum, r) => sum + r.proposalScore, 0),
          voteScore: reputationRecords.reduce((sum, r) => sum + r.voteScore, 0),
          contributionScore: reputationRecords.reduce((sum, r) => sum + r.contributionScore, 0)
        }
      };
    } catch (error) {
      console.error('Error getting user reputation:', error);
      return { totalReputation: 0, globalReputation: 0, daoSpecificReputation: [], breakdown: {} };
    }
  }
  
  // Get reputation leaderboard
  static async getReputationLeaderboard(daoId?: string, limit: number = 20): Promise<any[]> {
    try {
      const whereClause = daoId 
        ? eq(userReputation.daoId, daoId)
        : sql`dao_id IS NULL`;
      
      const leaderboard = await db
        .select({
          userId: userReputation.userId,
          totalScore: userReputation.totalScore,
          proposalScore: userReputation.proposalScore,
          voteScore: userReputation.voteScore,
          contributionScore: userReputation.contributionScore,
          username: users.username,
          profileImageUrl: users.profileImageUrl
        })
        .from(userReputation)
        .leftJoin(users, eq(userReputation.userId, users.id))
        .where(whereClause)
        .orderBy(desc(userReputation.totalScore))
        .limit(limit);
      
      return leaderboard;
    } catch (error) {
      console.error('Error getting reputation leaderboard:', error);
      return [];
    }
  }
  
  // Recalculate all user reputations (admin function)
  static async recalculateAllReputations(): Promise<void> {
    try {
      console.log('Starting reputation recalculation...');
      
      // Clear existing reputation scores
      await db.update(userReputation).set({
        totalScore: 0,
        proposalScore: 0,
        voteScore: 0,
        contributionScore: 0
      });
      
      // Recalculate from proposals
      const allProposals = await db.query.proposals.findMany();
      for (const proposal of allProposals) {
        await this.processProposalReputation(proposal.id);
      }
      
      // Recalculate from contributions
      const allContributions = await db.query.contributions.findMany();
      for (const contribution of allContributions) {
        await this.processContributionReputation(contribution.id);
      }
      
      // Recalculate from completed tasks
      const completedTasks = await db.query.tasks.findMany({
        where: eq(tasks.status, 'completed')
      });
      for (const task of completedTasks) {
        await this.processTaskReputation(task.id, 'completed');
      }
      
      console.log('Reputation recalculation completed');
      
    } catch (error) {
      console.error('Error recalculating reputations:', error);
    }
  }
}
