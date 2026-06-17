import hardhat from 'hardhat';
const { ethers } = hardhat;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying MTAAToken with account:', deployer.address);

  const owner = process.env.OWNER || deployer.address;
  const multiSig = process.env.MULTISIG || deployer.address;
  const reputation = process.env.REPUTATION || deployer.address;
  const apy = process.env.APY_CALCULATOR || deployer.address;

  const Mtaa = await ethers.getContractFactory('MTAAToken');
  const token = await Mtaa.deploy(owner, multiSig, reputation, apy);

  await token.waitForDeployment();
  console.log('MTAAToken deployed to:', token.target);
  console.log('Constructor args:', { owner, multiSig, reputation, apy });
}

main().catch((err) => {
  console.error('Deployment failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
