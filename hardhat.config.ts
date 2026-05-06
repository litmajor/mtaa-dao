// hardhat.config.ts
// Production-Ready Hardhat Configuration with Security Hardening

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "hardhat-gas-reporter";
import "solidity-coverage";
require("dotenv").config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,  // Optimization for code size
      },
    },
  },

  networks: {
    // ─────────────────────────────────────────────────────────────────────
    // LOCAL DEVELOPMENT
    // ─────────────────────────────────────────────────────────────────────
    hardhat: {
      chainId: 31337,
      forking: {
        enabled: process.env.FORKING === "true",
        url: process.env.MAINNET_RPC_URL || "",
      },
    },

    localhost: {
      url: "http://127.0.0.1:8545",
    },

    // ─────────────────────────────────────────────────────────────────────
    // SEPOLIA TESTNET (Phase 1 Deployment)
    // ─────────────────────────────────────────────────────────────────────
    // [FIX #3] Gas Price Configuration: Prevents "Transaction Underpriced"
    // ─────────────────────────────────────────────────────────────────────
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      
      // [FIX #3] Set explicit gas price
      // Sepolia can spike to 50+ gwei on busy days
      // This ensures transactions go through
      gasPrice: 2_000_000_000,  // 2 gwei (adjust based on current market)
      
      // Alternatively, use 'auto' to let ethers estimate
      // gasPrice: 'auto',
      
      // Max priority fee for EIP-1559 (if network supports it)
      maxPriorityFeePerGas: undefined,  // Let Hardhat calculate
      
      // Chain ID
      chainId: 11155111,

      // Timeout for confirmation (in milliseconds)
      timeout: 40_000,
    },

    // ─────────────────────────────────────────────────────────────────────
    // ETHEREUM MAINNET (Phase 1 Mainnet Launch - After Audit)
    // ─────────────────────────────────────────────────────────────────────
    mainnet: {
      url: process.env.MAINNET_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      
      // [FIX #3] Mainnet gas price (higher than testnet)
      // Mainnet base fee: 10-200 gwei (varies)
      // Recommended: 25-50 gwei for normal speed
      gasPrice: 50_000_000_000,  // 50 gwei (adjust based on market)
      
      // Max fee per gas cap (to prevent catastrophic overpayment)
      maxFeePerGas: 150_000_000_000,  // 150 gwei cap
      
      chainId: 1,
      timeout: 60_000,
    },

    // ─────────────────────────────────────────────────────────────────────
    // OTHER TESTNETS (For reference)
    // ─────────────────────────────────────────────────────────────────────
    goerli: {
      url: process.env.GOERLI_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 2_000_000_000,
      chainId: 5,
    },

    amoy: {
      url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 1_000_000_000,  // 1 gwei (Polygon is cheap)
      chainId: 80002,
    },

    // ─────────────────────────────────────────────────────────────────────
    // CELO NETWORK (Primary Market - Phase 1A)
    // [FIX #3] Gas prices optimized for Celo economic conditions
    // ─────────────────────────────────────────────────────────────────────
    
    celo_alfajores: {
      url: process.env.CELO_ALFAJORES_RPC_URL || "https://alfajores-forno.celo-testnet.org",
      accounts: process.env.CELO_ALFAJORES_PRIVATE_KEY ? [process.env.CELO_ALFAJORES_PRIVATE_KEY] : [],
      
      // [FIX #3] Celo gas price (1-3 gwei typical)
      // Alfajores is cheap, use 1 gwei to save testnet costs
      gasPrice: 1_000_000_000,  // 1 gwei (Celo testnet)
      
      chainId: 44787,
      timeout: 40_000,
    },

    celo_mainnet: {
      url: process.env.CELO_MAINNET_RPC_URL || "https://forno.celo.org",
      accounts: process.env.CELO_MAINNET_PRIVATE_KEY ? [process.env.CELO_MAINNET_PRIVATE_KEY] : [],
      
      // [FIX #3] Celo mainnet gas price (1-5 gwei typical, usually 1-2)
      // Celo is designed for low gas costs in developing markets
      // Recommended: 2 gwei for production
      gasPrice: 2_000_000_000,  // 2 gwei (Celo mainnet)
      
      chainId: 42220,
      timeout: 60_000,
    },

    // ─────────────────────────────────────────────────────────────────────
    // POLYGON NETWORK (Scaling Layer - Phase 2)
    // [FIX #3] Gas prices for Polygon ecosystem
    // ─────────────────────────────────────────────────────────────────────
    
    polygon_mumbai: {
      url: process.env.POLYGON_MUMBAI_RPC_URL || "https://rpc-mumbai.maticvigil.com",
      accounts: process.env.POLYGON_MUMBAI_PRIVATE_KEY ? [process.env.POLYGON_MUMBAI_PRIVATE_KEY] : [],
      
      // [FIX #3] Polygon gas price is typically 20-100 gwei
      // Mumbai testnet: use 50 gwei (middle ground)
      gasPrice: 50_000_000_000,  // 50 gwei (Polygon testnest)
      
      chainId: 80001,
      timeout: 40_000,
    },

    polygon_mainnet: {
      url: process.env.POLYGON_MAINNET_RPC_URL || "https://polygon-rpc.com",
      accounts: process.env.POLYGON_MAINNET_PRIVATE_KEY ? [process.env.POLYGON_MAINNET_PRIVATE_KEY] : [],
      
      // [FIX #3] Polygon mainnet gas price (30-200 gwei)
      // Recommended: 100 gwei for normal speed
      // Monitor: polygonscan.com/gastracker before deploying
      gasPrice: 100_000_000_000,  // 100 gwei (Polygon mainnet)
      
      // Max fee cap to prevent catastrophic overpayment
      maxFeePerGas: 400_000_000_000,  // 400 gwei cap
      
      chainId: 137,
      timeout: 60_000,
    },
  },

  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      goerli: process.env.ETHERSCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
    },
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
    deployments: "./deployments",
  },

  // TypeChain for type-safe contract interactions
  typechain: {
    outDir: "typechain",
    target: "ethers-v6",
  },
};

export default config;

/**
 * SECURITY HARDENING NOTES:
 * 
 * [FIX #3] GAS PRICE CONFIGURATION
 * ================================
 * 
 * Why explicit gas prices?
 * - Sepolia: Base fee varies 1-50 gwei; default Hardhat config often too low
 * - Mainnet: Gas fees critical for cost; need to set caps
 * - Prevents: "Transaction Underpriced" errors on busy days
 * 
 * Recommended Prices:
 * 
 * SEPOLIA (Testnet):
 *   - Off-peak: 1 gwei (works most times)
 *   - Normal: 2 gwei (recommended)
 *   - Peak: 5-50 gwei (adjust if errors occur)
 * 
 * MAINNET (Production):
 *   - Off-peak: 10-20 gwei
 *   - Normal: 25-50 gwei (recommended)
 *   - Peak: 100-200+ gwei
 * 
 * How to Check Current Gas Prices:
 * 
 * 1. Etherscan Gas Tracker:
 *    https://etherscan.io/gastracker
 *    https://sepolia.etherscan.io/gastracker
 * 
 * 2. Alchemy Gas Price API:
 *    curl https://eth-sepolia.g.alchemy.com/v2/$ALCHEMY_API_KEY \
 *      -X POST \
 *      -H "Content-Type: application/json" \
 *      -d '{"jsonrpc":"2.0","method":"eth_gasPrice","params":[],"id":1}'
 * 
 * 3. Programmatically (in script):
 *    const provider = ethers.getDefaultProvider('sepolia');
 *    const gasPrice = await provider.getGasPrice();
 *    console.log(ethers.utils.formatUnits(gasPrice, 'gwei'));
 * 
 * Deployment Script Configuration:
 * 
 * Inside scripts/deploy-phase1-with-vesting.ts, you can override:
 * 
 *   const deployTx = await MtaaToken.deploy(owner.address, ...);
 *   // Override gas price if needed:
 *   // const overrides = { gasPrice: ethers.utils.parseUnits('5', 'gwei') };
 *   // const deployTx = await MtaaToken.deploy(owner.address, ..., overrides);
 * 
 * SEPOLIA DEPLOYMENT (Testing):
 * 
 * Command:
 *   npx hardhat run scripts/deploy-phase1-with-vesting.ts --network sepolia
 * 
 * Current config: gasPrice = 2_000_000_000 (2 gwei)
 * - Works for: Off-peak to normal conditions
 * - If error "Transaction Underpriced": Increase to 5-10 gwei
 * - If error "Out of gas": Problem is not gas price, check contract logic
 * 
 * MAINNET DEPLOYMENT (Production - After Audit):
 * 
 * Command:
 *   npx hardhat run scripts/deploy-mainnet.ts --network mainnet
 * 
 * Current config: gasPrice = 50_000_000_000 (50 gwei), max cap 150 gwei
 * - Safe for: Normal market conditions
 * - If fees too high: Change to 25 gwei (slower but cheaper)
 * - Monitor: etherscan.io/gastracker before deploying
 * 
 * COST ESTIMATION (Phase 1 Deployment):
 * 
 * Total gas for all 4 contracts + vesting:
 * - ~5-7M gas total
 * - At 2 gwei Sepolia: ~10-14k USD equivalent (not real money, testnet)
 * - At 50 gwei Mainnet: ~250-350 USD (mainnet)
 * 
 * Detailed Breakdown:
 * 1. MtaaToken: ~2M gas
 * 2. MultiSigTreasury: ~1M gas
 * 3. ReputationEngine: ~1.5M gas
 * 4. FloatingAPYCalculator: ~800k gas
 * 5. TokenDistributionInitializer: ~600k gas
 * 6. Wiring (5 setter calls): ~200k gas
 * ────────────────────────────────
 * Total: ~6.5M gas
 * 
 * Cost = 6.5M * gasPrice
 * - Sepolia (2 gwei): 6,500,000 * 0.000000002 = 0.013 ETH (~$30-50 at $2-4k/ETH)
 * - Mainnet (50 gwei): 6,500,000 * 0.00000005 = 0.325 ETH (~$800-1000 at $2-4k/ETH)
 * 
 * Strategies to Reduce Cost:
 * - Deploy contracts in parallel (doesn't help, still sequential)
 * - Optimize contract code (runs analyzer: hardhat analyze)
 * - Use proxy pattern (adds complexity, saves ~30% gas)
 * - Wait for low gas day (~20-30% savings possible)
 * 
 * MONITORING DEPLOYMENT:
 * 
 * 1. Watch deployment output:
 *    npx hardhat run scripts/deploy-phase1-with-vesting.ts --network sepolia
 * 
 * 2. Check transaction on Etherscan:
 *    sepolia.etherscan.io/tx/{txHash}
 *    - Status: Success/Failed
 *    - Gas used: Should match estimate
 *    - Transaction fee: gasUsed * gasPrice
 * 
 * 3. Verify contracts:
 *    npx hardhat verify --network sepolia <address> <constructor args>
 * 
 * 4. Monitor for errors:
 *    - "Transaction Underpriced": Increase gasPrice
 *    - "Out of gas": Contract code issue, not gas price
 *    - "Nonce too low": Already executed, check explorer
 * 
 * ENV VARIABLE SETUP:
 * 
 * Create `.env` file:
 *   SEPOLIA_RPC_URL=https://rpc.sepolia.org
 *   MAINNET_RPC_URL=https://eth.publicnode.com
 *   PRIVATE_KEY=0x...  # Deployer private key (NEVER commit this!)
 *   ETHERSCAN_API_KEY=...  # For contract verification
 *   REPORT_GAS=true  # For gas reporter
 * 
 * Load with: source .env  (Linux/Mac) or set (Windows)
 */
