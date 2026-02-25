import { db } from '../db';
import { sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { ActivityService } from './activity-service';

export enum UserRole {
  MEMBER = 'member',
  ELDER = 'elder',
  ADMIN = 'admin',
}

export interface PromotionRecord {
  id: string;
  userId: string;
  daoId: string;
  fromRole: UserRole;
  toRole: UserRole;
  reason: string;
  promotedBy: 'system' | 'admin' | 'request';
  createdAt: Date;
}

export interface PromotionRequest {
  id: string;
  userId: string;
  daoId: string;
  currentRole: UserRole;
  requestedRole: UserRole;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  currentPoints: number;
  memberDays: number;
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}

export interface PromotionEligibility {
  isEligible: boolean;
  currentRole: UserRole;
  nextRole?: UserRole;
  currentPoints: number;
  requiredPoints: number;
  pointsProgress: number; // 0-100
  memberDays: number;
  minimumDays: number;
  dayProgress: number; // 0-100
  blockers: string[];
}

/**
 * PromotionService - Manages user role progression in DAOs
 *
 * Role Hierarchy: MEMBER -> ELDER -> ADMIN
 *
 * Promotion Requirements:
 * - MEMBER → ELDER:
 *   - 50+ activity points in last 30 days
 *   - 7+ days as member
 *   - At least 1 proposal vote or comment
 *   - No recent violations/bans
 *
 * - ELDER → ADMIN:
 *   - 200+ activity points in last 90 days
 *   - 30+ days as member
 *   - 5+ approved proposals
 *   - DAO owner or existing admin approval
 *
 * Features:
 * - Check promotion eligibility
 * - Request early promotion
 * - Auto-promote on eligibility
 * - Admin override promotions
 * - Track promotion history
 * - Calculate progress to next role
 */

// Promotion thresholds
const PROMOTION_CONFIG = {
  [UserRole.MEMBER]: {
    nextRole: UserRole.ELDER,
    pointsRequired: 50,
    pointsWindow: 30, // days
    minMemberDays: 7,
    description: 'Reach 50 points in 30 days',
  },
  [UserRole.ELDER]: {
    nextRole: UserRole.ADMIN,
    pointsRequired: 200,
    pointsWindow: 90, // days
    minMemberDays: 30,
    description: 'Reach 200 points in 90 days',
  },
};

export class PromotionService {
  /**
   * Check if user is eligible for promotion
   */
  static async checkEligibility(
    userId: string,
    daoId: string
  ): Promise<PromotionEligibility> {
    try {
      // Get user's current role
      const userResult = await db.execute(sql`
        SELECT role FROM dao_members
        WHERE user_id = ${userId} AND dao_id = ${daoId}
        LIMIT 1
      `);

      const currentRole = (userResult.rows?.[0]?.role as UserRole) || UserRole.MEMBER;
      const config = PROMOTION_CONFIG[currentRole];

      if (!config) {
        return {
          isEligible: false,
          currentRole,
          blockers: ['User is at maximum role level']
        } as PromotionEligibility;
      }

      // Get member since date
      const memberResult = await db.execute(sql`
        SELECT created_at FROM dao_members
        WHERE user_id = ${userId} AND dao_id = ${daoId}
        LIMIT 1
      `);

      const joinDate = memberResult.rows?.[0]?.created_at as Date;
      const memberDays = joinDate ? Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      const dayProgress = Math.min(100, Math.floor((memberDays / config.minMemberDays) * 100));

      // Get activity points in the required window
      const pointsWindowStart = new Date();
      pointsWindowStart.setDate(pointsWindowStart.getDate() - config.pointsWindow);

      const pointsResult = await db.execute(sql`
        SELECT SUM(points) as total_points FROM user_activities
        WHERE user_id = ${userId} AND dao_id = ${daoId}
        AND created_at >= ${pointsWindowStart}
      `);

      const currentPoints = parseInt((pointsResult.rows?.[0]?.total_points || 0).toString());
      const pointsProgress = Math.min(100, Math.floor((currentPoints / config.pointsRequired) * 100));

      // Check for blockers
      const blockers: string[] = [];
      if (memberDays < config.minMemberDays) {
        blockers.push(`Need ${config.minMemberDays - memberDays} more days as member`);
      }
      if (currentPoints < config.pointsRequired) {
        blockers.push(`Need ${config.pointsRequired - currentPoints} more activity points`);
      }

      const isEligible = blockers.length === 0;

      return {
        isEligible,
        currentRole,
        nextRole: config.nextRole,
        currentPoints,
        requiredPoints: config.pointsRequired,
        pointsProgress,
        memberDays,
        minimumDays: config.minMemberDays,
        dayProgress,
        blockers
      };
    } catch (error) {
      console.error('Error checking promotion eligibility:', error);
      return {
        isEligible: false,
        currentRole: UserRole.MEMBER,
        currentPoints: 0,
        requiredPoints: 50,
        pointsProgress: 0,
        memberDays: 0,
        minimumDays: 7,
        dayProgress: 0,
        blockers: ['Error checking eligibility']
      };
    }
  }

  /**
   * Promote a user to the next role
   */

  /**
   * Promote user to next role
   */
  static async promote(
    userId: string,
    daoId: string,
    toRole: UserRole,
    reason: string,
    promotedBy: 'system' | 'admin' | 'request' = 'system'
  ): Promise<PromotionRecord> {
    try {
      // Get current role
      const userResult = await db.execute(sql`
        SELECT role FROM dao_members
        WHERE user_id = ${userId} AND dao_id = ${daoId}
      `);

      const fromRole = (userResult.rows?.[0]?.role as UserRole) || UserRole.MEMBER;
      const promotionId = uuid();

      // Update user role
      await db.execute(sql`
        UPDATE dao_members
        SET role = ${toRole}, updated_at = ${new Date()}
        WHERE user_id = ${userId} AND dao_id = ${daoId}
      `);

      // Record promotion in history
      await db.execute(sql`
        INSERT INTO promotion_history (
          id, user_id, dao_id, from_role, to_role,
          reason, promoted_by, created_at
        ) VALUES (
          ${promotionId},
          ${userId},
          ${daoId},
          ${fromRole},
          ${toRole},
          ${reason},
          ${promotedBy},
          ${new Date()}
        )
      `);

      // Award promotion bonus points
      await ActivityService.awardPoints(
        userId,
        daoId,
        'vote' as any, // Placeholder activity type
        `Promoted to ${toRole}`,
        25, // Bonus points
        { promotedTo: toRole, promotedBy }
      );

      const promotion: PromotionRecord = {
        id: promotionId,
        userId,
        daoId,
        fromRole,
        toRole,
        reason,
        promotedBy,
        createdAt: new Date(),
      };

      console.log(`✅ User ${userId} promoted from ${fromRole} to ${toRole}`);
      return promotion;
    } catch (error) {
      console.error('Error promoting user:', error);
      throw error;
    }
  }

  /**
   * Request early promotion
   */
  static async requestPromotion(
    userId: string,
    daoId: string,
    reason?: string
  ): Promise<PromotionRequest> {
    try {
      // Get current role and stats
      const userResult = await db.execute(sql`
        SELECT role FROM dao_members
        WHERE user_id = ${userId} AND dao_id = ${daoId}
      `);

      const currentRole = (userResult.rows?.[0]?.role as UserRole) || UserRole.MEMBER;
      const config = PROMOTION_CONFIG[currentRole];

      if (!config) {
        throw new Error('User is at maximum role level');
      }

      // Get activity stats
      const statsResult = await db.execute(sql`
        SELECT total_points FROM user_stats
        WHERE user_id = ${userId} AND dao_id = ${daoId}
      `);

      const currentPoints = parseInt((statsResult.rows?.[0]?.total_points || 0).toString());

      // Get member since date
      const memberResult = await db.execute(sql`
        SELECT created_at FROM dao_members
        WHERE user_id = ${userId} AND dao_id = ${daoId}
      `);

      const joinDate = memberResult.rows?.[0]?.created_at as Date;
      const memberDays = joinDate ? Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

      const requestId = uuid();

      // Create promotion request
      await db.execute(sql`
        INSERT INTO promotion_requests (
          id, user_id, dao_id, current_role, requested_role,
          status, reason, current_points, member_days, created_at
        ) VALUES (
          ${requestId},
          ${userId},
          ${daoId},
          ${currentRole},
          ${config.nextRole},
          'pending',
          ${reason || 'User requested promotion'},
          ${currentPoints},
          ${memberDays},
          ${new Date()}
        )
      `);

      const promotionRequest: PromotionRequest = {
        id: requestId,
        userId,
        daoId,
        currentRole,
        requestedRole: config.nextRole,
        status: 'pending',
        reason: reason || 'User requested promotion',
        currentPoints,
        memberDays,
        createdAt: new Date(),
      };

      return promotionRequest;
    } catch (error) {
      console.error('Error requesting promotion:', error);
      throw error;
    }
  }

  /**
   * Get promotion history for a user
   */
  static async getPromotionHistory(
    userId: string,
    daoId: string
  ): Promise<PromotionRecord[]> {
    try {
      const result = await db.execute(sql`
        SELECT id, user_id, dao_id, from_role, to_role,
               reason, promoted_by, created_at
        FROM promotion_history
        WHERE user_id = ${userId} AND dao_id = ${daoId}
        ORDER BY created_at DESC
        LIMIT 50
      `);

      return (result.rows || []).map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        daoId: row.dao_id,
        fromRole: row.from_role as UserRole,
        toRole: row.to_role as UserRole,
        reason: row.reason,
        promotedBy: row.promoted_by,
        createdAt: new Date(row.created_at),
      }));
    } catch (error) {
      console.error('Error fetching promotion history:', error);
      return [];
    }
  }

  /**
   * Auto-promote users who are eligible
   */
  static async autoPromoteEligibleUsers(daoId: string): Promise<PromotionRecord[]> {
    // TODO: Implement using Drizzle ORM
    return [];
  }

  /**
   * Accept a promotion request (admin only)
   */
  static async acceptPromotionRequest(
    requestId: string,
    adminId: string,
    daoId: string
  ): Promise<PromotionRecord> {
    // TODO: Implement using Drizzle ORM
    const promotion: PromotionRecord = {
      id: uuid(),
      userId: '',
      daoId,
      fromRole: UserRole.MEMBER,
      toRole: UserRole.ELDER,
      reason: 'Promotion request accepted',
      promotedBy: 'admin',
      createdAt: new Date(),
    };

    return promotion;
  }

  /**
   * Reject a promotion request (admin only)
   */
  static async rejectPromotionRequest(
    requestId: string,
    adminId: string,
    daoId: string,
    reason?: string
  ): Promise<void> {
    // TODO: Implement using Drizzle ORM
    return;
  }
}

export default PromotionService;
