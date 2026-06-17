import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const rpc = process.env.CELO_RPC_URL;
  const privKey = process.env.FACTORY_OWNER_PRIVATE_KEY;
  const factoryAddr = process.env.FACTORY_CONTRACT_ADDRESS;
  const registryAddr = process.env.STRATEGY_REGISTRY_ADDRESS;

  if (!rpc || !privKey || !factoryAddr || !registryAddr) {
    console.error('Missing env. Require CELO_RPC_URL, FACTORY_OWNER_PRIVATE_KEY, FACTORY_CONTRACT_ADDRESS, STRATEGY_REGISTRY_ADDRESS');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpc);
  const signer = new ethers.Wallet(privKey, provider);

  const FACTORY_ABI = [
    'function setStrategyRegistry(address _registry) external',
    'function strategyRegistry() view returns (address)'
  ];

  const factory = new ethers.Contract(factoryAddr, FACTORY_ABI, signer);

  const current = await factory.strategyRegistry();
  console.log('Current factory.strategyRegistry =', current);
  if (current.toLowerCase() === registryAddr.toLowerCase()) {
    console.log('Registry already set to desired address');
    return;
  }

  const tx = await factory.setStrategyRegistry(registryAddr);
  console.log('Sent tx:', tx.hash);
  const receipt = await tx.wait();
  console.log('Mined in block', receipt.blockNumber);
  const updated = await factory.strategyRegistry();
  console.log('Updated factory.strategyRegistry =', updated);
}

main().catch((err) => { console.error(err); process.exit(1); });
