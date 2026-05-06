import { Router } from 'express';
import { isAuthenticated } from '../auth';

const router = Router();

/**
 * Deposits & Withdrawals Routes
 * Stub implementation - to be fully implemented
 */

router.get('/deposits', isAuthenticated, (req, res) => {
  res.json({ deposits: [] });
});

router.get('/withdrawals', isAuthenticated, (req, res) => {
  res.json({ withdrawals: [] });
});

router.post('/deposit', isAuthenticated, (req, res) => {
  res.json({ success: true });
});

router.post('/withdraw', isAuthenticated, (req, res) => {
  res.json({ success: true });
});

export default router;
