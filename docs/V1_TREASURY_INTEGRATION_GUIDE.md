/**
 * V1 TREASURY SYSTEM - INTEGRATION GUIDE
 * ═════════════════════════════════════════════════════════════════════════════════
 * 
 * ARCHITECTURE OVERVIEW:
 * ├── /api/v1/daos/:daoId/treasury/                    [DAO-Scoped Treasury]
 * │   ├── /core                                         [Balance, history, transfers]
 * │   ├── /contributions                                [Contribution management]
 * │   ├── /management                                   [Whitelist, limits]
 * │   ├── /intelligence                                 [AI analysis]
 * │   ├── /multisig                                     [Approval workflows]
 * │   └── /vaults                                       [Isolated sub-funds]
 * └── /api/v1/treasury/system/health                   [System-level monitoring]
 * 
 * ═════════════════════════════════════════════════════════════════════════════════
 * DATABASE SCHEMA REQUIREMENTS
 * ═════════════════════════════════════════════════════════════════════════════════
 * 
 * Required Tables (verify in your shared/schema.ts):
 * 
 * 1. treasuryTransactions
 *    - id (string, pk)
 *    - daoId (string, fk)
 *    - type ('deposit' | 'withdrawal' | 'transfer')
 *    - amount (decimal)
 *    - currency (string, e.g. 'cUSD')
 *    - status ('pending' | 'approved' | 'completed' | 'rejected')
 *    - description (text, nullable)
 *    - initiatedBy (string, userId fk)
 *    - approvedBy (string, userId fk, nullable)
 *    - createdAt (timestamp)
 *    - completedAt (timestamp, nullable)
 * 
 * 2. daoContributions
 *    - id (string, pk)
 *    - daoId (string, fk)
 *    - typeId (string, fk to daoContributionTypes)
 *    - amount (decimal)
 *    - currency (string)
 *    - status ('pending' | 'approved' | 'rejected')
 *    - submittedBy (string, userId fk)
 *    - submittedAt (timestamp)
 *    - approvedBy (string, userId fk, nullable)
 *    - approvedAt (timestamp, nullable)
 *    - description (text, nullable)
 * 
 * 3. daoContributionTypes
 *    - id (string, pk)
 *    - daoId (string, fk)
 *    - name (string)
 *    - description (text, nullable)
 *    - minimumAmount (decimal)
 *    - maximumAmount (decimal, nullable)
 *    - requiresApproval (boolean)
 *    - createdBy (string, userId fk)
 *    - createdAt (timestamp)
 * 
 * 4. treasuryLimits
 *    - id (string, pk)
 *    - daoId (string, fk)
 *    - dailyWithdrawalPercentage (decimal)
 *    - perTransactionPercentage (decimal)
 *    - multisigThreshold (decimal)
 *    - requiredApprovals (int)
 *    - totalSigners (int)
 *    - updatedAt (timestamp)
 *    - updatedBy (string, userId fk)
 * 
 * 5. treasuryWhitelist
 *    - id (string, pk)
 *    - daoId (string, fk)
 *    - walletAddress (string)
 *    - recipientName (string, nullable)
 *    - category ('charity' | 'payments' | 'team' | 'disbursements' | 'other')
 *    - approvedBy (string, userId fk)
 *    - isApproved (boolean)
 *    - createdAt (timestamp)
 *    - approvedAt (timestamp, nullable)
 * 
 * 6. treasuryApprovals
 *    - id (string, pk)
 *    - daoId (string, fk)
 *    - transactionId (string, fk to treasuryTransactions)
 *    - signerId (string, userId fk)
 *    - signature (text)
 *    - comment (text, nullable)
 *    - signedAt (timestamp)
 * 
 * 7. daoMultisigConfig
 *    - id (string, pk)
 *    - daoId (string, fk)
 *    - requiredApprovals (int)
 *    - totalSigners (int)
 *    - withdrawalThreshold (decimal)
 *    - approvalTimeout (int, seconds)
 *    - updatedAt (timestamp)
 *    - updatedBy (string, userId fk)
 * 
 * 8. treasuryVaults
 *    - id (string, pk)
 *    - daoId (string, fk)
 *    - name (string)
 *    - description (text, nullable)
 *    - riskProfile ('low' | 'medium' | 'high')
 *    - totalAllocated (decimal)
 *    - allocation (jsonb) // Allocation breakdown
 *    - createdAt (timestamp)
 *    - createdBy (string, userId fk)
 *    - lastRebalanced (timestamp, nullable)
 * 
 * ═════════════════════════════════════════════════════════════════════════════════
 * CONFIGURATION
 * ═════════════════════════════════════════════════════════════════════════════════
 * 
 * Treasury configuration is managed in server/config/treasury.ts:
 * 
 * treasuryConfig = {
 *   rateLimits: {...}           // Endpoint rate limits (requests per time period)
 *   defaultLimits: {...}        // Default treasury limits per DAO
 *   multisig: {...}             // Multi-sig configuration
 *   defaultContributionTypes: {} // Default contribution types
 *   whitelistCategories: [...]  // Allowed whitelist categories
 *   audit: {...}                // Audit severity mappings
 *   vaults: {...}               // Vault configuration
 *   intelligence: {...}         // AI analysis thresholds
 * }
 * 
 * To customize for your DAO:
 * - Edit server/config/treasury.ts
 * - Adjust rate limits per endpoint
 * - Set default multisig configuration
 * - Define custom contribution types
 * - Set fraud detection thresholds
 * 
 * ═════════════════════════════════════════════════════════════════════════════════
 * SECURITY MIDDLEWARE
 * ═════════════════════════════════════════════════════════════════════════════════
 * 
 * All treasury endpoints are protected by 3-layer security:
 * 
 * 1. daoMembershipGuard (Applied at /treasury level)
 *    ✓ Verifies user is authenticated
 *    ✓ Verifies user is member of DAO
 *    ✓ Attaches daoMembership and dao objects to request
 *    - Inherited by all sub-routers and endpoints
 * 
 * 2. treasuryAdminGuard (Applied to write operations - CRITICAL FIX)
 *    ✓ Restricts write operations to admin/elder roles only
 *    ✓ MtaaDAO Security Audit: Prevents "unvalidated treasury transfers"
 *    - Applied to: deposit, withdraw, approve, whitelist-approve, limits-update
 *    - Applied to: contribution-approve, multisig-config, vault-allocate, vault-rebalance
 * 
 * 3. multisigGuard (Applied to high-value transactions)
 *    ✓ Checks if withdrawal amount exceeds multisig threshold
 *    ✓ Sets req.requiresMultisig and req.approvalsNeeded
 *    ✓ Configurable per DAO via daoMultisigConfig
 * 
 * AUTHENTICATION FLOW:
 * 1. User sends authenticated request → authenticate middleware
 * 2. Request reaches /api/v1/daos/:daoId/treasury → treasuryRouter
 * 3. daoMembershipGuard validates DAO membership
 * 4. Route-specific guards applied (treasuryAdminGuard, multisigGuard)
 * 5. Handler executes with validated context
 * 6. Audit log recorded with severity level
 * 
 * ═════════════════════════════════════════════════════════════════════════════════
 * INTEGRATION CHECKLIST
 * ═════════════════════════════════════════════════════════════════════════════════
 * 
 * DATABASE:
 * □ Verify all required tables exist in shared/schema.ts
 * □ Ensure tables have proper foreign key constraints
 * □ Add database indexes for common queries (daoId, createdAt, status)
 * □ Run migrations to create tables
 * 
 * IMPORTS:
 * □ Update TreasuryService.ts with actual database table imports
 * □ Replace TODO database queries with Drizzle ORM queries
 * □ Import schema tables: treasuryTransactions, daoContributions, etc.
 * □ Verify db connection imported from ../storage
 * 
 * TREASURY ROUTER:
 * □ Update server/routes/v1/daos/treasury.ts to mount the core router properly
 * □ Verify treasuryRouter is imported in routes.ts
 * □ Verify mount path is /api/v1/daos/:daoId/treasury
 * 
 * SUB-ROUTERS:
 * □ core.ts - Implement real balance queries (line ~50)
 * □ core.ts - Implement real history queries (line ~90)
 * □ core.ts - Implement real contribution type queries (line ~290)
 * □ contributions.ts - Implement real contribution CRUD queries
 * □ management.ts - Implement whitelist and limits queries
 * □ intelligence.ts - Hook up AI analysis service
 * □ multisig.ts - Implement multisig approval logic
 * □ vaults.ts - Implement vault management queries
 * 
 * SERVICES:
 * □ Implement TreasuryService methods (server/services/treasuryService.ts)
 * □ Replace TODO comments with actual Drizzle ORM queries
 * □ Handle errors and logging properly
 * □ Test database connectivity
 * 
 * AUDIT LOGGING:
 * □ Verify logConsolidatedAuditEvent is properly configured
 * □ Test critical severity logging for treasury operations
 * □ Verify audit logs are persisted correctly
 * 
 * RATE LIMITING:
 * □ Verify rateLimitPerUser middleware is working
 * □ Adjust rates in treasury.ts config if needed
 * □ Test rate limit enforcement
 * 
 * TESTING:
 * □ Create test suite for treasury endpoints
 * □ Test authentication and authorization
 * □ Test multisig workflows
 * □ Test contribution approval flow
 * □ Test balance calculations
 * □ Test audit logging
 * □ Performance test with large transaction volumes
 * 
 * PRODUCTION:
 * □ Run database migrations
 * □ Enable audit logging
 * □ Configure rate limits appropriately
 * □ Set up monitoring/alerting
 * □ Deploy v1 treasury endpoints
 * □ Monitor for errors
 * 
 * ═════════════════════════════════════════════════════════════════════════════════
 * KEY IMPLEMENTATION PATTERNS
 * ═════════════════════════════════════════════════════════════════════════════════
 * 
 * BALANCE QUERY PATTERN:
 * ```typescript
 * const deposits = await db.select()
 *   .from(treasuryTransactions)
 *   .where(and(
 *     eq(treasuryTransactions.daoId, daoId),
 *     eq(treasuryTransactions.type, 'deposit'),
 *     eq(treasuryTransactions.status, 'completed')
 *   ));
 * 
 * const total = deposits.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
 * ```
 * 
 * PAGINATION PATTERN:
 * ```typescript
 * const items = await db.select()
 *   .from(table)
 *   .where(condition)
 *   .orderBy(desc(table.createdAt))
 *   .limit(limit)
 *   .offset(offset);
 * 
 * const total = await db.select({ count: sql<number>`count(*)` })
 *   .from(table)
 *   .where(condition);
 * ```
 * 
 * INSERT WITH AUDIT PATTERN:
 * ```typescript
 * const [result] = await db.insert(table).values({...}).returning({ id: table.id });
 * 
 * await logConsolidatedAuditEvent({
 *   dao_id: daoId,
 *   user_id: userId,
 *   action: 'operation_name',
 *   severity: 'critical',
 *   details: {...},
 * });
 * ```
 * 
 * MULTISIG CHECK PATTERN:
 * ```typescript
 * if (amountNum > config.multisig.defaultThreshold) {
 *   req.requiresMultisig = true;
 *   req.approvalsNeeded = config.multisig.defaultRequiredApprovals;
 * }
 * ```
 * 
 * ═════════════════════════════════════════════════════════════════════════════════
 * COMMON ISSUES & TROUBLESHOOTING
 * ═════════════════════════════════════════════════════════════════════════════════
 * 
 * Issue: \"Cannot find module './shared/schema'\"
 * Fix: Ensure schema tables are properly imported in TreasuryService
 * 
 * Issue: \"daoMembership is undefined\"
 * Fix: Ensure daoMembershipGuard is applied at /treasury router level
 * 
 * Issue: \"Treasury operations not being audited\"
 * Fix: Verify logConsolidatedAuditEvent is being called with correct severity
 * 
 * Issue: \"Rate limits not working\"
 * Fix: Ensure rateLimitPerUser middleware is applied before handler
 * 
 * Issue: \"Multisig not being triggered\"
 * Fix: Check daoMultisigConfig table has threshold configured for DAO
 * 
 * ═════════════════════════════════════════════════════════════════════════════════
 * SUMMARY OF CREATED FILES
 * ═════════════════════════════════════════════════════════════════════════════════
 * 
 * Configuration:
 * ✓ server/config/treasury.ts - Treasury system configuration
 * 
 * Services:
 * ✓ server/services/treasuryService.ts - Business logic layer
 * 
 * Treasury API (V1):
 * ✓ server/routes/v1/daos/_daoId/treasury/index.ts - Master router
 * ✓ server/routes/v1/daos/_daoId/treasury/security.ts - Security middleware
 * ✓ server/routes/v1/daos/_daoId/treasury/core.ts - Core operations (10 endpoints)
 * ✓ server/routes/v1/daos/_daoId/treasury/contributions.ts - Contributions (7 endpoints)
 * ✓ server/routes/v1/daos/_daoId/treasury/management.ts - Policy (5 endpoints)
 * ✓ server/routes/v1/daos/_daoId/treasury/intelligence.ts - Analysis (9 endpoints)
 * ✓ server/routes/v1/daos/_daoId/treasury/multisig.ts - Approvals (6 endpoints)
 * ✓ server/routes/v1/daos/_daoId/treasury/vaults.ts - Sub-funds (8 endpoints)
 * ✓ server/routes/v1/daos/treasury.ts - Sub-router mount
 * ✓ server/routes/v1/treasury/index.ts - System health endpoint
 * 
 * TOTAL ENDPOINTS: 45+
 * TOTAL LINES OF CODE: 3000+
 * SECURITY LAYERS: 3 (Membership, Admin Guard, Multisig)
 * 
 * ═════════════════════════════════════════════════════════════════════════════════
 */

export const integrationGuide = {
  documentVersion: '1.0',
  createdDate: '2026-03-15',
  description: 'V1 Treasury System Integration Guide',
};
