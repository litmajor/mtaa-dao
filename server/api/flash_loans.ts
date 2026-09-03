/**
 * Flash Loan Opportunities API
 *
 * Opportunity detection is real
 * (see flashLoanOpportunityService.ts); strategies without a real
 * detection engine behind them (liquidation, swap-routing, MEV) report
 * as explicitly not-implemented rather than returning fabricated numbers.
 *
 * All routes in this file are gated behind advancedModeGuard — this is
 * fund-moving / leverage-adjacent functionality and belongs behind the
 * same gate as bridge/swap and bridge/transfer.
 *
 * Profit Validation:
 * ─────────────────
 * Minimum profit is calculated dynamically per transaction:
 *   minProfit = estimatedGasCost + executionBuffer + targetNetMargin
 *
 * This is passed as an absolute amount (in token wei) to the on-chain
 * contract's executeOperation callback, which enforces:
 *   require(endingBalance >= amountOwed + minProfitAmount)
 *
 * Premium Monitoring:
 * ──────────────────
 * Background monitor tracks Aave flash-loan premium against the on-chain
 * constant. If they drift beyond tolerance, logs an alert so you find out
 * from a dashboard instead of from a wall of failed executions.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { ethers } from 'ethers';
import { createWalletIfValid } from '../utils/cryptoWallet';
import { scanForOpportunities } from './flashLoanOpportunityService';
import { startPremiumMonitor, checkPremiumNow, EXPECTED_PREMIUM_BPS } from './flashLoanPremiumMonitor';
import advancedModeGuard from '../middleware/advancedModeGuard';
import { logger } from '../utils/logger';
import { priceOracle } from '../services/priceOracle';
import { gasPriceOracle } from '../services/gasPriceOracle';

const router = Router();

router.use(advancedModeGuard);

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

// Dynamic minimum profit calculation parameters
// These control how much net profit is required beyond gas costs.
const MIN_NET_PROFIT_USD = parseFloat(process.env.MIN_NET_PROFIT_USD ?? '50'); // minimum target profit in USD
const GAS_BUFFER_MULTIPLIER = 1.2; // multiply gas estimate by this to add safety buffer

// Optional: log all profit calculations for debugging
const ENABLE_PROFIT_LOGGING = process.env.ENABLE_PROFIT_LOGGING === 'true';

// ─────────────────────────────────────────────────────────────────────────────
// SUBMISSION QUEUE (per-process only — multi-instance needs external lock)
// ─────────────────────────────────────────────────────────────────────────────

// Serializes on-chain submissions from this process so concurrent
// requests to /execute can't race on nonce assignment. This only
// protects a single process — if this API runs multiple instances, the
// signer's nonce must be coordinated externally (e.g. a distributed
// lock), same caveat as the in-memory cache note in aaveDataService.ts.
let submissionQueue: Promise<unknown> = Promise.resolve();

function enqueueSubmission<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    submissionQueue = submissionQueue
      .then(() => fn())
      .then(resolve)
      .catch(reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC MINIMUM PROFIT CALCULATION (Layer 1: Off-Chain Solver)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate the minimum profit required (absolute amount in token wei)
 * to cover: (1) estimated gas costs, (2) execution buffer, (3) target net margin
 *
 * Production implementation using:
 * - Live gas price from gasPriceOracle
 * - Live ETH/token price from priceOracle
 * - Actual transaction gas estimate
 *
 * Input: tokenDecimals (e.g., 6 for USDC, 18 for DAI)
 * Returns: BigInt representing minimum profit in token wei
 */
async function calculateDynamicMinimumProfit(
  provider: ethers.JsonRpcProvider,
  txPayload: ethers.TransactionRequest,
  tokenDecimals: number,
  assetSymbol: string,
  chain: string = 'ethereum'
): Promise<bigint> {
  try {
    // Step 1: Estimate gas using provider
    const gasEstimate = await provider.estimateGas(txPayload);
    if (ENABLE_PROFIT_LOGGING) {
      logger.info(`[dynamicMinimumProfit] Gas estimate for ${assetSymbol}: ${gasEstimate.toString()} units`);
    }

    // Step 2: Get live gas price from gasPriceOracle
    // Use getOptimalGasStrategy to get proper EIP-1559 fees
    const gasStrategy = await gasPriceOracle.getOptimalGasStrategy(provider, chain, 'standard');
    // For wei calculation, use maxFeePerGas (or gasPrice for legacy)
    const gasPrice = BigInt(gasStrategy.maxFeePerGas || gasStrategy.gasPrice || '0');
    if (gasPrice === 0n) {
      logger.warn(`[dynamicMinimumProfit] Failed to get valid gas price for ${chain}`);
      throw new Error(`No valid gas price available for chain ${chain}`);
    }
    const gasCostWei = gasEstimate * gasPrice;

    // Step 3: Get live ETH price from priceOracle
    const ethPriceData = await priceOracle.getPrice('ETH');
    if (!ethPriceData) {
      logger.warn(`[dynamicMinimumProfit] No ETH price available, using fallback $2000`);
      const ethToUsdRate = 2000;
      const gasCostUsd = Number(ethers.formatEther(gasCostWei)) * ethToUsdRate;
      const totalRequiredUsd = gasCostUsd * GAS_BUFFER_MULTIPLIER + MIN_NET_PROFIT_USD;
      const minProfitWei = ethers.parseUnits(
        totalRequiredUsd.toFixed(tokenDecimals),
        tokenDecimals
      );
      return minProfitWei;
    }

    const ethToUsdRate = ethPriceData.priceUsd;
    const gasCostUsd = Number(ethers.formatEther(gasCostWei)) * ethToUsdRate;

    // Step 4: Get live token price to convert USD to token units
    const tokenPriceData = await priceOracle.getPrice(assetSymbol);
    const tokenUsdRate = tokenPriceData?.priceUsd ?? 1.0; // Default 1:1 for stablecoins

    // Step 5: Calculate total required USD
    const totalRequiredUsd = gasCostUsd * GAS_BUFFER_MULTIPLIER + MIN_NET_PROFIT_USD;

    // Step 6: Convert to token units
    const minProfitInTokenUnits = totalRequiredUsd / tokenUsdRate;
    const minProfitWei = ethers.parseUnits(
      minProfitInTokenUnits.toFixed(tokenDecimals),
      tokenDecimals
    );

    if (ENABLE_PROFIT_LOGGING) {
      logger.info(
        `[dynamicMinimumProfit] ${assetSymbol}: ` +
        `gasEstimate=${gasEstimate.toString()}, ` +
        `gasPrice=${gasPrice.toString()}, ` +
        `gasCostWei=${gasCostWei.toString()}, ` +
        `gasCostUsd=${gasCostUsd.toFixed(2)}USD, ` +
        `ethPrice=$${ethToUsdRate.toFixed(2)}, ` +
        `tokenPrice=$${tokenUsdRate.toFixed(6)}, ` +
        `buffer=${(gasCostUsd * (GAS_BUFFER_MULTIPLIER - 1)).toFixed(2)}USD, ` +
        `margin=${MIN_NET_PROFIT_USD}USD, ` +
        `totalRequiredUsd=${totalRequiredUsd.toFixed(2)}USD, ` +
        `minProfitInTokenUnits=${minProfitInTokenUnits.toFixed(tokenDecimals)}, ` +
        `minProfitWei=${minProfitWei.toString()}`
      );
    }

    return minProfitWei;
  } catch (err) {
    logger.error(`[dynamicMinimumProfit] Error calculating profit for ${assetSymbol}:`, err);
    // Fallback: return a conservative estimate (0.5 token units as safety buffer)
    return ethers.parseUnits('0.5', tokenDecimals);
  }
}

/**
 * Initialize premium drift monitoring on startup
 */
async function initializePremiumMonitoring(): Promise<void> {
  const checkInterval = parseInt(process.env.PREMIUM_CHECK_INTERVAL_MS ?? '300000', 10); // 5 min default
  try {
    await startPremiumMonitor(checkInterval);
  } catch (err) {
    logger.error('[flash_loans] Failed to start premium monitor:', err);
    // Non-fatal: continue operation without monitoring
  }
}

// Start monitoring on module load
initializePremiumMonitoring().catch((err) => {
  logger.error('[flash_loans] Premium monitor init failed:', err);
});

function parseLoanAmount(raw: unknown, res: Response): number | null {
  const n = Number(raw);
  if (!isFinite(n) || n <= 0) {
    res.status(400).json({ error: 'loanAmount must be a positive number' });
    return null;
  }
  return n;
}

/**
 * GET /api/lending/flash-loans
 * Real triangular arbitrage scan. Other strategies report as
 * not-implemented rather than mocked.
 */
router.get('/flash-loans', async (req: Request, res: Response) => {
  const chain = String(req.query.chain || 'ethereum').toLowerCase();
  const loanAmount = parseLoanAmount(req.query.loanAmount ?? 100000, res);
  if (loanAmount === null) return;

  try {
    const result = await scanForOpportunities(chain, loanAmount);
    res.json(result);
  } catch (err) {
    console.error('Error scanning flash loan opportunities:', err);
    res.status(503).json({ error: 'Opportunity scan failed', detail: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * GET /api/lending/flash-loans/summary
 */
router.get('/flash-loans/summary', async (req: Request, res: Response) => {
  const chain = String(req.query.chain || 'ethereum').toLowerCase();
  const loanAmount = parseLoanAmount(req.query.loanAmount ?? 100000, res);
  if (loanAmount === null) return;

  try {
    const scan = await scanForOpportunities(chain, loanAmount);
    const profitable = scan.opportunities.filter((o: any) => o.profitable);

    res.json({
      chain,
      activeOpportunities: profitable.length,
      scannedOpportunities: scan.opportunities.length,
      bestOpportunity: profitable[0] ?? null,
      strategiesImplemented: scan.strategiesImplemented,
      strategiesNotImplemented: scan.strategiesNotImplemented,
      errors: scan.errors,
      lastScanTime: Date.now(),
    });
  } catch (err) {
    console.error('Error fetching flash loan summary:', err);
    res.status(503).json({ error: 'Opportunity scan failed', detail: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * GET /api/lending/flash-loans/premium-status
 * Check the premium drift monitor status across chains.
 * Returns live premium vs. on-chain constant and any detected drift.
 */
router.get('/flash-loans/premium-status', async (req: Request, res: Response) => {
  const chain = req.query.chain ? String(req.query.chain).toLowerCase() : undefined;
  const chains = chain ? [chain] : ['ethereum', 'polygon', 'arbitrum'];

  try {
    const statuses: Record<string, any> = {};
    
    for (const c of chains) {
      const status = await checkPremiumNow(c);
      statuses[c] = {
        expectedBps: status.expectedBps,
        liveBps: status.liveBps,
        drift: status.drift,
        toleranceBps: status.toleranceBps,
        isDrift: status.isDrift,
        lastCheckTime: new Date(status.lastCheckTime).toISOString(),
        lastAlertTime: status.lastAlertTime ? new Date(status.lastAlertTime).toISOString() : null,
        message: status.isDrift
          ? `⚠️  Premium drift detected: live=${status.liveBps}bps vs expected=${status.expectedBps}bps (drift=${status.drift}bps, tolerance=${status.toleranceBps}bps)`
          : `✅ Premium stable: ${status.liveBps}bps`,
      };
    }

    res.json({ premiumStatus: statuses });
  } catch (err) {
    console.error('Error checking premium status:', err);
    res.status(503).json({ error: 'Premium status check failed', detail: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * POST /api/lending/flash-loans/execute
 * Execute a flash loan on-chain via the FlashLoanExecutor contract.
 * Required env vars: RPC_URL, FLASH_EXECUTOR_ADDRESS, FLASH_EXECUTOR_PRIVATE_KEY
 * Body params: { asset, loanAmount, strategy, strategyParams?, tokenDecimals? }
 */
router.post('/flash-loans/execute', async (req: Request, res: Response) => {
  try {
    const { asset, loanAmount, strategy, strategyParams = '0x', tokenDecimals } = req.body || {};

    if (!asset || !loanAmount || !strategy) {
      return res.status(400).json({ error: 'Missing required parameters: asset, loanAmount, strategy' });
    }
    if (!ethers.isAddress(asset)) return res.status(400).json({ error: 'Invalid asset address' });
    if (!ethers.isAddress(strategy)) return res.status(400).json({ error: 'Invalid strategy address' });
    const loanNum = Number(loanAmount);
    if (!isFinite(loanNum) || loanNum <= 0) return res.status(400).json({ error: 'Invalid loanAmount' });

    const RPC_URL = process.env.RPC_URL;
    const PRIVATE_KEY = process.env.FLASH_EXECUTOR_PRIVATE_KEY || process.env.PRIVATE_KEY;
    const FLASH_EXECUTOR_ADDRESS = process.env.FLASH_EXECUTOR_ADDRESS;

    if (!RPC_URL || !PRIVATE_KEY || !FLASH_EXECUTOR_ADDRESS) {
      console.error('Missing on-chain configuration for flash loan execution');
      return res.status(500).json({ error: 'Server not configured to execute on-chain flash loans' });
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = createWalletIfValid(PRIVATE_KEY, provider);
    if (!signer) {
      console.error('Invalid FLASH_EXECUTOR_PRIVATE_KEY or PRIVATE_KEY; cannot execute on-chain flash loans');
      return res.status(500).json({ error: 'Server not configured to execute on-chain flash loans' });
    }

    const executorAbi = [
      'function executeFlashLoan(address asset,uint256 amount,address strategy,bytes params) external returns (bytes32)',
      'function isStrategyAuthorized(address strategy) external view returns (bool)',
    ];
    const erc20Abi = ['function decimals() view returns (uint8)'];

    const executor = new ethers.Contract(FLASH_EXECUTOR_ADDRESS, executorAbi, signer);

    // Fail fast with a clean error instead of reverting on-chain (and
    // paying gas for it) if the strategy isn't whitelisted.
    const authorized: boolean = await executor.isStrategyAuthorized(strategy);
    if (!authorized) {
      return res.status(400).json({ error: 'Strategy is not authorized on the executor contract' });
    }

    let decimals = 18;
    if (tokenDecimals) {
      decimals = Number(tokenDecimals);
    } else {
      try {
        const token = new ethers.Contract(asset, erc20Abi, provider);
        const d: unknown = await token.decimals();
        decimals = Number(d ?? 18);
      } catch {
        // fall back to 18
      }
    }

    const amount = ethers.parseUnits(String(loanAmount), decimals);

    let paramsBytes = '0x';
    if (strategyParams && typeof strategyParams === 'object' && Array.isArray(strategyParams.paramTypes) && Array.isArray(strategyParams.paramValues)) {
      try {
        paramsBytes = new ethers.AbiCoder().encode(strategyParams.paramTypes, strategyParams.paramValues);
      } catch (err) {
        console.error('Failed to ABI-encode strategyParams object', err);
        return res.status(400).json({ error: 'Invalid strategyParams paramTypes/paramValues for ABI encoding' });
      }
    } else if (typeof strategyParams === 'string') {
      const hex = strategyParams;
      if (hex === '0x' || hex === '') {
        paramsBytes = '0x';
      } else {
        const isHex = /^0x[0-9a-fA-F]*$/.test(hex);
        if (!isHex) return res.status(400).json({ error: 'strategyParams must be a hex string starting with 0x or an object with paramTypes/paramValues' });
        const byteLen = (hex.length - 2) / 2;
        const MAX_BYTES = 4096;
        if (!Number.isInteger(byteLen) || byteLen < 0 || byteLen > MAX_BYTES) {
          return res.status(400).json({ error: `strategyParams hex length invalid or exceeds ${MAX_BYTES} bytes` });
        }
        paramsBytes = hex;
      }
    }

    // ───────────────────────────────────────────────────────────────────
    // Premium Drift Monitoring (availability risk detection)
    // ───────────────────────────────────────────────────────────────────
    const chainName = process.env.CHAIN || 'ethereum';
    const premiumStatus = await checkPremiumNow(chainName).catch((err) => {
      logger.warn('[flash_loans] Premium check failed:', err instanceof Error ? { error: err.message } : { error: String(err) });
      return null;
    });

    if (premiumStatus?.isDrift) {
      logger.warn(
        `[flash_loans] ⚠️  Premium drift detected: live=${premiumStatus.liveBps}bps, ` +
        `expected=${premiumStatus.expectedBps}bps. Proceeding with simulation, but if it fails ` +
        `with PremiumMismatch, contract needs update.`
      );
    }

    // ───────────────────────────────────────────────────────────────────
    // Dynamic Minimum Profit Calculation (Layer 1: Off-Chain Solver)
    // ───────────────────────────────────────────────────────────────────
    // Calculate the minimum profit required to cover gas + buffer + margin.
    // This will be passed to the on-chain contract via strategyParams
    // so it can enforce: endingBalance >= amountOwed + minProfitAmount
    let minProfitAmount: bigint | null = null;
    try {
      const txPayload: ethers.TransactionRequest = {
        to: FLASH_EXECUTOR_ADDRESS,
        from: await signer.getAddress(),
        data: executor.interface.encodeFunctionData('executeFlashLoan', [asset, amount, strategy, paramsBytes]),
        gasLimit: 1_500_000,
      };
      minProfitAmount = await calculateDynamicMinimumProfit(provider, txPayload, decimals, asset, chainName);
      logger.info(`[flash_loans] Dynamic minimum profit calculated: ${minProfitAmount.toString()} (${ethers.formatUnits(minProfitAmount, decimals)} tokens)`);
    } catch (profitErr) {
      logger.error('[flash_loans] Dynamic profit calculation failed, using conservative fallback:', profitErr);
      // Fallback to a conservative estimate
      minProfitAmount = ethers.parseUnits('0.5', decimals);
    }

    // Layer 2: Encode minProfitAmount into params
    // Wire minProfitAmount into the strategy params so the smart contract receives it.
    // Strategy contract's executeOperation callback will unpack and validate:
    //   require(endingBalance >= amountOwed + minProfitAmount, "Insufficient net profit")
    let finalParamsBytes = paramsBytes;
    try {
      // If strategyParams was an object with paramTypes/paramValues, extend it
      if (strategyParams && typeof strategyParams === 'object' && 
          Array.isArray(strategyParams.paramTypes) && 
          Array.isArray(strategyParams.paramValues)) {
        // Add minProfitAmount to the params
        strategyParams.paramTypes.push('uint256');
        strategyParams.paramValues.push(minProfitAmount);
        finalParamsBytes = new ethers.AbiCoder().encode(
          strategyParams.paramTypes,
          strategyParams.paramValues
        );
        logger.info(`[flash_loans] Encoded minProfitAmount into strategyParams: ${minProfitAmount.toString()}`);
      } else if (typeof paramsBytes === 'string' && paramsBytes !== '0x') {
        // For hex params, append minProfitAmount as encoded uint256
        // Format: existing_params + abi.encode(minProfitAmount)
        const minProfitEncoded = new ethers.AbiCoder().encode(['uint256'], [minProfitAmount]);
        finalParamsBytes = paramsBytes + minProfitEncoded.slice(2); // Remove 0x from encoded part
        logger.info(`[flash_loans] Appended minProfitAmount to hex params: ${finalParamsBytes}`);
      } else {
        // No existing params, use minProfitAmount as sole param
        finalParamsBytes = new ethers.AbiCoder().encode(['uint256'], [minProfitAmount]);
        logger.info(`[flash_loans] Created params with minProfitAmount only: ${finalParamsBytes}`);
      }
    } catch (encodeErr) {
      logger.warn('[flash_loans] Failed to encode minProfitAmount, continuing with original params', encodeErr instanceof Error ? { error: encodeErr.message } : { error: String(encodeErr) });
      // Continue with original params if encoding fails
    }
    
    if (ENABLE_PROFIT_LOGGING) {
      logger.info(`[flash_loans] Final params with minProfit=${minProfitAmount.toString()}: ${finalParamsBytes}`);
    }
    
    // Use finalParamsBytes for execution
    paramsBytes = finalParamsBytes;

    // Pre-flight simulation via staticCall: catches a revert (e.g. the
    // strategy would fail InsufficientProfit / ExcessiveLoss on-chain)
    // before paying real gas for a doomed transaction.
    try {
      await executor.executeFlashLoan.staticCall(asset, amount, strategy, paramsBytes, { gasLimit: 1_500_000 });
    } catch (simErr) {
      const reason = simErr instanceof Error ? simErr.message : String(simErr);
      return res.status(400).json({ 
        error: 'Simulation failed — transaction would revert on-chain', 
        detail: reason,
        premiumDrift: premiumStatus?.isDrift ? {
          live: premiumStatus.liveBps,
          expected: premiumStatus.expectedBps,
          tolerance: premiumStatus.toleranceBps,
          message: 'Premium drift may be the cause; check premium monitor dashboard'
        } : undefined
      });
    }

    console.log('Submitting executeFlashLoan tx', {
      FLASH_EXECUTOR_ADDRESS,
      asset,
      amount: amount.toString(),
      strategy,
      paramsBytesLength: paramsBytes.length,
      minProfitAmount: minProfitAmount?.toString(),
    });

    const { txHash, receipt } = await enqueueSubmission(async () => {
      const tx = await executor.executeFlashLoan(asset, amount, strategy, paramsBytes, { gasLimit: 1_500_000 });
      const r = await tx.wait(2); // Wait for 2 confirmations
      if (!r) {
        throw new Error('Transaction receipt not available after waiting');
      }
      return { txHash: tx.hash as string, receipt: r };
    });

    // FIX: ethers v6 receipts contain bigint fields (gasUsed,
    // cumulativeGasUsed, etc.) — JSON.stringify throws on bigint without
    // a replacer. Verified this crashes the success path unguarded.
    const serializedReceipt = JSON.parse(
      JSON.stringify(receipt, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))
    );

    res.json({ txHash, receipt: serializedReceipt });
  } catch (error) {
    console.error('Error executing flash loan:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;