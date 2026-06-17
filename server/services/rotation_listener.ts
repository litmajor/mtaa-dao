import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { db } from '../db';
import { daos, daoRotationCycles } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';

const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
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

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const abi = loadAbi();
  const contract = new ethers.Contract(ROTATION_MODULE_ADDRESS, abi, provider);

  contract.on('CycleDistributed', async (daoId: string, recipient: string, amount: any, event: any) => {
    try {
      // Mark the most recent pending cycle for daoId as completed
      const dao = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1).then(r => r[0]);
      if (!dao) return;
      // Find pending cycle
      const pending = await db.select().from(daoRotationCycles).where(eq(daoRotationCycles.daoId, daoId)).orderBy(desc(daoRotationCycles.createdAt)).limit(1).then(r => r[0]);
      if (!pending) return;

      await db.update(daoRotationCycles).set({ status: 'completed', transactionHash: event.transactionHash, distributedAt: new Date(), updatedAt: new Date() }).where(eq(daoRotationCycles.id, pending.id));
      console.info(`Reconciled on-chain CycleDistributed for DAO ${daoId}, cycle ${pending.cycleNumber}`);
    } catch (err) {
      console.error('Error handling CycleDistributed event', err);
    }
  });

  contract.on('CycleDistributionConfirmed', (daoId: string, cycleNumber: number, event: any) => {
    console.info('CycleDistributionConfirmed', daoId, cycleNumber);
  });
}
