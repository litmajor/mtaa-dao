/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * V1 DAO-Scoped Router
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Consolidates all DAO-scoped resources under /api/v1/daos/:daoId/*
 *
 * Sub-routers:
 * - Treasury: /api/v1/daos/:daoId/treasury/*
 * - Chat: /api/v1/daos/:daoId/chat/*
 * - Governance: /api/v1/daos/:daoId/governance/*
 * - Investment Pools: /api/v1/daos/:daoId/investment-pools/*
 * - Proposals: /api/v1/daos/:daoId/proposals/*
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express from 'express';
import { isAuthenticated } from '../../../../nextAuthMiddleware';
import { validateDaoIdMiddleware } from '../../../../middleware/security';
import treasuryRouter from './treasury';
import investmentPoolsRouter from './investment-pools';
import membersRouter from './members';
import subscriptionsRouter from './subscriptions';
import proposalsRouter from './proposals';
import chatRouter from './chat';
import governanceRouter from './governance';
import abuseRouter from './abuse';
import contributionsRouter from './contributions';
import billingRouter from './billing';
import intelligenceRouter from './intelligence';
import tasksRouter from './tasks';

const router = express.Router({ mergeParams: true });

// Validate DAO exists and user has access - applied to ALL DAO-scoped routes
router.use(isAuthenticated, validateDaoIdMiddleware);

/**
 * Treasury Sub-Router
 * DAO-scoped treasury analysis and intelligence endpoints
 * ✅ Already implemented - see /v1/daos/treasury
 */
router.use('/treasury', treasuryRouter);

/**
 * Chat Sub-Router (CONSOLIDATED)
 * DAO-scoped messaging with reactions, attachments, pinning
 * Consolidates: dao-chat.ts
 * ✅ FIXED: userId type errors resolved
 */
router.use('/chat', chatRouter);

/**
 * Governance Sub-Router (CONSOLIDATED)
 * DAO leaderboards (system-wide + DAO-specific), activity scoring
 * Consolidates: governance.ts
 * ✅ FIXED: Module resolution errors resolved
 */
router.use('/governance', governanceRouter);

/**
 * Abuse Prevention Sub-Router (CONSOLIDATED)
 * DAO verification, social verification, eligibility checks, NFT minting
 * Consolidates: dao-abuse-prevention.ts
 * ✅ READY: 5 endpoints for abuse prevention and verification
 */
router.use('/abuse', abuseRouter);

/**
 * Investment Pools Sub-Router (PHASE 2 WEEK 1)
 * Multi-asset portfolio management with basis points allocation
 */
router.use('/investment-pools', investmentPoolsRouter);

/**
 * Proposals Sub-Router (CONSOLIDATED)
 * Proposal CRUD, voting, engagement (comments/likes), and execution
 * Consolidates: proposals.ts + proposal-execution.ts + proposal-engagement.ts
 * ✅ FIXED: Handler type compatibility issues resolved
 */
router.use('/proposals', proposalsRouter);

/**
 * Members Sub-Router (CONSOLIDATED)
 * Member management, invites, role updates
 * Consolidates: daoInvites.ts + member endpoints from daos.ts
 */
router.use('/members', membersRouter);

/**
 * Subscriptions Sub-Router (CONSOLIDATED)
 * DAO subscription plans, billing, limits, upgrades
 * Consolidates: dao-subscriptions.ts
 */
router.use('/subscriptions', subscriptionsRouter);

/**
 * Billing Sub-Router (CONSOLIDATED)
 * DAO billing dashboard and plan upgrades
 * Consolidates: billing.ts (DAO-facing endpoints)
 */
router.use('/billing', billingRouter);

/**
 * Contributions Sub-Router (CONSOLIDATED)
 * Contribution tracking, reputation scoring, transparent ledger
 * Consolidates: proof-of-contribution.ts
 * Features: Proof generation, trust scores, ledger exports
 */
router.use('/contributions', contributionsRouter);

/**
 * Intelligence Sub-Router
 * Real-time DAO events and insights
 */
router.use('/intelligence', intelligenceRouter);

/**
 * Tasks Sub-Router
 * DAO task bounty board — create, claim, verify tasks with rewards
 * Admin/elder: create, verify, cancel | Members: list, claim
 */
router.use('/tasks', tasksRouter);

export default router;
