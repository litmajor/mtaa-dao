import { Router } from 'express';
import { z } from 'zod';
import { crossChainService } from '../../services/crossChainService';
import { tokenRegistry } from '../../services/tokenRegistry';
import { asyncHandler } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { feesSchema } from './validation-schemas';

const router = Router();

// Get supported chains
router.get('/chains', asyncHandler(async (req, res) => {
  const chains = crossChainService.getSupportedChains();
  
  res.json({
    success: true,
    data: chains
  });
}));

// Get supported assets/tokens
router.get('/assets', asyncHandler(async (req, res) => {
  try {
    const { chain, category } = req.query;

    // Get assets with optional filtering
    const assets = tokenRegistry.getAssets(
      chain ? String(chain) : undefined,
      category ? String(category) : undefined
    );

    res.json({
      success: true,
      data: {
        count: assets.length,
        chain: chain || 'all',
        category: category || 'all',
        assets
      }
    });
  } catch (error) {
    logger.error('Failed to get assets', { error });
    throw error;
  }
}));

// Get supported asset categories
router.get('/assets/categories', asyncHandler(async (req, res) => {
  try {
    const categories = tokenRegistry.getSupportedCategories();

    res.json({
      success: true,
      data: {
        categories: categories.sort(),
        count: categories.length
      }
    });
  } catch (error) {
    logger.error('Failed to get asset categories', { error });
    throw error;
  }
}));

// Get token by address
router.get('/assets/token/:chain/:address', asyncHandler(async (req, res) => {
  try {
    const { chain, address } = req.params;

    const token = tokenRegistry.getToken(chain, address);

    if (!token) {
      return res.status(404).json({
        success: false,
        message: `Token not found: ${address} on ${chain}`
      });
    }

    res.json({
      success: true,
      data: token
    });
  } catch (error) {
    logger.error('Failed to get token', { error });
    throw error;
  }
}));

// Validate token
router.post('/assets/validate', asyncHandler(async (req, res) => {
  try {
    const schema = z.object({
      chain: z.string(),
      address: z.string()
    });

    const { chain, address } = schema.parse(req.body);
    const isValid = tokenRegistry.validateToken(chain, address);
    const token = tokenRegistry.getToken(chain, address);

    res.json({
      success: true,
      data: {
        isValid,
        token: token || null
      }
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

// Get asset registry statistics
router.get('/assets/stats', asyncHandler(async (req, res) => {
  try {
    const stats = tokenRegistry.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get asset stats', { error });
    throw error;
  }
}));

// Estimate bridge fees
router.post('/estimate-fees', asyncHandler(async (req, res) => {
  try {
    const validated = feesSchema.parse(req.body);
    
    const fees = await crossChainService.estimateBridgeFees(
      validated.sourceChain,
      validated.destinationChain,
      validated.amount
    );

    res.json({
      success: true,
      data: fees
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

export const assetsRoutes = router;
