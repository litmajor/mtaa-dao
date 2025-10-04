
import { Request, Response, NextFunction } from 'express';
import { vaultService } from '../services/vaultService';
import { Logger } from '../utils/logger';

const logger = new Logger('auth-vault');

export async function authorizeVaultAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.claims?.id;
    const { vaultId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!vaultId) {
      return res.status(400).json({ error: 'Vault ID is required' });
    }

    // Check if user has access to this vault
    const vault = await vaultService.getVaultById(vaultId);
    if (!vault) {
      return res.status(404).json({ error: 'Vault not found' });
    }

    // Check if user owns the vault or has appropriate permissions
    if (vault.userId !== userId && !await vaultService.hasVaultAccess(userId, vaultId)) {
      return res.status(403).json({ error: 'Access denied to this vault' });
    }

    // Add vault to request for downstream handlers
    req.vault = vault;
    next();
  } catch (error: any) {
    logger.error('Vault authorization error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
}

// Extend Request interface
declare global {
  namespace Express {
    interface Request {
      vault?: any;
    }
  }
}
