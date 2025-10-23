import { MaonoVaultService } from "./blockchain";
import { db } from './db';
import { vaultTransactions } from '../shared/schema';

// Define a class for better event management
class VaultEventIndexer {
  private isRunning: boolean = false;
  private eventHandlers: Map<string, (event: any) => Promise<void>> = new Map();

  constructor() {
    // Register known event handlers
    this.registerHandler("NAVUpdated", this.handleNAVUpdated);
    this.registerHandler("PerformanceFeeDistributed", this.handlePerformanceFeeDistributed);
    this.registerHandler("VaultCreated", this.handleVaultCreated);
    this.registerHandler("VaultClosed", this.handleVaultClosed);
    this.registerHandler("DepositMade", this.handleDepositMade);
    this.registerHandler("WithdrawalMade", this.handleWithdrawalMade);
    this.registerHandler("FeeUpdated", this.handleFeeUpdated);
    this.registerHandler("DAOSettingsUpdated", this.handleDAOSettingsUpdated);
    this.registerHandler("OfframpFeePaid", this.handleOfframpFeePaid);
    this.registerHandler("DisbursementMade", this.handleDisbursementMade);
    this.registerHandler("WithdrawalFeePaid", this.handleWithdrawalFeePaid);
    this.registerHandler("OfframpWithdrawalMade", this.handleOfframpWithdrawalMade);
    this.registerHandler("OfframpFeeUpdated", this.handleOfframpFeeUpdated);
    this.registerHandler("OfframpWhoPaysUpdated", this.handleOfframpWhoPaysUpdated);
    this.registerHandler("DisbursementFeeUpdated", this.handleDisbursementFeeUpdated);
    this.registerHandler("WithdrawalFeeUpdated", this.handleWithdrawalFeeUpdated);
    this.registerHandler("VaultStatusUpdated", this.handleVaultStatusUpdated);
    this.registerHandler("VaultMetadataUpdated", this.handleVaultMetadataUpdated);
    this.registerHandler("VaultOwnershipTransferred", this.handleVaultOwnershipTransferred);
    this.registerHandler("VaultTypeUpdated", this.handleVaultTypeUpdated);
    this.registerHandler("VaultCurrencyUpdated", this.handleVaultCurrencyUpdated);
    this.registerHandler("VaultNameUpdated", this.handleVaultNameUpdated);
    this.registerHandler("VaultDescriptionUpdated", this.handleVaultDescriptionUpdated);
    this.registerHandler("VaultLogoUpdated", this.handleVaultLogoUpdated);
    this.registerHandler("VaultBannerUpdated", this.handleVaultBannerUpdated);
    this.registerHandler("VaultPrivacyUpdated", this.handleVaultPrivacyUpdated);
    this.registerHandler("VaultAccessControlUpdated", this.handleVaultAccessControlUpdated);
    this.registerHandler("VaultTransactionRecorded", this.handleVaultTransactionRecorded);
    this.registerHandler("VaultTransactionFailed", this.handleVaultTransactionFailed);
    this.registerHandler("VaultTransactionPending", this.handleVaultTransactionPending);
    this.registerHandler("VaultTransactionConfirmed", this.handleVaultTransactionConfirmed);
    this.registerHandler("VaultTransactionReverted", this.handleVaultTransactionReverted);
    this.registerHandler("VaultTransactionGasUsed", this.handleVaultTransactionGasUsed);
    this.registerHandler("VaultTransactionGasPrice", this.handleVaultTransactionGasPrice);
    this.registerHandler("VaultTransactionNonce", this.handleVaultTransactionNonce);
    this.registerHandler("VaultTransactionBlockNumber", this.handleVaultTransactionBlockNumber);
    this.registerHandler("VaultTransactionBlockHash", this.handleVaultTransactionBlockHash);
    this.registerHandler("VaultTransactionFrom", this.handleVaultTransactionFrom);
    this.registerHandler("VaultTransactionTo", this.handleVaultTransactionTo);
    this.registerHandler("VaultTransactionValue", this.handleVaultTransactionValue);
    this.registerHandler("VaultTransactionInput", this.handleVaultTransactionInput);
    this.registerHandler("VaultTransactionReceipt", this.handleVaultTransactionReceipt);
    this.registerHandler("VaultTransactionLogs", this.handleVaultTransactionLogs);
    this.registerHandler("VaultTransactionStatus", this.handleVaultTransactionStatus);
    this.registerHandler("VaultTransactionError", this.handleVaultTransactionError);
  }

  registerHandler(eventType: string, handler: (event: any) => Promise<void>) {
    this.eventHandlers.set(eventType, handler);
  }

  async start() {
    if (this.isRunning) {
      console.log("Vault event indexer is already running.");
      return;
    }

    // Check if MAONO_CONTRACT_ADDRESS is configured
    if (!process.env.MAONO_CONTRACT_ADDRESS || process.env.MAONO_CONTRACT_ADDRESS === "") {
      console.log("⚠️  Vault event indexer skipped: MAONO_CONTRACT_ADDRESS not configured.");
      console.log("   Deploy MaonoVault contract and set MAONO_CONTRACT_ADDRESS in .env to enable vault events.");
      return;
    }

    this.isRunning = true;
    console.log("Starting vault event indexer...");

    try {
      MaonoVaultService.listenToEvents(async (event) => {
      try {
        const handler = this.eventHandlers.get(event.type);
        if (handler) {
          await handler(event);
        } else {
          // Handle unknown events
          console.log(`[UnknownEvent] Type: ${event.type} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);

          // Save unknown events for analysis
          await db.insert(vaultTransactions).values({
            vaultId: event.vaultId || 'unknown',
            userId: 'system',
            transactionType: 'unknown_event',
            tokenSymbol: 'cUSD',
            amount: '0',
            valueUSD: '0',
            transactionHash: event.transactionHash,
            status: 'completed',
            metadata: {
              eventType: event.type,
              rawEvent: JSON.stringify(event),
              needsAnalysis: true
            }
          }).onConflictDoNothing();
        }
      } catch (error) {
        console.error(`Failed to process event ${event.type}:`, error);

        // Save error for debugging
        try {
          await db.insert(vaultTransactions).values({
            vaultId: event.vaultId || 'error',
            userId: 'system',
            transactionType: 'event_error',
            tokenSymbol: 'cUSD',
            amount: '0',
            valueUSD: '0',
            transactionHash: event.transactionHash,
            status: 'failed',
            metadata: {
              eventType: event.type,
              error: error instanceof Error ? error.message : 'Unknown error',
              rawEvent: JSON.stringify(event)
            }
          });
        } catch (dbError) {
          console.error('Failed to save event processing error:', dbError);
        }
      }
    });
    } catch (error) {
      console.error("❌ Failed to start vault event indexer:", error);
      this.isRunning = false;
      throw error;
    }
  }

  stop() {
    this.isRunning = false;
    console.log("Vault event indexer stopped.");
    // In a real scenario, you would also want to unsubscribe from the event listener
  }

  // Placeholder handler functions for each event type
  private async handleNAVUpdated(event: any): Promise<void> {
    console.log(`[NAVUpdated] New NAV: ${event.newNAV} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handlePerformanceFeeDistributed(event: any): Promise<void> {
    console.log(`[PerformanceFeeDistributed] Amount: ${event.amount} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultCreated(event: any): Promise<void> {
    console.log(`[VaultCreated] Vault ID: ${event.vaultId} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultClosed(event: any): Promise<void> {
    console.log(`[VaultClosed] Vault ID: ${event.vaultId} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleDepositMade(event: any): Promise<void> {
    console.log(`[DepositMade] Amount: ${event.amount} to Vault ID: ${event.vaultId} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleWithdrawalMade(event: any): Promise<void> {
    console.log(`[WithdrawalMade] Amount: ${event.amount} from Vault ID: ${event.vaultId} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleFeeUpdated(event: any): Promise<void> {
    console.log(`[FeeUpdated] New Fee: ${event.newFee} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleDAOSettingsUpdated(event: any): Promise<void> {
    console.log(`[DAOSettingsUpdated] New Settings: ${JSON.stringify(event.newSettings)} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleOfframpFeePaid(event: any): Promise<void> {
    console.log(`[OfframpFeePaid] Amount: ${event.amount} by User: ${event.userId} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleDisbursementMade(event: any): Promise<void> {
    console.log(`[DisbursementMade] Amount: ${event.amount} from Vault ID: ${event.vaultId} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleWithdrawalFeePaid(event: any): Promise<void> {
    console.log(`[WithdrawalFeePaid] Amount: ${event.amount} by User: ${event.userId} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleOfframpWithdrawalMade(event: any): Promise<void> {
    console.log(`[OfframpWithdrawalMade] Amount: ${event.amount} by User: ${event.userId} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleOfframpFeeUpdated(event: any): Promise<void> {
    console.log(`[OfframpFeeUpdated] New Fee: ${event.newFee} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleOfframpWhoPaysUpdated(event: any): Promise<void> {
    console.log(`[OfframpWhoPaysUpdated] New Who Pays: ${event.newWhoPays} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleDisbursementFeeUpdated(event: any): Promise<void> {
    console.log(`[DisbursementFeeUpdated] New Fee: ${event.newFee} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleWithdrawalFeeUpdated(event: any): Promise<void> {
    console.log(`[WithdrawalFeeUpdated] New Fee: ${event.newFee} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultStatusUpdated(event: any): Promise<void> {
    console.log(`[VaultStatusUpdated] Vault ID: ${event.vaultId} New Status: ${event.newStatus} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultMetadataUpdated(event: any): Promise<void> {
    console.log(`[VaultMetadataUpdated] Vault ID: ${event.vaultId} New Metadata: ${JSON.stringify(event.newMetadata)} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultOwnershipTransferred(event: any): Promise<void> {
    console.log(`[VaultOwnershipTransferred] Vault ID: ${event.vaultId} New Owner: ${event.newOwner} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultTypeUpdated(event: any): Promise<void> {
    console.log(`[VaultTypeUpdated] Vault ID: ${event.vaultId} New Type: ${event.newType} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultCurrencyUpdated(event: any): Promise<void> {
    console.log(`[VaultCurrencyUpdated] Vault ID: ${event.vaultId} New Currency: ${event.newCurrency} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultNameUpdated(event: any): Promise<void> {
    console.log(`[VaultNameUpdated] Vault ID: ${event.vaultId} New Name: ${event.newName} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultDescriptionUpdated(event: any): Promise<void> {
    console.log(`[VaultDescriptionUpdated] Vault ID: ${event.vaultId} New Description: ${event.newDescription} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultLogoUpdated(event: any): Promise<void> {
    console.log(`[VaultLogoUpdated] Vault ID: ${event.vaultId} New Logo: ${event.newLogo} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultBannerUpdated(event: any): Promise<void> {
    console.log(`[VaultBannerUpdated] Vault ID: ${event.vaultId} New Banner: ${event.newBanner} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultPrivacyUpdated(event: any): Promise<void> {
    console.log(`[VaultPrivacyUpdated] Vault ID: ${event.vaultId} New Privacy: ${event.newPrivacy} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultAccessControlUpdated(event: any): Promise<void> {
    console.log(`[VaultAccessControlUpdated] Vault ID: ${event.vaultId} New Access Control: ${JSON.stringify(event.newAccessControl)} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultTransactionRecorded(event: any): Promise<void> {
    console.log(`[VaultTransactionRecorded] Vault ID: ${event.vaultId} Transaction: ${JSON.stringify(event.transaction)} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultTransactionFailed(event: any): Promise<void> {
    console.log(`[VaultTransactionFailed] Vault ID: ${event.vaultId} Error: ${event.error} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultTransactionPending(event: any): Promise<void> {
    console.log(`[VaultTransactionPending] Vault ID: ${event.vaultId} Transaction: ${JSON.stringify(event.transaction)} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultTransactionConfirmed(event: any): Promise<void> {
    console.log(`[VaultTransactionConfirmed] Vault ID: ${event.vaultId} Transaction: ${JSON.stringify(event.transaction)} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultTransactionReverted(event: any): Promise<void> {
    console.log(`[VaultTransactionReverted] Vault ID: ${event.vaultId} Transaction: ${JSON.stringify(event.transaction)} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultTransactionGasUsed(event: any): Promise<void> {
    console.log(`[VaultTransactionGasUsed] Vault ID: ${event.vaultId} Gas Used: ${event.gasUsed} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultTransactionGasPrice(event: any): Promise<void> {
    console.log(`[VaultTransactionGasPrice] Vault ID: ${event.vaultId} Gas Price: ${event.gasPrice} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultTransactionNonce(event: any): Promise<void> {
    console.log(`[VaultTransactionNonce] Vault ID: ${event.vaultId} Nonce: ${event.nonce} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultTransactionBlockNumber(event: any): Promise<void> {
    console.log(`[VaultTransactionBlockNumber] Vault ID: ${event.vaultId} Block Number: ${event.blockNumber} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultTransactionBlockHash(event: any): Promise<void> {
    console.log(`[VaultTransactionBlockHash] Vault ID: ${event.vaultId} Block Hash: ${event.blockHash} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultTransactionFrom(event: any): Promise<void> {
    console.log(`[VaultTransactionFrom] Vault ID: ${event.vaultId} From: ${event.from} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultTransactionTo(event: any): Promise<void> {
    console.log(`[VaultTransactionTo] Vault ID: ${event.vaultId} To: ${event.to} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultTransactionValue(event: any): Promise<void> {
    console.log(`[VaultTransactionValue] Vault ID: ${event.vaultId} Value: ${event.value} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultTransactionInput(event: any): Promise<void> {
    console.log(`[VaultTransactionInput] Vault ID: ${event.vaultId} Input: ${event.input} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultTransactionReceipt(event: any): Promise<void> {
    console.log(`[VaultTransactionReceipt] Vault ID: ${event.vaultId} Receipt: ${JSON.stringify(event.receipt)} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultTransactionLogs(event: any): Promise<void> {
    console.log(`[VaultTransactionLogs] Vault ID: ${event.vaultId} Logs: ${JSON.stringify(event.logs)} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultTransactionStatus(event: any): Promise<void> {
    console.log(`[VaultTransactionStatus] Vault ID: ${event.vaultId} Status: ${event.status} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  private async handleVaultTransactionError(event: any): Promise<void> {
    console.log(`[VaultTransactionError] Vault ID: ${event.vaultId} Error: ${event.error} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
    // Save to database or perform other actions as needed
  }

  // Get indexer status
  getStatus() {
    return {
      isRunning: this.isRunning,
      supportedEvents: Array.from(this.eventHandlers.keys()),
      startTime: this.isRunning ? new Date().toISOString() : null
    };
  }
}

// Create singleton instance
export const vaultEventIndexer = new VaultEventIndexer();

// Legacy function for backward compatibility
export async function startVaultEventIndexer() {
  vaultEventIndexer.start();
}

// Start indexer if called directly
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  vaultEventIndexer.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down event indexer...');
    vaultEventIndexer.stop();
    process.exit(0);
  });
}