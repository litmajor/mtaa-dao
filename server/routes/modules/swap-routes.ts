import { Router } from 'express';
import { z } from 'zod';
import { crossChainSwapService } from '../../services/crossChainSwapService';
import { asyncHandler } from '../../middleware/errorHandler';
import { isAuthenticated } from '../../nextAuthMiddleware';
import { requirePINVerification, checkAmountThreshold } from '../../middleware/pin-verification';
import { swapQuoteSchema, swapExecuteSchema } from './validation-schemas';

const router = Router();

// Get swap quote
router.post('/swap/quote', isAuthenticated, asyncHandler(async (req, res) => {
  try {
    const validated = swapQuoteSchema.parse(req.body);
    
    const quote = await crossChainSwapService.getSwapQuote(
      validated.fromChain,
      validated.toChain,
      validated.fromToken,
      validated.toToken,
      validated.fromAmount,
      validated.slippageTolerance
    );

    res.json({
      success: true,
      data: quote
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

// Execute swap
router.post('/swap/execute', 
  isAuthenticated, 
  requirePINVerification,
  checkAmountThreshold('2000'), // Require PIN for swaps > $2k
  asyncHandler(async (req, res) => {
  try {
    const validated = swapExecuteSchema.parse(req.body);
    const userId = (req.user as any)?.claims?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const execution = await crossChainSwapService.executeSwap(
      userId,
      validated.quote,
      validated.userAddress
    );

    res.json({
      success: true,
      data: execution
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

// Get swap status
router.get('/swap/:swapId', isAuthenticated, asyncHandler(async (req, res) => {
  const { swapId } = req.params;

  const status = await crossChainSwapService.getSwapStatus(swapId);

  if (!status) {
    return res.status(404).json({
      success: false,
      message: 'Swap not found'
    });
  }

  res.json({
    success: true,
    data: status
  });
}));

export const swapRoutes = router;
