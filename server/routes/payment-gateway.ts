/**
 * RE-EXPORT SHIM: /api/payment-gateway
 * 
 * Compatibility mount for the consolidated payment router.
 * This shim re-exports the consolidated router for backward compatibility.
 * 
 * MIGRATION:
 *   /api/payment-gateway/webhooks/paystack
 *   /api/payment-gateway/webhooks/flutterwave
 *   /api/payment-gateway/webhooks/mpesa
 */

import { Router } from 'express';
import paymentRoutes from '../payments';
import { logger } from '../utils/logger';

const shim = Router();

shim.use((req, res, next) => {
  logger.warn('[DEPRECATED] /api/payment-gateway compatibility route was used.', {
    originalUrl: req.originalUrl,
    method: req.method
  });
  res.setHeader('X-Deprecated-Shim', 'true');
  next();
});

shim.use('/', paymentRoutes);

export default shim;