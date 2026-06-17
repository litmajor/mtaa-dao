/**
 * DexScreener API Routes
 * ✅ Mounts DexScreener endpoints with rate limiting
 */

import express from 'express';
import {
  getDexHealth,
  searchPairs,
  getPairDetails,
  getTokenPairs,
  getTrendingPairs,
  syncSymbolUniverse,
  clearCache,
  getCacheStats
} from '../api/dex-screener';
import { rateLimit } from 'express-rate-limit';
import { validate } from '../middleware/validation';
import { searchPairsQuerySchema, syncSymbolUniverseBodySchema } from '../validators/dex';

const router = express.Router();

// Rate limiting configuration per endpoint
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: 'Too many search requests, please try again later',
  skip: (req) => req.user?.isAdmin // Skip rate limit for admins
});

const pairDetailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: 'Too many pair detail requests'
});

const trendingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many trending pair requests'
});

const discoveryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  message: 'Symbol Universe sync is resource-intensive, limited to 1 request per minute'
});

// ✅ Health check (no rate limit)
router.get('/health', getDexHealth);

// ✅ Search pairs (60 req/min)
router.get('/search-pairs', searchLimiter, validate({ query: searchPairsQuerySchema }), searchPairs);

// ✅ Pair details (300 req/min)
router.get('/pairs/:chain/:pairAddress', pairDetailLimiter, getPairDetails);

// ✅ Token pairs (60 req/min)
router.get('/token-pairs/:chain/:tokenAddress', searchLimiter, getTokenPairs);

// ✅ Trending pairs (30 req/min)
router.get('/trending-pairs', trendingLimiter, getTrendingPairs);

// ✅ Symbol Universe sync (1 req/min)
router.post('/symbol-universe/sync', discoveryLimiter, validate({ body: syncSymbolUniverseBodySchema }), syncSymbolUniverse);

// ✅ Cache management
router.delete('/cache/clear', clearCache);
router.get('/cache/stats', getCacheStats);

export default router;
