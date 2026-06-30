import { ethers } from 'ethers';
import { db } from '../db';
import { daoAgentSubscriptions, indexerCheckpoints, daos } from '../../shared/schema';
import { eq, or } from 'drizzle-orm';
import { logger } from '../utils/logger';

const AGENT_GATEWAY_ADDRESS = process.env.AGENT_PAYMENT_GATEWAY_ADDR || process.env.AGENT_GATEWAY_ADDR || '';
const RPC_URL = process.env.RPC_URL || '';
const DEPLOYMENT_BLOCK = parseInt(process.env.CONTRACT_DEPLOYMENT_BLOCK || '0', 10);
const CHUNK_SIZE = 5000;

const INDEXER_ID = 'agent_payment_gateway';

const GATEWAY_ABI = [
  'event SubscriptionActivated(bytes32 indexed agentId, address indexed user, uint256 expiry, uint256 timestamp)',
  'event AgentStatusChanged(bytes32 indexed agentId, bool active, uint256 timestamp)'
];

export class AgentPaymentIndexer {
  private provider: ethers.JsonRpcProvider | null = null;
  private contract: ethers.Contract | null = null;
  private isRunning: boolean = false;

  constructor() {
    if (RPC_URL && AGENT_GATEWAY_ADDRESS) {
      this.provider = new ethers.JsonRpcProvider(RPC_URL);
      this.contract = new ethers.Contract(AGENT_GATEWAY_ADDRESS, GATEWAY_ABI, this.provider);
    }
  }

  public async start() {
    if (!this.contract || !this.provider) {
      logger.warn('AgentPaymentIndexer: Missing RPC_URL or AGENT_GATEWAY_ADDR. Indexer disabled.');
      return;
    }
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      await this.syncHistory();
      this.startLiveListener();
    } catch (err: any) {
      logger.error('AgentPaymentIndexer start failed:', { error: err?.message || String(err) });
      this.isRunning = false;
    }
  }

  private async syncHistory() {
    if (!this.contract || !this.provider) return;

    logger.info('AgentPaymentIndexer: Starting history sync...');
    const currentBlock = await this.provider.getBlockNumber();
    
    // 1. Determine where to start looking
    const checkpointRecords = await db.select().from(indexerCheckpoints).where(eq(indexerCheckpoints.id, INDEXER_ID));
    const lastIndexedBlock = checkpointRecords.length > 0 ? checkpointRecords[0].lastIndexedBlock : null;
    let startBlock = lastIndexedBlock !== null ? lastIndexedBlock : DEPLOYMENT_BLOCK;

    if (startBlock > currentBlock) {
        startBlock = currentBlock;
    }

    // 2. Catch up on any events missed
    if (currentBlock > startBlock) {
      logger.info(`AgentPaymentIndexer: Syncing blocks ${startBlock} to ${currentBlock}`);
      
      let fromBlock = startBlock;
      while (fromBlock <= currentBlock) {
        const toBlock = Math.min(fromBlock + CHUNK_SIZE, currentBlock);
        
        const activatedFilter = this.contract.filters.SubscriptionActivated();
        const events = await this.contract.queryFilter(activatedFilter, fromBlock, toBlock);
        
        if (events.length > 0) {
            await this.processEvents(events);
        }

        await this.saveLastIndexedBlock(toBlock);
        fromBlock = toBlock + 1;
      }
    }
    logger.info('AgentPaymentIndexer: History sync complete.');
  }

  private startLiveListener() {
    if (!this.contract) return;

    this.contract.on(this.contract.filters.SubscriptionActivated(), async (...args) => {
      try {
        const event = args[args.length - 1]; // The EventLog object is the last argument
        await this.processLiveEvent(
          args[0], // agentId
          args[1], // user
          args[2], // expiry
          args[3], // timestamp
          event
        );
        const eventBlock = event.blockNumber;
        await this.saveLastIndexedBlock(eventBlock);
      } catch (err: any) {
        logger.error('AgentPaymentIndexer live event error:', { error: err?.message || String(err) });
      }
    });
    
    logger.info('AgentPaymentIndexer: Live listener started.');
  }

  private async processEvents(events: any[]) {
    for (const event of events) {
      const { agentId, user, expiry, timestamp } = event.args;
      await this.processSubscriptionEvent(agentId, user, expiry, timestamp);
    }
  }

  private async processLiveEvent(agentId: string, user: string, expiry: bigint, timestamp: bigint, event: any) {
    logger.info(`AgentPaymentIndexer: Received live SubscriptionActivated`, { agentId, user, expiry: expiry.toString() });
    await this.processSubscriptionEvent(agentId, user, expiry, timestamp);
  }

  private async processSubscriptionEvent(agentIdBytes: string, userAddress: string, expiry: bigint, timestamp: bigint) {
    // 1. Find which DAO this user/wallet represents
    // Convert addresses to lowercase for case-insensitive matching
    const searchAddress = userAddress.toLowerCase();
    
    const matchingDaos = await db.select().from(daos).where(
      or(
        eq(daos.chamaTreasuryAddress, searchAddress),
        // fallback in case some DAOs only set vaultAddress
        eq(daos.vaultAddress, searchAddress)
      )
    );

    if (matchingDaos.length === 0) {
      logger.warn(`AgentPaymentIndexer: No DAO found matching treasury address ${searchAddress}`);
      return;
    }

    const daoId = matchingDaos[0].id;
    const expiresAtDate = new Date(Number(expiry) * 1000);

    // Upsert logic for Drizzle
    const existing = await db.select().from(daoAgentSubscriptions).where(
        eq(daoAgentSubscriptions.daoId, daoId)
    );
    const existingRecord = existing.find(r => r.agentId === agentIdBytes);

    if (existingRecord) {
        await db.update(daoAgentSubscriptions)
            .set({ expiresAt: expiresAtDate, isActive: true, updatedAt: new Date() })
            .where(eq(daoAgentSubscriptions.id, existingRecord.id));
    } else {
        await db.insert(daoAgentSubscriptions).values({
            daoId: daoId,
            agentId: agentIdBytes,
            expiresAt: expiresAtDate,
            isActive: true
        });
    }
  }

  private async saveLastIndexedBlock(blockNumber: number) {
    const existing = await db.select().from(indexerCheckpoints).where(eq(indexerCheckpoints.id, INDEXER_ID));
    if (existing.length > 0) {
      await db.update(indexerCheckpoints)
        .set({ lastIndexedBlock: blockNumber, updatedAt: new Date() })
        .where(eq(indexerCheckpoints.id, INDEXER_ID));
    } else {
      await db.insert(indexerCheckpoints).values({
        id: INDEXER_ID,
        lastIndexedBlock: blockNumber
      });
    }
  }
}

export const agentPaymentIndexer = new AgentPaymentIndexer();
