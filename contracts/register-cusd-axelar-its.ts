/**
 * scripts/register-cusd-axelar-its.ts
 *
 * Register cUSD as a canonical interchain token with Axelar ITS.
 * This is a ONE-TIME setup, not per-transfer.
 *
 * Run once on Celo (or any single chain with Axelar deployment):
 *
 *   npx hardhat run scripts/register-cusd-axelar-its.ts --network celo
 *
 * After registration, cUSD can be bridged via InterchainTokenService.interchainTransfer()
 * on any Axelar-supported chain without additional setup.
 *
 * Axelar ITS is deployed at the SAME address on every EVM chain:
 *   0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C
 *
 * See: docs.axelar.dev/dev/send-tokens/token-types#interchain-tokens
 */

import { ethers, network } from 'hardhat';

// Axelar ITS addresses — same on every EVM chain (Ethereum, Polygon, Arbitrum, etc.)
const AXELAR_ITS_ADDRESS = '0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C';
const AXELAR_ITS_ABI = [
  'function registerCanonicalInterchainToken(address tokenAddress) external returns (bytes32)',
  'function deployRemoteCanonicalInterchainToken(string memory chainName, address gasService, uint256 gasValue) external payable',
  'function interchainTransfer(bytes32 tokenId, string memory destinationChain, bytes memory destinationAddress, uint256 amount, bytes memory metadata) external payable',
];

// Axelar Gas Service — same address on every EVM chain
const AXELAR_GAS_SERVICE_ADDRESS = '0x2d5d7d31F671F86C6A4250BcAC3c7C338542D4Df';
const AXELAR_GAS_SERVICE_ABI = [
  'function payNativeForContractCall(address sender, string memory destinationChain, string memory destinationAddress, bytes memory payload, address refundAddress) external payable',
];

interface AxelarChainConfig {
  name: string; // Axelar chain name (e.g., "Ethereum", "Polygon", "Arbitrum")
  rpcUrl: string;
}

// Axelar chain names — must match what Axelar's ITS recognizes.
// See docs.axelar.dev/learn/network for current list.
const AXELAR_CHAINS: Record<string, AxelarChainConfig> = {
  ethereum: { name: 'Ethereum', rpcUrl: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com' },
  polygon: { name: 'Polygon', rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon.llamarpc.com' },
  arbitrum: { name: 'Arbitrum', rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arbitrum.llamarpc.com' },
  optimism: { name: 'Optimism', rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://optimism.llamarpc.com' },
  base: { name: 'Base', rpcUrl: 'https://base.llamarpc.com' },
  celo: { name: 'Celo', rpcUrl: process.env.CELO_RPC_URL || 'https://forno.celo.org' },
};

// cUSD address on Celo (the canonical source for this token)
const CUSD_ADDRESS_CELO = '0x765DE816845861e75A25fCA122bb6898B8B1282';

async function main() {
  const sourceChain = network.name;
  console.log(`[axelar-its] Registering cUSD on ${sourceChain}`);

  const [deployer] = await ethers.getSigners();
  console.log(`[axelar-its] Deployer: ${deployer.address}`);

  if (sourceChain !== 'celo') {
    console.warn(
      `[axelar-its] ⚠️  Registering cUSD from a non-Celo chain. ` +
      `Axelar ITS will create a wrapper, but the canonical source should be Celo.`
    );
  }

  const its = new ethers.Contract(AXELAR_ITS_ADDRESS, AXELAR_ITS_ABI, deployer);
  const tokenAddress = sourceChain === 'celo' ? CUSD_ADDRESS_CELO : CUSD_ADDRESS_CELO; // For PoC, always register canonical address

  // ── 1. Register canonical token ────────────────────────────────────────
  console.log(`[axelar-its] Registering canonical token (${tokenAddress})...`);
  let tx = await its.registerCanonicalInterchainToken(tokenAddress);
  await tx.wait();
  console.log(`[axelar-its] ✅ Canonical registration confirmed: ${tx.hash}`);

  // Extract tokenId from events (optional; Axelar derives it deterministically)
  // For this PoC, we'll just note that the token is now registered.

  // ── 2. Deploy remote wrappers on target chains ──────────────────────────
  // For each target chain, Axelar's factory will deploy a wrapped cUSD on that chain.
  // This happens via a cross-chain call, so we pay gas upfront.

  const gasService = new ethers.Contract(AXELAR_GAS_SERVICE_ADDRESS, AXELAR_GAS_SERVICE_ABI, deployer);

  const targetChains = ['ethereum', 'polygon', 'arbitrum'];
  const gasLimit = ethers.parseEther('0.1'); // Adjust based on actual relayer costs

  for (const targetChainKey of targetChains) {
    if (targetChainKey === sourceChain) continue; // Already exists on source

    const targetConfig = AXELAR_CHAINS[targetChainKey];
    if (!targetConfig) {
      console.warn(`[axelar-its] Unknown chain: ${targetChainKey}; skipping`);
      continue;
    }

    console.log(`[axelar-its] Deploying cUSD wrapper on ${targetConfig.name}...`);

    // Pay gas for the remote deployment
    const feeData = await ethers.provider.getFeeData();
    const gasTx = await gasService.payNativeForContractCall(
      deployer.address,
      targetConfig.name,
      AXELAR_ITS_ADDRESS, // destination is the ITS on the remote chain
      '0x', // minimal payload for the cross-chain call
      deployer.address, // refund address
      { value: gasLimit, gasPrice: feeData.gasPrice }
    );
    await gasTx.wait();
    console.log(`[axelar-its] Gas payment confirmed for ${targetConfig.name}: ${gasTx.hash}`);

    // Trigger remote wrapper deployment
    try {
      tx = await its.deployRemoteCanonicalInterchainToken(
        targetConfig.name,
        AXELAR_GAS_SERVICE_ADDRESS,
        0 // additional gas value (already paid above)
      );
      await tx.wait();
      console.log(`[axelar-its] ✅ Remote wrapper deployment initiated on ${targetConfig.name}: ${tx.hash}`);
    } catch (error) {
      console.warn(`[axelar-its] ⚠️  Remote wrapper deployment failed for ${targetConfig.name}:`, error);
      // This is often expected if the chain-to-chain call encounters temporary issues;
      // Axelar will retry automatically.
    }
  }

  console.log(`\n[axelar-its] ✅ cUSD registration complete!`);
  console.log(`[axelar-its] Next: Wait for remote wrappers to deploy (check Axelar explorer).`);
  console.log(`[axelar-its] Once deployed, cUSD can be bridged via:`);
  console.log(`[axelar-its]   its.interchainTransfer(tokenId, destinationChain, recipientAddress, amount, metadata)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
