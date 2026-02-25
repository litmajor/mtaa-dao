/**
 * Freqtrade Strategy API Routes
 * ✅ Express routes with rate limiting and validation
 */

import express from 'express';
import {
  uploadStrategy,
  backtestStrategy,
  hyperoptStrategy,
  getStrategyPerformance,
  listStrategies,
  deployStrategy
} from '../api/freqtrade';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();

// Rate limiting configuration per endpoint
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many strategy uploads, please try again later',
  skip: (req) => req.user?.isAdmin
});

const backtestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many backtest requests, please try again later'
});

const hyperoptLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  message: 'Hyperopt is resource-intensive, limited to 2 requests per minute'
});

const deployLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: 'Too many deployment attempts, please try again later'
});

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many read requests'
});

// ✅ Strategy Management
router.get('/strategies', readLimiter, listStrategies);
router.post('/strategies/upload', uploadLimiter, uploadStrategy);

// ✅ Backtesting & Optimization
router.post('/strategies/:strategyId/backtest', backtestLimiter, backtestStrategy);
router.post('/strategies/:strategyId/hyperopt', hyperoptLimiter, hyperoptStrategy);

// ✅ Performance & Monitoring
router.get('/strategies/:strategyId/performance', readLimiter, getStrategyPerformance);

// ✅ Deployment
router.post('/strategies/:strategyId/deploy', deployLimiter, deployStrategy);

export default router;
