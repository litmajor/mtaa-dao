import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🚀 Deploying AchievementNFTv2 Contract...\n');
  console.log('Note: This script assumes ethers and hardhat-ethers are properly configured.');
  console.log('Run with: npx hardhat run scripts/deploy-achievement-nftv2.ts --network <network-name>\n');

  try {
    // Use dynamic require to avoid import issues
    const hre = require('hardhat');
    const { ethers } = hre;

    // Get deployer
    const [deployer] = await ethers.getSigners();
    console.log(`📝 Deploying with account: ${deployer.address}\n`);

    // Get balance
    const balance = await ethers.provider.getBalance(deployer.address);
    const balanceInEther = ethers.utils.formatEther(balance);
    console.log(`💰 Account balance: ${balanceInEther} CELO\n`);

    // Deploy contract
    console.log('⏳ Deploying AchievementNFTv2...');
    const AchievementNFTv2 = await ethers.getContractFactory('AchievementNFTv2');
    const achievementNFT = await AchievementNFTv2.deploy();

    await achievementNFT.deployed();
    const contractAddress = achievementNFT.address;

    console.log(`✅ AchievementNFTv2 deployed successfully!`);
    console.log(`📍 Contract Address: ${contractAddress}\n`);

    // Verify deployment
    console.log('🔍 Verifying contract...');
    const name = await achievementNFT.name();
    const symbol = await achievementNFT.symbol();
    console.log(`✓ Name: ${name}`);
    console.log(`✓ Symbol: ${symbol}\n`);

    // Initialize with sample categories
    console.log('🏷️  Initializing achievement categories...');
    const categories = [
      'PIONEER',
      'CONTRIBUTOR',
      'VOTER',
      'PROPOSER',
      'ELDER',
      'TREASURY_MASTER',
      'COMMUNITY_CHAMPION',
      'ADVISOR',
      'EDUCATOR',
      'BUILDER',
      'AMBASSADOR',
      'INNOVATOR',
      'GUARDIAN',
      'SENTINEL'
    ];

    for (const category of categories) {
      try {
        const tx = await achievementNFT.addCategory(category);
        await tx.wait();
        console.log(`  ✓ Added category: ${category}`);
      } catch (err: any) {
        if (err.reason?.includes('already exists')) {
          console.log(`  ~ Category already exists: ${category}`);
        } else {
          console.log(`  ✗ Failed to add category: ${category}`);
        }
      }
    }

    console.log('\n🎉 Deployment Complete!\n');

    // Save deployment info
    const network = await ethers.provider.getNetwork();
    const deploymentInfo = {
      network: network.name,
      contractAddress,
      deployerAddress: deployer.address,
      deploymentDate: new Date().toISOString(),
      contractName: 'AchievementNFTv2',
      functions: {
        minting: ['mintAchievement', 'batchMintAchievements'],
        marketplace: ['listForSale', 'buyAchievement', 'unlistAchievement'],
        query: ['getUserAchievements', 'getAchievementCount', 'getUserReputation'],
        admin: ['addCategory', 'setApprovedMinter', 'setMarketplaceFee', 'setFeeCollector']
      }
    };

    const outputPath = path.join(process.cwd(), 'deployment-info-achievementv2.json');
    fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`📄 Deployment info saved to: ${outputPath}\n`);

    // Print environment setup
    console.log('🔧 Add to your .env file:');
    console.log(`ACHIEVEMENT_NFT_CONTRACT_ADDRESS=${contractAddress}\n`);

    // Print next steps
    console.log('📋 Next Steps:');
    console.log('1. Update your .env with the contract address');
    console.log('2. Call AchievementSystemService.initializeContract()');
    console.log('3. Create achievements using AchievementSystemService.createAchievement()');
    console.log('4. Mint sample achievements for testing');
    console.log('5. Deploy to production network when ready\n');

    return contractAddress;
  } catch (error) {
    console.error('❌ Deployment failed:');
    console.error(error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
