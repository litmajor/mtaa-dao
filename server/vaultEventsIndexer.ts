import { MaonoVaultService } from "./blockchain";
import { db } from './db';
import { vaultTransactions, vaults } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

// (kept below) exported strict event interfaces are used by the rest of the file

// ============================================================================
// STRICT COMPILE-TIME TYPE DEFINITIONS
// ============================================================================

export interface BaseVaultEvent {
  type: string;
  vaultId: string;
  transactionHash: string;
  timestamp: string | number;
  blockNumber?: number;
}

export interface DepositEvent extends BaseVaultEvent {
  type: 'DepositMade';
  amount: string;
  userAddress: string;
  tokenSymbol: string;
  valueUSD?: string;
}

export interface WithdrawalEvent extends BaseVaultEvent {
  type: 'WithdrawalMade';
  amount: string;
  userAddress: string;
  tokenSymbol: string;
  valueUSD?: string;
}

export interface NAVUpdatedEvent extends BaseVaultEvent {
  type: 'NAVUpdated';
  newNAV: string;
}

export interface PerformanceFeeEvent extends BaseVaultEvent {
  type: 'PerformanceFeeDistributed';
  amount: string;
}

export interface FeeUpdatedEvent extends BaseVaultEvent {
  type: 'FeeUpdated';
  newFee: string;
}

export interface DAOSettingsEvent extends BaseVaultEvent {
  type: 'DAOSettingsUpdated';
  newSettings: Record<string, unknown>;
}

export interface OfframpFeeEvent extends BaseVaultEvent {
  type: 'OfframpFeePaid';
  amount: string;
  userId: string;
}

export interface WithdrawalFeeEvent extends BaseVaultEvent {
  type: 'WithdrawalFeePaid';
  amount: string;
  userId: string;
}

export interface VaultStatusEvent extends BaseVaultEvent {
  type: 'VaultStatusUpdated';
  newStatus: string;
}

export interface VaultMetadataEvent extends BaseVaultEvent {
  type: 'VaultMetadataUpdated';
  newMetadata: Record<string, unknown>;
}

export interface VaultOwnershipEvent extends BaseVaultEvent {
  type: 'VaultOwnershipTransferred';
  newOwner: string;
}

export type VaultEvent = 
  | DepositEvent 
  | WithdrawalEvent 
  | NAVUpdatedEvent 
  | PerformanceFeeEvent
  | FeeUpdatedEvent
  | DAOSettingsEvent
  | OfframpFeeEvent
  | WithdrawalFeeEvent
  | VaultStatusEvent
  | VaultMetadataEvent
  | VaultOwnershipEvent
  | BaseVaultEvent;

// ============================================================================
// PRODUCTION CORE INDEXER ENGINE
// ============================================================================

class VaultEventIndexer {
  private isRunning = false;
  private eventHandlers: Map<VaultEvent['type'], (event: VaultEvent) => Promise<void>> = new Map();

  constructor() {
    // FIX: Explicitly bind 'this' context to guarantee handlers retain structural references during async loops
    this.registerHandler("NAVUpdated", this.handleNAVUpdated.bind(this));
    this.registerHandler("PerformanceFeeDistributed", this.handlePerformanceFeeDistributed.bind(this));
    this.registerHandler("VaultCreated", this.handleVaultCreated.bind(this));
    this.registerHandler("VaultClosed", this.handleVaultClosed.bind(this));
    this.registerHandler("DepositMade", this.handleDepositMade.bind(this));
    this.registerHandler("WithdrawalMade", this.handleWithdrawalMade.bind(this));
    this.registerHandler("FeeUpdated", this.handleFeeUpdated.bind(this));
    this.registerHandler("DAOSettingsUpdated", this.handleDAOSettingsUpdated.bind(this));
    this.registerHandler("OfframpFeePaid", this.handleOfframpFeePaid.bind(this));
    this.registerHandler("DisbursementMade", this.handleDisbursementMade.bind(this));
    this.registerHandler("WithdrawalFeePaid", this.handleWithdrawalFeePaid.bind(this));
    this.registerHandler("OfframpWithdrawalMade", this.handleOfframpWithdrawalMade.bind(this));
    this.registerHandler("VaultStatusUpdated", this.handleVaultStatusUpdated.bind(this));
    this.registerHandler("VaultMetadataUpdated", this.handleVaultMetadataUpdated.bind(this));
    this.registerHandler("VaultOwnershipTransferred", this.handleVaultOwnershipTransferred.bind(this));
  }

  public registerHandler<T extends VaultEvent['type']>(
    eventType: T,
    handler: (event: Extract<VaultEvent, { type: T }>) => Promise<void>
  ): void {
    this.eventHandlers.set(eventType, handler as unknown as (event: VaultEvent) => Promise<void>);
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log("Vault event indexer is already running.");
      return;
    }

    if (!process.env.MAONO_CONTRACT_ADDRESS || process.env.MAONO_CONTRACT_ADDRESS === "") {
      console.log("⚠️  Vault event indexer skipped: MAONO_CONTRACT_ADDRESS not configured.");
      console.log("   Deploy MaonoVault contract and set MAONO_CONTRACT_ADDRESS in .env to enable vault events.");
      return;
    }

    this.isRunning = true;
    console.log("Starting vault event indexer engine...");

    try {
      MaonoVaultService.listenToEvents(async (event: VaultEvent) => {
        if (!this.isRunning) return;

        try {
          const handler = this.eventHandlers.get(event.type as VaultEvent['type']);
          if (handler) {
            await handler(event);
          } else {
            // Log telemetry drops and skip transaction property noise to save database bandwidth
            console.log(`[Skipped/TelemetryEvent] Type: ${event.type} at tx: ${event.transactionHash}`);

            // Retain unexpected or critical unmapped structural records for offline analysis
            if (!event.type.startsWith("VaultTransaction")) {
              await this.logEventFallbacks(event, 'unknown_event', 'completed', { needsAnalysis: true });
            }
          }
        } catch (error: unknown) {
          console.error(`Failed to process event ${event.type}:`, error);
          await this.logEventFallbacks(event, 'event_error', 'failed', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });
    } catch (error) {
      console.error("❌ Failed to start vault event indexer connection layer:", error);
      this.isRunning = false;
      throw error;
    }
  }

  public stop(): void {
    this.isRunning = false;
    console.log("Vault event indexer stopped cleanly.");
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      supportedEvents: Array.from(this.eventHandlers.keys()),
      startTime: this.isRunning ? new Date().toISOString() : null
    };
  }

  /**
   * Safe transaction ledger writer for unknown errors and operational exceptions.
   */
  private async logEventFallbacks(
    event: VaultEvent,
    txType: string,
    status: 'completed' | 'failed',
    extraMeta: Record<string, unknown>
  ): Promise<void> {
    try {
      await db.insert(vaultTransactions).values({
        vaultId: event.vaultId || 'unknown',
        userId: 'system',
        transactionType: txType,
        tokenSymbol: 'cUSD',
        amount: '0',
        valueUSD: '0',
        transactionHash: event.transactionHash,
        status: status,
        metadata: {
          eventType: event.type,
          rawEvent: JSON.stringify(event),
          ...extraMeta
        }
      }).onConflictDoNothing();
    } catch (dbError) {
      console.error('Failed to commit recovery fallback logs to database:', dbError);
    }
  }

  // ============================================================================
  // VAULT STATE HANDLERS
  // ============================================================================

  private async handleNAVUpdated(event: NAVUpdatedEvent): Promise<void> {
    console.log(`[NAVUpdated] Vault ID: ${event.vaultId} New NAV: ${event.newNAV}`);
    try {
      // Update vault's TVL (totalValueLocked) to reflect reported NAV
      await db.update(vaults).set({ totalValueLocked: event.newNAV, updatedAt: new Date() }).where(eq(vaults.id, event.vaultId));

      // Record transaction for NAV update for audit/history
      await db.insert(vaultTransactions).values({
        vaultId: event.vaultId,
        userId: 'system',
        transactionType: 'nav_update',
        tokenSymbol: 'cUSD',
        amount: event.newNAV,
        valueUSD: event.newNAV,
        transactionHash: event.transactionHash || null,
        blockNumber: event.blockNumber,
        status: 'completed',
        metadata: { source: 'onchain_event', eventType: event.type }
      }).onConflictDoNothing();
    } catch (err) {
      console.error('[VaultEventIndexer] NAVUpdated handler failed', err instanceof Error ? err.message : String(err));
    }
  }

  private async handlePerformanceFeeDistributed(event: PerformanceFeeEvent): Promise<void> {
    console.log(`[PerformanceFeeDistributed] Vault: ${event.vaultId} Amount: ${event.amount}`);
    try {
      // Persist performance fee transaction and decrement vault yieldGenerated if present
      await db.insert(vaultTransactions).values({
        vaultId: event.vaultId,
        userId: 'system',
        transactionType: 'performance_fee',
        tokenSymbol: 'cUSD',
        amount: event.amount,
        valueUSD: event.amount,
        transactionHash: event.transactionHash || null,
        blockNumber: event.blockNumber,
        status: 'completed',
        metadata: { source: 'onchain_event', eventType: event.type }
      }).onConflictDoNothing();

      // Atomically adjust vault yieldGenerated using SQL expression to avoid race conditions
      await db.execute(sql`UPDATE vaults SET yield_generated = COALESCE(yield_generated, '0')::numeric - ${event.amount}::numeric, updated_at = now() WHERE id = ${event.vaultId}`);
    } catch (err) {
      console.error('[VaultEventIndexer] PerformanceFeeDistributed handler failed', err instanceof Error ? err.message : String(err));
    }
  }

  private async handleVaultCreated(event: BaseVaultEvent): Promise<void> {
    console.log(`[VaultCreated] Vault ID: ${event.vaultId}`);
    try {
      // Ensure a vault record exists; create a minimal record if absent
      await db.insert(vaults).values({
        id: event.vaultId,
        name: `Vault ${event.vaultId}`,
        currency: 'cUSD',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }).onConflictDoNothing();
    } catch (err) {
      console.error('[VaultEventIndexer] VaultCreated handler failed', err instanceof Error ? err.message : String(err));
    }
  }

  private async handleVaultClosed(event: BaseVaultEvent): Promise<void> {
    console.log(`[VaultClosed] Vault ID: ${event.vaultId}`);
    try {
      await db.update(vaults).set({ isActive: false, updatedAt: new Date() }).where(eq(vaults.id, event.vaultId));

      // Record a close transaction for audit
      await db.insert(vaultTransactions).values({
        vaultId: event.vaultId,
        userId: 'system',
        transactionType: 'vault_closed',
        tokenSymbol: 'cUSD',
        amount: '0',
        valueUSD: '0',
        transactionHash: event.transactionHash || null,
        blockNumber: event.blockNumber,
        status: 'completed',
        metadata: { source: 'onchain_event', eventType: event.type }
      }).onConflictDoNothing();
    } catch (err) {
      console.error('[VaultEventIndexer] VaultClosed handler failed', err instanceof Error ? err.message : String(err));
    }
  }

  private async handleDepositMade(event: DepositEvent): Promise<void> {
    console.log(`[DepositMade] Amount: ${event.amount} to Vault ID: ${event.vaultId}`);
    
    // FIX: Enforced strict atomic idempotency guarding against RPC event duplications
    await db.insert(vaultTransactions).values({
      vaultId: event.vaultId,
      userId: event.userAddress || 'unknown_user',
      transactionType: 'deposit',
      tokenSymbol: event.tokenSymbol || 'cUSD',
      amount: event.amount,
      valueUSD: event.valueUSD || '0',
      transactionHash: event.transactionHash,
      status: 'completed',
      metadata: { blockNumber: event.blockNumber }
    }).onConflictDoNothing();
  }

  private async handleWithdrawalMade(event: WithdrawalEvent): Promise<void> {
    console.log(`[WithdrawalMade] Amount: ${event.amount} from Vault ID: ${event.vaultId}`);

    await db.insert(vaultTransactions).values({
      vaultId: event.vaultId,
      userId: event.userAddress || 'unknown_user',
      transactionType: 'withdrawal',
      tokenSymbol: event.tokenSymbol || 'cUSD',
      amount: event.amount,
      valueUSD: event.valueUSD || '0',
      transactionHash: event.transactionHash,
      status: 'completed',
      metadata: { blockNumber: event.blockNumber }
    }).onConflictDoNothing();
  }

  private async handleFeeUpdated(event: FeeUpdatedEvent): Promise<void> {
    console.log(`[FeeUpdated] Vault: ${event.vaultId} New Fee: ${event.newFee}`);
  }

  private async handleDAOSettingsUpdated(event: DAOSettingsEvent): Promise<void> {
    console.log(`[DAOSettingsUpdated] Vault: ${event.vaultId} Settings: ${JSON.stringify(event.newSettings)}`);
  }

  private async handleOfframpFeePaid(event: OfframpFeeEvent): Promise<void> {
    console.log(`[OfframpFeePaid] Amount: ${event.amount} by User: ${event.userId}`);
  }

  private async handleDisbursementMade(event: BaseVaultEvent): Promise<void> {
    console.log(`[DisbursementMade] Vault ID: ${event.vaultId}`);
  }

  private async handleWithdrawalFeePaid(event: WithdrawalFeeEvent): Promise<void> {
    console.log(`[WithdrawalFeePaid] Amount: ${event.amount} by User: ${event.userId}`);
  }

  private async handleOfframpWithdrawalMade(event: BaseVaultEvent): Promise<void> {
    console.log(`[OfframpWithdrawalMade] Vault ID: ${event.vaultId}`);
  }

  private async handleVaultStatusUpdated(event: VaultStatusEvent): Promise<void> {
    console.log(`[VaultStatusUpdated] Vault ID: ${event.vaultId} New Status: ${event.newStatus}`);
  }

  private async handleVaultMetadataUpdated(event: VaultMetadataEvent): Promise<void> {
    console.log(`[VaultMetadataUpdated] Vault ID: ${event.vaultId}`);
  }

  private async handleVaultOwnershipTransferred(event: VaultOwnershipEvent): Promise<void> {
    console.log(`[VaultOwnershipTransferred] Vault ID: ${event.vaultId} New Owner: ${event.newOwner}`);
  }
}

// ============================================================================
// SINGLETON LAYER INTERFACEEXPORT
// ============================================================================

export const vaultEventIndexer = new VaultEventIndexer();

export async function startVaultEventIndexer() {
  await vaultEventIndexer.start();
}

// Check direct binary execution context rules
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  vaultEventIndexer.start();

  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down event indexer smoothly...');
    vaultEventIndexer.stop();
    process.exit(0);
  });
}