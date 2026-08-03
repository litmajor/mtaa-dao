# Gateway Infrastructure Refactoring & Implementation Plan

## Executive Summary

The current gateway architecture has three overlapping abstractions (Data Gateway Service, Gateway Agent Service, Payment Gateway Service) that create complexity and duplication. This plan consolidates them into a clean, event-driven data plane architecture while first wiring the existing unmounted components.

---

## Phase 1: IMMEDIATE - Wire Existing Components (TODAY)

### 1.1 Mount Data Gateway Service Routes

**Current State**: ✅ Built but not wired
- File: `server/services/gateway/api.ts` exports `createGatewayRoutes()`
- Routes ready: `/api/gateway/price/*`, `/api/gateway/liquidity/*`, `/api/gateway/gas/*`, etc.
- Issue: Not mounted in `server/routes.ts`

**Actions**:
1. Import `createGatewayRoutes` in `server/routes.ts`
2. Initialize `GatewayService` singleton
3. Mount at `/api/gateway` path in `registerRoutes()`
4. Test all endpoints respond correctly

**Files to Modify**:
- `server/routes.ts` - Add import and mount
- `server/services/gateway/index.ts` - Export singleton instance

**Estimated Time**: 20 minutes

---

### 1.2 Write E2E Tests for Gateway

**Test Coverage**:
1. **Initialization Tests**
   - Gateway service initializes without errors
   - All providers (Chainlink, Uniswap, CoinGecko) are created
   - Message bus is connected
   - Adapter registry is populated

2. **Price Aggregation Tests**
   - Single token price retrieval (`getTokenPrice`)
   - Batch prices (`getPricesForTokens`)
   - Aggregated prices with multi-source fallback
   - Confidence scoring and deviation detection
   - Cache hit/miss behavior
   - Fallback chain on provider failure

3. **Liquidity Tests**
   - Pool discovery across protocols
   - Slippage calculation at different amounts
   - Health scoring
   - Concentration metrics

4. **Gas Estimation Tests**
   - Single chain gas prices
   - Cross-chain gas comparison
   - USD-converted costs

5. **Route Optimization Tests**
   - Single-chain swap routes
   - Cross-chain transfer routing
   - Alternative route generation
   - Bridge selection logic

6. **Integration Tests**
   - E2E request flow: API → Gateway → Adapter → Provider → Response
   - Cache invalidation
   - Error recovery and fallbacks
   - Concurrent request handling

**Test Files to Create**:
- `server/__tests__/gateway.e2e.test.ts` - Main E2E tests
- `server/__tests__/gateway.integration.test.ts` - Integration with providers
- `server/__tests__/gateway.cache.test.ts` - Caching behavior

**Framework**: Vitest (already configured)

**Estimated Time**: 3 hours

---

## Phase 2: REFACTORING - Consolidate Architecture (NEXT ITERATION)

### 2.1 The Problem

**Current State**: Three overlapping abstractions
```
┌─────────────────────────┐
│  Gateway Agent Service  │  Message bus, adapter orchestration
│  (core/agents/gateway)  │
└────────────┬────────────┘
             │
┌────────────▼────────────┐
│  Data Gateway Service   │  Price/liquidity/gas/route aggregation
│  (services/gateway)     │
└────────────┬────────────┘
             │
┌────────────▼────────────┐
│  Payment Gateway        │  Stripe, Paystack, M-Pesa integration
│  (services/payment)     │
└─────────────────────────┘
```

**Issues**:
- `preferredSource` parameter leaks infrastructure (adapter names) to API callers
- Request routing has conditional logic based on source type
- Adapters contain business logic (calculations) not just data fetching
- No unified event system for observability/monitoring/audit
- Cache invalidation is manual, not event-driven
- No policy engine for fallback strategies

### 2.2 The Solution: Event-Driven Data Plane

**Target Architecture**:
```
┌──────────────────────────────────────────────┐
│             GATEWAY AGENT                    │
│      (Orchestration & Coordination)          │
└────────────────┬─────────────────────────────┘
                 │
        ┌────────▼─────────┐
        │   MESSAGE BUS    │
        │ (Event-Driven)   │
        └────────┬─────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│ PRICE   │ │LIQUID.  │ │  RISK   │
│CAPAB.   │ │ CAPAB.  │ │ CAPAB.  │
└────┬────┘ └────┬────┘ └────┬────┘
     │           │           │
     └───────────┼───────────┘
                 │
        ┌────────▼────────┐
        │   ADAPTERS      │
        │ (Data Fetching) │
        └────────┬────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
  CEX        DEX/AMMS    On-Chain
```

**Key Changes**:

1. **Capability Layer**
   - `PriceCapability`: Owns price aggregation logic
   - `LiquidityCapability`: Owns slippage calculations
   - `RouteCapability`: Owns route optimization
   - `RiskCapability`: Owns risk assessment
   - `GasCapability`: Owns gas estimation

2. **Event System**
   - `PriceRequested` → `PriceCollected` → `PriceValidated` → `PriceCached` → `PricePublished`
   - Each event observable by: Analytics, Monitoring, Audit, ML, Alerts
   - No need to touch gateway code for new observers

3. **Policy Engine**
   - Encodes fallback strategies
   - No `preferredSource` parameter
   - Client asks: "Get me BTC price"
   - Engine decides: Chainlink → Uniswap → CoinGecko based on policy
   - Policy configurable via admin interface

4. **Confidence System** (Rich Multidimensional)
   - Replace: `confidence: 0.93`
   - With:
     ```typescript
     {
       freshness: 0.98,      // How recent is the data?
       latency: 0.95,        // How fast was it fetched?
       deviation: 0.87,      // How much do sources agree?
       providerTrust: 0.99,  // Historical reliability?
       completeness: 1.0,    // All data present?
       consistency: 0.92     // Temporal stability?
     }
     ```
   - Consumers decide what confidence means
   - Trading engine: `freshness > 0.95 && deviation < 0.02`
   - Dashboard: Any confidence >= 0.5

5. **Adapter Abstraction**
   - Adapters = Data fetchers only
   - No business logic in adapters
   - Uniform interface: `query(request) → rawData`
   - Normalization happens in Capability layer

6. **Single Plane, Multiple Services**
   - Market Data Plane (prices, liquidity, gas)
   - Payment Plane (Stripe, Paystack, etc.)
   - Agent Coordination Plane (orchestration)
   - All share: auth, caching, telemetry, message bus, rate limiting

---

### 2.3 Implementation Steps (Phase 2)

#### Step 1: Create Capability Abstraction
- `PriceCapability`: Aggregates prices, applies confidence, handles fallback
- `LiquidityCapability`: Analyzes pools, computes slippage
- `RouteCapability`: Optimizes routes, evaluates alternatives
- `RiskCapability`: Scores protocols, updates in real-time
- `GasCapability`: Estimates costs, compares chains

#### Step 2: Create Event System
```typescript
interface GatewayEvent {
  id: string;
  type: 'PriceRequested' | 'PriceCollected' | 'PriceValidated' | 'PriceCached' | 'PricePublished';
  timestamp: number;
  correlation: { requestId, userId?, sessionId? };
  payload: Record<string, any>;
  metadata: { source, latencyMs, confidence?, error? };
}
```

#### Step 3: Create Policy Engine
```typescript
interface FallbackPolicy {
  sources: string[];  // ['chainlink', 'uniswap', 'coingecko']
  timeout: number;    // 5000ms per source
  minimumConfidence: number;
  allowCache: boolean;
  circuitBreaker: { failureThreshold: 5, resetMs: 60000 };
}
```

#### Step 4: Refactor Routes
- Remove `preferredSource` parameter
- Use policy engine internally
- Response includes rich confidence object
- All events published to message bus

#### Step 5: Migrate Adapters
- Move calculation logic to Capability layer
- Adapters become pure data fetchers
- Uniform query/normalize interface

---

## Phase 3: OPTIMIZATION (FUTURE)

- Add ML-based confidence scoring based on historical accuracy
- Implement distributed tracing for request flows
- Add real-time alerts for confidence degradation
- Support custom policy DSL for advanced users
- Add per-token and per-protocol configuration

---

## Files Structure After Refactoring

```
server/
├── services/
│   └── gateway/
│       ├── gateway.ts               # Core orchestrator (unchanged)
│       ├── types.ts                 # Type definitions
│       ├── api.ts                   # Route creation (unchanged for now)
│       ├── providers.ts             # Adapters only (logic moved)
│       ├── capabilities/            # NEW
│       │   ├── price.ts
│       │   ├── liquidity.ts
│       │   ├── route.ts
│       │   ├── risk.ts
│       │   └── gas.ts
│       ├── events/                  # NEW
│       │   ├── eventBus.ts
│       │   └── types.ts
│       ├── policies/                # NEW
│       │   ├── engine.ts
│       │   └── defaults.ts
│       └── confidence/              # NEW
│           └── scoring.ts
└── __tests__/
    └── gateway.*.test.ts
```

---

## Success Criteria

### Phase 1 (TODAY)
- [x] Gateway Service mounted at `/api/gateway`
- [x] All 10+ endpoints return data
- [x] E2E tests pass (initialization + all key functions)
- [x] No TypeScript errors
- [x] Build succeeds
- [ ] Tests verify cache behavior
- [ ] Tests verify fallback logic
- [ ] Tests verify confidence scoring

### Phase 2 (NEXT)
- [ ] Capability layer implemented
- [ ] Event system functional
- [ ] Policy engine configurable
- [ ] All tests refactored for new architecture
- [ ] Zero breaking changes to API consumers
- [ ] Rich confidence objects returned
- [ ] No `preferredSource` parameter needed

### Phase 3 (FUTURE)
- [ ] ML-based confidence
- [ ] Distributed tracing
- [ ] Alert integration
- [ ] Custom policy DSL

---

## Risk Mitigation

1. **Breaking Changes**: Phase 1 is additive only. Phase 2 maintains backward compatibility via compatibility layer.
2. **Performance**: Capability layer is a thin wrapper. No performance degradation expected.
3. **Provider Reliability**: Already have fallback chain. Adding events improves observability of failures.
4. **Cache Consistency**: Event-driven invalidation is more reliable than manual TTL.

---

## Timeline

- **Phase 1**: ~4 hours (mount + tests)
- **Phase 2**: ~2 weeks (full refactoring)
- **Phase 3**: Ongoing optimization

---

## Questions for Review

1. Should payment gateway follow the same pattern (Payment Capability)?
2. Should identity/auth have a similar Capability pattern?
3. Who should subscribe to gateway events? (Analytics, Monitoring, Audit, Alerts?)
4. Should policies be stored in database or configured at startup?
5. Should rich confidence be opt-in or always returned?
