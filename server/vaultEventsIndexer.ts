import { MaonoVaultService } from "./blockchain";

// Example: Listen for NAVUpdated events and log them
export async function startVaultEventIndexer() {
  MaonoVaultService.listenToEvents((event) => {
    if (event.type === "NAVUpdated") {
      console.log(`[NAVUpdated] New NAV: ${event.newNAV} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "PerformanceFeeDistributed") {
      console.log(`[PerformanceFeeDistributed] Amount: ${event.amount} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultCreated") {
      console.log(`[VaultCreated] Vault ID: ${event.vaultId} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultClosed") {
      console.log(`[VaultClosed] Vault ID: ${event.vaultId} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "DepositMade") {
      console.log(`[DepositMade] Amount: ${event.amount} to Vault ID: ${event.vaultId} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "WithdrawalMade") {
      console.log(`[WithdrawalMade] Amount: ${event.amount} from Vault ID: ${event.vaultId} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "FeeUpdated") {
      console.log(`[FeeUpdated] New Fee: ${event.newFee} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "DAOSettingsUpdated") {
      console.log(`[DAOSettingsUpdated] New Settings: ${JSON.stringify(event.newSettings)} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "OfframpFeePaid") {
      console.log(`[OfframpFeePaid] Amount: ${event.amount} by User: ${event.userId} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "DisbursementMade") {
      console.log(`[DisbursementMade] Amount: ${event.amount} from Vault ID: ${event.vaultId} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "WithdrawalFeePaid") {
      console.log(`[WithdrawalFeePaid] Amount: ${event.amount} by User: ${event.userId} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "OfframpWithdrawalMade") {
      console.log(`[OfframpWithdrawalMade] Amount: ${event.amount} by User: ${event.userId} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "OfframpFeeUpdated") {
      console.log(`[OfframpFeeUpdated] New Fee: ${event.newFee} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "OfframpWhoPaysUpdated") {
      console.log(`[OfframpWhoPaysUpdated] New Who Pays: ${event.newWhoPays} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "DisbursementFeeUpdated") {
      console.log(`[DisbursementFeeUpdated] New Fee: ${event.newFee} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "WithdrawalFeeUpdated") {
      console.log(`[WithdrawalFeeUpdated] New Fee: ${event.newFee} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed  
    } else if (event.type === "VaultStatusUpdated") {
      console.log(`[VaultStatusUpdated] Vault ID: ${event.vaultId} New Status: ${event.newStatus} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultMetadataUpdated") {
      console.log(`[VaultMetadataUpdated] Vault ID: ${event.vaultId} New Metadata: ${JSON.stringify(event.newMetadata)} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultOwnershipTransferred") {
      console.log(`[VaultOwnershipTransferred] Vault ID: ${event.vaultId} New Owner: ${event.newOwner} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultTypeUpdated") {
      console.log(`[VaultTypeUpdated] Vault ID: ${event.vaultId} New Type: ${event.newType} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultCurrencyUpdated") {
      console.log(`[VaultCurrencyUpdated] Vault ID: ${event.vaultId} New Currency: ${event.newCurrency} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed

    } else if (event.type === "VaultNameUpdated") {

      console.log(`[VaultNameUpdated] Vault ID: ${event.vaultId} New Name: ${event.newName} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultDescriptionUpdated") {
      console.log(`[VaultDescriptionUpdated] Vault ID: ${event.vaultId} New Description: ${event.newDescription} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultLogoUpdated") {
      console.log(`[VaultLogoUpdated] Vault ID: ${event.vaultId} New Logo: ${event.newLogo} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultBannerUpdated") {
      console.log(`[VaultBannerUpdated] Vault ID: ${event.vaultId} New Banner: ${event.newBanner} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultPrivacyUpdated") {
      console.log(`[VaultPrivacyUpdated] Vault ID: ${event.vaultId} New Privacy: ${event.newPrivacy} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultAccessControlUpdated") {
      console.log(`[VaultAccessControlUpdated] Vault ID: ${event.vaultId} New Access Control: ${JSON.stringify(event.newAccessControl)} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultTransactionRecorded") {
      console.log(`[VaultTransactionRecorded] Vault ID: ${event.vaultId} Transaction: ${JSON.stringify(event.transaction)} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultTransactionFailed") {
      console.log(`[VaultTransactionFailed] Vault ID: ${event.vaultId} Error: ${event.error} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultTransactionPending") {
      console.log(`[VaultTransactionPending] Vault ID: ${event.vaultId} Transaction: ${JSON.stringify(event.transaction)} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultTransactionConfirmed") {
      console.log(`[VaultTransactionConfirmed] Vault ID: ${event.vaultId} Transaction: ${JSON.stringify(event.transaction)} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultTransactionReverted") {
      console.log(`[VaultTransactionReverted] Vault ID: ${event.vaultId} Transaction: ${JSON.stringify(event.transaction)} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultTransactionGasUsed") {
      console.log(`[VaultTransactionGasUsed] Vault ID: ${event.vaultId} Gas Used: ${event.gasUsed} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultTransactionGasPrice") {
      console.log(`[VaultTransactionGasPrice] Vault ID: ${event.vaultId} Gas Price: ${event.gasPrice} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultTransactionNonce") {
      console.log(`[VaultTransactionNonce] Vault ID: ${event.vaultId} Nonce: ${event.nonce} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultTransactionBlockNumber") {
      console.log(`[VaultTransactionBlockNumber] Vault ID: ${event.vaultId} Block Number: ${event.blockNumber} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultTransactionBlockHash") {
      console.log(`[VaultTransactionBlockHash] Vault ID: ${event.vaultId} Block Hash: ${event.blockHash} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultTransactionFrom") {
      console.log(`[VaultTransactionFrom] Vault ID: ${event.vaultId} From: ${event.from} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed

    } else if (event.type === "VaultTransactionTo") {
      console.log(`[VaultTransactionTo] Vault ID: ${event.vaultId} To: ${event.to} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultTransactionValue") {
      console.log(`[VaultTransactionValue] Vault ID: ${event.vaultId} Value: ${event.value} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultTransactionInput") {
      console.log(`[VaultTransactionInput] Vault ID: ${event.vaultId} Input: ${event.input} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultTransactionReceipt") {
      console.log(`[VaultTransactionReceipt] Vault ID: ${event.vaultId} Receipt: ${JSON.stringify(event.receipt)} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultTransactionLogs") {
      console.log(`[VaultTransactionLogs] Vault ID: ${event.vaultId} Logs: ${JSON.stringify(event.logs)} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);  
      // Save to database or perform other actions as needed
    } else if (event.type === "VaultTransactionStatus") {
      console.log(`[VaultTransactionStatus] Vault ID: ${event.vaultId} Status: ${event.status} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);

      // Save to database or perform other actions as needed
    } else if (event.type === "VaultTransactionError") {
      console.log(`[VaultTransactionError] Vault ID: ${event.vaultId} Error: ${event.error} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Save to database or perform other actions as needed
    } else {
      console.log(`[UnknownEvent] Type: ${event.type} at ${new Date(Number(event.timestamp) * 1000).toISOString()}`);
      // Handle unknown events or log them for further analysis
      // Save to database or perform other actions as needed
      // For example:
      // await saveUnknownEventToDatabase(event);

      // Optionally, you can re-throw the error or handle it as needed
      throw new Error(`Unknown event type: ${event.type}`);

    }
    // Add more event handling as needed
  });
  console.log("Vault event indexer started.");
}

// To run as a script:
if (require.main === module) {
  startVaultEventIndexer();
}

// Example usage:
// startVaultEventIndexer().catch(err => console.error("Error starting indexer:", err));
// This function listens to vault events and logs them, allowing for real-time indexing and processing of vault-related activities.
// You can extend this to save events to a database or perform other actions as needed.

