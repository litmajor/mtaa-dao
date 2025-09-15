// deploy.js - Hardhat deployment script

const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Starting MaonoVault System Deployment...\n");

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH\n");

    // --- STEP 1: Deploy MaonoVault (Template Contract) ---
    console.log("📋 Step 1: Deploying MaonoVault template...");
    const MaonoVault = await ethers.getContractFactory("MaonoVault");
    
    // Note: We're not actually using this deployment, it's just to compile the contract
    // The factory will create instances of this contract
    console.log("✅ MaonoVault template compiled successfully\n");

    // --- STEP 2: Deploy MaonoVaultFactory ---
    console.log("🏭 Step 2: Deploying MaonoVaultFactory...");
    
    // Configure initial supported assets (Celo mainnet addresses)
    const supportedAssets = [
        "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD
        "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", // cEUR
        "0x2DEf4285787d58a2f811AF24755A8150622f4361"  // cREAL
    ];
    
    const assetSymbols = ["cUSD", "cEUR", "cREAL"];
    
    // Platform treasury (where deployment fees go)
    const platformTreasury = "0x123...ABC"; // Replace with your address
    
    const MaonoVaultFactory = await ethers.getContractFactory("MaonoVaultFactory");
    const factory = await MaonoVaultFactory.deploy(
        platformTreasury,
        supportedAssets,
        assetSymbols
    );
    
    await factory.deployed();
    console.log("✅ MaonoVaultFactory deployed to:", factory.address);
    console.log("   - Platform Treasury:", platformTreasury);
    console.log("   - Supported Assets:", assetSymbols.join(", "));
    console.log("   - Deployment Fee:", ethers.utils.formatEther(await factory.deploymentFee()), "ETH\n");

    // --- STEP 3: Example - Deploy a Sample Vault ---
    console.log("📦 Step 3: Deploying sample vault instance...");
    
    const deploymentFee = await factory.deploymentFee();
    
    const vaultConfig = {
        minDeposit: ethers.utils.parseEther("10"),      // 10 cUSD minimum
        vaultCap: ethers.utils.parseEther("100000"),    // 100k cUSD cap
        performanceFee: 1500,                           // 15%
        managementFee: 200,                             // 2% annual
        withdrawalDelay: 86400                          // 1 day
    };

    const tx = await factory.deployVault(
        supportedAssets[0],                    // cUSD
        deployer.address,                      // Manager (you)
        deployer.address,                      // DAO treasury (you)
        "Sample Community Vault",              // Vault name
        "SCV",                                // Symbol
        ["SAMPLE_DAO", "TEST_DAO"],           // Valid DAOs
        vaultConfig,
        { value: deploymentFee }
    );

    const receipt = await tx.wait();
    const vaultDeployedEvent = receipt.events?.find(e => e.event === 'VaultDeployed');
    const sampleVaultAddress = vaultDeployedEvent?.args?.vault;
    
    console.log("✅ Sample vault deployed to:", sampleVaultAddress);
    console.log("   - Name: Sample Community Vault (SCV)");
    console.log("   - Asset: cUSD");
    console.log("   - Min Deposit: 10 cUSD");
    console.log("   - Vault Cap: 100,000 cUSD\n");

    // --- STEP 4: Verification Info ---
    console.log("🔍 Contract Verification Commands:");
    console.log(`npx hardhat verify --network mainnet ${factory.address} "${platformTreasury}" "${JSON.stringify(supportedAssets)}" "${JSON.stringify(assetSymbols)}"`);
    
    // --- STEP 5: Frontend Configuration ---
    console.log("\n⚙️  Frontend Configuration:");
    const frontendConfig = {
        network: "celo-mainnet", // or "celo-alfajores" for testnet
        factoryAddress: factory.address,
        supportedAssets: supportedAssets.map((addr, i) => ({
            address: addr,
            symbol: assetSymbols[i],
            name: assetSymbols[i] === "cUSD" ? "Celo Dollar" : 
                  assetSymbols[i] === "cEUR" ? "Celo Euro" : "Celo Real"
        })),
        deploymentFee: deploymentFee.toString(),
        sampleVault: sampleVaultAddress
    };
    
    console.log(JSON.stringify(frontendConfig, null, 2));

    console.log("\n🎉 Deployment Complete!");
    console.log("\nNext Steps:");
    console.log("1. Save the factory address:", factory.address);
    console.log("2. Update your frontend with the configuration above");
    console.log("3. Test vault deployment on your UI");
    console.log("4. Start onboarding communities!");
}

// Alternative deployment for testing (Alfajores testnet)
async function deployTestnet() {
    console.log("🧪 Deploying to Alfajores Testnet...\n");

    const [deployer] = await ethers.getSigners();
    
    // Alfajores testnet addresses
    const supportedAssets = [
        "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1", // Test cUSD
        "0x10c892A6EC43a53E45D0B916B4b7D383B1b78C0F"  // Test cEUR
    ];
    
    const assetSymbols = ["cUSD", "cEUR"];
    const platformTreasury = deployer.address; // Use deployer as treasury for testing
    
    const MaonoVaultFactory = await ethers.getContractFactory("MaonoVaultFactory");
    const factory = await MaonoVaultFactory.deploy(
        platformTreasury,
        supportedAssets,
        assetSymbols
    );
    
    await factory.deployed();
    
    console.log("✅ Test Factory deployed to:", factory.address);
    console.log("🔗 View on Explorer: https://alfajores-blockscout.celo-testnet.org/address/" + factory.address);
    
    return factory.address;
}

// Error handling
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });

// Export functions for programmatic use
module.exports = { main, deployTestnet };