import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../nextAuthMiddleware';
import {
  detectPersona,
  getUserDAOs,
  getOkediDashboard,
  getYukiDashboard,
  getAmaraDashboard,
  type DashboardPersona,
  type PersonaData,
  type DAOData,
  type OkediDashboardData,
  type YukiDashboardData,
  type AmaraDashboardData
} from '../services/dashboardService';

const router = Router();

/**
 * GET /api/users/persona-data
 * Detect user persona and return user metrics
 */
router.get('/users/persona-data', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const personaData = await detectPersona(userId);

    res.json(personaData);
  } catch (error) {
    console.error('Error detecting persona:', error);
    res.status(500).json({ error: 'Failed to detect persona' });
  }
});

/**
 * GET /api/users/my-daos
 * Get list of user's DAOs with roles
 */
router.get('/users/my-daos', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const daos = await getUserDAOs(userId);

    res.json(daos);
  } catch (error) {
    console.error('Error getting user DAOs:', error);
    res.status(500).json({ error: 'Failed to fetch DAOs' });
  }
});

/**
 * GET /api/dashboard/okedi
 * Get Okedi (beginner) dashboard data
 */
router.get('/dashboard/okedi', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const dashboardData = await getOkediDashboard(userId);

    res.json(dashboardData);
  } catch (error) {
    console.error('Error getting Okedi dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * GET /api/dashboard/yuki
 * Get Yuki (intermediate) dashboard data
 */
router.get('/dashboard/yuki', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const dashboardData = await getYukiDashboard(userId);

    res.json(dashboardData);
  } catch (error) {
    console.error('Error getting Yuki dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * GET /api/dashboard/amara
 * Get Amara (advanced) dashboard data
 */
router.get('/dashboard/amara', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const dashboardData = await getAmaraDashboard(userId);

    res.json(dashboardData);
  } catch (error) {
    console.error('Error getting Amara dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * GET /api/dashboard/:persona
 * Generic endpoint that dispatches to specific persona dashboards
 */
router.get('/dashboard/:persona', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { persona } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate persona
    const validPersonas = ['okedi', 'yuki', 'amara'];
    if (!validPersonas.includes(persona)) {
      return res.status(400).json({
        error: "Invalid persona. Must be 'okedi', 'yuki', or 'amara'"
      });
    }

    let dashboardData;

    switch (persona) {
      case 'okedi':
        dashboardData = await getOkediDashboard(userId);
        break;
      case 'yuki':
        dashboardData = await getYukiDashboard(userId);
        break;
      case 'amara':
        dashboardData = await getAmaraDashboard(userId);
        break;
      default:
        return res.status(400).json({ error: 'Invalid persona' });
    }

    res.json(dashboardData);
  } catch (error) {
    console.error('Error getting dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

export default router;
