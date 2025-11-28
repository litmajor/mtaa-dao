# Gateway Integration Guide

## System Integration Overview

The Gateway serves as the **central hub** for all multi-chain operations, feeding data and routing logic to:

1. **Rules Engine** - Validates operations against DAO rules
2. **Escrow System** - Ensures cross-chain transfers are secure
3. **DAO Operations** - Provides optimal execution paths
4. **API Layer** - Exposes functionality to frontend

## Integration Flows

### 1. DAO Member Transfer (Cross-Chain)

```
User Request
    ↓
Gateway.getOptimalRoute()
    ├─ Fetch prices (both chains)
    ├─ Check liquidity (source & dest)
    ├─ Estimate gas (both chains)
    ├─ Generate optimal route
    └─ Return alternatives
    ↓
RulesEngine.validateRoute()
    ├─ Check slippage limits
    ├─ Verify liquidity adequacy
    ├─ Validate gas costs
    └─ Apply DAO rules
    ↓
Escrow.initiateTransfer()
    ├─ Lock tokens on source chain
    ├─ Execute bridge transfer
    └─ Verify on destination
    ↓
Confirmation
```

### 2. Token Swap Within DAO (Single Chain)

```
User Request (swap USDC → DAI on Ethereum)
    ↓
Gateway.getOptimalRoute()
    ├─ Get USDC/DAI liquidity
    ├─ Analyze slippage
    ├─ Estimate gas
    └─ Return route
    ↓
RulesEngine.evaluateSwapRules()
    ├─ Check swap limits
    ├─ Verify user tier
    ├─ Apply fee schedule
    └─ Approve/reject
    ↓
Execute Swap
    ├─ Send to DEX (Uniswap)
    ├─ Monitor execution
    └─ Record analytics
    ↓
Confirmation
```

### 3. Multi-Leg Cross-Chain Swap

```
Request: USDT (Ethereum) → MATIC (Polygon) → DAI (Polygon)
    ↓
Gateway.optimizeRoute()
    ├─ Step 1: Swap USDT → USDC (Ethereum)
    │   ├─ Check ETH chain liquidity
    │   ├─ Calculate gas
    │   └─ Estimate output
    │
    ├─ Step 2: Bridge USDC (Ethereum → Polygon)
    │   ├─ Select best bridge
    │   ├─ Estimate time
    │   └─ Calculate fees
    │
    └─ Step 3: Swap USDC → DAI (Polygon)
        ├─ Check Polygon liquidity
        ├─ Calculate gas
        └─ Estimate output
    ↓
Combined Route
    ├─ Total slippage: 0.8%
    ├─ Total gas: $2.45 USD
    ├─ Estimated time: 5 minutes
    └─ Risk: Low
    ↓
Execution
```

## Code Integration Examples

### Using Gateway in DAO Operations

```typescript
import { GatewayService } from './gateway/gateway';
import { ruleEngine } from './rule-engine';

async function executeDAOTransfer(
  fromMemberId: string,
  toMemberId: string,
  amount: string,
  tokenAddress: string,
  sourceChain: number,
  destChain: number
): Promise<any> {
  try {
    // Step 1: Get optimal route
    const quote = await gateway.getOptimalRoute({
      tokenIn: tokenAddress,
      tokenOut: tokenAddress,
      amountIn: amount,
      chainInId: sourceChain,
      chainOutId: destChain,
      slippage: 0.5,
    });

    // Step 2: Validate against DAO rules
    const ruleResult = await ruleEngine.evaluateAllRules(
      daoId,
      'member_transfer',
      {
        fromMember: fromMemberId,
        toMember: toMemberId,
        amount,
        route: quote.route,
        slippage: quote.route.totalSlippage,
        gasCost: quote.route.totalGasCostUSD,
      }
    );

    if (!ruleEngine.checkAllApproved(ruleResult)) {
      throw new Error('Transfer rejected by DAO rules');
    }

    // Step 3: Execute transfer
    const txHash = await escrowService.initiateTransfer({
      from: fromMemberId,
      to: toMemberId,
      amount,
      route: quote.route,
      gasEstimate: quote.route.totalGasCost,
    });

    return {
      success: true,
      txHash,
      expectedOutput: quote.route.expectedOutput,
      estimatedTime: quote.route.estimatedTime,
    };
  } catch (error) {
    console.error('Transfer failed:', error);
    throw error;
  }
}
```

### Using Gateway in Rules Engine

```typescript
// In rule evaluation context
async function evaluateTransferRule(
  rule: DaoRule,
  context: any
): Promise<RuleEvaluationResult> {
  const { amount, route, slippage, gasCost } = context;

  // Evaluate slippage conditions
  const slippageCondition = {
    field: 'slippage',
    operator: 'lte',
    value: rule.conditions.maxSlippage,
  };

  // Evaluate gas cost conditions
  const gasCostCondition = {
    field: 'gasCost',
    operator: 'lte',
    value: rule.conditions.maxGasCostUSD,
  };

  // Gateway provides actual values for comparison
  const slippageMet = this.evaluateCondition(slippageCondition, { slippage });
  const gasCostMet = this.evaluateCondition(gasCostCondition, { gasCost });

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    status: (slippageMet && gasCostMet) ? 'approved' : 'rejected',
    reason: !slippageMet ? 'Slippage too high' : !gasCostMet ? 'Gas cost too high' : undefined,
    executionTime: Date.now(),
  };
}
```

### Using Gateway in Frontend

```typescript
// React component example
function CrossChainTransfer() {
  const [route, setRoute] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [loading, setLoading] = useState(false);

  const getQuote = async (tokenIn, tokenOut, amount, chainIn, chainOut) => {
    setLoading(true);
    try {
      const response = await fetch('/api/gateway/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenIn,
          tokenOut,
          amountIn: amount,
          chainInId: chainIn,
          chainOutId: chainOut,
          slippage: 0.5,
        }),
      });

      const { data } = await response.json();
      setRoute(data.route);
      setAlternatives(data.alternatives);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {route && (
        <>
          <h3>Optimal Route</h3>
          <div>
            <p>Expected Output: {route.expectedOutput}</p>
            <p>Min Output: {route.minOutput}</p>
            <p>Slippage: {route.totalSlippage}%</p>
            <p>Gas Cost: ${route.totalGasCostUSD.toFixed(2)}</p>
            <p>Est. Time: {route.estimatedTime}s</p>
            <p>Risk: {route.riskLevel}</p>
          </div>

          {alternatives.length > 0 && (
            <>
              <h4>Alternatives</h4>
              {alternatives.map((alt, i) => (
                <div key={i}>
                  <p>Option {i + 1}: {alt.bridgeMethod}</p>
                  <p>Gas: ${alt.totalGasCostUSD.toFixed(2)}</p>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
```

## Data Flow Diagrams

### Price Aggregation Flow
```
Multiple Oracles
    ├─ Chainlink: $1.00
    ├─ Uniswap: $1.002
    └─ CoinGecko: $0.998
        ↓
Price Aggregator
    ├─ Calculate weighted average: $0.9996
    ├─ Calculate deviation: 0.2%
    └─ Assign confidence: 0.998
        ↓
Cached Result
    ├─ Price: $0.9996
    ├─ Confidence: 0.998
    ├─ TTL: 1 min
    └─ Timestamp: 2025-11-23T10:30:00Z
```

### Liquidity Analysis Flow
```
DEX Pools
    ├─ Uniswap V2: $10M liquidity
    ├─ Uniswap V3: $15M liquidity
    ├─ Curve: $5M liquidity
    └─ Balancer: $2M liquidity
        ↓
Liquidity Analyzer
    ├─ Score by liquidity: V3 wins
    ├─ Score by fee: V2 wins
    ├─ Calculate depth (1%, 5%, 10% slippage)
    └─ Return best pool with analysis
        ↓
Route Optimizer
    ├─ Use best pool for slippage calc
    ├─ Estimate output amount
    ├─ Calculate routing via other pools
    └─ Recommend route
```

### Route Optimization Flow
```
Request
    ├─ Token In/Out
    ├─ Amount
    ├─ Source/Dest Chain
    └─ Max Slippage
        ↓
Route Generator
    ├─ If same chain: Optimize swap
    ├─ If diff chain: Plan multi-leg
    │   ├─ Leg 1: Swap on source
    │   ├─ Leg 2: Bridge transfer
    │   └─ Leg 3: Swap on dest
    └─ Calculate total costs
        ↓
Security Validator
    ├─ Check slippage threshold
    ├─ Check liquidity adequacy
    ├─ Check gas acceptable
    ├─ Verify bridge security
    └─ Assign risk score
        ↓
Return Route + Alternatives
    ├─ Primary route
    ├─ Alt 1 (best price)
    ├─ Alt 2 (best speed)
    └─ Alt 3 (most liquid)
```

## Error Handling

```typescript
// Gateway returns detailed errors for debugging

try {
  const route = await gateway.getOptimalRoute(request);
} catch (error) {
  if (error.message.includes('Rate limit')) {
    // Handle rate limiting
    // Retry with exponential backoff
  } else if (error.message.includes('No liquidity')) {
    // Route unavailable
    // Suggest alternatives
  } else if (error.message.includes('Price deviation')) {
    // Oracle disagreement
    // Use manual fallback prices
  } else if (error.message.includes('Bridge unavailable')) {
    // Bridge maintenance
    // Try alternative bridge
  }
}
```

## Performance Optimization

### Batching Requests
```typescript
// Instead of individual requests
const prices = await Promise.all([
  gateway.getTokenPrice('USDC', 1),
  gateway.getTokenPrice('DAI', 1),
  gateway.getTokenPrice('USDT', 1),
]);

// Use batch endpoint
const priceMap = await gateway.getPricesForTokens(
  ['USDC', 'DAI', 'USDT'],
  1
);
```

### Caching Strategy
```typescript
// Gateway automatically caches based on TTL
// But you can invalidate cache for fresh data
gateway.invalidateCache('prices'); // Clears all price cache
gateway.invalidateCache('gas');    // Clears gas cache

// Request fresh data
const price = await gateway.getTokenPrice('USDC', 1);
```

## Monitoring & Alerts

```typescript
// Subscribe to gateway events
gateway.on('price_update', (data) => {
  console.log('Price changed:', data);
});

gateway.on('liquidity_alert', (data) => {
  console.warn('Low liquidity warning:', data);
  // Notify user
});

gateway.on('alert', (alert) => {
  console.error('Gateway alert:', alert);
  // Log to monitoring system
});
```

## Testing the Gateway

```typescript
// Mock providers for testing
const mockPriceProvider = {
  getPrice: async () => ({
    price: 1.0,
    confidence: 0.99,
  }),
};

const gateway = new GatewayService(
  mockPriceProvider,
  mockLiquidityProvider,
  mockGasProvider,
  mockVolumeProvider,
  mockRouteOptimizer,
  mockSecurityValidator
);

// Test route optimization
const route = await gateway.getOptimalRoute({
  tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  tokenOut: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
  amountIn: '1000',
  chainInId: 1,
  chainOutId: 137,
});

assert(route.expectedOutput > 0);
assert(route.totalSlippage <= 0.5);
assert(route.riskLevel === 'low');
```
