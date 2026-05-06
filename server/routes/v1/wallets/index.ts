/**
 * V1 Wallets Router - Complete Implementation
 * 
 * Main entry point for wallet API versioning.
 * Mounts all 8 wallet sub-routers with canonical endpoints:
 * - Core: CRUD operations (5 endpoints)
 * - Balance: Balance & portfolio (3 endpoints)  
 * - Setup: Initialization & recovery (17 endpoints)
 * - Sessions: Connection lifecycle (3 endpoints)
 * - Payments: Payments & bill-split (17 endpoints)
 * - Transfers: Native & token sends (5 endpoints)
 * - Savings: Savings goals (3 endpoints)
 * - Multisig: Multi-signature ops (8 endpoints)
 * 
 * Total: 61 endpoints under /api/v1/wallets hierarchy
 */

import express from 'express';

// Import sub-routers
import coreRouter from './core';
import balanceRouter from './balance';
import setupRouter from './setup';
import sessionsRouter from './sessions';
import paymentsRouter from './payments';
import transfersRouter from './transfers';
import savingsRouter from './savings';
import multisigRouter from './multisig';
import depositsRouter from './deposits';
import withdrawalsRouter from './withdrawals';
import inflowsRouter from './inflows';
import railsRouter from './rails';
import paymentLinksRouter from './payment-links';
import invoicesRouter from './invoices';
import escrowRouter from './escrow';

const router = express.Router();

/**
 * Core wallet CRUD operations (5 endpoints)
 * GET    /v1/wallets            List wallets
 * POST   /v1/wallets            Create wallet
 * GET    /v1/wallets/:id        Get wallet
 * PUT    /v1/wallets/:id        Update wallet
 * DELETE /v1/wallets/:id/deactivate Deactivate
 */
router.use('/', coreRouter);

/**
 * Balance and portfolio operations (3 endpoints)
 * GET    /v1/wallets/:id/balance              Get balance
 * POST   /v1/wallets/:id/balance/sync         Sync balance
 * GET    /v1/wallets/:id/balance/portfolio    Get portfolio
 */
router.use('/', balanceRouter);

/**
 * Wallet setup and recovery (17 endpoints)
 * Full lifecycle: create, import, recover, backup, unlock, etc.
 */
router.use('/setup', setupRouter);

/**
 * Wallet session management (3 endpoints)
 * Connect/disconnect wallet, list active sessions
 */
router.use('/', sessionsRouter);

/**
 * Payment operations (17 endpoints)
 * Single payments, recurring, bill-split, vouchers, history, receipts
 */
router.use('/', paymentsRouter);

/**
 * Transfer operations (5 endpoints)
 * Send native currency, tokens, get history
 */
router.use('/', transfersRouter);

/**
 * Savings goals (3 endpoints)
 * Create goals, deposit, list
 */
router.use('/', savingsRouter);

/**
 * Multi-signature operations (8 endpoints)
 * Create multisig, approve, reject, pending approvals
 */
router.use('/', multisigRouter);

/**
 * Deposit operations (8 endpoints)
 * Initiate deposit, check status, get limits, view history, webhook
 * Endpoint: /v1/wallets/deposits/*
 */
router.use('/deposits', depositsRouter);

/**
 * Withdrawal operations (8 endpoints)
 * Initiate withdrawal, verify 2FA, check status, get limits, view history, webhook
 * Endpoint: /v1/wallets/withdrawals/*
 * NOTE: All withdrawals require 2FA verification
 */
router.use('/withdrawals', withdrawalsRouter);

/**
 * Inflows operations (3 endpoints)
 * Shared stable-asset discovery, rates, providers
 * Referenced by: deposits and withdrawals sub-routers
 * Endpoint: /v1/wallets/inflows/*
 */
router.use('/inflows', inflowsRouter);

/**
 * Payment Rails Infrastructure (19 endpoints)
 * Gateway deposit/withdraw/verify, webhooks for all providers
 * Flutterwave, Paystack, Paychant, Kotani, M-Pesa, Airtel, Onramper
 * Endpoint: /v1/wallets/rails/*
 */
router.use('/rails', railsRouter);

/**
 * Payment Links (5 endpoints)
 * Create shareable payment links with QR codes and celo:// URIs
 * Endpoint: /v1/wallets/payment-links/*
 */
router.use('/payment-links', paymentLinksRouter);

/**
 * Invoices (7 endpoints)
 * Issue, send, and track invoices for payment
 * Full lifecycle: create, send, pay, list, archive
 * Endpoint: /v1/wallets/invoices/*
 */
router.use('/invoices', invoicesRouter);

/**
 * Escrow operations (24 endpoints)
 * Trustless P2P transactions with milestones, mediators, and guardians
 * Invite-based acceptance, dispute resolution, reputation system
 * Endpoint: /v1/wallets/escrow/*
 */
router.use('/escrow', escrowRouter);

export default router;
