import express, { type Request, type Response } from 'express';
import { isAuthenticated } from '../../../auth';
import { walletGenerationService } from '../../../services/wallet-generation-service';
import { saveVaultBackup, getVaultBackup } from '../../../services/walletVaultService';
import rateLimit from 'express-rate-limit';

const router = express.Router();

/**
 * Retrieval is rare in normal operation (only on IndexedDB loss / new
 * device) — a burst of retrieval attempts for one account is itself a signal
 * worth slowing down, independent of anything password-strength-related.
 * ⚠️ Adjust to match whatever rate-limiter setup already exists elsewhere in
 * this codebase (loginRateLimiter etc.) rather than necessarily using
 * express-rate-limit directly if there's an existing wrapper/store (Redis)
 * you standardize on.
 */
const vaultRetrieveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req: any) => req.user?.id || req.ip,
  message: { success: false, error: 'Too many vault retrieval attempts. Try again later.' },
});

/**
 * POST /api/v1/wallets/setup/register
 * Register a wallet whose keypair was generated client-side. Body: { address, currency?, walletType? }
 */
router.post('/setup/register', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { address, currency, walletType } = req.body;
    if (!address) {
      return res.status(400).json({ success: false, error: 'address is required' });
    }

    const result = await walletGenerationService.registerClientGeneratedWallet(userId, address, currency, walletType);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Wallet registration error:', error);
    return res.status(400).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/v1/wallets/vault/backup
 * Store an opaque encrypted keystore blob. Server never decrypts this.
 * Body: { walletId, encryptedBlob }
 */
router.post('/vault/backup', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { walletId, encryptedBlob } = req.body;
    if (!walletId || !encryptedBlob) {
      return res.status(400).json({ success: false, error: 'walletId and encryptedBlob are required' });
    }

    const result = await saveVaultBackup(userId, walletId, encryptedBlob, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Vault backup error:', error);
    // Don't leak internal detail on a security-relevant endpoint's failure path
    return res.status(400).json({ success: false, error: 'Backup could not be saved' });
  }
});

/**
 * GET /api/v1/wallets/vault/retrieve/:walletId
 * ⚠️ walletId comes from the URL param, NOT a query-string userId — ownership
 * is derived entirely from req.user, never from anything client-supplied.
 * This is the fix for the original pseudocode's `?userId=` pattern, which
 * would have let anyone request anyone else's backup by changing a query param.
 */
router.get('/vault/retrieve/:walletId', isAuthenticated, vaultRetrieveLimiter, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { walletId } = req.params;

    const backup = await getVaultBackup(userId, walletId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    if (!backup) {
      return res.status(404).json({ success: false, error: 'No backup found for this wallet' });
    }

    return res.json({ success: true, data: backup });
  } catch (error) {
    if ((error as Error).message === 'Access denied') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    console.error('Vault retrieval error:', error);
    return res.status(500).json({ success: false, error: 'Could not retrieve backup' });
  }
});

export default router;