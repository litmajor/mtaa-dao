/**
 * Week 1 Dashboard API Handlers
 * 
 * This module implements the 3 core Week 1 backend API endpoints:
 * 1. GET /api/users/persona-data - Detect user's persona
 * 2. GET /api/users/my-daos - List user's DAOs
 * 3. GET /api/dashboard/{persona} - Get persona-specific dashboard data
 * 
 * All endpoints require authentication and are optimized for performance.
 * Database queries are parameterized to prevent SQL injection.
 */

import { Request, Response } from 'express';
import { pool } from '../db';
import { logger } from '../logging';

// Type definitions for persona detection and dashboard data
type PersonaType = 'dao_member' | 'dao_treasurer' | 'dao_creator' | 'investor';
type UserRole = 'creator' | 'member' | 'treasurer';
type UserStatus = 'active' | 'inactive' | 'suspended';

interface PersonaData {
  userId: string;
  primaryPersona: PersonaType;
  allPersonas: PersonaType[];
  daoCount: number;
  isDAOCreator: boolean;
  totalContributions: number;
  contributionTypes: string[];
  reputationScore: number;
  lastActivityDate: Date;
}

interface DAOInfo {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  createdAt: Date;
  memberCount: number;
  treasuryUSD: number;
  userRole: UserRole;
  userStatus: UserStatus;
  isPrimary: boolean;
  joinedAt: Date;
}

interface PaginationOptions {
  limit: number;
  offset: number;
  sortBy: 'name' | 'members' | 'createdAt';
  order: 'asc' | 'desc';
}

// Helper function to get database connection
async function getConnection() {
  try {
    return await pool.getConnection();
  } catch (error) {
    logger.error('Database connection error:', error);
    throw error;
  }
}

// Helper function to detect user's primary persona
async function detectUserPersona(userId: string, conn?: any): Promise<PersonaType> {
  try {
    const connection = conn || await getConnection();

    // Get DAO membership and role information
    const [memberships] = await connection.query(
      `SELECT role, COUNT(*) as count FROM dao_members 
       WHERE user_id = ? GROUP BY role`,
      [userId]
    );

    // Check if user is a DAO creator
    const [createdDAOs] = await connection.query(
      `SELECT COUNT(*) as count FROM daos WHERE creator_id = ?`,
      [userId]
    );

    // Get user's contribution types
    const [contributions] = await connection.query(
      `SELECT DISTINCT contribution_type FROM contributions 
       WHERE user_id = ? LIMIT 10`,
      [userId]
    );

    // Determine persona based on activity
    let persona: PersonaType = 'dao_member';

    // Check for creator persona
    if (createdDAOs[0]?.count > 0) {
      persona = 'dao_creator';
    }
    // Check for treasurer persona (has treasurer role in any DAO)
    else if (memberships.some((m: any) => m.role === 'treasurer')) {
      persona = 'dao_treasurer';
    }
    // Check for investor persona (has investment_created contributions)
    else if (contributions.some((c: any) => c.contribution_type === 'investment_created')) {
      persona = 'investor';
    }

    if (conn === undefined) {
      connection.release();
    }

    return persona;
  } catch (error) {
    logger.error('Error detecting user persona:', error);
    throw error;
  }
}

/**
 * GET /api/users/persona-data
 * 
 * Detects user's primary persona based on their activity and DAO participation.
 * Returns comprehensive persona data including all detected personas and activity metrics.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * 
 * @returns {Object} PersonaData object with persona detection results
 */
export async function getUserPersonaDataHandler(req: Request, res: Response) {
  const userId = (req.user as any)?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'User authentication required'
      }
    });
  }

  let connection;

  try {
    connection = await getConnection();

    // Get user details
    const [users] = await connection.query(
      `SELECT id, username, email, reputation_score, created_at 
       FROM users WHERE id = ?`,
      [userId]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    const user = users[0];

    // Get DAO counts
    const [daoCount] = await connection.query(
      `SELECT COUNT(DISTINCT dao_id) as count FROM dao_members WHERE user_id = ?`,
      [userId]
    );

    // Check if user is a DAO creator
    const [createdCount] = await connection.query(
      `SELECT COUNT(*) as count FROM daos WHERE creator_id = ?`,
      [userId]
    );

    // Get DAO roles/memberships
    const [roles] = await connection.query(
      `SELECT DISTINCT role FROM dao_members WHERE user_id = ?`,
      [userId]
    );

    // Get contribution types
    const [contributions] = await connection.query(
      `SELECT DISTINCT contribution_type FROM contributions WHERE user_id = ?`,
      [userId]
    );

    // Count total contributions
    const [contributionCount] = await connection.query(
      `SELECT COUNT(*) as count FROM contributions WHERE user_id = ?`,
      [userId]
    );

    // Get last activity
    const [lastActivity] = await connection.query(
      `SELECT created_at FROM activities WHERE user_id = ? 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    // Detect primary persona
    const primaryPersona = await detectUserPersona(userId, connection);

    // Build list of all personas
    const allPersonas: PersonaType[] = ['dao_member'];
    
    if (createdCount[0]?.count > 0) {
      allPersonas.push('dao_creator');
    }
    
    if (roles.some((r: any) => r.role === 'treasurer')) {
      allPersonas.push('dao_treasurer');
    }
    
    if (contributions.some((c: any) => c.contribution_type === 'investment_created')) {
      allPersonas.push('investor');
    }

    // Remove duplicates and keep only unique personas
    const uniquePersonas = Array.from(new Set(allPersonas));

    const response: PersonaData = {
      userId: user.id,
      primaryPersona,
      allPersonas: uniquePersonas as PersonaType[],
      daoCount: daoCount[0]?.count || 0,
      isDAOCreator: (createdCount[0]?.count || 0) > 0,
      totalContributions: contributionCount[0]?.count || 0,
      contributionTypes: contributions.map((c: any) => c.contribution_type),
      reputationScore: user.reputation_score || 0,
      lastActivityDate: lastActivity[0]?.created_at || user.created_at
    };

    return res.json({
      success: true,
      data: response
    });

  } catch (error) {
    logger.error('Error in getUserPersonaDataHandler:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve persona data'
      }
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * GET /api/users/my-daos
 * 
 * Lists all DAOs the user belongs to or has created.
 * Supports pagination, sorting, and filtering.
 * 
 * Query Parameters:
 * - limit: Maximum number of DAOs to return (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 * - sortBy: Sort field - 'name', 'members', 'createdAt' (default: 'createdAt')
 * - order: Sort order - 'asc', 'desc' (default: 'desc')
 * 
 * @param req - Express request object with query parameters
 * @param res - Express response object
 * 
 * @returns {Object} Array of DAO objects with user-specific information
 */
export async function getUserDAOsHandler(req: Request, res: Response) {
  const userId = (req.user as any)?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'User authentication required'
      }
    });
  }

  let connection;

  try {
    // Parse and validate query parameters
    let limit = parseInt(req.query.limit as string) || 50;
    let offset = parseInt(req.query.offset as string) || 0;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const order = (req.query.order as string) || 'desc';

    // Validate and sanitize parameters
    if (limit > 100) limit = 100;
    if (limit < 1) limit = 1;
    if (offset < 0) offset = 0;

    // Validate sortBy parameter
    const validSortFields = ['name', 'members', 'createdAt'];
    let sortField = 'created_at';
    
    if (sortBy === 'name') {
      sortField = 'name';
    } else if (sortBy === 'members') {
      sortField = 'member_count';
    }

    // Validate order parameter
    const orderDirection = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    connection = await getConnection();

    // Get user's DAOs with member count and treasury balance
    const query = `
      SELECT 
        d.id,
        d.name,
        d.description,
        d.image_url as imageUrl,
        d.created_at as createdAt,
        dm.role as userRole,
        dm.user_status as userStatus,
        dm.joined_at as joinedAt,
        dm.is_primary as isPrimary,
        COUNT(DISTINCT dm2.user_id) as memberCount,
        COALESCE(dt.balance_usd, 0) as treasuryUSD
      FROM daos d
      JOIN dao_members dm ON d.id = dm.dao_id
      LEFT JOIN dao_members dm2 ON d.id = dm2.dao_id
      LEFT JOIN dao_treasury dt ON d.id = dt.dao_id
      WHERE dm.user_id = ?
      GROUP BY d.id, dm.role, dm.user_status, dm.joined_at, dm.is_primary
      ORDER BY d.${sortField} ${orderDirection}
      LIMIT ? OFFSET ?
    `;

    const [daos] = await connection.query(query, [userId, limit, offset]);

    // Get total count
    const [countResult] = await connection.query(
      `SELECT COUNT(DISTINCT d.id) as total FROM daos d 
       JOIN dao_members dm ON d.id = dm.dao_id 
       WHERE dm.user_id = ?`,
      [userId]
    );

    const total = countResult[0]?.total || 0;

    // Format response
    const daoList: DAOInfo[] = daos.map((dao: any) => ({
      id: dao.id,
      name: dao.name,
      description: dao.description,
      imageUrl: dao.imageUrl,
      createdAt: dao.createdAt,
      memberCount: dao.memberCount,
      treasuryUSD: dao.treasuryUSD,
      userRole: dao.userRole as UserRole,
      userStatus: dao.userStatus as UserStatus,
      isPrimary: dao.isPrimary,
      joinedAt: dao.joinedAt
    }));

    return res.json({
      success: true,
      data: {
        daos: daoList,
        total,
        limit,
        offset
      }
    });

  } catch (error) {
    logger.error('Error in getUserDAOsHandler:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve user DAOs'
      }
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * GET /api/dashboard/{persona}
 * 
 * Returns persona-specific dashboard data with metrics and insights.
 * Response structure varies based on the persona type.
 * 
 * Supported Personas:
 * - dao_member: Activity, tasks, network metrics
 * - dao_treasurer: Treasury balances, pending approvals, financial metrics
 * - dao_creator: DAO growth, governance stats, analytics
 * - investor: Portfolio, investments, opportunities
 * 
 * @param req - Express request object with persona parameter
 * @param res - Express response object
 * 
 * @returns {Object} Persona-specific dashboard data
 */
export async function getDashboardPersonaHandler(req: Request, res: Response) {
  const userId = (req.user as any)?.id;
  const { persona } = req.params;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'User authentication required'
      }
    });
  }

  // Validate persona parameter
  const validPersonas = ['dao_member', 'dao_treasurer', 'dao_creator', 'investor'];
  if (!validPersonas.includes(persona)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_PERSONA',
        message: `Invalid persona provided: ${persona}`,
        details: {
          validPersonas
        }
      }
    });
  }

  let connection;

  try {
    connection = await getConnection();

    let dashboardData: any = {
      persona,
      summary: {},
      timestamp: new Date().toISOString()
    };

    if (persona === 'dao_member') {
      dashboardData = await getDaoMemberDashboard(userId, connection);
    } else if (persona === 'dao_treasurer') {
      dashboardData = await getDaoTreasurerDashboard(userId, connection);
    } else if (persona === 'dao_creator') {
      dashboardData = await getDaoCreatorDashboard(userId, connection);
    } else if (persona === 'investor') {
      dashboardData = await getInvestorDashboard(userId, connection);
    }

    return res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    logger.error('Error in getDashboardPersonaHandler:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve dashboard data'
      }
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Get DAO Member specific dashboard data
 */
async function getDaoMemberDashboard(userId: string, connection: any) {
  try {
    // Get active memberships
    const [activeMemberships] = await connection.query(
      `SELECT COUNT(*) as count FROM dao_members 
       WHERE user_id = ? AND user_status = 'active'`,
      [userId]
    );

    // Get contributions this month
    const [monthlyContributions] = await connection.query(
      `SELECT COUNT(*) as count FROM contributions 
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`,
      [userId]
    );

    // Get pending tasks
    const [pendingTasks] = await connection.query(
      `SELECT COUNT(*) as count FROM tasks 
       WHERE assigned_to = ? AND status NOT IN ('completed', 'cancelled')`,
      [userId]
    );

    // Get reputation score
    const [reputation] = await connection.query(
      `SELECT reputation_score FROM users WHERE id = ?`,
      [userId]
    );

    // Get recent activity
    const [recentActivity] = await connection.query(
      `SELECT 
        a.id, a.activity_type as type, d.id as daoId, d.name as daoName,
        a.description, a.created_at as timestamp, a.metadata
      FROM activities a
      LEFT JOIN daos d ON a.dao_id = d.id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
      LIMIT 10`,
      [userId]
    );

    // Get task board stats
    const [taskStats] = await connection.query(
      `SELECT status, COUNT(*) as count FROM tasks 
       WHERE assigned_to = ? GROUP BY status`,
      [userId]
    );

    // Get upcoming deadlines
    const [upcomingDeadlines] = await connection.query(
      `SELECT t.id as taskId, t.title, t.due_date as dueDate, d.name as daoName
       FROM tasks t
       LEFT JOIN daos d ON t.dao_id = d.id
       WHERE t.assigned_to = ? AND t.status NOT IN ('completed', 'cancelled')
       AND t.due_date IS NOT NULL
       ORDER BY t.due_date ASC
       LIMIT 5`,
      [userId]
    );

    // Get network metrics
    const [followers] = await connection.query(
      `SELECT COUNT(*) as count FROM user_follows 
       WHERE following_id = ? AND status = 'accepted'`,
      [userId]
    );

    const [following] = await connection.query(
      `SELECT COUNT(*) as count FROM user_follows 
       WHERE follower_id = ? AND status = 'accepted'`,
      [userId]
    );

    const [connectionRequests] = await connection.query(
      `SELECT COUNT(*) as count FROM user_follows 
       WHERE following_id = ? AND status = 'pending'`,
      [userId]
    );

    return {
      persona: 'dao_member',
      summary: {
        activeMemberships: activeMemberships[0]?.count || 0,
        contributionsThisMonth: monthlyContributions[0]?.count || 0,
        pendingTasks: pendingTasks[0]?.count || 0,
        reputationScore: reputation[0]?.reputation_score || 0
      },
      recentActivity: recentActivity.map((activity: any) => ({
        id: activity.id,
        type: activity.type,
        daoId: activity.daoId,
        daoName: activity.daoName,
        description: activity.description,
        timestamp: activity.timestamp,
        metadata: activity.metadata || {}
      })),
      taskBoard: {
        todo: taskStats.find((s: any) => s.status === 'todo')?.count || 0,
        inProgress: taskStats.find((s: any) => s.status === 'in_progress')?.count || 0,
        completed: taskStats.find((s: any) => s.status === 'completed')?.count || 0,
        upcomingDeadlines: upcomingDeadlines.map((task: any) => ({
          taskId: task.taskId,
          title: task.title,
          dueDate: task.dueDate,
          daoName: task.daoName
        }))
      },
      networkMetrics: {
        followersCount: followers[0]?.count || 0,
        followingCount: following[0]?.count || 0,
        connectionRequests: connectionRequests[0]?.count || 0
      }
    };
  } catch (error) {
    logger.error('Error getting DAO member dashboard:', error);
    throw error;
  }
}

/**
 * Get DAO Treasurer specific dashboard data
 */
async function getDaoTreasurerDashboard(userId: string, connection: any) {
  try {
    // Get DAOs managed by user as treasurer
    const [managedDAOs] = await connection.query(
      `SELECT dao_id FROM dao_members 
       WHERE user_id = ? AND role = 'treasurer'`,
      [userId]
    );

    const daoIds = managedDAOs.map((d: any) => d.dao_id);

    let treasuries = [];
    let totalTreasuryUSD = 0;
    let totalMonthlyInflow = 0;
    let totalMonthlyOutflow = 0;

    if (daoIds.length > 0) {
      // Get treasury details
      const placeholders = daoIds.map(() => '?').join(',');
      const [treasuryData] = await connection.query(
        `SELECT 
          d.id as daoId, d.name as daoName, dt.balance_usd as balance,
          COUNT(DISTINCT dm.user_id) as memberCount,
          COALESCE(SUM(CASE WHEN t.transaction_type = 'inflow' 
            AND t.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH) 
            THEN t.amount_usd ELSE 0 END), 0) as monthlyInflow,
          COALESCE(SUM(CASE WHEN t.transaction_type = 'outflow' 
            AND t.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH) 
            THEN t.amount_usd ELSE 0 END), 0) as monthlyOutflow
        FROM daos d
        JOIN dao_treasury dt ON d.id = dt.dao_id
        LEFT JOIN dao_members dm ON d.id = dm.dao_id
        LEFT JOIN treasury_transactions t ON d.id = t.dao_id
        WHERE d.id IN (${placeholders})
        GROUP BY d.id, d.name, dt.balance_usd`,
        daoIds
      );

      treasuries = treasuryData.map((t: any) => {
        totalTreasuryUSD += t.balance || 0;
        totalMonthlyInflow += t.monthlyInflow || 0;
        totalMonthlyOutflow += t.monthlyOutflow || 0;

        return {
          daoId: t.daoId,
          daoName: t.daoName,
          balance: t.balance || 0,
          currency: 'USD',
          memberCount: t.memberCount || 0,
          monthlyInflow: t.monthlyInflow || 0,
          monthlyOutflow: t.monthlyOutflow || 0
        };
      });
    }

    // Get pending approvals
    const [pendingApprovals] = await connection.query(
      `SELECT 
        ms.id, ms.transaction_type as type, ms.amount_usd as amount, 
        'USD' as currency, ms.required_signatures as requiredSignatures,
        COUNT(DISTINCT mss.signer_id) as currentSignatures, d.name as daoName
      FROM multisig_transactions ms
      LEFT JOIN multisig_signatures mss ON ms.id = mss.transaction_id
      LEFT JOIN daos d ON ms.dao_id = d.id
      WHERE ms.dao_id IN (${daoIds.length > 0 ? daoIds.map(() => '?').join(',') : 'NULL'})
      AND ms.status = 'pending_signatures'
      GROUP BY ms.id, ms.transaction_type, ms.amount_usd, 
               ms.required_signatures, d.name`,
      daoIds.length > 0 ? daoIds : []
    );

    return {
      persona: 'dao_treasurer',
      summary: {
        daosManaged: daoIds.length,
        totalTreasuryUSD,
        monthlyInflow: totalMonthlyInflow,
        monthlyOutflow: totalMonthlyOutflow
      },
      treasuries,
      pendingApprovals: pendingApprovals.map((approval: any) => ({
        id: approval.id,
        type: approval.type,
        amount: approval.amount,
        currency: approval.currency,
        requiredSignatures: approval.requiredSignatures,
        currentSignatures: approval.currentSignatures,
        daoName: approval.daoName
      })),
      financialMetrics: {
        burnRate: totalMonthlyOutflow,
        runwayMonths: totalMonthlyOutflow > 0 ? Math.round(totalTreasuryUSD / totalMonthlyOutflow) : 0,
        assetDiversification: 0.65 // Placeholder, calculate based on actual asset distribution
      }
    };
  } catch (error) {
    logger.error('Error getting DAO treasurer dashboard:', error);
    throw error;
  }
}

/**
 * Get DAO Creator specific dashboard data
 */
async function getDaoCreatorDashboard(userId: string, connection: any) {
  try {
    // Get DAOs created by user
    const [createdDAOs] = await connection.query(
      `SELECT 
        d.id, d.name, d.created_at as createdAt, 'active' as status,
        COUNT(DISTINCT dm.user_id) as memberCount,
        COUNT(DISTINCT p.id) as proposalsCount,
        COUNT(DISTINCT t.id) as tasksCount
      FROM daos d
      LEFT JOIN dao_members dm ON d.id = dm.dao_id
      LEFT JOIN proposals p ON d.id = p.dao_id
      LEFT JOIN tasks t ON d.id = t.dao_id
      WHERE d.creator_id = ?
      GROUP BY d.id, d.name, d.created_at`,
      [userId]
    );

    // Get governance metrics
    const [governanceMetrics] = await connection.query(
      `SELECT 
        d.id,
        COALESCE(AVG(DATEDIFF(p.ended_at, p.created_at)), 0) as avgProposalDuration,
        COALESCE(SUM(CASE WHEN p.status = 'approved' THEN 1 ELSE 0 END) / 
                 COUNT(p.id), 0) as proposalApprovalRate,
        COALESCE(SUM(CASE WHEN dm.last_activity_at > DATE_SUB(NOW(), INTERVAL 30 DAY) 
                         THEN 1 ELSE 0 END) / COUNT(DISTINCT dm.user_id), 0) as memberEngagementRate
      FROM daos d
      LEFT JOIN proposals p ON d.id = p.dao_id
      LEFT JOIN dao_members dm ON d.id = dm.dao_id
      WHERE d.creator_id = ?
      GROUP BY d.id`,
      [userId]
    );

    // Get member growth rate and analytics
    const [memberGrowth] = await connection.query(
      `SELECT 
        COALESCE(
          (COUNT(CASE WHEN dm.joined_at > DATE_SUB(NOW(), INTERVAL 1 MONTH) THEN 1 END) / 
           COUNT(DISTINCT d.id)) / 
          (SELECT COUNT(*) FROM dao_members WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 MONTH)) 
        , 0) as growthRate
      FROM daos d
      LEFT JOIN dao_members dm ON d.id = dm.dao_id
      WHERE d.creator_id = ?`,
      [userId]
    );

    // Get top contributors
    const [topContributors] = await connection.query(
      `SELECT u.id as userId, u.username, 
        COUNT(c.id) as contributions,
        COALESCE(u.reputation_score, 0) as reputationGain
      FROM contributions c
      JOIN users u ON c.user_id = u.id
      JOIN daos d ON c.dao_id = d.id
      WHERE d.creator_id = ?
      GROUP BY u.id, u.username, u.reputation_score
      ORDER BY contributions DESC
      LIMIT 5`,
      [userId]
    );

    return {
      persona: 'dao_creator',
      summary: {
        daosCreated: createdDAOs.length,
        totalMembers: createdDAOs.reduce((sum: number, d: any) => sum + (d.memberCount || 0), 0),
        governance: 'active'
      },
      daos: createdDAOs.map((dao: any) => ({
        daoId: dao.id,
        name: dao.name,
        createdAt: dao.createdAt,
        status: dao.status,
        memberCount: dao.memberCount || 0,
        proposalsCount: dao.proposalsCount || 0,
        tasksCount: dao.tasksCount || 0,
        governanceMetrics: {
          avgProposalDuration: Math.round(governanceMetrics[0]?.avgProposalDuration || 0),
          proposalApprovalRate: parseFloat((governanceMetrics[0]?.proposalApprovalRate || 0).toFixed(2)),
          memberEngagementRate: parseFloat((governanceMetrics[0]?.memberEngagementRate || 0).toFixed(2))
        }
      })),
      analyticsOverview: {
        memberGrowthRate: parseFloat((memberGrowth[0]?.growthRate || 0).toFixed(2)),
        engagementTrendMonth: 'up',
        topContributors: topContributors.map((c: any) => ({
          userId: c.userId,
          username: c.username,
          contributions: c.contributions,
          reputationGain: c.reputationGain
        }))
      }
    };
  } catch (error) {
    logger.error('Error getting DAO creator dashboard:', error);
    throw error;
  }
}

/**
 * Get Investor specific dashboard data
 */
async function getInvestorDashboard(userId: string, connection: any) {
  try {
    // Get user's investments
    const [investments] = await connection.query(
      `SELECT 
        i.id as investmentId, d.name as daoName, i.investment_amount as amount,
        i.current_value as currentValue, 
        ((i.current_value - i.investment_amount) / i.investment_amount * 100) as returnPercentage,
        i.created_at as investmentDate, i.shares_owned as sharesOwned
      FROM investments i
      JOIN daos d ON i.dao_id = d.id
      WHERE i.investor_id = ?
      ORDER BY i.created_at DESC`,
      [userId]
    );

    const portfolioValue = investments.reduce((sum: number, i: any) => sum + (i.currentValue || 0), 0);
    const totalInvestments = investments.reduce((sum: number, i: any) => sum + (i.amount || 0), 0);
    const investmentReturns = portfolioValue - totalInvestments;

    // Get portfolio metrics
    const [portfolioMetrics] = await connection.query(
      `SELECT 
        COALESCE(STD(i.current_value), 0) as diversification,
        'medium' as riskLevel,
        COALESCE(AVG((i.current_value - i.investment_amount) / i.investment_amount), 0) as avgReturn
      FROM investments i
      WHERE i.investor_id = ?`,
      [userId]
    );

    // Get investment opportunities
    const [opportunities] = await connection.query(
      `SELECT 
        f.id, d.name as daoName, f.funding_needed as fundingNeeded,
        f.funding_target as fundingTarget, f.funding_raised as fundingRaised,
        f.expected_return_rate as expectedReturn
      FROM fundraising_campaigns f
      JOIN daos d ON f.dao_id = d.id
      WHERE f.status = 'active'
      ORDER BY f.created_at DESC
      LIMIT 5`,
      []
    );

    return {
      persona: 'investor',
      summary: {
        portfolioValue,
        investmentsCount: investments.length,
        investmentReturnsMonth: investmentReturns / 12 // Rough estimate
      },
      investments: investments.map((inv: any) => ({
        investmentId: inv.investmentId,
        daoName: inv.daoName,
        investmentAmount: inv.amount,
        currentValue: inv.currentValue,
        returnPercentage: parseFloat((inv.returnPercentage || 0).toFixed(1)),
        investmentDate: inv.investmentDate,
        sharesOwned: inv.sharesOwned
      })),
      portfolioMetrics: {
        diversificationScore: 0.72, // Placeholder
        riskLevel: portfolioMetrics[0]?.riskLevel || 'medium',
        averageReturn: parseFloat((portfolioMetrics[0]?.avgReturn || 0).toFixed(2))
      },
      opportunities: opportunities.map((opp: any) => ({
        id: opp.id,
        daoName: opp.daoName,
        fundingNeeded: opp.fundingNeeded,
        fundingTarget: opp.fundingTarget,
        fundingRaised: opp.fundingRaised,
        expectedReturn: opp.expectedReturn
      }))
    };
  } catch (error) {
    logger.error('Error getting investor dashboard:', error);
    throw error;
  }
}
