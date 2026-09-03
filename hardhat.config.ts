// hardhat.config.ts
// This is the app-level Hardhat configuration for the main smart-contract toolchain.
// It compiles and deploys the repository's production Solidity contracts under ./contracts.
//
// IMPORTANT: Do not treat Foundry as the default compiler for the app stack.
// The project intentionally uses two separate toolchains:
//   - Hardhat: production contracts, deployment, compile checks, and app-level scripts.
//   - Foundry: isolated security research suite under ./test/security and ./test/security/harness.
//
// Standard dev fallback for compile-only checks when env vars are not configured:
//   $key='0x0123456789012345678901234567890123456789012345678901234567890123';
//   $env:PRIVATE_KEY=$key; $env:CELO_ALFAJORES_PRIVATE_KEY=$key; $env:CELO_MAINNET_PRIVATE_KEY=$key; $env:POLYGON_MAINNET_PRIVATE_KEY=$key;
//   npx hardhat compile
//
// This avoids exposing real private keys in local development. Use real credentials via
// environment variables or a secrets manager in production.
//
// Rule for future work: use `npx hardhat ...` / `npm run contracts:compile` for app contracts.
// Use `forge ...` only for the locally scoped security harness defined in foundry.toml.
// Do not run `forge build` or other Foundry commands against the app contract set unless
// the scope is explicitly restricted to the security harness.
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import "@nomicfoundation/hardhat-verify";
import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

// Helper to sanitize private keys safely
const getPrivateKey = (key?: string): string[] => {
  if (!key || key.trim() === "") return [];
  return key.startsWith("0x") ? [key] : [`0x${key}`];
};

const config: HardhatUserConfig = {
  // The app-level contract toolchain intentionally does not depend on Foundry.
  // Foundry is reserved for the local security research suite in ./test/security.
  plugins: [hardhatToolboxMochaEthersPlugin],

  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      viaIR: true, // Prevents "Stack Too Deep" & cuts contract bytecode size
      optimizer: {
        enabled: true,
        runs: 1, // Optimizes for lowest deployment size
      },
      metadata: {
        bytecodeHash: "none",
      },
    },
  },

  networks: {
    hardhat: {
      type: "edr-simulated",
      chainId: 31337,
      forking:
        process.env.FORKING === "true" && process.env.MAINNET_RPC_URL
          ? {
              url: process.env.MAINNET_RPC_URL,
              enabled: true,
            }
          : undefined,
    },

    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },

    sepolia: {
      type: "http",
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: getPrivateKey(process.env.PRIVATE_KEY),
      chainId: 11155111,
      gasPrice: 2_000_000_000,
      timeout: 40000,
    },

    amoy: {
      type: "http",
      url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts: getPrivateKey(process.env.PRIVATE_KEY),
      chainId: 80002,
      gasPrice: 30_000_000_000,
    },

    celo_alfajores: {
      type: "http",
      url: process.env.CELO_ALFAJORES_RPC_URL || "https://alfajores-forno.celo-testnet.org",
      accounts: getPrivateKey(process.env.CELO_ALFAJORES_PRIVATE_KEY || process.env.PRIVATE_KEY),
      chainId: 44787,
      gasPrice: 1_000_000_000,
      timeout: 40000,
    },

    celo_mainnet: {
      type: "http",
      url: process.env.CELO_MAINNET_RPC_URL || "https://forno.celo.org",
      accounts: getPrivateKey(process.env.CELO_MAINNET_PRIVATE_KEY || process.env.PRIVATE_KEY),
      chainId: 42220,
      gasPrice: 2_000_000_000,
      timeout: 60000,
    },

    polygon_mainnet: {
      type: "http",
      url: process.env.POLYGON_MAINNET_RPC_URL || "https://polygon-rpc.com",
      accounts: getPrivateKey(process.env.POLYGON_MAINNET_PRIVATE_KEY || process.env.PRIVATE_KEY),
      chainId: 137,
      gasPrice: 100_000_000_000,
      timeout: 60000,
    },
  },

  // Verification configuration block for Hardhat 3
  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY || "",
    },
  },

  paths: {
    // Keep the app-contract toolchain isolated from the Foundry-only security suite in ./test/security.
    // Hardhat should compile only the production contract source tree, not the Foundry harness/test files.
    sources: "./contracts",
    tests: "./tests",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  typechain: {
    outDir: "typechain-types",
  },
} as unknown as HardhatUserConfig;

export default config;