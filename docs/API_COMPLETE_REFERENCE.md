# MTAA DAO - Complete API Reference & User Flow Mapping

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Wallet Management](#wallet-management)
3. [Deposits (On-Ramps)](#deposits-on-ramps)
4. [Withdrawals (Off-Ramps)](#withdrawals-off-ramps)
5. [Swaps & Trading](#swaps--trading)
6. [Vaults & Staking](#vaults--staking)
7. [Pools & Liquidity](#pools--liquidity)
8. [Automated Strategies](#automated-strategies)
9. [Passive Income](#passive-income)
10. [Webhooks](#webhooks)

---

## Authentication

All endpoints (except webhooks) require JWT authentication in the `Authorization` header.

### Get JWT Token
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "7d",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com"
  }
}
```

### Usage
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  https://api.mtaa.io/api/wallet/balance
```

---

## Wallet Management

### Get Wallet Overview
```bash
GET /api/wallet
Authorization: Bearer <token>

Response:
{
  "userId": "user-uuid",
  "totalBalance": "$2,500.50",
  "accounts": {
    "vault": { "balance": "$1,000" },
    "trading": { "balance": "$800" },
    "savings": { "balance": "$500" },
    "profitLock": { "balance": "$200.50" }
  },
  "totalEarningsYTD": "$125.50",
  "lastUpdated": "2026-01-21T14:32:00Z"
}
```

### List Accounts
```bash
GET /api/wallet/accounts
Authorization: Bearer <token>

Response:
{
  "accounts": [
    {
      "id": "vault-account-uuid",
      "name": "Vault Account",
      "type": "vault",
      "balance": "1000.00",
      "currency": "USDC",
      "createdAt": "2025-12-01T10:00:00Z"
    },
    {
      "id": "trading-account-uuid",
      "name": "Trading Account",
      "type": "trading",
      "balance": "800.00",
      "currency": "USDC"
    },
    {
      "id": "savings-account-uuid",
      "name": "Savings Account",
      "type": "savings",
      "balance": "500.00",
      "currency": "USDC",
      "apy": "2%"
    },
    {
      "id": "profit-lock-uuid",
      "name": "Profit Lock Account",
      "type": "profitLock",
      "balance": "200.50",
      "currency": "USDC"
    }
  ]
}
```

### Get Total Balance
```bash
GET /api/wallet/balance
Authorization: Bearer <token>

Response:
{
  "totalUSD": "2500.50",
  "accountBreakdown": {
    "vault": "1000",
    "trading": "800",
    "savings": "500",
    "profitLock": "200.50"
  },
  "lastUpdated": "2026-01-21T14:32:00Z"
}
```

---

## Deposits (On-Ramps)

### Step 1: List Available Deposit Methods
```bash
GET /api/wallet/deposits/methods
Authorization: Bearer <token>

Response:
{
  "methods": [
    {
      "id": "flutterwave",
      "name": "Flutterwave",
      "provider": "Flutterwave",
      "enabled": true,
      "minAmount": 50,
      "maxAmount": 500000,
      "fees": {
        "localCards": "3.2%",
        "internationalCards": "4.8%",
        "mobileMoney": "2.9%"
      },
      "processingTime": "1-3 business days",
      "currencies": ["KES", "USD", "EUR", "GBP"]
    },
    {
      "id": "paystack",
      "name": "Paystack",
      "provider": "Paystack",
      "enabled": true,
      "minAmount": 10,
      "maxAmount": 500000,
      "fees": {
        "localCards": "2.9%",
        "internationalCards": "3.8%",
        "mobileMoney": "1.5%"
      },
      "processingTime": "1-2 business days"
    },
    // ... 4 more providers (Paychant, Kotani, M-Pesa, Airtel)
  ]
}
```

### Step 2: Initiate Deposit
```bash
POST /api/wallet/deposits/initiate
Authorization: Bearer <token>
Content-Type: application/json

{
  "toAccountId": "vault-account-uuid",
  "provider": "flutterwave",
  "amount": "100.00",
  "currency": "USDC",
  "metadata": {
    "source": "mobile-app",
    "deviceId": "device-uuid"
  }
}

Response:
{
  "depositId": "deposit-uuid",
  "status": "pending",
  "provider": "flutterwave",
  "amount": "100.00",
  "fee": "3.20",
  "estimatedAmountUSDC": "96.80",
  "paymentLink": "https://checkout.flutterwave.com/pay/...",
  "expiresAt": "2026-01-21T16:32:00Z",
  "nextStep": "Complete payment via link above"
}
```

### Step 3: Track Deposit Status
```bash
GET /api/wallet/deposits/:depositId
Authorization: Bearer <token>

Response:
{
  "depositId": "deposit-uuid",
  "status": "completed|pending|failed",
  "provider": "flutterwave",
  "amount": "100.00",
  "fee": "3.20",
  "receivedAmount": "96.80",
  "currency": "USDC",
  "toAccountId": "vault-account-uuid",
  "transactionHash": "0x...",
  "externalReference": "ref_123456",
  "gatewayReference": "flw_ref_123",
  "createdAt": "2026-01-21T14:32:00Z",
  "completedAt": "2026-01-21T14:45:00Z"
}
```

### Get Deposit History
```bash
GET /api/wallet/deposits/user/:userId
Authorization: Bearer <token>

Query Parameters:
- limit: 20 (default)
- offset: 0 (default)
- status: completed|pending|failed (optional)
- provider: flutterwave|paystack|... (optional)

Response:
{
  "deposits": [
    {
      "depositId": "deposit-uuid",
      "status": "completed",
      "provider": "flutterwave",
      "amount": "100.00",
      "receivedAmount": "96.80",
      "createdAt": "2026-01-21T14:32:00Z"
    }
  ],
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

---

## Withdrawals (Off-Ramps)

### Step 1: Estimate Withdrawal Fees
```bash
POST /api/wallet/withdrawals/estimate-fees
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromAccountId": "trading-account-uuid",
  "destination": "offramp_flutterwave",
  "amount": "100.00",
  "currency": "USDC"
}

Response:
{
  "amount": "100.00",
  "fee": "3.20",
  "netAmount": "96.80",
  "destination": "offramp_flutterwave",
  "processingTime": "1-3 business days",
  "provider": "Flutterwave"
}
```

### Step 2: Initiate Withdrawal
```bash
POST /api/wallet/withdrawals/initiate
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromAccountId": "trading-account-uuid",
  "destination": "offramp_flutterwave",
  "destinationAddress": "user@email.com|mpesa-phone",
  "amount": "100.00",
  "currency": "USDC"
}

Response:
{
  "withdrawalId": "withdrawal-uuid",
  "status": "pending",
  "provider": "flutterwave",
  "amount": "100.00",
  "fee": "3.20",
  "netAmount": "96.80",
  "destination": "user@email.com",
  "createdAt": "2026-01-21T14:32:00Z",
  "expectedCompletionAt": "2026-01-22T14:32:00Z"
}
```

### Step 3: Track Withdrawal Status
```bash
GET /api/wallet/withdrawals/:withdrawalId
Authorization: Bearer <token>

Response:
{
  "withdrawalId": "withdrawal-uuid",
  "status": "completed|pending|processing|failed",
  "provider": "flutterwave",
  "amount": "100.00",
  "fee": "3.20",
  "netAmount": "96.80",
  "destination": "user@email.com",
  "transactionHash": "0x...",
  "gatewayReference": "flw_xfer_123",
  "createdAt": "2026-01-21T14:32:00Z",
  "completedAt": "2026-01-21T15:45:00Z"
}
```

---

## Swaps & Trading

### Step 1: Get Swap Quote
```bash
GET /api/dex/quote
Authorization: Bearer <token>

Query Parameters:
- fromToken: USDC
- toToken: BTC|SOL|ETH
- amount: 100
- slippage: 0.5 (percent)

Response:
{
  "fromToken": "USDC",
  "toToken": "BTC",
  "fromAmount": "100.00",
  "toAmount": "0.0025",
  "priceImpact": "0.3%",
  "route": [
    {
      "dex": "Uniswap",
      "route": "USDC → ETH → BTC",
      "expectedOutput": "0.00248"
    }
  ],
  "estimatedGas": "$2.50",
  "slippage": "0.5%",
  "totalFees": "$2.70",
  "netOutput": "0.00248",
  "validUntil": "2026-01-21T14:37:00Z" // Quote expires in 5 minutes
}
```

### Step 2: Create DEX Swap
```bash
POST /api/transactions/swaps
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromToken": "USDC",
  "toToken": "BTC",
  "fromAmount": "100.00",
  "toAmountMin": "0.00245", // After slippage
  "slippage": "0.5"
}

Response:
{
  "swapId": "swap-uuid",
  "status": "pending",
  "fromToken": "USDC",
  "toToken": "BTC",
  "fromAmount": "100.00",
  "toAmountExpected": "0.0025",
  "route": "USDC → ETH → BTC",
  "createdAt": "2026-01-21T14:32:00Z",
  "nextStep": "User must approve token spending on blockchain"
}
```

### Step 3: Execute Swap (After User Approval on Blockchain)
```bash
POST /api/transactions/swaps/:swapId/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "transactionId": "0x1234567890...",
  "toAmountActual": "0.00249",
  "priceImpactPercent": "0.28"
}

Response:
{
  "swapId": "swap-uuid",
  "status": "completed",
  "fromToken": "USDC",
  "toToken": "BTC",
  "fromAmount": "100.00",
  "toAmountActual": "0.00249",
  "priceImpactPercent": "0.28",
  "transactionId": "0x...",
  "completedAt": "2026-01-21T14:33:00Z"
}
```

### Get Swap History
```bash
GET /api/transactions/swaps/:walletId
Authorization: Bearer <token>

Response:
{
  "swaps": [
    {
      "swapId": "swap-uuid",
      "status": "completed",
      "fromToken": "USDC",
      "toToken": "BTC",
      "fromAmount": "100.00",
      "toAmount": "0.00249",
      "completedAt": "2026-01-21T14:33:00Z"
    }
  ],
  "total": 12,
  "totalVolumeUSD": "$1,250.00"
}
```

---

## Vaults & Staking

### Get Available Vaults
```bash
GET /api/vault
Authorization: Bearer <token>

Response:
{
  "vaults": [
    {
      "id": "vault-uuid",
      "name": "Conservative Vault",
      "type": "conservative",
      "description": "Stablecoin focused, low volatility",
      "apy": "5%",
      "apyRange": "4-6%",
      "totalValue": "$500,000",
      "userShares": "100",
      "userValue": "$1,000",
      "allocation": {
        "cUSD": "40%",
        "USDC": "40%",
        "USDT": "20%"
      },
      "riskLevel": "Low",
      "minDeposit": "10"
    },
    {
      "id": "vault-uuid-2",
      "name": "Growth Vault",
      "type": "growth",
      "description": "Balanced crypto exposure",
      "apy": "15%",
      "apyRange": "12-18%",
      "totalValue": "$1,200,000",
      "allocation": {
        "ETH": "40%",
        "SOL": "35%",
        "BTC": "25%"
      },
      "riskLevel": "Medium"
    }
  ]
}
```

### Deposit to Vault
```bash
POST /api/vault/deposit
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": "100.00",
  "currency": "ETH",
  "vaultAddress": "0x..."
}

Response:
{
  "depositId": "deposit-uuid",
  "vaultId": "vault-uuid",
  "amount": "100.00",
  "sharesReceived": "99.5",
  "sharePrice": "1.005",
  "status": "pending",
  "estimatedCompletionAt": "2026-01-21T14:45:00Z"
}
```

### Get Vault Performance
```bash
GET /api/vault/performance
Authorization: Bearer <token>

Query Parameters:
- vaultId: vault-uuid
- period: 1d|7d|30d|90d|1y (default: all-time)

Response:
{
  "vaultId": "vault-uuid",
  "totalValue": "$1,150",
  "principalDeposited": "$1,000",
  "yieldEarned": "$150",
  "yieldPercent": "15%",
  "apy": "15%",
  "apyThisMonth": "1.25%",
  "shares": "99.5",
  "sharePrice": "11.56",
  "performance": {
    "daily": "+0.05%",
    "weekly": "+0.35%",
    "monthly": "+1.25%",
    "yearly": "+15%"
  },
  "lastCompounded": "2026-01-21T08:00:00Z",
  "nextCompound": "2026-01-22T08:00:00Z"
}
```

### Withdraw from Vault
```bash
POST /api/vault/withdraw
Authorization: Bearer <token>
Content-Type: application/json

{
  "shares": "50",
  "destination": "trading-account-uuid"
}

Response:
{
  "withdrawalId": "withdrawal-uuid",
  "sharesWithdrawn": "50",
  "amountReceived": "577.50",
  "sharePriceAtWithdrawal": "11.55",
  "status": "pending",
  "estimatedCompletionAt": "2026-01-21T14:45:00Z"
}
```

---

## Pools & Liquidity

### List Available Pools
```bash
GET /api/pools
Authorization: Bearer <token>

Query Parameters:
- type: stablecoin|crypto|governance|exotic (optional)
- sortBy: apy|tvl|volume (default: apy)

Response:
{
  "pools": [
    {
      "id": "pool-uuid",
      "name": "cUSD-USDC Pool",
      "type": "stablecoin",
      "baseApy": "5%",
      "bonusApy": "0%",
      "totalApy": "5%",
      "tvl": "$500,000",
      "volume24h": "$250,000",
      "fees": "0.05%",
      "userLiquidity": "$1,000",
      "userEarnings": "$50",
      "lockRequired": false,
      "minDeposit": "10"
    },
    {
      "id": "pool-uuid-2",
      "name": "ETH-SOL Pool",
      "type": "crypto",
      "baseApy": "15%",
      "bonusApy": "5%",
      "totalApy": "20%",
      "lockOptions": [
        { "days": 30, "multiplier": "3x" },
        { "days": 90, "multiplier": "5x" },
        { "days": 180, "multiplier": "8x" }
      ],
      "impermanentLoss": "-2.5%",
      "poolComposition": {
        "ETH": "50%",
        "SOL": "50%"
      }
    }
  ]
}
```

### Stake in Pool
```bash
POST /api/pools/stake
Authorization: Bearer <token>
Content-Type: application/json

{
  "poolId": "pool-uuid",
  "amount": "500.00",
  "lockPeriod": "30-days|90-days|180-days|unlocked"
}

Response:
{
  "stakeId": "stake-uuid",
  "poolId": "pool-uuid",
  "amount": "500.00",
  "lockPeriod": "30-days",
  "multiplier": "3x",
  "baseApy": "5%",
  "effectiveApy": "15%",
  "dailyEarnings": "$0.21",
  "lockExpiresAt": "2026-02-20T14:32:00Z",
  "status": "active",
  "createdAt": "2026-01-21T14:32:00Z"
}
```

### Get Pool Earnings
```bash
GET /api/pools/:poolId/earnings
Authorization: Bearer <token>

Response:
{
  "stakeId": "stake-uuid",
  "poolId": "pool-uuid",
  "principalAmount": "500.00",
  "totalEarned": "$125.50",
  "harvestedRewards": "$50",
  "pendingRewards": "$75.50",
  "dailyRate": "$1.20",
  "weeklyRate": "$8.40",
  "monthlyRate": "$36",
  "annualizedRate": "$438.00",
  "lockExpiry": "2026-02-20T14:32:00Z",
  "daysRemaining": 30,
  "canHarvestNow": true,
  "canUnstakeNow": false
}
```

### Harvest Rewards
```bash
POST /api/pools/:poolId/harvest
Authorization: Bearer <token>

Response:
{
  "harvestId": "harvest-uuid",
  "stakeId": "stake-uuid",
  "rewardsHarvested": "$75.50",
  "destinationAccount": "vault-account-uuid",
  "status": "completed",
  "transactionId": "0x...",
  "completedAt": "2026-01-21T14:33:00Z"
}
```

### Unstake from Pool (After Lock Period)
```bash
POST /api/pools/:poolId/unstake
Authorization: Bearer <token>

Response:
{
  "unstakeId": "unstake-uuid",
  "stakeId": "stake-uuid",
  "principalReturned": "500.00",
  "finalRewards": "$75.50",
  "totalReceived": "$575.50",
  "status": "completed",
  "completedAt": "2026-01-21T14:34:00Z"
}
```

---

## Automated Strategies

### Get Available Strategies
```bash
GET /api/strategies
Authorization: Bearer <token>

Response:
{
  "strategies": [
    {
      "type": "grid-trading",
      "name": "Grid Trading",
      "description": "Automate buy/sell at price levels",
      "expectedApy": "20-50%",
      "riskLevel": "Medium",
      "complexity": "Medium",
      "minCapital": "100",
      "parameters": {
        "asset": ["BTC", "ETH", "SOL", "..."],
        "gridLevels": "range: 3-20",
        "gridSpacing": "range: 1-5%"
      }
    },
    {
      "type": "dca",
      "name": "Dollar-Cost Averaging",
      "expectedApy": "15-30%",
      "riskLevel": "Low",
      "complexity": "Low",
      "parameters": {
        "asset": ["BTC", "SOL", "ETH", "..."],
        "investmentPerPeriod": "min: 10",
        "period": ["daily", "weekly", "monthly"]
      }
    },
    // ... 5 more strategies
  ]
}
```

### Start Strategy
```bash
POST /api/strategies/:type/initiate
Authorization: Bearer <token>
Content-Type: application/json

# Example: Grid Trading
{
  "tradingAccountId": "trading-account-uuid",
  "asset": "BTC",
  "gridLevels": 5,
  "gridSpacing": "2%",
  "gridInvestment": "500"
}

Response:
{
  "strategyId": "strategy-uuid",
  "type": "grid-trading",
  "status": "active",
  "asset": "BTC",
  "gridLevels": 5,
  "gridSpacing": "2%",
  "deployedCapital": "500.00",
  "remainingCapital": "0",
  "expectedDailyReturn": "$5-15",
  "expectedMonthlyReturn": "$150-450",
  "expectedAnnualReturn": "$1,800-5,400",
  "createdAt": "2026-01-21T14:32:00Z"
}
```

### Get Strategy Performance
```bash
GET /api/strategies/:strategyId/performance
Authorization: Bearer <token>

Query Parameters:
- period: 1d|7d|30d|90d|1y (default: all-time)

Response:
{
  "strategyId": "strategy-uuid",
  "type": "grid-trading",
  "status": "active",
  "deployedCapital": "500.00",
  "currentValue": "$560.00",
  "unrealizedPnL": "$60.00",
  "unrealizedReturn": "12%",
  "dailyPnL": "+$12.50",
  "monthlyPnL": "+$180.00",
  "weeklyReturn": "2.4%",
  "monthlyReturn": "7.2%",
  "annualizedAPY": "28.8%",
  "performance": {
    "daily": "+2.4%",
    "weekly": "+2.5%",
    "monthly": "+12%",
    "ytd": "+12%"
  },
  "tradeStats": {
    "totalTrades": 15,
    "winningTrades": 11,
    "losingTrades": 4,
    "winRate": "73.3%",
    "avgWinSize": "$15.20",
    "avgLossSize": "-$5.10",
    "profitFactor": "3.2"
  },
  "riskMetrics": {
    "currentDrawdown": "-2.5%",
    "maxDrawdown": "-8.3%",
    "sharpeRatio": "1.8"
  },
  "lastTrade": "2026-01-21T13:45:00Z"
}
```

### Stop Strategy
```bash
POST /api/strategies/:strategyId/stop
Authorization: Bearer <token>

Response:
{
  "strategyId": "strategy-uuid",
  "status": "stopped",
  "stoppedAt": "2026-01-21T14:35:00Z",
  "finalValue": "$560.00",
  "totalReturn": "$60.00",
  "totalReturnPercent": "12%",
  "capitalReturned": "560.00",
  "destinationAccount": "trading-account-uuid"
}
```

---

## Passive Income

### Get Earning Opportunities
```bash
GET /api/economy/earn
Authorization: Bearer <token>

Response:
{
  "opportunities": {
    "governance": {
      "totalAvailable": "$1,000",
      "monthlyEarnings": "$50",
      "action": "Vote on proposals",
      "rewardRate": "0.1-1% per proposal"
    },
    "referrals": {
      "referredUsers": 15,
      "totalReferred": "$2,500",
      "monthlyEarnings": "$75",
      "commissionRate": "3-10%",
      "leaderboardRank": 42
    },
    "contributions": {
      "submissions": 8,
      "monthlyEarnings": "$120",
      "reputation": 850,
      "topics": ["articles", "bug-reports"]
    },
    "poolFees": {
      "monthlyEarnings": "$30",
      "shareOfVolume": "0.01-0.05%"
    }
  }
}
```

### Vote on Proposal (Governance)
```bash
POST /api/governance/vote
Authorization: Bearer <token>
Content-Type: application/json

{
  "proposalId": "prop-uuid",
  "choice": "for|against|abstain",
  "votingPower": "1000"
}

Response:
{
  "voteId": "vote-uuid",
  "proposalId": "prop-uuid",
  "choice": "for",
  "votingPower": "1000",
  "reward": "$5",
  "createdAt": "2026-01-21T14:32:00Z"
}
```

### Get Referral Status
```bash
GET /api/referral/status
Authorization: Bearer <token>

Response:
{
  "referralCode": "MTAA_USER_123",
  "referralLink": "https://mtaa.io/ref/MTAA_USER_123",
  "referredUsers": 15,
  "totalReferred": "$2,500",
  "commissionRate": "3-10%",
  "monthlyEarnings": "$75",
  "lifetimeEarnings": "$450",
  "referrals": [
    {
      "userId": "user-uuid",
      "email": "referred@example.com",
      "depositAmount": "$500",
      "commissionEarned": "$25",
      "referredAt": "2025-12-01T10:00:00Z"
    }
  ]
}
```

### Submit Contribution
```bash
POST /api/contributions/submit
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "article|bug-report|feature-request|community-help",
  "title": "How to Grid Trade on MTAA",
  "description": "A comprehensive guide...",
  "content": "Full content here...",
  "tags": ["trading", "guide", "tutorial"]
}

Response:
{
  "contributionId": "contrib-uuid",
  "type": "article",
  "status": "pending-review",
  "potentialReward": "$50-200",
  "submittedAt": "2026-01-21T14:32:00Z",
  "reviewedAt": null,
  "approvedReward": null
}
```

---

## Webhooks

### Payment Webhook Events

All webhooks are sent as POST requests with HMAC-SHA256 signature verification (except M-Pesa which uses IP whitelisting).

#### Flutterwave Webhook
```bash
POST /api/webhooks/flutterwave
Content-Type: application/json
verif-hash: <HMAC-SHA256-signature>

{
  "data": {
    "id": "12345",
    "tx_ref": "ref_123",
    "flw_ref": "flw_ref_123",
    "status": "successful",
    "amount": 100,
    "currency": "KES",
    "customer": {
      "email": "user@example.com",
      "phone_number": "+254712345678"
    }
  }
}

Response:
{
  "success": true,
  "message": "Deposit completed"
}
```

#### Paystack Webhook
```bash
POST /api/webhooks/paystack
Content-Type: application/json
x-paystack-signature: <HMAC-SHA512-signature>

{
  "event": "charge.success",
  "data": {
    "id": "12345",
    "reference": "ref_123",
    "amount": 10000,
    "currency": "KES",
    "status": "success"
  }
}

Response:
{
  "success": true
}
```

#### M-Pesa Webhook (No signature verification)
```bash
POST /api/webhooks/mpesa
Content-Type: application/json

{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "1234",
      "CheckoutRequestID": "ws_1234",
      "ResultCode": 0,
      "ResultDesc": "The service request has been processed successfully.",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount", "Value": 1 },
          { "Name": "MpesaReceiptNumber", "Value": "LHG31ZA60V" },
          { "Name": "PhoneNumber", "Value": 254708374149 }
        ]
      }
    }
  }
}

Response:
{
  "ResultCode": 0
}
```

#### Onramper Webhook
```bash
POST /api/webhooks/onramper
Content-Type: application/json
x-onramper-signature: <HMAC-SHA256-signature>

{
  "transactionId": "onr_123",
  "status": "SUCCESS",
  "reference": "ref_123",
  "amount": 100,
  "crypto": {
    "amount": "0.005",
    "symbol": "BTC"
  }
}

Response:
{
  "success": true
}
```

---

## Error Handling

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient balance in account",
    "details": {
      "required": "500.00",
      "available": "300.00"
    }
  },
  "timestamp": "2026-01-21T14:32:00Z"
}
```

### Common Error Codes
- `INVALID_TOKEN` - JWT token invalid or expired
- `INSUFFICIENT_BALANCE` - Not enough funds
- `INVALID_AMOUNT` - Amount outside min/max range
- `INVALID_DESTINATION` - Destination account not found
- `INVALID_PROVIDER` - Payment provider not available
- `STRATEGY_ALREADY_ACTIVE` - Strategy already running
- `POOL_LOCKED` - Cannot unstake during lock period
- `INVALID_SIGNATURE` - Webhook signature verification failed
- `RATE_LIMITED` - Too many requests
- `SERVER_ERROR` - Internal server error

---

## Rate Limiting

All endpoints are rate limited:
- 100 requests per minute per user
- 1000 requests per minute per API key
- Webhook endpoints: unlimited (rate limited by provider)

Response headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642776720
```

---

## Testing

### Sandbox Credentials

All payment providers support sandbox testing:

```
Flutterwave:
  API Key: FLUTTERWAVE_SANDBOX_KEY
  Test Card: 4242 4242 4242 4242
  CVV: 100
  Expiry: Any future date

Paystack:
  API Key: PAYSTACK_SANDBOX_KEY
  Test Card: 4084 0343 1234 5678
  CVV: 353
  Expiry: 12/28

M-Pesa:
  Environment: Sandbox
  Phone: 254708374149
  Amount: Any

Onramper:
  Environment: Sandbox
  All assets available in testnet mode
```

---

## Complete End-to-End Example

```bash
# 1. Get deposit methods
curl -H "Authorization: Bearer $TOKEN" \
  https://api.mtaa.io/api/wallet/deposits/methods

# 2. Initiate deposit
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toAccountId": "vault-account-uuid",
    "provider": "flutterwave",
    "amount": "100.00"
  }' \
  https://api.mtaa.io/api/wallet/deposits/initiate

# 3. Complete payment via provider link
# User visits payment link and completes payment

# 4. Track deposit
curl -H "Authorization: Bearer $TOKEN" \
  https://api.mtaa.io/api/wallet/deposits/deposit-uuid

# 5. Get swap quote
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.mtaa.io/api/dex/quote?fromToken=USDC&toToken=BTC&amount=100"

# 6. Execute swap
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fromToken": "USDC",
    "toToken": "BTC",
    "fromAmount": "100.00",
    "slippage": "0.5"
  }' \
  https://api.mtaa.io/api/transactions/swaps

# 7. Deposit to vault
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "50.00",
    "currency": "BTC",
    "vaultAddress": "0x..."
  }' \
  https://api.mtaa.io/api/vault/deposit

# 8. Stake in pool
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "poolId": "pool-uuid",
    "amount": "50.00",
    "lockPeriod": "30-days"
  }' \
  https://api.mtaa.io/api/pools/stake

# 9. Monitor earnings
curl -H "Authorization: Bearer $TOKEN" \
  https://api.mtaa.io/api/pools/pool-uuid/earnings

# 10. Harvest rewards
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://api.mtaa.io/api/pools/pool-uuid/harvest

# 11. Initiate withdrawal
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fromAccountId": "vault-account-uuid",
    "destination": "offramp_flutterwave",
    "destinationAddress": "user@email.com",
    "amount": "100.00"
  }' \
  https://api.mtaa.io/api/wallet/withdrawals/initiate

# 12. Track withdrawal
curl -H "Authorization: Bearer $TOKEN" \
  https://api.mtaa.io/api/wallet/withdrawals/withdrawal-uuid
```

---

**Last Updated**: January 21, 2026
**API Version**: 1.0.0
**Status**: Production Ready
