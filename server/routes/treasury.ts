/**
 * Treasury Intelligence API Routes
 * 
 * RESTful endpoints for treasury analysis, governance formula recommendations,
 * and continuous health monitoring.
 * 
 * Routes:
 * - POST /api/treasury/analyze
 * - POST /api/treasury/recommend-formula
 * - GET /api/treasury/health/:daoId
 */

import express, { Request, Response } from 'express';
import { isAuthenticated } from '../nextAuthMiddleware';
import {
  analyzeTreasuryHandler,
  recommendFormulaHandler,
  getTreasuryHealthHandler
} from '../api/treasury';

const router = express.Router();

/**
 * POST /api/treasury/analyze
 * 
 * Analyzes treasury configuration and returns Layer 3 intelligence summary.
 * 
 * Request:
 * {
 *   daoId: string (required);
 *   priceData?: Record<string, number> (optional);
 * }
 */
router.post('/analyze', isAuthenticated, analyzeTreasuryHandler);

/**
 * POST /api/treasury/recommend-formula
 * 
 * Recommends optimal governance weight formula based on treasury characteristics.
 * 
 * Request:
 * {
 *   daoId: string (required);
 *   daoType: 'free' | 'shortTerm' | 'collective' | 'governance' | 'meta' (required);
 * }
 */
router.post('/recommend-formula', isAuthenticated, recommendFormulaHandler);

/**
 * GET /api/treasury/health/:daoId
 * 
 * Returns comprehensive treasury health status with metrics and alerts.
 * 
 * Query Parameters:
 * - includeHistory?: boolean (default: true)
 * - timeframe?: '24h' | '7d' | '30d' | '90d' (default: '30d')
 */
router.get('/health/:daoId', isAuthenticated, getTreasuryHealthHandler);

export default router;
