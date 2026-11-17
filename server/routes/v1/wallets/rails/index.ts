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
 * POST   /api/v1/wallets/rails/gateway/flutterwave/webhook (public, signature-verified)
 * POST   /api/v1/wallets/rails/gateway/paystack/webhook (public, signature-verified)
 * POST   /api/v1/wallets/rails/gateway/mpesa/callback (public, per-payment token)
 * 
 * The dashboard endpoints use /api/payment-gateway/webhooks/{provider}; legacy
 * gateway callback paths above are aliases to the same payment handlers.
 *
 * Legacy deposit-table webhook routes are separate from payment_transactions
 * settlement and must not be used for the consolidated gateway callbacks.
 */

router.use('/gateway', gatewayRouter);
router.use('/c2b', mpesaC2bRouter);
router.use('/mpesa', mpesaSettlementsRouter);
router.use('/webhooks', webhooksRouter);

export default router;
