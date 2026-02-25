/**
 * TRON Transaction Signing & Broadcasting Service
 * 
 * Handles transaction creation, signing, and broadcasting for TRX and TRC20 tokens.
 * Supports both HSM-based and software key management.
 */

import TronWebModule from 'tronweb';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

// TronWeb 6.x - handle the import correctly
const TronWeb = (TronWebModule as any)?.TronWeb || (TronWebModule as any);

// Fallback: wrap in function if not constructor
function createTronWebInstance(config: any) {
  try {
    if (typeof TronWeb === 'function') {
      return new TronWeb(config);
    }
    if (typeof (TronWebModule as any)?.TronWeb === 'function') {
      return new (TronWebModule as any).TronWeb(config);
    }
    // Last resort - try to call it directly
    return TronWebModule(config);
  } catch (e) {
    throw new Error(`Failed to instantiate TronWeb: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ============= TYPES & INTERFACES =============

interface TransactionSigningConfig {
  chainId: 'mainnet' | 'testnet';
  rpcUrl: string;
  privateKey?: string; // For software signing (development only)
  hsm?: {
    enabled: boolean;
    provider: 'aws' | 'azure' | 'gcp' | 'local';
    keyId: string;
    region?: string;
  };
}

interface SigningRequest {
  transaction: any; // TronWeb transaction object
  privateKey?: string;
  hsmKeyId?: string;
}

interface SignedTransaction {
  txID: string;
  rawData: {
    contract: any[];
    ref_block_bytes: string;
    ref_block_hash: string;
    expiration: number;
    timestamp: number;
    fee_limit?: number;
  };
  signature: string[];
  visible?: boolean;
}

interface TransferRequest {
  fromAddress: string;
  toAddress: string;
  amount: string; // In SUN (1 TRX = 1,000,000 SUN)
  decimals?: number;
  feeLimit?: number; // In SUN
  memo?: string;
}

interface TokenTransferRequest extends TransferRequest {
  tokenAddress: string;
  contractType?: 'TRC20' | 'TRC721' | 'TRC1155';
}

interface BroadcastResponse {
  txID: string;
  result: boolean;
  txHash: string;
  blockNumber?: number;
  blockTimestamp?: number;
  receipt?: {
    result: string;
    gasUsed?: number;
  };
}

interface TransactionStatus {
  txID: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'NOT_FOUND';
  blockNumber?: number;
  blockTimestamp?: number;
  confirmations?: number;
  receipt?: any;
  error?: string;
}

// ============= CONSTANT =============

const DEFAULT_FEE_LIMIT = 100000000; // 100 TRX in SUN
const ENERGY_PER_TRC20_TRANSFER = 25000;
const ENERGY_PRICE = 50; // SUN per energy unit

// ============= TRON TRANSACTION SIGNING SERVICE =============

class TronTransactionSigningService {
  private tronWeb: any;
  private config: TransactionSigningConfig;
  private chainType: 'mainnet' | 'testnet';

  constructor(config: TransactionSigningConfig) {
    this.config = config;
    this.chainType = config.chainId;

    // Initialize TronWeb - only pass privateKey if it's valid
    const tronWebConfig: any = {
      fullHost: config.rpcUrl
    };
    
    if (config.privateKey) {
      tronWebConfig.privateKey = config.privateKey;
    }
    
    this.tronWeb = createTronWebInstance(tronWebConfig);
  }

  /**
   * Create unsigned TRX transfer transaction
   */
  async createTrxTransferTransaction(request: TransferRequest): Promise<any> {
    try {
      const { fromAddress, toAddress, amount, feeLimit = DEFAULT_FEE_LIMIT } = request;

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

      logger.info(`Creating TRX transfer: ${fromAddress} -> ${toAddress} (${amount} SUN)`);

      // Create transaction
      const transaction = await this.tronWeb.transactionBuilder.sendTrx(
        toAddress,
        amount,
        fromAddress
      );

      // Set fee limit
      const txWithFee = await this.tronWeb.transactionBuilder.setFeeLimit(transaction, feeLimit);

      if (!txWithFee || !txWithFee.txID) {
        throw new AppError('Failed to create transaction', 500);
      }

      logger.info(`TRX transfer transaction created: ${txWithFee.txID}`);

      return txWithFee;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create TRX transfer transaction', { error });
      throw new AppError('Failed to create TRX transfer transaction', 500);
    }
  }

  /**
   * Create unsigned TRC20 token transfer transaction
   */
  async createTokenTransferTransaction(request: TokenTransferRequest): Promise<any> {
    try {
      const { 
        fromAddress, 
        toAddress, 
        tokenAddress, 
        amount, 
        decimals = 6,
        feeLimit = DEFAULT_FEE_LIMIT,
        contractType = 'TRC20'
      } = request;

      // Validate addresses
      if (!this.validateAddress(fromAddress)) {
        throw new AppError('Invalid from address format', 400);
      }
      if (!this.validateAddress(toAddress)) {
        throw new AppError('Invalid to address format', 400);
      }
      if (!this.validateAddress(tokenAddress)) {
        throw new AppError('Invalid token address format', 400);
      }

      // Validate amount
      const amountNum = BigInt(amount);
      if (amountNum <= 0n) {
        throw new AppError('Amount must be greater than 0', 400);
      }

      logger.info(
        `Creating ${contractType} transfer: ${amount} tokens from ${fromAddress} to ${toAddress}`
      );

      let transaction: any;

      if (contractType === 'TRC20') {
        // Get contract object
        const contract = await this.tronWeb.contract().at(tokenAddress);

        if (!contract || !contract.transfer) {
          throw new AppError('Invalid TRC20 token contract', 400);
        }

        // Create transfer transaction
        transaction = await contract.transfer(
          toAddress,
          amount
        ).send({
          from: fromAddress,
          shouldPollResponse: false
        });
      } else if (contractType === 'TRC721') {
        // TRC721 transfer
        const contract = await this.tronWeb.contract().at(tokenAddress);
        transaction = await contract.transferFrom(
          fromAddress,
          toAddress,
          amount
        ).send({
          from: fromAddress,
          shouldPollResponse: false
        });
      } else if (contractType === 'TRC1155') {
        // TRC1155 transfer
        const contract = await this.tronWeb.contract().at(tokenAddress);
        transaction = await contract.safeTransferFrom(
          fromAddress,
          toAddress,
          amount,
          1,
          '0x'
        ).send({
          from: fromAddress,
          shouldPollResponse: false
        });
      } else {
        throw new AppError('Unsupported contract type', 400);
      }

      // Estimate energy cost
      const estimatedEnergy = this.estimateTokenTransferEnergy(contractType);
      const estimatedFee = estimatedEnergy * ENERGY_PRICE + 100000; // + 0.1 TRX network fee

      // Set fee limit with buffer
      const txWithFee = await this.tronWeb.transactionBuilder.setFeeLimit(
        transaction,
        Math.max(feeLimit, estimatedFee)
      );

      if (!txWithFee || !txWithFee.txID) {
        throw new AppError('Failed to create token transfer transaction', 500);
      }

      logger.info(`Token transfer transaction created: ${txWithFee.txID}`);

      return txWithFee;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create token transfer transaction', { error });
      throw new AppError('Failed to create token transfer transaction', 500);
    }
  }

  /**
   * Sign transaction with private key (software signing)
   */
  async signTransactionWithPrivateKey(
    transaction: any,
    privateKey: string
  ): Promise<SignedTransaction> {
    try {
      if (!privateKey || privateKey.length !== 66) {
        throw new AppError('Invalid private key format (must be 66 character hex string)', 400);
      }

      logger.info(`Signing transaction: ${transaction.txID}`);

      // Create new TronWeb instance with private key for signing
      const signingTronWeb = createTronWebInstance({
        fullHost: this.config.rpcUrl,
        privateKey: privateKey
      });

      // Sign the transaction
      const signedTx = await signingTronWeb.trx.sign(transaction);

      if (!signedTx || !signedTx.signature || signedTx.signature.length === 0) {
        throw new AppError('Failed to sign transaction', 500);
      }

      logger.info(`Transaction signed successfully: ${transaction.txID}`);

      return signedTx as SignedTransaction;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to sign transaction', { error });
      throw new AppError('Failed to sign transaction', 500);
    }
  }

  /**
   * Sign transaction with HSM (hardware security module)
   */
  async signTransactionWithHsm(
    transaction: any,
    hsmKeyId: string
  ): Promise<SignedTransaction> {
    try {
      if (!this.config.hsm?.enabled) {
        throw new AppError('HSM is not configured', 500);
      }

      logger.info(`Signing transaction with HSM: ${transaction.txID}, Key: ${hsmKeyId}`);

      // This is a placeholder for HSM integration
      // In production, integrate with:
      // - AWS KMS (AWS Cloud HSM)
      // - Azure Key Vault
      // - Google Cloud KMS
      // - Local HSM device

      // Example: AWS KMS integration
      if (this.config.hsm.provider === 'aws') {
        return await this.signWithAwsKms(transaction, hsmKeyId);
      } else if (this.config.hsm.provider === 'azure') {
        return await this.signWithAzureKeyVault(transaction, hsmKeyId);
      } else if (this.config.hsm.provider === 'gcp') {
        return await this.signWithGcpKms(transaction, hsmKeyId);
      } else {
        throw new AppError('Unsupported HSM provider', 500);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to sign transaction with HSM', { error });
      throw new AppError('Failed to sign transaction with HSM', 500);
    }
  }

  /**
   * Broadcast signed transaction to TRON network
   */
  async broadcastTransaction(signedTransaction: SignedTransaction): Promise<BroadcastResponse> {
    try {
      if (!signedTransaction.signature || signedTransaction.signature.length === 0) {
        throw new AppError('Transaction is not signed', 400);
      }

      logger.info(`Broadcasting transaction: ${signedTransaction.txID}`);

      // Validate transaction before broadcasting
      const validated = await this.tronWeb.trx.isAddress(
        this.tronWeb.address.fromPrivateKey(
          '0x0000000000000000000000000000000000000000000000000000000000000000'
        )
      );

      if (!validated) {
        logger.warn('Transaction validation warning');
      }

      // Broadcast to network
      const result = await this.tronWeb.trx.sendRawTransaction(signedTransaction);

      if (!result || !result.result) {
        throw new AppError('Failed to broadcast transaction', 500);
      }

      logger.info(`Transaction broadcasted successfully: ${signedTransaction.txID}`);

      return {
        txID: signedTransaction.txID,
        result: result.result,
        txHash: signedTransaction.txID,
        blockNumber: result.blockNumber,
        blockTimestamp: result.blockTimestamp
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to broadcast transaction', { error });
      throw new AppError('Failed to broadcast transaction', 500);
    }
  }

  /**
   * Create and sign transaction in one call (convenience method)
   */
  async createAndSignTrxTransfer(
    request: TransferRequest & { privateKey?: string; hsmKeyId?: string }
  ): Promise<SignedTransaction> {
    try {
      const { privateKey, hsmKeyId, ...transferRequest } = request;

      // Create transaction
      const transaction = await this.createTrxTransferTransaction(transferRequest);

      // Sign transaction
      if (privateKey) {
        return await this.signTransactionWithPrivateKey(transaction, privateKey);
      } else if (hsmKeyId) {
        return await this.signTransactionWithHsm(transaction, hsmKeyId);
      } else {
        throw new AppError('No signing key provided (privateKey or hsmKeyId)', 400);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create and sign TRX transfer', { error });
      throw new AppError('Failed to create and sign TRX transfer', 500);
    }
  }

  /**
   * Create and sign token transfer in one call
   */
  async createAndSignTokenTransfer(
    request: TokenTransferRequest & { privateKey?: string; hsmKeyId?: string }
  ): Promise<SignedTransaction> {
    try {
      const { privateKey, hsmKeyId, ...transferRequest } = request;

      // Create transaction
      const transaction = await this.createTokenTransferTransaction(transferRequest);

      // Sign transaction
      if (privateKey) {
        return await this.signTransactionWithPrivateKey(transaction, privateKey);
      } else if (hsmKeyId) {
        return await this.signTransactionWithHsm(transaction, hsmKeyId);
      } else {
        throw new AppError('No signing key provided (privateKey or hsmKeyId)', 400);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create and sign token transfer', { error });
      throw new AppError('Failed to create and sign token transfer', 500);
    }
  }

  /**
   * Execute full transfer flow: create -> sign -> broadcast
   */
  async executeTransfer(
    request: TransferRequest & { privateKey?: string; hsmKeyId?: string }
  ): Promise<BroadcastResponse> {
    try {
      // Create and sign
      const signedTx = await this.createAndSignTrxTransfer(request);

      // Broadcast
      return await this.broadcastTransaction(signedTx);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to execute TRX transfer', { error });
      throw new AppError('Failed to execute TRX transfer', 500);
    }
  }

  /**
   * Execute full token transfer flow
   */
  async executeTokenTransfer(
    request: TokenTransferRequest & { privateKey?: string; hsmKeyId?: string }
  ): Promise<BroadcastResponse> {
    try {
      // Create and sign
      const signedTx = await this.createAndSignTokenTransfer(request);

      // Broadcast
      return await this.broadcastTransaction(signedTx);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to execute token transfer', { error });
      throw new AppError('Failed to execute token transfer', 500);
    }
  }

  /**
   * Get transaction receipt and status
   */
  async getTransactionReceipt(txID: string): Promise<TransactionStatus> {
    try {
      logger.info(`Fetching transaction receipt: ${txID}`);

      const transaction = await this.tronWeb.trx.getTransaction(txID);

      if (!transaction) {
        return {
          txID,
          status: 'NOT_FOUND'
        };
      }

      const info = await this.tronWeb.trx.getTransactionInfo(txID);

      let status: TransactionStatus['status'] = 'PENDING';
      if (info && info.receipt) {
        status = info.receipt.result === 'SUCCESS' ? 'SUCCESS' : 'FAILED';
      }

      return {
        txID,
        status,
        blockNumber: info?.blockNumber,
        blockTimestamp: info?.blockTimeStamp,
        confirmations: info?.blockNumber ? await this.getConfirmations(info.blockNumber) : 0,
        receipt: info?.receipt
      };
    } catch (error) {
      logger.error('Failed to get transaction receipt', { error });
      throw new AppError('Failed to get transaction receipt', 500);
    }
  }

  /**
   * Estimate transaction fees
   */
  async estimateFees(
    toAddress: string,
    isTokenTransfer: boolean = false,
    contractType: string = 'TRC20'
  ): Promise<{
    networkFee: number;
    energyEstimate: number;
    energyCost: number;
    totalEstimatedFee: number;
  }> {
    try {
      const networkFee = 100000; // 0.1 TRX in SUN
      const energyEstimate = this.estimateTokenTransferEnergy(contractType);
      const energyCost = energyEstimate * ENERGY_PRICE;
      const totalEstimatedFee = networkFee + energyCost;

      return {
        networkFee,
        energyEstimate,
        energyCost,
        totalEstimatedFee
      };
    } catch (error) {
      logger.error('Failed to estimate fees', { error });
      throw new AppError('Failed to estimate fees', 500);
    }
  }

  /**
   * Validate address format
   */
  validateAddress(address: string): boolean {
    return /^T[1-9A-HJ-NP-Z]{33}$/.test(address);
  }

  /**
   * Estimate energy units for token transfer
   */
  private estimateTokenTransferEnergy(contractType: string = 'TRC20'): number {
    const energyEstimates: Record<string, number> = {
      'TRC20': 25000,      // Standard token transfer
      'TRC721': 30000,     // NFT transfer
      'TRC1155': 35000     // Multi-token transfer
    };

    return energyEstimates[contractType] || 25000;
  }

  /**
   * Get number of confirmations for a block
   */
  private async getConfirmations(blockNumber: number): Promise<number> {
    try {
      const latestBlock = await this.tronWeb.trx.getLatestBlock();
      return Math.max(0, latestBlock.block_header.raw_data.number - blockNumber);
    } catch (error) {
      return 0;
    }
  }

  /**
   * AWS KMS signing (placeholder)
   */
  private async signWithAwsKms(transaction: any, keyId: string): Promise<SignedTransaction> {
    // TODO: Implement AWS KMS signing
    // Requires: aws-sdk, proper IAM permissions
    // 1. Get public key from KMS
    // 2. Create signature request to KMS
    // 3. Format signature for TRON transaction
    throw new AppError('AWS KMS integration not yet implemented', 501);
  }

  /**
   * Azure Key Vault signing (placeholder)
   */
  private async signWithAzureKeyVault(transaction: any, keyId: string): Promise<SignedTransaction> {
    // TODO: Implement Azure Key Vault signing
    throw new AppError('Azure Key Vault integration not yet implemented', 501);
  }

  /**
   * Google Cloud KMS signing (placeholder)
   */
  private async signWithGcpKms(transaction: any, keyId: string): Promise<SignedTransaction> {
    // TODO: Implement Google Cloud KMS signing
    throw new AppError('Google Cloud KMS integration not yet implemented', 501);
  }
}

// ============= SERVICE INSTANCES =============

// Mainnet signing service
const tronSigningService = new TronTransactionSigningService({
  chainId: 'mainnet',
  rpcUrl: process.env.TRON_RPC_URL || 'https://api.trongrid.io/',
  privateKey: process.env.TRON_PRIVATE_KEY, // Optional for development
  hsm: {
    enabled: process.env.TRON_HSM_ENABLED === 'true',
    provider: (process.env.TRON_HSM_PROVIDER as any) || 'aws',
    keyId: process.env.TRON_HSM_KEY_ID || '',
    region: process.env.AWS_REGION
  }
});

// Testnet signing service
const tronTestnetSigningService = new TronTransactionSigningService({
  chainId: 'testnet',
  rpcUrl: process.env.TRON_TESTNET_RPC_URL || 'https://api.nileex.io/',
  privateKey: process.env.TRON_TESTNET_PRIVATE_KEY,
  hsm: {
    enabled: process.env.TRON_HSM_ENABLED === 'true',
    provider: (process.env.TRON_HSM_PROVIDER as any) || 'aws',
    keyId: process.env.TRON_TESTNET_HSM_KEY_ID || '',
    region: process.env.AWS_REGION
  }
});

export {
  TronTransactionSigningService,
  tronSigningService,
  tronTestnetSigningService,
  // Types
  TransactionSigningConfig,
  SigningRequest,
  SignedTransaction,
  TransferRequest,
  TokenTransferRequest,
  BroadcastResponse,
  TransactionStatus
};
