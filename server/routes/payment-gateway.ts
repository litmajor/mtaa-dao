/**
 * RE-EXPORT SHIM: /api/payment-gateway
 * 
 * DEPRECATED: All payment functionality consolidated into /api/payments.
 * This shim re-exports the consolidated router for backward compatibility.
 * 
 * MIGRATION:
 *   /api/payment-gateway/deposit          → /api/payments/deposit
 *   /api/payment-gateway/withdraw          → /api/payments/withdraw
 *   /api/payment-gateway/verify/...        → /api/payments/verify/...
 *   /api/payment-gateway/flutterwave/webhook → /api/payments/webhooks/flutterwave
 *   /api/payment-gateway/paystack/webhook    → /api/payments/webhooks/paystack
 *   /api/payment-gateway/mpesa/callback      → /api/payments/webhooks/mpesa
 */

import { Router } from 'express';
import paymentRoutes from '../payments';
import { logger } from '../utils/logger';

const shim = Router();

shim.use((req, res, next) => {
  logger.warn('[DEPRECATED] /api/payment-gateway is deprecated. Use /api/payments.', {
    originalUrl: req.originalUrl,
    method: req.method
  });
  res.setHeader('X-Deprecated-Shim', 'true');
  next();
});

shim.use('/', paymentRoutes);

export default shim;