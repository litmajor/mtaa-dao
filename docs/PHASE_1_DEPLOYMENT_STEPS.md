# Phase 1 Deployment & Integration Guide

## Overview

This guide provides step-by-step instructions for deploying and integrating the three Phase 1 contracts (MultiSigTreasury, ReputationEngine, FloatingAPYCalculator) with the existing MtaaToken.

---

## Deployment Steps

### Step 1: Deploy MtaaToken with Placeholder Addresses

First, deploy MtaaToken **without** Phase 1 contracts (they don't exist yet):

```typescript
// Hardhat deployment script
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const owner = "0x..."; // Your address

const MtaaToken = await ethers.getContractFactory("MTAAToken");
const mtaa = await MtaaToken.deploy(
    owner,              // _owner
    ZERO_ADDRESS,       // _multiSigTreasury (placeholder)
    ZERO_ADDRESS,       // _reputationEngine (placeholder)
    ZERO_ADDRESS        // _apyCalculator (placeholder)
);
await mtaa.deployed();
console.log("MtaaToken deployed:", mtaa.address);
```

### Step 2: Deploy Phase 1.1 MultiSigTreasury

Deploy the multi-sig treasury with 5 signers (founder, 2 advisors, 2 community delegates):

```typescript
const signers = [
    "0x...", // Founder
    "0x...", // Advisor 1
    "0x...", // Advisor 2
    "0x...", // Community Delegate 1
    "0x...", // Community Delegate 2
];

const MultiSigTreasury = await ethers.getContractFactory("MultiSigTreasury");
const treasury = await MultiSigTreasury.deploy(
    mtaa.address,
    signers // 5-element array
);
await treasury.deployed();
console.log("MultiSigTreasury deployed:", treasury.address);
```

### Step 3: Deploy Phase 1.2 ReputationEngine

Deploy the decentralized reputation system:

```typescript
const ReputationEngine = await ethers.getContractFactory("ReputationEngine");
const reputation = await ReputationEngine.deploy(
    mtaa.address,       // _mtaaToken
    owner               // _owner (initial admin)
);
await reputation.deployed();
console.log("ReputationEngine deployed:", reputation.address);
```

### Step 4: Deploy Phase 1.3 FloatingAPYCalculator

Deploy the adaptive APY calculator:

```typescript
const FloatingAPYCalculator = await ethers.getContractFactory("FloatingAPYCalculator");
const apy = await FloatingAPYCalculator.deploy(
    mtaa.address        // _mtaaToken
);
await apy.deployed();
console.log("FloatingAPYCalculator deployed:", apy.address);
```

### Step 5: Wire Phase 1 Contracts into MtaaToken

Update MtaaToken with references to all three Phase 1 contracts:

```typescript
// Connect all three
await mtaa.setMultiSigTreasury(treasury.address);
console.log("✅ MultiSigTreasury wired");

await mtaa.setReputationEngine(reputation.address);
console.log("✅ ReputationEngine wired");

await mtaa.setAPYCalculator(apy.address);
console.log("✅ FloatingAPYCalculator wired");

console.log("\n🎉 Phase 1 Integration Complete!");
```

---

## Full Deployment Script

Here's a complete Hardhat deployment script:

```typescript
// scripts/deploy-phase1.ts

import { ethers } from "hardhat";

async function main() {
    console.log("🚀 Deploying Phase 1 (Trinity) Contracts...\n");

    const [owner] = await ethers.getSigners();
    console.log("Deployer:", owner.address);
    console.log("Network:", (await ethers.provider.getNetwork()).name);

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Deploy MtaaToken (with placeholder addresses)
    // ─────────────────────────────────────────────────────────────────────────

    console.log("\n[1/5] Deploying MtaaToken...");
    const MtaaToken = await ethers.getContractFactory("MTAAToken");
    const mtaa = await MtaaToken.deploy(
        owner.address,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS
    );
    await mtaa.deployed();
    console.log("✅ MtaaToken:", mtaa.address);

    // Transfer some MTAA to test signers (for rewards)
    const testSigners = (await ethers.getSigners()).slice(0, 5);
    for (const signer of testSigners) {
        if (signer.address !== owner.address) {
            await mtaa.transfer(signer.address, ethers.utils.parseEther("100000"));
        }
    }
    console.log("   Distributed test MTAA to 5 signers (100K each)");

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Deploy MultiSigTreasury (Phase 1.1)
    // ─────────────────────────────────────────────────────────────────────────

    console.log("\n[2/5] Deploying MultiSigTreasury (Phase 1.1)...");
    const signerAddresses = testSigners.map(s => s.address);
    const MultiSigTreasury = await ethers.getContractFactory("MultiSigTreasury");
    const treasury = await MultiSigTreasury.deploy(
        mtaa.address,
        [...signerAddresses] as [string, string, string, string, string]
    );
    await treasury.deployed();
    console.log("✅ MultiSigTreasury:", treasury.address);
    console.log("   Signers:", signerAddresses.slice(0, 3).join(", "), "...");

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: Deploy ReputationEngine (Phase 1.2)
    // ─────────────────────────────────────────────────────────────────────────

    console.log("\n[3/5] Deploying ReputationEngine (Phase 1.2)...");
    const ReputationEngine = await ethers.getContractFactory("ReputationEngine");
    const reputation = await ReputationEngine.deploy(
        mtaa.address,
        owner.address
    );
    await reputation.deployed();
    console.log("✅ ReputationEngine:", reputation.address);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: Deploy FloatingAPYCalculator (Phase 1.3)
    // ─────────────────────────────────────────────────────────────────────────

    console.log("\n[4/5] Deploying FloatingAPYCalculator (Phase 1.3)...");
    const FloatingAPYCalculator = await ethers.getContractFactory("FloatingAPYCalculator");
    const apy = await FloatingAPYCalculator.deploy(mtaa.address);
    await apy.deployed();
    console.log("✅ FloatingAPYCalculator:", apy.address);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: Wire Everything Together
    // ─────────────────────────────────────────────────────────────────────────

    console.log("\n[5/5] Wiring Phase 1 Contracts into MtaaToken...");

    await mtaa.setMultiSigTreasury(treasury.address);
    console.log("✅ MultiSigTreasury wired to MtaaToken");

    await mtaa.setReputationEngine(reputation.address);
    console.log("✅ ReputationEngine wired to MtaaToken");

    await mtaa.setAPYCalculator(apy.address);
    console.log("✅ FloatingAPYCalculator wired to MtaaToken");

    // ─────────────────────────────────────────────────────────────────────────
    // Summary
    // ─────────────────────────────────────────────────────────────────────────

    console.log("\n📋 Deployment Summary:\n");
    console.log(`MtaaToken:              ${mtaa.address}`);
    console.log(`MultiSigTreasury:       ${treasury.address}`);
    console.log(`ReputationEngine:       ${reputation.address}`);
    console.log(`FloatingAPYCalculator:  ${apy.address}`);

    console.log("\n✅ Phase 1 Integration Complete!");
    console.log("\nNext steps:");
    console.log("  1. Verify contracts on Etherscan");
    console.log("  2. Run integration tests");
    console.log("  3. Schedule audit with security firm");
    console.log("  4. Get community approval via governance vote");
    console.log("  5. Deploy to mainnet in Week 5");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
```

**Run the deployment:**
```bash
npx hardhat run scripts/deploy-phase1.ts --network sepolia
```

---

## Checklist

- [ ] All 3 Phase 1 contracts deployed on testnet
- [ ] MtaaToken wired to all 3 contracts
- [ ] Integration tests pass
- [ ] Verified fees go to MultiSigTreasury
- [ ] Verified APY calculation works
- [ ] Verified reputation events recorded
- [ ] Ready for security audit

---

**Status**: Phase 1 Ready for Deployment  
**Next Step**: Run full test suite  
**Timeline**: 1-2 days for integration, 2-3 weeks for audit
