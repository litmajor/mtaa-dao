# Vault + Strategy + Asset Graph + Symbol Universe Integration

## Current Architecture Gap

The **Symbol Universe** and **Asset Graph** services exist but are **disconnected from vault and strategy operations**. They operate in silos:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ISOLATED SYSTEMS                                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────┐                       │
│  │ SYMBOL UNIVERSE  │    │ ASSET GRAPH      │                       │
│  ├──────────────────┤    ├──────────────────┤                       │
│  │ • Asset metadata │    │ • User positions │                       │
│  │ • Deployments    │    │ • Yield tracking │                       │
│  │ • Relationships  │    │ • Liquidation    │                       │
│  │ • Risk tiers     │    │ • Risk scoring   │                       │
│  └──────────────────┘    └──────────────────┘                       │
│         ↑ CoinGecko            ↑ CCXT/Aave/Lido                     │
│         ↑ Uniswap              ↑ Moola                               │
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────┐                       │
│  │ STRATEGIES       │    │ VAULTS           │                       │
│  ├──────────────────┤    ├──────────────────┤                       │
│  │ • Allocations    │    │ • Holdings       │                       │
│  │ • Backtesting    │    │ • NAV calc       │                       │
│  │ • Rebalancing    │    │ • Deposits       │                       │
│  │ • Freqtrade      │    │ • Fees           │                       │
│  └──────────────────┘    └──────────────────┘                       │
│         NO REFERENCE TO ASSET GRAPH OR SYMBOL UNIVERSE              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Required Integration Points

### 1. Strategy + Symbol Universe

**Current Problem:**
```typescript
// strategyDashboardService.ts - Asset selection is hardcoded
const allocation: StrategyAllocation = {
  symbol: 'ETH',           // ← What if ETH isn't supported on deployment chain?
  weight: 0.5,
  targetPrice: await getPrice('ETH'),  // ← Single price source, no fallback
};
```

**Solution:**
```typescript
// strategyDashboardService.ts - ENHANCED
import { symbolUniverse } from '../core/symbol_universe';

async createStrategy(input: CreateStrategyInput) {
  // Validate all assets exist in Symbol Universe
  for (const allocation of input.allocations) {
    const asset = symbolUniverse.getAsset(allocation.symbol);
    if (!asset) {
      throw new Error(`Asset ${allocation.symbol} not in Symbol Universe`);
    }
    
    // Check supported chains for deployment
    const deployments = symbolUniverse.getDeployments(
      allocation.symbol,
      input.deploymentChain  // e.g., 'celo'
    );
    
    if (deployments.length === 0) {
      throw new Error(
        `${allocation.symbol} not deployed on ${input.deploymentChain}`
      );
    }
    
    // Get risk tier from Symbol Universe
    const riskTier = asset.tier;  // tier_1, tier_2, tier_3, tier_4
    if (riskTier === 'tier_4' && input.riskProfile === 'conservative') {
      throw new Error(`Cannot allocate tier_4 asset to conservative strategy`);
    }
  }
  
  // REST OF CREATION LOGIC...
}
```

**Integration Checklist:**
- [ ] Validate all strategy allocations against Symbol Universe at creation
- [ ] Check asset availability on deployment chain
- [ ] Enforce risk tier constraints (tier_4 only for aggressive strategies)
- [ ] Fetch asset metadata (decimals, name) from Symbol Universe
- [ ] Monitor wrapped/synthetic relationships for rebalancing (e.g., wETH → ETH)

---

### 2. Vault + Symbol Universe + Asset Graph

**Current Problem:**
```solidity
// MaonoVault.sol - NAV calculation
function updateNAV() external {
  uint256 totalValue = 0;
  for (uint i = 0; i < assets.length; i++) {
    // ← Price fetched from single oracle only
    uint256 price = oracleService.getPrice(assets[i]);
    totalValue += balance[i] * price;
  }
  // ← No validation against Symbol Universe deployments
  // ← No risk adjustment from Asset Graph
}
```

**Solution - Enhanced NAV Calculation:**
```typescript
// navOracleService.ts - ENHANCED WITH ASSET GRAPH
import { symbolUniverse } from '../core/symbol_universe';
import { assetGraphService } from './assetGraphService';

async calculateVaultNAV(vaultAddress: string): Promise<{
  nav: bigint;
  breakdown: Map<string, NavComponent>;
  riskMetrics: RiskAssessment;
  confidenceScore: number;
}> {
  const vault = await getVaultDetails(vaultAddress);
  let totalValue = 0n;
  const breakdown = new Map<string, NavComponent>();
  
  for (const holding of vault.holdings) {
    // 1. Verify asset in Symbol Universe
    const asset = symbolUniverse.getAsset(holding.symbol);
    if (!asset) throw new Error(`Unknown asset: ${holding.symbol}`);
    
    // 2. Get deployment address on vault's chain
    const deployment = symbolUniverse.getDeployment(
      holding.symbol,
      vault.chain
    );
    
    // 3. Verify contract address matches
    if (deployment?.contractAddress !== holding.tokenAddress) {
      logger.warn(
        `Address mismatch for ${holding.symbol}: ` +
        `Symbol Universe says ${deployment?.contractAddress}, ` +
        `vault has ${holding.tokenAddress}`
      );
      // REJECT or UPDATE - don't proceed with wrong address
    }
    
    // 4. Get price from multiple sources (price oracle + DEX)
    const priceData = await this.getMultiSourcePrice(holding.symbol, vault.chain);
    
    // 5. Check Asset Graph for yield-bearing relationships
    const yield = await assetGraphService.getYieldForAsset(holding.symbol);
    
    // 6. Calculate adjusted value
    const adjustedValue = (
      BigInt(holding.balance) *
      BigInt(Math.floor(priceData.usd * 1e8))  // 8 decimal fixed-point
    ) / BigInt(1e8);
    
    totalValue += adjustedValue;
    
    breakdown.set(holding.symbol, {
      symbol: holding.symbol,
      balance: holding.balance,
      priceUsd: priceData.usd,
      valueUsd: Number(adjustedValue) / 1e8,
      yieldApy: yield?.apy || 0,
      riskTier: asset.tier,
      priceConfidence: priceData.confidence,
      sources: priceData.sources,
    });
  }
  
  // 7. Calculate portfolio-level risk
  const portfolioComposition = breakdown.keys();
  const riskMetrics = {
    concentrationRisk: calculateConcentrationRisk(breakdown),
    tierDistribution: calculateTierDistribution(breakdown),
    yieldExposure: Array.from(breakdown.values()).reduce((sum, c) => sum + c.yieldApy, 0),
    liquidationRisk: await assetGraphService.assessLiquidationRisk(vaultAddress),
  };
  
  // 8. Calculate confidence score
  const confidenceScore = Math.min(
    ...Array.from(breakdown.values()).map(c => c.priceConfidence)
  );
  
  return {
    nav: totalValue,
    breakdown,
    riskMetrics,
    confidenceScore,
  };
}

private async getMultiSourcePrice(symbol: string, chain: SupportedChain): Promise<{
  usd: number;
  sources: string[];
  confidence: number;
}> {
  // Price from multiple sources with fallback
  const prices = await Promise.allSettled([
    this.coinGeckoClient.getPrice(symbol),
    this.dexscreenerClient.getPrice(symbol, chain),
    this.uniswapV3Oracle.getPrice(symbol, chain),
  ]);
  
  const validPrices = prices
    .filter(p => p.status === 'fulfilled')
    .map((p: any) => p.value);
  
  if (validPrices.length === 0) throw new Error(`No price data for ${symbol}`);
  
  // Average of all sources
  const avg = validPrices.reduce((a, b) => a + b, 0) / validPrices.length;
  
  // Confidence based on source agreement
  const variance = validPrices.reduce((sum, p) => 
    sum + Math.abs(p - avg), 0) / validPrices.length;
  const confidence = 100 - Math.min(variance / avg * 100, 50);
  
  return {
    usd: avg,
    sources: ['coingecko', 'dexscreener', 'uniswap_oracle'],
    confidence,
  };
}
```

**Integration Checklist:**
- [ ] Verify vault holdings against Symbol Universe deployments at update time
- [ ] Get multi-source prices (CoinGecko + on-chain Oracle)
- [ ] Calculate confidence score based on price source agreement
- [ ] Check Asset Graph for yield opportunities
- [ ] Account for tier risk in NAV confidence calculation
- [ ] Monitor wrapped asset relationships (stETH/ETH ratio)

---

### 3. Strategy Rebalancing + Asset Graph

**Current Problem:**
```typescript
// strategyDashboardService.ts
rebalanceStrategy(strategyId: string) {
  const current = getCurrentAllocations(strategyId);
  const target = getTargetAllocations(strategyId);
  
  // Calculate rebalance trades (no context about market)
  const drifts = calculateDrift(current, target);
  
  // Execute trades (no risk assessment)
  executeTrades(drifts);
}
```

**Solution - Risk-Aware Rebalancing:**
```typescript
// Strategy Rebalancing - ENHANCED

async rebalanceStrategy(strategyId: string): Promise<RebalanceResult> {
  const strategy = await getStrategyDetails(strategyId);
  const current = await getCurrentAssetComposition(strategyId);
  const target = getTargetAllocations(strategyId);
  
  // 1. Get Asset Graph risk assessment
  const riskAssessment = await assetGraphService.assessPortfolioRisk(
    Array.from(target.keys())
  );
  
  // 2. Validate assets in Symbol Universe
  for (const symbol of target.keys()) {
    const asset = symbolUniverse.getAsset(symbol);
    if (!asset) {
      throw new Error(`Target asset ${symbol} not in Symbol Universe`);
    }
  }
  
  // 3. Check for wrapped asset relationships
  for (const symbol of target.keys()) {
    const relationships = symbolUniverse.getRelationshipsFor(symbol);
    // If rebalancing stETH, check if waking up to ETH is better
    // If rebalancing wETH, consider unwrapping if gas is cheap
  }
  
  // 4. Calculate drift with risk adjustment
  const drifts = calculateDriftWithRiskAdjustment(
    current,
    target,
    riskAssessment,
    strategy.riskProfile
  );
  
  // 5. Optimize trade order (Asset Graph liquidity data)
  const optimizedTrades = await optimizeTradeSequence(
    drifts,
    assetGraphService.getLiquidityMetrics()
  );
  
  // 6. Execute with monitoring
  const result = await executeRebalanceTrades(optimizedTrades);
  
  return {
    ...result,
    riskMetrics: {
      beforeRebalance: riskAssessment.before,
      afterRebalance: riskAssessment.after,
      riskImprovement: riskAssessment.improvement,
    },
  };
}
```

**Integration Checklist:**
- [ ] Check rebalance candidates in Symbol Universe
- [ ] Get Asset Graph risk assessment before rebalancing
- [ ] Optimize trade sequence using Asset Graph liquidity data
- [ ] Monitor wrapped/bridge asset relationships
- [ ] Calculate yield impact (moving from aUSDC → USDC yield loss)
- [ ] Verify liquidation risk doesn't increase after rebalance

---

### 4. Strategy Following + Asset Graph

**Current Problem:**
```typescript
// User copies strategy without understanding their own portfolio risk
followStrategy(strategyId: string, investmentAmount: number) {
  // Just deploy the allocations identical to strategy creator
  copyAllocations(strategyId);
}
```

**Solution - Risk-Aware Strategy Following:**
```typescript
async followStrategy(
  userId: string,
  strategyId: string,
  investmentAmount: number
): Promise<FollowResult> {
  // 1. Get follower's existing asset graph
  const followerGraph = await assetGraphService.loadUserGraph(userId);
  
  // 2. Get strategy's target composition
  const strategyComposition = await getStrategyComposition(strategyId);
  
  // 3. Calculate COMBINED portfolio composition
  const mergedComposition = mergeCompositions(
    followerGraph.portfolioMetrics,
    strategyComposition,
    investmentAmount
  );
  
  // 4. Assess combined risk
  const combinedRisk = await assetGraphService.assessPortfolioRisk(
    Array.from(mergedComposition.keys())
  );
  
  // 5. Check for concentration risks
  if (combinedRisk.concentrationScore > 0.7) {
    return {
      success: false,
      error: 'Following this strategy would create over-concentration',
      recommendation: 'Reduce position size or rebalance existing portfolio',
      analysis: combinedRisk,
    };
  }
  
  // 6. Check liquidation risk from Asset Graph
  const liquidationRisk = await assetGraphService.assessLiquidationRisk(userId);
  if (liquidationRisk.riskLevel === 'critical') {
    return {
      success: false,
      error: 'Your existing positions are at liquidation risk',
      recommendation: 'Reduce leverage before following new strategies',
    };
  }
  
  // 7. Proceed with follow
  return followAndExecute(userId, strategyId, investmentAmount);
}
```

**Integration Checklist:**
- [ ] Load follower's Asset Graph before copying
- [ ] Check merged composition risk
- [ ] Verify no liquidation risk created
- [ ] Monitor concentration on Symbol Universe tiers
- [ ] Track yield opportunity created/lost

---

### 5. Smart Contract ↔ Backend Data Sync

**Problem:**
```solidity
// MaonoVault.sol - What assets are supported?
// Hard-coded list, no connection to Symbol Universe
Asset[] supportedAssets = [USDC, USDT, DAI];
```

**Solution - Symbol Universe-Driven Asset Registry:**
```typescript
// Sync endpoint: Backend → Smart Contract

router.post('/api/vaults/:vaultId/sync-asset-registry', async (req, res) => {
  const vaultId = req.params.vaultId;
  const vault = await getVaultDetails(vaultId);
  
  // Get current supported assets from Symbol Universe
  const supportedAssets = symbolUniverse.getAssetsForChain(vault.chain)
    .filter(asset => asset.tier !== 'tier_4')  // Only tier 1-3
    .filter(asset => asset.category !== 'meme_token');  // Exclude memes
  
  // Get deployments for each asset on target chain
  const deployments = supportedAssets.map(asset => {
    const deployment = symbolUniverse.getDeployment(asset.symbol, vault.chain);
    return {
      symbol: asset.symbol,
      tokenAddress: deployment.contractAddress,
      decimals: asset.decimals,
      riskTier: asset.tier,
    };
  });
  
  // Update smart contract registry
  const tx = await vaultContract.updateAssetRegistry(deployments);
  
  res.json({
    success: true,
    vaultId,
    assetsRegistered: deployments.length,
    transactionHash: tx.hash,
    assets: deployments,
  });
});

// Smart contract receives and stores
function updateAssetRegistry(Asset[] memory newAssets) external onlyGovernance {
  for (uint i = 0; i < newAssets.length; i++) {
    Asset memory asset = newAssets[i];
    
    // Verify address is real deployment (basic check)
    uint256 code_size;
    assembly {
      code_size := extcodesize(asset.tokenAddress)
    }
    require(code_size > 0, "Invalid asset address");
    
    assets[keccak256(abi.encodePacked(asset.symbol))] = asset;
  }
  emit AssetRegistryUpdated(newAssets.length);
}
```

**Integration Checklist:**
- [ ] Create `/api/vaults/sync-asset-registry` endpoint
- [ ] Periodically sync Symbol Universe → Smart Contract
- [ ] Validate smart contract addresses match Symbol Universe
- [ ] Create Solidity Oracle interface to query Symbol Universe
- [ ] Rate-limit updates (1x per day minimum)

---

## Data Flow Architecture

### Complete Update Flow: Strategy Allocation → Vault NAV → Asset Graph

```
┌─────────────────────────────────────────────────────────────────────┐
│  Strategy Rebalance Triggered                                       │
│  (User creates strategy or schedule fires)                          │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Strategy Dashboard Service                                       │
│    • Get target allocations                                         │
│    • QUERY: symbolUniverse.getAsset() for each                     │
│    • QUERY: symbolUniverse.getDeployments() per chain               │
│    • Result: Validated asset list                                   │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Asset Graph Service                                              │
│    • QUERY: getPortfolioRisk() for target composition               │
│    • QUERY: getLiquidityMetrics() for execution planning            │
│    • Result: Risk assessment + trade sequence optimization          │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Execute Trades (via DEX or Freqtrade)                            │
│    • Use Symbol Universe deployments as swap routes                 │
│    • Monitor slippage against Asset Graph liquidity estimates       │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. Update Vault NAV (NavOracleService)                              │
│    • QUERY: symbolUniverse.getDeployments() for each holding        │
│    • QUERY: getMultiSourcePrice() (CoinGecko + DEX)                 │
│    • QUERY: assetGraphService.getYieldForAsset()                    │
│    • Result: Confident NAV + risk metrics                           │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5. Publish NAV Update + Risk Metrics to Chain                       │
│    • Submit transaction with ECDSA signature                        │
│    • Include: NAV, confidence, risk tier, composition               │
│    • Smart contract verifies against stored Symbol Universe         │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 6. Update Asset Graph (Real-Time Position Tracking)                 │
│    • New NAV affects all followers' graph metrics                   │
│    • Followers get liquidation risk alerts if tier exposure changed │
│    • Dashboard shows updated yield forecasts                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Symbol Universe Integration (Week 1)
- [ ] Add `validateAssetForStrategy()` to strategyDashboardService
- [ ] Add `validateVaultHoldings()` to MaonoVault contract
- [ ] Create `/api/vaults/sync-asset-registry` endpoint
- [ ] Update navOracleService to verify deployments
- [ ] Add tests for asset validation

### Phase 2: Asset Graph Wiring (Week 2)
- [ ] Add `getRiskAssessment()` call to rebalancing flow
- [ ] Add liquidation risk check to followStrategy()
- [ ] Integrate yield metrics into NAV calculation
- [ ] Create `/api/strategies/:id/risk-analysis` endpoint
- [ ] Add tests for risk-aware rebalancing

### Phase 3: Multi-Source Pricing (Week 3)
- [ ] Implement `getMultiSourcePrice()` with fallbacks
- [ ] Add confidence scoring
- [ ] Integrate DEX prices (Uniswap V3 + Curve) on Celo
- [ ] Add CoinGecko as primary fallback
- [ ] Create pricing health dashboard

### Phase 4: Liquidation Risk Monitoring (Week 4)
- [ ] Hook Asset Graph liquidation checks into rebalancing
- [ ] Add alerts to Amara dashboard when risk increases
- [ ] Create `/api/liquidation-risk` endpoint per user
- [ ] Implement automated hedging suggestions
- [ ] Set up Telegram/Discord alerts

### Phase 5: Optimization & Monitoring (Week 5)
- [ ] Optimize Symbol Universe queries with caching
- [ ] Add batch risk assessment API
- [ ] Create admin dashboard for Symbol Universe sync status
- [ ] Monitor price divergence alerts
- [ ] Implement 7-day audit logs for all NAV updates

---

## Key Interfaces to Add

```typescript
// strategyDashboardService.ts additions
interface StrategyValidationContext {
  allocations: {
    symbol: string;
    weight: number;
    riskTier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
  }[];
  deploymentChain: SupportedChain;
  strategyRiskProfile: 'conservative' | 'balanced' | 'aggressive';
}

async validateStrategyAssets(context: StrategyValidationContext): Promise<{
  valid: boolean;
  issues: string[];
  recommendations: string[];
}>;

// navOracleService.ts additions
interface VaultNAVContext {
  vaultAddress: string;
  chain: SupportedChain;
  holdings: {
    symbol: string;
    balance: bigint;
    tokenAddress: string;
  }[];
}

async calculateNAVWithValidation(context: VaultNAVContext): Promise<{
  nav: bigint;
  confidence: number;
  deploymentVerification: Map<string, { verified: boolean; reason?: string }>;
  riskMetrics: RiskMetrics;
}>;
```

---

## Conclusion

**Without Asset Graph + Symbol Universe Integration:**
- Vaults don't verify asset addresses match on-chain deployments
- Strategies can allocate to unsupported assets on deployment chain
- NAV calculations ignore yield opportunities and risk
- Users can unknowingly create correlated/liquidation-risk portfolios

**With Integration:**
- ✅ All assets validated against canonical Symbol Universe
- ✅ Rebalancing considers portfolio-level risk (Asset Graph)
- ✅ NAV confident with multi-source pricing
- ✅ Strategy followers see risk warnings before committing capital
- ✅ Liquidation risks caught before they happen
- ✅ Yield opportunities discovered and acted upon
