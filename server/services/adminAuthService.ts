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
    resourceType: string,
    resourceContext?: { agentId?: string; proposalId?: string; daoId?: string }
  ): Promise<boolean> {
    try {
      const user = await this.getAdminUser(userId);
      if (!user || !user.is_active) {
        return false;
      }

      const normalizedAction = actionType.toUpperCase();
      const normalizedRole = user.role?.toLowerCase() || '';

      // Superuser is allowed everywhere.
      if (user.is_superuser) {
        return true;
      }

      // Proposal actions require explicit admin/super-admin privileges rather than a blanket superuser-only gate.
      if (resourceType === 'PROPOSAL') {
        const proposalActions = new Set([
          'VIEW_PROPOSAL',
          'CREATE_PROPOSAL',
          'APPROVE_PROPOSAL',
          'REJECT_PROPOSAL',
          'EXECUTE_PROPOSAL'
        ]);

        if (!proposalActions.has(normalizedAction)) {
          return false;
        }

        return ['admin', 'super_admin', 'approval_board'].includes(normalizedRole);
      }

      // Default to admin-only for other sensitive resources.
      return ['admin', 'super_admin', 'approval_board'].includes(normalizedRole);
    } catch (e) {
      return false;
    }
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
