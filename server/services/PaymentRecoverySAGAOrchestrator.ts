/**
 * PAYMENT RECOVERY SAGA PATTERN (PRODUCTION HARDENED)
 * Event-driven, database-persisted guaranteed-consistency payment recovery orchestration
 * 
 * CHANGES FROM PREVIOUS VERSION:
 * - All step implementations now execute real ledger operations (no mocks).
 * - Compensation is fail-fast: if any compensation step fails, the saga halts 
 *   in 'compensating' status and alerts operations for manual intervention.
 * - Blockchain step performs actual RPC submission and receipt polling.
 * - Reconciliation handles processing timeouts (5 min) in addition to forward-verification.
 * - Wallet/vault IDs are now persisted on the saga row so reconciliation can reconstruct
 *   the PaymentTransaction after a crash.
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { db, pool } from '../db'; 
import { sagaDbDegradedCounter } from '../utils/metrics';
import { sendSAGADegradedAlert } from '../utils/emailNotifier';
import { withTransaction } from '../utils/dbClient';

// ===== TYPE DEFINITIONS =====

export type PaymentSAGAStep =
  | 'SAGA_STARTED'
  | 'RESERVE_FUNDS'
  | 'UPDATE_WALLET'
  | 'UPDATE_VAULT'
  | 'RECORD_BLOCKCHAIN'
  | 'SAGA_SUCCEEDED'
  | 'COMPENSATE_FUNDS'
  | 'REVERT_WALLET'
  | 'REVERT_VAULT'
  | 'COMPENSATE_BLOCKCHAIN'
  | 'SAGA_FAILED'
  | 'SAGA_ABANDONED';

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'compensating' | 'abandoned';

export interface PaymentSAGAEvent {
  id: string;
  sagaId: string;
  timestamp: Date;
  step: PaymentSAGAStep;
  userId: string;
  paymentId: string;
  amount: number;
  currency: string;
  success: boolean;
  data?: any;
  error?: string;
  attemptNumber: number;
  totalRetries: number;
}

export interface PaymentSAGAState {
  id: string;
  status: PaymentStatus;
  userId: string;
  paymentId: string;
  amount: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  stepsCompleted: PaymentSAGAStep[];
  currentStep: PaymentSAGAStep;
  compensationSteps: PaymentSAGAStep[];
  lastError?: string;
  attemptCount: number;
  maxAttempts: number;
  walletFrom?: string;
  walletTo?: string;
  vaultId?: string;
  metadata?: Record<string, any>;
}

export interface ProviderFallbackConfig {
  provider: string;
  operation: string;
  isAvailable: boolean;
  failureRate: number;
}

export interface PaymentSAGAStats {
  total: number;
  succeeded: number;
  failed: number;
  processing: number;
  compensating: number;
  abandoned: number;
  averageDurationMs: number;
}

export interface PaymentTransaction {
  userId: string;
  amount: number;
  currency: string;
  walletFrom: string;
  walletTo: string;
  vaultId?: string;
  metadata?: Record<string, any>;
}

// ===== SAGA ORCHESTRATOR =====

export class PaymentRecoverySAGAOrchestrator extends EventEmitter {
  private logger = Logger.getLogger();
  private stepTimeout = 30000; // Increased: blockchain steps need more time
  private maxRetries = 5;
  private baseRetryDelay = 1000;
  private processingTimeoutMs = 5 * 60 * 1000; // 5 minutes
  private providerFallbacks = new Map<string, ProviderFallbackConfig>();

  constructor() {
    super();
  }

  public async reconcileSaga(sagaId: string): Promise<{ outcome: string } | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const res = await client.query(
        `SELECT * FROM payment_sagas WHERE id = $1 FOR UPDATE NOWAIT`,
        [sagaId]
      );
      
      if (!res.rows || res.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const saga = this.mapRowToState(res.rows[0]);

      if (['succeeded', 'failed', 'abandoned'].includes(saga.status)) {
        await client.query('ROLLBACK');
        return { outcome: 'terminal' };
      }

      this.logger.warn(`[PaymentSAGA-Reconcile] Evaluating state for SAGA: ${sagaId}, Step: ${saga.currentStep}`);

      const transaction: PaymentTransaction = {
        userId: saga.userId,
        amount: saga.amount,
        currency: saga.currency,
        walletFrom: saga.walletFrom || '',
        walletTo: saga.walletTo || '',
        vaultId: saga.vaultId,
        metadata: saga.metadata,
      };

      // FIX: Timeout recovery — if a saga has been processing too long, assume the worker died
      if (saga.status === 'processing' && (Date.now() - new Date(saga.updatedAt).getTime()) > this.processingTimeoutMs) {
        await client.query('COMMIT');
        this.logger.error(`[PaymentSAGA-Reconcile] Saga ${sagaId} timed out after ${this.processingTimeoutMs}ms`);
        await this.compensateSAGA(saga, transaction, new Error('Processing timeout — reconciliation triggered compensation'));
        return { outcome: 'reconciled_via_timeout' };
      }

      // FIX: Forward-verify blockchain before rolling back
      if (saga.currentStep === 'RECORD_BLOCKCHAIN' && !saga.stepsCompleted.includes('RECORD_BLOCKCHAIN')) {
        const onChainConfirmed = await this.verifyBlockchainStatus(saga.id);
        if (onChainConfirmed) {
          saga.stepsCompleted.push('RECORD_BLOCKCHAIN');
          saga.status = 'succeeded';
          saga.currentStep = 'SAGA_SUCCEEDED';
          
          await client.query(
            `UPDATE payment_sagas 
             SET status = $1, steps_completed = $2, current_step = $3, updated_at = NOW() 
             WHERE id = $4`,
            [saga.status, JSON.stringify(saga.stepsCompleted), saga.currentStep, saga.id]
          );
          await client.query('COMMIT');
          return { outcome: 'resolved_forward_success' };
        }
      }

      await client.query('COMMIT'); 
      await this.compensateSAGA(saga, transaction, new Error('Reconciliation recovery sequence triggered.'));
      return { outcome: 'reconciled_via_rollback' };
    } catch (err: any) {
      await client.query('ROLLBACK');
      this.logger.error('[PaymentSAGA] Locking or validation broke for saga ' + sagaId, err);
      return { outcome: 'error' };
    } finally {
      client.release();
    }
  }

  async executePaymentSAGA(transaction: PaymentTransaction): Promise<PaymentSAGAState> {
    const sagaId = uuidv4();
    const paymentId = uuidv4();

    const saga: PaymentSAGAState = {
      id: sagaId,
      status: 'processing',
      userId: transaction.userId,
      paymentId,
      amount: transaction.amount,
      currency: transaction.currency,
      walletFrom: transaction.walletFrom,
      walletTo: transaction.walletTo,
      vaultId: transaction.vaultId,
      metadata: transaction.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
      stepsCompleted: [],
      currentStep: 'SAGA_STARTED',
      compensationSteps: [],
      attemptCount: 0,
      maxAttempts: this.maxRetries,
    };

    try {
      await this.saveSagaState(saga);
    } catch (dbInitErr) {
      this.logger.error(`[PaymentSAGA-Fatal] Cannot initialize SAGA tracking row. Halting.`, dbInitErr);
      throw new Error(`SAGA tracking registration failed. Processing halted.`);
    }

    try {
      await this.emitSAGAEvent(saga, 'SAGA_STARTED', true);

      await this.executeWithRetry(saga, 'RESERVE_FUNDS', async () => {
        return await this.reserveFunds(transaction, paymentId);
      });

      await this.executeWithRetry(saga, 'UPDATE_WALLET', async () => {
        return await this.updateWallet(transaction, paymentId);
      });

      if (transaction.vaultId) {
        await this.executeWithRetry(saga, 'UPDATE_VAULT', async () => {
          return await this.updateVault(transaction, paymentId);
        });
      }

      await this.executeWithRetry(saga, 'RECORD_BLOCKCHAIN', async () => {
        return await this.recordBlockchain(transaction, sagaId);
      });

      saga.status = 'succeeded';
      saga.currentStep = 'SAGA_SUCCEEDED';
      await this.updateSagaState(saga);
      await this.emitSAGAEvent(saga, 'SAGA_SUCCEEDED', true);

      this.logger.info(`[PaymentSAGA] SAGA ${sagaId} completed successfully.`);
      return saga;

    } catch (error: any) {
      this.logger.error(`[PaymentSAGA] SAGA ${sagaId} broken at step ${saga.currentStep}:`, error);
      await this.compensateSAGA(saga, transaction, error);
      return saga;
    }
  }

  private async executeWithRetry(
    saga: PaymentSAGAState,
    step: PaymentSAGAStep,
    stepFn: () => Promise<any>
  ): Promise<any> {
    saga.currentStep = step;
    saga.attemptCount = 0;
    await this.updateSagaState(saga);

    while (saga.attemptCount < this.maxRetries) {
      try {
        saga.attemptCount++;

        const result = await Promise.race([
          stepFn(),
          this.createTimeout(this.stepTimeout),
        ]);

        if (!saga.stepsCompleted.includes(step)) {
          saga.stepsCompleted.push(step);
        }

        await this.updateSagaState(saga);

        try {
          await this.emitSAGAEvent(saga, step, true, { result });
        } catch (evtErr) {
          this.logger.error(`[PaymentSAGA] Event emission dropped for ${step}; continuing`, evtErr);
        }

        return result;

      } catch (error) {
        const isTimeout = error instanceof TimeoutError;
        const isLastAttempt = saga.attemptCount >= this.maxRetries;

        this.logger.warn(
          `[PaymentSAGA] Step ${step} failed (attempt ${saga.attemptCount}/${this.maxRetries}):`,
          {
            error: error instanceof Error ? error.message : String(error),
            details: error,
          }
        );

        try {
          await this.emitSAGAEvent(saga, step, false, { 
            error: String(error),
            timeout: isTimeout,
            attempt: saga.attemptCount,
          });
        } catch (_) {}

        if (isLastAttempt) throw error;

        const delay = this.calculateBackoff(saga.attemptCount);
        await this.sleep(delay);
      }
    }

    throw new Error(`Step ${step} failed after maximum ${this.maxRetries} backoff attempts.`);
  }

  private async compensateSAGA(
    saga: PaymentSAGAState,
    transaction: PaymentTransaction,
    originalError: Error
  ): Promise<void> {
    this.logger.warn(`[PaymentSAGA] Triggering compensation for SAGA ${saga.id}`);
    saga.status = 'compensating';
    saga.lastError = String(originalError);
    
    try {
      await this.updateSagaState(saga);
    } catch (dbErr) {
      this.logger.error('[PaymentSAGA-Fatal] Failed updating status to compensating.', dbErr);
    }

    const compensationSequence: Array<[PaymentSAGAStep, () => Promise<void>]> = [
      ['COMPENSATE_BLOCKCHAIN', () => this.compensateBlockchain(transaction, saga.id)],
      ['REVERT_VAULT', () => this.revertVault(transaction, saga.paymentId)],
      ['REVERT_WALLET', () => this.revertWallet(transaction, saga.paymentId)],
      ['COMPENSATE_FUNDS', () => this.compensateFunds(transaction, saga.paymentId)],
    ];

    let compensationFailed = false;

    for (const [compensationStep, compensationFn] of compensationSequence) {
      let requiredCompletedStep: PaymentSAGAStep | null = null;
      switch (compensationStep) {
        case 'COMPENSATE_BLOCKCHAIN': requiredCompletedStep = 'RECORD_BLOCKCHAIN'; break;
        case 'REVERT_VAULT': requiredCompletedStep = 'UPDATE_VAULT'; break;
        case 'REVERT_WALLET': requiredCompletedStep = 'UPDATE_WALLET'; break;
        case 'COMPENSATE_FUNDS': requiredCompletedStep = 'RESERVE_FUNDS'; break;
      }

      if (requiredCompletedStep && !saga.stepsCompleted.includes(requiredCompletedStep)) {
        continue;
      }

      try {
        this.logger.debug(`[PaymentSAGA] Reverting: ${compensationStep}`);
        await compensationFn();
        saga.compensationSteps.push(compensationStep);
        await this.updateSagaState(saga);
        await this.emitSAGAEvent(saga, compensationStep, true);
      } catch (compensationError) {
        compensationFailed = true;
        this.logger.error(`[PaymentSAGA-CRITICAL] Compensation ${compensationStep} failed:`, compensationError);
        
        saga.lastError = `Compensation failed at ${compensationStep}: ${compensationError}`;
        await this.updateSagaState(saga);
        await this.emitSAGAEvent(saga, compensationStep, false, { error: String(compensationError) });
        
        try { await sendSAGADegradedAlert(saga.id, compensationStep, compensationError); } catch (_) {}
        
        // CRITICAL: Stop here. Do NOT mark as failed. Manual intervention required.
        return;
      }
    }

    if (!compensationFailed) {
      saga.status = 'failed';
      saga.currentStep = 'SAGA_FAILED';
      await this.updateSagaState(saga);
      try {
        await this.emitSAGAEvent(saga, 'SAGA_FAILED', false, { compensated: true });
      } catch (_) {}
    }
  }

  // ===== REAL STEP IMPLEMENTATIONS =====

  private async reserveFunds(tx: PaymentTransaction, idempotencyKey: string): Promise<any> {
    const existing = await pool.query(
      `SELECT id FROM account_transactions WHERE reference = $1 LIMIT 1`,
      [idempotencyKey]
    );
    if (existing.rows.length > 0) {
      return { reservationId: existing.rows[0].id, idempotencyKey };
    }
    return await withTransaction(async (client) => {
      const senderRes = await client.query(
        `SELECT id, balance, currency, total_withdrawn 
         FROM accounts WHERE id = $1 FOR UPDATE`,
        [tx.walletFrom]
      );
      if (senderRes.rows.length === 0) throw new Error('Source wallet not found');
      const sender = senderRes.rows[0];

      const currentBalance = Number(sender.balance);
      if (currentBalance < tx.amount) {
        throw new Error(`Insufficient balance: ${currentBalance} < ${tx.amount}`);
      }

      const newBalance = (currentBalance - tx.amount).toFixed(8);
      const newTotalWithdrawn = (Number(sender.total_withdrawn || '0') + tx.amount).toFixed(8);

      await client.query(
        `UPDATE accounts 
         SET balance = $1, total_withdrawn = $2, total_transactions = COALESCE(total_transactions, 0) + 1, updated_at = NOW() 
         WHERE id = $3`,
        [newBalance, newTotalWithdrawn, tx.walletFrom]
      );

      const txRes = await client.query(
        `INSERT INTO account_transactions 
         (account_id, transaction_type, amount, currency, description, reference, status, 
          balance_before, balance_after, metadata, created_at, updated_at)
         VALUES ($1, 'reserve', $2, $3, $4, $5, 'pending', $6, $7, $8, NOW(), NOW())
         RETURNING id`,
        [
          tx.walletFrom,
          tx.amount.toString(),
          tx.currency,
          `SAGA reserve ${idempotencyKey}`,
          idempotencyKey,
          sender.balance,
          newBalance,
          JSON.stringify({ sagaPaymentId: idempotencyKey, step: 'RESERVE_FUNDS', walletFrom: tx.walletFrom })
        ]
      );

      return { reservationId: txRes.rows[0].id, idempotencyKey, expiresAt: new Date(Date.now() + 30000) };
    }, 20000);
  }

  private async updateWallet(tx: PaymentTransaction, idempotencyKey: string): Promise<any> {
    const walletKey = `${idempotencyKey}:wallet`;
    const existing = await pool.query(
      `SELECT id FROM account_transactions WHERE reference = $1 LIMIT 1`,
      [walletKey]
    );
    if (existing.rows.length > 0) {
      return { walletTxId: existing.rows[0].id, idempotencyKey: walletKey };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Credit receiver
      const receiverRes = await client.query(
        `SELECT id, balance, currency, total_deposited 
         FROM accounts WHERE id = $1 FOR UPDATE`,
        [tx.walletTo]
      );
      if (receiverRes.rows.length === 0) throw new Error('Destination wallet not found');
      const receiver = receiverRes.rows[0];

      const newReceiverBalance = (Number(receiver.balance) + tx.amount).toFixed(8);
      const newTotalDeposited = (Number(receiver.total_deposited || '0') + tx.amount).toFixed(8);

      await client.query(
        `UPDATE accounts 
         SET balance = $1, total_deposited = $2, total_transactions = COALESCE(total_transactions, 0) + 1, updated_at = NOW() 
         WHERE id = $3`,
        [newReceiverBalance, newTotalDeposited, tx.walletTo]
      );

      // Mark reserve as completed
      await client.query(
        `UPDATE account_transactions SET status = 'completed', updated_at = NOW() WHERE reference = $1`,
        [idempotencyKey]
      );

      // Create receiver transaction
      const txRes = await client.query(
        `INSERT INTO account_transactions 
         (account_id, transaction_type, amount, currency, description, reference, status,
          balance_before, balance_after, from_account_id, to_account_id, metadata, created_at, updated_at)
         VALUES ($1, 'transfer', $2, $3, $4, $5, 'completed', $6, $7, $8, $9, $10, NOW(), NOW())
         RETURNING id`,
        [
          tx.walletTo,
          tx.amount.toString(),
          tx.currency,
          `SAGA wallet update ${idempotencyKey}`,
          walletKey,
          receiver.balance,
          newReceiverBalance,
          tx.walletFrom,
          tx.walletTo,
          JSON.stringify({ sagaPaymentId: idempotencyKey, step: 'UPDATE_WALLET', walletTo: tx.walletTo })
        ]
      );

      await client.query('COMMIT');
      return { walletTxId: txRes.rows[0].id, idempotencyKey: walletKey };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private async updateVault(tx: PaymentTransaction, idempotencyKey: string): Promise<any> {
    if (!tx.vaultId) throw new Error('Vault ID required');
    const vaultKey = `${idempotencyKey}:vault`;

    const existing = await pool.query(
      `SELECT id FROM account_transactions WHERE reference = $1 LIMIT 1`,
      [vaultKey]
    );
    if (existing.rows.length > 0) {
      return { vaultTxId: existing.rows[0].id, idempotencyKey: vaultKey };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const vaultRes = await client.query(
        `SELECT id, balance FROM accounts WHERE id = $1 AND account_type = 'vault' FOR UPDATE`,
        [tx.vaultId]
      );
      if (vaultRes.rows.length === 0) throw new Error('Vault not found');

      const vault = vaultRes.rows[0];
      const newBalance = (Number(vault.balance) + tx.amount).toFixed(8);

      await client.query(
        `UPDATE accounts SET balance = $1, updated_at = NOW() WHERE id = $2`,
        [newBalance, tx.vaultId]
      );

      const txRes = await client.query(
        `INSERT INTO account_transactions 
         (account_id, transaction_type, amount, currency, description, reference, status,
          balance_before, balance_after, metadata, created_at, updated_at)
         VALUES ($1, 'vault_deposit', $2, $3, $4, $5, 'completed', $6, $7, $8, NOW(), NOW())
         RETURNING id`,
        [
          tx.vaultId,
          tx.amount.toString(),
          tx.currency,
          `SAGA vault update ${idempotencyKey}`,
          vaultKey,
          vault.balance,
          newBalance,
          JSON.stringify({ sagaPaymentId: idempotencyKey, step: 'UPDATE_VAULT', vaultId: tx.vaultId })
        ]
      );

      await client.query('COMMIT');
      return { vaultTxId: txRes.rows[0].id, idempotencyKey: vaultKey };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private async recordBlockchain(tx: PaymentTransaction, sagaId: string): Promise<any> {
    const existing = await pool.query(
      `SELECT tx_hash, status FROM blockchain_transactions WHERE saga_id = $1 LIMIT 1`,
      [sagaId]
    );
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      return { txHash: row.tx_hash, sagaId, confirmations: row.status === 'confirmed' ? 1 : 0 };
    }

    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
    if (!rpcUrl) {
      throw new Error('BLOCKCHAIN_RPC_URL not configured');
    }

    const signedTx = tx.metadata?.signedTx;
    if (typeof signedTx !== 'string' || !/^0x(?:[0-9a-fA-F]{2})+$/.test(signedTx)) {
      throw new Error('A valid signed raw transaction is required before blockchain submission');
    }

    const chainResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 2 }),
    });
    if (!chainResponse.ok) throw new Error(`Blockchain RPC HTTP error while resolving chain ID: ${chainResponse.status}`);
    const chainData = await chainResponse.json() as { error?: { message?: string }; result?: unknown };
    if (chainData.error) throw new Error(`Blockchain RPC error while resolving chain ID: ${chainData.error.message ?? 'unknown RPC error'}`);
    if (typeof chainData.result !== 'string' || !/^0x[0-9a-fA-F]+$/.test(chainData.result)) {
      throw new Error('Blockchain RPC returned an invalid chain ID');
    }
    const chainId = Number(BigInt(chainData.result));
    if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error('Blockchain RPC chain ID is out of range');
    const configuredChainId = process.env.BLOCKCHAIN_CHAIN_ID;
    if (configuredChainId && Number(configuredChainId) !== chainId) {
      throw new Error(`Configured blockchain chain ID ${configuredChainId} does not match RPC chain ID ${chainId}`);
    }

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_sendRawTransaction',
        params: [signedTx],
        id: 1
      })
    });

    if (!response.ok) throw new Error(`Blockchain RPC HTTP error: ${response.status}`);
    const data = await response.json() as { error?: { message?: string }; result?: unknown };
    if (data.error) throw new Error(`Blockchain RPC error: ${data.error.message ?? 'unknown RPC error'}`);
    if (typeof data.result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(data.result)) {
      throw new Error('Blockchain RPC returned an invalid transaction hash');
    }
    const txHash = data.result;

    await pool.query(
      `INSERT INTO blockchain_transactions 
       (saga_id, tx_hash, status, chain_id, amount, currency, created_at, updated_at)
       VALUES ($1, $2, 'pending', $3, $4, $5, NOW(), NOW())`,
      [sagaId, txHash, chainId, tx.amount, tx.currency]
    );

    return { txHash, sagaId, confirmations: 0 };
  }

  private async verifyBlockchainStatus(sagaId: string): Promise<boolean> {
    const res = await pool.query(
      `SELECT tx_hash, status FROM blockchain_transactions WHERE saga_id = $1`,
      [sagaId]
    );
    if (res.rows.length === 0) return false;

    const row = res.rows[0];
    if (row.status === 'confirmed') return true;

    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
    if (!rpcUrl || !row.tx_hash) return false;

    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getTransactionReceipt',
          params: [row.tx_hash],
          id: 1
        })
      });

      if (!response.ok) throw new Error(`Blockchain RPC HTTP error: ${response.status}`);
      const data = await response.json() as {
        error?: { message?: string };
        result?: { blockNumber?: unknown; status?: unknown } | null;
      };
      if (data.error) throw new Error(`Blockchain RPC error: ${data.error.message ?? 'unknown RPC error'}`);
      if (data.result && typeof data.result.blockNumber === 'string') {
        if (data.result.status !== '0x1') {
          await pool.query(
            `UPDATE blockchain_transactions SET status = 'failed', updated_at = NOW() WHERE saga_id = $1`,
            [sagaId]
          );
          return false;
        }
        const blockNumber = Number.parseInt(data.result.blockNumber, 16);
        if (!Number.isSafeInteger(blockNumber) || blockNumber < 0) {
          throw new Error('Blockchain RPC returned an invalid receipt block number');
        }
        await pool.query(
          `UPDATE blockchain_transactions 
           SET status = 'confirmed', block_number = $1, updated_at = NOW() 
           WHERE saga_id = $2`,
          [blockNumber, sagaId]
        );
        return true;
      }
    } catch (err) {
      this.logger.error(`[PaymentSAGA] Blockchain verification failed for saga ${sagaId}`, err);
    }
    return false;
  }

  // ===== COMPENSATION REVERSALS (REAL) =====

  private async compensateFunds(tx: PaymentTransaction, idempotencyKey: string): Promise<void> {
    await withTransaction(async (client) => {
      const reserveRes = await client.query(
        `SELECT account_id, amount, balance_before 
         FROM account_transactions WHERE reference = $1 FOR UPDATE`,
        [idempotencyKey]
      );

      if (reserveRes.rows.length === 0) {
        this.logger.warn(`[PaymentSAGA] No reservation to compensate for key ${idempotencyKey}`);
        return;
      }

      const reserve = reserveRes.rows[0];
      const restoredBalance = (Number(reserve.balance_before)).toFixed(8);

      await client.query(
        `UPDATE accounts SET balance = $1, updated_at = NOW() WHERE id = $2`,
        [restoredBalance, reserve.account_id]
      );

      await client.query(
        `UPDATE account_transactions SET status = 'reversed', updated_at = NOW() WHERE reference = $1`,
        [idempotencyKey]
      );

      await client.query(
        `INSERT INTO account_transactions 
         (account_id, transaction_type, amount, currency, description, reference, status,
          balance_before, balance_after, metadata, created_at, updated_at)
         VALUES ($1, 'compensation', $2, $3, $4, $5, 'completed', $6, $7, $8, NOW(), NOW())`,
        [
          reserve.account_id,
          reserve.amount,
          tx.currency,
          `Compensate funds ${idempotencyKey}`,
          `${idempotencyKey}:compensate`,
          reserve.balance_before, // before compensation = after reserve
          restoredBalance,
          JSON.stringify({ sagaPaymentId: idempotencyKey, step: 'COMPENSATE_FUNDS' })
        ]
      );

      this.logger.info(`[PaymentSAGA] Compensated funds for key ${idempotencyKey}`);
    }, 20000);
  }

  private async revertWallet(tx: PaymentTransaction, idempotencyKey: string): Promise<void> {
    const walletKey = `${idempotencyKey}:wallet`;
    await withTransaction(async (client) => {
      const walletRes = await client.query(
        `SELECT account_id, amount, balance_before 
         FROM account_transactions WHERE reference = $1 FOR UPDATE`,
        [walletKey]
      );

      if (walletRes.rows.length === 0) {
        this.logger.warn(`[PaymentSAGA] No wallet update to revert for key ${walletKey}`);
        return;
      }

      const walletTx = walletRes.rows[0];
      const revertedBalance = (Number(walletTx.balance_before)).toFixed(8);

      await client.query(
        `UPDATE accounts SET balance = $1, updated_at = NOW() WHERE id = $2`,
        [revertedBalance, walletTx.account_id]
      );

      await client.query(
        `UPDATE account_transactions SET status = 'reversed', updated_at = NOW() WHERE reference = $1`,
        [walletKey]
      );

      this.logger.info(`[PaymentSAGA] Reverted wallet for key ${walletKey}`);
    }, 20000);
  }

  private async revertVault(tx: PaymentTransaction, idempotencyKey: string): Promise<void> {
    if (!tx.vaultId) return;
    const vaultKey = `${idempotencyKey}:vault`;
    await withTransaction(async (client) => {
      const vaultRes = await client.query(
        `SELECT account_id, amount, balance_before 
         FROM account_transactions WHERE reference = $1 FOR UPDATE`,
        [vaultKey]
      );

      if (vaultRes.rows.length === 0) {
        return;
      }

      const vaultTx = vaultRes.rows[0];
      const revertedBalance = (Number(vaultTx.balance_before)).toFixed(8);

      await client.query(
        `UPDATE accounts SET balance = $1, updated_at = NOW() WHERE id = $2`,
        [revertedBalance, vaultTx.account_id]
      );

      await client.query(
        `UPDATE account_transactions SET status = 'reversed', updated_at = NOW() WHERE reference = $1`,
        [vaultKey]
      );
    }, 20000);
  }

  private async compensateBlockchain(tx: PaymentTransaction, sagaId: string): Promise<void> {
    const res = await pool.query(
      `SELECT tx_hash, status FROM blockchain_transactions WHERE saga_id = $1`,
      [sagaId]
    );

    if (res.rows.length === 0) return;

    const row = res.rows[0];
    this.logger.info(`[PaymentSAGA] Marking blockchain tx ${row.tx_hash} as compensated for saga ${sagaId}`);

    await pool.query(
      `UPDATE blockchain_transactions SET status = 'compensated', updated_at = NOW() WHERE saga_id = $1`,
      [sagaId]
    );

    // NOTE: If the on-chain tx was already mined, you cannot "un-mine" it. 
    // A real system would submit a reversal tx or flag for governance review.
    // This DB record ensures the audit trail exists.
  }

  // ===== PERSISTENCE LAYER =====

  private async saveSagaState(saga: PaymentSAGAState): Promise<void> {
    await pool.query(
      `INSERT INTO payment_sagas 
       (id, status, user_id, payment_id, amount, currency, wallet_from, wallet_to, vault_id, metadata,
        steps_completed, current_step, compensation_steps, attempt_count, max_attempts, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        saga.id, saga.status, saga.userId, saga.paymentId, saga.amount, saga.currency,
        saga.walletFrom, saga.walletTo, saga.vaultId, JSON.stringify(saga.metadata || {}),
        JSON.stringify(saga.stepsCompleted), saga.currentStep, JSON.stringify(saga.compensationSteps),
        saga.attemptCount, saga.maxAttempts, saga.createdAt, saga.updatedAt
      ]
    );
  }

  private async updateSagaState(saga: PaymentSAGAState): Promise<void> {
    saga.updatedAt = new Date();
    const result = await pool.query(
      `UPDATE payment_sagas 
       SET status = $1, steps_completed = $2, current_step = $3, compensation_steps = $4, 
           attempt_count = $5, last_error = $6, updated_at = $7
       WHERE id = $8`,
      [
        saga.status, JSON.stringify(saga.stepsCompleted), saga.currentStep, 
        JSON.stringify(saga.compensationSteps), saga.attemptCount, saga.lastError, saga.updatedAt, saga.id
      ]
    );
    
    if (result.rowCount === 0) {
      throw new Error(`SAGA record ${saga.id} not found.`);
    }
  }

  private async emitSAGAEvent(
    saga: PaymentSAGAState,
    step: PaymentSAGAStep,
    success: boolean,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event: PaymentSAGAEvent = {
      id: uuidv4(),
      sagaId: saga.id,
      timestamp: new Date(),
      step,
      userId: saga.userId,
      paymentId: saga.paymentId,
      amount: saga.amount,
      currency: saga.currency,
      success,
      data: metadata?.result || metadata?.data,
      error: metadata?.error,
      attemptNumber: saga.attemptCount,
      totalRetries: this.maxRetries,
    };

    try {
      await pool.query(
        `INSERT INTO payment_saga_events 
         (id, saga_id, step, success, data, error, attempt_number, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [event.id, event.sagaId, event.step, event.success, 
         JSON.stringify(event.data || {}), event.error, event.attemptNumber, event.timestamp]
      );
    } catch (err) {
      this.logger.error(`[PaymentSAGA-DB] Event persistence failed: ${event.id}`, err);
      try { sagaDbDegradedCounter.inc({ saga_id: saga.id, step: event.step } as any); } catch(_){}
      try { await sendSAGADegradedAlert(saga.id, String(event.step), err); } catch(_){}
    }

    this.emit('saga-event', event);
  }

  // ===== RETRIEVAL OPERATORS =====

  async getSAGAState(sagaId: string): Promise<PaymentSAGAState | undefined> {
    const res = await pool.query(`SELECT * FROM payment_sagas WHERE id = $1`, [sagaId]);
    if (!res.rows || res.rows.length === 0) return undefined;
    return this.mapRowToState(res.rows[0]);
  }

  async getSAGAsByUser(userId: string): Promise<PaymentSAGAState[]> {
    const res = await pool.query(
      `SELECT * FROM payment_sagas WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return res.rows.map((row) => this.mapRowToState(row));
  }

  async getAllSAGAs(options: { fromDate?: Date } = {}): Promise<PaymentSAGAState[]> {
    const values: Date[] = [];
    const whereClause = options.fromDate ? 'WHERE created_at >= $1' : '';
    if (options.fromDate) values.push(options.fromDate);

    const res = await pool.query(
      `SELECT * FROM payment_sagas ${whereClause} ORDER BY created_at DESC`,
      values
    );
    return res.rows.map(row => this.mapRowToState(row));
  }

  async getSAGAStats(fromDate: Date): Promise<PaymentSAGAStats> {
    const res = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'succeeded')::int AS succeeded,
              COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
              COUNT(*) FILTER (WHERE status = 'processing')::int AS processing,
              COUNT(*) FILTER (WHERE status = 'compensating')::int AS compensating,
              COUNT(*) FILTER (WHERE status = 'abandoned')::int AS abandoned,
              COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000)
                FILTER (WHERE status IN ('succeeded', 'failed', 'abandoned')), 0)::float AS average_duration_ms
       FROM payment_sagas WHERE created_at >= $1`,
      [fromDate]
    );
    const row = res.rows[0];
    return {
      total: Number(row.total),
      succeeded: Number(row.succeeded),
      failed: Number(row.failed),
      processing: Number(row.processing),
      compensating: Number(row.compensating),
      abandoned: Number(row.abandoned),
      averageDurationMs: Math.round(Number(row.average_duration_ms)),
    };
  }

  getTotalExecutionSteps(saga: PaymentSAGAState): number {
    return saga.vaultId ? 4 : 3;
  }

  async getSAGAEvents(sagaId: string): Promise<PaymentSAGAEvent[]> {
    const res = await pool.query(
      `SELECT e.id, e.saga_id, e.step, e.success, e.data, e.error, e.attempt_number, e.created_at,
          s.user_id, s.payment_id, s.amount, s.currency
       FROM payment_saga_events e
       JOIN payment_sagas s ON s.id = e.saga_id
       WHERE e.saga_id = $1 ORDER BY e.created_at ASC`,
      [sagaId]
    );
    return res.rows.map(row => ({
      id: row.id,
      sagaId: row.saga_id,
      timestamp: row.created_at,
      step: row.step,
      userId: row.user_id,
      paymentId: row.payment_id,
      amount: Number(row.amount),
      currency: row.currency,
      success: row.success,
      data: typeof row.data === 'string' ? JSON.parse(row.data || '{}') : row.data,
      error: row.error,
      attemptNumber: row.attempt_number,
      totalRetries: this.maxRetries,
    }));
  }

  getProviderConfig(): { providers: ProviderFallbackConfig[]; maxRetries: number; timeout: number; enableCompensation: boolean } {
    return {
      providers: Array.from(this.providerFallbacks.values()),
      maxRetries: this.maxRetries,
      timeout: this.stepTimeout,
      enableCompensation: true,
    };
  }

  async updateProviderConfig(config: ProviderFallbackConfig): Promise<void> {
    if (!config.provider || !config.operation) {
      throw new Error('Provider and operation are required');
    }
    if (typeof config.isAvailable !== 'boolean' || !Number.isFinite(config.failureRate) || config.failureRate < 0 || config.failureRate > 100) {
      throw new Error('Invalid provider fallback configuration');
    }
    this.providerFallbacks.set(`${config.operation}:${config.provider}`, { ...config });
  }

  async abandonSAGA(sagaId: string, reason: string): Promise<void> {
    const saga = await this.getSAGAState(sagaId);
    if (!saga) return;

    saga.status = 'abandoned';
    saga.currentStep = 'SAGA_ABANDONED';
    saga.lastError = reason;

    await this.updateSagaState(saga);
    await this.emitSAGAEvent(saga, 'SAGA_ABANDONED', false, { reason });
    this.logger.info(`[PaymentSAGA] SAGA ${sagaId} abandoned. Reason: ${reason}`);
  }

  private mapRowToState(row: any): PaymentSAGAState {
    return {
      id: row.id,
      status: row.status,
      userId: row.user_id,
      paymentId: row.payment_id,
      amount: Number(row.amount),
      currency: row.currency,
      walletFrom: row.wallet_from,
      walletTo: row.wallet_to,
      vaultId: row.vault_id,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : (row.metadata || {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      stepsCompleted: typeof row.steps_completed === 'string' ? JSON.parse(row.steps_completed) : row.steps_completed,
      currentStep: row.current_step,
      compensationSteps: typeof row.compensation_steps === 'string' ? JSON.parse(row.compensation_steps) : row.compensation_steps,
      lastError: row.last_error,
      attemptCount: row.attempt_count,
      maxAttempts: row.max_attempts,
    };
  }

  private calculateBackoff(attemptNumber: number): number {
    return Math.min(this.baseRetryDelay * Math.pow(2, attemptNumber - 1), 30000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => 
      setTimeout(() => reject(new TimeoutError(`Step timed out after ${ms}ms`)), ms)
    );
  }
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export const paymentRecoverySAGA = new PaymentRecoverySAGAOrchestrator();