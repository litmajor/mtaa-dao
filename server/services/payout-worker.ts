import { db } from '../db';
import { referralPayouts } from '../../shared/financialEnhancedSchema';
import { eq } from 'drizzle-orm';
import { ethers } from 'ethers';
import { createWalletIfValid } from '../utils/cryptoWallet';
import { resolveProviderUrls } from './providerBootstrap';
import { ResilientRpcProvider } from './resilientRpcProvider';

// Minimal ABI entry for distributeReward; extend to real ABI as needed
const REWARDS_MANAGER_ABI = [
  // Example: function distributeReward(bytes32 requestId, address to, uint256 amount)
  'function distributeReward(bytes32, address, uint256) returns (bytes)'
];

const BATCH_SIZE = Number(process.env.PAYOUT_BATCH_SIZE || 5);

export interface PayoutWorkerDependencies {
  createProvider?: (url: string) => ethers.JsonRpcProvider;
  createWallet?: (privateKey: string, provider: ethers.Provider) => ethers.Wallet | undefined;
  createContract?: (address: string, abi: string[], signer: ethers.Signer) => any;
}

function buildResilientProvider(providerUrls: ReturnType<typeof resolveProviderUrls>, createProvider?: (url: string) => ethers.JsonRpcProvider) {
  return new ResilientRpcProvider({
    primary: { name: 'primary-rpc', httpUrl: providerUrls.rpcUrl },
    fallback: providerUrls.fallbackRpcUrl ? { name: 'fallback-rpc', httpUrl: providerUrls.fallbackRpcUrl } : undefined,
    cooldownMs: 60_000,
    onFailover: (from, to, reason) => console.warn(`[RPC] Payout worker failover ${from} -> ${to}: ${reason}`),
    onRecover: (providerName) => console.info(`[RPC] Payout worker recovered to ${providerName}`),
    createProvider,
  });
}

export async function processPendingPayouts(dependencies?: PayoutWorkerDependencies) {
  const pending = await db.select().from(referralPayouts).where(eq(referralPayouts.status, 'pending')).limit(BATCH_SIZE);

  for (const payout of pending) {
    try {
      // Mark processing (optimistic locking)
      await db.update(referralPayouts).set({ status: 'processing' }).where(eq(referralPayouts.id, payout.id));

      const providerUrls = resolveProviderUrls();
      const resilientProvider = buildResilientProvider(providerUrls, dependencies?.createProvider);

      const feeData = await resilientProvider.call(async (provider) => provider.getFeeData());
      const overrides: any = {};
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        overrides.maxFeePerGas = feeData.maxFeePerGas;
        overrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
      }

      // Build args. If a requestId exists, pass it to contract for idempotency (contract must support it)
      const requestId = payout.requestId ? ethers.hexlify(payout.requestId as any) : ethers.hexlify(ethers.randomBytes(32));
      const to = payout.destinationAddress;
      // Convert amount to wei-like integer based on currency conventions. Here assume amount is already smallest unit.
      const amount = ethers.parseUnits(String(payout.amount), 18);

      const tx = await resilientProvider.call(async (provider) => {
        const wallet = dependencies?.createWallet
          ? dependencies.createWallet(process.env.PRIVATE_KEY || '', provider)
          : createWalletIfValid(process.env.PRIVATE_KEY || '', provider);
        if (!wallet) {
          throw new Error('Missing or invalid PRIVATE_KEY for payouts');
        }
        const contract = dependencies?.createContract
          ? dependencies.createContract(process.env.MTAA_CONTRACT_ADDR || '', REWARDS_MANAGER_ABI, wallet as ethers.Signer)
          : new ethers.Contract(process.env.MTAA_CONTRACT_ADDR || '', REWARDS_MANAGER_ABI, wallet);
        return contract.distributeReward(requestId, to, amount, overrides);
      });

      // Update with hash and mark completed after send (or consider waiting for confirmations)
      await db.update(referralPayouts).set({ status: 'completed', transactionHash: tx.hash }).where(eq(referralPayouts.id, payout.id));

    } catch (err: any) {
      const lastError = err?.message || String(err);
      // Persist error and mark failed; do not retry indefinitely
      await db.update(referralPayouts).set({ status: 'failed', lastError, retryCount: (payout.retryCount || 0) + 1 }).where(eq(referralPayouts.id, payout.id));

      // Emit alert/logging for admin action (placeholder)
      console.error('Payout failed for', payout.id, lastError);
    }
  }
}

let running = false;

export async function startPayoutWorker(intervalMs = 30_000) {
  if (running) return;
  running = true;
  console.log('Starting payout worker, batch size', BATCH_SIZE);
  // Run immediately then on interval
  await processPendingPayouts();
  setInterval(() => processPendingPayouts().catch(err => console.error('Payout worker error', err)), intervalMs);
}

export async function stopPayoutWorker() {
  running = false;
}

export default { startPayoutWorker, stopPayoutWorker };
