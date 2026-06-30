import { db } from '../db';
import { referralPayouts } from '../../shared/financialEnhancedSchema';
import { eq } from 'drizzle-orm';
import { ethers } from 'ethers';
import { createWalletIfValid } from '../utils/cryptoWallet';

// Minimal ABI entry for distributeReward; extend to real ABI as needed
const REWARDS_MANAGER_ABI = [
  // Example: function distributeReward(bytes32 requestId, address to, uint256 amount)
  'function distributeReward(bytes32, address, uint256) returns (bytes)'
];

const BATCH_SIZE = Number(process.env.PAYOUT_BATCH_SIZE || 5);

async function processPendingPayouts() {
  const pending = await db.select().from(referralPayouts).where(eq(referralPayouts.status, 'pending')).limit(BATCH_SIZE);

  for (const payout of pending) {
    try {
      // Mark processing (optimistic locking)
      await db.update(referralPayouts).set({ status: 'processing' }).where(eq(referralPayouts.id, payout.id));

      const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
      const wallet = createWalletIfValid(process.env.PRIVATE_KEY || '', provider);
      if (!wallet) {
        // Mark this payout as failed due to configuration issue and continue
        await db.update(referralPayouts).set({ status: 'failed', lastError: 'Missing or invalid PRIVATE_KEY for payouts', retryCount: (payout.retryCount || 0) + 1 }).where(eq(referralPayouts.id, payout.id));
        continue;
      }
      const contract = new ethers.Contract(process.env.MTAA_CONTRACT_ADDR || '', REWARDS_MANAGER_ABI, wallet);

      // Gas / fee management
      const feeData = await provider.getFeeData();
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

      const tx = await contract.distributeReward(requestId, to, amount, overrides);

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
