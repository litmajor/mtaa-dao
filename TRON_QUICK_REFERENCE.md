# TRON Service Quick Reference

## Installation

```bash
npm install
```

## Import

```typescript
import { 
  tronIntegrationService,    // Mainnet
  tronTestnetService         // Shasta testnet
} from './services/tronIntegrationService';
```

---

## Common Operations

### Check Address Validity
```typescript
const isValid = tronIntegrationService.validateAddress(address);
if (!isValid) throw new Error('Invalid TRON address');
```

### Get Balance
```typescript
const trxBalance = await tronIntegrationService.getBalance(address);
// "100.5" (TRX)
```

### Get Token Balance
```typescript
const tokenBalance = await tronIntegrationService.getTokenBalance(
  address,
  'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' // USDT contract
);
// Returns raw amount, apply decimals
const usdtAmount = tronIntegrationService.onChainToUiAmount(tokenBalance, 6);
```

### Check Transaction Status
```typescript
const status = await tronIntegrationService.getTransactionStatus(txid);
if (status.status === 'confirmed') {
  console.log(`Confirmed with ${status.energyUsed} energy used`);
}
```

### Estimate Fees
```typescript
const fees = await tronIntegrationService.estimateFees();
// {
//   networkFee: '0.1',      // TRX
//   energyPrice: 50,        // SUN per energy
//   bandwidthPrice: 1,      // SUN per byte
//   estimatedEnergyNeeded: 25000
// }
```

### Get Account Details
```typescript
const account = await tronIntegrationService.getAccountInfo(address);
console.log(`Energy: ${account.energyUsed}/${account.energyLimit}`);
console.log(`Frozen: ${account.frozenBalance} TRX`);
```

### Validate Transfer Amount
```typescript
const isValid = tronIntegrationService.validateTransferAmount(amount, decimals);
const onChainAmount = tronIntegrationService.uiAmountToOnChain(amount, decimals);
```

---

## API Structure

### Address Operations
- `validateAddress(address)` → boolean
- `validateContractAddress(address)` → Promise<boolean>
- `convertAddress(address)` → string (hex ↔ base58)

### Balance Queries
- `getBalance(address)` → Promise<string> (TRX)
- `getTokenBalance(address, token)` → Promise<string> (raw)
- `hassufficientBalance(address, amount, token?)` → Promise<boolean>

### Token Info
- `getTokenInfo(address)` → Promise<TronTokenInfo>
- `getTokenSupply(address)` → Promise<string>

### Account Info
- `getAccountInfo(address)` → Promise<TronAccountInfo>
- `isAccountActivated(address)` → Promise<boolean>
- `getNonce(address)` → Promise<number>

### Transactions
- `getTransactionStatus(txid)` → Promise<TronTransactionStatus>
- `getRecentTransactions(address, limit?)` → Promise<TronTransactionStatus[]>

### Fees & Chain
- `estimateFees()` → Promise<TronGasFees>
- `getChainParameters()` → Promise<{chainId, blockTime, transactionFee}>

### Utilities
- `uiAmountToOnChain(amount, decimals)` → string
- `onChainToUiAmount(amount, decimals)` → string
- `validateTransferAmount(amount, decimals)` → boolean

---

## Error Handling

All methods throw `AppError`:

```typescript
try {
  await tronIntegrationService.getBalance(address);
} catch (error) {
  if (error.statusCode === 400) {
    // Invalid input (bad address, etc.)
  } else if (error.statusCode === 404) {
    // Not found (transaction, account, etc.)
  } else if (error.statusCode === 500) {
    // Network/service error
  }
}
```

---

## Environment Variables

```bash
TRON_RPC_URL=https://api.trongrid.io
TRON_API_KEY=your_api_key  # Optional

TRON_TESTNET_RPC_URL=https://api.shasta.trongrid.io
TRON_TESTNET_API_KEY=your_testnet_api_key  # Optional
```

---

## TRON Testnet (Shasta)

Get test TRX: https://shasta.tronscan.org/#/tools/faucet

```typescript
const balance = await tronTestnetService.getBalance(address);
```

---

## Common Contracts (Mainnet)

| Token | Address |
|-------|---------|
| USDT | TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t |
| USDC | TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8 |
| BTT | TR7PHKespzsJrPZLmMVTPMFmSrHSrWQSPs |

---

## Key Differences from EVM

| Aspect | TRON | EVM |
|--------|------|-----|
| **Address** | Base58 | Hex (0x...) |
| **Units** | TRX / SUN | ETH / Wei |
| **Gas** | Energy + Bandwidth | Gas |
| **Fee Model** | Fixed + Dynamic | Dynamic only |
| **Nonce** | Not used | Used for ordering |
| **Account Creation** | Needs 0.1+ TRX | Auto on first tx |

---

## Integration Checklist

- [ ] npm install tronweb
- [ ] Configure TRON_RPC_URL env var
- [ ] Test validateAddress() on testnet
- [ ] Test getBalance() on testnet
- [ ] Test getTokenBalance() for USDT
- [ ] Add to crossChainService.ts
- [ ] Add unit tests
- [ ] Deploy to staging

---

**Service Status: ✅ READY FOR USE**
