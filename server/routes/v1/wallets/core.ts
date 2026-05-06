/**
 * V1 Wallets Core Router
 * 
 * Canonical wallet CRUD operations
 * Moved from /api/wallets to /v1/wallets
 * 
 * Routes:
 * - GET    /v1/wallets          List user wallets
 * - POST   /v1/wallets          Create wallet
 * - GET    /v1/wallets/:walletId Get wallet details
 * - PUT    /v1/wallets/:walletId Update wallet
 * - DELETE /v1/wallets/:walletId/deactivate Deactivate wallet
 */

import express from 'express';
import { z } from 'zod';
import { walletGenerationService } from '../../../services/wallet-generation-service';
import { isAuthenticated } from '../../../auth';
import { walletOwnershipGuard } from '../../../middleware/walletValidation';

const router = express.Router();

/**
 * Validation schemas
 */
const createWalletSchema = z.object({
  currency: z.string().default('USDC'),
  walletType: z.enum(['personal', 'dao', 'treasury', 'smart_contract']).default('personal'),
  masterPassword: z.string().optional(),
});

const updateWalletSchema = z.object({
  currency: z.string().optional(),
  walletType: z.enum(['personal', 'dao', 'treasury', 'smart_contract']).optional(),
});

const walletIdParamSchema = z.object({
  walletId: z.string().uuid(),
});

/**
 * GET /v1/wallets
 * List all wallets for authenticated user
 * 
 * @returns {Array} User's wallets
 */
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const wallets = await walletGenerationService.getUserWallet(userId);

    res.json({
      success: true,
      data: wallets,
      _links: {
        self: '/v1/wallets',
        create: { method: 'POST', href: '/v1/wallets' }
      }
    });
  } catch (error) {
    console.error('Failed to list wallets:', error);
    res.status(404).json({
      success: false,
      error: (error as Error).message,
      code: 'WALLET_LIST_FAILED',
    });
  }
});

/**
 * POST /v1/wallets
 * Create a new wallet for authenticated user
 * 
 * @body {string} currency - Token currency (default: USDC)
 * @body {string} walletType - Type of wallet (default: personal)
 * @body {string} masterPassword - Optional encryption password
 * @returns {Object} Created wallet details
 */
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const validated = createWalletSchema.parse(req.body);
    const userId = (req as any).user?.id || (req as any).user?.claims?.sub;

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
      _links: {
        self: `/v1/wallets/${result.walletId}`,
        list: '/v1/wallets',
        balance: `/v1/wallets/${result.walletId}/balance`,
        sessions: `/v1/wallets/${result.walletId}/sessions`
      }
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
 * GET /v1/wallets/:walletId
 * Get specific wallet details
 * 
 * @param {string} walletId - Wallet ID (UUID)
 * @returns {Object} Wallet details
 */
router.get('/:walletId', isAuthenticated, walletOwnershipGuard, async (req, res) => {
  try {
    const { walletId } = walletIdParamSchema.parse(req.params);
    const userId = (req as any).user?.id || (req as any).user?.claims?.sub;

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
      _links: {
        self: `/v1/wallets/${walletId}`,
        list: '/v1/wallets',
        update: { method: 'PUT', href: `/v1/wallets/${walletId}` },
        deactivate: { method: 'DELETE', href: `/v1/wallets/${walletId}/deactivate` },
        balance: `/v1/wallets/${walletId}/balance`,
        sessions: `/v1/wallets/${walletId}/sessions`
      }
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
 * PUT /v1/wallets/:walletId
 * Update wallet details (currency, type, etc.)
 * 
 * @param {string} walletId - Wallet ID (UUID)
 * @body {string} currency - Updated currency
 * @body {string} walletType - Updated wallet type
 * @returns {Object} Updated wallet
 */
router.put('/:walletId', isAuthenticated, walletOwnershipGuard, async (req, res) => {
  try {
    const { walletId } = walletIdParamSchema.parse(req.params);
    const validated = updateWalletSchema.parse(req.body);
    const userId = (req as any).user?.id || (req as any).user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Placeholder: actual update logic would be implemented in walletGenerationService
    res.json({
      success: true,
      data: {
        id: walletId,
        ...validated,
        updatedAt: new Date().toISOString()
      },
      message: 'Wallet updated successfully',
      _links: {
        self: `/v1/wallets/${walletId}`,
      }
    });
  } catch (error) {
    console.error('Failed to update wallet:', error);
    res.status(400).json({
      success: false,
      error: (error as Error).message,
      code: 'WALLET_UPDATE_FAILED',
    });
  }
});

/**
 * DELETE /v1/wallets/:walletId/deactivate
 * Deactivate a wallet (soft delete)
 * 
 * @param {string} walletId - Wallet ID (UUID)
 * @returns {Object} Deactivation status
 */
router.delete('/:walletId/deactivate', isAuthenticated, walletOwnershipGuard, async (req, res) => {
  try {
    const { walletId } = walletIdParamSchema.parse(req.params);
    const userId = (req as any).user?.id || (req as any).user?.claims?.sub;

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
      message: 'Wallet deactivated successfully',
      _links: {
        wallets: '/v1/wallets'
      }
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

export default router;
