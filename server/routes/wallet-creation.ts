/**
 * Wallet Creation Routes
 * Handles wallet creation on signup/KYC
 */

import express from 'express';
import { z } from 'zod';
import { walletGenerationService } from '../services/wallet-generation-service';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * Validation schemas
 */
const createWalletSchema = z.object({
  currency: z.string().default('USDC'), // USDC, cUSD, ETH, etc.
  walletType: z.enum(['personal', 'dao', 'treasury', 'smart_contract']).default('personal'),
  masterPassword: z.string().optional(),
});

const walletIdParamSchema = z.object({
  walletId: z.string().uuid(),
});

/**
 * POST /api/wallets
 * Create a new wallet for authenticated user
 * Required: Authentication token
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const validated = createWalletSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const result = await walletGenerationService.createUserWallet(
      userId,
      validated.currency,
      validated.walletType,
      validated.masterPassword
    );

    res.status(201).json({
      success: true,
      data: result,
      message: 'Wallet created successfully',
    });
  } catch (error) {
    console.error('Failed to create wallet:', error);
    res.status(400).json({
      success: false,
      error: (error as Error).message,
      code: 'WALLET_CREATION_FAILED',
    });
  }
});

/**
 * GET /api/wallets
 * Get user's wallet(s)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const wallet = await walletGenerationService.getUserWallet(userId);

    res.json({
      success: true,
      data: wallet,
    });
  } catch (error) {
    console.error('Failed to get wallet:', error);
    res.status(404).json({
      success: false,
      error: (error as Error).message,
      code: 'WALLET_NOT_FOUND',
    });
  }
});

/**
 * GET /api/wallets/:walletId
 * Get specific wallet details
 */
router.get('/:walletId', authenticateToken, async (req, res) => {
  try {
    const { walletId } = walletIdParamSchema.parse(req.params);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const wallet = await walletGenerationService.getUserWallet(userId, walletId);

    res.json({
      success: true,
      data: wallet,
    });
  } catch (error) {
    console.error('Failed to get wallet:', error);
    const errorMsg = (error as Error).message;
    const status = errorMsg.includes('not found') ? 404 : 400;
    res.status(status).json({
      success: false,
      error: errorMsg,
      code: 'WALLET_RETRIEVAL_FAILED',
    });
  }
});

/**
 * POST /api/wallets/:walletId/verify
 * Verify wallet is active and accessible
 */
router.post('/:walletId/verify', authenticateToken, async (req, res) => {
  try {
    const { walletId } = walletIdParamSchema.parse(req.params);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const isValid = await walletGenerationService.verifyWalletExists(userId, walletId);

    if (!isValid) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found or inactive',
      });
    }

    res.json({
      success: true,
      data: { isValid: true },
      message: 'Wallet verified',
    });
  } catch (error) {
    console.error('Failed to verify wallet:', error);
    res.status(400).json({
      success: false,
      error: (error as Error).message,
      code: 'WALLET_VERIFICATION_FAILED',
    });
  }
});

/**
 * POST /api/wallets/:walletId/deactivate
 * Deactivate a wallet (soft delete)
 */
router.post('/:walletId/deactivate', authenticateToken, async (req, res) => {
  try {
    const { walletId } = walletIdParamSchema.parse(req.params);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const result = await walletGenerationService.deactivateWallet(userId, walletId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Failed to deactivate wallet:', error);
    res.status(400).json({
      success: false,
      error: (error as Error).message,
      code: 'WALLET_DEACTIVATION_FAILED',
    });
  }
});

/**
 * POST /api/wallets/:walletId/backup
 * Backup wallet recovery information (seed phrase)
 * NOTE: Only available through secure recovery page
 */
router.post('/:walletId/backup', authenticateToken, async (req, res) => {
  try {
    // Implementation for backing up seed phrase
    // This would typically involve:
    // 1. Verifying user identity (password, 2FA)
    // 2. Showing seed phrase (one time only)
    // 3. Marking wallet as backed up
    // For now, return placeholder response

    res.json({
      success: true,
      message: 'Backup functionality coming soon',
    });
  } catch (error) {
    console.error('Failed to backup wallet:', error);
    res.status(400).json({
      success: false,
      error: (error as Error).message,
      code: 'WALLET_BACKUP_FAILED',
    });
  }
});

export default router;
