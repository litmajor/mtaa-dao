/**
 * Solana Transaction Signing & Broadcasting Service
 * 
 * Handles transaction creation, signing, and broadcasting for SOL and SPL tokens.
 * Supports software signing and future HSM integration.
 */

import { Connection, PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import { createTransferInstruction, createTransferCheckedInstruction, getAssociatedTokenAddress } from '@solana/spl-token';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

// ============= TYPES & INTERFACES =============

interface SolanaSigningConfig {
  chainId: 'mainnet' | 'devnet';
  rpcUrl: string;
  privateKey?: string; // For software signing (development only)
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
  status: 'confirmed' | 'finalized' | 'failed' | 'not_found';
  blockNumber?: number;
  blockTime?: number;
  fee?: number;
  error?: string;
}

// ============= CONSTANTS =============

const SOL_DECIMALS = 9; // SOL has 9 decimal places
const LAMPORTS_PER_SOL = 1000000000;

// ============= SOLANA TRANSACTION SIGNING SERVICE =============

class SolanaTransactionSigningService {
  private connection: Connection;
  private config: SolanaSigningConfig;
  private chainType: 'mainnet' | 'devnet';

  constructor(config: SolanaSigningConfig) {
    this.config = config;
    this.chainType = config.chainId;
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
      if (amountNum <= 0n) {
        throw new AppError('Amount must be greater than 0', 400);
      }

      logger.info(`Creating SOL transfer: ${fromAddress} -> ${toAddress} (${amount} lamports)`);

      const fromPubkey = new PublicKey(fromAddress);
      const toPubkey = new PublicKey(toAddress);

      // Get latest blockhash
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');

      // Create transfer instruction
      const instruction = SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: Number(amount)
      });

      // Create transaction
      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: fromPubkey
      });

      transaction.add(instruction);

      // Add memo if provided
      if (memo) {
        // Memo instruction would go here (requires separate implementation)
        logger.info(`Memo requested but not implemented: ${memo}`);
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

      // Validate amount
      const amountNum = BigInt(amount);
      if (amountNum <= 0n) {
        throw new AppError('Amount must be greater than 0', 400);
      }

      logger.info(`Creating SPL token transfer: ${amount} tokens (${decimals} decimals)`);

      const ownerPublicKey = new PublicKey(fromAddress);
      const sourcePublicKey = new PublicKey(fromTokenAccount);
      const destinationPublicKey = new PublicKey(toTokenAccount);
      const mintPublicKey = new PublicKey(mint);

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

      logger.info(`SPL token transfer transaction created`);

      return transaction;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create SPL token transfer transaction', { error });
      throw new AppError('Failed to create SPL token transfer transaction', 500);
    }
  }

  /**
   * Sign transaction with private key (software signing)
   */
  async signTransaction(
    transaction: Transaction,
    privateKey: string
  ): Promise<SignedSolanaTransaction> {
    try {
      if (!privateKey || privateKey.length !== 88) {
        // Base58 encoded keypair is 88 characters
        throw new AppError('Invalid private key format', 400);
      }

      logger.info(`Signing Solana transaction`);

      // Import keypair from secret key
      const keypair = Keypair.fromSecretKey(
        Buffer.from(privateKey, 'base64') // Assuming base64 encoded
      );

      // Sign transaction
      transaction.sign(keypair);

      // Verify transaction is signed
      if (!transaction.signature) {
        throw new AppError('Failed to sign transaction', 500);
      }

      const signature = transaction.signature.toString('base64');

      logger.info(`Transaction signed successfully`);

      return {
        signature,
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        blockHash: transaction.recentBlockhash || ''
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to sign Solana transaction', { error });
      throw new AppError('Failed to sign Solana transaction', 500);
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

  /**
   * Create and sign transaction in one call
   */
  async createAndSignSolTransfer(
    request: SolTransferRequest & { privateKey: string }
  ): Promise<SignedSolanaTransaction> {
    try {
      const { privateKey, ...transferRequest } = request;

      // Create transaction
      const transaction = await this.createSolTransferTransaction(transferRequest);

      // Sign transaction
      return await this.signTransaction(transaction, privateKey);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create and sign SOL transfer', { error });
      throw new AppError('Failed to create and sign SOL transfer', 500);
    }
  }

  /**
   * Create and sign token transfer in one call
   */
  async createAndSignSplTokenTransfer(
    request: SplTokenTransferRequest & { privateKey: string }
  ): Promise<SignedSolanaTransaction> {
    try {
      const { privateKey, ...transferRequest } = request;

      // Create transaction
      const transaction = await this.createSplTokenTransferTransaction(transferRequest);

      // Sign transaction
      return await this.signTransaction(transaction, privateKey);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create and sign SPL token transfer', { error });
      throw new AppError('Failed to create and sign SPL token transfer', 500);
    }
  }

  /**
   * Execute full transfer flow
   */
  async executeSolTransfer(
    request: SolTransferRequest & { privateKey: string }
  ): Promise<SolanaBroadcastResponse> {
    try {
      // Create and sign
      const signedTx = await this.createAndSignSolTransfer(request);

      // Broadcast
      return await this.broadcastTransaction(signedTx);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to execute SOL transfer', { error });
      throw new AppError('Failed to execute SOL transfer', 500);
    }
  }

  /**
   * Execute full token transfer flow
   */
  async executeSplTokenTransfer(
    request: SplTokenTransferRequest & { privateKey: string }
  ): Promise<SolanaBroadcastResponse> {
    try {
      // Create and sign
      const signedTx = await this.createAndSignSplTokenTransfer(request);

      // Broadcast
      return await this.broadcastTransaction(signedTx);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to execute SPL token transfer', { error });
      throw new AppError('Failed to execute SPL token transfer', 500);
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(signature: string): Promise<SolanaTransactionStatus> {
    try {
      logger.info(`Fetching Solana transaction status: ${signature}`);

      const tx = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0
      });

      if (!tx) {
        return {
          signature,
          status: 'not_found'
        };
      }

      let status: SolanaTransactionStatus['status'] = 'confirmed';
      if (tx.blockTime) {
        // If we have blockTime, it's confirmed
        status = 'confirmed';
      }

      return {
        signature,
        status,
        blockNumber: tx.slot,
        blockTime: tx.blockTime || undefined,
        fee: tx.meta?.fee
      };
    } catch (error) {
      logger.error('Failed to get Solana transaction status', { error });
      throw new AppError('Failed to get Solana transaction status', 500);
    }
  }

  /**
   * Estimate transaction fees
   */
  async estimateFees(): Promise<{
    minRent: number;
    recentFees: number;
    averageFee: number;
  }> {
    try {
      const fees = await this.connection.getRecentBlockhash('confirmed');
      const feeCalculator = fees.feeCalculator;

      // Get minimum rent for token account
      const minRent = await this.connection.getMinimumBalanceForRentExemption(165); // SPL Token account size

      return {
        minRent,
        recentFees: feeCalculator.lamportsPerSignature,
        averageFee: feeCalculator.lamportsPerSignature
      };
    } catch (error) {
      logger.error('Failed to estimate Solana fees', { error });
      throw new AppError('Failed to estimate Solana fees', 500);
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
  chainId: 'mainnet',
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
});

const solanaDevnetSigningService = new SolanaTransactionSigningService({
  chainId: 'devnet',
  rpcUrl: process.env.SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com'
});

export {
  SolanaTransactionSigningService,
  solanaSigningService,
  solanaDevnetSigningService,
  // Types
  SolanaSigningConfig,
  SolTransferRequest,
  SplTokenTransferRequest,
  SignedSolanaTransaction,
  SolanaBroadcastResponse,
  SolanaTransactionStatus
};
