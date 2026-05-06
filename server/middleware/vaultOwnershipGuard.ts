/**
 * Vault Ownership Guard Middleware
 * 
 * Enforces vault ownership verification:
 * - User vaults: Only vault owner can perform operations
 * - DAO vaults: Only DAO members with appropriate role can perform operations
 * 
 * Database-backed ownership checks
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { vaults, daoMemberships, daoMultisigConfig } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

export type VaultOperation = 
  | 'view'
  | 'deposit'
  | 'withdraw'
  | 'allocate'
  | 'rebalance'
  | 'pause'
  | 'resume'
  | 'delete';

export interface VaultContext {
  vaultId: string;
  ownerType: 'user' | 'dao';
  ownerId: string;
  treasuryId?: string;
  vaultType: string;
  isActive: boolean;
  userRole?: 'admin' | 'elder' | 'member';
  requiresMultisig?: boolean;
  multisigThreshold?: number;
}

/**
 * Load vault and verify ownership context
 */
export const loadVaultContext = async (
  vaultId: string,
  userId: string
): Promise<VaultContext | null> => {
  try {
    const vaultRecords = await db
      .select()
      .from(vaults)
      .where(eq(vaults.id, vaultId as any))
      .limit(1);

    if (!vaultRecords.length) {
      return null;
    }

    const vault = vaultRecords[0];

    // Determine ownership type
    const ownerType: 'user' | 'dao' = vault.userId ? 'user' : 'dao';
    const ownerId = vault.userId || vault.daoId;

    const context: VaultContext = {
      vaultId,
      ownerType,
      ownerId: ownerId as string,
      treasuryId: undefined,
      vaultType: vault.vaultType || 'custom',
      isActive: vault.isActive || true,
    };

    return context;
  } catch (error) {
    logger.error('[VaultOwnershipGuard] Error loading vault context:', error);
    return null;
  }
};

/**
 * Middleware: Verify user has access to vault
 */
export const vaultAccessGuard = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { vaultId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!vaultId) {
      return res.status(400).json({ error: 'Vault ID required' });
    }

    const context = await loadVaultContext(vaultId, userId);

    if (!context) {
      return res.status(404).json({ error: 'Vault not found' });
    }

    // Check access based on ownership type
    const hasAccess = await verifyVaultAccess(context, userId);

    if (!hasAccess) {
      logger.warn(`[VaultOwnershipGuard] Unauthorized access attempt to vault ${vaultId} by user ${userId}`);
      return res.status(403).json({ error: 'Unauthorized vault access' });
    }

    // Attach context to request
    req.vaultContext = context;
    req.userId = userId;

    next();
  } catch (error) {
    logger.error('[VaultOwnershipGuard] Error in access guard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware: Verify user can perform specific operation on vault
 */
export const vaultOperationGuard = (operation: VaultOperation) => {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const { vaultId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!vaultId) {
        return res.status(400).json({ error: 'Vault ID required' });
      }

      const context = await loadVaultContext(vaultId, userId);

      if (!context) {
        return res.status(404).json({ error: 'Vault not found' });
      }

      // Check if vault is active for write operations
      if (['deposit', 'withdraw', 'allocate', 'rebalance'].includes(operation)) {
        if (!context.isActive) {
          return res.status(400).json({ error: 'Vault is not active' });
        }
      }

      // Verify permission for operation
      const hasPermission = await verifyVaultOperation(context, userId, operation);

      if (!hasPermission) {
        logger.warn(
          `[VaultOwnershipGuard] Unauthorized operation ${operation} on vault ${vaultId} by user ${userId}`
        );
        return res.status(403).json({ error: `Not authorized to ${operation} this vault` });
      }

      // Check multisig requirement for DAO ops
      if (context.ownerType === 'dao' && ['withdraw', 'rebalance', 'pause', 'delete'].includes(operation)) {
        const multisigInfo = await loadMultisigConfig(context.ownerId);
        if (multisigInfo?.requiresMultisig) {
          context.requiresMultisig = true;
          context.multisigThreshold = multisigInfo.threshold;
        }
      }

      // Attach context to request
      req.vaultContext = context;
      req.userId = userId;

      next();
    } catch (error) {
      logger.error(`[VaultOwnershipGuard] Error in operation guard (${operation}):`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Verify if user has basic access to vault
 */
async function verifyVaultAccess(context: VaultContext, userId: string): Promise<boolean> {
  try {
    if (context.ownerType === 'user') {
      // User vaults: Only owner can access
      return context.ownerId === userId;
    }

    // DAO vaults: Check membership
    const membership = await db
      .select()
      .from(daoMemberships)
      .where(
        and(
          eq(daoMemberships.userId, userId),
          eq(daoMemberships.daoId, context.ownerId as any)
        )
      )
      .limit(1);

    return membership.length > 0;
  } catch (error) {
    logger.error('[VaultOwnershipGuard] Error verifying access:', error);
    return false;
  }
}

/**
 * Verify if user can perform specific operation on vault
 */
async function verifyVaultOperation(
  context: VaultContext,
  userId: string,
  operation: VaultOperation
): Promise<boolean> {
  try {
    if (context.ownerType === 'user') {
      // User vaults: Only owner can modify
      const isOwner = context.ownerId === userId;
      
      switch (operation) {
        case 'view':
          return isOwner;
        case 'deposit':
          return isOwner;
        case 'withdraw':
          return isOwner;
        case 'allocate':
          return isOwner;
        case 'rebalance':
          return isOwner;
        case 'pause':
          return isOwner;
        case 'resume':
          return isOwner;
        case 'delete':
          return isOwner;
        default:
          return false;
      }
    }

    // DAO vaults: Check role-based permissions
    const membership = await db
      .select()
      .from(daoMemberships)
      .where(
        and(
          eq(daoMemberships.userId, userId),
          eq(daoMemberships.daoId, context.ownerId as any)
        )
      )
      .limit(1);

    if (!membership.length) {
      return false;
    }

    const userRole = membership[0].role as string;
    const isMember = userRole === 'member' || userRole === 'elder' || userRole === 'admin';
    const isAdmin = userRole === 'admin';
    const isElder = userRole === 'elder' || userRole === 'admin';

    switch (operation) {
      case 'view':
        // All members can view
        return isMember;

      case 'deposit':
        // Members and above can deposit
        return isMember;

      case 'withdraw':
        // Only elders and admins can withdraw (multisig may apply)
        return isElder;

      case 'allocate':
        // Only admins and elders can allocate
        return isElder;

      case 'rebalance':
        // Only admins and elders can rebalance (multisig may apply)
        return isElder;

      case 'pause':
        // Only admins can pause
        return isAdmin;

      case 'resume':
        // Only admins can resume
        return isAdmin;

      case 'delete':
        // Only admins can delete
        return isAdmin;

      default:
        return false;
    }
  } catch (error) {
    logger.error('[VaultOwnershipGuard] Error verifying operation:', error);
    return false;
  }
}

/**
 * Load multisig configuration for DAO
 */
async function loadMultisigConfig(daoId: string): Promise<{
  requiresMultisig: boolean;
  threshold: number;
} | null> {
  try {
    const config = await db
      .select()
      .from(daoMultisigConfig)
      .where(eq(daoMultisigConfig.daoId, daoId as any))
      .limit(1);

    if (!config.length) {
      return null;
    }

    return {
      requiresMultisig: true, // If config exists, multisig is required
      threshold: parseInt(config[0].requiredApprovals?.toString() || '2'),
    };
  } catch (error) {
    logger.error('[VaultOwnershipGuard] Error loading multisig config:', error);
    return null;
  }
}

/**
 * Middleware: Enforce multisig requirement
 * Must be used after vaultOperationGuard
 */
export const multisigEnforcer = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const context = req.vaultContext as VaultContext | undefined;

    if (!context) {
      return res.status(400).json({ error: 'Vault context missing' });
    }

    // Only enforce for DAO operations that require multisig
    if (context.requiresMultisig) {
      // Check if multisig approval is provided
      const multisigSignature = req.body?.multisigSignature;
      const multisigApprovers = req.body?.multisigApprovers;

      if (!multisigSignature || !Array.isArray(multisigApprovers)) {
        return res.status(400).json({
          error: 'Multisig approval required',
          threshold: context.multisigThreshold,
          approversRequired: context.multisigThreshold,
        });
      }

      if (multisigApprovers.length < (context.multisigThreshold || 1)) {
        return res.status(400).json({
          error: 'Insufficient multisig approvals',
          approversProvided: multisigApprovers.length,
          approversRequired: context.multisigThreshold,
        });
      }

      // Attach multisig info to request for use in handlers
      req.multisigData = {
        signature: multisigSignature,
        approvers: multisigApprovers,
        timestamp: new Date(),
      };
    }

    next();
  } catch (error) {
    logger.error('[VaultOwnershipGuard] Error in multisig enforcer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  loadVaultContext,
  vaultAccessGuard,
  vaultOperationGuard,
  multisigEnforcer,
};
