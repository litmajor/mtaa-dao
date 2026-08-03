/**
 * DAOSpawnService
 *
 * Orchestrates the Phase-1 DAO creation flow:
 *
 *  M-Pesa STK push (KES)
 *    → webhook confirms payment
 *      → platform wallet calls DAOSpawnGateway.paySpawnFee() on-chain
 *        → spawn credit recorded for founderWallet
 *          → daoDeployHandler() fires → MaonoVaultFactory.deployVault()
 *            → consumeSpawnCredit() consumed inside factory
 *              → MTAA founding reward distributed to DAO treasury
 *
 * Phase 3 (when MTAA has an oracle price):
 *   Swap to direct MTAA payment from user wallet — the KES→MTAA conversion
 *   will use AgentPaymentGateway.getDiscountedPrice() with a 25% token discount.
 */

import { ethers } from 'ethers';
import { db } from '../db';
import { paymentTransactions, daos } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { createWalletIfValid } from '../utils/cryptoWallet';
import { ExchangeRateService } from './exchangeRateService';
import { daoDeployHandler } from '../api/dao_deploy';
import type { DaoDeployRequest } from '../api/dao_deploy';
import { resolveProviderUrls } from './providerBootstrap';
import { ResilientRpcProvider } from './resilientRpcProvider';

const logger = new Logger('dao-spawn-service');

// ── Phase-1 spawn fees in KES ────────────────────────────────────────────────
// These are the canonical KES prices displayed to the user.
// The platform pays the equivalent MTAA from its pre-funded wallet.
// Phase 3: replace with oracle-driven `1000 KES / mtaaPrice * 0.75` formula.
export const SPAWN_FEE_KES: Record<string, number> = {
  harambee:     500,
  shortTerm:    800,
  savings:      1000,
  merryGoRound: 1200,
  community:    2000,
  investment:   3000,
};

// Vault type index matching DAOSpawnGateway.SPAWN_COSTS[] array
const DAO_TYPE_TO_VAULT_INDEX: Record<string, number> = {
  savings:      0,  // SAVINGS
  harambee:     0,  // SAVINGS (cheapest tier)
  shortTerm:    1,  // ESCROW
  merryGoRound: 1,  // ESCROW
  business:     2,  // BUSINESS
  community:    2,  // BUSINESS
  investment:   3,  // INVESTING
  custom:       4,  // CUSTOM
};

// ── Contract ABIs ─────────────────────────────────────────────────────────────
const DAO_SPAWN_GATEWAY_ABI = [
  'function paySpawnFee(uint256 vaultType) external',
  'function paySpawnFeeFor(address beneficiary, uint256 vaultType) external',
  'function spawnCredits(address user, uint256 vaultType) view returns (uint256)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

const MTAA_REWARDS_MANAGER_ABI = [
  'function distribute(address recipient, uint256 amount) external',
];

// MTAA reward granted to the DAO treasury on successful creation
const DAO_FOUNDING_REWARD_MTAA: Record<string, bigint> = {
  harambee:     ethers.parseUnits('25', 18),
  shortTerm:    ethers.parseUnits('40', 18),
  savings:      ethers.parseUnits('50', 18),
  merryGoRound: ethers.parseUnits('60', 18),
  community:    ethers.parseUnits('100', 18),
  investment:   ethers.parseUnits('150', 18),
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return the KES spawn fee for a DAO type, plus an estimated cUSD equivalent
 * for informational display.
 */
export async function getSpawnFeeQuote(daoType: string): Promise<{
  kes: number;
  cusdEstimate: number;
  rate: number;
}> {
  const kes = SPAWN_FEE_KES[daoType] ?? SPAWN_FEE_KES.savings;
  let rate: number;
  let cusdEstimate: number;

  try {
    rate = await ExchangeRateService.getUSDtoKESRate();
    cusdEstimate = Math.round((kes / rate) * 1e4) / 1e4;
  } catch {
    // Rate unavailable — return KES only, cUSD TBD
    rate = 0;
    cusdEstimate = 0;
  }

  return { kes, cusdEstimate, rate };
}

/**
 * Called by the M-Pesa webhook after payment is confirmed.
 * Reads `pendingDaoData` from the transaction metadata and kicks off
 * the on-chain spawn + DAO database creation.
 *
 * This is intentionally fire-and-forget from the webhook — errors are
 * logged and the transaction marked `spawn_failed` rather than re-trying
 * synchronously (to keep the webhook ACK fast).
 */
import { commandBus } from '../domain/setup';
import { PaymentCommandTypes } from '../domain/payments/PaymentCommands';
import crypto from 'crypto';

export async function triggerDAOSpawnFromPayment(txReference: string): Promise<void> {
  logger.info(`[DAOSpawn] Triggered for tx: ${txReference}`);

  // 1. Load the transaction and extract stored DAO data
  const [txRecord] = await db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.reference, txReference))
    .limit(1);

  if (!txRecord) {
    logger.error(`[DAOSpawn] Transaction not found: ${txReference}`);
    return;
  }

  const meta = txRecord.metadata as any;
  if (meta?.spawnStatus === 'completed') {
    logger.info(`[DAOSpawn] Already processed — skipping: ${txReference}`);
    return;
  }

  const { pendingDaoData, founderWallet, daoType } = meta ?? {};
  if (!pendingDaoData || !founderWallet || !daoType) {
    logger.error(`[DAOSpawn] Missing pendingDaoData in metadata for tx: ${txReference}`);
    return;
  }

  try {
    // 2. Mark spawn as in-progress via CommandBus
    await commandBus.dispatch({
      id: crypto.randomUUID(),
      type: PaymentCommandTypes.UpdatePaymentMetadata,
      actor: 'system',
      correlationId: crypto.randomUUID(),
      timestamp: new Date(),
      payload: {
        reference: txReference,
        metadata: { spawnStatus: 'processing' }
      }
    });

    // 3. Call DAOSpawnGateway.paySpawnFee() from platform wallet
    const vaultIndex = DAO_TYPE_TO_VAULT_INDEX[daoType] ?? 0;
    const spawnTx = await callPaySpawnFee(founderWallet, vaultIndex, daoType);
    logger.info(`[DAOSpawn] paySpawnFee tx: ${spawnTx}`);

    // 4. Synthesize a pseudo-request object and call the DAO deploy handler
    const daoResult = await deployDAOInternal(pendingDaoData);
    const daoId = daoResult?.daoId;
    logger.info(`[DAOSpawn] DAO deployed: ${daoId}`);

    // 5. Distribute founding MTAA reward to DAO treasury
    if (daoId) {
      await distributeFoundingReward(founderWallet, daoType);
    }

    // 6. Mark spawn complete
    await commandBus.dispatch({
      id: crypto.randomUUID(),
      type: PaymentCommandTypes.UpdatePaymentMetadata,
      actor: 'system',
      correlationId: crypto.randomUUID(),
      timestamp: new Date(),
      payload: {
        reference: txReference,
        metadata: { spawnStatus: 'completed', daoId, spawnTx }
      }
    });

    logger.info(`[DAOSpawn] Completed for tx: ${txReference} — daoId: ${daoId}`);
  } catch (err: any) {
    logger.error(`[DAOSpawn] Spawn failed for tx: ${txReference}`, err);
    await commandBus.dispatch({
      id: crypto.randomUUID(),
      type: PaymentCommandTypes.UpdatePaymentMetadata,
      actor: 'system',
      correlationId: crypto.randomUUID(),
      timestamp: new Date(),
      payload: {
        reference: txReference,
        metadata: { spawnStatus: 'spawn_failed', spawnError: err.message }
      }
    });
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function getPlatformWallet() {
  const providerUrls = resolveProviderUrls();
  const rpcUrl = providerUrls.rpcUrl;
  const pk = process.env.PLATFORM_PRIVATE_KEY;
  if (!rpcUrl || !pk) throw new Error('PLATFORM_PRIVATE_KEY or CELO_RPC_URL not configured');

  const resilientProvider = new ResilientRpcProvider({
    primary: { name: 'primary-rpc', httpUrl: rpcUrl },
    fallback: providerUrls.fallbackRpcUrl ? { name: 'fallback-rpc', httpUrl: providerUrls.fallbackRpcUrl } : undefined,
    cooldownMs: 60_000,
    onFailover: (from, to, reason) => logger.warn(`DAO spawn RPC failover ${from} -> ${to}: ${reason}`),
  });
  const provider = resilientProvider.getRawProvider();
  const wallet = createWalletIfValid(pk, provider);
  if (!wallet) throw new Error('Invalid PLATFORM_PRIVATE_KEY');
  return { wallet, provider, resilientProvider };
}

/**
 * Platform wallet approves MTAA for the gateway, then calls paySpawnFee().
 * The platform wallet must hold enough MTAA (pre-funded before go-live).
 */
async function callPaySpawnFee(
  founderWallet: string,
  vaultIndex: number,
  daoType: string
): Promise<string> {
  const gatewayAddr = process.env.DAO_SPAWN_GATEWAY_ADDRESS;
  const mtaaAddr = process.env.MTAA_TOKEN_ADDRESS;
  if (!gatewayAddr || !mtaaAddr) {
    throw new Error('DAO_SPAWN_GATEWAY_ADDRESS or MTAA_TOKEN_ADDRESS not configured');
  }

  const { wallet, resilientProvider } = await getPlatformWallet();

  const credits = await resilientProvider.call((provider) =>
    new ethers.Contract(gatewayAddr, DAO_SPAWN_GATEWAY_ABI, provider).spawnCredits(founderWallet, vaultIndex)
  );

  if (credits > 0n) {
    logger.info(`[DAOSpawn] Spawn credit already exists for ${founderWallet} type=${vaultIndex}`);
    return 'already_credited';
  }

  // Ensure sufficient allowance
  const SPAWN_COSTS: Record<number, bigint> = {
    0: ethers.parseUnits('150', 18),
    1: ethers.parseUnits('250', 18),
    2: ethers.parseUnits('400', 18),
    3: ethers.parseUnits('600', 18),
    4: ethers.parseUnits('1000', 18),
  };
  const cost = SPAWN_COSTS[vaultIndex] ?? SPAWN_COSTS[0];

  const allowance = await resilientProvider.call((provider) =>
    new ethers.Contract(mtaaAddr, ERC20_ABI, provider).allowance(wallet.address, gatewayAddr)
  );
  if (allowance < cost) {
    const approveTx = await resilientProvider.callWithSigner(wallet, (signer) =>
      new ethers.Contract(mtaaAddr, ERC20_ABI, signer).approve(gatewayAddr, cost * 2n)
    );
    await resilientProvider.call((provider) => provider.waitForTransaction(approveTx.hash));
    logger.info(`[DAOSpawn] MTAA approved for gateway`);
  }

  // paySpawnFeeFor credits the founderWallet, paid by the platform wallet.
  // Platform wallet must hold sufficient MTAA (pre-funded before go-live).
  const tx = await resilientProvider.callWithSigner(wallet, (signer) =>
    new ethers.Contract(gatewayAddr, DAO_SPAWN_GATEWAY_ABI, signer).paySpawnFeeFor(founderWallet, vaultIndex)
  );
  const receipt = await resilientProvider.call((provider) => provider.waitForTransaction(tx.hash));
  if (!receipt) throw new Error('DAO spawn fee transaction was not mined before timeout');
  return receipt.hash;
}

/**
 * Internally invoke the DAO deploy handler using stored pending data.
 */
async function deployDAOInternal(pendingDaoData: DaoDeployRequest): Promise<{ daoId: string }> {
  return new Promise((resolve, reject) => {
    // Synthetic Express-like request/response pair
    const req: any = {
      body: pendingDaoData,
      user: { id: pendingDaoData.founderWallet },
    };
    const res: any = {
      status(code: number) {
        return {
          json(body: any) {
            if (code >= 200 && code < 300) {
              resolve({ daoId: body.daoId });
            } else {
              reject(new Error(body?.error || body?.message || `DAO deploy returned ${code}`));
            }
          },
        };
      },
      json(body: any) {
        if (body?.daoId) resolve({ daoId: body.daoId });
        else reject(new Error(body?.error || 'Unknown DAO deploy error'));
      },
    };

    daoDeployHandler(req, res).catch(reject);
  });
}

/**
 * Distribute a one-time MTAA founding reward to the founderWallet.
 * Uses MTAARewardsManager.distribute() — the rewards manager must have
 * sufficient MTAA balance (pre-funded by platform).
 */
async function distributeFoundingReward(founderWallet: string, daoType: string): Promise<void> {
  const rewardsManagerAddr = process.env.MTAA_REWARDS_MANAGER_ADDRESS;
  if (!rewardsManagerAddr) {
    logger.warn('[DAOSpawn] MTAA_REWARDS_MANAGER_ADDRESS not set — skipping founding reward');
    return;
  }

  try {
    const { wallet, resilientProvider } = await getPlatformWallet();
    const rewardWei = DAO_FOUNDING_REWARD_MTAA[daoType] ?? DAO_FOUNDING_REWARD_MTAA.savings;

    const tx = await resilientProvider.callWithSigner(wallet, (signer) =>
      new ethers.Contract(rewardsManagerAddr, MTAA_REWARDS_MANAGER_ABI, signer).distribute(founderWallet, rewardWei)
    );
    await resilientProvider.call((provider) => provider.waitForTransaction(tx.hash));

    logger.info(
      `[DAOSpawn] Founding MTAA reward distributed: ${ethers.formatUnits(rewardWei, 18)} MTAA → ${founderWallet}`
    );
  } catch (err: any) {
    // Non-blocking — don't fail the DAO creation if reward fails
    logger.warn('[DAOSpawn] Founding reward distribution failed:', err.message);
  }
}
