import express from 'express';
import gatewayRouter from './gateway';
import mpesaC2bRouter from './mpesa-c2b';
import mpesaSettlementsRouter from './mpesa-settlements';
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
router.use('/c2b', mpesaC2bRouter);
router.use('/mpesa', mpesaSettlementsRouter);
router.use('/webhooks', webhooksRouter);

export default router;
