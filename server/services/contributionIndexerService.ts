
import { ethers } from 'ethers';
import { db } from '../db';
import { contributions, daos, users, wallets } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { tokenService } from './tokenService';

const logger = Logger.getLogger();

interface PendingContribution {
  id: string;
  daoId: string;
  fromAddress: string;
  amount: string;
  currency: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: Date;
  claimed: boolean;
}

export class ContributionIndexerService {
  private isRunning = false;
  private lastProcessedBlock: { [key: string]: number } = {};
  private pendingContributions: PendingContribution[] = [];

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('🔍 Starting Contribution Indexer Service');
    
    // Poll every 30 seconds
    setInterval(() => this.indexContributions(), 30000);
    
    // Initial run
    await this.indexContributions();
  }

  private async indexContributions() {
    try {
      // Get all active DAOs with treasury addresses
      const activeDaos = await db
        .select({
          id: daos.id,
          name: daos.name,
          treasuryAddress: sql<string>`(
            SELECT address FROM ${wallets} 
            WHERE dao_id = ${daos.id} 
            AND wallet_type = 'dao' 
            LIMIT 1
          )`.as('treasury_address')
        })
        .from(daos)
        .where(eq(daos.isArchived, false));

      for (const dao of activeDaos) {
        if (!dao.treasuryAddress) continue;
        
        await this.indexDaoContributions(
          dao.id,
          dao.treasuryAddress,
          dao.name
        );
      }
    } catch (error) {
      logger.error('Error indexing contributions:', error);
    }
  }

  private async indexDaoContributions(
    daoId: string,
    treasuryAddress: string,
    daoName: string
  ) {
    try {
      const provider = tokenService.provider;
      const currentBlock = await provider.getBlockNumber();
      
      // Get last processed block for this DAO
      const fromBlock = this.lastProcessedBlock[daoId] || currentBlock - 1000;
      const toBlock = currentBlock;

      // Get all transfers to this DAO treasury
      const transfers = await this.getTransfersToAddress(
        treasuryAddress,
        fromBlock,
        toBlock
      );

      logger.info(`Found ${transfers.length} transfers to DAO ${daoName}`);

      for (const transfer of transfers) {
        await this.processTransfer(daoId, transfer);
      }

      this.lastProcessedBlock[daoId] = currentBlock;
    } catch (error) {
      logger.error(`Error indexing DAO ${daoId}:`, error);
    }
  }

  private async getTransfersToAddress(
    toAddress: string,
    fromBlock: number,
    toBlock: number
  ): Promise<any[]> {
    const provider = tokenService.provider;
    const transfers: any[] = [];

    try {
      // Get native token transfers (CELO)
      const nativeTransfers = await this.getNativeTransfers(
        toAddress,
        fromBlock,
        toBlock
      );
      transfers.push(...nativeTransfers);

      // Get ERC20 token transfers (cUSD, cEUR, etc.)
      const erc20Transfers = await this.getERC20Transfers(
        toAddress,
        fromBlock,
        toBlock
      );
      transfers.push(...erc20Transfers);

    } catch (error) {
      logger.error('Error fetching transfers:', error);
    }

    return transfers;
  }

  private async getNativeTransfers(
    toAddress: string,
    fromBlock: number,
    toBlock: number
  ): Promise<any[]> {
    const provider = tokenService.provider;
    const transfers: any[] = [];

    // Query blocks for native transfers
    for (let i = fromBlock; i <= toBlock; i++) {
      try {
        const block = await provider.getBlock(i, true);
        if (!block || !block.transactions) continue;

        for (const tx of block.transactions) {
          if (typeof tx === 'string') continue;
          
          if (tx.to?.toLowerCase() === toAddress.toLowerCase() && tx.value > 0n) {
            transfers.push({
              from: tx.from,
              to: tx.to,
              value: tx.value.toString(),
              currency: 'CELO',
              hash: tx.hash,
              blockNumber: i,
              timestamp: new Date(block.timestamp * 1000)
            });
          }
        }
      } catch (error) {
        // Skip problematic blocks
        continue;
      }
    }

    return transfers;
  }

  private async getERC20Transfers(
    toAddress: string,
    fromBlock: number,
    toBlock: number
  ): Promise<any[]> {
    const transfers: any[] = [];
    const provider = tokenService.provider;

    // ERC20 Transfer event signature
    const transferTopic = ethers.id('Transfer(address,address,uint256)');

    const supportedTokens = [
      { symbol: 'cUSD', address: process.env.CUSD_ADDRESS },
      { symbol: 'cEUR', address: process.env.CEUR_ADDRESS },
      { symbol: 'USDT', address: process.env.USDT_ADDRESS }
    ].filter(t => t.address);

    for (const token of supportedTokens) {
      try {
        const filter = {
          address: token.address,
          topics: [
            transferTopic,
            null, // from (any)
            ethers.zeroPadValue(toAddress, 32) // to (our DAO)
          ],
          fromBlock,
          toBlock
        };

        const logs = await provider.getLogs(filter);

        for (const log of logs) {
          const iface = new ethers.Interface([
            'event Transfer(address indexed from, address indexed to, uint256 value)'
          ]);
          const parsed = iface.parseLog(log);
          
          if (parsed) {
            const block = await provider.getBlock(log.blockNumber);
            transfers.push({
              from: parsed.args.from,
              to: parsed.args.to,
              value: parsed.args.value.toString(),
              currency: token.symbol,
              hash: log.transactionHash,
              blockNumber: log.blockNumber,
              timestamp: new Date((block?.timestamp || 0) * 1000)
            });
          }
        }
      } catch (error) {
        logger.error(`Error fetching ${token.symbol} transfers:`, error);
      }
    }

    return transfers;
  }

  private async processTransfer(daoId: string, transfer: any) {
    try {
      // Check if already processed
      const existing = await db
        .select()
        .from(contributions)
        .where(eq(contributions.transactionHash, transfer.hash))
        .limit(1);

      if (existing.length > 0) {
        return; // Already processed
      }

      // Try to match wallet address to user
      const userWallet = await db
        .select({ userId: wallets.userId })
        .from(wallets)
        .where(
          and(
            sql`LOWER(${wallets.address}) = LOWER(${transfer.from})`,
            eq(wallets.isActive, true)
          )
        )
        .limit(1);

      const amountInEther = ethers.formatUnits(transfer.value, 18);

      if (userWallet.length > 0) {
        // Auto-create contribution for known wallet
        await db.insert(contributions).values({
          userId: userWallet[0].userId,
          daoId,
          amount: amountInEther,
          currency: transfer.currency,
          transactionHash: transfer.hash,
          purpose: 'general',
          isAnonymous: false,
          createdAt: transfer.timestamp,
          vault: false
        });

        logger.info(`✅ Auto-recorded contribution: ${amountInEther} ${transfer.currency} from known wallet`);
      } else {
        // Add to pending contributions for external wallets
        const pending: PendingContribution = {
          id: transfer.hash,
          daoId,
          fromAddress: transfer.from,
          amount: amountInEther,
          currency: transfer.currency,
          transactionHash: transfer.hash,
          blockNumber: transfer.blockNumber,
          timestamp: transfer.timestamp,
          claimed: false
        };

        this.pendingContributions.push(pending);
        
        logger.info(`⏳ Pending contribution: ${amountInEther} ${transfer.currency} from unknown wallet ${transfer.from.slice(0, 10)}...`);
      }
    } catch (error) {
      logger.error('Error processing transfer:', error);
    }
  }

  async getPendingContributions(daoId?: string): Promise<PendingContribution[]> {
    if (daoId) {
      return this.pendingContributions.filter(
        p => p.daoId === daoId && !p.claimed
      );
    }
    return this.pendingContributions.filter(p => !p.claimed);
  }

  async claimContribution(
    userId: string,
    transactionHash: string,
    walletAddress: string
  ): Promise<boolean> {
    try {
      const pending = this.pendingContributions.find(
        p => p.transactionHash === transactionHash && !p.claimed
      );

      if (!pending) {
        throw new Error('Pending contribution not found');
      }

      // Verify wallet ownership by signature
      // (This should be done via the API endpoint with proper verification)
      
      // Link wallet to user if not already linked
      const existingWallet = await db
        .select()
        .from(wallets)
        .where(
          and(
            sql`LOWER(${wallets.address}) = LOWER(${walletAddress})`,
            eq(wallets.userId, userId)
          )
        )
        .limit(1);

      if (existingWallet.length === 0) {
        await db.insert(wallets).values({
          userId,
          address: walletAddress,
          currency: pending.currency,
          walletType: 'personal',
          isActive: true
        });
      }

      // Create contribution
      await db.insert(contributions).values({
        userId,
        daoId: pending.daoId,
        amount: pending.amount,
        currency: pending.currency,
        transactionHash: pending.transactionHash,
        purpose: 'general',
        isAnonymous: false,
        createdAt: pending.timestamp,
        vault: false
      });

      // Mark as claimed
      pending.claimed = true;

      logger.info(`✅ User ${userId} claimed contribution: ${pending.amount} ${pending.currency}`);
      return true;
    } catch (error) {
      logger.error('Error claiming contribution:', error);
      return false;
    }
  }
}

export const contributionIndexer = new ContributionIndexerService();
