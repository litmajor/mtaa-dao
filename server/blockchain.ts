// --- Imports ---
import { ethers } from "ethers";
// If your TypeScript or Node.js setup does not support 'assert', use the following instead:
// import MaonoVaultArtifact = require("../contracts/MaonoVault.json");
import MaonoVaultArtifact from "../contracts/MaonoVault.json" with { type: "json" };
import { TokenService, tokenService } from './services/tokenService';
import { TokenRegistry } from '../shared/tokenRegistry';

// Enhanced multi-token transfer function for Phase 3
export async function sendToken(
  symbol: string,
  to: string,
  amount: string | bigint
): Promise<string> {
  let amountStr: string;

  if (typeof amount === 'bigint') {
    // Treat bigint as base units, need to get correct decimals
    const token = TokenRegistry.getToken(symbol);
    const decimals = token?.decimals || 18;
    amountStr = ethers.formatUnits(amount, decimals);
  } else {
    amountStr = amount; // Already in human-readable units
  }

  return tokenService.sendToken(symbol, to, amountStr);
}

// Legacy cUSD function for backward compatibility
export async function sendCUSD(to: string, amount: string | bigint): Promise<string> {
  return sendToken('cUSD', to, amount);
}

// --- Configuration ---
const Maono_CONTRACT_ADDRESS = process.env.MAONO_CONTRACT_ADDRESS || ""; // Set in env
const PROVIDER_URL = process.env.RPC_URL || "https://alfajores-forno.celo-testnet.org";

// --- Use tokenService provider and signer to avoid duplication ---
const provider = tokenService.provider;
const signer = tokenService.signer;

// Helper to check if contract is deployed and valid
function isContractConfigured(): boolean {
  if (!Maono_CONTRACT_ADDRESS || Maono_CONTRACT_ADDRESS === "" || Maono_CONTRACT_ADDRESS === "0x1234567890123456789012345678901234567890") {
    return false;
  }
  return ethers.isAddress(Maono_CONTRACT_ADDRESS);
}

// --- Contract Instances ---
const maonoVault = new ethers.Contract(
  Maono_CONTRACT_ADDRESS,
  MaonoVaultArtifact.abi,
  signer || provider
);

// Enhanced token service access
export { tokenService };

// --- Service Methods ---
export const MaonoVaultService = {
  contract: maonoVault,
  provider,
  signer,
  isConfigured: isContractConfigured,

  async getNAV() {
    if (!isContractConfigured()) {
      throw new Error("MaonoVault contract not configured. Please deploy the contract and set MAONO_CONTRACT_ADDRESS in .env");
    }
    
    // Verify contract exists on chain
    const code = await provider.getCode(Maono_CONTRACT_ADDRESS);
    if (code === "0x") {
      throw new Error(`No contract found at address ${Maono_CONTRACT_ADDRESS}. Please verify the contract is deployed.`);
    }
    
    return maonoVault.previewNAV();
  },

  async deposit(amount: bigint, userAddress: string) {
    // User must approve the vault to spend their cUSD before calling this
    return maonoVault.deposit(amount, userAddress);
  },

  async withdraw(amount: bigint, userAddress: string) {
    return maonoVault.withdraw(amount, userAddress, userAddress);
  },

  async updateNAV(newNav: bigint) {
    if (!signer) throw new Error("No manager signer configured");
    return maonoVault.updateNAV(newNav);
  },

  async distributePerformanceFee(profit: bigint) {
    if (!signer) throw new Error("No manager signer configured");
    return maonoVault.distributePerformanceFee(profit);
  },

  async listenToEvents(callback: (event: any) => void) {
    // Use polling instead of filters to avoid "filter not found" errors
    let lastProcessedBlock = await provider.getBlockNumber();
    
    const pollEvents = async () => {
      try {
        const currentBlock = await provider.getBlockNumber();
        
        if (currentBlock > lastProcessedBlock) {
          // Query events from last processed block to current block
          const events = await maonoVault.queryFilter(
            "*", // All events
            lastProcessedBlock + 1,
            currentBlock
          );
          
          for (const event of events) {
            try {
              const eventName = event.eventName || event.fragment?.name;
              if (!eventName) continue;
              
              // Parse event based on type
              callback({
                type: eventName,
                ...event.args,
                transactionHash: event.transactionHash,
                blockNumber: event.blockNumber,
                timestamp: (await event.getBlock()).timestamp,
              });
            } catch (err) {
              console.error('Error processing event:', err);
            }
          }
          
          lastProcessedBlock = currentBlock;
        }
      } catch (error: any) {
        // Suppress filter-related errors, log others
        if (!error.message?.includes('filter')) {
          console.error('@TODO Error:', error);
        }
      }
    };
    
    // Poll every 15 seconds
    setInterval(pollEvents, 15000);
    
    // Initial poll
    pollEvents();
  },
};