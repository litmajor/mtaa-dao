# MaonoVault ABI Setup

To enable blockchain integration, you need the ABI (Application Binary Interface) for your MaonoVault contract in JSON format.

## How to Generate ABI

1. **Compile the Contract**
   - Use Hardhat, Foundry, or Remix to compile `MaonoVault.sol`.
   - Example with Hardhat:
     ```bash
     npx hardhat compile
     ```
2. **Locate the ABI**
   - After compiling, find the ABI in `artifacts/contracts/MaonoVault.sol/MaonoVault.json` (Hardhat) or similar for your tool.
3. **Copy ABI File**
   - Copy the full JSON file (not just the `abi` array) to:
     ```
     contracts/MaonoVault.json
     ```

## Why?
- This file is required for the backend to interact with the contract using ethers.js.

## Next Step
- Once `MaonoVault.json` is present, your backend blockchain integration will work.
