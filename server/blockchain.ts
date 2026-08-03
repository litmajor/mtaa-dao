import { ethers } from "ethers";
import MaonoVaultArtifact from "../contracts/MaonoVault.json" with { type: "json" };
import { tokenService } from './services/tokenService';
import { ResilientRpcProvider } from './services/resilientRpcProvider';
import { ResilientWsProvider } from './services/resilientWsProvider';
import { createVaultGapBackfillHandler } from './services/vaultEventRecovery';
import { TokenRegistry } from '../shared/tokenRegistry';
import { db } from './db';
import { indexerProgress } from '../shared/schema';
import type { VaultEvent as IndexerVaultEvent } from './vaultEventsIndexer';
import { eq } from 'drizzle-orm';
// Local lightweight VaultEvent shape (avoid circular imports with vaultEventsIndexer)
interface VaultEvent {
  type: string;
  vaultId: string;
  transactionHash: string;
  blockNumber?: number;
  timestamp: number | string;
  userAddress?: string | null;
  tokenSymbol?: string;
  amount?: string | number;
  newNAV?: string | null;
  newFee?: string | null;
  newStatus?: string | null;
  [key: string]: unknown;
}

export async function sendToken(
  symbol: string,
  to: string,
  amount: string | bigint
): Promise<string> {
  let amountStr: string;

  if (typeof amount === 'bigint') {
    const token = TokenRegistry.getToken(symbol);
    const decimals = token?.decimals || 18;
    amountStr = ethers.formatUnits(amount, decimals);
  } else {
    amountStr = amount;
  }

  return tokenService.sendToken(symbol, to, amountStr);
}

export async function sendCUSD(to: string, amount: string | bigint): Promise<string> {
  return sendToken('cUSD', to, amount);
}

const provider = tokenService.provider;
const signer = tokenService.signer;

const resilientRpcProvider = new ResilientRpcProvider({
  primary: {
    name: 'primary-rpc',
    httpUrl: process.env.CELO_RPC_URL || process.env.RPC_URL || 'https://forno.celo.org',
  },
  fallback: {
    name: 'fallback-rpc',
    httpUrl: process.env.CELO_RPC_FALLBACK_URL || process.env.RPC_URL_FALLBACK || process.env.CELO_RPC_URL || process.env.RPC_URL || 'https://forno.celo.org',
  },
  cooldownMs: 60_000,
  onFailover: (from, to, reason) => console.warn(`[RPC] Vault indexer failover ${from} -> ${to}: ${reason}`),
  onRecover: (providerName) => console.info(`[RPC] Vault indexer recovered to ${providerName}`),
});

const MAONO_CONTRACT_ADDRESS = process.env.MAONO_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';

function isContractConfigured(): boolean {
  if (!MAONO_CONTRACT_ADDRESS || MAONO_CONTRACT_ADDRESS === "" || MAONO_CONTRACT_ADDRESS === "0x1234567890123456789012345678901234567890") {
    return false;
  }
  return ethers.isAddress(MAONO_CONTRACT_ADDRESS);
}

function getMaonoVaultContract(connection: ethers.ContractRunner = signer || provider): ethers.Contract {
  if (!isContractConfigured()) {
    throw new Error(`MAONO_CONTRACT_ADDRESS is unconfigured or invalid: "${MAONO_CONTRACT_ADDRESS}"`);
  }
  return new ethers.Contract(MAONO_CONTRACT_ADDRESS, MaonoVaultArtifact.abi, connection);
}

export { tokenService };

export const MaonoVaultService = {
  get contract() {
    return getMaonoVaultContract();
  },
  provider,
  signer,
  isConfigured: isContractConfigured,

  async getNAV() {
    const code = await resilientRpcProvider.call((activeProvider) => activeProvider.getCode(MAONO_CONTRACT_ADDRESS));
    if (code === "0x") {
      throw new Error(`No contract deployed at address ${MAONO_CONTRACT_ADDRESS}`);
    }
    return resilientRpcProvider.call((activeProvider) =>
      getMaonoVaultContract(activeProvider).previewNAV()
    );
  },

  async deposit(amount: bigint, userAddress: string) {
    return getMaonoVaultContract().deposit(amount, userAddress);
  },

  async withdraw(amount: bigint, userAddress: string) {
    return getMaonoVaultContract().withdraw(amount, userAddress, userAddress);
  },

  async updateNAV(newNav: bigint) {
    if (!signer) throw new Error("No manager signer configured");
    return resilientRpcProvider.callWithSigner(signer, (activeSigner) =>
      getMaonoVaultContract(activeSigner).updateNAV(newNav)
    );
  },

  async distributePerformanceFee(profit: bigint) {
    if (!signer) throw new Error("No manager signer configured");
    return resilientRpcProvider.callWithSigner(signer, (activeSigner) =>
      getMaonoVaultContract(activeSigner).distributePerformanceFee(profit)
    );
  },

  async listenToEvents(callback: (event: IndexerVaultEvent) => Promise<void> | void) {
    const INDEXER_NAME = 'maono_vault_main_indexer';
    const CHAIN_ID = Number(process.env.CHAIN_ID || 44787);
    const START_BLOCK = Number(process.env.MAONO_START_BLOCK || 22000000);
    const MAX_BLOCK_RANGE = 1000;

    // Recover last processed block from DB (durable cursor)
    const progressRows = await db.select().from(indexerProgress).where(eq(indexerProgress.indexerName, INDEXER_NAME)).limit(1);
    let lastProcessedBlock = progressRows[0]?.lastProcessedBlock ?? START_BLOCK;

    if (!progressRows[0]) {
      await db.insert(indexerProgress).values({
        indexerName: INDEXER_NAME,
        lastProcessedBlock: START_BLOCK,
        chainId: CHAIN_ID,
      }).onConflictDoNothing();
    }

    const processEvent = async (event: {
      type: string;
      vaultId: string;
      transactionHash: string;
      blockNumber: number;
      timestamp: number | string;
      userAddress?: string | null;
      tokenSymbol?: string;
      amount?: string | number;
      newNAV?: string | null;
      newFee?: string | null;
      newStatus?: string | null;
      [key: string]: unknown;
    }) => {
      await callback(event);
    };

    let activeWsProvider: ResilientWsProvider | null = null;

    const getCurrentEventProvider = async (): Promise<ethers.Provider> => {
      if (activeWsProvider) {
        try {
          return activeWsProvider.getProvider();
        } catch {
          // Fall back to the resilient RPC provider if the websocket is not yet connected.
        }
      }
      return resilientRpcProvider.getRawProvider();
    };

    const backfillGap = createVaultGapBackfillHandler({
      contract: {
        queryFilter: async (_eventName: string, fromBlock: number, toBlock: number) => {
          const provider = await getCurrentEventProvider();
          return getMaonoVaultContract().connect(provider).queryFilter('*', fromBlock, toBlock);
        },
      },
      provider: {
        getBlock: async (blockNumber: number) => {
          const provider = await getCurrentEventProvider();
          return provider.getBlock(blockNumber);
        },
      },
      callback: processEvent,
    });

    const primaryWsUrl = process.env.CELO_WS_URL || process.env.WS_URL || null;
    const fallbackWsUrl = process.env.CELO_WS_FALLBACK_URL || process.env.WS_URL_FALLBACK || primaryWsUrl || null;

    if (primaryWsUrl) {
      activeWsProvider = new ResilientWsProvider({
        primary: { name: 'primary-ws', wsUrl: primaryWsUrl },
        fallback: { name: 'fallback-ws', wsUrl: fallbackWsUrl || primaryWsUrl },
        onFailover: (from, to, reason) => console.warn(`[WS] Vault indexer failover ${from} -> ${to}: ${reason}`),
        onReconnectAttempt: (endpoint, attempt) => console.info(`[WS] Vault indexer reconnecting to ${endpoint}, attempt ${attempt}`),
        onGapDetected: async (fromBlock, toBlock) => {
          await backfillGap(fromBlock, toBlock);
        },
      });
    }

    const getCurrentBlockNumber = async (): Promise<number> => {
      if (activeWsProvider) {
        try {
          return await activeWsProvider.getProvider().getBlockNumber();
        } catch {
          // Fall back to RPC if the websocket is unavailable.
        }
      }
      return resilientRpcProvider.call((provider) => provider.getBlockNumber());
    };

    const pollEvents = async () => {
      try {
        const currentBlock = await getCurrentBlockNumber();
        if (currentBlock <= lastProcessedBlock) return;

        // FIX: Ensure no blocks are skipped if the service goes offline
        const fromBlock = lastProcessedBlock + 1;
        
        // Split processing ranges into digestible, provider-safe chunks
        const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, currentBlock);
        
        console.log(`[Event Loop] Syncing chunk: ${fromBlock} -> ${toBlock} (Current Tip: ${currentBlock})`);
        await backfillGap(fromBlock, toBlock);

        // Commit the new block height pointer to the DB atomically, then advance local pointer
        await db.update(indexerProgress).set({ lastProcessedBlock: toBlock, updatedAt: new Date() }).where(eq(indexerProgress.indexerName, INDEXER_NAME));
        lastProcessedBlock = toBlock;

      } catch (error: any) {
        console.error('[Event Listener Master] Fail:', error.message);
      }
    };

    if (activeWsProvider) {
      try {
        await activeWsProvider.connect();
      } catch (error: any) {
        console.warn('[WS] Vault indexer websocket unavailable, continuing with RPC polling', error?.message || error);
      }
    }

    setInterval(pollEvents, 15000);
    await pollEvents();
  },
};