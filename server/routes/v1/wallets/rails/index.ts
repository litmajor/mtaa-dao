import express from 'express';
import gatewayRouter from './gateway';
import webhooksRouter from './webhooks';

const router = express.Router();

/**
 * Payment Rails Infrastructure - V1 Wallets
 * 
 * Routes:
 * POST   /api/v1/wallets/rails/gateway/deposit
 * POST   /api/v1/wallets/rails/gateway/withdraw
 * GET    /api/v1/wallets/rails/gateway/verify/:provider/:reference
 * POST   /api/v1/wallets/rails/gateway/flutterwave/webhook
 * POST   /api/v1/wallets/rails/gateway/paystack/webhook
 * POST   /api/v1/wallets/rails/gateway/mpesa/callback
 * 
 * POST   /api/v1/wallets/rails/webhooks/flutterwave
 * POST   /api/v1/wallets/rails/webhooks/paystack
 * POST   /api/v1/wallets/rails/webhooks/paychant
 * POST   /api/v1/wallets/rails/webhooks/kotani
 * POST   /api/v1/wallets/rails/webhooks/mpesa
 * POST   /api/v1/wallets/rails/webhooks/airtel
 * POST   /api/v1/wallets/rails/webhooks/onramper
 */

router.use('/gateway', gatewayRouter);
router.use('/webhooks', webhooksRouter);

export default router;
