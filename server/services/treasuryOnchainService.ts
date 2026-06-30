import { ethers } from 'ethers';
import { Logger } from '../utils/logger';
import { AppError, ValidationError } from '../middleware/errorHandler';
import { TreasuryMultisigService } from './treasuryMultisigService';
import { db } from '../db';
import { treasuryMultisigTransactions, multisigWallets } from '../../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * TreasuryOnchainService
 * Handles all on-chain interactions for multisig treasury operations
 * Uses ethers.js v5 or v6 to interact with ChamaTreasury contract on Celo
 * 
 * Environment Variables Required:
 * - CELO_RPC_URL: RPC endpoint (Alfajores testnet or Mainnet)
 * - CELO_MAINNET_PRIVATE_KEY: Private key for transaction signing (mainnet)
 * - CELO_ALFAJORES_PRIVATE_KEY: Private key for transaction signing (testnet)
 * - CHAMA_TREASURY_ADDRESS: Deployed ChamaTreasury contract address
 * - CHAMA_FACTORY_CONTRACT_ADDRESS: Factory contract for deploying multisigs
 * - CHAIN_ID: 44787 (Alfajores) or 42220 (Mainnet)
 */
export class TreasuryOnchainService {
  private provider: ethers.AbstractProvider;
  private signer: ethers.Signer;
  private chainId: number;
  private chamaContractAddress: string;
  private factoryContractAddress: string;
  private logger = new Logger('TreasuryOnchainService');

  constructor() {
    // Initialize provider and signer from environment
    const rpcUrl = process.env.CELO_RPC_URL || process.env.CELO_ALFAJORES_RPC_URL;
    if (!rpcUrl) {
      throw new AppError('CELO_RPC_URL or CELO_ALFAJORES_RPC_URL must be set', 500);
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Use Alfajores testnet by default, fall back to Mainnet
    const privateKey = process.env.CELO_ALFAJORES_PRIVATE_KEY || process.env.CELO_MAINNET_PRIVATE_KEY;
    if (!privateKey) {
      throw new AppError('CELO_ALFAJORES_PRIVATE_KEY or CELO_MAINNET_PRIVATE_KEY must be set', 500);
    }

    this.signer = new ethers.Wallet(privateKey, this.provider);

    // Chain configuration
    this.chainId = parseInt(process.env.CHAIN_ID || '44787', 10); // Default to Alfajores testnet
    
    // Contract addresses
    this.chamaContractAddress = process.env.CHAMA_TREASURY_ADDRESS || '';
    this.factoryContractAddress = process.env.CHAMA_FACTORY_CONTRACT_ADDRESS || '';

    if (!this.chamaContractAddress || !this.factoryContractAddress) {
      this.logger.warn(
        'CHAMA_TREASURY_ADDRESS or CHAMA_FACTORY_CONTRACT_ADDRESS not configured. ' +
        'On-chain operations will be limited.'
      );
    }
  }

  /**
   * Deploy a new multisig wallet (Gnosis Safe or compatible)
   * Calls the factory contract to create a new multisig wallet
   * 
   * @param daoId DAO identifier
   * @param signers Array of signer addresses
   * @param requiredSignatures M in M-of-N
   * @returns Transaction receipt with contract address
   */
  async deployMultisigWallet(
    daoId: string,
    signers: string[],
    requiredSignatures: number
  ): Promise<{ contractAddress: string; txHash: string; gasUsed: string }> {
    try {
      // Validate inputs
      if (!signers.length) {
        throw new ValidationError('At least one signer required');
      }

      if (requiredSignatures > signers.length) {
        throw new ValidationError(
          `Required signatures (${requiredSignatures}) cannot exceed number of signers (${signers.length})`
        );
      }

      if (requiredSignatures < 1) {
        throw new ValidationError('At least 1 required signature needed');
      }

      // Get factory contract ABI (basic interface for deployment)
      const factoryABI = [
        'function createMultisig(address[] signers, uint256 requiredSignatures) returns (address)',
        'event MultisigCreated(address indexed multisig, address[] signers, uint256 requiredSignatures)'
      ];

      const factory = new ethers.Contract(
        this.factoryContractAddress,
        factoryABI,
        this.signer
      );

      this.logger.info(`Deploying multisig for DAO ${daoId} with ${signers.length} signers, ${requiredSignatures} required`);

      // Call factory to create multisig
      const tx = await factory.createMultisig(signers, requiredSignatures);
      const receipt = await tx.wait();

      if (!receipt || !receipt.contractAddress) {
        throw new AppError('Failed to deploy multisig contract', 500);
      }

      this.logger.info(
        `Successfully deployed multisig at ${receipt.contractAddress} (txHash: ${receipt.hash})`
      );

      // Return deployment details
      return {
        contractAddress: receipt.contractAddress,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed?.toString() || '0'
      };
    } catch (error) {
      this.logger.error(`Error deploying multisig wallet: ${error}`);
      throw new AppError(`Failed to deploy multisig: ${error}`, 500);
    }
  }

  /**
   * Propose a new transaction on the multisig contract
   * Creates a proposal that requires signatures from M-of-N signers
   * 
   * @param multisigAddress Contract address of the multisig
   * @param recipient Recipient wallet address
   * @param amount Amount to transfer (in wei)
   * @param data Additional transaction data (if needed)
   * @returns Transaction hash of proposal creation
   */
  async proposeTransaction(
    multisigAddress: string,
    recipient: string,
    amount: string,
    data: string = '0x'
  ): Promise<string> {
    try {
      // Validate Ethereum addresses
      if (!ethers.isAddress(multisigAddress)) {
        throw new ValidationError('Invalid multisig contract address');
      }

      if (!ethers.isAddress(recipient)) {
        throw new ValidationError('Invalid recipient address');
      }

      // Multisig contract ABI for proposal creation
      const multisigABI = [
        'function propose(address to, uint256 value, bytes data) returns (uint256 proposalId)',
        'event ProposalCreated(uint256 indexed proposalId, address indexed to, uint256 value, bytes data)',
        'function requiresSignatures() view returns (uint256)'
      ];

      const multisig = new ethers.Contract(multisigAddress, multisigABI, this.signer);

      this.logger.info(
        `Proposing transaction on multisig ${multisigAddress}: ${amount} to ${recipient}`
      );

      // Create proposal transaction
      const tx = await multisig.propose(recipient, amount, data);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new AppError('Failed to propose transaction', 500);
      }

      this.logger.info(`Proposal created with txHash: ${receipt.hash}`);

      return receipt.hash;
    } catch (error) {
      this.logger.error(`Error proposing transaction: ${error}`);
      throw new AppError(`Failed to propose transaction: ${error}`, 500);
    }
  }

  /**
   * Submit a signed transaction proposal to the multisig contract
   * Requires M signatures for M-of-N multisig
   * 
   * @param multisigAddress Contract address of the multisig
   * @param proposalId Proposal ID to execute
   * @param signatures Array of cryptographic signatures from signers
   * @returns Transaction hash of execution
   */
  async executeProposal(
    multisigAddress: string,
    proposalId: string | number,
    signatures: string[]
  ): Promise<string> {
    try {
      if (!ethers.isAddress(multisigAddress)) {
        throw new ValidationError('Invalid multisig contract address');
      }

      if (!signatures.length) {
        throw new ValidationError('At least one signature required');
      }

      // Multisig contract ABI for execution
      const multisigABI = [
        'function execute(uint256 proposalId, bytes[] signatures) returns (bool)',
        'event ProposalExecuted(uint256 indexed proposalId, bool success)',
        'function getProposal(uint256 proposalId) view returns (address to, uint256 value, bytes data, bool executed)'
      ];

      const multisig = new ethers.Contract(multisigAddress, multisigABI, this.signer);

      this.logger.info(
        `Executing proposal ${proposalId} on multisig ${multisigAddress} with ${signatures.length} signatures`
      );

      // Execute proposal with signatures
      const tx = await multisig.execute(proposalId, signatures);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new AppError('Failed to execute proposal', 500);
      }

      this.logger.info(`Proposal executed with txHash: ${receipt.hash}`);

      return receipt.hash;
    } catch (error) {
      this.logger.error(`Error executing proposal: ${error}`);
      throw new AppError(`Failed to execute proposal: ${error}`, 500);
    }
  }

  /**
   * Sign a proposal using the signer's private key
   * This creates a cryptographic signature for a proposal
   * 
   * @param proposalHash Hash of the proposal to sign
   * @returns Signature string
   */
  async signProposal(proposalHash: string): Promise<string> {
    try {
      // Ensure hash is properly formatted
      if (!proposalHash.startsWith('0x')) {
        proposalHash = '0x' + proposalHash;
      }

      // Sign the hash
      const signature = await this.signer.signMessage(ethers.getBytes(proposalHash));

      this.logger.info(`Proposal signed successfully`);

      return signature;
    } catch (error) {
      this.logger.error(`Error signing proposal: ${error}`);
      throw new AppError(`Failed to sign proposal: ${error}`, 500);
    }
  }

  /**
   * Get current state of a proposal from the multisig contract
   * 
   * @param multisigAddress Contract address of the multisig
   * @param proposalId Proposal ID to query
   * @returns Proposal details: to, value, data, executed status
   */
  async getProposalState(
    multisigAddress: string,
    proposalId: string | number
  ): Promise<{
    to: string;
    value: string;
    data: string;
    executed: boolean;
  }> {
    try {
      if (!ethers.isAddress(multisigAddress)) {
        throw new ValidationError('Invalid multisig contract address');
      }

      const multisigABI = [
        'function getProposal(uint256 proposalId) view returns (address to, uint256 value, bytes data, bool executed)'
      ];

      const multisig = new ethers.Contract(multisigAddress, multisigABI, this.provider);

      const proposal = await multisig.getProposal(proposalId);

      return {
        to: proposal.to,
        value: proposal.value.toString(),
        data: proposal.data,
        executed: proposal.executed
      };
    } catch (error) {
      this.logger.error(`Error getting proposal state: ${error}`);
      throw new AppError(`Failed to get proposal state: ${error}`, 500);
    }
  }

  /**
   * Record on-chain execution in the database
   * Called after transaction is confirmed on-chain
   * 
   * @param transactionId DB transaction ID
   * @param submittedTxHash On-chain transaction hash
   * @param contractAddress Contract address involved
   */
  async recordBlockchainExecution(
    transactionId: string,
    submittedTxHash: string,
    contractAddress: string
  ): Promise<void> {
    try {
      // Verify transaction exists on-chain
      const receipt = await this.provider.getTransactionReceipt(submittedTxHash);
      if (!receipt) {
        throw new ValidationError(`Transaction ${submittedTxHash} not found on-chain`);
      }

      // Update DB with execution details
      await db
        .update(treasuryMultisigTransactions)
        .set({
          submittedTxHash,
          submittedAt: new Date(),
          executedAt: new Date(),
          status: 'executed',
          metadata: {
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed?.toString(),
            contractAddress
          }
        })
        .where(eq(treasuryMultisigTransactions.id, transactionId));

      this.logger.info(`Recorded blockchain execution for transaction ${transactionId}: ${submittedTxHash}`);
    } catch (error) {
      this.logger.error(`Error recording blockchain execution: ${error}`);
      throw new AppError(`Failed to record blockchain execution: ${error}`, 500);
    }
  }

  /**
   * Listen for multisig wallet contract events
   * Returns an event listener that can be attached to a worker
   * 
   * @param multisigAddress Contract address to listen to
   * @param eventName Event name to listen for ('ProposalCreated', 'ProposalExecuted', etc.)
   * @returns Event listener callback
   */
  async createEventListener(
    multisigAddress: string,
    eventName: string = 'ProposalExecuted'
  ): Promise<(event: any) => Promise<void>> {
    try {
      if (!ethers.isAddress(multisigAddress)) {
        throw new ValidationError('Invalid multisig contract address');
      }

      const multisigABI = [
        'event ProposalCreated(uint256 indexed proposalId, address indexed to, uint256 value, bytes data)',
        'event ProposalExecuted(uint256 indexed proposalId, bool success)',
        'event ProposalRejected(uint256 indexed proposalId, string reason)'
      ];

      const multisig = new ethers.Contract(multisigAddress, multisigABI, this.provider);

      // Return callback that handles events
      return async (event: any) => {
        this.logger.info(`Received ${eventName} event for proposal ${event.args?.proposalId}`);
        // Event processing handled by worker
      };
    } catch (error) {
      this.logger.error(`Error creating event listener: ${error}`);
      throw new AppError(`Failed to create event listener: ${error}`, 500);
    }
  }

  /**
   * Get network information and verify connectivity
   * 
   * @returns Network details: chainId, network name, block number
   */
  async getNetworkInfo(): Promise<{
    chainId: number;
    networkName: string;
    blockNumber: number;
  }> {
    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();

      return {
        chainId: Number(network.chainId),
        networkName: network.name,
        blockNumber
      };
    } catch (error) {
      this.logger.error(`Error getting network info: ${error}`);
      throw new AppError(`Failed to get network info: ${error}`, 500);
    }
  }

  /**
   * Verify that contract deployment was successful
   * Checks if contract exists at the given address
   * 
   * @param contractAddress Address to verify
   * @returns Contract code (non-empty if contract exists)
   */
  async verifyContractDeployment(contractAddress: string): Promise<boolean> {
    try {
      if (!ethers.isAddress(contractAddress)) {
        return false;
      }

      const code = await this.provider.getCode(contractAddress);
      return code !== '0x';
    } catch (error) {
      this.logger.error(`Error verifying contract deployment: ${error}`);
      return false;
    }
  }

  /**
   * Convert amount from human-readable format to wei
   * 
   * @param amount Amount as string or number
   * @param decimals Number of decimals (default 18 for ETH-like tokens)
   * @returns Amount in wei as string
   */
  static parseAmount(amount: string | number, decimals: number = 18): string {
    try {
      return ethers.parseUnits(amount.toString(), decimals).toString();
    } catch (error) {
      throw new ValidationError(`Invalid amount format: ${amount}`);
    }
  }

  /**
   * Convert amount from wei to human-readable format
   * 
   * @param amountWei Amount in wei as string
   * @param decimals Number of decimals (default 18 for ETH-like tokens)
   * @returns Amount as human-readable string
   */
  static formatAmount(amountWei: string, decimals: number = 18): string {
    try {
      return ethers.formatUnits(amountWei, decimals);
    } catch (error) {
      throw new ValidationError(`Invalid wei amount: ${amountWei}`);
    }
  }
}

// Export singleton instance for use throughout the application
export const treasuryOnchainService = new TreasuryOnchainService();
