import hardhat from "hardhat";
const { ethers } = hardhat;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const asset = deployer.address;
  const daoTreasury = deployer.address;
  const manager = deployer.address;

  const MaonoVault = await ethers.getContractFactory("MaonoVault");
  const vault = await MaonoVault.deploy(asset, daoTreasury, manager);

  await vault.waitForDeployment(); // This is the correct ethers v6 method
  console.log("MaonoVault deployed to:", vault.target);
}

main().catch((error) => {
  console.error("Error deploying contracts:");
  if (error instanceof Error) {
    console.error(error.message);
  }
  console.error(error);
  process.exitCode = 1;
});