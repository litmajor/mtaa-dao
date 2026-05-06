/**
 * V1 TREASURY API REFERENCE
 * ═══════════════════════════════════════════════════════════════════════════════════
 * 
 * Complete API endpoint reference for DAO Treasury Management System (V1)
 * Created: March 15, 2026
 * Status: INTEGRATION READY
 * 
 * ═══════════════════════════════════════════════════════════════════════════════════
 * BASE PATH: /api/v1/daos/:daoId/treasury
 * AUTHENTICATION: JWT Bearer Token (all endpoints)
 * ═══════════════════════════════════════════════════════════════════════════════════
 * 
 * SECURITY GUARDS (Applied in order):
 * 1. authenticate (JWT validation) - global middleware
 * 2. daoMembershipGuard (verify DAO membership) - at /treasury level
 * 3. treasuryAdminGuard (verify admin/elder for writes) - per endpoint
 * 4. multisigGuard (check multisig threshold) - per endpoint
 * 
 * RESPONSE FORMAT (All endpoints):
 * Success: { data: {...}, success: true }
 * Error: { error: \"message\", details: {...}, success: false }
 * 
 * ═══════════════════════════════════════════════════════════════════════════════════
 * SECTION 1: CORE OPERATIONS
 * ═══════════════════════════════════════════════════════════════════════════════════
 * Available at: /api/v1/daos/:daoId/treasury/core
 * 
 * 1. GET /balance
 *    Purpose: Get current treasury balance and breakdown
 *    Auth: Member read
 *    Rate: 30 requests/minute
 *    Response:
 *      {
 *        \"total\": \"1000000.00\",
 *        \"available\": \"750000.00\",
 *        \"pending\": \"250000.00\",
 *        \"currency\": \"cUSD\",
 *        \"breakdown\": {
 *          \"deposits\": \"1000000.00\",
 *          \"withdrawals\": \"0.00\",
 *          \"transfers\": \"0.00\"
 *        }
 *      }
 * 
 * 2. GET /history?limit=20&offset=0
 *    Purpose: Get paginated transaction history
 *    Auth: Member read
 *    Rate: 20 requests/minute
 *    Query Parameters:
 *      - limit: number (default: 20, max: 100)
 *      - offset: number (default: 0)
 *    Response:
 *      {
 *        \"transactions\": [
 *          {
 *            \"id\": \"tx_1\",
 *            \"type\": \"deposit\",
 *            \"amount\": \"100000.00\",
 *            \"status\": \"completed\",
 *            \"initiatedBy\": \"user_1\",
 *            \"initiatedAt\": \"2026-03-15T10:23:45.000Z\",
 *            \"completedAt\": \"2026-03-15T10:23:50.000Z\",
 *            \"description\": \"Grant allocation Q1 2026\"
 *          }
 *        ],
 *        \"total\": 42,
 *        \"limit\": 20,
 *        \"offset\": 0
 *      }
 * 
 * 3. POST /deposit
 *    Purpose: Record incoming funds (audit: CRITICAL)
 *    Auth: Admin/Elder write
 *    Rate: 20 requests/10 minutes
 *    Audit Severity: CRITICAL (logged)
 *    Request Body:
 *      {
 *        \"amount\": \"100000\",
 *        \"currency\": \"cUSD\",
 *        \"description\": \"Grant allocation\"
 *      }
 *    Response:
 *      {
 *        \"id\": \"tx_new_1\",
 *        \"status\": \"pending\",
 *        \"amount\": \"100000\",
 *        \"recordedAt\": \"2026-03-15T10:23:45.000Z\"
 *      }
 * 
 * 4. POST /withdraw
 *    Purpose: Record outgoing funds (audit: CRITICAL)
 *    Auth: Admin/Elder write
 *    Rate: 10 requests/10 minutes
 *    Audit Severity: CRITICAL (logged)
 *    Request Body:
 *      {
 *        \"amount\": \"50000\",
 *        \"recipient\": \"0x123...\",
 *        \"reason\": \"Team payments\"
 *      }
 *    Response:
 *      {
 *        \"id\": \"tx_new_2\",
 *        \"status\": \"pending/requires-multisig\",
 *        \"amount\": \"50000\",
 *        \"requiresMultisig\": true,
 *        \"approvalsNeeded\": 2
 *      }
 *    NOTE: If amount > multisigThreshold, requires multisig approval
 * 
 * 5. POST /transfer
 *    Purpose: Transfer between vaults or external (audit: CRITICAL)
 *    Auth: Admin/Elder write
 *    Rate: 10 requests/10 minutes
 *    Audit Severity: CRITICAL (logged)
 *    Request Body:
 *      {
 *        \"amount\": \"25000\",
 *        \"from\": \"vault_1\",
 *        \"to\": \"vault_2\",
 *        \"reason\": \"Rebalancing\"
 *      }
 *    Response:
 *      {
 *        \"id\": \"tx_new_3\",
 *        \"status\": \"completed\",
 *        \"from\": \"vault_1\",
 *        \"to\": \"vault_2\"
 *      }
 * 
 * 6. GET /transaction/:id
 *    Purpose: Get detailed transaction information
 *    Auth: Member read
 *    Rate: 50 requests/minute
 *    Response:
 *      {
 *        \"id\": \"tx_1\",
 *        \"type\": \"deposit\",
 *        \"amount\": \"100000\",
 *        \"status\": \"completed\",
 *        \"initiatedBy\": {...},
 *        \"approvals\": [
 *          {
 *            \"signedBy\": \"addr_1\",
 *            \"timestamp\": \"2026-03-15T10:25:00.000Z\",
 *            \"comment\": \"Approved\"
 *          }
 *        ],
 *        \"auditTrail\": [...]
 *      }
 * 
 * 7. GET /reconciliation?startDate=2026-01-01&endDate=2026-03-15
 *    Purpose: Generate reconciliation report
 *    Auth: Admin read
 *    Rate: 5 requests/hour
 *    Query Parameters:
 *      - startDate: ISO date string
 *      - endDate: ISO date string
 *    Response:
 *      {
 *        \"period\": \"2026-01-01 to 2026-03-15\",
 *        \"openingBalance\": \"900000\",
 *        \"deposits\": \"200000\",
 *        \"withdrawals\": \"100000\",
 *        \"closingBalance\": \"1000000\",
 *        \"variance\": \"0.00\",
 *        \"reconciled\": true
 *      }
 * 
 * 8. POST /approve-transaction/:id
 *    Purpose: Approve pending transaction (audit: CRITICAL)
 *    Auth: Admin/Elder write
 *    Rate: 10 requests/5 minutes
 *    Audit Severity: CRITICAL (logged)
 *    Request Body:
 *      {
 *        \"comment\": \"Reviewed and approved\"
 *      }
 *    Response:
 *      {
 *        \"id\": \"tx_1\",
 *        \"status\": \"approved\",
 *        \"approvedBy\": \"user_1\",
 *        \"approvedAt\": \"2026-03-15T10:26:00.000Z\"
 *      }
 * 
 * 9. POST /reject-transaction/:id
 *    Purpose: Reject pending transaction (audit: MEDIUM)
 *    Auth: Admin/Elder write
 *    Rate: 10 requests/5 minutes
 *    Audit Severity: MEDIUM (logged)
 *    Request Body:
 *      {
 *        \"reason\": \"Insufficient documentation\"
 *      }
 *    Response:
 *      {
 *        \"id\": \"tx_1\",
 *        \"status\": \"rejected\",
 *        \"rejectedBy\": \"user_1\",
 *        \"reason\": \"Insufficient documentation\"
 *      }
 * 
 * 10. GET /transactions-by-status/:status
 *     Purpose: Filter transactions by status
 *     Auth: Member read
 *     Rate: 30 requests/minute
 *     Path Parameters:
 *       - status: 'pending' | 'approved' | 'completed' | 'rejected'
 *     Response: Array of transactions
 * 
 * ═══════════════════════════════════════════════════════════════════════════════════
 * SECTION 2: CONTRIBUTIONS
 * ═══════════════════════════════════════════════════════════════════════════════════
 * Available at: /api/v1/daos/:daoId/treasury/contributions
 * 
 * 1. GET /types
 *    Purpose: Get contribution types for this DAO
 *    Auth: Member read
 *    Rate: 30 requests/minute
 *    Response:
 *      {
 *        \"types\": [
 *          {
 *            \"id\": \"type_1\",
 *            \"name\": \"Grant\",
 *            \"minimumAmount\": \"1000\",
 *            \"maximumAmount\": \"100000\",
 *            \"requiresApproval\": true
 *          }
 *        ]
 *      }
 * 
 * 2. POST /types
 *    Purpose: Create custom contribution type (audit: MEDIUM)
 *    Auth: Admin/Elder write
 *    Rate: 5 requests/hour
 *    Request Body:
 *      {
 *        \"name\": \"Bounty\",
 *        \"description\": \"Community bounty contributions\",
 *        \"minimumAmount\": \"100\",
 *        \"maximumAmount\": \"50000\",
 *        \"requiresApproval\": false
 *      }
 *    Response:
 *      {
 *        \"id\": \"type_new\",
 *        \"name\": \"Bounty\",
 *        \"createdAt\": \"2026-03-15T10:23:45.000Z\"
 *      }
 * 
 * 3. GET /?status=pending&limit=20&offset=0
 *    Purpose: Get contributions with optional filtering
 *    Auth: Member read
 *    Rate: 20 requests/minute
 *    Query Parameters:
 *      - status: 'pending' | 'approved' | 'rejected' (optional)
 *      - limit: number (default: 20)
 *      - offset: number (default: 0)
 *    Response:
 *      {
 *        \"contributions\": [{...}],
 *        \"total\": 42
 *      }
 * 
 * 4. POST /
 *    Purpose: Submit new contribution
 *    Auth: Member write
 *    Rate: 10 requests/hour
 *    Request Body:
 *      {
 *        \"typeId\": \"type_1\",
 *        \"amount\": \"5000\",
 *        \"description\": \"Q1 grant fund\"
 *      }
 *    Response:
 *      {
 *        \"id\": \"contrib_new\",
 *        \"status\": \"pending\",
 *        \"submittedAt\": \"2026-03-15T10:23:45.000Z\"
 *      }
 * 
 * 5. GET /:id
 *    Purpose: Get contribution details
 *    Auth: Member read
 *    Rate: 50 requests/minute
 *    Response:
 *      {
 *        \"id\": \"contrib_1\",
 *        \"type\": \"Grant\",
 *        \"amount\": \"5000\",
 *        \"status\": \"pending\",
 *        \"submittedBy\": {...},
 *        \"auditTrail\": [...]
 *      }
 * 
 * 6. POST /:id/approve
 *    Purpose: Approve pending contribution (audit: CRITICAL)
 *    Auth: Admin/Elder write
 *    Rate: 10 requests/5 minutes
 *    Audit Severity: CRITICAL (logged)
 *    Request Body:
 *      {
 *        \"comment\": \"Approved for processing\",
 *        \"autoFund\": true
 *      }
 *    Response:
 *      {
 *        \"id\": \"contrib_1\",
 *        \"status\": \"approved\",
 *        \"autoFund\": true,
 *        \"fundsTransferred\": \"5000\"
 *      }
 * 
 * 7. POST /:id/reject
 *    Purpose: Reject contribution (audit: MEDIUM)
 *    Auth: Admin/Elder write
 *    Rate: 10 requests/5 minutes
 *    Request Body:
 *      {
 *        \"reason\": \"Does not meet criteria\"
 *      }
 *    Response:
 *      {
 *        \"id\": \"contrib_1\",
 *        \"status\": \"rejected\",
 *        \"reason\": \"Does not meet criteria\"
 *      }
 * 
 * ═══════════════════════════════════════════════════════════════════════════════════
 * SECTION 3: MANAGEMENT (Whitelist & Limits)
 * ═══════════════════════════════════════════════════════════════════════════════════
 * Available at: /api/v1/daos/:daoId/treasury/management
 * 
 * 1. GET /whitelist?limit=50
 *    Purpose: Get approved recipient whitelist
 *    Auth: Member read
 *    Rate: 30 requests/minute
 *    Response:
 *      {
 *        \"whitelist\": [
 *          {
 *            \"id\": \"wl_1\",
 *            \"walletAddress\": \"0x123...\",
 *            \"recipientName\": \"Team Member\",
 *            \"category\": \"team\",
 *            \"approvedAt\": \"2026-01-01T00:00:00.000Z\"
 *          }
 *        ]
 *      }
 * 
 * 2. POST /whitelist/request
 *    Purpose: Request to add recipient to whitelist (audit: MEDIUM)
 *    Auth: Member write
 *    Rate: 5 requests/day
 *    Request Body:
 *      {
 *        \"walletAddress\": \"0x456...\",
 *        \"recipientName\": \"New Partner\",
 *        \"category\": \"payments\"
 *      }
 *    Response:
 *      {
 *        \"id\": \"wl_req_1\",
 *        \"status\": \"pending\",
 *        \"submittedAt\": \"2026-03-15T10:23:45.000Z\"
 *      }
 * 
 * 3. POST /whitelist/:id/approve
 *    Purpose: Approve whitelist request (audit: MEDIUM)
 *    Auth: Admin/Elder write
 *    Rate: 10 requests/hour
 *    Request Body:
 *      {
 *        \"comment\": \"Verified and approved\"
 *      }
 *    Response:
 *      {
 *        \"id\": \"wl_1\",
 *        \"status\": \"approved\",
 *        \"approvedAt\": \"2026-03-15T10:24:00.000Z\"
 *      }
 * 
 * 4. GET /limits
 *    Purpose: Get current treasury limits
 *    Auth: Member read
 *    Rate: 30 requests/minute
 *    Response:
 *      {
 *        \"dailyWithdrawalPercentage\": 10,
 *        \"perTransactionPercentage\": 5,
 *        \"multisigThreshold\": \"50000\",
 *        \"requiredApprovals\": 2,
 *        \"totalSigners\": 5,
 *        \"updatedAt\": \"2026-03-01T00:00:00.000Z\"
 *      }
 * 
 * 5. PUT /limits
 *    Purpose: Update treasury limits (audit: MEDIUM)
 *    Auth: Admin/Elder write
 *    Rate: 5 requests/hour
 *    Request Body:
 *      {
 *        \"dailyWithdrawalPercentage\": 15,
 *        \"multisigThreshold\": \"75000\"
 *      }
 *    Response:
 *      {
 *        \"updated\": true,
 *        \"limits\": {...}
 *      }
 * 
 * ═══════════════════════════════════════════════════════════════════════════════════
 * SECTION 4: INTELLIGENCE (AI Analysis)
 * ═══════════════════════════════════════════════════════════════════════════════════
 * Available at: /api/v1/daos/:daoId/treasury/intelligence
 * 
 * 1. POST /analyze
 *    Purpose: Run AI analysis on treasury health
 *    Auth: Member read
 *    Rate: 5 requests/hour
 *    Request Body: {} (empty)
 *    Response:
 *      {
 *        \"healthScore\": 87,
 *        \"riskFactors\": [\"high concentration\"],
 *        \"recommendations\": [
 *          \"Diversify holdings\",
 *          \"Increase multisig approvals\"
 *        ],
 *        \"analyzedAt\": \"2026-03-15T10:23:45.000Z\"
 *      }
 * 
 * 2. POST /formula
 *    Purpose: Test custom treasury formula
 *    Auth: Admin/Elder write
 *    Rate: 5 requests/hour
 *    Request Body:
 *      {
 *        \"formula\": \"balance * 0.1\",
 *        \"testValues\": {\"balance\": \"100000\"}
 *      }
 *    Response:
 *      {
 *        \"result\": \"10000\",
 *        \"valid\": true
 *      }
 * 
 * 3. GET /health
 *    Purpose: Get treasury health score and metrics
 *    Auth: Member read
 *    Rate: 30 requests/minute
 *    Response:
 *      {
 *        \"score\": 87,
 *        \"status\": \"healthy\",
 *        \"metrics\": {
 *          \"liquidityRatio\": 0.75,
 *          \"velocity\": 0.12,
 *          \"concentration\": 0.35
 *        }
 *      }
 * 
 * 4. GET /budget
 *    Purpose: Get spending budget recommendations
 *    Auth: Member read
 *    Rate: 20 requests/minute
 *    Response:
 *      {
 *        \"recommendedMonthlyBudget\": \"100000\",
 *        \"utilizationRate\": 0.45,
 *        \"projectedRunway\": 14
 *      }
 * 
 * 5. POST /optimize/apply
 *    Purpose: Apply AI optimization recommendations
 *    Auth: Admin/Elder write
 *    Rate: 5 requests/day
 *    Request Body:
 *      {
 *        \"optimization\": \"rebalance\",
 *        \"parameters\": {}
 *      }
 *    Response:
 *      {
 *        \"applied\": true,
 *        \"changes\": [...]
 *      }
 * 
 * 6. POST /report
 *    Purpose: Generate full analysis report
 *    Auth: Member read
 *    Rate: 2 requests/hour
 *    Request Body: {} (empty)
 *    Response:
 *      {
 *        \"reportId\": \"report_1\",
 *        \"sections\": [\"health\", \"risks\", \"recommendations\"],
 *        \"generatedAt\": \"2026-03-15T10:23:45.000Z\"
 *      }
 * 
 * 7. POST /impact
 *    Purpose: Model impact of proposed transaction
 *    Auth: Member read
 *    Rate: 20 requests/minute
 *    Request Body:
 *      {
 *        \"transactionAmount\": \"50000\",
 *        \"transactionType\": \"withdrawal\"
 *      }
 *    Response:
 *      {
 *        \"currentScore\": 87,
 *        \"projectedScore\": 82,
 *        \"impact\": -5,
 *        \"recommendation\": \"proceed with caution\"
 *      }
 * 
 * 8. GET /fraud-detection
 *    Purpose: Get fraud detection analysis
 *    Auth: Admin read
 *    Rate: 10 requests/hour
 *    Response:
 *      {
 *        \"riskLevel\": \"low\",
 *        \"anomalies\": [],
 *        \"suspiciousPatterns\": false
 *      }
 * 
 * 9. GET /governance-analysis
 *    Purpose: Analyze governance participation
 *    Auth: Member read
 *    Rate: 10 requests/hour
 *    Response:
 *      {
 *        \"participationRate\": 0.65,
 *        \"consensusStrength\": 0.89,
 *        \"engagementTrend\": \"increasing\"
 *      }
 * 
 * ═══════════════════════════════════════════════════════════════════════════════════
 * SECTION 5: MULTISIG (Approval Workflows)
 * ═══════════════════════════════════════════════════════════════════════════════════
 * Available at: /api/v1/daos/:daoId/treasury/multisig
 * 
 * 1. GET /config
 *    Purpose: Get multisig configuration
 *    Auth: Member read
 *    Rate: 30 requests/minute
 *    Response:
 *      {
 *        \"requiredApprovals\": 2,
 *        \"totalSigners\": 5,
 *        \"withdrawalThreshold\": \"50000\",
 *        \"approvalTimeout\": 604800
 *      }
 * 
 * 2. POST /config
 *    Purpose: Update multisig configuration (audit: CRITICAL)
 *    Auth: Admin/Elder write
 *    Rate: 5 requests/day
 *    Audit Severity: CRITICAL
 *    Request Body:
 *      {
 *        \"requiredApprovals\": 3,
 *        \"withdrawalThreshold\": \"100000\"
 *      }
 *    Response:
 *      {
 *        \"updated\": true,
 *        \"config\": {...}
 *      }
 * 
 * 3. GET /approvals?status=pending
 *    Purpose: Get pending approvals
 *    Auth: Admin/Elder read
 *    Rate: 30 requests/minute
 *    Response:
 *      {
 *        \"approvals\": [
 *          {
 *            \"id\": \"approval_1\",
 *            \"transactionId\": \"tx_1\",
 *            \"amount\": \"50000\",
 *            \"approvalsReceived\": 1,
 *            \"approvalsNeeded\": 2,
 *            \"expiresAt\": \"2026-03-22T10:23:45.000Z\"
 *          }
 *        ]
 *      }
 * 
 * 4. POST /approvals/:id/sign
 *    Purpose: Sign pending approval (audit: CRITICAL)
 *    Auth: Admin/Elder write
 *    Rate: 20 requests/minute
 *    Audit Severity: CRITICAL
 *    Request Body:
 *      {
 *        \"comment\": \"Approved\",
 *        \"signature\": \"0xSIG...\",
 *        \"timestamp\": \"2026-03-15T10:23:45.000Z\"
 *      }
 *    Response:
 *      {
 *        \"signed\": true,
 *        \"approvalsReceived\": 2,
 *        \"approvalsNeeded\": 2,
 *        \"status\": \"ready-for-execution\"
 *      }
 * 
 * 5. GET /signers
 *    Purpose: Get list of multisig signers
 *    Auth: Member read
 *    Rate: 30 requests/minute
 *    Response:
 *      {
 *        \"signers\": [
 *          {
 *            \"id\": \"signer_1\",
 *            \"address\": \"0x123...\",
 *            \"role\": \"admin\",
 *            \"weight\": 1
 *          }
 *        ],
 *        \"totalWeight\": 5
 *      }
 * 
 * 6. DELETE /signers/:id
 *    Purpose: Remove signer from multisig (audit: CRITICAL)
 *    Auth: Admin/Elder write
 *    Rate: 5 requests/day
 *    Audit Severity: CRITICAL
 *    Response:
 *      {
 *        \"removed\": true,
 *        \"signerCount\": 4
 *      }
 * 
 * ═══════════════════════════════════════════════════════════════════════════════════
 * SECTION 6: VAULTS (Isolated Sub-Funds)
 * ═══════════════════════════════════════════════════════════════════════════════════
 * Available at: /api/v1/daos/:daoId/treasury/vaults
 * 
 * 1. GET /
 *    Purpose: List all vaults
 *    Auth: Member read
 *    Rate: 30 requests/minute
 *    Response:
 *      {
 *        \"vaults\": [
 *          {
 *            \"id\": \"vault_1\",
 *            \"name\": \"Operations Fund\",
 *            \"totalAllocated\": \"250000\",
 *            \"riskProfile\": \"low\",
 *            \"createdAt\": \"2026-01-01T00:00:00.000Z\"
 *          }
 *        ]
 *      }
 * 
 * 2. POST /
 *    Purpose: Create new vault (audit: MEDIUM)
 *    Auth: Admin/Elder write
 *    Rate: 5 requests/hour
 *    Request Body:
 *      {
 *        \"name\": \"Grants Fund\",
 *        \"description\": \"For community grants\",
 *        \"riskProfile\": \"medium\"
 *      }
 *    Response:
 *      {
 *        \"id\": \"vault_new\",
 *        \"name\": \"Grants Fund\",
 *        \"createdAt\": \"2026-03-15T10:23:45.000Z\"
 *      }
 * 
 * 3. GET /:id
 *    Purpose: Get vault details
 *    Auth: Member read
 *    Rate: 50 requests/minute
 *    Response:
 *      {
 *        \"id\": \"vault_1\",
 *        \"name\": \"Operations Fund\",
 *        \"totalAllocated\": \"250000\",
 *        \"allocation\": {
 *          \"cUSD\": \"250000\",
 *          \"cEUR\": \"0\"
 *        },
 *        \"transactions\": [...]
 *      }
 * 
 * 4. PUT /:id
 *    Purpose: Update vault settings (audit: MEDIUM)
 *    Auth: Admin/Elder write
 *    Rate: 10 requests/hour
 *    Request Body:
 *      {
 *        \"name\": \"Operations Fund Q2\",
 *        \"riskProfile\": \"high\"
 *      }
 *    Response:
 *      {
 *        \"updated\": true,
 *        \"vault\": {...}
 *      }
 * 
 * 5. POST /:id/allocate
 *    Purpose: Allocate funds to vault (audit: CRITICAL)
 *    Auth: Admin/Elder write
 *    Rate: 5 requests/hour
 *    Audit Severity: CRITICAL
 *    Request Body:
 *      {
 *        \"amount\": \"50000\",
 *        \"currency\": \"cUSD\"
 *      }
 *    Response:
 *      {
 *        \"vaultId\": \"vault_1\",
 *        \"allocated\": \"50000\",
 *        \"newTotal\": \"300000\"
 *      }
 * 
 * 6. GET /:id/positions
 *    Purpose: Get vault asset positions
 *    Auth: Member read
 *    Rate: 30 requests/minute
 *    Response:
 *      {
 *        \"positions\": [
 *          {
 *            \"asset\": \"cUSD\",
 *            \"amount\": \"250000\",
 *            \"percentage\": 100
 *          }
 *        ]
 *      }
 * 
 * 7. GET /:id/nav
 *    Purpose: Get vault net asset value
 *    Auth: Member read
 *    Rate: 30 requests/minute
 *    Response:
 *      {
 *        \"nav\": \"250000\",
 *        \"fundValue\": \"250000\",
 *        \"performanceMetrics\": {...}
 *      }
 * 
 * 8. POST /:id/rebalance
 *    Purpose: Rebalance vault allocation (audit: MEDIUM)
 *    Auth: Admin/Elder write
 *    Rate: 5 requests/day
 *    Request Body:
 *      {
 *        \"targetAllocation\": {
 *          \"cUSD\": 70,
 *          \"cEUR\": 30
 *        }
 *      }
 *    Response:
 *      {
 *        \"rebalanced\": true,
 *        \"newAllocation\": {...}
 *      }
 * 
 * ═══════════════════════════════════════════════════════════════════════════════════
 * SECTION 7: SYSTEM HEALTH
 * ═══════════════════════════════════════════════════════════════════════════════════
 * Available at: /api/v1/treasury/system
 * (No DAO ID required - system-level endpoint)
 * 
 * 1. GET /health
 *    Purpose: Get system health status
 *    Auth: Admin read
 *    Rate: 30 requests/minute
 *    Response:
 *      {
 *        \"status\": \"healthy\",
 *        \"daosManaged\": 42,
 *        \"totalValue\": \"10000000.00\",
 *        \"avgHealthScore\": 84,
 *        \"incidents\": 0,
 *        \"lastCheck\": \"2026-03-15T10:23:45.000Z\"
 *      }
 * 
 * ═══════════════════════════════════════════════════════════════════════════════════
 * TOTAL ENDPOINTS
 * ═══════════════════════════════════════════════════════════════════════════════════
 * 
 * Core Operations:     10 endpoints
 * Contributions:        7 endpoints
 * Management:           5 endpoints
 * Intelligence:         9 endpoints
 * Multisig:             6 endpoints
 * Vaults:               8 endpoints
 * System:               1 endpoint
 * ─────────────────────────────────────
 * TOTAL:              45 endpoints
 * 
 * Configuration:        1 file (treasury.ts)
 * Services:            1 file (treasuryService.ts)
 * Routers:             8 files (core, contributions, management, intelligence, multisig, vaults, index, treasury.ts)
 * Security:            1 file (security.ts)
 * ─────────────────────────────────────
 * TOTAL CODE:         ~3,000 lines
 * AUDIT SEVERITY:     CRITICAL (for 15+ fund movement endpoints)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════════
 */

export const apiReference = {
  documentVersion: '1.0',
  totalEndpoints: 45,
  createdDate: '2026-03-15',
};
