import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { db } from '../db';
import { daos, daoRotationCycles } from '../../shared/schema';
import { and, eq, inArray, or } from 'drizzle-orm';
import { resolveProviderUrls } from './providerBootstrap';
import { ResilientRpcProvider } from './resilientRpcProvider';
import {
  getRotationConfigOnChain,
  getStablecoinDecimals,
  getStablecoinSymbol,
  verifyStablecoinTransfer,
} from './rotation_contract';
import { stableOutflowModule } from './stableOutflowModule';

const providerUrls = resolveProviderUrls();
const RPC_URL = providerUrls.rpcUrl;
const ROTATION_MODULE_ADDRESS = process.env.ROTATION_MODULE_ADDRESS || '';

function loadAbi() {
  const abiPath = path.resolve(__dirname, '..', '..', 'artifacts', 'contracts', 'RotationModule.sol', 'RotationModule.json');
  const json = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  return json.abi;
}

export function startRotationEventListener() {
  if (!ROTATION_MODULE_ADDRESS) {
    console.warn('ROTATION_MODULE_ADDRESS not configured — rotation listener not started');
    return;
  }

  const resilientProvider = new ResilientRpcProvider({
    primary: { name: 'primary-rpc', httpUrl: RPC_URL },
    fallback: providerUrls.fallbackRpcUrl ? { name: 'fallback-rpc', httpUrl: providerUrls.fallbackRpcUrl } : undefined,
    cooldownMs: 60_000,
  });
  const provider = resilientProvider.getRawProvider();
  const abi = loadAbi();
  const contract = new ethers.Contract(ROTATION_MODULE_ADDRESS, abi, provider);

  contract.on(
    'CycleDistributionConfirmed',
    async (vaultAddress: string, cycleNumber: bigint, recipient: string, amount: bigint, proposalId: bigint, event: any) => {
    try {
      const [dao] = await db.select().from(daos).where(or(
        eq(daos.vaultAddress, vaultAddress),
        eq(daos.chamaTreasuryAddress, vaultAddress),
        eq(daos.maonoVaultAddress, vaultAddress),
      )).limit(1);
      if (!dao) return;
      const rotationConfig = await getRotationConfigOnChain(vaultAddress);
      const [stablecoinDecimals, stablecoinSymbol] = await Promise.all([
        getStablecoinDecimals(String(rotationConfig.stablecoin)),
        getStablecoinSymbol(String(rotationConfig.stablecoin)),
      ]);
      const [cycle] = await db.select().from(daoRotationCycles).where(and(
        eq(daoRotationCycles.daoId, dao.id),
        eq(daoRotationCycles.cycleNumber, Number(cycleNumber)),
        inArray(daoRotationCycles.status, ['pending', 'pending_on_chain_confirmation'])
      )).limit(1);
      if (!cycle) return;

      const distributedAt = new Date();
      const transactionHash = event?.log?.transactionHash || event?.transactionHash;
      let settledTransfer: Awaited<ReturnType<typeof verifyStablecoinTransfer>> | undefined;
      if (transactionHash) {
        try {
          settledTransfer = await verifyStablecoinTransfer({
            transactionHash,
            stablecoin: String(rotationConfig.stablecoin),
            sender: vaultAddress,
            recipient,
            notBeforeTimestamp: 0,
          });
        } catch (error) {
          console.error(`Unable to verify the executed stablecoin transfer for rotation cycle ${cycle.id}:`, error);
        }
      }
      const settledAmount = settledTransfer?.amount ?? BigInt(amount);
      await db.transaction(async (tx) => {
        await tx.update(daoRotationCycles).set({
          status: 'completed',
          amountDistributed: ethers.formatUnits(settledAmount, stablecoinDecimals),
          transactionHash,
          distributedAt,
          notes: `${cycle.notes || ''}\nTreasury proposal ${proposalId} executed to ${recipient} in ${stablecoinSymbol}.`.trim(),
          updatedAt: distributedAt,
        }).where(eq(daoRotationCycles.id, cycle.id));

        await tx.update(daos).set({
          currentRotationCycle: Number(cycleNumber),
          nextRotationDate: getNextRotationDate(distributedAt, dao.rotationFrequency || 'monthly'),
          updatedAt: distributedAt,
        }).where(eq(daos.id, dao.id));
      });

      if (stableOutflowModule.isEnabled()) {
        if (!transactionHash || !settledTransfer) {
          console.error(`Rotation cycle ${cycle.id} has no verified stablecoin transfer; stable outflow was not recorded`);
          return;
        }
        try {
          const stablecoinAddress = String(rotationConfig.stablecoin);
          const outflow = await stableOutflowModule.processStableOutflow({
            source: 'dao_rotation_payout',
            chain: 'celo',
            chainId: settledTransfer.chainId,
            txHash: transactionHash,
            logIndex: settledTransfer.logIndex,
            tokenAddress: stablecoinAddress,
            tokenSymbol: stablecoinSymbol,
            decimals: stablecoinDecimals,
            rawAmount: settledTransfer.amount.toString(),
            fromAddress: vaultAddress,
            toAddress: recipient,
            blockTimestamp: settledTransfer.blockTimestamp,
            confirmations: settledTransfer.confirmations,
            provider: 'rotation_module',
            internalReference: cycle.id,
            metadata: {
              daoId: dao.id,
              cycleNumber: Number(cycleNumber),
              proposalId: String(proposalId),
            },
          });
          if (!outflow.success || !outflow.stableOutflowEventId) {
            console.error(`Unable to record stable outflow for rotation cycle ${cycle.id}: ${outflow.error || 'no event id returned'}`);
          } else {
            const riskFlags = outflow.riskFlags;
            const hasRiskFlags = Boolean(
              riskFlags?.depegDetected ||
              riskFlags?.delayedConfirmation ||
              riskFlags?.lowLiquidity ||
              riskFlags?.highRiskScore
            );
            if (outflow.confirmationState === 'confirmed' && !hasRiskFlags) {
              await stableOutflowModule.markConfirmed(
                outflow.stableOutflowEventId,
                settledTransfer.confirmations,
                transactionHash
              );
            }
            await db.update(daoRotationCycles).set({
              notes: `${cycle.notes || ''}\nTreasury proposal ${proposalId} executed to ${recipient} in ${stablecoinSymbol}.\nStable outflow event ${outflow.stableOutflowEventId} recorded.`.trim(),
              updatedAt: new Date(),
            }).where(eq(daoRotationCycles.id, cycle.id));
          }
        } catch (error) {
          console.error(`Unable to reconcile stable outflow for rotation cycle ${cycle.id}:`, error);
        }
      }
      console.info(`Reconciled on-chain rotation confirmation for DAO ${dao.id}, cycle ${cycleNumber}`);
    } catch (err) {
      console.error('Error handling CycleDistributionConfirmed event', err);
    }
  });

}

function getNextRotationDate(from: Date, frequency: string): Date {
  const next = new Date(from);
  switch (frequency.toLowerCase()) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'bi-weekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'monthly':
    default:
      next.setMonth(next.getMonth() + 1);
  }
  return next;
}
