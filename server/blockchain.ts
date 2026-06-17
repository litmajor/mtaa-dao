import { ethers } from "ethers";
import MaonoVaultArtifact from "../contracts/MaonoVault.json" with { type: "json" };
import { tokenService } from './services/tokenService';
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

const MAONO_CONTRACT_ADDRESS = process.env.MAONO_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';

function isContractConfigured(): boolean {
  if (!MAONO_CONTRACT_ADDRESS || MAONO_CONTRACT_ADDRESS === "" || MAONO_CONTRACT_ADDRESS === "0x1234567890123456789012345678901234567890") {
    return false;
  }
  return ethers.isAddress(MAONO_CONTRACT_ADDRESS);
}

function getMaonoVaultContract(): ethers.Contract {
  if (!isContractConfigured()) {
    throw new Error(`MAONO_CONTRACT_ADDRESS is unconfigured or invalid: "${MAONO_CONTRACT_ADDRESS}"`);
  }
  return new ethers.Contract(MAONO_CONTRACT_ADDRESS, MaonoVaultArtifact.abi, signer || provider);
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
    const code = await provider.getCode(MAONO_CONTRACT_ADDRESS);
    if (code === "0x") {
      throw new Error(`No contract deployed at address ${MAONO_CONTRACT_ADDRESS}`);
    }
    return getMaonoVaultContract().previewNAV();
  },

  async deposit(amount: bigint, userAddress: string) {
    return getMaonoVaultContract().deposit(amount, userAddress);
  },

  async withdraw(amount: bigint, userAddress: string) {
    return getMaonoVaultContract().withdraw(amount, userAddress, userAddress);
  },

  async updateNAV(newNav: bigint) {
    if (!signer) throw new Error("No manager signer configured");
    return getMaonoVaultContract().updateNAV(newNav);
  },

  async distributePerformanceFee(profit: bigint) {
    if (!signer) throw new Error("No manager signer configured");
    return getMaonoVaultContract().distributePerformanceFee(profit);
  },

  async listenToEvents(callback: (event: IndexerVaultEvent) => Promise<void> | void) {
    const INDEXER_NAME = 'maono_vault_main_indexer';
    const CHAIN_ID = Number(process.env.CHAIN_ID || 44787);
    const START_BLOCK = Number(process.env.MAONO_START_BLOCK || 22000000);
    const MAX_BLOCK_RANGE = 1000;

    const RETRY_CONFIG = {
      maxRetries: 3,
      baseDelay: 2000,
    };

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

    const queryEventsWithRetry = async (fromBlock: number, toBlock: number, retryCount = 0): Promise<any[]> => {
      try {
        return await getMaonoVaultContract().queryFilter("*", fromBlock, toBlock);
      } catch (error: any) {
        if (retryCount < RETRY_CONFIG.maxRetries) {
          const delay = RETRY_CONFIG.baseDelay * Math.pow(2, retryCount);
          console.warn(`[Event Query] Retry ${retryCount + 1} after ${delay}ms due to: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return queryEventsWithRetry(fromBlock, toBlock, retryCount + 1);
        }
        console.error('[Event Query] Retries exhausted:', error.message);
        return [];
      }
    };

    const pollEvents = async () => {
      try {
        const currentBlock = await provider.getBlockNumber();
        if (currentBlock <= lastProcessedBlock) return;

        // FIX: Ensure no blocks are skipped if the service goes offline
        const fromBlock = lastProcessedBlock + 1;
        
        // Split processing ranges into digestible, provider-safe chunks
        const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, currentBlock);
        
        console.log(`[Event Loop] Syncing chunk: ${fromBlock} -> ${toBlock} (Current Tip: ${currentBlock})`);
        const events = await queryEventsWithRetry(fromBlock, toBlock);

        // FIX: Use a shared local cache to batch and reuse block timestamps
        const blockTimestampCache: Record<number, number> = {};

        for (const event of events) {
          try {
            const eventName = event.eventName || event.fragment?.name;
            if (!eventName) continue;

            // Resolve block timestamp with minimal RPC overhead
            if (!blockTimestampCache[event.blockNumber]) {
              const block = await provider.getBlock(event.blockNumber);
              blockTimestampCache[event.blockNumber] = block ? block.timestamp : Math.floor(Date.now() / 1000);
            }

            // Normalize fields safely using canonical mapping rules
            const normalizedArgs: Record<string, any> = {};
            if (event.args) {
              const fragment = event.fragment;
              fragment.inputs.forEach((input: any, index: number) => {
                const value = event.args[index];
                normalizedArgs[input.name] = typeof value === 'bigint' ? value.toString() : value;
              });
            }

            // Extract core address keys
            const userAddress = normalizedArgs.user || normalizedArgs.caller || normalizedArgs.owner || null;
            const vaultId = normalizedArgs.vaultId || normalizedArgs.id || 'canonical_vault';

            // Dispatch structured payload matching indexer interface
            callback({
              type: eventName,
              vaultId: vaultId.toString(),
              transactionHash: event.transactionHash ?? '',
              blockNumber: event.blockNumber,
              timestamp: blockTimestampCache[event.blockNumber] ?? Math.floor(Date.now() / 1000),
              userAddress: userAddress ? userAddress.toLowerCase() : null,
              tokenSymbol: normalizedArgs.symbol || 'cUSD',
              amount: normalizedArgs.amount || normalizedArgs.value || '0',
              newNAV: normalizedArgs.newNAV || null,
              newFee: normalizedArgs.newFee || null,
              newStatus: normalizedArgs.newStatus || null
            });

          } catch (err) {
            console.error('Error processing event item:', err);
          }
        }

        // Commit the new block height pointer to the DB atomically, then advance local pointer
        await db.update(indexerProgress).set({ lastProcessedBlock: toBlock, updatedAt: new Date() }).where(eq(indexerProgress.indexerName, INDEXER_NAME));
        lastProcessedBlock = toBlock;

      } catch (error: any) {
        console.error('[Event Listener Master] Fail:', error.message);
      }
    };

    setInterval(pollEvents, 15000);
    await pollEvents();
  },
};