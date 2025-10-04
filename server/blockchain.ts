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

  async getNAV() {
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
    maonoVault.on("NAVUpdated", (newNAV, timestamp) => {
      callback({ type: "NAVUpdated", newNAV, timestamp });
    });
    // Add more event listeners as needed
  },
};