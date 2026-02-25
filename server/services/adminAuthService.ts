import { db } from '../db';
import { sql } from 'drizzle-orm';

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  is_superuser: boolean;
  is_active: boolean;
  created_at: Date;
}

export interface AuthContext {
  userId: string;
  email: string;
  role: string;
  isSuperuser: boolean;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export class AdminAuthService {
  /**
   * Verify superuser status
   * Throws error if user is not superuser
   */
  async verifySuperuser(userId: string): Promise<AdminUser> {
    const user = await this.getAdminUser(userId);

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    if (!user.is_superuser) {
      throw new Error(`User ${userId} is not a superuser`);
    }

    if (!user.is_active) {
      throw new Error(`User ${userId} is not active`);
    }

    return user;
  }

  /**
   * Get admin user details
   */
  async getAdminUser(userId: string): Promise<AdminUser | null> {
    try {
      const result = await db.execute(sql`
        SELECT id, email, role, is_superuser, is_active, created_at
        FROM admin_users
        WHERE id = ${userId}
        LIMIT 1
      `);

      const user = (result.rows?.[0] as unknown) as AdminUser | undefined;
      return user || null;
    } catch (error) {
      console.error('Error fetching admin user:', error);
      throw error;
    }
  }

  /**
   * Extract auth context from request
   * Used by middleware to populate request.authContext
   */
  extractAuthContext(
    userId: string,
    userEmail: string,
    role: string,
    isSuperuser: boolean,
    ipAddress?: string,
    userAgent?: string
  ): AuthContext {
    return {
      userId,
      email: userEmail,
      role,
      isSuperuser,
      ipAddress,
      userAgent,
      timestamp: new Date(),
    };
  }

  /**
   * Verify action is allowed for this user
   * Additional granular auth checks can be added here
   */
  async canPerformAction(
    userId: string,
    actionType: string,
    resourceType: string
  ): Promise<boolean> {
    // Verify superuser
    try {
      await this.verifySuperuser(userId);
    } catch (e) {
      return false;
    }

    // Additional rules can be added here per actionType/resourceType
    // For now, all superusers can perform all admin actions

    return true;
  }

  /**
   * Get list of all superusers (for approval board on Phase 5)
   */
  async getSuperusers(): Promise<AdminUser[]> {
    try {
      const result = await db.execute(sql`
        SELECT id, email, role, is_superuser, is_active, created_at
        FROM admin_users
        WHERE is_superuser = true
        AND is_active = true
      `);

      const rows = result.rows as unknown;
      return (rows as AdminUser[]) || [];
    } catch (error) {
      console.error('Error fetching superusers:', error);
      throw error;
    }
  }
}

export default new AdminAuthService();
