import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { isAuthenticated } from '../auth';
import {
  detectPersona,
  getUserDAOs,
  getOkediDashboard,
  getYukiDashboard,
  getAmaraDashboard,
  type DashboardPersona
} from '../services/dashboardService';

const router = Router();

// Middleware wrapper to eliminate repetitive try-catch blocks
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error(`[${req.method} ${req.path}] Error:`, error);
      res.status(500).json({ error: 'Internal server error' });
    });
  };

// Helper to safely extract authenticated user ID
const getUserId = (req: Request, res: Response): string | null => {
  if (!req.user?.id) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return req.user.id;
};

// Helper to parse query param
const getDaoId = (req: Request): string | undefined => 
  typeof req.query.daoId === 'string' ? req.query.daoId : undefined;

const VALID_PERSONAS: readonly DashboardPersona[] = ['okedi', 'yuki', 'amara'];
const isPersona = (value: string): value is DashboardPersona => 
  VALID_PERSONAS.includes(value as DashboardPersona);

/**
 * GET /api/users/persona-data
 */
router.get('/users/persona-data', isAuthenticated, asyncHandler(async (req, res) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  const personaData = await detectPersona(userId);
  return res.json(personaData);
}));

/**
 * GET /api/users/my-daos
 */
router.get('/users/my-daos', isAuthenticated, asyncHandler(async (req, res) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  const daos = await getUserDAOs(userId);
  return res.json(daos);
}));

/**
 * GET /api/dashboard/okedi
 */
router.get('/dashboard/okedi', isAuthenticated, asyncHandler(async (req, res) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  const dashboardData = await getOkediDashboard(userId, getDaoId(req));
  return res.json(dashboardData);
}));

/**
 * GET /api/dashboard/yuki
 */
router.get('/dashboard/yuki', isAuthenticated, asyncHandler(async (req, res) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  const dashboardData = await getYukiDashboard(userId);
  return res.json(dashboardData);
}));

/**
 * GET /api/dashboard/amara
 */
router.get('/dashboard/amara', isAuthenticated, asyncHandler(async (req, res) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  const dashboardData = await getAmaraDashboard(userId);
  return res.json(dashboardData);
}));

/**
 * GET /api/dashboard/:persona
 * Generic dispatcher endpoint
 */
router.get('/dashboard/:persona', isAuthenticated, asyncHandler(async (req, res) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  const { persona } = req.params;

  if (!isPersona(persona)) {
    return res.status(400).json({
      error: `Invalid persona. Must be one of: ${VALID_PERSONAS.join(', ')}`
    });
  }

  let dashboardData;
  switch (persona) {
    case 'okedi':
      dashboardData = await getOkediDashboard(userId, getDaoId(req));
      break;
    case 'yuki':
      dashboardData = await getYukiDashboard(userId);
      break;
    case 'amara':
      dashboardData = await getAmaraDashboard(userId);
      break;
  }

  return res.json(dashboardData);
}));

export default router;