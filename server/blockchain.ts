import { ethers } from "ethers";
import MaonoVaultArtifact from "../contracts/MaonoVault.json" assert { type: "json" };
// If your TypeScript or Node.js setup does not support 'assert', use the following instead:
// import MaonoVaultArtifact = require("../contracts/MaonoVault.json");

// --- Configuration ---
const Maono_CONTRACT_ADDRESS = process.env.MAONO_CONTRACT_ADDRESS || ""; // Set in env
const PROVIDER_URL = process.env.RPC_URL || "http://localhost:8545";
const PRIVATE_KEY = process.env.MANAGER_PRIVATE_KEY || ""; // For manager actions

// --- Provider & Signer ---
const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
const signer = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, provider) : undefined;

// --- Contract Instance ---
const maonoVault = new ethers.Contract(
  Maono_CONTRACT_ADDRESS,
  MaonoVaultArtifact.abi,
  signer || provider
);

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
