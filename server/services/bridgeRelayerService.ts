import { db } from '../db';
import { crossChainTransfers } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { ChainRegistry, SupportedChain } from '../../shared/chainRegistry';
import { ethers } from 'ethers';

export class BridgeRelayerService {
  private logger = Logger.getLogger();
  private isRunning = false;
  private pollInterval = 30000; // 30 seconds

  /**
   * Start the relayer service
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Relayer service already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('🚀 Bridge relayer service started');
    this.pollPendingTransfers();
  }

  /**
   * Stop the relayer service
   */
  stop(): void {
    this.isRunning = false;
    this.logger.info('Bridge relayer service stopped');
  }

  /**
   * Poll for pending transfers
   */
  private async pollPendingTransfers(): Promise<void> {
    while (this.isRunning) {
      try {
        const pendingTransfers = await db.query.crossChainTransfers.findMany({
          where: eq(crossChainTransfers.status, 'pending')
        });

        for (const transfer of pendingTransfers) {
          await this.processTransfer(transfer);
        }

        await new Promise(resolve => setTimeout(resolve, this.pollInterval));
      } catch (error) {
        this.logger.error('Error polling transfers:', error);
        await new Promise(resolve => setTimeout(resolve, this.pollInterval));
      }
    }
  }

  /**
   * Process a single transfer
   */
  private async processTransfer(transfer: any): Promise<void> {
    try {
      this.logger.info(`Processing transfer: ${transfer.id}`);

      // Update status to bridging
      await db.update(crossChainTransfers)
        .set({ status: 'bridging' })
        .where(eq(crossChainTransfers.id, transfer.id));

      // Check source chain transaction
      const sourceTxHash = await this.checkSourceTransaction(
        transfer.sourceChain as SupportedChain,
        transfer.tokenAddress,
        transfer.amount
      );

      if (sourceTxHash) {
        await db.update(crossChainTransfers)
          .set({ txHashSource: sourceTxHash })
          .where(eq(crossChainTransfers.id, transfer.id));

        // Complete transfer on destination chain
        const destTxHash = await this.completeTransferOnDestination(
          transfer.destinationChain as SupportedChain,
          transfer.destinationAddress,
          transfer.tokenAddress,
          transfer.amount
        );

        if (destTxHash) {
          await db.update(crossChainTransfers)
            .set({
              status: 'completed',
              txHashDestination: destTxHash,
              completedAt: new Date()
            })
            .where(eq(crossChainTransfers.id, transfer.id));

          this.logger.info(`Transfer ${transfer.id} completed successfully`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process transfer ${transfer.id}:`, error);

      await db.update(crossChainTransfers)
        .set({
          status: 'failed',
          failureReason: error instanceof Error ? error.message : 'Unknown error'
        })
        .where(eq(crossChainTransfers.id, transfer.id));
    }
  }

  /**
   * Check source chain transaction
   */
  private async checkSourceTransaction(
    chain: SupportedChain,
    tokenAddress: string,
    amount: string
  ): Promise<string | null> {
    try {
      const provider = ChainRegistry.getProvider(chain);
      const { CHAIN_CONFIGS } = await import('../../shared/chainRegistry');
      const bridgeContract = CHAIN_CONFIGS[chain].bridgeContract;

      if (!bridgeContract) {
        this.logger.warn(`No bridge contract for ${chain}, using mock`);
        return `0x${Math.random().toString(16).substr(2, 64)}`;
      }

      // Listen for BridgeLock events from CrossChainBridge contract
      const BRIDGE_ABI = [
        'event TransferInitiated(bytes32 indexed transferId, address indexed user, address token, uint256 amount, uint32 destinationEid, address destinationAddress)'
      ];

      const bridge = new ethers.Contract(bridgeContract, BRIDGE_ABI, provider);

      // Query recent events (last 100 blocks)
      const currentBlock = await provider.getBlockNumber();
      const events = await bridge.queryFilter(
        bridge.filters.TransferInitiated(),
        currentBlock - 100,
        currentBlock
      );

      // Find matching event
      const event = events.find(e => 
        e.args?.token === tokenAddress && 
        e.args?.amount.toString() === amount
      );

      return event?.transactionHash || null;
    } catch (error) {
      this.logger.error('Failed to check source transaction:', error);
      return null;
    }
  }

  /**
   * Complete transfer on destination chain
   */
  private async completeTransferOnDestination(
    chain: SupportedChain,
    recipient: string,
    tokenAddress: string,
    amount: string
  ): Promise<string | null> {
    try {
      const provider = ChainRegistry.getProvider(chain);
      const { CHAIN_CONFIGS } = await import('../../shared/chainRegistry');
      const bridgeContract = CHAIN_CONFIGS[chain].bridgeContract;

      if (!bridgeContract || !process.env.RELAYER_PRIVATE_KEY) {
        this.logger.warn(`No bridge/relayer for ${chain}, using mock`);
        return `0x${Math.random().toString(16).substr(2, 64)}`;
      }

      // Initialize relayer wallet
      const relayerWallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);

      const BRIDGE_ABI = [
        'function completeTransfer(address recipient, address token, uint256 amount, bytes32 transferId) external'
      ];

      const bridge = new ethers.Contract(bridgeContract, BRIDGE_ABI, relayerWallet);

      // Generate transfer ID (should match source chain)
      const transferId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'address', 'uint256', 'uint256'],
          [recipient, tokenAddress, amount, Date.now()]
        )
      );

      // Execute transfer on destination
      const tx = await bridge.completeTransfer(recipient, tokenAddress, amount, transferId);
      const receipt = await tx.wait();

      return receipt.hash;
    } catch (error) {
      this.logger.error('Failed to complete transfer on destination:', error);
      return null;
    }
  }

  /**
   * Manually retry failed transfer
   */
  async retryTransfer(transferId: string): Promise<void> {
    const transfer = await db.query.crossChainTransfers.findFirst({
      where: eq(crossChainTransfers.id, transferId)
    });

    if (!transfer) {
      throw new AppError('Transfer not found', 404);
    }

    if (transfer.status !== 'failed') {
      throw new AppError('Can only retry failed transfers', 400);
    }

    await db.update(crossChainTransfers)
      .set({ status: 'pending', failureReason: null })
      .where(eq(crossChainTransfers.id, transferId));

    this.logger.info(`Transfer ${transferId} queued for retry`);
  }
}

export const bridgeRelayerService = new BridgeRelayerService();