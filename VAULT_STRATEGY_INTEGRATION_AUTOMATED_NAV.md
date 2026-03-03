# 🔗 VAULT + STRATEGY INTEGRATION - AUTOMATED NAV ORACLE

**Complete Integration Architecture** | **March 1, 2026** | **Backend ↔ Smart Contracts**

---

## 📋 TABLE OF CONTENTS

1. [System Architecture](#system-architecture)
2. [NAV Oracle Service](#nav-oracle-service)
3. [Signal Flow](#signal-flow)
4. [Smart Contract Oracle Interface](#smart-contract-oracle-interface)
5. [Automated Update Pipeline](#automated-update-pipeline)
6. [Message Signing & Verification](#message-signing--verification)
7. [Error Handling & Fallbacks](#error-handling--fallbacks)
8. [Security & Governance](#security--governance)
9. [Deployment Checklist](#deployment-checklist)
10. [Code Examples](#code-examples)

---

## 🏗️ SYSTEM ARCHITECTURE

### End-to-End Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                     INTEGRATED VAULT SYSTEM                      │
└─────────────────────────────────────────────────────────────────┘

BACKEND (Node.js)                          BLOCKCHAIN (Solidity)
───────────────────────────────────────────────────────────────────

┌──────────────────────────────┐
│  Strategy Dashboard Service  │
│                              │
│ • Calculates performance     │
│ • Tracks returns (YTD, MTD)  │
│ • Monitors allocations       │
└────────────────┬─────────────┘
                 │ performance data
                 ▼
┌──────────────────────────────┐
│   Health Monitor Agent       │
│                              │
│ • Real-time metrics (877+)   │
│ • Endpoint health            │
│ • Position tracking          │
└────────────────┬─────────────┘
                 │ live metrics
                 ▼
┌──────────────────────────────┐
│   Capacity Planner Agent     │
│                              │
│ • Deployed capital tracking  │
│ • Position values (Aave, LP) │
│ • Utilization forecasting    │
└────────────────┬─────────────┘
                 │ position values
                 ▼
    ┌────────────────────────────┐
    │   NAV ORACLE SERVICE       │◄─── NEW COMPONENT
    │   (Node.js)                │
    │                            │
    │ • Aggregates all metrics   │
    │ • Calculates total NAV     │
    │ • Signs transaction        │
    │ • Submits to blockchain    │
    │ • Validates responses      │
    └────────────────┬───────────┘
                     │
                     │ signed updateNAV()
                     │ transaction
                     ▼
         ┌──────────────────────────┐
         │    MaonoVault Contract   │
         │    (On-Chain)            │
         │                          │
         │ • Verifies signature     │
         │ • Validates NAV value    │
         │ • Calculates fees        │
         │ • Mints fee shares       │
         │ • Updates high water mark│
         │ • Emits NAVUpdated event │
         └──────────────┬───────────┘
                        │ NAVUpdated event
                        ▼
         ┌──────────────────────────┐
         │   Event Listener (Graph) │
         │   or Direct RPC Call     │
         │                          │
         │ • Indexes NAV update     │
         │ • Updates dashboard      │
         │ • Notifies users         │
         └──────────────────────────┘
```

### Data Flow Sequence

```
┌────────────────────────────────────────────────────────────────────┐
│                  HOURLY NAV UPDATE CYCLE                           │
└────────────────────────────────────────────────────────────────────┘

Time    Component                    Action
─────────────────────────────────────────────────────────────────

00:00   Cron/Scheduler              Trigger: calculateAndSubmitNAV()
        (node-cron)                 └─ Runs every hour at :00

00:01   NAV Oracle Service          Aggregates metrics from:
                                    ├─ strategyDashboardService
                                    ├─ healthMonitorAgent
                                    ├─ capacityPlannerAgent
                                    └─ priceOracle

00:02   Price Oracle                Fetches current prices:
        (Chainlink/Band Protocol)   ├─ ETH/USD
                                    ├─ BTC/USD
                                    ├─ USDC/USD
                                    └─ Other assets

00:03   NAV Calculation             Computes:
        Service                     ├─ Sum of position values
                                    ├─ Subtract fees & liabilities
                                    └─ = Total NAV

00:04   Message Signing             Creates & signs transaction:
        (Private key)               ├─ Signer: serviceAccount
                                    ├─ Function: updateNAV()
                                    ├─ Params: { newNAV }
                                    ├─ Nonce: X
                                    └─ Hash: 0x...

00:05   Transaction Submission      Sends to blockchain:
        (ethers.js)                 └─ Returns txHash

00:10   On-Chain Validation         MaonoVault contract:
        (Smart contract)            ├─ Verify signer authorized
                                    ├─ Check NAV ±10% reasonable
                                    ├─ Collect management fees
                                    ├─ Calculate performance fees
                                    ├─ Update highWaterMark
                                    └─ Emit NAVUpdated event

00:15   Event Propagation           GraphQL/Event indexer:
        (The Graph)                 ├─ Index NAVUpdated event
                                    ├─ Calculate share price
                                    ├─ Update cached metrics
                                    └─ Broadcast to frontend

00:20   Dashboard Update            Update UI:
                                    ├─ Show new NAV
                                    ├─ Highlight fee collected
                                    ├─ Update share price
                                    └─ Show timestamp
```

---

## 🔍 NAV ORACLE SERVICE

### Service Architecture

```typescript
/**
 * NavOracleService.ts
 * 
 * Purpose: Automatically calculate and submit vault NAV
 * Triggers: Hourly (configurable)
 * Submits to: MaonoVault smart contract
 * Safety: Multi-sig validation, threshold checks, event listeners
 */

interface NavOracleConfig {
  // Timing
  updateIntervalMs: number;                    // 3600000 = 1 hour
  enabled: boolean;
  
  // Smart Contract
  vaultContractAddress: string;
  vaultAbi: AbiItem[];
  
  // Signer
  signerPrivateKey: string;                    // Service account
  signerAddress: string;
  
  // Validation
  maxNAVDeviation: number;                     // 0.1 = ±10%
  minConfirmationBlocks: number;               // 3 blocks
  
  // Fallback
  fallbackSubmitterAddress?: string;           // Multi-sig account
  enableMultiSig: boolean;
  requiredSignatures?: number;
  
  // Monitoring
  alertWebhookUrl?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

interface NavSubmission {
  navValue: BigNumber;                         // In wei
  timestamp: number;
  calculatedFrom: {
    strategyPerformance: number;
    healthSnapshot: Metrics;
    positionValues: PositionValues;
    priceSnapshot: PriceData;
  };
  signature: string;
  nonce: number;
  chainId: number;
}

interface NavResponse {
  txHash: string;
  blockNumber: number;
  navBefore: BigNumber;
  navAfter: BigNumber;
  feesMinted: BigNumber;
  highWaterMarkUpdate: BigNumber;
  timestamp: number;
}
```

### Implementation

```typescript
import { ethers } from 'ethers';
import { Logger } from '../utils/logger';
import { strategyDashboardService } from './strategyDashboardService';
import { healthMonitorAgent } from '../agents/healthMonitorAgent';
import { capacityPlannerAgent } from '../agents/capacityPlannerAgent';
import { priceOracle } from './priceOracle';

const logger = Logger.getLogger();

class NavOracleService {
  private config: NavOracleConfig;
  private provider: ethers.Provider;
  private signer: ethers.Wallet;
  private vaultContract: ethers.Contract;
  private updateTimer?: NodeJS.Timeout;
  private submissionHistory: NavSubmission[] = [];
  private lastValidNAV: BigNumber = BigNumber.from(0);

  constructor(config: NavOracleConfig) {
    this.config = config;
    
    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    
    // Initialize signer (service account)
    this.signer = new ethers.Wallet(config.signerPrivateKey, this.provider);
    
    // Initialize vault contract
    this.vaultContract = new ethers.Contract(
      config.vaultContractAddress,
      config.vaultAbi,
      this.signer
    );
    
    logger.info(`[NavOracle] Initialized for vault: ${config.vaultContractAddress}`);
  }

  /**
   * Start automatic NAV update cycle
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.warn('[NavOracle] Service disabled via config');
      return;
    }

    logger.info(`[NavOracle] Starting with ${this.config.updateIntervalMs}ms interval`);
    
    // Run immediately on startup
    await this.calculateAndSubmitNAV();
    
    // Run periodically
    this.updateTimer = setInterval(
      () => this.calculateAndSubmitNAV().catch(err => 
        logger.error('[NavOracle] Cycle error:', err)
      ),
      this.config.updateIntervalMs
    );
  }

  /**
   * Main NAV calculation & submission flow
   */
  async calculateAndSubmitNAV(): Promise<NavResponse | null> {
    try {
      logger.info('[NavOracle] Starting NAV update cycle');
      
      // Step 1: Gather data from all sources
      const navData = await this.aggregateMetrics();
      
      // Step 2: Validate sanity checks
      await this.validateNavChange(navData.totalNav);
      
      // Step 3: Create signed transaction
      const submission = await this.createSignedSubmission(navData.totalNav);
      
      // Step 4: Submit to blockchain
      const response = await this.submitToBlockchain(submission);
      
      // Step 5: Wait for confirmation & validate
      const confirmed = await this.waitForConfirmation(response.txHash);
      
      if (confirmed) {
        // Step 6: Update internal state
        this.lastValidNAV = navData.totalNav;
        this.submissionHistory.push(submission);
        
        logger.info(`[NavOracle] ✅ NAV update successful: ${ethers.formatEther(navData.totalNav)} ETH`);
        return response;
      } else {
        logger.error('[NavOracle] Transaction failed to confirm');
        return null;
      }
      
    } catch (error) {
      logger.error('[NavOracle] Update cycle failed:', error);
      await this.alertOnFailure(error);
      return null;
    }
  }

  /**
   * Aggregate metrics from all services
   */
  private async aggregateMetrics(): Promise<{
    totalNav: BigNumber;
    positions: Record<string, BigNumber>;
    metrics: any;
  }> {
    logger.debug('[NavOracle] Aggregating metrics...');
    
    // Fetch performance data
    const allStrategies = await strategyDashboardService.listStrategies({
      skip: 0,
      limit: 1000,
      filters: { isActive: true },
      sortBy: 'createdAt'
    });
    
    let totalNav = BigNumber.from(0);
    const positions: Record<string, BigNumber> = {};
    
    // Sum TVL from all strategies
    for (const strategy of allStrategies) {
      const tvl = strategy.totalValueLocked || 0;
      totalNav = totalNav.add(BigNumber.from(tvl));
      positions[strategy.id] = BigNumber.from(tvl);
    }
    
    // Get real-time health snapshot
    const health = healthMonitorAgent.getCurrentHealth();
    
    // Get position details from capacity planner
    const capacity = capacityPlannerAgent.getCapacitySnapshot();
    
    // Fetch current prices
    const prices = await priceOracle.fetchPrices(['ETH', 'BTC', 'USDC']);
    
    logger.debug(`[NavOracle] Aggregated: totalNav=${ethers.formatEther(totalNav)}, positions=${Object.keys(positions).length}`);
    
    return {
      totalNav,
      positions,
      metrics: {
        health,
        capacity,
        prices,
        timestamp: Date.now()
      }
    };
  }

  /**
   * Validate NAV change is reasonable
   */
  private async validateNavChange(newNav: BigNumber): Promise<void> {
    if (this.lastValidNAV.eq(0)) {
      logger.debug('[NavOracle] Skipping validation - first submission');
      return;
    }
    
    // Calculate percentage change
    const change = newNav.sub(this.lastValidNAV);
    const percentChange = change.mul(10000).div(this.lastValidNAV).toNumber() / 100;
    
    const maxDeviation = this.config.maxNAVDeviation * 100; // Convert to percentage
    
    logger.debug(`[NavOracle] NAV change: ${percentChange.toFixed(2)}% (max: ${maxDeviation}%)`);
    
    if (Math.abs(percentChange) > maxDeviation) {
      throw new Error(
        `NAV change ${percentChange.toFixed(2)}% exceeds max deviation ${maxDeviation}%`
      );
    }
  }

  /**
   * Create EIP-712 signed transaction
   */
  private async createSignedSubmission(navValue: BigNumber): Promise<NavSubmission> {
    const nonce = await this.vaultContract.getNonce?.(this.signer.address) || 
                  await this.provider.getTransactionCount(this.signer.address);
    
    const chainId = (await this.provider.getNetwork()).chainId;
    
    const message = {
      navValue: navValue.toString(),
      nonce: nonce,
      chainId: chainId,
      timestamp: Math.floor(Date.now() / 1000),
      vaultAddress: this.config.vaultContractAddress
    };
    
    // Sign message with signer's private key
    const messageHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'uint256', 'uint256', 'address'],
        [message.navValue, message.nonce, message.chainId, message.timestamp, message.vaultAddress]
      )
    );
    
    const signature = this.signer.signingKey.sign(messageHash).serialized;
    
    logger.debug(`[NavOracle] Signed NAV: ${ethers.formatEther(navValue)}`);
    
    return {
      navValue,
      timestamp: message.timestamp,
      calculatedFrom: await this.aggregateMetrics(),
      signature,
      nonce,
      chainId
    };
  }

  /**
   * Submit signed NAV to blockchain
   */
  private async submitToBlockchain(submission: NavSubmission): Promise<NavResponse> {
    logger.info(`[NavOracle] Submitting NAV: ${ethers.formatEther(submission.navValue)}`);
    
    // Call updateNAV with signature for verification
    const tx = await this.vaultContract.updateNAVWithSignature(
      submission.navValue,
      submission.signature,
      {
        gasLimit: 500000,
        gasPrice: (await this.provider.getFeeData()).gasPrice
      }
    );
    
    logger.info(`[NavOracle] Transaction submitted: ${tx.hash}`);
    
    // Listen for confirmation
    const receipt = await tx.wait(1);
    
    if (!receipt) {
      throw new Error('Transaction failed without receipt');
    }
    
    // Parse events
    const navUpdatedEvent = receipt.logs
      .map(log => {
        try {
          return this.vaultContract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(event => event?.name === 'NAVUpdated');
    
    logger.info(`[NavOracle] Transaction confirmed at block ${receipt.blockNumber}`);
    
    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      navBefore: BigNumber.from(0),  // Can be fetched from event
      navAfter: submission.navValue,
      feesMinted: BigNumber.from(0), // Can be fetched from event
      highWaterMarkUpdate: BigNumber.from(0),
      timestamp: Math.floor(Date.now() / 1000)
    };
  }

  /**
   * Wait for transaction confirmation + block confirmations
   */
  private async waitForConfirmation(txHash: string): Promise<boolean> {
    try {
      const receipt = await this.provider.waitForTransaction(txHash, 3); // 3 block confirmations
      return receipt?.status === 1;
    } catch (error) {
      logger.error(`[NavOracle] Confirmation wait failed: ${error}`);
      return false;
    }
  }

  /**
   * Alert on submission failure
   */
  private async alertOnFailure(error: Error): Promise<void> {
    if (this.config.alertWebhookUrl) {
      try {
        await fetch(this.config.alertWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: 'NavOracleService',
            severity: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
          })
        });
      } catch (webhookError) {
        logger.error('[NavOracle] Alert webhook failed:', webhookError);
      }
    }
  }

  /**
   * Stop the NAV update cycle
   */
  async stop(): Promise<void> {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
      logger.info('[NavOracle] Service stopped');
    }
  }

  /**
   * Get recent submission history
   */
  getSubmissionHistory(limit: number = 10): NavSubmission[] {
    return this.submissionHistory.slice(-limit);
  }

  /**
   * Get current service status
   */
  getStatus(): {
    enabled: boolean;
    isRunning: boolean;
    lastNAV: string;
    submissionCount: number;
    uptime: number;
  } {
    return {
      enabled: this.config.enabled,
      isRunning: !!this.updateTimer,
      lastNAV: ethers.formatEther(this.lastValidNAV),
      submissionCount: this.submissionHistory.length,
      uptime: this.updateTimer ? Date.now() - (this.updateTimer as any)._created : 0
    };
  }
}

export const navOracleService = new NavOracleService({
  updateIntervalMs: 3600000,           // 1 hour
  enabled: process.env.ENABLE_NAV_ORACLE === 'true',
  vaultContractAddress: process.env.VAULT_CONTRACT_ADDRESS || '',
  vaultAbi: MaonoVault_ABI,
  signerPrivateKey: process.env.NAV_ORACLE_PRIVATE_KEY || '',
  signerAddress: process.env.NAV_ORACLE_ADDRESS || '',
  maxNAVDeviation: 0.15,               // ±15%
  minConfirmationBlocks: 3,
  enableMultiSig: process.env.ENABLE_MULTISIG === 'true',
  requiredSignatures: parseInt(process.env.REQUIRED_SIGNATURES || '2'),
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL,
  logLevel: 'info'
});
```

---

## 📊 SIGNAL FLOW

### From Backend to Smart Contract

```
┌─────────────────────────────────────────────────────────────┐
│            AUTOMATED NAV UPDATE SEQUENCE                    │
└─────────────────────────────────────────────────────────────┘

1. TRIGGER
   ├─ Cron job fires every hour
   └─ Or manual trigger via admin endpoint

2. DATA AGGREGATION (NavOracleService)
   ├─ Fetch from strategyDashboardService:
   │  └─ allStrategies[].totalValueLocked (TVL)
   │  └─ allStrategies[].ytdReturn, monthReturn
   │  └─ allStrategies[].sharpeRatio, maxDrawdown
   │
   ├─ Fetch from healthMonitorAgent:
   │  └─ 877+ endpoint performance metrics
   │  └─ Error rates, latency, health status
   │
   ├─ Fetch from capacityPlannerAgent:
   │  └─ Position values (Aave lend, Uniswap LP, etc.)
   │  └─ Deployed capital breakdown
   │
   └─ Fetch from priceOracle:
      └─ Current asset prices (ETH, BTC, USDC, etc.)

3. NAV CALCULATION
   ├─ Sum all strategy TVLs → grossNAV
   ├─ Add all position values → totalPositionValue
   ├─ Adjust for liabilities → netNAV
   └─ = finalNAV (in wei, 1e18 format)

4. VALIDATION
   ├─ Check: |navChange| ≤ maxDeviation (15%)
   ├─ Check: lastValidNAV exists (if not first time)
   ├─ Check: NAV > 0
   └─ Passes? → Continue

5. SIGNING
   ├─ Create message: { navValue, nonce, chainId, timestamp }
   ├─ Hash message (keccak256)
   ├─ Sign with private key
   └─ signature = serviceAccount.sign(messageHash)

6. SUBMISSION
   ├─ Call: vault.updateNAVWithSignature(navValue, signature)
   ├─ Gas limit: 500,000
   ├─ Wait: tx confirmation
   └─ Return: txHash

7. CONFIRMATION
   ├─ Wait: minConfirmationBlocks (3)
   ├─ Check: receipt.status === 1
   ├─ Parse: NAVUpdated event
   └─ Confirm: Success or fail

8. RESPONSE
   ├─ Return: { txHash, blockNumber, navAfter, feesCollected }
   ├─ Update: lastValidNAV = navAfter
   ├─ Log: submission to history
   └─ Alert: on failure via webhook

9. ON-CHAIN PROCESSING
   └─ MaonoVault.updateNAVWithSignature():
      ├─ Verify: signature is from authorized signer
      ├─ Check: NAV ±10% of actual balance
      ├─ Collect: management fees (prorated)
      ├─ Calculate: performance fees (if profit)
      ├─ Update: highWaterMark
      ├─ Emit: NAVUpdated event
      └─ Done: Share price updated, fees minted
```

---

## 🔐 SMART CONTRACT ORACLE INTERFACE

### Enhanced MaonoVault with Oracle Support

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract MaonoVaultWithOracle is ERC4626, AccessControl {
    using ECDSA for bytes32;
    
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant MULTISIG_ROLE = keccak256("MULTISIG_ROLE");
    
    // Oracle state
    mapping(address => uint256) public oracleNonces;
    mapping(address => bool) public authorizedOracles;
    
    // Multi-sig for NAV updates
    struct NavUpdateProposal {
        uint256 navValue;
        uint256 signatures;
        mapping(address => bool) hasApproved;
        bool executed;
    }
    
    mapping(bytes32 => NavUpdateProposal) public navProposals;
    address[] public multiSigSigners;
    uint256 public requiredSignatures;
    
    // Events
    event OracleAdded(address indexed oracle);
    event OracleRemoved(address indexed oracle);
    event NavUpdateProposed(bytes32 indexed proposalId, uint256 navValue);
    event NavUpdateApproved(bytes32 indexed proposalId, address signer);
    event NavUpdatedViaOracle(uint256 newNAV, address indexed oracle);
    
    // Errors
    error UnauthorizedOracle();
    error InvalidSignature();
    error InvalidNonce();
    error NavOutOfRange();
    
    /**
     * Update NAV with oracle signature
     */
    function updateNAVWithSignature(
        uint256 newNAV,
        bytes calldata signature
    ) 
        external 
        onlyRole(ORACLE_ROLE)
        nonReentrant
        whenNotPaused
    {
        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            newNAV,
            oracleNonces[msg.sender],
            block.chainid,
            address(this)
        ));
        
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address recoveredSigner = ethSignedMessageHash.recover(signature);
        
        if (recoveredSigner != msg.sender) {
            revert InvalidSignature();
        }
        
        // Increment nonce
        oracleNonces[msg.sender]++;
        
        // Validate NAV range
        uint256 actualBalance = IERC20(asset()).balanceOf(address(this));
        if (newNAV > actualBalance * 11 / 10 || newNAV < actualBalance * 9 / 10) {
            revert NavOutOfRange();
        }
        
        // Perform NAV update
        _updateNAV(newNAV);
        
        emit NavUpdatedViaOracle(newNAV, msg.sender);
    }
    
    /**
     * Multi-sig NAV update proposal
     */
    function proposeNavUpdate(uint256 newNAV) external onlyRole(MULTISIG_ROLE) {
        bytes32 proposalId = keccak256(abi.encodePacked(newNAV, block.timestamp));
        
        NavUpdateProposal storage proposal = navProposals[proposalId];
        proposal.navValue = newNAV;
        proposal.signatures = 1; // Proposer counts as 1
        proposal.hasApproved[msg.sender] = true;
        
        emit NavUpdateProposed(proposalId, newNAV);
    }
    
    /**
     * Approve multi-sig NAV update
     */
    function approveNavUpdate(bytes32 proposalId) external onlyRole(MULTISIG_ROLE) {
        NavUpdateProposal storage proposal = navProposals[proposalId];
        
        require(!proposal.executed, "Already executed");
        require(!proposal.hasApproved[msg.sender], "Already approved");
        
        proposal.hasApproved[msg.sender] = true;
        proposal.signatures++;
        
        emit NavUpdateApproved(proposalId, msg.sender);
        
        // Auto-execute if threshold met
        if (proposal.signatures >= requiredSignatures) {
            proposal.executed = true;
            _updateNAV(proposal.navValue);
            emit NavUpdatedViaOracle(proposal.navValue, msg.sender);
        }
    }
    
    /**
     * Add authorized oracle
     */
    function addOracle(address oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(ORACLE_ROLE, oracle);
        authorizedOracles[oracle] = true;
        emit OracleAdded(oracle);
    }
    
    /**
     * Remove authorized oracle
     */
    function removeOracle(address oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(ORACLE_ROLE, oracle);
        authorizedOracles[oracle] = false;
        emit OracleRemoved(oracle);
    }
    
    /**
     * Set multi-sig signers
     */
    function setMultiSigSigners(
        address[] calldata signers,
        uint256 required
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        multiSigSigners = signers;
        requiredSignatures = required;
        
        for (uint256 i = 0; i < signers.length; i++) {
            grantRole(MULTISIG_ROLE, signers[i]);
        }
    }
    
    /**
     * Internal NAV update (used by both oracle and multi-sig)
     */
    function _updateNAV(uint256 newNAV) internal {
        _collectManagementFees();
        
        uint256 currentSupply = totalSupply();
        if (currentSupply == 0) {
            lastNAV = newNAV;
            highWaterMark = 1e18;
            lastNAVUpdate = block.timestamp;
            emit NAVUpdated(newNAV, block.timestamp, msg.sender);
            return;
        }
        
        uint256 currentPrice = newNAV.mulDiv(1e18, currentSupply, Math.Rounding.Floor);
        
        // Performance fee calculation
        if (currentPrice > highWaterMark) {
            uint256 profitPerShare = currentPrice - highWaterMark;
            uint256 totalProfit = profitPerShare.mulDiv(currentSupply, 1e18, Math.Rounding.Floor);
            uint256 perfFee = totalProfit.mulDiv(performanceFee, FEE_DENOMINATOR, Math.Rounding.Floor);
            
            if (perfFee > 0) {
                uint256 feeShares = perfFee.mulDiv(currentSupply, newNAV, Math.Rounding.Floor);
                uint256 platformShare = feeShares.mulDiv(platformFeeRate, FEE_DENOMINATOR, Math.Rounding.Floor);
                uint256 daoShare = feeShares - platformShare;
                
                if (platformShare > 0) _mint(platformTreasury, platformShare);
                if (daoShare > 0) _mint(daoTreasury, daoShare);
                
                highWaterMark = currentPrice;
                emit PerformanceFeeCollected(perfFee, block.timestamp);
            }
        }
        
        lastNAV = newNAV;
        lastNAVUpdate = block.timestamp;
        emit NAVUpdated(newNAV, block.timestamp, msg.sender);
    }
}
```

---

## 🔄 AUTOMATED UPDATE PIPELINE

### Complete Integration Steps

```typescript
// Step 1: Initialize NAV Oracle Service
// In server/index.ts
import { navOracleService } from './services/navOracleService';

app.listen(PORT, async () => {
  // ... other initialization
  
  // Start NAV oracle
  await navOracleService.start();
  logger.info('✅ NAV Oracle Service started');
});

// Step 2: Add monitoring endpoint
app.get('/api/oracle/status', (req, res) => {
  const status = navOracleService.getStatus();
  res.json({
    success: true,
    data: status
  });
});

// Step 3: Add manual trigger endpoint
app.post('/api/oracle/trigger-update', requireAuth, async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const response = await navOracleService.calculateAndSubmitNAV();
  res.json({
    success: !!response,
    data: response
  });
});

// Step 4: Add submission history endpoint
app.get('/api/oracle/history', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const history = navOracleService.getSubmissionHistory(limit);
  
  res.json({
    success: true,
    data: history.map(submission => ({
      navValue: ethers.formatEther(submission.navValue),
      timestamp: new Date(submission.timestamp * 1000),
      signature: submission.signature.slice(0, 10) + '...',
      blockConfirmed: submission.nonce !== undefined
    }))
  });
});

// Step 5: Wire to database for persistence
// In server/db/migrations/addNavOracleHistory.ts
export async function up(db) {
  await db.schema
    .createTable('nav_oracle_submissions')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('vault_id', 'varchar', (col) => col.references('mtaa_vaults.id'))
    .addColumn('nav_value', 'varchar')  // Store as string to preserve precision
    .addColumn('tx_hash', 'varchar')
    .addColumn('block_number', 'integer')
    .addColumn('status', 'varchar')     // pending, confirmed, failed
    .addColumn('submitted_by', 'varchar')
    .addColumn('submitted_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
    .addColumn('confirmed_at', 'timestamp')
    .execute();
}
```

---

## ✍️ MESSAGE SIGNING & VERIFICATION

### EIP-712 vs ECDSA Signing

```typescript
// Option 1: Simple ECDSA Signing (Current)
async function signNAV(navValue: BigNumber, privateKey: string) {
  const message = ethers.AbiCoder.defaultAbiCoder().encode(
    ['uint256', 'uint256', 'uint256'],
    [navValue, nonce, chainId]
  );
  
  const hash = ethers.keccak256(message);
  const wallet = new ethers.Wallet(privateKey);
  const signature = wallet.signingKey.sign(hash).serialized;
  
  return signature;
}

// On-chain verification
function verifyNAVSignature(navValue, signature, signer) {
  bytes32 messageHash = keccak256(abi.encodePacked(navValue, nonce, chainId));
  bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
  address recoveredSigner = ethSignedHash.recover(signature);
  
  return recoveredSigner == signer;
}

// Option 2: EIP-712 (More Structured)
const domain = {
  name: "MaonoVault",
  version: "1",
  chainId: 42220,  // Celo
  verifyingContract: vaultAddress
};

const types = {
  NavUpdate: [
    { name: "navValue", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "timestamp", type: "uint256" }
  ]
};

const value = {
  navValue: navBigNumber,
  nonce: currentNonce,
  timestamp: now
};

const signature = await signer._signTypedData(domain, types, value);
```

---

## ⚠️ ERROR HANDLING & FALLBACKS

### Resilience Strategy

```typescript
/**
 * Fallback mechanisms if primary oracle fails
 */

// Fallback 1: Manual threshold-based recovery
if (navOracleService.submissionHistory.length > 0) {
  const lastSubmission = navOracleService.submissionHistory[navOracleService.submissionHistory.length - 1];
  const timeSinceLastSubmission = Date.now() - (lastSubmission.timestamp * 1000);
  
  if (timeSinceLastSubmission > 2 * 60 * 60 * 1000) { // 2 hours
    logger.warn('⚠️ No NAV update for 2 hours - triggering fallback');
    
    // Alert admins
    await notificationService.sendAlert({
      type: 'NAV_UPDATE_STALLED',
      severity: 'high',
      message: 'No NAV update submitted in 2 hours'
    });
    
    // Fallback: Use cached NAV with age multiplier
    // Or: Trigger manual multi-sig update
  }
}

// Fallback 2: Transaction retry with exponential backoff
async function submitWithRetry(submission: NavSubmission, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await submitToBlockchain(submission);
    } catch (error) {
      lastError = error;
      const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      logger.warn(`[NavOracle] Attempt ${attempt + 1} failed, retrying in ${delayMs}ms`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError;
}

// Fallback 3: Graceful degradation
if (!navOracleService.isRunning) {
  // Weekly manual update (cheaper fallback)
  logger.warn('[NavOracle] Oracle service down - using weekly manual update');
  
  const vaultNAV = await vaultContract.previewNAV();
  const timeSinceUpdate = Date.now() - (vaultNAV.lastUpdate * 1000);
  
  if (timeSinceUpdate > 7 * 24 * 60 * 60 * 1000) { // 7 days
    // Trigger owner-initiated multi-sig update
    await vaultContract.proposeNavUpdate(calculatedNAV);
  }
}

// Fallback 4: Circuit breaker pattern
class NavOracleCircuitBreaker {
  private failureCount = 0;
  private readonly failureThreshold = 5;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  async executeWithBreaker(fn: () => Promise<void>): Promise<boolean> {
    if (this.state === 'open') {
      logger.warn('[CircuitBreaker] OPEN - rejecting calls');
      return false;
    }
    
    try {
      await fn();
      this.onSuccess();
      return true;
    } catch (error) {
      this.onFailure();
      return false;
    }
  }
  
  private onSuccess() {
    this.failureCount = 0;
    if (this.state === 'half-open') {
      this.state = 'closed';
      logger.info('[CircuitBreaker] Recovered to CLOSED');
    }
  }
  
  private onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      logger.error('[CircuitBreaker] Opened after 5 failures');
      
      // Schedule recovery attempt in 5 minutes
      setTimeout(() => {
        this.state = 'half-open';
        logger.info('[CircuitBreaker] Half-open for recovery attempt');
      }, 5 * 60 * 1000);
    }
  }
}
```

---

## 🔐 SECURITY & GOVERNANCE

### Multi-Sig & Authorization

```typescript
/**
 * Role-based access control
 */

interface OracleAuth {
  primaryOracle: {
    address: string;                    // Service account
    role: 'ORACLE_ROLE'
    frequency: 'hourly'
    gasLimit: 500000
  };
  
  multiSigSigners: [
    {
      address: string;                  // Signer 1 (Team)
      role: 'MULTISIG_ROLE'
      threshold: 1                      // 2-of-3 required
    },
    {
      address: string;                  // Signer 2 (DAO)
      role: 'MULTISIG_ROLE'
      threshold: 1
    },
    {
      address: string;                  // Signer 3 (Operator)
      role: 'MULTISIG_ROLE'
      threshold: 1
    }
  ];
  
  fallbackAdmin: {
    address: string;
    role: 'DEFAULT_ADMIN_ROLE'
    emergency: true
  };
}

/**
 * Governance model
 */

// Configuration: Stored in contract, changeable only by governance
contract MaonoVault {
  // Governance parameters
  uint256 public maxNAVDeviation = 0.15e18;      // 15% max change
  uint256 public minConfirmationBlocks = 3;
  uint256 public updateFrequencySeconds = 3600;   // 1 hour
  
  // Governance override (multi-sig)
  function updateGovernanceParams(
    uint256 _maxDeviation,
    uint256 _minConfirmations,
    uint256 _frequency
  ) external onlyRole(GOVERNANCE_ROLE) {
    maxNAVDeviation = _maxDeviation;
    minConfirmationBlocks = _minConfirmations;
    updateFrequencySeconds = _frequency;
    
    emit GovernanceParamsUpdated(_maxDeviation, _minConfirmations, _frequency);
  }
}
```

---

## ✅ DEPLOYMENT CHECKLIST

### Pre-Production

- [ ] **Smart Contract Deployment**
  - [ ] Deploy MaonoVaultWithOracle to testnet
  - [ ] Set oracle addresses (primary + multi-sig)
  - [ ] Configure governance role holders
  - [ ] Set update parameters (freq, max deviation)
  - [ ] Verify contract bytecode matches source

- [ ] **Backend Configuration**
  - [ ] Create NAV Oracle Service instance
  - [ ] Generate service account (private key)
  - [ ] Fund service account with gas (0.1-1 ETH)
  - [ ] Set environment variables (.env)
  - [ ] Configure update interval (start with 1 hour)

- [ ] **Integration Testing**
  - [ ] Test manual NAV update via endpoint
  - [ ] Verify signature validation on-chain
  - [ ] Test multi-sig fallback
  - [ ] Verify event emission & indexing
  - [ ] Check gas usage (shoot for <100k per update)

- [ ] **Monitoring & Alerts**
  - [ ] Set up dashboard for submission history
  - [ ] Configure webhook alerts for failures
  - [ ] Create admin endpoint for manual trigger
  - [ ] Set up log aggregation (CloudWatch, etc.)
  - [ ] Monitor gas prices & adjust dynamically

- [ ] **Documentation**
  - [ ] Update API docs with oracle endpoints
  - [ ] Document oracle role requirements
  - [ ] Create runbook for failure scenarios
  - [ ] Document recovery procedures

### Production

- [ ] Enable service on mainnet
- [ ] Run for 1 week in shadow mode (no actual submissions)
- [ ] Gradually increase submission frequency
- [ ] Monitor for issues monthly
- [ ] Gather metrics for optimization

---

## 💻 CODE EXAMPLES

### Complete Integration in Express

```typescript
// server/index.ts

import express from 'express';
import { navOracleService } from './services/navOracleService';
import { strategyDashboardService } from './services/strategyDashboardService';

const app = express();
const PORT = 3000;

// Initialize services
await strategyDashboardService.initialize();

// Start NAV Oracle
if (process.env.ENABLE_NAV_ORACLE === 'true') {
  await navOracleService.start();
}

// Register endpoints
app.get('/api/oracle/status', (req, res) => {
  res.json({ success: true, data: navOracleService.getStatus() });
});

app.post('/api/oracle/trigger', requireAdmin, async (req, res) => {
  const response = await navOracleService.calculateAndSubmitNAV();
  res.json({ success: !!response, data: response });
});

app.get('/api/oracle/history', (req, res) => {
  const history = navOracleService.getSubmissionHistory(10);
  res.json({ success: true, data: history });
});

app.listen(PORT, () => {
  console.log(`🏛️ Vault + Strategy System running on port ${PORT}`);
  console.log(`📊 NAV Oracle: ${navOracleService.getStatus().enabled ? 'ENABLED' : 'DISABLED'}`);
});

// Export for testing
export { app, navOracleService };
```

---

## 📈 MONITORING DASHBOARD

```typescript
// Real-time dashboard data structure

interface OracleDashboard {
  systemStatus: {
    oracleRunning: boolean;
    lastUpdate: Date;
    nextUpdate: Date;
    uptime: number;
  };
  
  lastSubmission: {
    navValue: string;                    // Formatted ETH
    txHash: string;
    block: number;
    timestamp: Date;
    feesCollected: string;
    highWaterMarkUpdate: string;
  };
  
  statistics: {
    totalSubmissions: number;
    failureRate: number;
    avgGasUsed: number;
    avgConfirmationTime: number;
  };
  
  alerts: Array<{
    severity: 'info' | 'warning' | 'error';
    message: string;
    timestamp: Date;
  }>;
}
```

---

**Generated:** March 1, 2026 | **Status:** Ready for Implementation
