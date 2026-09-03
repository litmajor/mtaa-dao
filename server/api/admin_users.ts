import type { Request, Response } from 'express';
import { db } from '../storage';
import { users } from '../../shared/schema';
import { eq, ilike, and, or, count, desc } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { ValidationError, AppError } from '../middleware/errorHandler';

const logger = new Logger('admin-users');

const VALID_ROLES = ['user', 'moderator', 'admin', 'super_admin', 'manager', 'rebalancer', 'elder'] as const;

/**
 * Safely escape SQL LIKE pattern wildcards (% and _)
 */
function escapeLikeString(str: string): string {
  return str.replace(/[%_]/g, '\\$&');
}

// Get all users (admin only)
export async function getUsersHandler(req: Request, res: Response): Promise<void> {
  try {
    const { 
      page = '1', 
      limit = '20', 
      search = '', 
      role = '', 
      status = '' 
    } = req.query;

    // Parse & sanitize pagination safely
    const parsedPage = Math.max(1, parseInt(String(page), 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const offset = (parsedPage - 1) * parsedLimit;

    const rawSearch = String(search).trim();
    const roleFilter = String(role).trim();
    const statusFilter = String(status).trim();

    const conditions = [];

    // Case-insensitive search with escaped wildcards
    if (rawSearch) {
      const escaped = `%${escapeLikeString(rawSearch)}%`;
      conditions.push(
        or(
          ilike(users.email, escaped),
          ilike(users.firstName, escaped),
          ilike(users.lastName, escaped)
        )
      );
    }

    if (roleFilter && VALID_ROLES.includes(roleFilter as any)) {
      conditions.push(eq(users.roles, roleFilter));
    }

    if (statusFilter === 'active') {
      conditions.push(eq(users.isBanned, false));
    } else if (statusFilter === 'inactive') {
      conditions.push(eq(users.isBanned, true));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Execute paginated user retrieval and DB aggregate count in parallel
    const [usersResult, totalResult] = await Promise.all([
      db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          roles: users.roles,
          isBanned: users.isBanned,
          isEmailVerified: users.isEmailVerified,
          walletAddress: users.walletAddress,
          createdAt: users.createdAt,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .where(whereClause)
        .limit(parsedLimit)
        .offset(offset)
        .orderBy(desc(users.createdAt)),

      db
        .select({ total: count() })
        .from(users)
        .where(whereClause),
    ]);

    const total = totalResult[0]?.total ?? 0;

    res.json({
      success: true,
      data: {
        users: usersResult,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total,
          totalPages: Math.ceil(total / parsedLimit),
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get users', error);
    throw new AppError('Failed to retrieve users', 500);
  }
}

// Update user role (super admin only)
export async function updateUserRoleHandler(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const adminUserId = req.user?.id || req.user?.claims?.sub;

    if (!userId || !role) {
      throw new ValidationError('User ID and role are required');
    }

    if (!VALID_ROLES.includes(role)) {
      throw new ValidationError('Invalid role selection');
    }

    // Prevent self-demotion from super_admin
    if (userId === adminUserId && role !== 'super_admin') {
      const [currentUser] = await db
        .select({ roles: users.roles })
        .from(users)
        .where(eq(users.id, adminUserId))
        .limit(1);

      if (currentUser?.roles === 'super_admin') {
        throw new ValidationError('Cannot demote yourself from super_admin role');
      }
    }

    // Update user role safely
    const [updatedUser] = await db
      .update(users)
      .set({
        roles: role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        roles: users.roles,
      });

    if (!updatedUser) {
      throw new AppError('User not found', 404);
    }

    logger.info('User role updated', { 
      userId, 
      newRole: role, 
      updatedBy: adminUserId 
    });

    res.json({
      success: true,
      data: { user: updatedUser },
    });
  } catch (error) {
    logger.error('Failed to update user role', error);
    if (error instanceof ValidationError || error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to update user role', 500);
  }
}