import { ethers } from 'ethers';
import { pool } from '../db';
import { logger } from '../utils/logger';
import { resolveProviderUrls } from './providerBootstrap';

const CHUNK_SIZE = 2_000;
const ZERO_ADDRESS = ethers.ZeroAddress;
const TOKEN_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Staked(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 lockPeriod)',
  'event Unstaked(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 reward)',
  'event StakeRewardsClaimed(address indexed user, uint256 indexed stakeId, uint256 reward)',
  'event VestingScheduleCreated(address indexed beneficiary, uint256 scheduleIndex, uint256 amount, uint8 vestingType)',
  'event TokensVested(address indexed beneficiary, uint256 scheduleIndex, uint256 amount)',
  'event DailyChallengeCompleted(address indexed user, string challenge, uint256 reward)',
  'event FeeCollected(address indexed payer, uint256 amount, bytes32 feeType)',
  'event QuarterlyBurnExecuted(uint256 amount, uint256 totalBurned)',
  'function totalSupply() view returns (uint256)',
  'function totalBurned() view returns (uint256)',
  'function getTotalStaked() view returns (uint256)',
];
const COMPANION_EVENTS = [
  'event VestingReleased(address indexed beneficiary, uint256 amount)',
  'event DistributionExecuted(address indexed executor, uint256 communityAmount, uint256 ecosystemAmount, uint256 partnersAmount, uint256 teamAmount, uint256 airdropAmount, uint256 liquidityAmount, uint256 publicSaleAmount, uint256 daoReserveAmount, uint256 timestamp)',
  'event PartialDistributionExecuted(address indexed executor, uint256 scaleFactor, uint256 totalDistributed, uint256 timestamp)',
  'event RevenueDistributed(bytes32 indexed agentId, address indexed payer, uint256 totalAmount, uint8 method, uint256 agentShare, uint256 platformShare, uint256 treasuryShare, uint256 communityShare, uint256 timestamp)',
];

type ContractConfig = { type: string; address: string; deploymentBlock: number };

export class MtaaTokenomicsIndexer {
  private readonly provider: ethers.JsonRpcProvider | null;
  private readonly chainId: number;
  private readonly contracts: ContractConfig[];
  private running = false;
  private intervalHandle: NodeJS.Timeout | null = null;
  private syncInProgress = false;
  private token: ethers.Contract | null = null;

  constructor() {
    const providerUrls = resolveProviderUrls();
    this.provider = providerUrls.rpcUrl ? new ethers.JsonRpcProvider(providerUrls.rpcUrl) : null;
    this.chainId = Number(process.env.MTAA_CHAIN_ID || 0);
    this.contracts = this.readContracts();
    if (this.provider && this.contracts.some(contract => contract.type === 'MTAAToken')) {
      const token = this.contracts.find(contract => contract.type === 'MTAAToken')!;
      this.token = new ethers.Contract(token.address, TOKEN_ABI, this.provider);
    }
  }

  async start(): Promise<void> {
    if (!this.provider || !this.chainId || !this.token || this.contracts.length === 0) {
      logger.warn('[MtaaTokenomics] Disabled: configure MTAA_CHAIN_ID, MTAA_TOKEN_ADDRESS, and MTAA_DEPLOYMENT_BLOCK');
      return;
    }
    if (this.running) return;
    this.running = true;
    try {
      await this.registerContracts();
      await this.syncHistory();
      this.intervalHandle = setInterval(() => this.syncHistory().catch(error => logger.error('[MtaaTokenomics] Scheduled sync failed', error)), Number(process.env.MTAA_INDEXER_INTERVAL_MS || 60000));
      logger.info(`[MtaaTokenomics] Started for chain ${this.chainId}`);
    } catch (error) {
      this.running = false;
      throw error;
    }
  }

  stop(): void {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
    this.intervalHandle = null;
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  async createSnapshot(): Promise<void> {
    if (!this.provider || !this.token || !this.chainId) return;
    const tokenConfig = this.contracts.find(contract => contract.type === 'MTAAToken');
    if (!tokenConfig) return;
    const [blockNumber, totalSupply, totalBurned, totalStaked] = await Promise.all([
      this.provider.getBlockNumber(),
      this.token.totalSupply(),
      this.token.totalBurned(),
      this.token.getTotalStaked(),
    ]);
    await pool.query(
      `INSERT INTO tokenomics_snapshots
       (chain_id, token_address, block_number, total_supply, total_burned, total_staked,
        locked_supply, circulating_supply, holder_count, transfer_count, transfer_volume,
        rewards_emitted, rewards_claimed, vested_released, price_source)
      SELECT $1, $2, $3, $4, $5, $6,
        GREATEST(COALESCE((SELECT SUM(amount) FROM token_ecosystem_events WHERE chain_id = $1 AND event_name = 'VestingScheduleCreated'), 0) -
          COALESCE((SELECT SUM(amount) FROM token_ecosystem_events WHERE chain_id = $1 AND event_name = 'VestingReleased'), 0), 0),
              GREATEST($4::numeric - $5::numeric - $6::numeric, 0),
        (SELECT COUNT(*) FROM token_holder_balances WHERE chain_id = $1 AND token_address = $2 AND balance > 0),
              COALESCE((SELECT COUNT(*) FROM token_transfer_events WHERE chain_id = $1 AND token_address = $2), 0),
              COALESCE((SELECT SUM(amount) FROM token_transfer_events WHERE chain_id = $1 AND token_address = $2), 0),
              COALESCE((SELECT SUM(amount) FROM token_ecosystem_events WHERE chain_id = $1 AND event_name IN ('DailyChallengeCompleted', 'StakeRewardsClaimed')), 0),
              COALESCE((SELECT SUM(amount) FROM token_ecosystem_events WHERE chain_id = $1 AND event_name = 'StakeRewardsClaimed'), 0),
              COALESCE((SELECT SUM(amount) FROM token_ecosystem_events WHERE chain_id = $1 AND event_name = 'VestingReleased'), 0),
              NULL
            `,
      [this.chainId, tokenConfig.address, blockNumber, totalSupply.toString(), totalBurned.toString(), totalStaked.toString()]
    );
  }

  private readContracts(): ContractConfig[] {
    const globalDeploymentBlock = process.env.MTAA_DEPLOYMENT_BLOCK;
    const definitions = [
      ['MTAAToken', process.env.MTAA_TOKEN_ADDRESS, process.env.MTAA_DEPLOYMENT_BLOCK],
      ['MtaaStakingVestingManager', process.env.MTAA_STAKING_VESTING_MANAGER_ADDRESS, process.env.MTAA_STAKING_VESTING_MANAGER_DEPLOYMENT_BLOCK],
      ['TokenDistributionInitializer', process.env.MTAA_DISTRIBUTION_INITIALIZER_ADDRESS, process.env.MTAA_DISTRIBUTION_DEPLOYMENT_BLOCK],
      ['RevenueDistributor', process.env.MTAA_REVENUE_DISTRIBUTOR_ADDRESS, process.env.MTAA_REVENUE_DISTRIBUTOR_DEPLOYMENT_BLOCK],
    ] as const;
    return definitions.flatMap(([type, address, block]) => {
      if (!address || !ethers.isAddress(address)) return [];
      if (!block && !globalDeploymentBlock) return [];
      const deploymentBlock = Number(block || globalDeploymentBlock);
      return Number.isSafeInteger(deploymentBlock) && deploymentBlock >= 0 ? [{ type, address: address.toLowerCase(), deploymentBlock }] : [];
    });
  }

  private async registerContracts(): Promise<void> {
    for (const contract of this.contracts) {
      await pool.query(
        `INSERT INTO token_contract_deployments (chain_id, contract_type, contract_address, deployment_block)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (chain_id, contract_type) DO UPDATE SET contract_address = EXCLUDED.contract_address,
           deployment_block = EXCLUDED.deployment_block, enabled = true, updated_at = NOW()`,
        [this.chainId, contract.type, contract.address, contract.deploymentBlock]
      );
    }
  }

  private async syncHistory(): Promise<void> {
    if (!this.provider || !this.token) return;
    if (this.syncInProgress) return;
    this.syncInProgress = true;
    try {
    const currentBlock = await this.provider.getBlockNumber();
    const tokenConfig = this.contracts.find(contract => contract.type === 'MTAAToken')!;
    const checkpointId = `mtaa:${this.chainId}:${tokenConfig.address}`;
    const checkpoint = await pool.query('SELECT last_indexed_block FROM token_indexer_checkpoints WHERE indexer_id = $1', [checkpointId]);
    let fromBlock = checkpoint.rows[0]
      ? Number(checkpoint.rows[0].last_indexed_block) + 1
      : tokenConfig.deploymentBlock;
    while (fromBlock <= currentBlock) {
      const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, currentBlock);
      await this.processTokenRange(tokenConfig, fromBlock, toBlock);
      for (const companion of this.contracts.filter(contract => contract.type !== 'MTAAToken')) {
        await this.processCompanionRange(companion, fromBlock, toBlock);
      }
      await pool.query(
        `INSERT INTO token_indexer_checkpoints (indexer_id, chain_id, last_indexed_block)
         VALUES ($1, $2, $3)
         ON CONFLICT (indexer_id) DO UPDATE SET last_indexed_block = EXCLUDED.last_indexed_block, updated_at = NOW()`,
        [checkpointId, this.chainId, toBlock]
      );
      fromBlock = toBlock + 1;
    }
    await this.createSnapshot();
    } finally {
      this.syncInProgress = false;
    }
  }

  private async processTokenRange(config: ContractConfig, fromBlock: number, toBlock: number): Promise<void> {
    const contract = new ethers.Contract(config.address, TOKEN_ABI, this.provider);
    for (const eventName of ['Transfer', 'Staked', 'Unstaked', 'StakeRewardsClaimed', 'VestingScheduleCreated', 'TokensVested', 'DailyChallengeCompleted', 'FeeCollected', 'QuarterlyBurnExecuted']) {
      const filter = contract.filters[eventName]();
      const events = await contract.queryFilter(filter, fromBlock, toBlock);
      for (const event of events) await this.persistEvent(config, event, eventName);
    }
  }

  private async processCompanionRange(config: ContractConfig, fromBlock: number, toBlock: number): Promise<void> {
    const abi = [...TOKEN_ABI, ...COMPANION_EVENTS];
    const contract = new ethers.Contract(config.address, abi, this.provider);
    for (const eventName of ['VestingReleased', 'DistributionExecuted', 'PartialDistributionExecuted', 'RevenueDistributed']) {
      const filter = contract.filters[eventName]();
      const events = await contract.queryFilter(filter, fromBlock, toBlock);
      for (const event of events) await this.persistEvent(config, event, eventName);
    }
  }

  private async persistEvent(config: ContractConfig, event: ethers.EventLog | ethers.Log, eventName: string): Promise<void> {
    const args = 'args' in event ? event.args : [];
    const transactionHash = event.transactionHash;
    const logIndex = event.index;
    if (eventName === 'Transfer') {
      const from = String(args[0]).toLowerCase();
      const to = String(args[1]).toLowerCase();
      const amount = String(args[2]);
      const inserted = await pool.query(
        `INSERT INTO token_transfer_events (chain_id, token_address, transaction_hash, log_index, block_number, from_address, to_address, amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (chain_id, transaction_hash, log_index) DO NOTHING`,
        [this.chainId, config.address, transactionHash, logIndex, event.blockNumber, from, to, amount]
      );
      if (inserted.rowCount) {
        for (const [address, delta] of [[from, `-${amount}`], [to, amount]] as const) {
          if (address === ZERO_ADDRESS) continue;
          await pool.query(
            `INSERT INTO token_holder_balances (chain_id, token_address, holder_address, balance)
             VALUES ($1,$2,$3,$4) ON CONFLICT (chain_id, token_address, holder_address)
             DO UPDATE SET balance = token_holder_balances.balance + EXCLUDED.balance::numeric, updated_at = NOW()`,
            [this.chainId, config.address, address, delta]
          );
        }
      }
      return;
    }
    const amount = this.extractAmount(args, eventName);
    await pool.query(
      `INSERT INTO token_ecosystem_events (chain_id, contract_address, transaction_hash, log_index, block_number, event_name, account_address, amount, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (chain_id, transaction_hash, log_index) DO NOTHING`,
      [this.chainId, config.address, transactionHash, logIndex, event.blockNumber, eventName, this.extractAccount(args), amount, JSON.stringify(args, bigintJsonReplacer)]
    );
  }

  private extractAccount(args: readonly unknown[]): string | null {
    const candidate = args.find(value => typeof value === 'string' && ethers.isAddress(value));
    return candidate ? String(candidate).toLowerCase() : null;
  }

  private extractAmount(args: readonly unknown[], eventName: string): string | null {
    const indexes: Record<string, number> = {
      Staked: 2,
      Unstaked: 2,
      StakeRewardsClaimed: 2,
      VestingScheduleCreated: 2,
      TokensVested: 2,
      DailyChallengeCompleted: 2,
      FeeCollected: 1,
      QuarterlyBurnExecuted: 0,
      VestingReleased: 1,
      DistributionExecuted: 1,
      PartialDistributionExecuted: 2,
      RevenueDistributed: 2,
    };
    const index = indexes[eventName] ?? args.length - 1;
    const value = args[index];
    return value === undefined || typeof value === 'string' && ethers.isAddress(value) ? null : String(value);
  }
}

function bigintJsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

export const mtaaTokenomicsIndexer = new MtaaTokenomicsIndexer();
