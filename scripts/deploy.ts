import hre from 'hardhat';
const { ethers } = hre;
import * as fs from 'fs';
import * as path from 'path';

// Load existing state to allow resuming
function getSavedDeployment(network: string) {
  const dir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${network}.json`);
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};
}

function saveDeployment(network: string, state: Record<string, any>) {
  const dir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${network}.json`);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
}

function log(msg: string) {
  console.log(`[deploy] ${msg}`);
}

function logAddress(name: string, addr: string) {
  console.log(`[deploy] ${name} => ${addr}`);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name || String((await ethers.provider.getNetwork()).chainId);
  const state = getSavedDeployment(network);

  log(`Deploying on network: ${network}. Deployer: ${deployer.address}`);

  // Helper: Deploy only if address not already in state
  async function deployContract(name: string, factory: any, args: any[]) {
    if (state[name]) {
      log(`Found existing ${name} at ${state[name]}. Skipping...`);
      return factory.attach(state[name]);
    }
    log(`Deploying ${name}...`);
    const contract = await factory.deploy(...args);
    // For ethers v6, waitForDeployment
    if ((contract as any).waitForDeployment) await (contract as any).waitForDeployment();
    const addr = (contract as any).getAddress ? await (contract as any).getAddress() : contract.address;
    state[name] = addr;
    saveDeployment(network, state); // Save progress after each step
    logAddress(name, addr);
    return contract;
  }

  // Example usage — adapt to actual contracts and constructor args
  const ReputationEngineFactory = await ethers.getContractFactory('ReputationEngine');
  const reputationEngine = await deployContract('ReputationEngine', ReputationEngineFactory, [ethers.ZeroAddress, deployer.address]);

  // TODO: add additional deployments following the same pattern

  log('Deployment run complete. Review deployments in /deployments/' + network + '.json');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Deployment failed:', err);
    process.exit(1);
  });
