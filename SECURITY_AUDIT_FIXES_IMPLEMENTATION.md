# MtaaDAO Security Fixes - Implementation Guide

## Quick Reference: Critical Fixes by File

---

## 1. FIX CORS MISCONFIGURATION

**File:** [server/index.ts](server/index.ts#L226-L230)  
**Priority:** IMMEDIATE (1 hour)  
**Impact:** Prevents CSRF attacks, XSS credential theft

### Current (VULNERABLE):
```typescript
app.use(cors({
  origin: true,            // Allow ALL origins
  credentials: true        // Allow credentials
}));
```

### Fixed:
```typescript
// 1. Create whitelist from environment
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  process.env.APP_URL || 'http://localhost:3000',
  'https://mtaadao.com',
  'https://app.mtaadao.com'
];

// 2. Validate origin before allowing
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600,
  optionsSuccessStatus: 200
}));
```

### Test:
```bash
# Should fail
curl -H "Origin: https://evil.com" http://localhost:5000/api/daos

# Should succeed
curl -H "Origin: http://localhost:5173" http://localhost:5000/api/daos
```

---

## 2. FIX JWT SECRET HARDCODING

**File:** [server/auth.ts](server/auth.ts#L1-L10)  
**Priority:** IMMEDIATE (1-2 hours)  
**Impact:** Prevents token forgery attacks

### Current (VULNERABLE):
```typescript
const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_SECRET_KEY || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production';
```

### Fixed:
```typescript
// Fail hard in production - no defaults
export const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret || secret.length === 0) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is not set. ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters (256 bits)');
  }
  
  if (!secret.match(/^[a-f0-9]{64}$/)) {
    console.warn('WARNING: JWT_SECRET should be 64 hex characters. Validate it\'s secure.');
  }
  
  return secret;
})();

export const JWT_REFRESH_SECRET = (() => {
  const secret = process.env.JWT_REFRESH_SECRET;
  
  if (!secret || secret.length === 0) {
    throw new Error('FATAL: JWT_REFRESH_SECRET environment variable is not set.');
  }
  
  if (secret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters');
  }
  
  return secret;
})();

// Remove logging of secrets
// DELETE this line:
// console.log('[JWT] Generated tokens with secret:', JWT_SECRET.substring(0, 10) + '***', ...);
```

### Generate Secrets:
```bash
# Generate new JWT_SECRET
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate new JWT_REFRESH_SECRET
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

### Update .env:
```bash
JWT_SECRET=c1a3f5b2d7e9g6h4j2k1l3m5n7o9p1q3r5s7t9u1v3w5x7y9z2a4b6c8d0e2f4
JWT_REFRESH_SECRET=a2b4c6d8e0f2g4h6i8j0k2l4m6n8o0p2q4r6s8t0u2v4w6x8y0z2a4b6c8d0e2
```

---

## 3. ADD ACCESS CONTROL TO PROPOSAL EXECUTION

**File:** [server/routes/proposal-execution.ts](server/routes/proposal-execution.ts#L35-L80)  
**Priority:** CRITICAL (1 day)  
**Impact:** Prevents unauthorized proposal execution

### Current (VULNERABLE):
```typescript
router.post('/:daoId/execute/:proposalId', [isAuthenticated, rateLimitMiddleware(...)], async (req, res) => {
  const { daoId, proposalId } = req.params;
  const userId = (req.user as any).claims.sub;
  
  // ⚠️ MISSING PERMISSION CHECK
  // ⚠️ Add permission check here (but it's not there!)
  
  const execution = await db.select()
    .from(proposalExecutionQueue)
    .where(and(...))
    .limit(1);
  
  if (!execution.length) {
    return res.status(404).json({ success: false, message: 'No pending execution found' });
  }
  
  await ProposalExecutionService.executeProposal(execution[0]);
  
  res.json({ success: true, message: 'Proposal executed successfully' });
});
```

### Fixed:
```typescript
// Helper function
async function validateExecutionPermission(userId: string, daoId: string) {
  // Check user is DAO member
  const membership = await db.select()
    .from(daoMemberships)
    .where(and(
      eq(daoMemberships.userId, userId),
      eq(daoMemberships.daoId, daoId)
    ))
    .limit(1);
  
  if (!membership || membership.length === 0) {
    throw new Error('Not a DAO member');
  }
  
  // Check user has admin or elder role
  const role = membership[0].role;
  const AUTHORIZED_ROLES = ['admin', 'elder', 'superuser'];
  
  if (!AUTHORIZED_ROLES.includes(role || '')) {
    throw new Error(`Insufficient permissions. Required: [${AUTHORIZED_ROLES.join(', ')}]. Have: ${role}`);
  }
  
  return membership[0];
}

// Updated route
router.post('/:daoId/execute/:proposalId', [isAuthenticated, rateLimitMiddleware(proposalExecutionLimits)], async (req, res) => {
  try {
    const { daoId, proposalId } = req.params;
    const userId = (req.user as any).claims.sub;
    
    // ✅ VALIDATE PERMISSION BEFORE EXECUTION
    try {
      const membership = await validateExecutionPermission(userId, daoId);
      logger.info(`User ${userId} executing proposal`, { proposalId, daoId, role: membership.role });
    } catch (permError) {
      logger.warn(`Unauthorized execution attempt`, { userId, daoId, proposalId, error: (permError as Error).message });
      return res.status(403).json({
        success: false,
        message: (permError as Error).message
      });
    }
    
    // ✅ GET PROPOSAL (verify it exists and belongs to this DAO)
    const proposal = await db.select()
      .from(proposals)
      .where(and(
        eq(proposals.id, proposalId),
        eq(proposals.daoId, daoId)
      ))
      .limit(1);
    
    if (!proposal || proposal.length === 0) {
      return res.status(404).json({ success: false, message: 'Proposal not found in this DAO' });
    }
    
    // ✅ GET EXECUTION FROM QUEUE
    const execution = await db.select()
      .from(proposalExecutionQueue)
      .where(and(
        eq(proposalExecutionQueue.proposalId, proposalId),
        eq(proposalExecutionQueue.daoId, daoId),
        eq(proposalExecutionQueue.status, 'pending')
      ))
      .limit(1);
    
    if (!execution || execution.length === 0) {
      return res.status(404).json({ success: false, message: 'No pending execution found for this proposal' });
    }
    
    // ✅ EXECUTE WITH AUDIT LOG
    await ProposalExecutionService.executeProposal(execution[0], userId); // Pass executor
    
    // Audit log
    await auditLoggingService.logAction({
      actorId: userId,
      actionType: 'proposal_executed',
      targetId: proposalId,
      targetType: 'proposal',
      result: 'success',
      metadata: {
        daoId,
        executionType: execution[0].executionType
      }
    });
    
    res.json({
      success: true,
      message: 'Proposal executed successfully',
      proposalId,
      executedAt: new Date()
    });
  } catch (error: any) {
    logger.error('Proposal execution failed', { error: error.message, daoId, proposalId });
    res.status(500).json({
      success: false,
      message: 'Failed to execute proposal',
      error: error.message
    });
  }
});
```

---

## 4. ADD WALLET SIGNATURE VERIFICATION

**File:** [server/routes/wallets.ts](server/routes/wallets.ts#L250-L280)  
**Priority:** CRITICAL (1 day)  
**Impact:** Prevents wallet hijacking

### Current (VULNERABLE):
```typescript
router.post("/:id/send", walletValidation.queueTransaction, async (req, res) => {
  try {
    const queueId = await queueTransaction(
      req.params.id,           // Wallet ID
      req.body.toAddress,      // Any address
      req.body.amount.toString(),
      req.body.tokenSymbol,
      req.body.description     // Attacker-controlled
    );
    // No signature check!
```

### Fixed:
```typescript
import { verifyMessage, recoverAddress } from 'ethers';

// Helper to create signable message
function createTransactionMessage(
  walletAddress: string,
  toAddress: string,
  amount: string,
  nonce: number,
  chainId: number
): string {
  return `
MtaaDAO Wallet Transaction
========================
From: ${walletAddress}
To: ${toAddress}
Amount: ${amount}
Chain ID: ${chainId}
Nonce: ${nonce}
Timestamp: ${Math.floor(Date.now() / 1000)}

Please sign this message to authorize the transaction.
`;
}

router.post("/:id/send", walletValidation.queueTransaction, async (req, res) => {
  try {
    const walletAddress = req.params.id;
    const { toAddress, amount, tokenSymbol, description, message, signature, nonce } = req.body;
    
    // ✅ 1. Validate inputs
    if (!toAddress || !amount || !signature || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: toAddress, amount, signature, message'
      });
    }
    
    // ✅ 2. Verify the signature matches the message and wallet
    try {
      const signerAddress = verifyMessage(message, signature);
      
      if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(401).json({
          success: false,
          error: 'Invalid signature - not signed by wallet owner'
        });
      }
    } catch (sigError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid signature format',
        details: (sigError as Error).message
      });
    }
    
    // ✅ 3. Verify message contains expected transaction details
    if (!message.includes(toAddress) || !message.includes(amount)) {
      return res.status(400).json({
        success: false,
        error: 'Signature message does not contain transaction details'
      });
    }
    
    // ✅ 4. Verify nonce hasn't been used (replay protection)
    const previousNonce = await redis.get(`wallet_nonce:${walletAddress}:${nonce}`);
    if (previousNonce) {
      return res.status(400).json({
        success: false,
        error: 'Nonce already used (replay attack detected)'
      });
    }
    
    // ✅ 5. Queue transaction with signature
    const queueId = await queueTransaction(
      walletAddress,
      toAddress,
      amount.toString(),
      tokenSymbol,
      description || 'Wallet transfer',
      {
        signature,
        message,
        nonce,
        signedAt: new Date()
      }
    );
    
    // Mark nonce as used (can be replayed but signature still required)
    await redis.setex(`wallet_nonce:${walletAddress}:${nonce}`, 3600, 'used');
    
    // Audit log
    await auditLoggingService.logAction({
      actorId: walletAddress,
      actionType: 'wallet_transaction_queued',
      targetId: walletAddress,
      metadata: {
        recipient: toAddress,
        amount,
        token: tokenSymbol,
        queueId
      }
    });
    
    res.status(201).json({
      success: true,
      data: { queueId, status: 'pending' },
      message: 'Transaction queued (pending confirmation)'
    });
  } catch (error) {
    logger.error('Error queueing transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to queue transaction'
    });
  }
});
```

### Frontend: How to Sign and Send Transaction
```typescript
// Frontend code to sign and send
import { ethers } from 'ethers';

async function initiateWalletTransfer(wallet: ethers.BrowserProvider) {
  const signer = await wallet.getSigner();
  const signerAddress = await signer.getAddress();
  
  const toAddress = '0x...';
  const amount = '100000000000000000000'; // 100 tokens with 18 decimals
  const nonce = Math.floor(Math.random() * 1000000);
  
  // Create message to sign
  const message = `
MtaaDAO Wallet Transaction
========================
From: ${signerAddress}
To: ${toAddress}
Amount: ${amount}
Chain ID: ${await signer.provider?.getNetwork().then(n => n.chainId) || '44787'}
Nonce: ${nonce}
Timestamp: ${Math.floor(Date.now() / 1000)}

Please sign this message to authorize the transaction.
`;
  
  // Sign the message
  const signature = await signer.signMessage(message);
  
  // Send to backend
  const response = await fetch('/api/wallets/' + signerAddress + '/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toAddress,
      amount,
      tokenSymbol: 'USDC',
      description: 'Transfer to account',
      message,    // Full message
      signature,  // Signature from signer
      nonce       // Prevent replay
    })
  });
  
  return response.json();
}
```

---

## 5. FIX PROPOSAL EXECUTION SERVICE TO USE REAL EXECUTOR

**File:** [server/proposalExecutionService.ts](server/proposalExecutionService.ts#L30-L80)  
**Priority:** CRITICAL (1 day)  
**Impact:** Proper audit trail for all executions

### Current (VULNERABLE):
```typescript
static async executeProposal(execution: any) {
  // ...
  switch (executionType) {
    case 'vault_operation':
      await this.executeVaultOperation(executionData, daoId, proposalId);
      break;
    // ...
  }
}

static async executeVaultOperation(executionData: any, daoId: string, proposalId: string) {
  // ...
  case 'withdraw':
    await vaultService.withdrawToken({
      vaultId,
      userId: 'system',  // ⚠️ Magic string!
      ...operationData
    });
```

### Fixed:
```typescript
static async executeProposal(execution: any, executorUserId: string) {
  try {
    logger.info(`Executing proposal ${execution.proposalId}`, { 
      executedBy: executorUserId,
      daoId: execution.daoId 
    });
    
    // Update status to executing
    await db.update(proposalExecutionQueue)
      .set({ 
        status: 'executing',
        lastAttempt: new Date(),
        attempts: execution.attempts + 1,
        executedBy: executorUserId  // ✅ STORE EXECUTOR
      })
      .where(eq(proposalExecutionQueue.id, execution.id));
    
    const { executionType, executionData, daoId, proposalId } = execution;
    
    switch (executionType) {
      case 'treasury_transfer':
        await this.executeTreasuryTransfer(executionData, daoId, proposalId, executorUserId);
        break;
      case 'vault_operation':
        await this.executeVaultOperation(executionData, daoId, proposalId, executorUserId);
        break;
      case 'member_action':
        await this.executeMemberAction(executionData, daoId, proposalId, executorUserId);
        break;
      case 'governance_change':
        await this.executeGovernanceChange(executionData, daoId, proposalId, executorUserId);
        break;
      case 'disbursement':
        await this.executeDisbursement(executionData, daoId, proposalId, executorUserId);
        break;
      default:
        throw new Error(`Unknown execution type: ${executionType}`);
    }
    
    // Mark as completed
    await db.update(proposalExecutionQueue)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(proposalExecutionQueue.id, execution.id));
    
    // Update proposal status
    await db.update(proposals)
      .set({ 
        status: 'executed',
        executedAt: new Date(),
        executedBy: executorUserId  // ✅ STORE EXECUTOR
      })
      .where(eq(proposals.id, proposalId));
    
    logger.info(`Successfully executed proposal ${proposalId}`);
    
  } catch (error: any) {
    logger.error('Error executing proposal:', error);
    
    const maxAttempts = 3;
    const shouldRetry = execution.attempts < maxAttempts && this.isRetriableError(error);
    
    await db.update(proposalExecutionQueue)
      .set({ 
        status: shouldRetry ? 'pending' : 'failed',
        errorMessage: error.message,
        scheduledFor: shouldRetry ? new Date(Date.now() + 60 * 60 * 1000) : undefined
      })
      .where(eq(proposalExecutionQueue.id, execution.id));
  }
}

// Updated vault operation method
static async executeVaultOperation(
  executionData: any, 
  daoId: string, 
  proposalId: string,
  executorUserId: string  // ✅ ADD THIS
) {
  const { vaultId, operation, operationData } = executionData;
  
  logger.info(`Executing vault operation: ${operation}`, {
    executor: executorUserId,
    proposalId,
    vaultId
  });
  
  switch (operation) {
    case 'withdraw':
      await vaultService.withdrawToken({
        vaultId,
        userId: executorUserId,  // ✅ USE ACTUAL EXECUTOR
        authorizedBy: 'proposal',
        proposalId,
        daoId,
        ...operationData
      });
      break;
    
    case 'deposit':
      await vaultService.depositToken({
        vaultId,
        userId: executorUserId,  // ✅ USE ACTUAL EXECUTOR
        authorizedBy: 'proposal',
        proposalId,
        ...operationData
      });
      break;
    
    // ... other operations
  }
}
```

---

## 6. ADD AMOUNT LIMITS AND RECIPIENT WHITELIST FOR TREASURY

**File:** [server/proposalExecutionService.ts](server/proposalExecutionService.ts#L113-L140)  
**Priority:** CRITICAL (2 days)  
**Impact:** Prevents treasury drainage

### Fixed:
```typescript
// Add whitelisting and limits
interface TreasuryTransferConfig {
  maxSingleTransferPercent: number;  // % of total treasury
  maxDailyTransferPercent: number;   // % of total treasury per day
  whitelistedRecipients: Set<string>;
  multiSigRequiredAboveAmount: number;
  timelock: number; // milliseconds
}

// Get config from DAO settings
async function getTreasuryTransferConfig(daoId: string): Promise<TreasuryTransferConfig> {
  const dao = await db.select()
    .from(daos)
    .where(eq(daos.id, daoId))
    .limit(1);
  
  const daoData = dao[0];
  
  return {
    maxSingleTransferPercent: daoData.treasuryMaxSingleTransferPercent || 5, // Default 5%
    maxDailyTransferPercent: daoData.treasuryMaxDailyTransferPercent || 20,  // Default 20%
    whitelistedRecipients: new Set(daoData.treasuryWhitelist || []),
    multiSigRequiredAboveAmount: daoData.treasuryMultiSigThreshold || parseFloat(daoData.treasuryBalance || '0') * 0.1, // Default 10%
    timelock: daoData.executionDelay || 48 * 60 * 60 * 1000
  };
}

static async executeTreasuryTransfer(
  executionData: any, 
  daoId: string, 
  proposalId: string,
  executorUserId: string
) {
  const { recipient, amount, currency, description, fromVault } = executionData;
  
  // ✅ 1. VALIDATE RECIPIENT
  const config = await getTreasuryTransferConfig(daoId);
  
  if (!config.whitelistedRecipients.has(recipient)) {
    throw new Error(`Recipient ${recipient} not whitelisted for treasury transfers`);
  }
  
  // ✅ 2. GET DAO TREASURY BALANCE
  const daoRecord = await db.select()
    .from(daos)
    .where(eq(daos.id, daoId))
    .limit(1);
  
  const currentBalance = parseFloat(daoRecord[0]?.treasuryBalance || '0');
  
  // ✅ 3. CHECK AMOUNT LIMITS
  const transferAmount = parseFloat(amount);
  const maxSingleTransfer = (currentBalance * config.maxSingleTransferPercent) / 100;
  
  if (transferAmount > maxSingleTransfer) {
    throw new Error(
      `Transfer amount ${transferAmount} exceeds maximum ` +
      `${config.maxSingleTransferPercent}% of treasury (${maxSingleTransfer})`
    );
  }
  
  // ✅ 4. CHECK DAILY LIMIT
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dailyTransfers = await db
    .select({ 
      total: sql<string>`SUM(CAST(amount as FLOAT))`.as('total')
    })
    .from(walletTransactions)
    .where(
      and(
        eq(walletTransactions.daoId, daoId),
        eq(walletTransactions.type, 'transfer'),
        gte(walletTransactions.createdAt, twentyFourHoursAgo)
      )
    );
  
  const dailyTotal = parseFloat(dailyTransfers[0]?.total || '0');
  const maxDailyTransfer = (currentBalance * config.maxDailyTransferPercent) / 100;
  
  if (dailyTotal + transferAmount > maxDailyTransfer) {
    throw new Error(
      `Daily transfer limit exceeded. ` +
      `Already transferred: ${dailyTotal}, ` +
      `Daily limit: ${maxDailyTransfer}, ` +
      `Requested: ${transferAmount}`
    );
  }
  
  // ✅ 5. CHECK MULTISIG REQUIREMENT
  if (transferAmount > config.multiSigRequiredAboveAmount) {
    // Verify proposal has multisig approvals
    const proposal = await db.select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);
    
    const requiredApprovals = proposal[0]?.requiredApprovals || 2;
    const actualApprovals = proposal[0]?.approvals || 0;
    
    if (actualApprovals < requiredApprovals) {
      throw new Error(
        `Large transfer requires ${requiredApprovals} approvals. ` +
        `Currently has ${actualApprovals}`
      );
    }
  }
  
  // ✅ 6. PERFORM TRANSFER
  if (currentBalance < transferAmount) {
    throw new Error(`Insufficient treasury balance`);
  }
  
  const newBalance = (currentBalance - transferAmount).toString();
  await db.update(daos)
    .set({ treasuryBalance: newBalance })
    .where(eq(daos.id, daoId));
  
  // Record transaction
  await db.insert(walletTransactions).values({
    walletAddress: recipient,
    amount: amount.toString(),
    currency,
    type: 'transfer',
    status: 'completed',
    description: `${description} [Proposal: ${proposalId}]`,
    daoId: daoId,
    authorizedBy: executorUserId,
    createdAt: new Date()
  });
  
  logger.info(`Treasury transfer completed`, {
    daoId,
    amount: transferAmount,
    recipient,
    executor: executorUserId
  });
}
```

### Schema Update (Add to schema):
```typescript
// In shared/schema.ts
export const daos = pgTable('daos', {
  // ... existing fields ...
  
  // ✅ NEW FIELDS FOR TREASURY SAFETY
  treasuryMaxSingleTransferPercent: integer('treasury_max_single_transfer_percent').default(5),
  treasuryMaxDailyTransferPercent: integer('treasury_max_daily_transfer_percent').default(20),
  treasuryWhitelist: text('treasury_whitelist').array().default([]),
  treasuryMultiSigThreshold: numeric('treasury_multisig_threshold'),
});

export const proposalExecutionQueue = pgTable('proposal_execution_queue', {
  // ... existing fields ...
  
  // ✅ NEW FIELDS FOR TRACKING
  executedBy: text('executed_by'),
  completedAt: timestamp('completed_at'),
});
```

---

## 7. ADD RATE LIMITING TO DEPOSITS

**File:** [server/routes/payment-gateway.ts](server/routes/payment-gateway.ts#L15-L40)  
**Priority:** HIGH (1 day)

### Current (VULNERABLE):
```typescript
router.post('/deposit', isAuthenticated, async (req, res) => {
  // No rate limiting
```

### Fixed:
```typescript
// Add at top of file
import { rateLimitMiddleware, createRateLimitConfig } from '../middleware/rateLimitConfig';

const depositLimits = createRateLimitConfig({
  windowMs: 60 * 1000,        // 1 minute
  max: 10,                     // Max 10 deposits per minute
  message: 'Too many deposits requested. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      retryAfter: req.rateLimit?.resetTime
    });
  }
});

// Apply to deposit route
router.post('/deposit', [isAuthenticated, rateLimitMiddleware(depositLimits)], async (req, res) => {
  // ... existing code ...
});
```

---

## 8. ADD MULTISIG FOR SMART CONTRACT VAULT WITHDRAWALS

**File:** [server/contracts/MaonoVault.sol](server/contracts/MaonoVault.sol#L300-L350)  
**Priority:** CRITICAL (3 days, requires audit)

### Current (VULNERABLE):
```solidity
function fulfillWithdrawal(uint256 requestId) external nonReentrant whenNotPaused onlyManager {
  // Only manager can fulfill - single point of failure
```

### Fixed:
```solidity
// Add multisig approval tracking
mapping(uint256 => address[]) public withdrawalApprovers;
mapping(uint256 => mapping(address => bool)) public hasApprovedWithdrawal;

uint256 public requiredApprovalsForWithdrawal = 2;
address[] public authorizedApprovers;  // List of signers

event WithdrawalApprovalAdded(uint256 requestId, address approver);
event WithdrawalApprovalWithdrawn(uint256 requestId, address approver);

modifier onlyApprover() {
  require(isAuthorizedApprover(msg.sender), 'Not an authorized approver');
  _;
}

function isAuthorizedApprover(address addr) public view returns (bool) {
  for (uint i = 0; i < authorizedApprovers.length; i++) {
    if (authorizedApprovers[i] == addr) return true;
  }
  return false;
}

// ✅ NEW: Add approval for withdrawal
function approveWithdrawal(uint256 requestId) external onlyApprover {
  require(!withdrawalRequests[requestId].fulfilled, 'Already fulfilled');
  require(!hasApprovedWithdrawal[requestId][msg.sender], 'Already approved');
  
  hasApprovedWithdrawal[requestId][msg.sender] = true;
  withdrawalApprovers[requestId].push(msg.sender);
  
  emit WithdrawalApprovalAdded(requestId, msg.sender);
}

// ✅ MODIFIED: Require approvals
function fulfillWithdrawal(uint256 requestId) 
  external 
  nonReentrant 
  whenNotPaused 
  onlyManager 
{
  WithdrawalRequest storage request = withdrawalRequests[requestId];
  
  // ✅ Check approvals
  require(
    withdrawalApprovers[requestId].length >= requiredApprovalsForWithdrawal,
    'Insufficient approvals for withdrawal'
  );
  
  if (request.fulfilled) revert WithdrawalAlreadyFulfilled();
  if (block.timestamp < request.requestTime + withdrawalDelay) {
    revert WithdrawalNotReady(request.requestTime, block.timestamp);
  }
  
  request.fulfilled = true;
  uint256 assets = previewRedeem(request.shares);
  
  uint256 vaultBalance = IERC20(asset()).balanceOf(address(this));
  if (vaultBalance < assets) {
    revert InsufficientBalance(assets, vaultBalance);
  }
  
  _burn(request.user, request.shares);
  IERC20(asset()).safeTransfer(request.user, assets);
  
  emit WithdrawalFulfilled(requestId, request.user, request.shares, assets);
}

// ✅ NEW: Set required approvals
function setRequiredApprovalsForWithdrawal(uint256 numApprovals) 
  external 
  onlyOwner 
{
  require(numApprovals >= 2, 'Minimum 2 approvals required');
  require(numApprovals <= authorizedApprovers.length, 'More approvals than approvers');
  requiredApprovalsForWithdrawal = numApprovals;
}

// ✅ NEW: Add approver
function addApprover(address newApprover) external onlyOwner {
  require(newApprover != address(0), 'Invalid address');
  require(!isAuthorizedApprover(newApprover), 'Already an approver');
  authorizedApprovers.push(newApprover);
}
```

---

## QUICK DEPLOYMENT CHECKLIST

- [ ] CORS fix deployed
- [ ] JWT secrets rotated and stored securely
- [ ] Access control added to proposal execution
- [ ] Signature verification added to wallet transfers
- [ ] Amount limits and whitelist enforcement added to treasury
- [ ] Rate limiting applied to deposits
- [ ] Test all critical flows with secure configs
- [ ] Deploy to staging, run security tests
- [ ] Get code review from security engineer
- [ ] Deploy to production with monitoring
- [ ] Update incident response playbook

---

**Total Estimated Implementation Time:** 2-3 weeks (critical fixes only)  
**Additional Testing/Audit Time:** 2-4 weeks  
**Total Time to Production:** 4-7 weeks minimum

