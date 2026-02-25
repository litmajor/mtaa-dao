# Cross-Chain Architecture & API Documentation

## Overview

MTAA-DAO now supports a comprehensive cross-chain infrastructure with support for multiple blockchains including Solana. This document outlines the architecture, API endpoints, and best practices.

## Supported Chains

### EVM Chains (Ethereum-Compatible)
- **Celo Mainnet** (chainId: 42220)
- **Celo Alfajores Testnet** (chainId: 44787)
- **Ethereum Mainnet** (chainId: 1)
- **Polygon Mainnet** (chainId: 137)
- **Polygon Mumbai Testnet** (chainId: 80001)
- **BSC Mainnet** (chainId: 56)
- **BSC Testnet** (chainId: 97)
- **Optimism** (chainId: 10)
- **Arbitrum One** (chainId: 42161)
- **TRON Mainnet** (chainId: 728126428)
- **TRON Shasta Testnet** (chainId: 2494104990)
- **TON Mainnet** (chainId: 0)
- **TON Testnet** (chainId: 1)

### Non-EVM Chains
- **Solana Mainnet** (chainId: 101)
- **Solana Devnet** (chainId: 103)

## Supported Assets

### Stablecoins
- **cUSD** - Celo Dollar (Mainnet: 0x765DE816845861e75A25fCA122bb6898B8B1282a)
- **cEUR** - Celo Euro (Mainnet: 0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73)
- **cKES** - Celo Kenyan Shilling (Mainnet: 0x456a3D042C0DbD3db53D5489e98dFb038553B0d0)
- **USDT** - Tether USD (Bridged via Wormhole)
- **USDC** - USD Coin (Mainnet: 0xcebA9300f2b948710d2653dD7B07f33A8B32118C)
- **DAI** - Dai Stablecoin
- **USDE** - Ethena USDe
- **EURC** - Euro Coin
- **GBPe** - British Pound Stablecoin

### Native Assets
- **CELO** - Celo Native Token (Mainnet: 0x471EcE3750Da237f93B8E339c536989b8978a438)
- **SOL** - Solana Native Token (Mainnet: So11111111111111111111111111111111111111112)
- **BNB** - Binance Coin
- **ETH** - Ethereum
- **TRON** - Tronix
- **TON** - Toncoin

### Community/Governance Tokens
- **MTAA** - MtaaDAO Governance Token
- **UNI** - Uniswap Token
- **AAVE** - Aave Token
- **LINK** - Chainlink Token
- **MATIC** - Polygon
- **ARB** - Arbitrum
- **OP** - Optimism

### Solana-Specific Tokens
- **BONK** - Bonk meme token
- **COPE** - Cope Token
- **ORCA** - Orca DEX token
- **MARINADE** - Marinade Finance

## Architecture Components

### 1. Chain Registry (`shared/chainRegistry.ts`)

Centralized configuration for all supported chains with:
- RPC endpoints
- Block explorers
- Native currency information
- Contract addresses (bridge, vault, governance)
- Testnet flags

```typescript
// Get chain configuration
const config = ChainRegistry.getChainConfig(SupportedChain.ETHEREUM);

// Get provider for chain
const provider = ChainRegistry.getProvider(SupportedChain.SOLANA);

// List all chains
const chains = ChainRegistry.getAllChains();
```

### 2. Token Registry (`shared/tokenRegistry.ts`)

Comprehensive token database supporting:
- Multi-chain token addresses
- Token metadata (decimals, logo, description)
- Risk levels (low/medium/high)
- Category classification
- Yield strategies

```typescript
// Get token information
const token = TokenRegistry.getToken('USDC');

// Get active tokens
const activeTokens = TokenRegistry.getActiveTokens();

// Get tokens by category
const stablecoins = TokenRegistry.getTokensByCategory('stablecoin');

// Get token address for specific network
const address = TokenRegistry.getTokenAddress('cUSD', 'mainnet');
```

### 3. Solana Integration Service (`server/services/solanaIntegrationService.ts`)

Handles all Solana-specific operations:
- Token balance queries
- Transaction validation
- Fee estimation
- Token information lookup

Key methods:
```typescript
// Get SOL balance
const balance = await solanaIntegrationService.getBalance(address);

// Get SPL token balance
const tokenBalance = await solanaIntegrationService.getTokenBalance(address, tokenMint);

// Get token info
const tokenInfo = await solanaIntegrationService.getTokenInfo(tokenMint);

// Estimate fees
const fees = await solanaIntegrationService.estimateFees();

// Validate address
const isValid = solanaIntegrationService.validateAddress(address);

// Validate token mint
const isMintValid = await solanaIntegrationService.validateTokenMint(mint);
```

### 4. Cross-Chain Service (`server/services/crossChainService.ts`)

Manages cross-chain operations:
- Bridge initiations and status tracking
- Multi-chain vault creation
- Transfer monitoring
- Fee estimation

### 5. Cross-Chain Swap Service (`server/services/crossChainSwapService.ts`)

Handles asset swapping across chains:
- Quote generation
- Swap execution
- Slippage protection
- Price impact calculation

### 6. Bridge Relayer Service (`server/services/bridgeRelayerService.ts`)

Background service for monitoring and relaying transfers:
- Polling for transfer updates
- Retry mechanism for failed transfers
- Status updates to frontend

## API Endpoints

### Cross-Chain Bridge & Transfer

#### POST `/api/cross-chain/transfer`
Initiate a cross-chain token transfer

**Authentication:** Required (isAuthenticated middleware)

**Request:**
```json
{
  "sourceChain": "ethereum",
  "destinationChain": "celo",
  "tokenAddress": "0x...",
  "amount": "100.5",
  "destinationAddress": "0x...",
  "vaultId": "optional-vault-id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transferId": "transfer_123",
    "status": "pending",
    "sourceChain": "ethereum",
    "destinationChain": "celo",
    "amount": "100.5",
    "estimatedTime": 1800
  }
}
```

**Validation:**
- Chains must be different
- Addresses must be valid (EVM: 0x format, Solana: base58)
- Amount must be positive number
- Amount precision must match token decimals

#### GET `/api/cross-chain/transfer/:transferId`
Get transfer status

**Response:**
```json
{
  "success": true,
  "data": {
    "transferId": "transfer_123",
    "status": "completed",
    "sourceChain": "ethereum",
    "destinationChain": "celo",
    "amount": "100.5",
    "estimatedTime": 1800,
    "gasEstimate": "0.05"
  }
}
```

#### GET `/api/cross-chain/chains`
Get list of supported chains

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "chain": "celo",
      "name": "Celo Mainnet",
      "symbol": "CELO",
      "chainId": 42220,
      "isTestnet": false
    },
    ...
  ]
}
```

#### POST `/api/cross-chain/estimate-fees`
Estimate bridge fees

**Request:**
```json
{
  "sourceChain": "ethereum",
  "destinationChain": "celo",
  "amount": "100"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "networkFee": "2.5",
    "protocolFee": "0.5",
    "estimatedTotal": "3.0",
    "usdValue": "3000"
  }
}
```

### Cross-Chain Swaps

#### POST `/api/cross-chain/swap/quote`
Get swap quote

**Authentication:** Required

**Request:**
```json
{
  "fromChain": "ethereum",
  "toChain": "celo",
  "fromToken": "ETH",
  "toToken": "cUSD",
  "fromAmount": "1.5",
  "slippageTolerance": 1.0
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "quoteId": "quote_123",
    "fromToken": "ETH",
    "toToken": "cUSD",
    "fromAmount": "1.5",
    "toAmount": "3000",
    "priceImpact": 0.5,
    "fees": "10",
    "expiresIn": 60
  }
}
```

#### POST `/api/cross-chain/swap/execute`
Execute a swap

**Authentication:** Required

**Request:**
```json
{
  "quote": {...quote-data...},
  "userAddress": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "swapId": "swap_123",
    "status": "pending",
    "transactionHash": "0x..."
  }
}
```

#### GET `/api/cross-chain/swap/:swapId`
Get swap status

**Response:**
```json
{
  "success": true,
  "data": {
    "swapId": "swap_123",
    "status": "completed",
    "fromAmount": "1.5",
    "toAmount": "3000",
    "transactionHash": "0x..."
  }
}
```

### Solana-Specific Endpoints

#### POST `/api/cross-chain/solana/balance`
Get Solana or SPL token balance

**Request:**
```json
{
  "address": "7xLkUFi3BlXT...",
  "tokenMint": "EPjFWaLb3fqIShDeSKrZHRH6BTgs2nSe9sSftXcAC6V"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "7xLkUFi3BlXT...",
    "balance": "42.5"
  }
}
```

#### GET `/api/cross-chain/solana/token/:mint`
Get Solana token information

**Response:**
```json
{
  "success": true,
  "data": {
    "mint": "EPjFWaLb3fqIShDeSKrZHRH6BTgs2nSe9sSftXcAC6V",
    "symbol": "USDC",
    "name": "USD Coin",
    "decimals": 6,
    "totalSupply": "25000000"
  }
}
```

#### GET `/api/cross-chain/solana/fees`
Estimate Solana transaction fees

**Response:**
```json
{
  "success": true,
  "data": {
    "networkFee": "0.000005",
    "priorityFee": "0.000001"
  }
}
```

#### GET `/api/cross-chain/solana/transaction/:signature`
Get Solana transaction status

**Response:**
```json
{
  "success": true,
  "data": {
    "signature": "5KfYj...",
    "status": "finalized",
    "timestamp": 1234567890,
    "fee": 5000
  }
}
```

#### GET `/api/cross-chain/solana/transactions/:address`
Get recent Solana transactions

**Query Parameters:**
- `limit` (optional, default: 10, max: 50)

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "7xLkUFi3BlXT...",
    "count": 10,
    "transactions": [...]
  }
}
```

#### POST `/api/cross-chain/solana/validate`
Validate Solana address

**Request:**
```json
{
  "address": "7xLkUFi3BlXT..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "7xLkUFi3BlXT...",
    "isValid": true
  }
}
```

#### POST `/api/cross-chain/solana/validate-mint`
Validate Solana token mint

**Request:**
```json
{
  "mint": "EPjFWaLb3fqIShDeSKrZHRH6BTgs2nSe9sSftXcAC6V"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "mint": "EPjFWaLb3fqIShDeSKrZHRH6BTgs2nSe9sSftXcAC6V",
    "isValid": true
  }
}
```

## Address Formats

### EVM Addresses
- Format: `0x` followed by 40 hexadecimal characters
- Example: `0x742d35Cc6634C0532925a3b844Bc9e7595f42bE`
- Validation: `/^0x[a-fA-F0-9]{40}$/`

### Solana Addresses
- Format: Base58 encoded 32-byte public key
- Length: 44 characters
- Example: `EPjFWaLb3fqIShDeSKrZHRH6BTgs2nSe9sSftXcAC6V`
- Validation: `/^[1-9A-HJ-NP-Z]{44}$/`

## Error Handling

### HTTP Status Codes
- **200 OK** - Successful request
- **400 Bad Request** - Invalid input (validation failed)
  - Returns error details with Zod validation errors
  - Example: Invalid chain, address format, or amount
- **401 Unauthorized** - Authentication required or failed
- **404 Not Found** - Resource not found (transfer, swap, transaction)
- **500 Internal Server Error** - Server error

### Error Response Format
```json
{
  "success": false,
  "message": "Description of the error",
  "errors": [
    {
      "code": "invalid_string",
      "message": "Invalid address format (EVM: 0x... or Solana: base58)",
      "path": ["destinationAddress"]
    }
  ]
}
```

## Validation Rules

### Chain Names
- Must be lowercase
- Must be from supported chains list
- No extra whitespace

### Addresses
- **EVM:** Must be valid Ethereum address (0x + 40 hex chars)
- **Solana:** Must be valid base58 string (44 characters)

### Amounts
- Must be positive number
- Can have decimals
- Precision must match token decimals

### Token Symbols/Mints
- Token symbols: 2-10 uppercase alphanumeric characters
- Token mints: Valid format for the blockchain

### Cross-Chain Rules
- Source and destination chains must be different
- Both chains must be supported
- Token must be available on both chains

## Best Practices

### 1. Client-Side Validation
Always validate before sending requests:
```typescript
// Validate Solana address
const isValidAddress = solanaIntegrationService.validateAddress(address);

// Validate EVM address
const isValidEVMAddress = /^0x[a-fA-F0-9]{40}$/.test(address);

// Check amount validity
const amount = parseFloat(userInput);
if (amount <= 0) {
  // Invalid amount
}
```

### 2. Fee Estimation
Always estimate fees before executing transfers:
```typescript
const fees = await fetch('/api/cross-chain/estimate-fees', {
  method: 'POST',
  body: JSON.stringify({
    sourceChain: 'ethereum',
    destinationChain: 'celo',
    amount: '100'
  })
});
```

### 3. Quote Expiration
Swap quotes expire after ~60 seconds. Check expiration before execution:
```typescript
const now = Date.now() / 1000;
if (quote.expiresAt < now) {
  // Refresh quote
}
```

### 4. Retry Logic
For Solana transactions, check status with exponential backoff:
```typescript
async function waitForConfirmation(signature, maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    const status = await fetch(`/api/cross-chain/solana/transaction/${signature}`);
    if (status.data.status === 'finalized') {
      return status.data;
    }
    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
  }
}
```

### 5. Error Handling
Parse error responses and display user-friendly messages:
```typescript
try {
  const response = await fetch('/api/cross-chain/transfer', {
    method: 'POST',
    body: JSON.stringify(transferData)
  });
  
  if (!response.ok) {
    const error = await response.json();
    const errorMessage = error.errors?.[0]?.message || error.message;
    console.error('Transfer failed:', errorMessage);
  }
} catch (err) {
  console.error('Network error:', err);
}
```

## Security Considerations

### 1. Authentication
All write operations require authentication. The middleware checks:
- Valid JWT token
- Token stored in localStorage under keys: 'accessToken', 'token', 'mtaa_dao_auth_token'

### 2. Authorization
- Users can only access their own transfers and swaps
- UserId validation on all authenticated endpoints

### 3. Input Validation
- All inputs validated with Zod schemas
- Invalid inputs rejected with 400 status
- No SQL injection or XSS vulnerabilities

### 4. Rate Limiting
(To be implemented for production):
- Limit API calls per user/IP
- Prevent spam and abuse

## Performance Optimization

### 1. Caching
- Chain configurations cached in memory
- Token registry cached in memory
- RPC responses cached where applicable

### 2. Batch Operations
- Consider batching multiple balance queries
- Use multicall contracts for EVM chains

### 3. Connection Pooling
- RPC connections reused across requests
- Solana connection pooled and shared

## Future Enhancements

1. **Layer Zero Integration** - Direct cross-chain messaging
2. **Bridge Protocol Support** - Wormhole, Axelar, Stargate integration
3. **Advanced Swaps** - Multi-hop swaps, aggregator integration
4. **Analytics Dashboard** - Bridge volume, fee tracking
5. **Governance** - Cross-chain proposal execution
6. **NFT Bridging** - Support for cross-chain NFTs

## Environment Variables

```env
# Chain RPC URLs
ETHEREUM_RPC_URL=https://eth.llamarpc.com
POLYGON_RPC_URL=https://polygon-rpc.com
BSC_RPC_URL=https://bsc-dataseed.binance.org
OPTIMISM_RPC_URL=https://mainnet.optimism.io
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_DEVNET_RPC_URL=https://api.devnet.solana.com

# Bridge Contracts (to be deployed)
CELO_BRIDGE_CONTRACT=0x...
ETHEREUM_BRIDGE_CONTRACT=0x...
```

## Support

For issues or questions:
1. Check the API documentation above
2. Review validation error messages
3. Verify address formats
4. Check RPC endpoint connectivity
5. Review logs for detailed error information
