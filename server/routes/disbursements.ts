import { Router } from 'express';
import { isAuthenticated } from '../auth';

const router = Router();

/**
 * Disbursements Routes
 * Stub implementation - to be fully implemented
 */

router.get('/disbursements', isAuthenticated, (req, res) => {
  res.json({ disbursements: [] });
});

router.post('/disbursements', isAuthenticated, (req, res) => {
  res.json({ success: true });
});

export default router;
