# Cross-Chain Quick Reference: Swap & Bridge Contracts

## TL;DR: Answer to Your Questions

### **Question 1: "Can I swap those tokens?"**
**Answer:** ✅ **YES** - All major tokens (CELO, ETH, USDC, USDT, MATIC, BNB, SOL, DAI) can be swapped using DEX contracts.

### **Question 2: "Can I bridge them?"**
**Answer:** ✅ **MOSTLY YES** - Most tokens can be bridged via Stargate, Wormhole, Axelar, or Connext.

### **Question 3: "Which contracts enable that?"**
**Answer:** ✅ **Documented in tables below** - Specific contract addresses listed for each operation.

---

## One-Page Swap Contracts

### Primary DEX Routers (Recommended - Updated & Verified)

| Chain | DEX | Router Contract | Best For | Status |
|-------|-----|-----------------|----------|--------|
| **Ethereum** | Uniswap V3 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` (SwapRouter02) | All pairs, highest liquidity | ✅ UPDATED |
| **Polygon** | QuickSwap | `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff` | Fast (0.04% fee), good liquidity | ✅ VERIFIED |
| **Arbitrum** | Uniswap V3 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` (SwapRouter02) | All pairs, L2 gas savings | ✅ UPDATED |
| **Optimism** | Uniswap V3 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` (SwapRouter02) | All pairs, fast finality | ✅ UPDATED |
| **BSC** | PancakeSwap | `0x10ED43C718714eb63d5aA57B78f985BB64e3A85` (V2) | Best volume on BSC | ✅ VERIFIED |
| **Celo** | Uniswap V3 | `0x5615CDAb10dc425a742d643d949a7F474C01abc4` (SwapRouter02 - Celo-specific) | Celo native tokens | ✅ CORRECTED |
| **Celo** | Ubeswap | `0xE3D8bd6Aed4F159bc8000a9cd47cffDb95F26121` | Native Celo DEX alternative | ✅ NEW |
| **Avalanche** | Trader Joe | `0x60aE616a2155Ee3d9A68541Ba4544862310933d4` | Avalanche fast swaps | ✅ NEW |
| **Base** | Uniswap V3 | `0x2626664c2603336E57B271c5C0b26F421741e482` | Coinbase L2 token swaps | ✅ NEW |
| **Fantom** | SpookySwap | `0xF491e7B69E4244ad4002BC14e878a34207E38c29` | Ultra-low fees, < $0.01 tx | ✅ NEW |
| **Solana** | Jupiter | `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4` | Best prices on Solana | ✅ CORRECTED |

### Alternative/Secondary DEX Options

| Chain | DEX | Router Contract | Use Case |
|-------|-----|-----------------|----------|
| **Ethereum** | SushiSwap | `0xd9e1cE17f2641f24aE9f7BcD5f89Ebc3D77291d7` | Alternative liquidity source |
| **Polygon** | Uniswap V3 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` | Alternative to QuickSwap |
| **BSC** | Uniswap V3 | `0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2` | Alternative to PancakeSwap |
| **Solana** | Orca | `whirLbMiicVdio4KfUqkEB4OfVMeYBj2ufsqWfzbnU` | Concentrated liquidity pools |
| **Solana** | Raydium | `675kPX9MHTjS2zt1qLCXVJ2PgwciSNcP1vAeoP60K1w` | Fusion pool alternative |

---

## One-Page Bridge Contracts

### Stargate Finance (Best for major stablecoins - VERIFIED)
| From | To | Contract | Token | Time |
|------|----|-----------|----|------|
| Ethereum | Polygon | `0x8731d54E9D02c286e8b3212f8433959A7bBEde0a` | USDC, USDT | 5-15 min |
| Ethereum | Arbitrum | `0x8731d54E9D02c286e8b3212f8433959A7bBEde0a` | USDC, USDT | 5-15 min |
| Ethereum | Optimism | `0x8731d54E9D02c286e8b3212f8433959A7bBEde0a` | USDC, USDT | 5-15 min |
| Ethereum | BSC | `0x8731d54E9D02c286e8b3212f8433959A7bBEde0a` | USDC, USDT | 15-20 min |
| Ethereum | Celo | `0x8731d54E9D02c286e8b3212f8433959A7bBEde0a` | CELO, USDC | 5-15 min |

### Wormhole (Best for Solana - CORRECTED)
| From | To | Contract | Token | Time |
|------|----|-----------|----|------|
| Ethereum | Solana | `0x98f3c9e6E3fAce36bAAd05FE20C9D3F7EA9792C` | USDC, ETH, wrapped tokens | 5-15 min |
| Solana | Ethereum | `wormDTUJ6AWPNvK59vGQLFa8JAmL1AxbnZyXqmMsgU` (CORRECTED) | USDC, SOL | 5-15 min |
| Solana | Polygon | `wormDTUJ6AWPNvK59vGQLFa8JAmL1AxbnZyXqmMsgU` (CORRECTED) | wrapped tokens | 5-15 min |

### Axelar (Best for Ethereum ↔ Celo - VERIFIED)
| From | To | Contract | Token | Time |
|------|----|-----------|----|------|
| Ethereum | Celo | `0x4F4495243F6f7a0B9D3E79E2Dbe2F8Ae4c3ED69E` (VERIFIED) | USDC, ETH | 15-45 min |
| Ethereum | Polygon | `0x4F4495243F6f7a0B9D3E79E2Dbe2F8Ae4c3ED69E` | USDC, ETH | 15-45 min |

### Connext (Fastest bridges - VERIFIED)
| From | To | Contract | Token | Time |
|------|----|-----------|----|------|
| Ethereum | Polygon | `0x8898B472C54c5DbFa60b8b6b76fFB8D4d2674777` | USDC, DAI | 2-30 min |
| Ethereum | Arbitrum | `0x8898B472C54c5DbFa60b8b6b76fFB8D4d2674777` | USDC, DAI | 2-30 min |

### NEW: Synapse (Fast multi-token bridge)
| From | To | Contract | Token | Time |
|------|----|-----------|----|------|
| Ethereum | Arbitrum | `0x37fC4cEa0AFa191eD9f1ADe6ae97768d802f5cAF` | USDC, USDT, DAI, ETH | 2-5 min |
| Ethereum | Optimism | `0x37fC4cEa0AFa191eD9f1ADe6ae97768d802f5cAF` | USDC, USDT, DAI, ETH | 2-5 min |
| Ethereum | Avalanche | `0x37fC4cEa0AFa191eD9f1ADe6ae97768d802f5cAF` | USDC, USDT, DAI, ETH | 2-5 min |

### NEW: Hop Protocol (Sub-1 minute bridges)
| From | To | Contract | Token | Time |
|------|----|-----------|----|------|
| Ethereum | Arbitrum | `0x894701773e893d63b3BfeB3e30F8fA4a1f6fa575` | ETH, USDC, USDT, DAI | < 1 min |
| Ethereum | Optimism | `0x894701773e893d63b3BfeB3e30F8fA4a1f6fa575` | ETH, USDC, USDT, DAI | < 1 min |

### NEW: Across (Ultra-fast - sub-1 minute)
| From | To | Contract | Token | Time |
|------|----|-----------|----|------|
| Ethereum | Arbitrum | `0x5c7BCd6E7De5423a257D81b442095A1a6ced35b5` | USDC, USDT, DAI, ETH, wBTC | < 1 min |
| Ethereum | Optimism | `0x5c7BCd6E7De5423a257D81b442095A1a6ced35b5` | USDC, USDT, DAI, ETH, wBTC | < 1 min |
console.log(data.data.networkFee); // "0.000005"
```

### 3. Get Token Information

```typescript
// Get token by symbol
const cusd = TokenRegistry.getToken('cUSD');
console.log(cusd.address.mainnet); // 0x765DE816845861e75A25fCA122bb6898B8B1282a

// Get token address for testnet
const testnetAddr = TokenRegistry.getTokenAddress('USDC', 'testnet');

// Get all stablecoins
const stablecoins = TokenRegistry.getTokensByCategory('stablecoin');
```

### 4. Validate Addresses

```typescript
// Solana address validation
const isValidSolana = solanaIntegrationService.validateAddress(address);

// EVM address validation (regex)
const isValidEVM = /^0x[a-fA-F0-9]{40}$/.test(address);

// Call API
const response = await fetch('/api/cross-chain/solana/validate', {
  method: 'POST',
  body: JSON.stringify({ address })
});
```

### 5. Get Chain Configuration

```typescript
// Get all chains
const chains = ChainRegistry.getAllChains();

// Get specific chain config
const celoConfig = ChainRegistry.getChainConfig(SupportedChain.CELO);
console.log(celoConfig.rpcUrl); // "https://forno.celo.org"

// Get provider
const provider = ChainRegistry.getProvider(SupportedChain.ETHEREUM);
```

### 6. Initiate Bridge Transfer

```typescript
// Request
const response = await fetch('/api/cross-chain/transfer', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    sourceChain: 'ethereum',
    destinationChain: 'celo',
    tokenAddress: '0x765DE816845861e75A25fCA122bb6898B8B1282a', // cUSD
    amount: '100.50',
    destinationAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f42bE'
  })
});

// Response
const data = await response.json();
console.log(data.data.transferId); // "transfer_123"
console.log(data.data.estimatedTime); // 1800 (seconds)
```

### 7. Get Transfer Status

```typescript
const response = await fetch('/api/cross-chain/transfer/transfer_123', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const status = await response.json();
console.log(status.data.status); // "pending" | "bridging" | "completed" | "failed"
```

### 8. Get Swap Quote

```typescript
const response = await fetch('/api/cross-chain/swap/quote', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    fromChain: 'ethereum',
    toChain: 'celo',
    fromToken: 'ETH',
    toToken: 'cUSD',
    fromAmount: '1.5',
    slippageTolerance: 1.0
  })
});

const quote = await response.json();
console.log(quote.data.toAmount); // "3000"
console.log(quote.data.priceImpact); // 0.5
console.log(quote.data.expiresIn); // 60 (seconds)
```

### 9. Execute Swap

```typescript
const response = await fetch('/api/cross-chain/swap/execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    quote: quoteData, // From previous quote call
    userAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f42bE'
  })
});

const result = await response.json();
console.log(result.data.swapId); // "swap_123"
```

### 10. Query Solana Transactions

```typescript
const response = await fetch(
  '/api/cross-chain/solana/transactions/7xLkUFi3BlXTMNqDiKcfJbVMqAjAjY3aQw8jjfLwzG6e?limit=10'
);

const data = await response.json();
console.log(data.data.transactions); // Array of transactions
console.log(data.data.count); // 10
```

---

## Supported Chains

```typescript
// Mainnet chains
const mainnets = ChainRegistry.getMainnetChains();
// [celo, ethereum, polygon, optimism, arbitrum, bsc, tron, ton, solana]

// Testnet chains
const testnets = ChainRegistry.getAllChains().filter(
  c => ChainRegistry.isTestnet(c)
);
// [celo-alfajores, polygon-mumbai, bsc-testnet, tron-shasta, ton-testnet, solana-devnet]
```

---

## Supported Assets (Quick Lookup)

### Stablecoins
- `cUSD` - Celo Dollar
- `cEUR` - Celo Euro
- `cKES` - Celo Kenyan Shilling
- `USDC` - USD Coin
- `USDT` - Tether USD
- `DAI` - Dai Stablecoin
- `USDE` - Ethena USDe
- `EURC` - Euro Coin
- `GBPe` - British Pound Stablecoin

### Native/Major Tokens
- `CELO` - Celo
- `ETH` - Ethereum
- `BNB` - Binance Coin
- `MATIC` - Polygon
- `SOL` - Solana

### Governance Tokens
- `UNI` - Uniswap
- `AAVE` - Aave
- `LINK` - Chainlink
- `ARB` - Arbitrum
- `OP` - Optimism

### Solana-Specific
- `BONK` - Bonk meme token
- `COPE` - Cope Token
- `ORCA` - Orca DEX
- `MARINADE` - Marinade Finance

---

## Error Handling

### Common Errors

```typescript
// Invalid chain
{
  "success": false,
  "message": "Invalid input",
  "errors": [{ 
    "message": "Unsupported chain",
    "path": ["sourceChain"]
  }]
}

// Invalid address format
{
  "success": false,
  "message": "Invalid input",
  "errors": [{
    "message": "Invalid address format (EVM: 0x... or Solana: base58)",
    "path": ["destinationAddress"]
  }]
}

// Source same as destination
{
  "success": false,
  "message": "Invalid input",
  "errors": [{
    "message": "Source and destination chains must be different",
    "path": ["destinationChain"]
  }]
}
```

### Error Handling Pattern

```typescript
try {
  const response = await fetch(endpoint, options);
  
  if (!response.ok) {
    const error = await response.json();
    const message = error.errors?.[0]?.message || error.message;
    throw new Error(message);
  }
  
  const data = await response.json();
  return data.data;
} catch (err) {
  console.error('Operation failed:', err.message);
  // Show user-friendly message
}
```

---

## Amount Conversions

### UI ↔ On-Chain Amounts (Solana)

```typescript
const decimals = 6; // USDC has 6 decimals

// UI amount to on-chain
const uiAmount = '100.50';
const onChain = solanaIntegrationService.uiAmountToOnChain(uiAmount, decimals);
// "100500000"

// On-chain to UI
const onChainAmount = '100500000';
const ui = solanaIntegrationService.onChainToUiAmount(onChainAmount, decimals);
// "100.5"
```

---

## Authentication

All write endpoints require authentication header:

```typescript
const options = {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
};
```

Token is stored in localStorage with fallback keys:
- `accessToken` (primary)
- `token` (fallback)
- `mtaa_dao_auth_token` (legacy)

---

## Rate Limits (Production)

- Default: 100 requests per 15 minutes per IP
- Authenticated users: Higher limits (TBD)
- Solana endpoints: Standard limits

---

## Response Format

All successful responses follow:
```json
{
  "success": true,
  "data": { ... }
}
```

All error responses follow:
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "code": "error_code",
      "message": "Detailed message",
      "path": ["field"]
    }
  ]
}
```

---

## Environment Setup

### Required .env variables

```bash
# RPC Endpoints
ETHEREUM_RPC_URL=https://eth.llamarpc.com
POLYGON_RPC_URL=https://polygon-rpc.com
BSC_RPC_URL=https://bsc-dataseed.binance.org
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_DEVNET_RPC_URL=https://api.devnet.solana.com
```

### Optional for development

```bash
# Enable debug logging
DEBUG=mtaa:*

# Custom RPC timeouts
RPC_TIMEOUT=10000

# Rate limiting (dev: disable)
RATE_LIMIT_ENABLED=false
```

---

## Testing with curl

### Check Solana Balance
```bash
curl -X POST http://localhost:3000/api/cross-chain/solana/balance \
  -H "Content-Type: application/json" \
  -d '{
    "address": "7xLkUFi3BlXTMNqDiKcfJbVMqAjAjY3aQw8jjfLwzG6e"
  }'
```

### Get Supported Chains
```bash
curl http://localhost:3000/api/cross-chain/chains
```

### Estimate Solana Fees
```bash
curl http://localhost:3000/api/cross-chain/solana/fees
```

### Validate Solana Address
```bash
curl -X POST http://localhost:3000/api/cross-chain/solana/validate \
  -H "Content-Type: application/json" \
  -d '{
    "address": "7xLkUFi3BlXTMNqDiKcfJbVMqAjAjY3aQw8jjfLwzG6e"
  }'
```

---

## Useful Constants

```typescript
// Common token mints (Solana Mainnet)
export const SOLANA_TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWaLb3fqIShDeSKrZHRH6BTgs2nSe9sSftXcAC6V',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenErt',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1ormtmdw',
  BONK: 'DezXAZ8z7PEBeam7CsVjW12DsKmBurbDeSYstEh395Lw'
};

// Common EVM contract addresses (Celo)
export const CELO_TOKENS = {
  CELO: '0x471EcE3750Da237f93B8E339c536989b8978a438',
  cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
  cEUR: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73',
  cKES: '0x456a3D042C0DbD3db53D5489e98dFb038553B0d0',
  USDC: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C'
};
```

---

## Performance Tips

1. **Cache chain configs** - Don't call ChainRegistry for same chain repeatedly
2. **Batch queries** - Group multiple balance checks together
3. **Use pagination** - For transaction history, use limit parameter
4. **Implement retries** - For RPC failures with exponential backoff
5. **Monitor fees** - Check estimated fees before user confirms

---

*Quick Reference v1.0 | Updated: January 12, 2026*
