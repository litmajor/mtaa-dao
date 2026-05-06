# TRON API Endpoints Guide

## Overview

Complete reference for TRON blockchain integration API endpoints. All TRON endpoints are available with optional `?testnet=true` query parameter for testnet operations.

## Base URLs

- **Production (Mainnet):** `/api/cross-chain/tron`
- **Testnet:** `/api/cross-chain/tron?testnet=true`

---

## 1. Get TRON Balance

### Endpoint
```
POST /tron/balance
```

### Description
Get native TRX balance or TRC20 token balance for an address.

### Request Body
```json
{
  "address": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
  "tokenAddress": "TR7NHqjeKQxGTCi8q282XEXZTVP5VJU3KM" // Optional for TRC20 balance
}
```

### Response (Success)
```json
{
  "success": true,
  "data": {
    "address": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
    "balance": "1000000",
    "chain": "tron"
  }
}
```

### Response (Error - Invalid Address)
```json
{
  "success": false,
  "message": "Invalid input",
  "errors": [
    {
      "code": "custom",
      "message": "Invalid TRON address format",
      "path": ["address"]
    }
  ]
}
```

### Examples

**Get TRX Balance:**
```bash
curl -X POST http://localhost:3000/api/cross-chain/tron/balance \
  -H "Content-Type: application/json" \
  -d '{
    "address": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX"
  }'
```

**Get TRC20 Token Balance:**
```bash
curl -X POST http://localhost:3000/api/cross-chain/tron/balance?testnet=true \
  -H "Content-Type: application/json" \
  -d '{
    "address": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
    "tokenAddress": "TR7NHqjeKQxGTCi8q282XEXZTVP5VJU3KM"
  }'
```

---

## 2. Get TRON Token Info

### Endpoint
```
GET /tron/token/:tokenAddress
```

### Description
Get metadata information for a TRC20 token (name, symbol, decimals, total supply).

### Path Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `tokenAddress` | string | TRON token address (TxxxXXX format) |

### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `testnet` | boolean | false | Use testnet (true) or mainnet (false) |

### Response (Success)
```json
{
  "success": true,
  "data": {
    "name": "Tether USD",
    "symbol": "USDT",
    "decimals": 6,
    "totalSupply": "40000000000000",
    "tokenAddress": "TR7NHqjeKQxGTCi8q282XEXZTVP5VJU3KM",
    "ownerAddress": "THPvatwm4HqSvv3ILHVRQU8KVHVuLNaxfi"
  }
}
```

### Response (Error - Token Not Found)
```json
{
  "success": false,
  "message": "Token not found"
}
```

### Example
```bash
curl http://localhost:3000/api/cross-chain/tron/token/TR7NHqjeKQxGTCi8q282XEXZTVP5VJU3KM
```

---

## 3. Estimate TRON Fees

### Endpoint
```
GET /tron/fees
```

### Description
Get current TRON network fees and energy pricing.

### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `testnet` | boolean | false | Use testnet (true) or mainnet (false) |

### Response
```json
{
  "success": true,
  "data": {
    "networkFee": 100000,
    "energyPrice": 50,
    "bandwidthPrice": 1,
    "estimatedEnergyNeeded": 25000,
    "estimatedCostTRX": "1.25",
    "currency": "TRX"
  }
}
```

**Fee Breakdown:**
- **networkFee**: Fixed transaction fee (in SUN) = 0.1 TRX
- **energyPrice**: Price per energy unit (in SUN) = 50 SUN/energy
- **bandwidthPrice**: Price per bandwidth byte (in SUN) = 1 SUN/byte
- **estimatedEnergyNeeded**: Energy units required for typical TRC20 transfer = 25,000 units
- **estimatedCostTRX**: Total estimated cost in TRX

### Calculation Example
```
Total Cost = (networkFee + bandwidthPrice * txSize) + (energyPrice * energyUsed)
For TRC20:  = 100,000 SUN + 25,000 energy * 50 SUN = 1,350,000 SUN = 1.35 TRX
```

### Example
```bash
curl http://localhost:3000/api/cross-chain/tron/fees
curl http://localhost:3000/api/cross-chain/tron/fees?testnet=true
```

---

## 4. Get TRON Transaction Status

### Endpoint
```
GET /tron/transaction/:txid
```

### Description
Get detailed status and confirmation info for a TRON transaction.

### Path Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `txid` | string | Transaction ID (64 character hex) |

### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `testnet` | boolean | false | Use testnet (true) or mainnet (false) |

### Response (Success - Confirmed)
```json
{
  "success": true,
  "data": {
    "txid": "3d6a1c6f9d1f0e4a5c1e7d9f0a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0",
    "blockNumber": 52891234,
    "blockTimestamp": 1699564800000,
    "fromAddress": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
    "toAddress": "TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH",
    "amount": "1000000000",
    "status": "CONFIRMED",
    "confirmations": 150,
    "energyUsed": 25000,
    "energyCost": "1250000",
    "contractAddress": "TR7NHqjeKQxGTCi8q282XEXZTVP5VJU3KM"
  }
}
```

### Response (Success - Pending)
```json
{
  "success": true,
  "data": {
    "txid": "3d6a1c6f9d1f0e4a5c1e7d9f0a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0",
    "status": "PENDING",
    "fromAddress": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
    "toAddress": "TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH",
    "amount": "1000000000"
  }
}
```

### Response (Error - Not Found)
```json
{
  "success": false,
  "message": "Transaction not found"
}
```

### Example
```bash
curl http://localhost:3000/api/cross-chain/tron/transaction/3d6a1c6f9d1f0e4a5c1e7d9f0a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0
```

---

## 5. Get Recent TRON Transactions

### Endpoint
```
GET /tron/transactions/:address
```

### Description
Get recent transactions for a TRON address.

### Path Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | TRON address (TxxxXXX format) |

### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 10 | Number of transactions to return (max 50) |
| `testnet` | boolean | false | Use testnet (true) or mainnet (false) |

### Response
```json
{
  "success": true,
  "data": {
    "address": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
    "transactions": [
      {
        "txid": "3d6a1c6f9d1f0e4a5c1e7d9f0a2b3c4d...",
        "blockNumber": 52891234,
        "blockTimestamp": 1699564800000,
        "from": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
        "to": "TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH",
        "value": "1000000000",
        "isTokenTransaction": true,
        "tokenSymbol": "USDT",
        "tokenDecimals": 6
      },
      {
        "txid": "5f7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d...",
        "blockNumber": 52891200,
        "blockTimestamp": 1699564000000,
        "from": "TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH",
        "to": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
        "value": "500000000",
        "isTokenTransaction": false
      }
    ],
    "count": 2
  }
}
```

### Example
```bash
curl http://localhost:3000/api/cross-chain/tron/transactions/TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX?limit=20
```

---

## 6. Get TRON Account Info

### Endpoint
```
GET /tron/account/:address
```

### Description
Get detailed account information including energy, bandwidth, and frozen balance.

### Path Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | TRON address (TxxxXXX format) |

### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `testnet` | boolean | false | Use testnet (true) or mainnet (false) |

### Response
```json
{
  "success": true,
  "data": {
    "address": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
    "balance": "10000000000",
    "energyUsed": 5000,
    "energyLimit": 50000,
    "energyAvailable": 45000,
    "bandwidthUsed": 1200,
    "bandwidthLimit": 5000,
    "bandwidthAvailable": 3800,
    "frozenBalance": "1000000000",
    "isActivated": true,
    "createdTime": 1699500000000,
    "lastTransactionTime": 1699564800000
  }
}
```

**Field Descriptions:**
- **balance**: Total TRX balance in SUN (1 TRX = 1,000,000 SUN)
- **energyUsed**: Energy units already consumed
- **energyLimit**: Maximum energy available (from staking)
- **energyAvailable**: Available energy for operations
- **bandwidthUsed**: Bandwidth bytes already used
- **bandwidthLimit**: Maximum bandwidth available
- **frozenBalance**: TRX frozen for resource delegation
- **isActivated**: Whether account can receive TRX transfers
- **createdTime**: Account creation timestamp (ms since epoch)
- **lastTransactionTime**: Last transaction timestamp (ms since epoch)

### Response (Error - Account Not Found)
```json
{
  "success": false,
  "message": "Account not found"
}
```

### Example
```bash
curl http://localhost:3000/api/cross-chain/tron/account/TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX
```

---

## 7. Validate TRON Address

### Endpoint
```
POST /tron/validate
```

### Description
Validate if a string is a valid TRON address.

### Request Body
```json
{
  "address": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX"
}
```

### Response (Valid)
```json
{
  "success": true,
  "data": {
    "address": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
    "isValid": true
  }
}
```

### Response (Invalid)
```json
{
  "success": true,
  "data": {
    "address": "0x1234567890abcdef",
    "isValid": false
  }
}
```

### Example
```bash
curl -X POST http://localhost:3000/api/cross-chain/tron/validate \
  -H "Content-Type: application/json" \
  -d '{"address": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX"}'
```

---

## 8. Validate TRON Transfer (Pre-flight Checks)

### Endpoint
```
POST /tron/validate-transfer
```

### Description
Perform pre-flight validation checks before initiating a TRON transfer. Validates sufficient balance, account activation, and estimates fees.

### Request Body
```json
{
  "fromAddress": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
  "toAddress": "TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH",
  "amount": "1000000",
  "tokenAddress": "TR7NHqjeKQxGTCi8q282XEXZTVP5VJU3KM", // Optional for TRC20
  "decimals": 6
}
```

### Response (Valid Transfer)
```json
{
  "success": true,
  "data": {
    "from": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
    "to": "TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH",
    "amount": "1000000",
    "hasSufficientBalance": true,
    "isAccountActivated": true,
    "estimatedFees": {
      "networkFee": 100000,
      "energyPrice": 50,
      "bandwidthPrice": 1,
      "estimatedEnergyNeeded": 25000,
      "estimatedCostTRX": "1.35"
    },
    "isValid": true
  }
}
```

### Response (Insufficient Balance)
```json
{
  "success": true,
  "data": {
    "from": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
    "to": "TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH",
    "amount": "10000000000",
    "hasSufficientBalance": false,
    "isAccountActivated": true,
    "estimatedFees": {...},
    "isValid": false
  }
}
```

### Response (Account Not Activated)
```json
{
  "success": true,
  "data": {
    "from": "TXXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "to": "TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH",
    "amount": "1000000",
    "hasSufficientBalance": true,
    "isAccountActivated": false,
    "estimatedFees": {...},
    "isValid": false
  }
}
```

### Important Notes

**Account Activation Requirement:**
TRON requires accounts to have at least 0.1 TRX (~100,000 SUN) to be "activated" and receive transfers. If `isAccountActivated: false`, the account cannot receive tokens.

**Insufficient Balance:**
The validation checks both:
1. Enough balance for the transfer amount
2. Enough balance for network fees and estimated energy costs

**TRC20 Transfers:**
If `tokenAddress` is provided, transfers a TRC20 token. Otherwise, transfers native TRX.

### Example
```bash
curl -X POST http://localhost:3000/api/cross-chain/tron/validate-transfer \
  -H "Content-Type: application/json" \
  -d '{
    "fromAddress": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX",
    "toAddress": "TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH",
    "amount": "1000000",
    "decimals": 6
  }'
```

---

## Address Format Reference

### TRON Address (Base58Check)
- **Format:** `T` + 33 base58 characters
- **Total Length:** 34 characters
- **Valid Characters:** 1-9, A-Z (except I, O, l), a-z (except o)
- **Example:** `TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX`
- **Regex:** `/^T[1-9A-HJ-NP-Z]{33}$/`

### Comparison with Other Chains
| Chain | Format | Example |
|-------|--------|---------|
| **TRON** | T + 33 base58 | TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX |
| **Ethereum** | 0x + 40 hex | 0x1234567890abcdef1234567890abcdef12345678 |
| **Solana** | 44 base58 | So11111111111111111111111111111111111111112 |

---

## Error Codes

| HTTP Status | Error Type | Cause | Solution |
|-------------|-----------|-------|----------|
| 400 | Bad Request | Invalid address/params | Check address format (must start with T) |
| 400 | Validation Error | Missing required fields | Provide all required parameters |
| 404 | Not Found | Transaction/token not found | Verify txid or token address |
| 500 | Server Error | RPC connection failed | Retry or contact support |

---

## Rate Limiting

- **Requests per minute:** 60 (standard tier)
- **Requests per minute:** 300 (premium tier)
- **Burst limit:** 10 requests per second

---

## Testing with Testnet

All endpoints support testnet testing by adding `?testnet=true` query parameter:

```bash
# Mainnet
curl http://localhost:3000/api/cross-chain/tron/balance \
  -H "Content-Type: application/json" \
  -d '{"address": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX"}'

# Testnet
curl http://localhost:3000/api/cross-chain/tron/balance?testnet=true \
  -H "Content-Type: application/json" \
  -d '{"address": "TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX"}'
```

### Testnet Resources
- **Testnet RPC:** Nile network (https://api.trongrid.io/)
- **Testnet Explorer:** https://nile.tronscan.org/
- **Faucet:** https://nile.tronscan.org/#/tools/account
- **Sample Token:** USDT on Nile (TR7NHqjeKQxGTCi8q282XEXZTVP5VJU3KM)

---

## Integration Examples

### TypeScript/Node.js
```typescript
import axios from 'axios';

const API_BASE = 'http://localhost:3000/api/cross-chain';
const TESTNET = true;

async function getTronBalance(address: string) {
  const response = await axios.post(
    `${API_BASE}/tron/balance${TESTNET ? '?testnet=true' : ''}`,
    { address },
    { headers: { 'Content-Type': 'application/json' } }
  );
  return response.data.data.balance;
}

async function validateTransfer(
  fromAddress: string,
  toAddress: string,
  amount: string
) {
  const response = await axios.post(
    `${API_BASE}/tron/validate-transfer${TESTNET ? '?testnet=true' : ''}`,
    { fromAddress, toAddress, amount, decimals: 6 }
  );
  return response.data.data;
}

// Usage
const balance = await getTronBalance('TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX');
console.log('Balance:', balance);

const validation = await validateTransfer(
  'TYG8o4dB7kKv5d67sX3pP9FTWmz9X3p5sX',
  'TJpV4tCbKfJKCaP9Sc8o9V6VVlUNQhHzYH',
  '1000000'
);
console.log('Transfer Valid:', validation.isValid);
```

### JavaScript/Fetch
```javascript
const API_BASE = 'http://localhost:3000/api/cross-chain';

async function getTronFees(testnet = false) {
  const url = `${API_BASE}/tron/fees${testnet ? '?testnet=true' : ''}`;
  const response = await fetch(url);
  return response.json();
}

// Usage
const fees = await getTronFees(true);
console.log('Estimated Cost:', fees.data.estimatedCostTRX, 'TRX');
```

---

## Changelog

### Version 1.0.0 (2024-01-XX)
- ✅ Initial TRON API endpoints
- ✅ Balance and token queries
- ✅ Transaction status monitoring
- ✅ Account info and validation
- ✅ Pre-flight transfer validation
- ✅ Testnet/mainnet support

---

## Support & Documentation

- **Main Integration Guide:** See `TRON_INTEGRATION_GUIDE.md`
- **Quick Reference:** See `TRON_QUICK_REFERENCE.md`
- **Code Examples:** See `TRON_CODE_EXAMPLES.ts`
- **Service Implementation:** See `server/services/tronIntegrationService.ts`
