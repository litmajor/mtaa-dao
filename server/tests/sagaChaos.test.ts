// Allow injecting database URL via CLI `--dbUrl=` or env vars `DB_URL` / `NEON_DB_URL`
import 'dotenv/config';
const cliArg = process.argv.find(a => a.startsWith('--dbUrl='));
const provided = cliArg ? cliArg.split('=')[1] : (process.env.DB_URL || process.env.NEON_DB_URL);
if (provided) {
  process.env.DATABASE_URL = provided;
  const masked = provided.replace(/(:\/\/).*@/, '$1***@');
  console.log(`[sagaChaos.test] Using DATABASE_URL=${masked}`);
} else if (!process.env.DATABASE_URL) {
  console.warn('[sagaChaos.test] No DATABASE_URL configured. The test will attempt to run but DB operations may fail.');
}

import { PaymentRecoverySAGAOrchestrator, type PaymentTransaction } from '../services/PaymentRecoverySAGAOrchestrator.ts';

async function runChaosTest() {
  console.log('🚀 Starting Payment Recovery Saga Chaos Integration Test...');
  
  // 1. Instantiating isolated testing orchestrator
  const testOrchestrator = new PaymentRecoverySAGAOrchestrator();

  // Mocking underlying microservice execution functions to watch call tracking
  const executionTracking: string[] = [];

  // Intercepting core methods via prototype manipulation for testing verification
  (testOrchestrator as any).reserveFunds = async (tx: any, key: string) => {
    executionTracking.push('RESERVE_FUNDS_EXECUTED');
    return { reservationId: 'mock-res-id', idempotencyKey: key };
  };

  (testOrchestrator as any).updateWallet = async (tx: any, key: string) => {
    executionTracking.push('UPDATE_WALLET_EXECUTED');
    return { transactionId: 'mock-tx-id', idempotencyKey: key };
  };

  // 🔥 CHAOS INJECTION POINT: Simulate network collapse or RPC timeout right at the Celo border
  (testOrchestrator as any).recordBlockchain = async (tx: any, sagaId: string) => {
    executionTracking.push('RECORD_BLOCKCHAIN_ATTEMPTED');
    throw new Error('RPC_NODE_TIMEOUT: Celo block congestion, transaction dropped from mempool.');
  };

  // Mocking compensation wrappers to confirm tracking
  (testOrchestrator as any).revertWallet = async (tx: any, key: string) => {
    executionTracking.push('COMPENSATE_REVERT_WALLET_CLEARED');
  };

  (testOrchestrator as any).compensateFunds = async (tx: any, key: string) => {
    executionTracking.push('COMPENSATE_RELEASE_HOLD_CLEARED');
  };

  // 2. Structuring Test Dummy Transaction Payload
  const dummyTx: PaymentTransaction = {
    userId: '00000000-0000-0000-0000-000000000001', // Valid UUID structure placeholder
    amount: 1500.0,
    currency: 'KES',
    walletFrom: 'wallet-source-abc',
    walletTo: 'chama-treasury-xyz',
    vaultId: 'vault-yield-pool-1'
  } as unknown as PaymentTransaction;

  // 3. Fire the Saga Orchestration Loop
  console.log('🔄 Executing Saga Pipeline with injected network fault...');
  const resultingState = await testOrchestrator.executePaymentSAGA(dummyTx as any);

  // 4. Assertions Block
  console.log('\n🧐 Evaluating Assertions...');
  
  const assertions = {
    sagaStatusIsFailed: resultingState.status === 'failed',
    blockchainStepRecordedFailure: resultingState.currentStep === 'SAGA_FAILED',
    registeredWalletReversal: Array.isArray(resultingState.compensationSteps) && resultingState.compensationSteps.includes('REVERT_WALLET'),
    registeredFundsCompensated: Array.isArray(resultingState.compensationSteps) && resultingState.compensationSteps.includes('COMPENSATE_FUNDS'),
    didNotCompensateUnexecutedSteps: !(Array.isArray(resultingState.compensationSteps) && resultingState.compensationSteps.includes('COMPENSATE_BLOCKCHAIN')),
  };

  console.table(assertions);

  const testPassed = Object.values(assertions).every(val => val === true);
  
  if (!testPassed) {
    console.error('❌ Chaos integration validation failed. Review execution loop logic.');
    process.exit(1);
  }
  
  console.log('✅ In-memory runtime compensation sequencing verified successfully.');

  // 5. Database State Integrity Verification
  console.log('\n💾 Verifying Database State Persistence via Drizzle ORM...');
  try {
    const persistedSaga = await testOrchestrator.getSAGAState(resultingState.id);
    
    if (!persistedSaga) {
      throw new Error('Saga row not found in the database. Persistence failure.');
    }

    console.log(`- Database Status: [${persistedSaga.status}]`);
    console.log(`- Steps Completed Array: ${JSON.stringify(persistedSaga.stepsCompleted)}`);
    console.log(`- Compensation Track Array: ${JSON.stringify(persistedSaga.compensationSteps)}`);
    console.log(`- Logged DB Fault: "${persistedSaga.lastError}"`);

    if (persistedSaga.status !== 'failed') {
      throw new Error('DB status sync failure. Row state is out of sync with actual transactional outcome.');
    }

    console.log('\n🎉 ALL SYSTEMS INTEGRATIONAL ASSERTI0NS CLEARED. SAGA RECOVERY IS PROD-READY.');
    process.exit(0);
  } catch (dbError) {
    console.error('❌ Database persistence assertion verification faulted:', dbError);
    process.exit(1);
  }
}

// Kick off execution
runChaosTest().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
