import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { db } from '../db';
import { daos, daoRotationCycles } from '../../shared/schema';
import { and, eq, inArray, or } from 'drizzle-orm';
import { resolveProviderUrls } from './providerBootstrap';
import { ResilientRpcProvider } from './resilientRpcProvider';
import { getRotationConfigOnChain, getStablecoinDecimals, getStablecoinSymbol } from './rotation_contract';

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
      await db.transaction(async (tx) => {
        await tx.update(daoRotationCycles).set({
          status: 'completed',
          amountDistributed: ethers.formatUnits(amount, stablecoinDecimals),
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
