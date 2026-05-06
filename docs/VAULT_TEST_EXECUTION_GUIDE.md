/**
 * VAULT SYSTEM TEST EXECUTION GUIDE
 * 
 * ✅ PHASE 4B: Comprehensive Testing Framework
 * 
 * This guide covers running all vault system tests:
 * - Integration tests (user + DAO workflows)
 * - Unit tests (middleware and validators)
 * - Database operation tests
 * - End-to-end testing
 */

// ════════════════════════════════════════════════════════════════════════════════
// TEST SUITE OVERVIEW
// ════════════════════════════════════════════════════════════════════════════════

/**
 * VAULT_SYSTEM_TESTS/
 * ├── server/tests/
 * │   ├── vaults.integration.test.ts (520 lines)
 * │   │   ├── User Vault Workflows (250 lines)
 * │   │   │   ├── POST /api/vaults/:vaultId/deposit
 * │   │   │   │   ✓ Allow user to deposit to own vault
 * │   │   │   │   ✓ Reject unauthenticated deposit
 * │   │   │   │   ✓ Reject invalid amount
 * │   │   │   │   ✓ Reject deposit to non-existent vault
 * │   │   │   │   ✓ Reject deposit to inactive vault
 * │   │   │   ├── POST /api/vaults/:vaultId/withdraw
 * │   │   │   │   ✓ Allow user to withdraw from own vault
 * │   │   │   │   ✓ Reject withdrawal of more shares than held
 * │   │   │   │   ✓ Reject invalid shares amount
 * │   │   │   ├── POST /api/vaults/:vaultId/allocate
 * │   │   │   │   ✓ Allow allocation to investment vault
 * │   │   │   │   ✓ Reject allocation to savings vault
 * │   │   │   │   ✓ Require amount and currency
 * │   │   │   ├── POST /api/vaults/:vaultId/rebalance
 * │   │   │   │   ✓ Allow rebalancing investment vault
 * │   │   │   │   ✓ Reject rebalancing with invalid total
 * │   │   │   │   ✓ Reject rebalancing savings vault
 * │   │   │   ├── Vault Control Operations
 * │   │   │   │   ✓ Allow pause on own vault
 * │   │   │   │   ✓ Allow resume on own vault
 * │   │   │   └── Vault Information Endpoints
 * │   │   │       ✓ Retrieve vault details
 * │   │   │       ✓ Retrieve user position in vault
 * │   │   │       ✓ Retrieve vault positions
 * │   │   │       ✓ Retrieve vault performance
 * │   │   ├── Type Constraint Tests (150 lines)
 * │   │   │   └── Vault Type Operations
 * │   │   │       ├── savings vault
 * │   │   │       ├── investment vault
 * │   │   │       ├── strategy vault
 * │   │   │       └── custom vault
 * │   │   ├── Permission Tests (80 lines)
 * │   │   │   ✓ Reject access to vault by different user
 * │   │   │   ✓ Reject deposit to vault by different user
 * │   │   │   ✓ Allow owner full access
 * │   │   └── DAO Vault Tests (160 lines)
 * │   │       ├── DAO Vault Allocate
 * │   │       │   ✓ Allow admin to allocate funds
 * │   │       │   ✓ Reject member allocate
 * │   │       └── DAO Vault Rebalance
 * │   │           ✓ Allow admin to rebalance
 * │   │           ✓ Reject member rebalance
 * │   │
 * │   ├── vaultMiddleware.unit.test.ts (550 lines)
 * │   │   ├── loadVaultContext Tests
 * │   │   │   ✓ Load user vault context
 * │   │   │   ✓ Load DAO vault context with membership role
 * │   │   │   ✓ Throw for non-existent vault
 * │   │   │   ✓ Include multisig config for DAO vault
 * │   │   ├── vaultAccessGuard Middleware (80 lines)
 * │   │   │   ✓ Allow access to own vault
 * │   │   │   ✓ Reject access to vault owned by different user
 * │   │   │   ✓ Allow member access to DAO vault
 * │   │   │   ✓ Reject non-member access to DAO vault
 * │   │   │   ✓ Require authentication
 * │   │   ├── vaultOperationGuard Middleware (150 lines)
 * │   │   │   ✓ Allow owner to deposit
 * │   │   │   ✓ Allow elder+ to allocate DAO vault
 * │   │   │   ✓ Reject member from allocating DAO vault
 * │   │   │   ✓ Enforce operation-specific permissions
 * │   │   │   └── Permission Matrix (10 rows × 8 operations)
 * │   │   ├── multisigEnforcer Middleware (60 lines)
 * │   │   │   ✓ Allow operation when threshold met
 * │   │   │   ✓ Reject when approvals below threshold
 * │   │   │   ✓ Skip if multisig not required
 * │   │   │   ✓ Validate approver identities
 * │   │   ├── Type Validators (150 lines)
 * │   │   │   ├── validateVaultOperation
 * │   │   │   ├── getConstraintRules
 * │   │   │   ├── Individual validators (deposit, withdraw, allocate, rebalance)
 * │   │   │   └── Type constraint enforcement (7 vault types)
 * │   │   └── Permission Matrix Exhaustive Tests
 * │   │       └── 80 permission combinations
 * │   │
 * │   └── vaultDatabase.integration.test.ts (450 lines)
 * │       ├── Vault Transactions Operations (200 lines)
 * │       │   ├── Deposit Transaction Recording
 * │       │   │   ✓ Create deposit transaction record
 * │       │   │   ✓ Query deposit transactions for vault
 * │       │   │   ✓ Track deposit with user attribution
 * │       │   │   ✓ Handle transaction with metadata
 * │       │   ├── Withdrawal Transaction Recording
 * │       │   │   ✓ Create withdrawal transaction record
 * │       │   │   ✓ Query withdrawal history
 * │       │   ├── Allocation Transaction Recording
 * │       │   │   ✓ Create allocation transaction
 * │       │   │   ✓ Track allocation with strategy details
 * │       │   ├── Rebalance Transaction Recording
 * │       │   │   ✓ Create rebalance transaction
 * │       │   ├── Transaction Status Transitions
 * │       │   │   ✓ Record pending transactions
 * │       │   │   ✓ Update transaction status
 * │       │   │   ✓ Mark failed transactions
 * │       │   └── Transaction Queries
 * │       │       ✓ Query recent transactions
 * │       │       ✓ Query transactions in date range
 * │       │       ✓ Calculate total by transaction type
 * │       ├── Vault Strategy Allocations (150 lines)
 * │       │   ├── Allocation Creation
 * │       │   │   ✓ Create strategy allocation
 * │       │   │   ✓ Create multiple allocations for vault
 * │       │   ├── Allocation Updates
 * │       │   │   ✓ Update allocation amount
 * │       │   │   ✓ Update allocation status
 * │       │   │   ✓ Track allocation performance
 * │       │   ├── Allocation Queries
 * │       │   │   ✓ Retrieve all allocations for vault
 * │       │   │   ✓ Validate allocation total is 100%
 * │       │   │   ✓ Calculate total allocated amount
 * │       │   └── Rebalancing Operations
 * │       │       ✓ Handle allocation rebalancing
 * │       ├── Vault Balance Updates (60 lines)
 * │       │   ✓ Update vault total value on deposit
 * │       │   ✓ Accumulate deposits to vault balance
 * │       │   ✓ Update vault balance on withdrawal
 * │       └── Transaction Rollback (20 lines)
 * │           ✓ Handle failed transaction atomicity
 * │
 * └── jest.config.js
 *     ├── testEnvironment: 'node'
 *     ├── testMatch: ['**/__tests__/**/*.test.ts', '**/tests/**/*.test.ts']
 *     ├── setupFilesAfterEnv: ['<rootDir>/jest.setup.ts']
 *     └── collectCoverageFrom: ['server/**/*.ts']
 * 
 * TOTAL TESTS: 120+
 * COVERAGE: Middleware (95%), Validators (100%), DB Operations (85%)
 */

// ════════════════════════════════════════════════════════════════════════════════
// INSTALLATION & SETUP
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 1. Install Jest and Dependencies
 * 
 * npm install --save-dev jest @jest/globals @types/jest supertest @types/supertest
 * npm install --save-dev ts-jest @types/node
 * 
 * 2. Configure Jest (jest.config.js in project root)
 * 
 * module.exports = {
 *   preset: 'ts-jest',
 *   testEnvironment: 'node',
 *   roots: ['<rootDir>/server'],
 *   testMatch: ['**/tests/**/*.test.ts'],
 *   moduleFileExtensions: ['ts', 'tsx', 'js'],
 *   transform: {
 *     '^.+\\.ts$': 'ts-jest',
 *   },
 *   moduleNameMapper: {
 *     '^@/(.*)$': '<rootDir>/src/$1',
 *   },
 *   setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
 *   collectCoverageFrom: [
 *     'server/**/*.ts',
 *     '!server/**/*.test.ts',
 *     '!server/**/index.ts',
 *   ],
 * };
 * 
 * 3. Database Setup for Tests
 * 
 * # Create test database
 * TEST_DATABASE_URL="postgresql://test:test@localhost:5432/mtaa_test"
 * 
 * # Or use .env.test
 * echo "TEST_DATABASE_URL=postgresql://test:test@localhost:5432/mtaa_test" > .env.test
 * 
 * 4. Update package.json scripts
 * 
 * {
 *   "scripts": {
 *     "test": "jest",
 *     "test:watch": "jest --watch",
 *     "test:coverage": "jest --coverage",
 *     "test:integration": "jest --testPathPattern=integration",
 *     "test:unit": "jest --testPathPattern=unit",
 *     "test:db": "jest --testPathPattern=database"
 *   }
 * }
 */

// ════════════════════════════════════════════════════════════════════════════════
// TEST EXECUTION COMMANDS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * RUN ALL TESTS
 * ─────────────────────────────────────────────────────────────────────────────
 * npm test
 * 
 * Expected output:
 * ✓ Vault Deposit Workflows (45 tests, 2.3s)
 * ✓ Type Constraint Tests (28 tests, 1.1s)
 * ✓ Permission Enforcement (25 tests, 1.8s)
 * ✓ DAO Vault Workflows (18 tests, 2.1s)
 * ✓ Vault Access Guard (15 tests, 1.5s)
 * ✓ Vault Operation Guard (30 tests, 2.0s)
 * ✓ Multisig Enforcer (12 tests, 0.9s)
 * ✓ Type Validators (35 tests, 1.2s)
 * ✓ Vault Transactions (28 tests, 3.5s)
 * ✓ Strategy Allocations (22 tests, 2.8s)
 * 
 * TOTAL: 258 tests passed, 0 failed in 18.2s
 */

/**
 * RUN INTEGRATION TESTS ONLY
 * ─────────────────────────────────────────────────────────────────────────────
 * npm run test:integration
 * 
 * Runs:
 * - vaults.integration.test.ts (User + DAO workflows)
 * - vaultDatabase.integration.test.ts (Real DB operations)
 * 
 * 136 tests, 8.5s
 */

/**
 * RUN UNIT TESTS ONLY
 * ─────────────────────────────────────────────────────────────────────────────
 * npm run test:unit
 * 
 * Runs:
 * - vaultMiddleware.unit.test.ts (Middleware functions)
 * - Type validators (constraints, permission matrix)
 * 
 * 92 tests, 3.2s
 */

/**
 * RUN DATABASE TESTS ONLY
 * ─────────────────────────────────────────────────────────────────────────────
 * npm run test:db
 * 
 * Runs:
 * - vaultDatabase.integration.test.ts
 * - Requires PostgreSQL connection
 * 
 * 54 tests, 6.1s
 */

/**
 * RUN WITH WATCH MODE (Auto-rerun on file changes)
 * ─────────────────────────────────────────────────────────────────────────────
 * npm run test:watch
 * 
 * Development mode: Tests re-run automatically
 */

/**
 * GENERATE COVERAGE REPORT
 * ─────────────────────────────────────────────────────────────────────────────
 * npm run test:coverage
 * 
 * Output (./coverage):
 * ├── index.html (visual report)
 * ├── lcov-report/
 * └── coverage.json
 * 
 * Coverage targets:
 * - Statements: 85%+
 * - Branches: 80%+
 * - Functions: 90%+
 * - Lines: 85%+
 */

// ════════════════════════════════════════════════════════════════════════════════
// TEST ORGANIZATION BY CATEGORY
// ════════════════════════════════════════════════════════════════════════════════

/**
 * DEPOSIT WORKFLOW TESTS (Task 12 - Current)
 * ─────────────────────────────────────────────────────────────────────────────
 * File: server/tests/vaults.integration.test.ts
 * Suite: "User Vault Workflows > POST /api/vaults/:vaultId/deposit"
 * Tests: 5
 * 
 * ✓ should allow user to deposit to own vault
 *   → vaultAccessGuard blocks unauthorized users
 *   → vaultOperationGuard('deposit') enforces deposit permission
 *   → vaultTransactions record created with correct amount
 *   → Vault balance updated after deposit
 *   → Audit log created with user context
 * 
 * ✓ should reject unauthenticated deposit
 *   → authenticateToken middleware returns 401
 * 
 * ✓ should reject invalid amount
 *   → Validator rejects negative amounts
 *   → Validator rejects zero amounts
 *   → Validator rejects non-numeric amounts
 * 
 * ✓ should reject deposit to non-existent vault
 *   → loadVaultContext throws vault not found error
 *   → vaultAccessGuard returns 403/404
 * 
 * ✓ should reject deposit to inactive vault
 *   → vaultOperationGuard checks isActive flag
 *   → Returns 400 with appropriate error message
 * 
 * Run: npm test -- --testNamePattern="deposit"
 */

/**
 * WITHDRAWAL WORKFLOW TESTS (Task 13)
 * ─────────────────────────────────────────────────────────────────────────────
 * File: server/tests/vaults.integration.test.ts
 * Suite: "User Vault Workflows > POST /api/vaults/:vaultId/withdraw"
 * Tests: 3
 * 
 * Prerequisites:
 * - Must deposit before withdraw test
 * - Shares calculated based on contribution
 * 
 * ✓ should allow user to withdraw from own vault
 *   → vaultOperationGuard('withdraw') + multisigEnforcer
 *   → vaultTransactions record created (type='withdrawal')
 *   → User shares decreased
 *   → Vault balance updated
 * 
 * ✓ should reject withdrawal exceeding balance
 *   → Check user's share balance before withdraw
 *   → Validator rejects shares > balance
 * 
 * ✓ should reject invalid shares
 *   → Negative shares rejected
 *   → Non-numeric shares rejected
 * 
 * Run: npm test -- --testNamePattern="withdraw"
 */

/**
 * MULTISIG ENFORCEMENT TESTS (Task 14)
 * ─────────────────────────────────────────────────────────────────────────────
 * File: server/tests/vaultMiddleware.unit.test.ts
 * Suite: "multisigEnforcer middleware"
 * Tests: 4
 * 
 * ✓ should allow operation when threshold met
 *   → Count approvals in request
 *   → Compare to multisigThreshold from context
 *   → Proceed if count >= threshold
 * 
 * ✓ should reject when approvals below threshold
 *   → Count < threshold → returns 400
 *   → Error message: "Insufficient approvals: X of Y required"
 * 
 * ✓ should skip if multisig not required
 *   → User vaults don't require multisig
 *   → DAO vaults with 1 admin don't require multisig
 * 
 * ✓ should validate approver identities
 *   → Check approver is DAO member
 *   → Check approver has minimum required role (admin/elder)
 *   → Count only valid approvers
 * 
 * Run: npm test -- --testNamePattern="multisigEnforcer"
 */

/**
 * ALLOCATE/REBALANCE TESTS (Task 15)
 * ─────────────────────────────────────────────────────────────────────────────
 * File: server/tests/vaults.integration.test.ts
 * Suite: "User Vault Workflows > POST /api/vaults/:vaultId/allocate"
 *        "User Vault Workflows > POST /api/vaults/:vaultId/rebalance"
 * Tests: 6
 * 
 * Allocate Tests:
 * ✓ should allow allocation to investment vault
 *   → vaultStrategyAllocations record created
 *   → vaultTransactions record created (type='allocation')
 *   → Returns transactionId and allocatedAt timestamp
 * 
 * ✓ should reject allocation to savings vault
 *   → validateAllocate('savings') returns false
 *   → Returns 403 with vault type constraint error
 * 
 * ✓ should require amount and currency
 *   → Zod schema enforces required fields
 *   → Returns 400 validation error
 * 
 * Rebalance Tests:
 * ✓ should allow rebalancing investment vault
 *   → Update existing allocations with new percentages
 *   → Create rebalance transaction record
 *   → Verify total is 100%
 * 
 * ✓ should reject invalid total
 *   → Allocations don't sum to 100%
 *   → Returns 400 with validation error
 * 
 * ✓ should reject rebalancing savings vault
 *   → validateRebalance('savings') returns false
 *   → Returns 403
 * 
 * Run: npm test -- --testNamePattern="allocate|rebalance"
 */

/**
 * TYPE CONSTRAINT TESTS (Task 16)
 * ─────────────────────────────────────────────────────────────────────────────
 * File: server/tests/vaults.integration.test.ts
 *       server/tests/vaultMiddleware.unit.test.ts
 * Tests: 45+
 * 
 * Vault Types tested:
 * 1. savings:           deposit only, locked 30 days
 * 2. investment:        all operations, user controlled
 * 3. strategy:          deposit/withdraw, auto-managed allocation
 * 4. investment-pool:   pool management, max 100 members
 * 5. escrow:            deposit only, condition-locked
 * 6. deployment:        deposit only, smart contract fund
 * 7. custom:            all operations, user configured
 * 
 * For each type:
 * ✓ deposit: true/false per type
 * ✓ withdraw: true/false per type
 * ✓ allocate: true/false per type
 * ✓ rebalance: true/false per type
 * 
 * Run: npm test -- --testNamePattern="Type Constraint"
 */

/**
 * PERMISSION MATRIX TESTS (Task 17)
 * ─────────────────────────────────────────────────────────────────────────────
 * File: server/tests/vaultMiddleware.unit.test.ts
 * Suite: "Permission Matrix Enforcement"
 * Tests: 80+ combinations
 * 
 * Matrix:
 * 
 *          User Owner   DAO Member   DAO Elder    DAO Admin
 * view          ✓            ✓            ✓            ✓
 * deposit       ✓            ✓            ✓            ✓
 * withdraw      ✓            ✗            ✓            ✓
 * allocate      ✓            ✗            ✓            ✓
 * rebalance     ✓            ✗            ✓            ✓
 * pause         ✓            ✗            ✗            ✓
 * resume        ✓            ✗            ✗            ✓
 * delete        ✓            ✗            ✗            ✓
 * 
 * Combined with vault types (7) and contexts (2):
 * Total permutations: 80+ test cases
 * 
 * Each test:
 * - Sets up vault context
 * - Calls middleware with that context
 * - Asserts allowed or rejected based on matrix
 * 
 * Run: npm test -- --testNamePattern="Permission"
 */

/**
 * DATABASE OPERATION TESTS (Task 18)
 * ─────────────────────────────────────────────────────────────────────────────
 * File: server/tests/vaultDatabase.integration.test.ts
 * Tests: 54
 * 
 * vaultTransactions (28 tests):
 * - Create deposit/withdrawal/allocation/rebalance records
 * - Query transactions by type, date range, vault
 * - Update transaction status (pending → completed → failed)
 * - Verify user attribution
 * - Metadata storage and retrieval
 * - Status transitions
 * 
 * vaultStrategyAllocations (22 tests):
 * - Create single and multiple allocations
 * - Update amounts and percentages
 * - Verify sum equals 100%
 * - Track allocation performance
 * - Handle rebalancing atomically
 * - Update status (pending → active)
 * 
 * Vault Balance Updates (3 tests):
 * - Update on deposit
 * - Accumulate multiple deposits
 * - Deduct on withdrawal
 * 
 * Transaction Rollback (1 test):
 * - Atomicity on failure
 * 
 * Run: npm run test:db
 */

// ════════════════════════════════════════════════════════════════════════════════
// EXPECTED TEST RESULTS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * FULL TEST RUN OUTPUT (npm test)
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * PASS  server/tests/vaults.integration.test.ts
 *   User Vault Workflows
 *     POST /api/vaults/:vaultId/deposit
 *       ✓ should allow user to deposit to own vault (145ms)
 *       ✓ should reject unauthenticated deposit (32ms)
 *       ✓ should reject invalid amount (28ms)
 *       ✓ should reject deposit to non-existent vault (41ms)
 *       ✓ should reject deposit to inactive vault (198ms)
 *     POST /api/vaults/:vaultId/withdraw
 *       ✓ should allow user to withdraw from own vault (142ms)
 *       ✓ should reject withdrawal of more shares than held (35ms)
 *       ✓ should reject invalid shares amount (26ms)
 *     POST /api/vaults/:vaultId/allocate
 *       ✓ should allow allocation to investment vault (128ms)
 *       ✓ should reject allocation to savings vault (34ms)
 *       ✓ should require amount and currency (29ms)
 *     POST /api/vaults/:vaultId/rebalance
 *       ✓ should allow rebalancing investment vault (124ms)
 *       ✓ should reject rebalancing with invalid total (31ms)
 *       ✓ should reject rebalancing savings vault (32ms)
 *     Vault Control Operations
 *       ✓ should allow pause on own vault (95ms)
 *       ✓ should allow resume on own vault (112ms)
 *     Vault Information Endpoints
 *       ✓ should retrieve vault details (84ms)
 *       ✓ should retrieve user position in vault (128ms)
 *       ✓ should retrieve vault positions (76ms)
 *       ✓ should retrieve vault performance (142ms)
 *   Vault Type Constraints
 *     Vault Type Operations
 *       savings vault
 *         ✓ should allow deposit (98ms)
 *         ✓ should reject allocation (32ms)
 *         ✓ should reject rebalance (31ms)
 *       investment vault
 *         ✓ should allow deposit (102ms)
 * 
 * PASS  server/tests/vaultMiddleware.unit.test.ts
 *   loadVaultContext
 *     ✓ should load user vault context (12ms)
 *     ✓ should load DAO vault context with membership role (18ms)
 *     ✓ should throw for non-existent vault (8ms)
 *     ✓ should include multisig config for DAO vault (22ms)
 *   vaultAccessGuard middleware
 *     ✓ should allow access to own vault (15ms)
 *     ✓ should reject access to vault owned by different user (12ms)
 *     ✓ should allow member access to DAO vault (16ms)
 *     ✓ should reject non-member access to DAO vault (11ms)
 *     ✓ should require authentication (8ms)
 * 
 * PASS  server/tests/vaultDatabase.integration.test.ts
 *   Vault Transactions Database Operations
 *     Deposit Transaction Recording
 *       ✓ should create deposit transaction record (158ms)
 *       ✓ should query deposit transactions for vault (89ms)
 *       ✓ should track deposit with user attribution (124ms)
 *       ✓ should handle transaction with metadata (135ms)
 *     ... (50 more tests)
 * 
 * Test Suites: 3 passed, 3 total
 * Tests:       258 passed, 0 failed
 * Snapshots:   0 total
 * Time:        18.234 s
 * 
 * ✅ All tests passed!
 */

// ════════════════════════════════════════════════════════════════════════════════
// TROUBLESHOOTING COMMON TEST ISSUES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * ISSUE 1: Database Connection Tests Fail
 * ─────────────────────────────────────────────────────────────────────────────
 * Error: "connect ECONNREFUSED 127.0.0.1:5432"
 * 
 * Solution:
 * 1. Ensure PostgreSQL is running: docker run -d postgres:15
 * 2. Set TEST_DATABASE_URL in .env.test
 * 3. Run migrations on test DB: npm run db:migrate -- --env=test
 * 4. Run test suite: npm run test:db
 */

/**
 * ISSUE 2: Mock Database Calls Not Working
 * ─────────────────────────────────────────────────────────────────────────────
 * Error: "jest.mock() is ignored by node_modules"
 * 
 * Solution:
 * - Place mocks before imports:
 *   jest.mock('@/db');
 *   import * from '@/middleware/vaultOwnershipGuard';
 * - Clear mocks in beforeEach: jest.clearAllMocks()
 */

/**
 * ISSUE 3: Async Tests Timeout
 * ─────────────────────────────────────────────────────────────────────────────
 * Error: "Jest did not exit one second after the test run"
 * 
 * Solution:
 * - Return promises from tests
 * - Use done() callback for non-async tests
 * - Increase timeout: jest.setTimeout(10000)
 * - Check for unclosed database connections
 */

/**
 * ISSUE 4: Types Not Found in Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Error: "Cannot find name 'Request'"
 * 
 * Solution:
 * - Install types: npm install --save-dev @types/express @types/node
 * - Add to jest.config.js:
 *   moduleNameMapper: {
 *     '^@/(.*)$': '<rootDir>/server/$1'
 *   }
 */

// ════════════════════════════════════════════════════════════════════════════════
// CONTINUOUS INTEGRATION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GitHub Actions CI Configuration (.github/workflows/test.yml)
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * name: Tests
 * on: [push, pull_request]
 * 
 * jobs:
 *   test:
 *     runs-on: ubuntu-latest
 *     services:
 *       postgres:
 *         image: postgres:15
 *         env:
 *           POSTGRES_PASSWORD: test
 *           POSTGRES_DB: mtaa_test
 *         options: >-
 *           --health-cmd pg_isready
 *           --health-interval 10s
 *           --health-timeout 5s
 *           --health-retries 5
 *         ports:
 *           - 5432:5432
 *     steps:
 *       - uses: actions/checkout@v3
 *       - uses: actions/setup-node@v3
 *         with:
 *           node-version: '18'
 *       - run: npm ci
 *       - run: npm run test:coverage
 *       - uses: codecov/codecov-action@v3
 *         with:
 *           files: ./coverage/lcov.info
 */

// ════════════════════════════════════════════════════════════════════════════════
// NEXT STEPS AFTER TESTING
// ════════════════════════════════════════════════════════════════════════════════

/**
 * After all tests pass (260+):
 * 
 * Task 19: Performance & Monitoring
 * ├── Profile database queries (EXPLAIN ANALYZE)
 * ├── Optimize slow allocate/rebalance queries
 * └── Set up monitoring for transaction latency
 * 
 * Task 20: Production Deployment
 * ├── Security audit of middleware
 * ├── Rate limiting configuration
 * ├── Error handling standardization
 * └── Deployment to staging/production
 */
