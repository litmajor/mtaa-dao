/**
 * Solana Transaction Signing & Broadcasting Service
 * 
 * Handles transaction creation, signing, and broadcasting for SOL and SPL tokens.
 * Supports software signing and future HSM integration.
 */

import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { createTransferCheckedInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

// ============= TYPES & INTERFACES =============

interface SolanaSigningConfig {
  rpcUrl: string;
}

interface SolTransferRequest {
  fromAddress: string; // Public key
  toAddress: string;
  amount: string; // In lamports (1 SOL = 1 billion lamports)
  decimals?: number;
  memo?: string;
}

interface SplTokenTransferRequest extends SolTransferRequest {
  mint: string; // Token mint address
  fromTokenAccount: string; // Token account address
  toTokenAccount: string;
  decimals: number; // Must be provided for token transfers
}

interface SignedSolanaTransaction {
  signature: string;
  transaction: string; // Base64 encoded
  blockHash: string;
}

interface SolanaBroadcastResponse {
  signature: string;
  blockNumber?: number;
  blockTime?: number;
  status: 'confirmed' | 'finalized' | 'failed';
}

interface SolanaTransactionStatus {
  signature: string;
  status: 'processed' | 'confirmed' | 'finalized' | 'failed' | 'not_found';
  blockNumber?: number;
  blockTime?: number;
  fee?: number;
  error?: string;
}

// ============= CONSTANTS =============

const LAMPORTS_PER_SOL = 1000000000;
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

// ============= SOLANA TRANSACTION SIGNING SERVICE =============

class SolanaTransactionSigningService {
  private connection: Connection;

  constructor(config: SolanaSigningConfig) {
    this.connection = new Connection(config.rpcUrl, 'confirmed');
  }

  /**
   * Create unsigned SOL transfer transaction
   */
  async createSolTransferTransaction(request: SolTransferRequest): Promise<Transaction> {
    try {
      const { fromAddress, toAddress, amount, memo } = request;

      // Validate addresses
      if (!this.validateAddress(fromAddress)) {
        throw new AppError('Invalid from address format', 400);
      }
      if (!this.validateAddress(toAddress)) {
        throw new AppError('Invalid to address format', 400);
      }

      // Validate amount
      const amountNum = BigInt(amount);
      if (amountNum <= 0n || amountNum > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new AppError('Amount must be positive and within Solana client numeric precision', 400);
      }

      logger.info(`Creating SOL transfer: ${fromAddress} -> ${toAddress} (${amount} lamports)`);

      // Get latest blockhash
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      const feePayer = new PublicKey(fromAddress);
      const recipient = new PublicKey(toAddress);
      const transaction = new Transaction({ recentBlockhash: blockhash, feePayer })
        .add(SystemProgram.transfer({ fromPubkey: feePayer, toPubkey: recipient, lamports: Number(amountNum) }));
      if (memo) {
        transaction.add(new TransactionInstruction({
          keys: [],
          programId: new PublicKey(MEMO_PROGRAM_ID),
          data: Buffer.from(memo, 'utf8'),
        }));
      }
      const [balance, fee] = await Promise.all([
        this.connection.getBalance(feePayer, 'confirmed'),
        this.connection.getFeeForMessage(transaction.compileMessage(), 'confirmed'),
      ]);
      if (fee.value === null) throw new AppError('Solana RPC could not estimate the transaction fee', 503);
      if (BigInt(balance) < amountNum + BigInt(fee.value)) {
        throw new AppError('Source wallet balance does not cover the SOL amount and network fee', 400);
      }

      logger.info(`SOL transfer transaction created for ${fromAddress}`);

      return transaction;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create SOL transfer transaction', { error });
      throw new AppError('Failed to create SOL transfer transaction', 500);
    }
  }

  /**
   * Create unsigned SPL token transfer transaction
   */
  async createSplTokenTransferTransaction(request: SplTokenTransferRequest): Promise<Transaction> {
    try {
      const {
        fromAddress,
        toAddress,
        mint,
        fromTokenAccount,
        toTokenAccount,
        amount,
        decimals
      } = request;

      // Validate addresses
      if (!this.validateAddress(fromAddress)) {
        throw new AppError('Invalid from address format', 400);
      }
      if (!this.validateAddress(toAddress)) {
        throw new AppError('Invalid to address format', 400);
      }
      if (!this.validateAddress(mint)) {
        throw new AppError('Invalid mint address format', 400);
      }
      if (!this.validateAddress(fromTokenAccount)) {
        throw new AppError('Invalid from token account address', 400);
      }
      if (!this.validateAddress(toTokenAccount)) {
        throw new AppError('Invalid to token account address', 400);
      }

      const ownerPublicKey = new PublicKey(fromAddress);
      const sourcePublicKey = new PublicKey(fromTokenAccount);
      const destinationPublicKey = new PublicKey(toTokenAccount);
      const mintPublicKey = new PublicKey(mint);

      // Validate amount
      const amountNum = BigInt(amount);
      if (amountNum <= 0n || amountNum > (2n ** 64n) - 1n) {
        throw new AppError('SPL token amount must be positive and fit the token program u64 range', 400);
      }

      const mintInfo = await this.connection.getParsedAccountInfo(mintPublicKey, 'confirmed');
      const sourceInfo = await this.connection.getParsedAccountInfo(sourcePublicKey, 'confirmed');
      const destinationInfo = await this.connection.getParsedAccountInfo(destinationPublicKey, 'confirmed');
      if (!mintInfo.value || !('parsed' in mintInfo.value.data) || mintInfo.value.data.parsed.type !== 'mint' ||
          !sourceInfo.value || !('parsed' in sourceInfo.value.data) ||
          sourceInfo.value.data.parsed.type !== 'account' ||
          !destinationInfo.value || !('parsed' in destinationInfo.value.data) ||
          destinationInfo.value.data.parsed.type !== 'account') {
        throw new AppError('Mint and token accounts must exist on the selected Solana cluster', 400);
      }
      if (!mintInfo.value.owner.equals(TOKEN_PROGRAM_ID) ||
          !sourceInfo.value.owner.equals(TOKEN_PROGRAM_ID) ||
          !destinationInfo.value.owner.equals(TOKEN_PROGRAM_ID)) {
        throw new AppError('Only SPL Token Program accounts are supported by this transfer route', 400);
      }
      const mintData = mintInfo.value.data.parsed.info;
      const sourceData = sourceInfo.value.data.parsed.info;
      const destinationData = destinationInfo.value.data.parsed.info;
      if (sourceData.owner !== fromAddress || destinationData.owner !== toAddress ||
          sourceData.mint !== mint || destinationData.mint !== mint) {
        throw new AppError('Source owner and token account mints do not match the transfer request', 400);
      }
      if (mintData.decimals !== decimals) {
        throw new AppError(`Token mint decimals are ${mintData.decimals}; request supplied ${decimals}`, 400);
      }
      if (BigInt(sourceData.tokenAmount.amount) < amountNum) {
        throw new AppError('Source token account balance is less than the requested transfer amount', 400);
      }

      logger.info(`Creating SPL token transfer: ${amount} tokens (${decimals} decimals)`);

      // Get latest blockhash
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');

      // Create transfer instruction using createTransferCheckedInstruction
      const instruction = createTransferCheckedInstruction(
        sourcePublicKey,
        mintPublicKey,
        destinationPublicKey,
        ownerPublicKey,
        amountNum,
        decimals
      );

      // Create transaction
      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: ownerPublicKey
      });

      transaction.add(instruction);
      if (request.memo) {
        transaction.add(new TransactionInstruction({
          keys: [],
          programId: new PublicKey(MEMO_PROGRAM_ID),
          data: Buffer.from(request.memo, 'utf8'),
        }));
      }

      const [nativeBalance, fee] = await Promise.all([
        this.connection.getBalance(ownerPublicKey, 'confirmed'),
        this.connection.getFeeForMessage(transaction.compileMessage(), 'confirmed'),
      ]);
      if (fee.value === null) throw new AppError('Solana RPC could not estimate the SPL transaction fee', 503);
      if (BigInt(nativeBalance) < BigInt(fee.value)) {
        throw new AppError('Fee payer SOL balance does not cover the SPL transaction network fee', 400);
      }

      logger.info(`SPL token transfer transaction created`);

      return transaction;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create SPL token transfer transaction', { error });
      throw new AppError('Failed to create SPL token transfer transaction', 500);
    }
  }

  /**
   * Broadcast signed transaction to Solana network
   */
  async broadcastTransaction(signedTx: SignedSolanaTransaction): Promise<SolanaBroadcastResponse> {
    try {
      logger.info(`Broadcasting Solana transaction: ${signedTx.signature}`);

      // Deserialize transaction
      const txBuffer = Buffer.from(signedTx.transaction, 'base64');
      const transaction = Transaction.from(txBuffer);

      // Send transaction
      const signature = await this.connection.sendRawTransaction(txBuffer);

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        throw new AppError('Transaction failed', 500);
      }

      logger.info(`Transaction broadcasted successfully: ${signature}`);

      // Get block info
      const blockTime = await this.connection.getBlockTime(confirmation.context.slot);

      return {
        signature,
        blockNumber: confirmation.context.slot,
        blockTime: blockTime || undefined,
        status: 'confirmed'
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to broadcast Solana transaction', { error });
      throw new AppError('Failed to broadcast Solana transaction', 500);
    }
  }

  async submitWalletSignedTransaction(transaction: Transaction): Promise<SolanaBroadcastResponse> {
    try {
      const feePayer = transaction.compileMessage().accountKeys[0];
      if (!feePayer || !transaction.signature || !transaction.verifySignatures()) {
        throw new AppError('Transaction must contain valid signatures from every required signer', 400);
      }
      const serialized = transaction.serialize({ requireAllSignatures: true, verifySignatures: true });
      return await this.broadcastTransaction({
        signature: transaction.signature.toString('base64'),
        transaction: serialized.toString('base64'),
        blockHash: transaction.recentBlockhash ?? '',
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to submit wallet-signed Solana transaction', { error });
      throw new AppError('Failed to verify or submit the wallet-signed Solana transaction', 400);
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(signature: string): Promise<SolanaTransactionStatus> {
    try {
      logger.info(`Fetching Solana transaction status: ${signature}`);

      const [signatureStatus] = (await this.connection.getSignatureStatuses(
        [signature],
        { searchTransactionHistory: true }
      )).value;
      if (!signatureStatus) return { signature, status: 'not_found' };

      const tx = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0
      });
      const status: SolanaTransactionStatus['status'] = signatureStatus.err
        ? 'failed'
        : signatureStatus.confirmationStatus === 'finalized'
          ? 'finalized'
          : signatureStatus.confirmationStatus === 'confirmed'
            ? 'confirmed'
            : 'processed';

      return {
        signature,
        status,
        blockNumber: tx?.slot ?? signatureStatus.slot,
        blockTime: tx?.blockTime ?? undefined,
        fee: tx?.meta?.fee,
      };
    } catch (error) {
      logger.error('Failed to get Solana transaction status', { error });
      throw new AppError('Failed to get Solana transaction status', 500);
    }
  }

  /**
   * Estimate transaction fees
   */
  async estimateFees(address: string): Promise<{ minimumTokenAccountRentLamports: number; networkFeeLamports: number }> {
    try {
      const feePayer = new PublicKey(address);
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      const transaction = new Transaction({ feePayer, recentBlockhash: blockhash });
      transaction.add(SystemProgram.transfer({ fromPubkey: feePayer, toPubkey: feePayer, lamports: 1 }));
      const networkFeeLamports = await this.connection.getFeeForMessage(transaction.compileMessage(), 'confirmed');
      if (networkFeeLamports.value === null) throw new AppError('Solana RPC could not estimate the transfer fee', 503);
      const minRent = await this.connection.getMinimumBalanceForRentExemption(165); // SPL Token account size

      return {
        minimumTokenAccountRentLamports: minRent,
        networkFeeLamports: networkFeeLamports.value,
      };
    } catch (error) {
      logger.error('Failed to estimate Solana fees', { error });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to estimate Solana fees', 500);
    }
  }

  async getTokenDecimals(mint: string): Promise<number> {
    try {
      const mintInfo = await this.connection.getParsedAccountInfo(new PublicKey(mint), 'confirmed');
      if (!mintInfo.value || !('parsed' in mintInfo.value.data) || mintInfo.value.data.parsed.type !== 'mint') {
        throw new AppError('Token mint not found on the selected Solana cluster', 404);
      }
      return mintInfo.value.data.parsed.info.decimals;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to read token mint decimals from the configured Solana RPC', 503);
    }
  }

  /**
   * Validate Solana address format
   */
  validateAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get account info
   */
  async getAccountInfo(address: string): Promise<{
    address: string;
    balance: number;
    balanceSOL: string;
    executable: boolean;
    owner: string;
  }> {
    try {
      const pubkey = new PublicKey(address);
      const accountInfo = await this.connection.getAccountInfo(pubkey);

      if (!accountInfo) {
        throw new AppError('Account not found', 404);
      }

      return {
        address,
        balance: accountInfo.lamports,
        balanceSOL: (accountInfo.lamports / LAMPORTS_PER_SOL).toFixed(9),
        executable: accountInfo.executable,
        owner: accountInfo.owner.toBase58()
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to get Solana account info', { error });
      throw new AppError('Failed to get Solana account info', 500);
    }
  }
}

// ============= SERVICE INSTANCES =============

const solanaSigningService = new SolanaTransactionSigningService({
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
});

const solanaDevnetSigningService = new SolanaTransactionSigningService({
  rpcUrl: process.env.SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com'
});

export {
  SolanaTransactionSigningService,
  solanaSigningService,
  solanaDevnetSigningService,
};

export type {
  SolanaSigningConfig,
  SolTransferRequest,
  SplTokenTransferRequest,
  SignedSolanaTransaction,
  SolanaBroadcastResponse,
  SolanaTransactionStatus
};
