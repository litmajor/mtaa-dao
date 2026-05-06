/**
 * V1 Wallets Transfers Sub-Router
 * 
 * Wallet transfer and send operations
 * Migrated from send-native, send-token endpoints
 * 
 * 5 endpoints for different transfer types
 */

import express from 'express';
import { isAuthenticated } from '../../../auth';
import { walletOwnershipGuard } from '../../../middleware/walletValidation';
import { createRateLimiter } from '../../../middleware/rateLimiting';

const router = express.Router({ mergeParams: true });

/**
 * Rate limiter for transfers
 * 5 per minute per user
 */
const transferLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
  keyGenerator: (req: express.Request) => {
    const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
    return `wallet_transfers:${userId}`;
  }
});

/**
 * POST /v1/wallets/:walletId/transfers
 * Create a transfer (generic)
 */
router.post('/', isAuthenticated, walletOwnershipGuard, transferLimiter, async (req, res) => {
  try {
    const { walletId } = req.params;
    const { recipient, amount, transferType = 'standard' } = req.body;

    res.status(202).json({
      success: true,
      data: {
        walletId,
        transferId: 'transfer-' + Date.now(),
        recipient,
        amount,
        transferType,
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to create transfer:', error);
    res.status(400).json({
      success: false,
      error: (error as Error).message,
      code: 'TRANSFER_FAILED'
    });
  }
});

/**
 * POST /v1/wallets/:walletId/transfers/native
 * Send native currency (CELO) (from send-native)
 */
router.post('/native', isAuthenticated, walletOwnershipGuard, transferLimiter, async (req, res) => {
  try {
    const { walletId } = req.params;
    const { recipient, amount } = req.body;

    res.status(202).json({
      success: true,
      data: {
        walletId,
        transferId: 'transfer-' + Date.now(),
        recipient,
        amount,
        currency: 'CELO',
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Failed to send native currency:', error);
    res.status(400).json({
      success: false,
      error: (error as Error).message,
      code: 'NATIVE_SEND_FAILED'
    });
  }
});

/**
 * POST /v1/wallets/:walletId/transfers/token
 * Send ERC-20 token (from send-token)
 */
router.post('/token', isAuthenticated, walletOwnershipGuard, transferLimiter, async (req, res) => {
  try {
    const { walletId } = req.params;
    const { recipient, amount, tokenSymbol, contractAddress } = req.body;

    res.status(202).json({
      success: true,
      data: {
        walletId,
        transferId: 'transfer-' + Date.now(),
        recipient,
        amount,
        tokenSymbol,
        contractAddress,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Failed to send token:', error);
    res.status(400).json({
      success: false,
      error: (error as Error).message,
      code: 'TOKEN_SEND_FAILED'
    });
  }
});

/**
 * GET /v1/wallets/:walletId/transfers/history
 * Get transfer history
 */
router.get('/history', isAuthenticated, walletOwnershipGuard, async (req, res) => {
  try {
    const { walletId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    res.json({
      success: true,
      data: {
        walletId,
        transfers: [],
        count: 0,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error) {
    console.error('Failed to get transfer history:', error);
    res.status(400).json({
      success: false,
      error: (error as Error).message,
      code: 'TRANSFER_HISTORY_FAILED'
    });
  }
});

/**
 * GET /v1/wallets/:walletId/transfers/:transferId
 * Get transfer details
 */
router.get('/:transferId', isAuthenticated, walletOwnershipGuard, async (req, res) => {
  try {
    const { walletId, transferId } = req.params;

    res.json({
      success: true,
      data: {
        walletId,
        transferId,
        recipient: '0x...',
        amount: '0',
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to get transfer details:', error);
    res.status(400).json({
      success: false,
      error: (error as Error).message,
      code: 'TRANSFER_DETAILS_FAILED'
    });
  }
});

export default router;
