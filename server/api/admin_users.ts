
import { Request, Response } from 'express';
import { db } from '../storage';
import { users } from '../../shared/schema';
import { eq, like, and, or } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { ValidationError, AppError } from '../middleware/errorHandler';

const logger = new Logger('admin-users');

// Get all users (admin only)
export async function getUsersHandler(req: Request, res: Response) {
  try {
    const { 
      page = '1', 
      limit = '20', 
      search = '', 
      role = '', 
      status = '' 
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const searchTerm = search as string;
    const roleFilter = role as string;
    const statusFilter = status as string;

    // Build where conditions
    const conditions = [];

    if (searchTerm) {
      conditions.push(
        or(
          like(users.email, `%${searchTerm}%`),
          like(users.firstName, `%${searchTerm}%`),
          like(users.lastName, `%${searchTerm}%`)
        )
      );
    }

    if (roleFilter) {
  conditions.push(eq(users.roles, roleFilter));
    }

    if (statusFilter === 'active') {
  conditions.push(eq(users.isBanned, false));
    } else if (statusFilter === 'inactive') {
  conditions.push(eq(users.isBanned, true));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get users with pagination
    const usersResult = await db
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
      .limit(parseInt(limit as string))
      .offset(offset)
      .orderBy(users.createdAt);

    // Get total count
    const totalResult = await db
  .select({ count: users.id })
      .from(users)
      .where(whereClause);

    const total = totalResult.length;

    res.json({
      success: true,
      data: {
        users: usersResult,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          totalPages: Math.ceil(total / parseInt(limit as string)),
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get users', error);
    throw new AppError('Failed to retrieve users', 500);
  }
}

// Update user role (super admin only)
export async function updateUserRoleHandler(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const adminUserId = (req as any).user?.userId || (req as any).user?.claims?.sub;

    if (!userId || !role) {
      throw new ValidationError('User ID and role are required');
    }

    const validRoles = ['user', 'moderator', 'admin', 'super_admin'];
    if (!validRoles.includes(role)) {
      throw new ValidationError('Invalid role');
    }

    // Prevent self-demotion from super_admin
    if (userId === adminUserId && role !== 'super_admin') {
      const currentUser = await db
        .select({ roles: users.roles })
        .from(users)
        .where(eq(users.id, adminUserId))
        .limit(1);

  if (currentUser.length > 0 && currentUser[0].roles === 'super_admin') {
        throw new ValidationError('Cannot demote yourself from super_admin role');
      }
    }

    // Update user role
    const updatedUser = await db
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

    if (updatedUser.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' },
      });
    }

    logger.info('User role updated', { 
      userId, 
      newRole: role, 
      updatedBy: adminUserId 
    });

    res.json({
      success: true,
      data: { user: updatedUser[0] },
    });
  } catch (error) {
    logger.error('Failed to update user role', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new AppError('Failed to update user role', 500);
  }
}
