# Agent Wallet Service

Comprehensive modular wallet management system for Web3 applications. Provides wallet operations, token management, gas optimization, persistence, and account information services.

## Architecture

The service is organized into five specialized modules:

### 1. **Wallet Operations** (`wallet-operations.ts`)
Handles all wallet transaction operations.

**Key Methods:**
- `approveToken()` - Approve token spending
- `sendNativeToken()` - Send ETH/CELO or native tokens
- `sendTokenHuman()` - Send ERC-20 tokens with human-readable amounts
- `batchTransfer()` - Execute multiple transfers efficiently

**Features:**
- Transaction caching and tracking
- Gas configuration support
- Balance validation
- Error handling with descriptive messages

```typescript
const operations = new WalletOperationsService(web3, account, chainId);

// Send native token
const result = await operations.sendNativeToken('0x...', 1.5, gasConfig);

// Send ERC-20 token
const transferResult = await operations.sendTokenHuman(
  '0xTokenAddress',
  '0xRecipient',
  100,
  gasConfig
);
```

### 2. **Token Utilities** (`token-utilities.ts`)
Manages token information and balance operations.

**Key Methods:**
- `getTokenInfo()` - Retrieve token metadata (name, symbol, decimals)
- `getTokenBalance()` - Check token balance for an account
- `getMultipleTokenBalances()` - Batch balance checking
- `getAllowance()` - Check token spending approval
- `needsApproval()` - Determine if approval is required

**Features:**
- Token metadata caching
- Balance caching with TTL
- ERC-20 contract validation
- Multi-token operations

```typescript
const tokens = new TokenUtilitiesService(web3);

// Get token info
const tokenInfo = await tokens.getTokenInfo('0xTokenAddress', '0xAccount');

// Check balance
const balance = await tokens.getTokenBalance('0xTokenAddress', '0xAccount');

// Check approval status
const needsApproval = await tokens.needsApproval(
  '0xTokenAddress',
  '0xOwner',
  '0xSpender',
  100
);
```

### 3. **Wallet Persistence** (`wallet-persistence.ts`)
Handles wallet data persistence and recovery.

**Key Methods:**
- `saveWalletConfig()` - Persist wallet configuration
- `loadWalletConfig()` - Load saved wallet configuration
- `saveWalletState()` - Save wallet runtime state
- `loadWalletState()` - Load wallet state
- `backupWalletData()` - Create timestamped backup
- `restoreFromBackup()` - Restore wallet from backup
- `deleteWalletData()` - Permanently delete wallet data

**Features:**
- Secure data storage (sensitive data excluded)
- Automatic directory creation
- Backup and recovery system
- Data validation

```typescript
const persistence = new WalletPersistenceService('./data');
await persistence.initialize();

// Save wallet state
await persistence.saveWalletState({ address: '0x...', chainId: 1 });

// Create backup
const backupPath = await persistence.backupWalletData();

// Restore from backup
await persistence.restoreFromBackup('wallet-backup-2024-01-15T10-30-45.json');
```

### 4. **Gas Manager** (`wallet-gas-manager.ts`)
Manages gas price estimation and optimization.

**Key Methods:**
- `getGasPrices()` - Fetch current gas prices
- `estimateGas()` - Estimate gas for transaction
- `estimateGasWithBuffer()` - Estimate with safety margin
- `getOptimalGasConfig()` - Get EIP-1559 compatible config
- `calculateTransactionCost()` - Calculate total transaction cost

**Features:**
- EIP-1559 (London fork) support
- Legacy gas price fallback
- Configurable gas multiplier
- Priority fee management
- Transaction cost calculation

```typescript
const gasManager = new WalletGasManagerService(web3);

// Get optimal gas configuration
const gasConfig = await gasManager.getOptimalGasConfig();

// Estimate with buffer
const gas = await gasManager.estimateGasWithBuffer(transaction, 20);

// Calculate cost
const cost = gasManager.calculateTransactionCost(gas, gasConfig.gasPrice);
```

### 5. **Wallet Info** (`wallet-info.ts`)
Retrieves wallet and account information.

**Key Methods:**
- `getBalance()` - Get native token balance in Wei
- `getBalanceInEth()` - Get balance in ETH format
- `getWalletInfo()` - Get complete wallet information
- `getAccountInfo()` - Get account with transaction data
- `hasSufficientBalance()` - Check if balance meets requirement
- `walletExists()` - Verify if wallet has been used

**Features:**
- Balance caching with configurable TTL
- Contract detection
- Transaction count tracking
- Efficient batch operations

```typescript
const walletInfo = new WalletInfoService(web3);

// Get wallet info
const info = await walletInfo.getWalletInfo('0xAddress');

// Check balance
const hasBalance = await walletInfo.hasSufficientBalance('0xAddress', 1.5);

// Verify wallet exists
const exists = await walletInfo.walletExists('0xAddress');
```

## Unified Manager (AgentWalletManager)

Provides a single point of access to all services:

```typescript
import { createAgentWalletManager } from './server/agent-wallet';

// Create and initialize
const manager = createAgentWalletManager();
await manager.initialize(web3, account, chainId, './data');

// Access services
const operations = manager.getWalletOperations();
const tokens = manager.getTokenUtilities();
const gasManager = manager.getGasManager();

// Get statistics
const stats = manager.getStatistics();

// Cleanup
await manager.shutdown();
```

## Type Definitions

### Core Types

**WalletConfig**
```typescript
{
  address: string;
  chainId: number;
  network: string;
}
```

**TransactionResult**
```typescript
{
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  errorReason?: string;
  timestamp: number;
}
```

**TokenInfo**
```typescript
{
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  balance?: string;
  balanceFormatted?: number;
}
```

**GasConfig**
```typescript
{
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}
```

See `types.ts` for complete type definitions.

## Common Use Cases

### Complete Wallet Transfer Flow

```typescript
const manager = createAgentWalletManager();
await manager.initialize(web3, account, 1);

const operations = manager.getWalletOperations();
const tokens = manager.getTokenUtilities();
const gasManager = manager.getGasManager();

// 1. Check balance
const balance = await tokens.getTokenBalance(tokenAddr, account.address);

// 2. Get optimal gas
const gasConfig = await gasManager.getOptimalGasConfig();

// 3. Approve if needed
const needsApproval = await tokens.needsApproval(tokenAddr, account.address, spender, amount);
if (needsApproval) {
  await operations.approveToken(tokenAddr, spender, amount, gasConfig);
}

// 4. Transfer tokens
const result = await operations.sendTokenHuman(tokenAddr, recipient, amount, gasConfig);
```

### Batch Operations

```typescript
const transfers = [
  { toAddress: '0x...', amount: 10 },
  { toAddress: '0x...', amount: 20 },
  { toAddress: '0x...', amount: 15 }
];

const results = await operations.batchTransfer(transfers);
results.forEach((result, index) => {
  console.log(`Transfer ${index}: ${result.status}`);
});
```

### Wallet Backup and Recovery

```typescript
const persistence = manager.getWalletPersistence();

// Backup
const backupPath = await persistence.backupWalletData();

// List backups
const backups = await persistence.listBackups();

// Restore
await persistence.restoreFromBackup(backups[0]);
```

## Error Handling

All services throw descriptive errors with context:

```typescript
try {
  await operations.sendTokenHuman(tokenAddr, recipient, amount);
} catch (error) {
  if (error.message.includes('Insufficient balance')) {
    console.log('Need to fund account');
  } else if (error.message.includes('Invalid')) {
    console.log('Check address format');
  } else {
    console.log('Transaction failed:', error.message);
  }
}
```

## Performance Considerations

### Caching
- **Token Cache**: Stores token metadata (no TTL, cleared on demand)
- **Balance Cache**: 30-second default TTL (configurable)
- **Transaction Cache**: Maintains pending transaction tracking

### Optimization Tips
1. Batch operations when possible
2. Configure appropriate gas multipliers
3. Use balance cache for frequent checks
4. Clear caches when switching networks

```typescript
// Configure cache duration
walletInfo.setCacheDuration(60000); // 60 seconds

// Clear cache before network switch
walletInfo.clearCache();
```

## Security Notes

1. **Sensitive Data**: Private keys are never stored or logged
2. **Persistence**: Configuration files contain only non-sensitive data
3. **Validation**: All addresses validated with web3-validator
4. **Error Messages**: Descriptive without exposing secrets

## Integration Examples

### With Express Server
```typescript
app.post('/api/transfer', async (req, res) => {
  try {
    const manager = createAgentWalletManager();
    await manager.initialize(web3, account, chainId);
    
    const operations = manager.getWalletOperations();
    const result = await operations.sendTokenHuman(
      req.body.token,
      req.body.to,
      req.body.amount
    );
    
    res.json({ success: true, txHash: result.hash });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});
```

### With Retry Logic
```typescript
async function transferWithRetry(
  tokenAddr: string,
  recipient: string,
  amount: number,
  retries: number = 3
): Promise<TransactionResult> {
  const operations = manager.getWalletOperations();
  
  for (let i = 0; i < retries; i++) {
    try {
      return await operations.sendTokenHuman(tokenAddr, recipient, amount);
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`Retry ${i + 1}/${retries} after error: ${error.message}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}
```

## Module Dependencies

```
index.ts (Aggregator)
├── wallet-operations.ts
│   └── types.ts
│   └── erc20-abi.ts
├── token-utilities.ts
│   └── types.ts
│   └── erc20-abi.ts
├── wallet-persistence.ts
│   └── types.ts
├── wallet-gas-manager.ts
│   └── types.ts
└── wallet-info.ts
    └── types.ts
```

## Testing

Each service can be tested independently:

```typescript
describe('WalletOperationsService', () => {
  let service: WalletOperationsService;

  beforeEach(() => {
    service = new WalletOperationsService(web3, account, 1);
  });

  it('should send native token', async () => {
    const result = await service.sendNativeToken('0x...', 1.0);
    expect(result.hash).toBeDefined();
  });
});
```

## Maintenance

### Clearing Stale Data
```typescript
// Clear token cache
tokenUtilities.clearTokenCache();

// Clear balance cache
walletInfo.clearCache();

// Clear transaction cache
walletOperations.clearTransactionCache();
```

### Monitoring
```typescript
const stats = manager.getStatistics();
console.log('Cached addresses:', stats.caches.walletInfoCache.cachedAddresses);
```

## Contributing

When extending the service:
1. Keep modules focused and single-responsibility
2. Add comprehensive type definitions
3. Include error handling and logging
4. Update this README
5. Add unit tests for new functionality

## License

See LICENSE file in root directory.
