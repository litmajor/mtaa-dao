
import { ethers } from 'hardhat';

async function main() {
  console.log('Deploying AchievementNFT contract...');

  const AchievementNFT = await ethers.getContractFactory('AchievementNFT');
  const achievementNFT = await AchievementNFT.deploy();

  await achievementNFT.deployed();

  console.log('AchievementNFT deployed to:', achievementNFT.address);
  console.log('Save this address to your .env file as ACHIEVEMENT_NFT_CONTRACT_ADDRESS');

  return achievementNFT.address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
