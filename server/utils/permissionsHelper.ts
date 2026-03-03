/**
 * Permissions Helper Utility
 * 
 * Centralized permission checking for:
 * - Vault creator permissions (strategy deployment, cross-chain operations)
 * - DAO admin permissions (DAO-scoped access)
 * - Platform admin permissions (superuser access)
 * - Role-based operations
 */

import { db } from '../db';
import { vaults, daoMemberships } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { Logger } from './logger';

const logger = Logger.getLogger();

/**
 * Check if user is the vault creator
 * Vault creators can:
 * - Deploy strategies
 * - Manage cross-chain operations
 * - Delegate creator role
 */
export async function isVaultCreator(userId: string, vaultId: string): Promise<boolean> {
  try {
    const vault = await db.query.vaults.findFirst({
      where: eq(vaults.id, vaultId as any),
    });

    return vault?.creatorId === userId;
  } catch (error) {
    logger.error('[Permissions] Error checking vault creator:', error);
    return false;
  }
}

/**
 * Check if user is DAO admin in the vault's DAO
 * DAO admins can manage all vaults in their DAO
 */
export async function isDAOAdminForVault(userId: string, vaultId: string): Promise<boolean> {
  try {
    const vault = await db.query.vaults.findFirst({
      where: eq(vaults.id, vaultId as any),
    });

    if (!vault?.daoId) {
      return false; // Not a DAO vault
    }

    const membership = await db.query.daoMemberships.findFirst({
      where: and(
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.daoId, vault.daoId),
      ),
    });

    return membership?.role === 'admin';
  } catch (error) {
    logger.error('[Permissions] Error checking DAO admin:', error);
    return false;
  }
}

/**
 * Check if user is a superuser (platform-wide access)
 */
export function isPlatformAdmin(userRole: string): boolean {
  return userRole === 'super_admin';
}

/**
 * Check if user has creator or admin permissions for a vault
 * Used for strategy deployment and cross-chain operations
 */
export async function canManageVaultStrategies(userId: string, vaultId: string, userRole?: string): Promise<boolean> {
  // Super-admin can do anything
  if (userRole === 'super_admin') {
    return true;
  }

  // Check if user is vault creator
  const isCreator = await isVaultCreator(userId, vaultId);
  if (isCreator) {
    return true;
  }

  // Check if user is DAO admin for this vault's DAO
  const isDAOAdmin = await isDAOAdminForVault(userId, vaultId);
  if (isDAOAdmin) {
    return true;
  }

  return false;
}

/**
 * Check if user is DAO admin in a specific DAO
 * DAO admins can only access their own DAO's vaults
 */
export async function isDAOAdminInDAO(userId: string, daoId: string): Promise<boolean> {
  try {
    const membership = await db.query.daoMemberships.findFirst({
      where: and(
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.daoId, daoId),
      ),
    });

    return membership?.role === 'admin';
  } catch (error) {
    logger.error('[Permissions] Error checking DAO admin in DAO:', error);
    return false;
  }
}

/**
 * Log permission check for audit trail
 */
export function logPermissionCheck(
  userId: string,
  action: string,
  resourceId: string,
  allowed: boolean,
  metadata?: Record<string, any>
): void {
  logger.info(
    `[Permissions] User ${userId} ${allowed ? 'granted' : 'denied'} ${action} on ${resourceId}`,
    { metadata }
  );
}
