# MaonoVault Smart Contracts

## Overview
- `MaonoVault.sol`: ERC4626 vault contract for MtaaDAO
- `MVLT`: LP token (ERC20, via ERC4626)

## Deployment
- See `deploy_maono_vault.ts` for deployment script
- Configure addresses in `.env` or script

## ABI
- Compile with Hardhat/Foundry/Remix
- Place `MaonoVault.json` ABI in `contracts/`

## Key Functions
- `deposit`, `withdraw`, `previewNAV`, `updateNAV`, `setPerformanceFee`, `distributePerformanceFee`

## Governance
- DAO can change fees, manager, cap, pause deposits

---
See main project README for more.
