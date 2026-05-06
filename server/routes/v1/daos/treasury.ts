/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * V1 DAO Treasury Routes (Comprehensive)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Comprehensive DAO-scoped treasury management system with security guards
 * 
 * ⚠️ MtaaDAO Security Audit: "Unvalidated treasury transfers" (CRITICAL)
 * All write operations protected by treasuryAdminGuard (role: admin or elder)
 * All fund movements logged with severity: 'critical'
 * 
 * Sub-Routers (mounted at /v1/daos/:daoId/treasury/):
 *   1. /core            - Balance, history, deposits, withdrawals, approvals
 *   2. /contributions   - Contribution types and records
 *   3. /management      - Whitelist and treasury limits
 *   4. /intelligence    - AI-powered analysis (moved from /api/treasury/*)
 *   5. /multisig        - Multi-signature approval workflows
 *   6. /vaults          - Isolated treasury sub-funds
 * 
 * Security Middleware (applied at /treasury level):
 *   - daoMembershipGuard:  Verifies DAO membership (all endpoints)
 *   - treasuryAdminGuard:  Restricts write ops to admin/elder (security audit fix)
 *   - multisigGuard:       Enforces multi-sig thresholds on high-value transfers
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express from 'express';
import treasuryRouterFull from './_daoId/treasury';

const router = express.Router({ mergeParams: true });

/**
 * Mount the comprehensive treasury router at /:daoId/treasury
 * All DAO-scoped treasury operations routed through here
 * 
 * Path: /api/v1/daos/:daoId/treasury/*
 */
router.use('/', treasuryRouterFull);

export default router;
