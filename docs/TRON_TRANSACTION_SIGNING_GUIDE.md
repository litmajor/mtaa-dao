# TRON Transaction Signing & Broadcasting Guide

## Overview

Complete guide for signing and broadcasting TRON transactions. Supports both software-based signing (development) and Hardware Security Module (HSM) integration (production).

---

## Quick Start

### 1. Transfer TRX (One-Step)

```bash
curl -X POST http://localhost:3000/api/cross-chain/tron/transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "fromAddress": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
    "toAddress": "TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH",
    "amount": "1000000",
    "privateKey": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txID": "3d6a1c6f9d1f0e4a5c1e7d9f...",
    "txHash": "3d6a1c6f9d1f0e4a5c1e7d9f...",
    "result": true,
    "message": "TRX transfer completed successfully"
  }
}
```

### 2. Transfer TRC20 Token (One-Step)

```bash
curl -X POST http://localhost:3000/api/cross-chain/tron/transfer-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "fromAddress": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
    "toAddress": "TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH",
    "tokenAddress": "TR7NHqjeKQxGTCi8q282XEXZTVP5VJU3KM",
    "amount": "1000000",
    "decimals": 6,
    "contractType": "TRC20",
    "privateKey": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  }'
```

---

## API Endpoints

### 1. POST /tron/transfer/create

Create an unsigned TRX transfer transaction.

**Request:**
```json
{
  "fromAddress": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
  "toAddress": "TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH",
  "amount": "1000000",
  "feeLimit": "100000000"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txID": "3d6a1c6f...",
    "rawData": {
      "contract": [...],
      "ref_block_bytes": "...",
      "ref_block_hash": "...",
      "expiration": 1699564860000,
      "timestamp": 1699564800000
    },
    "unsignedTx": {...},
    "message": "Transaction created. Sign with privateKey or HSM and broadcast."
  }
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fromAddress` | string | Yes | Sender TRON address |
| `toAddress` | string | Yes | Recipient TRON address |
| `amount` | string | Yes | Transfer amount in SUN (1 TRX = 1,000,000 SUN) |
| `feeLimit` | string | No | Maximum fee (default: 100,000,000 SUN = 100 TRX) |

---

### 2. POST /tron/transfer/sign

Sign an unsigned transaction with a private key.

**Request:**
```json
{
  "transaction": {...},
  "privateKey": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txID": "3d6a1c6f...",
    "signature": ["3045022100..."],
    "signedTx": {...},
    "message": "Transaction signed successfully. Ready to broadcast."
  }
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `transaction` | object | Yes | Unsigned transaction from create endpoint |
| `privateKey` | string | Yes | 66-character hex string (0x + 64 hex chars) |

---

### 3. POST /tron/transfer/broadcast

Broadcast a signed transaction to the TRON network.

**Request:**
```json
{
  "signedTransaction": {...}
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txID": "3d6a1c6f...",
    "txHash": "3d6a1c6f...",
    "result": true,
    "message": "Transaction broadcasted successfully"
  }
}
```

---

### 4. POST /tron/transfer (One-Step Transfer)

Create, sign, and broadcast TRX transfer in one request.

**Requires:** Authentication (JWT token)

**Request:**
```json
{
  "fromAddress": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
  "toAddress": "TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH",
  "amount": "1000000",
  "privateKey": "0x1234567890abcdef...",
  "feeLimit": "100000000"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txID": "3d6a1c6f...",
    "txHash": "3d6a1c6f...",
    "result": true,
    "message": "TRX transfer completed successfully"
  }
}
```

---

### 5. POST /tron/transfer-token (One-Step Token Transfer)

Create, sign, and broadcast TRC20/TRC721/TRC1155 transfer in one request.

**Requires:** Authentication (JWT token)

**Request:**
```json
{
  "fromAddress": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
  "toAddress": "TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH",
  "tokenAddress": "TR7NHqjeKQxGTCi8q282XEXZTVP5VJU3KM",
  "amount": "1000000",
  "decimals": 6,
  "contractType": "TRC20",
  "privateKey": "0x1234567890abcdef...",
  "feeLimit": "100000000"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txID": "3d6a1c6f...",
    "txHash": "3d6a1c6f...",
    "result": true,
    "message": "TRC20 transfer completed successfully"
  }
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `fromAddress` | string | Yes | - | Sender TRON address |
| `toAddress` | string | Yes | - | Recipient TRON address |
| `tokenAddress` | string | Yes | - | TRC20 token contract address |
| `amount` | string | Yes | - | Transfer amount |
| `decimals` | number | Yes | - | Token decimals (e.g., 6 for USDT) |
| `contractType` | string | No | TRC20 | Token type: TRC20, TRC721, or TRC1155 |
| `privateKey` | string | Yes | - | 66-char hex private key |
| `feeLimit` | string | No | 100M SUN | Maximum transaction fee |

---

### 6. POST /tron/transfer/estimate-fees

Estimate transaction fees before sending.

**Request:**
```json
{
  "toAddress": "TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH",
  "isTokenTransfer": false,
  "contractType": "TRC20"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "networkFee": 100000,
    "energyEstimate": 25000,
    "energyCost": 1250000,
    "totalEstimatedFee": 1350000,
    "networkFeeTRX": "0.100000",
    "totalEstimatedFeeTRX": "1.350000"
  }
}
```

**Fee Calculation:**
```
networkFee = 100,000 SUN (fixed, = 0.1 TRX)
energyCost = energyEstimate × 50 SUN/energy
totalFee = networkFee + energyCost

For TRC20: ~1,350,000 SUN = ~1.35 TRX
For TRC721: ~1,600,000 SUN = ~1.6 TRX
For TRC1155: ~1,850,000 SUN = ~1.85 TRX
```

---

### 7. GET /tron/transfer/:txid/receipt

Get transaction receipt and confirmation status.

**Request:**
```
GET /api/cross-chain/tron/transfer/3d6a1c6f.../receipt
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txID": "3d6a1c6f...",
    "status": "SUCCESS",
    "blockNumber": 52891234,
    "blockTimestamp": 1699564800000,
    "confirmations": 150,
    "receipt": {
      "result": "SUCCESS",
      "gasUsed": 0
    }
  }
}
```

**Status Values:**
| Status | Meaning |
|--------|---------|
| PENDING | Transaction in mempool, waiting for confirmation |
| SUCCESS | Transaction confirmed and executed |
| FAILED | Transaction failed during execution |
| NOT_FOUND | Transaction not found on network |

---

## Transaction Flow

### Multi-Step Flow (Recommended for HSM/Production)

1. **Create Transaction** → Unsigned TX (safe to create on any server)
2. **Sign Transaction** → Add signature (sign in HSM/secure location)
3. **Broadcast Transaction** → Send to network

```
[Client] → [Create Endpoint] → Unsigned TX
           ↓
[HSM/Signer] → [Sign Endpoint] → Signed TX
           ↓
[Broadcast Server] → [Broadcast Endpoint] → Confirmed TX
```

### One-Step Flow (Development Only)

```
[Client with Private Key] → [One-Step Endpoint] → Confirmed TX
```

**⚠️ WARNING:** Never send private keys over the network in production! One-step endpoints are for development only. Use HSM integration for production.

---

## Private Key Management

### Development (Software Signing)

**WARNING:** For development only. Never use in production.

1. Generate test private key:
```bash
# Using TronWeb CLI
tronweb generate

# Or using OpenSSL
openssl rand -hex 32
# Then prefix with 0x
0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

2. Load from environment:
```bash
export TRON_PRIVATE_KEY="0x1234567890abcdef..."
```

3. Use in request:
```json
{
  "fromAddress": "...",
  "toAddress": "...",
  "amount": "1000000",
  "privateKey": "0x1234567890abcdef..."
}
```

### Production (HSM Integration)

**Supported HSM Providers:**

1. **AWS KMS (Cloud HSM)**
   ```bash
   export TRON_HSM_ENABLED=true
   export TRON_HSM_PROVIDER=aws
   export TRON_HSM_KEY_ID=arn:aws:kms:us-east-1:123456789:key/12345678
   export AWS_REGION=us-east-1
   ```

2. **Azure Key Vault**
   ```bash
   export TRON_HSM_ENABLED=true
   export TRON_HSM_PROVIDER=azure
   export TRON_HSM_KEY_ID=https://vault-name.vault.azure.net/keys/key-name
   ```

3. **Google Cloud KMS**
   ```bash
   export TRON_HSM_ENABLED=true
   export TRON_HSM_PROVIDER=gcp
   export TRON_HSM_KEY_ID=projects/PROJECT_ID/locations/LOCATION/keyRings/KEYRING/cryptoKeys/KEY
   ```

4. **Local HSM (YubiKey, etc.)**
   ```bash
   export TRON_HSM_ENABLED=true
   export TRON_HSM_PROVIDER=local
   export TRON_HSM_KEY_ID=slot-0-key-1
   ```

**Use HSM Key ID in Request:**

Instead of `privateKey`, use `hsmKeyId`:

```json
{
  "fromAddress": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
  "toAddress": "TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH",
  "amount": "1000000",
  "hsmKeyId": "arn:aws:kms:us-east-1:123456789:key/12345678"
}
```

---

## Error Handling

### Common Errors

**400 - Bad Request**
```json
{
  "success": false,
  "message": "Invalid input",
  "errors": [
    {
      "code": "custom",
      "message": "Invalid from address format",
      "path": ["fromAddress"]
    }
  ]
}
```

**401 - Unauthorized**
```json
{
  "success": false,
  "message": "User not authenticated"
}
```

**500 - Failed to Broadcast**
```json
{
  "success": false,
  "message": "Failed to broadcast transaction",
  "details": "Insufficient energy for contract execution"
}
```

### Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid from address format" | Wrong address format | Ensure address starts with 'T' and is 34 chars |
| "Insufficient energy" | Not enough energy to execute | Check account has frozen balance for energy |
| "Account not activated" | Account has < 0.1 TRX | Send 0.1 TRX to activate account first |
| "Invalid private key" | Wrong key format | Private key must be 66 char hex string (0x...) |
| "Failed to sign transaction" | HSM connection issue | Check HSM credentials and network access |

---

## Testing

### 1. Test on Testnet

Add `?testnet=true` query parameter:

```bash
curl -X POST http://localhost:3000/api/cross-chain/tron/transfer?testnet=true \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### 2. Generate Test Accounts

Get testnet TRX from faucet:

```bash
# 1. Go to: https://nile.tronscan.org/#/tools/account
# 2. Click "Create Address"
# 3. Copy address
# 4. Use "Get TRX" button to get free testnet funds
```

### 3. Test Fee Estimation

```bash
curl -X POST http://localhost:3000/api/cross-chain/tron/transfer/estimate-fees \
  -H "Content-Type: application/json" \
  -d '{
    "toAddress": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
    "isTokenTransfer": false
  }'
```

### 4. Test Transaction Status

```bash
curl http://localhost:3000/api/cross-chain/tron/transfer/TXID/receipt
```

---

## Security Best Practices

### ✅ DO:

- ✅ Use HSM for production key storage
- ✅ Require authentication for transfer endpoints
- ✅ Validate all addresses before sending
- ✅ Set reasonable fee limits
- ✅ Monitor transaction failures
- ✅ Use testnet for initial testing
- ✅ Implement transaction approvals for large amounts
- ✅ Log all transfer attempts
- ✅ Rate limit endpoints by user/IP
- ✅ Use HTTPS for all API calls

### ❌ DON'T:

- ❌ Never store private keys in code
- ❌ Never send private keys over unencrypted connections
- ❌ Never share private keys with users
- ❌ Never use one-step endpoints in production
- ❌ Never disable transaction validation
- ❌ Never allow unlimited transaction amounts
- ❌ Never ignore transaction failures
- ❌ Never use mainnet for testing
- ❌ Never run HSM in development mode
- ❌ Never trust user-provided gas estimates

---

## Advanced Topics

### Custom Fee Limits

Set custom fee limits for transactions:

```json
{
  "fromAddress": "...",
  "toAddress": "...",
  "amount": "1000000",
  "feeLimit": "50000000",
  "privateKey": "0x..."
}
```

**Fee Limit Values:**
| Amount | SUN | TRX | Use Case |
|--------|-----|-----|----------|
| Minimum | 100,000 | 0.1 | TRX transfer only |
| Standard TRC20 | 1,350,000 | 1.35 | Normal token transfer |
| Large TRC20 | 2,000,000 | 2 | High-volume transfer |
| TRC721 | 1,600,000 | 1.6 | NFT transfer |
| TRC1155 | 1,850,000 | 1.85 | Multi-token transfer |

### Transaction Expiration

Transactions expire after 60 minutes. Recreate if needed:

```typescript
// Check timestamp in transaction
const timestamp = transaction.raw_data.timestamp;
const expirationTime = timestamp + 3600000; // +1 hour in ms

if (Date.now() > expirationTime) {
  // Transaction expired, create new one
  const newTx = await signingService.createTrxTransferTransaction({...});
}
```

### Batch Transfers

For multiple transfers, create them all, then sign and broadcast:

```typescript
// Create multiple transactions
const txs = await Promise.all([
  signingService.createTrxTransferTransaction({...}),
  signingService.createTrxTransferTransaction({...}),
  signingService.createTrxTransferTransaction({...})
]);

// Sign all
const signedTxs = await Promise.all(
  txs.map(tx => signingService.signTransactionWithPrivateKey(tx, privateKey))
);

// Broadcast all
const results = await Promise.all(
  signedTxs.map(tx => signingService.broadcastTransaction(tx))
);
```

---

## Integration Examples

### TypeScript/Node.js

```typescript
import axios from 'axios';

const API_BASE = 'http://localhost:3000/api/cross-chain';

async function transferTRX(
  fromAddress: string,
  toAddress: string,
  amountTRX: number,
  privateKey: string,
  token?: string
) {
  try {
    const amountSun = String(amountTRX * 1000000);

    const response = await axios.post(
      `${API_BASE}/tron/transfer`,
      {
        fromAddress,
        toAddress,
        amount: amountSun,
        privateKey
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.data;
  } catch (error) {
    console.error('Transfer failed:', error.response?.data);
    throw error;
  }
}

// Usage
const result = await transferTRX(
  'TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX',
  'TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH',
  1.5, // 1.5 TRX
  '0x1234567890abcdef...',
  'YOUR_JWT_TOKEN'
);

console.log('Transaction ID:', result.txID);
```

### JavaScript (Fetch)

```javascript
async function transferToken(
  fromAddress,
  toAddress,
  tokenAddress,
  amount,
  decimals,
  privateKey,
  token
) {
  const response = await fetch(
    'http://localhost:3000/api/cross-chain/tron/transfer-token',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fromAddress,
        toAddress,
        tokenAddress,
        amount,
        decimals,
        contractType: 'TRC20',
        privateKey
      })
    }
  );

  const data = await response.json();
  return data.data;
}
```

---

## Monitoring & Logging

### Enable Debug Logging

Set environment variable:
```bash
export DEBUG=tron:*
export LOG_LEVEL=debug
```

### Monitor Transaction Status

```bash
# Check transaction status
curl http://localhost:3000/api/cross-chain/tron/transfer/{TXID}/receipt

# Poll for completion
watch -n 5 'curl -s http://localhost:3000/api/cross-chain/tron/transfer/{TXID}/receipt | jq'
```

### Setup Alerts

Monitor for:
- Failed transactions
- High fee estimates
- Network errors
- Rate limit hits
- Account activation issues

---

## Related Documentation

- **API Endpoints:** See `TRON_API_ENDPOINTS_GUIDE.md`
- **Core Service:** See `TRON_INTEGRATION_GUIDE.md`
- **Quick Reference:** See `TRON_QUICK_REFERENCE.md`
- **Service Implementation:** See `server/services/tronTransactionSigningService.ts`

---

## Support

For issues or questions:
1. Check transaction receipt status
2. Review error message for details
3. Verify private key format (66 char hex)
4. Check account has minimum balance
5. Test on testnet first
6. Review server logs: `LOG_LEVEL=debug`

