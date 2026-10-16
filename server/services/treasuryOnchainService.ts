import { ethers } from 'ethers';
import { and, eq, sql } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { AppError, ValidationError } from '../middleware/errorHandler';
import { db } from '../db';
import { multisigWallets, treasuryMultisigTransactions } from '../../shared/schema';

const CHAMA_TREASURY_ABI = [
  'function proposeWithdrawal(address recipient, uint256 amount, uint256 amountKES, string reason, uint8 proposalType, uint256 strategyId) returns (uint256 proposalId)',
  'function confirmProposal(uint256 proposalId)',
  'function executeProposal(uint256 proposalId)',
  'function cancelProposal(uint256 proposalId)',
  'function getProposal(uint256 proposalId) view returns (uint8 proposalType, address proposedBy, address recipient, uint256 amount, uint256 amountKES, string reason, uint8 status, uint256 confirmations, uint256 executableAfter, bool cancelled, uint256 loanApyBp)',
  'event ProposalCreated(uint256 indexed proposalId, uint8 proposalType, address indexed proposedBy, address indexed recipient, uint256 amount, uint256 executableAfter)',
  'event ProposalExecuted(uint256 indexed proposalId, address indexed executedBy, address indexed recipient, uint256 amount)',
  'event ProposalCancelled(uint256 indexed proposalId, address indexed cancelledBy)'
] as const;

const FACTORY_ABI = [
  'function deployTreasury(string chamaName, string daoId, address[] signers, string[] signerNames, uint256 requiredSignatures, uint8 daoType) returns (address treasury)',
  'event TreasuryDeployed(address indexed treasury, string indexed daoId, string chamaName, address indexed deployer, uint8 daoType, uint256 deploymentFee, uint256 timestamp)'
] as const;

const TREASURY_INTERFACE = new ethers.Interface(CHAMA_TREASURY_ABI);
const FACTORY_INTERFACE = new ethers.Interface(FACTORY_ABI);
const SUPPORTED_EVENT_NAMES = ['ProposalCreated', 'ProposalExecuted', 'ProposalCancelled'] as const;

export type TreasuryContractEvent =
  | {
      eventType: 'ProposalCreated';
      proposalId: string;
      proposalType: number;
      proposedBy: string;
      recipient: string;
      amount: string;
      executableAfter: string;
      transactionHash: string;
      blockNumber: number;
      blockHash: string;
      logIndex: number;
    }
  | {
      eventType: 'ProposalExecuted';
      proposalId: string;
      executedBy: string;
      recipient: string;
      amount: string;
      transactionHash: string;
      blockNumber: number;
      blockHash: string;
      logIndex: number;
    }
  | {
      eventType: 'ProposalCancelled';
      proposalId: string;
      cancelledBy: string;
      transactionHash: string;
      blockNumber: number;
      blockHash: string;
      logIndex: number;
    };

export interface TreasuryOnchainServiceOptions {
  rpcUrl?: string;
  chainId?: number;
  factoryAddress?: string;
  signer?: ethers.Signer;
  privateKeyProvider?: () => string | undefined;
  confirmationDepth?: number;
  rpcTimeoutMs?: number;
  rpcRetries?: number;
}

export interface TreasuryDeploymentOptions {
  chamaName: string;
  signerNames: string[];
  daoType: number;
}

export interface ProposeWithdrawalOptions {
  recipient: string;
  amount: string;
  amountKES: string;
  reason: string;
  proposalType: number;
  strategyId?: string;
}

export interface TreasuryProposalState {
  proposalType: number;
  proposedBy: string;
  recipient: string;
  amount: string;
  amountKES: string;
  reason: string;
  status: number;
  confirmations: string;
  executableAfter: string;
  cancelled: boolean;
  loanApyBp: string;
}

/**
 * Low-level client for the repository's ChamaTreasury and ChamaTreasuryFactory
 * contracts. Provider construction and signer loading are lazy so importing
 * read-only services does not require a signing key or an RPC connection.
 */
export class TreasuryOnchainService {
  private provider?: ethers.JsonRpcProvider;
  private signer?: ethers.Signer;
  private configuredChainId?: number;
  private readonly rpcUrl?: string;
  private readonly factoryAddress?: string;
  private readonly privateKeyProvider: () => string | undefined;
  private readonly confirmationDepth: number;
  private readonly rpcTimeoutMs: number;
  private readonly rpcRetries: number;
  private logger = new Logger('TreasuryOnchainService');

  constructor(options: TreasuryOnchainServiceOptions = {}) {
    this.rpcUrl = options.rpcUrl ?? process.env.CELO_RPC_URL ?? process.env.CELO_ALFAJORES_RPC_URL;
    this.factoryAddress = options.factoryAddress ?? process.env.CHAMA_FACTORY_CONTRACT_ADDRESS;
    this.configuredChainId = options.chainId;

    if (this.configuredChainId === undefined && process.env.CHAIN_ID !== undefined) {
      const parsedChainId = Number(process.env.CHAIN_ID);
      if (!Number.isSafeInteger(parsedChainId) || parsedChainId <= 0) {
        throw new ValidationError('CHAIN_ID must be a positive safe integer');
      }
      this.configuredChainId = parsedChainId;
    }

    this.signer = options.signer;
    this.privateKeyProvider =
      options.privateKeyProvider ??
      (() => process.env.CELO_ALFAJORES_PRIVATE_KEY || process.env.CELO_MAINNET_PRIVATE_KEY);

    this.confirmationDepth = this.positiveInteger(
      options.confirmationDepth,
      'TREASURY_CONFIRMATION_DEPTH',
      2
    );
    this.rpcTimeoutMs = this.positiveInteger(
      options.rpcTimeoutMs,
      'TREASURY_RPC_TIMEOUT_MS',
      15_000
    );
    this.rpcRetries = this.positiveInteger(
      options.rpcRetries,
      'TREASURY_RPC_RETRIES',
      2,
      true
    );
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private positiveInteger(
    value: number | undefined,
    name: string,
    fallback: number,
    allowZero = false
  ): number {
    const result = value ?? Number(process.env[name] ?? fallback);
    if (!Number.isSafeInteger(result) || result < (allowZero ? 0 : 1)) {
      throw new ValidationError(
        `${name} must be a ${allowZero ? 'non-negative' : 'positive'} safe integer`
      );
    }
    return result;
  }

  private parseUnsignedInteger(value: string, label: string): bigint {
    try {
      const parsed = BigInt(value);
      if (parsed < 0n) throw new Error('negative');
      return parsed;
    } catch {
      throw new ValidationError(`${label} must be a non-negative integer`);
    }
  }

  private getProvider(): ethers.JsonRpcProvider {
    if (!this.provider) {
      if (!this.rpcUrl) {
        throw new AppError(
          'CELO_RPC_URL or CELO_ALFAJORES_RPC_URL must be set for RPC operations',
          500
        );
      }
      const request = new ethers.FetchRequest(this.rpcUrl);
      request.timeout = this.rpcTimeoutMs;
      this.provider = new ethers.JsonRpcProvider(request);
    }
    return this.provider;
  }

  private getSigner(): ethers.Signer {
    if (this.signer) return this.signer;

    const privateKey = this.privateKeyProvider();
    if (!privateKey) {
      throw new AppError(
        'A signer or CELO_ALFAJORES_PRIVATE_KEY/CELO_MAINNET_PRIVATE_KEY is required for write operations',
        500
      );
    }
    this.signer = new ethers.Wallet(privateKey, this.getProvider());
    return this.signer;
  }

  private async withRpcRetry<T>(operation: () => Promise<T>, label: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.rpcRetries; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < this.rpcRetries) {
          const delay = Math.min(
            250 * 2 ** attempt + Math.floor(Math.random() * 150),
            3_000
          );
          this.logger.warn(`${label} failed; retrying (${attempt + 1}/${this.rpcRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    this.logger.error(
      `${label} failed after ${this.rpcRetries + 1} attempts: ${this.errorMessage(lastError)}`
    );
    throw new AppError(`${label} failed: ${this.errorMessage(lastError)}`, 503);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private validateContractAddress(address: string, label = 'contract'): void {
    if (!ethers.isAddress(address)) {
      throw new ValidationError(`Invalid ${label} address`);
    }
  }

  private validateProposalId(proposalId: string | number): bigint {
    try {
      const parsed = BigInt(proposalId);
      if (parsed < 0n) throw new Error('negative');
      return parsed;
    } catch {
      throw new ValidationError('Proposal ID must be a non-negative integer');
    }
  }

  private async waitForConfirmations(
    transactionHash: string
  ): Promise<ethers.TransactionReceipt> {
    const receipt = await this.getProvider().waitForTransaction(
      transactionHash,
      this.confirmationDepth,
      this.rpcTimeoutMs
    );
    if (!receipt) {
      throw new AppError(
        `Transaction ${transactionHash} was not confirmed within ${this.rpcTimeoutMs}ms`,
        503
      );
    }
    if (receipt.status !== 1) {
      throw new AppError(`Transaction ${transactionHash} reverted on-chain`, 409);
    }
    return receipt;
  }

  private async sendContractCall(
    contract: ethers.Contract,
    methodName: string,
    args: readonly (string | bigint | number | string[])[],
    label: string
  ): Promise<ethers.TransactionResponse> {
    const method = contract.getFunction(methodName);
    const gasEstimate = await this.withRpcRetry(
      () => method.estimateGas(...args),
      `Estimate gas for ${label}`
    );
    const feeData = await this.withRpcRetry(
      () => this.getProvider().getFeeData(),
      `Read fee data for ${label}`
    );

    const feeOverrides: ethers.TransactionRequest = {
      gasLimit: gasEstimate + gasEstimate / 5n, // +20 % buffer
    };

    if (feeData.maxFeePerGas !== null && feeData.maxPriorityFeePerGas !== null) {
      feeOverrides.maxFeePerGas = feeData.maxFeePerGas;
      feeOverrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    } else if (feeData.gasPrice !== null) {
      feeOverrides.gasPrice = feeData.gasPrice;
    }

    return method(...args, feeOverrides);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async deployMultisigWallet(
    daoId: string,
    signers: string[],
    requiredSignatures: number,
    deployment: TreasuryDeploymentOptions
  ): Promise<{ contractAddress: string; txHash: string; gasUsed: string }> {
    if (!this.factoryAddress || !ethers.isAddress(this.factoryAddress)) {
      throw new AppError('CHAMA_FACTORY_CONTRACT_ADDRESS is missing or invalid', 500);
    }
    if (!daoId.trim() || !deployment.chamaName.trim()) {
      throw new ValidationError('DAO ID and chama name are required');
    }
    if (signers.length < 2 || signers.length > 10) {
      throw new ValidationError('ChamaTreasury requires between 2 and 10 signers');
    }
    if (
      new Set(signers.map((a) => a.toLowerCase())).size !== signers.length ||
      signers.some((a) => !ethers.isAddress(a))
    ) {
      throw new ValidationError('Signer addresses must be valid and unique');
    }
    if (
      !Number.isSafeInteger(requiredSignatures) ||
      requiredSignatures < 2 ||
      requiredSignatures > signers.length
    ) {
      throw new ValidationError('Required signatures must be between 2 and the signer count');
    }
    if (
      deployment.signerNames.length !== signers.length ||
      deployment.signerNames.some((n) => !n.trim())
    ) {
      throw new ValidationError('Provide one non-empty signer name for each signer address');
    }
    if (
      !Number.isSafeInteger(deployment.daoType) ||
      deployment.daoType < 0 ||
      deployment.daoType > 5
    ) {
      throw new ValidationError('DAO type must be an integer from 0 through 5');
    }

    try {
      const factory = new ethers.Contract(this.factoryAddress, FACTORY_ABI, this.getSigner());
      const transaction = await this.sendContractCall(
        factory,
        'deployTreasury',
        [
          deployment.chamaName,
          daoId,
          signers,
          deployment.signerNames,
          requiredSignatures,
          deployment.daoType,
        ],
        `deploy treasury for DAO ${daoId}`
      );
      const receipt = await this.waitForConfirmations(transaction.hash);

      let deployedAddress: string | undefined;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== this.factoryAddress.toLowerCase()) continue;
        const parsed = FACTORY_INTERFACE.parseLog(log);
        // Indexed dynamic strings are stored as keccak256 hashes in event topics.
        if (parsed?.name === 'TreasuryDeployed' && parsed.args.daoId === ethers.id(daoId)) {
          deployedAddress = parsed.args.treasury as string;
          break;
        }
      }

      if (!deployedAddress || !ethers.isAddress(deployedAddress)) {
        throw new AppError(
          `Factory transaction ${receipt.hash} confirmed but emitted no matching TreasuryDeployed event`,
          502
        );
      }

      this.logger.info(
        `Deployed treasury ${deployedAddress} for DAO ${daoId} (txHash: ${receipt.hash})`
      );
      return {
        contractAddress: ethers.getAddress(deployedAddress),
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      this.logger.error(`Error deploying treasury: ${this.errorMessage(error)}`);
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to deploy treasury: ${this.errorMessage(error)}`, 500);
    }
  }

  async proposeWithdrawal(
    treasuryAddress: string,
    proposal: ProposeWithdrawalOptions
  ): Promise<{ proposalId: string; txHash: string }> {
    this.validateContractAddress(treasuryAddress, 'treasury');
    this.validateContractAddress(proposal.recipient, 'recipient');
    if (!proposal.reason.trim()) throw new ValidationError('Proposal reason is required');
    if (
      !Number.isSafeInteger(proposal.proposalType) ||
      proposal.proposalType < 0 ||
      proposal.proposalType > 4
    ) {
      throw new ValidationError('Proposal type must be an integer from 0 through 4');
    }

    try {
      const contract = new ethers.Contract(
        treasuryAddress,
        CHAMA_TREASURY_ABI,
        this.getSigner()
      );
      const transaction = await this.sendContractCall(
        contract,
        'proposeWithdrawal',
        [
          proposal.recipient,
          this.parseUnsignedInteger(proposal.amount, 'amount'),
          this.parseUnsignedInteger(proposal.amountKES, 'amountKES'),
          proposal.reason,
          proposal.proposalType,
          this.parseUnsignedInteger(proposal.strategyId ?? '0', 'strategyId'),
        ],
        `propose withdrawal for ${treasuryAddress}`
      );
      const receipt = await this.waitForConfirmations(transaction.hash);

      const createdLog = receipt.logs.find((log) => {
        if (log.address.toLowerCase() !== treasuryAddress.toLowerCase()) return false;
        return TREASURY_INTERFACE.parseLog(log)?.name === 'ProposalCreated';
      });
      const parsedLog = createdLog ? TREASURY_INTERFACE.parseLog(createdLog) : null;
      if (!parsedLog) {
        throw new AppError(
          `Treasury transaction ${receipt.hash} confirmed but emitted no ProposalCreated event`,
          502
        );
      }

      return {
        proposalId: parsedLog.args.proposalId.toString(),
        txHash: receipt.hash,
      };
    } catch (error) {
      this.logger.error(`Error proposing treasury withdrawal: ${this.errorMessage(error)}`);
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to propose treasury withdrawal: ${this.errorMessage(error)}`,
        500
      );
    }
  }

  async confirmProposal(treasuryAddress: string, proposalId: string | number): Promise<string> {
    this.validateContractAddress(treasuryAddress, 'treasury');
    const id = this.validateProposalId(proposalId);
    try {
      const contract = new ethers.Contract(
        treasuryAddress,
        CHAMA_TREASURY_ABI,
        this.getSigner()
      );
      const transaction = await this.sendContractCall(
        contract,
        'confirmProposal',
        [id],
        `confirm proposal ${id}`
      );
      return (await this.waitForConfirmations(transaction.hash)).hash;
    } catch (error) {
      this.logger.error(`Error confirming proposal ${id}: ${this.errorMessage(error)}`);
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to confirm proposal: ${this.errorMessage(error)}`, 500);
    }
  }

  async executeProposal(treasuryAddress: string, proposalId: string | number): Promise<string> {
    this.validateContractAddress(treasuryAddress, 'treasury');
    const id = this.validateProposalId(proposalId);
    try {
      const contract = new ethers.Contract(
        treasuryAddress,
        CHAMA_TREASURY_ABI,
        this.getSigner()
      );
      const transaction = await this.sendContractCall(
        contract,
        'executeProposal',
        [id],
        `execute proposal ${id}`
      );
      return (await this.waitForConfirmations(transaction.hash)).hash;
    } catch (error) {
      this.logger.error(`Error executing proposal ${id}: ${this.errorMessage(error)}`);
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to execute proposal: ${this.errorMessage(error)}`, 500);
    }
  }

  async cancelProposal(treasuryAddress: string, proposalId: string | number): Promise<string> {
    this.validateContractAddress(treasuryAddress, 'treasury');
    const id = this.validateProposalId(proposalId);
    try {
      const contract = new ethers.Contract(
        treasuryAddress,
        CHAMA_TREASURY_ABI,
        this.getSigner()
      );
      const transaction = await this.sendContractCall(
        contract,
        'cancelProposal',
        [id],
        `cancel proposal ${id}`
      );
      return (await this.waitForConfirmations(transaction.hash)).hash;
    } catch (error) {
      this.logger.error(`Error cancelling proposal ${id}: ${this.errorMessage(error)}`);
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to cancel proposal: ${this.errorMessage(error)}`, 500);
    }
  }

  /**
   * ChamaTreasury approvals are on-chain calls to confirmProposal; the contract
   * does not accept detached signatures, so this legacy API intentionally fails.
   */
  async signProposal(_proposalHash: string): Promise<string> {
    throw new ValidationError(
      'ChamaTreasury does not accept detached proposal signatures. Use confirmProposal with an authorized signer.'
    );
  }

  async getProposalState(
    treasuryAddress: string,
    proposalId: string | number
  ): Promise<TreasuryProposalState> {
    this.validateContractAddress(treasuryAddress, 'treasury');
    const id = this.validateProposalId(proposalId);
    const contract = new ethers.Contract(
      treasuryAddress,
      CHAMA_TREASURY_ABI,
      this.getProvider()
    );
    const state = await this.withRpcRetry(
      () => contract.getFunction('getProposal')(id),
      `Read proposal ${id}`
    );
    return {
      proposalType: Number(state.proposalType),
      proposedBy: state.proposedBy,
      recipient: state.recipient,
      amount: state.amount.toString(),
      amountKES: state.amountKES.toString(),
      reason: state.reason,
      status: Number(state.status),
      confirmations: state.confirmations.toString(),
      executableAfter: state.executableAfter.toString(),
      cancelled: state.cancelled,
      loanApyBp: state.loanApyBp.toString(),
    };
  }

  async recordBlockchainExecution(
    transactionId: string,
    submittedTxHash: string,
    contractAddress: string
  ): Promise<void> {
    this.validateContractAddress(contractAddress, 'treasury');
    if (!ethers.isHexString(submittedTxHash, 32)) {
      throw new ValidationError('Invalid transaction hash');
    }

    try {
      const receipt = await this.waitForConfirmations(submittedTxHash);

      if (!receipt.to || receipt.to.toLowerCase() !== contractAddress.toLowerCase()) {
        throw new ValidationError(
          'Transaction receipt does not target the supplied treasury contract'
        );
      }

      const executionLog = receipt.logs.find((log) => {
        if (log.address.toLowerCase() !== contractAddress.toLowerCase()) return false;
        return TREASURY_INTERFACE.parseLog(log)?.name === 'ProposalExecuted';
      });
      if (!executionLog) {
        throw new ValidationError(
          'Transaction receipt contains no ProposalExecuted event from the treasury'
        );
      }

      const parsedExecution = TREASURY_INTERFACE.parseLog(executionLog);
      if (!parsedExecution) {
        throw new ValidationError(
          'Unable to decode ProposalExecuted event from transaction receipt'
        );
      }

      const metadata = {
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed.toString(),
        contractAddress: ethers.getAddress(contractAddress),
        executionTxHash: receipt.hash,
      };

      const [wallet] = await db
        .select({ id: multisigWallets.id })
        .from(multisigWallets)
        .where(sql`lower(${multisigWallets.contractAddress}) = lower(${contractAddress})`)
        .limit(1);

      if (!wallet) {
        throw new ValidationError(`No multisig wallet is registered for ${contractAddress}`);
      }

      const [treasuryTransaction] = await db
        .select()
        .from(treasuryMultisigTransactions)
        .where(
          and(
            eq(treasuryMultisigTransactions.id, transactionId),
            eq(treasuryMultisigTransactions.multisigWalletId, wallet.id)
          )
        )
        .limit(1);

      if (!treasuryTransaction) {
        throw new ValidationError(
          `No treasury transaction ${transactionId} belongs to ${contractAddress}`
        );
      }

      const currentMetadata = treasuryTransaction.metadata;
      const existingMetadata =
        typeof currentMetadata === 'object' && currentMetadata !== null
          ? (currentMetadata as Record<string, unknown>)
          : {};

      const eventProposalId = parsedExecution.args.proposalId.toString();
      if (
        existingMetadata.proposalId === undefined ||
        String(existingMetadata.proposalId) !== eventProposalId
      ) {
        throw new ValidationError(
          `Execution event proposal ${eventProposalId} does not match treasury transaction ${transactionId}`
        );
      }

      // Idempotent short-circuit
      if (
        treasuryTransaction.status === 'executed' &&
        existingMetadata.executionTxHash === receipt.hash
      ) {
        return;
      }

      const [updated] = await db
        .update(treasuryMultisigTransactions)
        .set({
          submittedTxHash,
          submittedAt: new Date(),
          executedAt: new Date(),
          status: 'executed',
          metadata: sql`COALESCE(${treasuryMultisigTransactions.metadata}, '{}'::jsonb) || ${JSON.stringify(
            metadata
          )}::jsonb`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(treasuryMultisigTransactions.id, transactionId),
            eq(treasuryMultisigTransactions.multisigWalletId, wallet.id),
            eq(treasuryMultisigTransactions.status, 'submitted')
          )
        )
        .returning({ id: treasuryMultisigTransactions.id });

      if (!updated) {
        throw new AppError(
          `Treasury transaction ${transactionId} is no longer in submitted state`,
          409
        );
      }

      this.logger.info(
        `Recorded blockchain execution for transaction ${transactionId}: ${submittedTxHash}`
      );
    } catch (error) {
      this.logger.error(
        `Error recording blockchain execution: ${this.errorMessage(error)}`
      );
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to record blockchain execution: ${this.errorMessage(error)}`,
        500
      );
    }
  }

  async getContractEvents(
    treasuryAddress: string,
    fromBlock: number,
    toBlock: number
  ): Promise<TreasuryContractEvent[]> {
    this.validateContractAddress(treasuryAddress, 'treasury');
    if (
      !Number.isSafeInteger(fromBlock) ||
      !Number.isSafeInteger(toBlock) ||
      fromBlock < 0 ||
      toBlock < fromBlock
    ) {
      throw new ValidationError('Invalid contract event block range');
    }

    const eventTopics = SUPPORTED_EVENT_NAMES
      .map((name) => TREASURY_INTERFACE.getEvent(name)?.topicHash)
      .filter((topic): topic is string => topic !== undefined);

    const logs = await this.withRpcRetry(
      () =>
        this.getProvider().getLogs({
          address: treasuryAddress,
          fromBlock,
          toBlock,
          topics: [eventTopics],
        }),
      `Read treasury events for ${treasuryAddress} (${fromBlock}-${toBlock})`
    );

    return logs.map((log): TreasuryContractEvent => {
      const parsed = TREASURY_INTERFACE.parseLog(log);
      if (!parsed) {
        throw new AppError(
          `Unable to decode treasury event log ${log.transactionHash}:${log.index}`,
          502
        );
      }

      const chainMetadata = {
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        blockHash: log.blockHash,
        logIndex: log.index,
      };
      const proposalId = parsed.args.proposalId.toString();

      switch (parsed.name) {
        case 'ProposalCreated':
          return {
            eventType: 'ProposalCreated',
            proposalId,
            proposalType: Number(parsed.args.proposalType),
            proposedBy: parsed.args.proposedBy,
            recipient: parsed.args.recipient,
            amount: parsed.args.amount.toString(),
            executableAfter: parsed.args.executableAfter.toString(),
            ...chainMetadata,
          };
        case 'ProposalExecuted':
          return {
            eventType: 'ProposalExecuted',
            proposalId,
            executedBy: parsed.args.executedBy,
            recipient: parsed.args.recipient,
            amount: parsed.args.amount.toString(),
            ...chainMetadata,
          };
        case 'ProposalCancelled':
          return {
            eventType: 'ProposalCancelled',
            proposalId,
            cancelledBy: parsed.args.cancelledBy,
            ...chainMetadata,
          };
        default:
          throw new AppError(`Unsupported treasury event ${parsed.name}`, 502);
      }
    });
  }

  async getTransactionReceiptBlock(transactionHash: string): Promise<number | null> {
    if (!ethers.isHexString(transactionHash, 32)) {
      throw new ValidationError('Invalid transaction hash');
    }
    const receipt = await this.withRpcRetry(
      () => this.getProvider().getTransactionReceipt(transactionHash),
      `Read transaction receipt ${transactionHash}`
    );
    return receipt?.blockNumber ?? null;
  }

  async getNetworkInfo(): Promise<{
    chainId: number;
    networkName: string;
    blockNumber: number;
  }> {
    const provider = this.getProvider();
    const [network, blockNumber] = await this.withRpcRetry(
      () => Promise.all([provider.getNetwork(), provider.getBlockNumber()]),
      'Read network information'
    );
    const chainId = Number(network.chainId);

    if (this.configuredChainId !== undefined && chainId !== this.configuredChainId) {
      throw new AppError(
        `Configured chain ID ${this.configuredChainId} does not match connected chain ID ${chainId}`,
        503
      );
    }
    this.configuredChainId ??= chainId;

    return { chainId, networkName: network.name, blockNumber };
  }

  async verifyContractDeployment(contractAddress: string): Promise<boolean> {
    if (!ethers.isAddress(contractAddress)) return false;
    const code = await this.withRpcRetry(
      () => this.getProvider().getCode(contractAddress),
      `Read bytecode for ${contractAddress}`
    );
    return code !== '0x';
  }

  static parseAmount(amount: string | number, decimals = 18): string {
    try {
      if (!Number.isSafeInteger(decimals) || decimals < 0) {
        throw new Error('invalid decimals');
      }
      return ethers.parseUnits(amount.toString(), decimals).toString();
    } catch {
      throw new ValidationError(`Invalid amount or decimal precision: ${amount}`);
    }
  }

  static formatAmount(amountWei: string, decimals = 18): string {
    try {
      if (!Number.isSafeInteger(decimals) || decimals < 0) {
        throw new Error('invalid decimals');
      }
      return ethers.formatUnits(amountWei, decimals);
    } catch {
      throw new ValidationError(`Invalid wei amount or decimal precision: ${amountWei}`);
    }
  }
}

export const treasuryOnchainService = new TreasuryOnchainService();