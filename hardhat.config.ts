// hardhat.config.ts
// Production-Ready Hardhat Configuration with Security Hardening

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-mocha-ethers"; 
// Note: `hardhat-gas-reporter` is incompatible with Hardhat 3 in this project setup.
// Temporarily remove its import to avoid runtime errors during migration.
// import "hardhat-gas-reporter";
import * as dotenv from "dotenv";

// Securely initialize environment variables before parsing config
dotenv.config();

const config = {
  
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,  // Optimization for code size
      },
    },
  },

  // Build `networks` programmatically so we avoid adding entries with empty URLs
  networks: (() => {
    const base: Record<string, any> = {
      hardhat: {
        type: "edr-simulated",
        chainId: 31337,
        forking: process.env.FORKING === "true" && process.env.MAINNET_RPC_URL
          ? { enabled: true, url: process.env.MAINNET_RPC_URL }
          : undefined,
      },

      localhost: {
        type: "http",
        url: "http://127.0.0.1:8545",
      },

      sepolia: {
        type: "http",
        url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
        accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        gasPrice: 2_000_000_000,
        chainId: 11155111,
        timeout: 40_000,
      },

      amoy: {
        type: "http",
        url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
        accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        gasPrice: 30_000_000_000,
        chainId: 80002,
      },

      celo_alfajores: {
        type: "http",
        url: process.env.CELO_ALFAJORES_RPC_URL || "https://alfajores-forno.celo-testnet.org",
        accounts: process.env.CELO_ALFAJORES_PRIVATE_KEY ? [process.env.CELO_ALFAJORES_PRIVATE_KEY] : [],
        gasPrice: 1_000_000_000,
        chainId: 44787,
        timeout: 40_000,
      },

      celo_mainnet: {
        type: "http",
        url: process.env.CELO_MAINNET_RPC_URL || "https://forno.celo.org",
        accounts: process.env.CELO_MAINNET_PRIVATE_KEY ? [process.env.CELO_MAINNET_PRIVATE_KEY] : [],
        gasPrice: 2_000_000_000,
        chainId: 42220,
        timeout: 60_000,
      },

      polygon_mainnet: {
        type: "http",
        url: process.env.POLYGON_MAINNET_RPC_URL || "https://polygon-rpc.com",
        accounts: process.env.POLYGON_MAINNET_PRIVATE_KEY ? [process.env.POLYGON_MAINNET_PRIVATE_KEY] : [],
        gasPrice: 100_000_000_000,
        chainId: 137,
        timeout: 60_000,
      },
    };

    // Only add `mainnet` when an RPC URL is provided to avoid validation errors
    if (process.env.MAINNET_RPC_URL) {
      base.mainnet = {
        type: "http",
        url: process.env.MAINNET_RPC_URL,
        accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        gasPrice: 50_000_000_000,
        chainId: 1,
        timeout: 60_000,
      };
    }

    return base;
  })(),

  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
      celo: process.env.CELOSCAN_API_KEY || "",
      alfajores: process.env.CELOSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "celo",
        chainId: 42220,
        urls: { apiURL: "https://api.celoscan.io/api", browserURL: "https://celoscan.io/" }
      },
      {
        network: "alfajores",
        chainId: 44787,
        urls: { apiURL: "https://api-alfajores.celoscan.io/api", browserURL: "https://alfajores.celoscan.io/" }
      }
    ]
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    outputFile: "gas-report.txt",
    noColors: false,
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  // TypeChain for type-safe contract interactions
  typechain: {
    outDir: "typechain",
    target: "ethers-v6",
  },
} as HardhatUserConfig;

export default config;