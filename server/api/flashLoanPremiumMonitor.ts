/**
 * Flash Loan Premium Drift Monitor
 *
 * Periodically compares the live Aave flash-loan premium against the
 * hardcoded constant used in on-chain flash loan execution. If they drift
 * beyond the contract's tolerance band, logs an alert and notifies
 * monitoring systems.
 *
 * Background:
 * - On-chain contracts encode a hardcoded `EXPECTED_PREMIUM_BPS` for safety
 *   (prevents an old contract bytecode from accepting a radically different
 *   premium than it was written for).
 * - If Aave updates their premium and it exceeds the tolerance band, all
 *   flash loan executions fail with PremiumMismatch, silently (availability
 *   risk, not fund safety — staticCall pre-flight catches it before real
 *   submission).
 * - This monitor catches the drift early from a dashboard instead of from
 *   wall-of-failed-requests, so you can update the contract or adjust strategy.
 *
 * Tolerance Band:
 * Contract allows premium to drift by up to TOLERANCE_BPS from EXPECTED_PREMIUM_BPS.
 * This monitor alerts if abs(live - expected) > TOLERANCE_BPS.
 */

import { getFlashLoanPremiumBps } from './aaveDataService';
import { logger } from '../utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// ON-CHAIN CONSTANT (must match FlashLoanExecutor.sol)
// ─────────────────────────────────────────────────────────────────────────────
export const EXPECTED_PREMIUM_BPS = 5; // Aave's premium on 2026-08-14

// Tolerance band: contract allows premium to vary within ±this many bps
// before rejecting the transaction. If live premium drifts beyond this,
// all flash loan executions will fail with PremiumMismatch.
export const PREMIUM_TOLERANCE_BPS = 3; // ±3 bps tolerance

// ─────────────────────────────────────────────────────────────────────────────
// MONITORING
// ─────────────────────────────────────────────────────────────────────────────

export interface PremiumStatus {
  chain: string;
  expectedBps: number;
  liveBps: number | null;
  drift: number | null;
  toleranceBps: number;
  isDrift: boolean;
  lastCheckTime: number;
  lastAlertTime: number | null;
}

const statusMap = new Map<string, PremiumStatus>();

export function getStatus(chain: string): PremiumStatus {
  if (!statusMap.has(chain)) {
    statusMap.set(chain, {
      chain,
      expectedBps: EXPECTED_PREMIUM_BPS,
      liveBps: null,
      drift: null,
      toleranceBps: PREMIUM_TOLERANCE_BPS,
      isDrift: false,
      lastCheckTime: 0,
      lastAlertTime: null,
    });
  }
  return statusMap.get(chain)!;
}

async function checkPremiumDrift(chain: string): Promise<void> {
  const status = getStatus(chain);
  
  try {
    const liveBps = await getFlashLoanPremiumBps(chain);
    
    if (liveBps === null) {
      // Cache not yet warm — skip check
      logger.debug(`[flashLoanPremiumMonitor] ${chain}: cache not yet warm, skipping check`);
      status.lastCheckTime = Date.now();
      return;
    }

    const drift = Math.abs(liveBps - status.expectedBps);
    const isDrift = drift > status.toleranceBps;

    status.liveBps = liveBps;
    status.drift = drift;
    status.isDrift = isDrift;
    status.lastCheckTime = Date.now();

    if (isDrift) {
      const message = `[flashLoanPremiumMonitor] ⚠️  Premium drift detected on ${chain}: live=${liveBps}bps, expected=${status.expectedBps}bps, drift=${drift}bps (tolerance=${status.toleranceBps}bps). All flash loan executions will fail with PremiumMismatch until contract is updated.`;
      logger.warn(message);

      // Record alert time (for rate-limiting duplicate alerts)
      if (status.lastAlertTime === null) {
        status.lastAlertTime = Date.now();
        // TODO: Emit to your monitoring system (Datadog, PagerDuty, Slack, etc.)
        // Example: await sendAlert({ severity: 'high', message, chain });
      }
    } else {
      // Drift has cleared
      if (status.lastAlertTime !== null) {
        logger.info(`[flashLoanPremiumMonitor] ✅ Premium drift resolved on ${chain}: live=${liveBps}bps, expected=${status.expectedBps}bps`);
        status.lastAlertTime = null;
      }
    }
  } catch (err) {
    logger.error(`[flashLoanPremiumMonitor] Error checking premium for ${chain}:`, err);
  }
}

let monitorRunning = false;
let monitorInterval: NodeJS.Timeout | null = null;

/**
 * Start background premium drift monitoring
 * Runs a check every CHECK_INTERVAL_MS
 */
export async function startPremiumMonitor(checkIntervalMs: number = 60_000): Promise<void> {
  if (monitorRunning) return;
  monitorRunning = true;

  logger.info(`[flashLoanPremiumMonitor] Starting premium drift monitor (check interval=${checkIntervalMs}ms)`);

  // Run check immediately
  await Promise.all(['ethereum', 'polygon', 'arbitrum'].map((chain) => checkPremiumDrift(chain)));

  // Schedule periodic checks
  monitorInterval = setInterval(async () => {
    await Promise.all(['ethereum', 'polygon', 'arbitrum'].map((chain) => checkPremiumDrift(chain)));
  }, checkIntervalMs);
}

/**
 * Stop background monitoring
 */
export function stopPremiumMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  monitorRunning = false;
  logger.info(`[flashLoanPremiumMonitor] Stopped premium drift monitor`);
}

/**
 * Manual check (for testing or on-demand monitoring)
 */
export async function checkPremiumNow(chain: string): Promise<PremiumStatus> {
  await checkPremiumDrift(chain);
  return getStatus(chain);
}
