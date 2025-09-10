
import { Request, Response, NextFunction } from 'express';
import { vaultService } from '../services/vaultService';

export async function authorizeVaultAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    const { vaultId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!vaultId) {
      return res.status(400).json({ error: 'Vault ID is required' });
    }

    // Check if user has access to this vault
    // This will be handled by individual methods in VaultService
    // but we can do a basic check here
    const vault = await vaultService.getVaultById(vaultId);
    if (!vault) {
      return res.status(404).json({ error: 'Vault not found' });
    }

    // Add vault to request for downstream handlers
    req.vault = vault;
    next();
  } catch (error: any) {
    console.error('Vault authorization error:', error);
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
