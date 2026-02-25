import { Router } from 'express';
import { z } from 'zod';
import { crossChainService } from '../../services/crossChainService';
import { asyncHandler } from '../../middleware/errorHandler';
import { isAuthenticated } from '../../nextAuthMiddleware';
import { requirePINVerification, checkAmountThreshold } from '../../middleware/pin-verification';
import { transferSchema } from './validation-schemas';

const router = Router();

// Initiate cross-chain transfer
// Requires: PIN verification for security (sending to external address)
router.post('/transfer', isAuthenticated, requirePINVerification, checkAmountThreshold('5000'), asyncHandler(async (req, res) => {
  try {
    const validated = transferSchema.parse(req.body);
    const userId = (req.user as any)?.claims?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const status = await crossChainService.initiateTransfer({
      userId,
      ...validated as any
    });

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: error.errors
      });
    }
    throw error;
  }
}));

// Get transfer status
router.get('/transfer/:transferId', isAuthenticated, asyncHandler(async (req, res) => {
  const { transferId } = req.params;
  
  const status = await crossChainService.getTransferStatus(transferId);
  
  if (!status) {
    return res.status(404).json({
      success: false,
      message: 'Transfer not found'
    });
  }

  res.json({
    success: true,
    data: status
  });
}));

// Retry failed transfer
router.post('/transfer/:transferId/retry', isAuthenticated, asyncHandler(async (req, res) => {
  const { transferId } = req.params;
  const userId = (req.user as any)?.claims?.sub;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  const status = await crossChainService.retryTransfer(transferId, userId);

  res.json({
    success: true,
    data: status
  });
}));

export const transferRoutes = router;
