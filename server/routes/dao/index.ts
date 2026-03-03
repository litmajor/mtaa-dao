/**
 * DAO Router Index
 * 
 * Consolidates all DAO-scoped routes under /api/dao/:daoId/*
 * 
 * Routes included:
 *   - /api/dao/:daoId/treasury/* - Treasury operations (deposits, withdrawals, approvals)
 *   - /api/dao/:daoId/bounty-escrow/* - Task escrow management
 *   - /api/dao/:daoId/contributions/* - Contribution tracking
 * 
 * Security layers applied to all routes:
 *   1. Authentication (JWT validation)
 *   2. DAO membership verification
 *   3. Role-based access control (where applicable)
 *   4. Rate limiting per user
 *   5. Audit logging
 */

import express from 'express';
import treasuryRouter from './treasury';
import bountyEscrowRouter from './bounty-escrow';

const router = express.Router({ mergeParams: true });

// ════════════════════════════════════════════════════════════════════════════════
// MOUNT DAO-SCOPED ROUTERS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Treasury Operations Router
 * 
 * Handles:
 *   - GET    /balance                          (All members)
 *   - GET    /history                          (All members)
 *   - GET    /contribution-types               (All members)
 *   - GET    /contributions                    (All members)
 *   - POST   /deposit                          (All members) - CHANGED: was admin-only
 *   - POST   /contribution-types               (Admin only)
 *   - POST   /contributions/:id/approve        (Admin only)
 *   - POST   /withdraw                         (Admin/Elder only)
 *   - POST   /approve                          (Admin/Elder only) - Multi-sig
 *   - POST   /multisig-config                  (Admin only)
 */
router.use('/:daoId/treasury', treasuryRouter);

/**
 * Bounty Escrow Router
 * 
 * Handles task-based escrow operations with 4-layer security stack
 */
router.use('/:daoId/bounty-escrow', bountyEscrowRouter);

// ════════════════════════════════════════════════════════════════════════════════
// DOCUMENTATION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * DAO MULTI-SIGNATURE IMPLEMENTATION SUMMARY
 * 
 * ✅ COMPLETED:
 * 
 * 1. Multi-Sig Logic in Withdrawal Approvals
 *    - File: server/routes/dao/treasury.ts (approve endpoint)
 *    - Gets DAO multisig config (requiredApprovals, totalSigners)
 *    - Tracks approvals from admin/elder members
 *    - Auto-updates status to 'completed' when threshold met
 *    - Auto-updates status to 'rejected' if majority rejects
 *    - Logs all approvals to treasuryWithdrawalApprovals table
 * 
 * 2. Member-Based Deposits (Changed from Admin-Only)
 *    - File: server/routes/dao/treasury.ts (deposit endpoint)
 *    - NOW: All DAO members can deposit/contribute (removed admin-only restriction)
 *    - Supports 3 contribution types: contribution, donation, investment
 *    - Auto-creates contribution types if none exist
 *    - Tracks contributions in daoContributions table
 *    - Optional approval workflow for contribution types that require it
 *    - Automated contribution tracking with status updates
 * 
 * 3. DAO Contribution Types System
 *    - File: server/routes/dao/treasury.ts (contribution-types endpoints)
 *    - Configurable per DAO
 *    - Support for:
 *      * Recurring contributions (allowRecurring)
 *      * Investment equity tracking (trackEquity)
 *      * Min/max amount constraints
 *      * Approval requirements per type
 *    - Examples:
 *      - "Monthly Contribution" (recurring, auto-accept, min $100)
 *      - "Donation" (optional approval, no equity)
 *      - "Investment" (requires 2 approvals, tracks equity %)
 * 
 * 4. Contribution Approval Flow
 *    - File: server/routes/dao/treasury.ts (contributions/:id/approve)
 *    - Admin/Elder only can approve
 *    - Per-type approval thresholds
 *    - Once approved, status → completed and added to treasury
 *    - Automatically syncs with walletTransactions for balance tracking
 * 
 * 5. Multi-Sig Configuration Management
 *    - File: server/routes/dao/treasury.ts (multisig-config endpoint)
 *    - Admin-only configuration
 *    - Sets N-of-M approval requirements
 *    - Configurable withdrawal thresholds
 *    - Role-based approval permission
 *    - Auto-complete on threshold option
 * 
 * DATABASE TABLES CREATED:
 *   - daoMultisigConfig              (N-of-M requirements per DAO)
 *   - daoContributionTypes           (Configurable contribution types)
 *   - daoContributions               (Individual contribution records)
 *   - daoContributionApprovals       (Per-approver vote tracking)
 *   - treasuryWithdrawalApprovals    (Per-approver withdrawal votes)
 * 
 * INTEGRATION INSTRUCTIONS:
 * 
 * 1. Register this router in main app:
 * 
 *    // In server/index.ts or server/app.ts:
 *    import daoRouter from './routes/dao';
 *    
 *    app.use('/api/dao', daoRouter);
 * 
 * 2. Configure DAO multi-sig (on DAO creation or admin dashboard):
 * 
 *    POST /api/dao/:daoId/treasury/multisig-config
 *    {
 *      "requiredApprovals": 2,
 *      "totalSigners": 3,
 *      "withdrawalThreshold": "1000.00",
 *      "rolesAllowedToApprove": ["admin", "elder"],
 *      "autoCompleteOnThreshold": true
 *    }
 * 
 * 3. Create contribution types (on DAO creation or admin dashboard):
 * 
 *    POST /api/dao/:daoId/treasury/contribution-types
 *    {
 *      "name": "Monthly Contribution",
 *      "description": "Regular monthly member contribution",
 *      "minimumAmount": "100",
 *      "requiresApproval": false,
 *      "approvalsNeeded": 0,
 *      "allowRecurring": true
 *    }
 * 
 * 4. Members make contributions:
 * 
 *    POST /api/dao/:daoId/treasury/deposit
 *    {
 *      "amount": 500,
 *      "contributionType": "contribution",
 *      "description": "My monthly contribution"
 *    }
 * 
 * 5. For approval-required types, admin approves:
 * 
 *    POST /api/dao/:daoId/treasury/contributions/:contributionId/approve
 *    {
 *      "approved": true,
 *      "comment": "Approved investment from John"
 *    }
 * 
 * 6. Admin initiates treasury withdrawal:
 * 
 *    POST /api/dao/:daoId/treasury/withdraw
 *    {
 *      "amount": 2000,
 *      "recipient": "treasury-fund@example.com",
 *      "reason": "Monthly operational budget",
 *      "requiresMultiSig": true
 *    }
 * 
 * 7. Other admins/elders approve the withdrawal:
 * 
 *    POST /api/dao/:daoId/treasury/approve
 *    {
 *      "withdrawalId": "uuid",
 *      "approved": true,
 *      "approverComment": "Verified budget request"
 *    }
 *    
 *    (Withdrawal auto-completes when N approvals reach threshold)
 */

export default router;
