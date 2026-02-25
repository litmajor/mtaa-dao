import { Router } from 'express';
import { transferRoutes } from './transfer-routes';
import { assetsRoutes } from './assets-routes';
import { governanceRoutes } from './governance-routes';
import { swapRoutes } from './swap-routes';
import { solanaRoutes } from './solana-routes';
import { tronRoutes } from './tron-routes';
import { utilityRoutes } from './utility-routes';

const router = Router();

// Combine all module routes
router.use(transferRoutes);
router.use(assetsRoutes);
router.use(governanceRoutes);
router.use(swapRoutes);
router.use(solanaRoutes);
router.use(tronRoutes);
router.use(utilityRoutes);

export default router;
