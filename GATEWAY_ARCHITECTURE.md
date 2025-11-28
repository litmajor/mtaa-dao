# Multi-Chain Gateway Architecture

## Overview

The Gateway is a **central aggregation and security layer** for all multi-chain operations. It acts as the secure foundation for cross-chain transfers, swaps, and complex transactions by providing unified access to market data, gas prices, liquidity information, and optimal routing.

## Core Responsibilities

### 1. **Market Data Aggregation**
- **Price Feeds**: Aggregates prices from Chainlink, Uniswap, and CoinGecko with deviation detection
- **Confidence Scoring**: Each price includes a confidence score based on source agreement
- **Fallback Logic**: Automatically switches between sources if primary fails
- **Historical Prices**: Maintains historical data for trend analysis

### 2. **Liquidity Analysis**
- **Multi-DEX Scanning**: Monitors liquidity across Uniswap V2, Uniswap V3, Curve, Balancer
- **Depth Analysis**: Calculates slippage at different trade sizes
- **Concentration Metrics**: Identifies concentrated vs. distributed liquidity
- **Health Checks**: Validates liquidity is adequate for operations

### 3. **Gas Price Tracking**
- **Real-time Gas Feeds**: Monitors gas prices across all supported chains
- **Cost Estimation**: Calculates gas costs in USD for any transaction
- **Cross-Chain Comparison**: Identifies cheapest execution chains
- **Speed Level Options**: Standard/Fast/Instant pricing

### 4. **On-Chain Volume**
- **24h/7d/Monthly Tracking**: Monitors trading volume across timeframes
- **Market Trending**: Identifies trending pairs and high-volume periods
- **Activity Analysis**: Tracks transaction counts and active users
- **Market Intelligence**: Provides insights for optimal execution timing

### 5. **Secure Route Optimization**
- **Multi-Step Routing**: Finds optimal paths for complex transactions
- **Bridge Integration**: Supports Stargate, Axelar, Wormhole, LayerZero
- **Alternative Routes**: Generates 3+ backup routes sorted by criteria
- **Risk Assessment**: Scores routes for slippage, liquidity, gas costs, and bridge security

### 6. **Security Validation**
- **Pre-execution Checks**: Validates all routes before execution
- **Slippage Thresholds**: Enforces max slippage limits
- **Liquidity Verification**: Confirms adequate liquidity exists
- **Contract Verification**: Validates smart contract security
- **Bridge Security**: Checks bridge audits and status
- **Risk Scoring**: 0-100 score indicating overall risk level

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Gateway Service                         │
│  (Central Aggregation & Security Layer)                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Price        │  │ Liquidity    │  │ Gas Price    │       │
│  │ Aggregator   │  │ Provider     │  │ Provider     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Volume       │  │ Route        │  │ Security     │       │
│  │ Tracker      │  │ Optimizer    │  │ Validator    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                     Cache Layer                              │
│  • Prices (1 min TTL)                                        │
│  • Liquidity (30 sec TTL)                                    │
│  • Gas (15 sec TTL)                                          │
│  • Routes (2 min TTL)                                        │
│  • Volume (5 min TTL)                                        │
├─────────────────────────────────────────────────────────────┤
│                   External Data Sources                      │
│  Chainlink  │ Uniswap  │ CoinGecko  │ DeFi Llama  │ Etherscan
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### GatewayService (gateway.ts)
Central orchestrator that:
- Manages caching and TTL
- Coordinates between providers
- Handles rate limiting
- Emits events for monitoring
- Validates operations
- Maintains health status

### Price Aggregator (providers.ts)
- Fetches from multiple sources
- Calculates weighted averages
- Detects price deviations
- Provides fallback logic
- Historical price tracking

### Liquidity Provider
- Scans multiple DEXes
- Calculates slippage at scale
- Identifies best pools
- Monitors liquidity health
- Tracks concentration

### Route Optimizer (optimizer.ts)
- Finds optimal swap paths
- Generates alternatives
- Calculates total costs
- Estimates execution time
- Risk assessment

### Security Validator
- Pre-execution validation
- Risk scoring
- Security checks
- Approval workflow

## Data Types & Interfaces

### Core Request Type
```typescript
interface GatewayQuoteRequest {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  chainInId: number;
  chainOutId: number;
  slippage?: number;
  maxGasPrice?: string;
}
```

### Core Response Type
```typescript
interface GatewayQuoteResponse {
  quote: PriceQuote;
  route: TransferRoute;
  alternatives: TransferRoute[];
  risks: string[];
  timestamp: number;
}
```

### Transfer Route
```typescript
interface TransferRoute {
  id: string;
  source: { token, amount, chainId, address };
  destination: { token, chainId, address };
  steps: RouteStep[];
  expectedOutput: string;
  minOutput: string;
  totalSlippage: number;
  totalGasCost: string;
  totalGasCostUSD: number;
  bridgeMethod: string;
  estimatedTime: number;
  riskLevel: 'low' | 'medium' | 'high';
  timestamp: number;
}
```

## API Endpoints

### Price Endpoints
- `GET /api/gateway/price/:token/:chainId` - Get current price
- `POST /api/gateway/prices` - Get multiple prices
- `GET /api/gateway/price/:token/:chainId/aggregated` - Aggregated price

### Liquidity Endpoints
- `GET /api/gateway/liquidity/:tokenA/:tokenB/:chainId` - Get liquidity info
- `POST /api/gateway/liquidity/depth-analysis` - Analyze depth
- `POST /api/gateway/liquidity/health-check` - Check liquidity health

### Gas Endpoints
- `GET /api/gateway/gas/:chainId` - Get gas prices
- `POST /api/gateway/gas/estimate` - Estimate gas cost
- `POST /api/gateway/gas/compare` - Compare across chains

### Volume Endpoints
- `GET /api/gateway/volume/:pair/:chainId` - Get volume data
- `GET /api/gateway/market-activity/:chainId` - Analyze activity

### Route Endpoints
- `POST /api/gateway/quote` - Get optimal route
- `POST /api/gateway/recommendation` - Get recommendation with rationale

### Security Endpoints
- `POST /api/gateway/validate-route` - Validate route
- `POST /api/gateway/validate-operation` - Validate operation

### Market & Health
- `GET /api/gateway/market-snapshot` - Full market snapshot
- `GET /api/gateway/health` - Gateway health status

## Usage Examples

### Get Optimal Route for Cross-Chain Swap
```typescript
const response = await gateway.getOptimalRoute({
  tokenIn: '0x...',      // USDC
  tokenOut: '0x...',     // DAI
  amountIn: '1000',      // 1000 USDC
  chainInId: 1,          // Ethereum
  chainOutId: 137,       // Polygon
  slippage: 0.5,         // 0.5% max slippage
});

// Returns optimal route + alternatives + risk assessment
```

### Check Liquidity Health
```typescript
const health = await gateway.checkLiquidityHealth(
  'USDC',
  'DAI',
  1,
  '10000000'  // Minimum liquidity required
);

if (health.healthy) {
  // Proceed with operation
}
```

### Compare Gas Across Chains
```typescript
const comparison = await gateway.compareGasAcrossChains(
  [1, 137, 56, 43114],  // Ethereum, Polygon, BSC, Avalanche
  '200000'              // Gas limit
);

// Identifies cheapest chain for execution
```

### Get Market Snapshot
```typescript
const snapshot = await gateway.getMarketSnapshot();

// Returns prices, gas, volumes, bridges for all chains
```

## Security Features

### 1. Pre-execution Validation
- Slippage within threshold
- Liquidity adequate
- Gas costs acceptable
- Bridge verified
- Oracle health checked

### 2. Risk Scoring
- 0-30: Low risk ✅
- 31-60: Medium risk ⚠️
- 61-100: High risk ❌

### 3. Rate Limiting
- Per-user limits
- Per-endpoint limits
- Volume caps
- Time-based throttling

### 4. Monitoring & Alerts
- Oracle health tracking
- Bridge status monitoring
- Price deviation alerts
- Gas spike notifications
- Volume surge alerts

## Caching Strategy

| Data Type | TTL | Priority |
|-----------|-----|----------|
| Prices | 1 minute | Real-time |
| Gas Fees | 15 seconds | Critical |
| Liquidity | 30 seconds | High |
| Routes | 2 minutes | Medium |
| Volume | 5 minutes | Low |

## Event Emissions

The Gateway emits events for:
- `route_generated` - New route created
- `price_update` - Price change detected
- `liquidity_alert` - Low liquidity warning
- `gas_spike` - Gas prices surging
- `volume_surge` - Unusual volume detected
- `alert` - General alerts

## Integration Points

### With DAO System
- Validates token swaps for DAO transfers
- Ensures secure cross-chain operations
- Provides cost estimates for governance

### With Rules Engine
- Routes must pass security validation
- Slippage limits enforced
- Gas cost checks

### With Escrow System
- Validates cross-chain escrow routes
- Ensures destination chain liquidity
- Calculates total fees

## Performance Metrics

- **Price Aggregation**: < 100ms
- **Route Optimization**: < 500ms
- **Liquidity Analysis**: < 200ms
- **Security Validation**: < 100ms
- **Cache Hit Rate**: ~85%

## Best Practices

1. **Always Get Alternatives**: Use alternatives if primary route fails
2. **Check Health First**: Validate gateway health before operations
3. **Monitor Events**: Subscribe to alerts for market changes
4. **Use Recommended Routes**: Follow security validator recommendations
5. **Batch Requests**: Aggregate multiple requests to reduce latency
6. **Handle Failures**: Implement fallback logic for provider failures
