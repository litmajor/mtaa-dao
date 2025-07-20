# Blockchain Integration

## Overview
- Uses ethers.js to interact with MaonoVault contract
- Service: `server/blockchain.ts`

## Usage
- Import and use `MaonoVaultService` for contract calls
- Configure `MAONO_VAULT_ADDRESS`, `RPC_URL`, `MANAGER_PRIVATE_KEY` in `.env`

## Example
```ts
import { MaonoVaultService } from './blockchain';
const [nav, lastUpdate] = await MaonoVaultService.getNAV();
```

## Events
- Listen to contract events for automation/analytics

---
See `vault_automation.md` for automation/indexing.
