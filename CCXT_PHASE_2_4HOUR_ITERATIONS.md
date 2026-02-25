# CCXT Phase 2: 4-Hour Iteration Plan
## 92 Hours Broken Into 23 Iterations

**Total Duration:** ~1 week (23 × 4-hour iterations)  
**Optimal Pace:** 3-4 iterations per day  
**Team:** Can be done solo or split across 2-3 developers  

---

## 📋 ITERATION SCHEDULE

### **WEEK 1: Foundation (Iterations 1-6)**

---

## **Iteration 1: Database Schema & Migrations Setup** (4 hours)
**Parallel with:** Nothing (prerequisite)  
**Dependency:** None

### Tasks:
- [ ] Create `cex_prices` table schema
- [ ] Create `cex_orders` table schema  
- [ ] Create `cex_credentials` table schema (encrypted fields)
- [ ] Write schema documentation
- [ ] Create migration file #1

### Deliverables:
- Schema SQL files
- TypeScript type definitions
- Migration ready to run

### Testing:
```bash
pnpm run db:migrate # Test migration runs
pnpm run db:generate # Generate types
```

### Files to Create:
- `drizzle/schema/cex.ts` (schema definitions)
- `drizzle/migrations/[timestamp]_cex_tables.sql`

---

## **Iteration 2: Remaining Tables & Repositories** (4 hours)
**Parallel with:** Nothing (depends on Iteration 1)  
**Dependency:** Iteration 1 complete

### Tasks:
- [ ] Create `arbitrage_opportunities` table
- [ ] Create `exchange_settings` table
- [ ] Write remaining 5 migrations
- [ ] Create repository classes (4 total):
  - CEXPriceRepository
  - CEXOrderRepository
  - CEXCredentialRepository
  - ArbitrageRepository

### Deliverables:
- All tables migrated
- 4 data access layer classes
- Repository interfaces defined

### Files to Create:
- `server/repositories/cexPriceRepository.ts`
- `server/repositories/cexOrderRepository.ts`
- `server/repositories/cexCredentialRepository.ts`
- `server/repositories/arbitrageRepository.ts`

### Testing:
```bash
pnpm run db:migrate # All migrations
npm test -- repositories # Test CRUD operations
```

---

## **Iteration 3: Encryption Module & Key Management** (4 hours)
**Parallel with:** Nothing (prerequisite for Iteration 4)  
**Dependency:** None

### Tasks:
- [ ] Create AES-256-GCM encryption utility
- [ ] Implement key derivation (PBKDF2)
- [ ] Create encryption/decryption functions
- [ ] Build key rotation service
- [ ] Add type definitions

### Deliverables:
- Encryption utility module
- Key rotation service
- Type-safe wrapper functions
- Documentation with examples

### Files to Create:
- `server/utils/encryption.ts` (AES-256-GCM)
- `server/services/keyManagementService.ts`

### Testing:
```typescript
// Example test
const encrypted = encrypt('secret-key', 'my-api-key');
const decrypted = decrypt('secret-key', encrypted);
expect(decrypted).toBe('my-api-key');
```

---

## **Iteration 4: API Key Middleware & Authentication** (4 hours)
**Parallel with:** Nothing (depends on Iteration 3)  
**Dependency:** Iteration 3 complete

### Tasks:
- [ ] Create CEX credentials middleware
- [ ] Implement API key encryption on save
- [ ] Implement API key decryption on use
- [ ] Add audit logging for key access
- [ ] Create validation functions

### Deliverables:
- Middleware for CEX auth
- Audit trail system
- Credential validation
- Error handling for missing/invalid keys

### Files to Create:
- `server/middleware/cexAuthMiddleware.ts`
- `server/middleware/cexAuditLogger.ts`

### API Endpoints (Backend):
```
POST   /api/cex/credentials      - Store encrypted API keys
GET    /api/cex/credentials      - List stored (without secrets)
DELETE /api/cex/credentials/:id  - Remove keys
POST   /api/cex/credentials/test - Test connection
```

---

## **Iteration 5: CEX API Endpoints Part 1** (4 hours)
**Parallel with:** Iterations 1-4 complete  
**Dependency:** Iterations 1-4 complete

### Tasks:
- [ ] Create POST `/api/cex/credentials` endpoint
- [ ] Create GET `/api/cex/credentials` endpoint
- [ ] Create DELETE endpoint
- [ ] Create test connection endpoint
- [ ] Add rate limiting

### Deliverables:
- 4 working API endpoints
- Request validation
- Response formatting
- Error handling

### Files to Create/Modify:
- `server/routes/cex.ts` (add credential endpoints)

### Testing:
```bash
curl -X POST http://localhost:3000/api/cex/credentials \
  -H "Content-Type: application/json" \
  -d '{"exchange":"binance","apiKey":"...","apiSecret":"..."}'
```

---

## **Iteration 6: Price Storage & Caching** (4 hours)
**Parallel with:** Iterations 5 complete  
**Dependency:** Iterations 1-2 complete

### Tasks:
- [ ] Create price collection service
- [ ] Implement 30-second cache
- [ ] Create price update scheduler (cron job)
- [ ] Add database persistence
- [ ] Create price retrieval functions

### Deliverables:
- Background service for collecting prices
- Cache layer (Redis or in-memory)
- Database storage of historical prices
- Query functions for prices

### Files to Create:
- `server/services/cexPriceCollector.ts`
- `server/services/cexPriceCache.ts`

---

## **WEEK 2: Frontend Basics (Iterations 7-14)**

---

## **Iteration 7: Hooks Foundation - useCEXPrices** (4 hours)
**Parallel with:** Yes (can work while others do backend)  
**Dependency:** Iteration 5 (endpoints exist)

### Tasks:
- [ ] Create `useCEXPrices` React hook
- [ ] Implement 10-second polling
- [ ] Add error handling
- [ ] Add loading states
- [ ] Create TypeScript interfaces

### Deliverables:
- Working React hook
- Proper type definitions
- Error boundaries

### Files to Create:
- `client/src/hooks/useCEXPrices.ts`

### Example Usage:
```typescript
const { prices, isLoading, error, refetch } = useCEXPrices('binance');
// prices = { BTC/USDT: 42000, ETH/USDT: 2500, ... }
```

---

## **Iteration 8: Hooks - useCEXOHLCV & useCEXOrder** (4 hours)
**Parallel with:** Iteration 7  
**Dependency:** Iteration 5

### Tasks:
- [ ] Create `useCEXOHLCV` hook (OHLCV data)
- [ ] Create `useCEXOrder` hook
- [ ] Add timeframe selection (1m, 5m, 1h, 1d)
- [ ] Implement error handling
- [ ] Add caching strategy

### Deliverables:
- 2 new hooks
- Support for multiple timeframes
- Optimized re-renders

### Files to Create:
- `client/src/hooks/useCEXOHLCV.ts`
- `client/src/hooks/useCEXOrder.ts`

---

## **Iteration 9: Basic UI Components - Price & Balance** (4 hours)
**Parallel with:** Iteration 7-8  
**Dependency:** Iteration 7

### Tasks:
- [ ] Create `CEXPriceComparison` component
  - [ ] Display prices from multiple exchanges
  - [ ] Show % difference
  - [ ] Highlight best price
- [ ] Create `CEXBalancePanel` component
  - [ ] Show wallet balances
  - [ ] Display in USD equivalent
  - [ ] Refresh button

### Deliverables:
- 2 production-ready components
- Dark mode support
- Mobile responsive
- Accessibility compliant

### Files to Create:
- `client/src/components/cex/CEXPriceComparison.tsx`
- `client/src/components/cex/CEXBalancePanel.tsx`

### Visual Features:
- Color coding (green=best price, red=worst)
- Sparklines for price trends
- Real-time updates

---

## **Iteration 10: Chart Component** (4 hours)
**Parallel with:** Iteration 8  
**Dependency:** Iteration 8

### Tasks:
- [ ] Create `CEXChart` component
- [ ] Integrate chart library (Recharts/Chart.js)
- [ ] Display OHLCV candlesticks
- [ ] Add timeframe selector
- [ ] Implement zoom/pan

### Deliverables:
- Interactive price chart
- Multiple timeframe support
- Responsive design

### Files to Create:
- `client/src/components/cex/CEXChart.tsx`

### Dependencies to Add:
- `recharts` or `chart.js`
- `date-fns` for timeframe handling

---

## **Iteration 11: Order Modal** (4 hours)
**Parallel with:** Iteration 9  
**Dependency:** Iteration 8

### Tasks:
- [ ] Create `CEXOrderModal` component
- [ ] Buy/Sell order forms
- [ ] Order type selector (market, limit)
- [ ] Quantity & price inputs
- [ ] Fee calculation display
- [ ] Confirmation dialog

### Deliverables:
- Full order placement UI
- Input validation
- Real-time fee estimation

### Files to Create:
- `client/src/components/cex/CEXOrderModal.tsx`

### Form Fields:
- Exchange selector
- Trading pair selector
- Order type (market/limit)
- Amount
- Price (limit orders)
- Estimated fee
- Total

---

## **Iteration 12: Arbitrage Detector Component** (4 hours)
**Parallel with:** Iteration 11  
**Dependency:** Iteration 6

### Tasks:
- [ ] Create `ArbitrageDetector` component
- [ ] Display arbitrage opportunities
- [ ] Show profit % for each
- [ ] Add profit filters (min 0.5%, 1%, 2%, 5%)
- [ ] One-click execution button

### Deliverables:
- Arbitrage opportunity dashboard
- Real-time filtering
- Actionable alerts

### Files to Create:
- `client/src/components/cex/ArbitrageDetector.tsx`

### Features:
- List of opportunities: Buy at Exchange A, Sell at Exchange B
- Estimated profit after fees
- Quick action buttons
- Refresh button

---

## **Iteration 13: Integration Page Part 1** (4 hours)
**Parallel with:** Iteration 12  
**Dependency:** Iterations 9-12

### Tasks:
- [ ] Create main CEX dashboard page
- [ ] Layout: Grid with price comparison, balances, chart
- [ ] Add tabs: Prices | Orders | Arbitrage | Settings
- [ ] Implement responsive design
- [ ] Add loading/error states

### Deliverables:
- Full page layout
- Tab navigation
- Responsive on mobile/tablet/desktop

### Files to Create/Modify:
- `client/src/pages/cex-dashboard.tsx` (new page)
- Update App.tsx with new route: `/cex`

---

## **Iteration 14: Integration & Testing** (4 hours)
**Parallel with:** Nothing (final frontend)  
**Dependency:** All frontend iterations

### Tasks:
- [ ] Wire up all components together
- [ ] Test API integration end-to-end
- [ ] Add error handling throughout
- [ ] Fix responsive design issues
- [ ] Add accessibility features (ARIA labels)
- [ ] Mobile testing on real device

### Deliverables:
- Fully integrated CEX dashboard
- Zero console errors
- Mobile-responsive
- Accessible

### Testing Checklist:
- [ ] All hooks return correct data
- [ ] Charts update in real-time
- [ ] Order modal submits correctly
- [ ] Price comparison shows arbitrage
- [ ] Mobile layout works
- [ ] Dark mode works
- [ ] No console errors

---

## **WEEK 2: Smart Router (Iterations 15-18)**

---

## **Iteration 15: Smart Router Foundation** (4 hours)
**Parallel with:** Iteration 13  
**Dependency:** Iteration 6 (price data)

### Tasks:
- [ ] Create smart router service
- [ ] Implement multi-exchange comparison algorithm
- [ ] Add slippage protection logic
- [ ] Create fee calculation engine
- [ ] Add liquidity aggregation

### Deliverables:
- Core routing algorithm
- Fee calculation accurate
- Slippage protection working

### Files to Create:
- `server/services/cexSmartRouter.ts`

### Algorithm:
```
For each trading pair:
  1. Get prices from all exchanges
  2. Calculate fees for each
  3. Filter by minimum liquidity
  4. Sort by effective price (price + fees)
  5. Return best route with fallbacks
```

---

## **Iteration 16: Smart Router API** (4 hours)
**Parallel with:** Iteration 15  
**Dependency:** Iteration 15

### Tasks:
- [ ] Create POST `/api/cex/smart-route` endpoint
- [ ] Input validation (pair, amount, slippage tolerance)
- [ ] Return best route with details
- [ ] Add caching (1-minute TTL)
- [ ] Error handling for missing liquidity

### Deliverables:
- RESTful endpoint
- Request/response types
- Documentation with examples

### API Contract:
```typescript
POST /api/cex/smart-route
{
  pair: "BTC/USDT",
  amount: 1,
  slippageTolerance: 0.5,  // %
  mode: "buy" | "sell"
}

Response:
{
  route: [
    { exchange: "binance", price: 42000, fee: 0.1, liquidity: 100 },
    { exchange: "kraken", price: 42100, fee: 0.16, liquidity: 50 }
  ],
  recommended: "binance",
  estimatedPrice: 42000.42,
  totalFee: 42.00,
  profitOpportunity: {
    exists: true,
    arbitrage: { buy: "binance", sell: "kraken", profit: 5 }
  }
}
```

---

## **Iteration 17: Order Execution Service** (4 hours)
**Parallel with:** Iteration 16  
**Dependency:** Iterations 4, 16

### Tasks:
- [ ] Create order execution service
- [ ] Route orders through smart router
- [ ] Execute on best exchange
- [ ] Handle partial fills
- [ ] Implement retry logic
- [ ] Log all executions

### Deliverables:
- Execution service
- Audit trail
- Failure handling

### Files to Create:
- `server/services/cexOrderExecutor.ts`

---

## **Iteration 18: Frontend Smart Router Integration** (4 hours)
**Parallel with:** Iteration 17  
**Dependency:** Iteration 17

### Tasks:
- [ ] Create `useCEXSmartRoute` hook
- [ ] Update CEXOrderModal to use smart router
- [ ] Show recommended exchange
- [ ] Display fee breakdown
- [ ] Add "execute on best" button
- [ ] Show arbitrage alerts

### Deliverables:
- Smart routing in UI
- Visual arbitrage opportunities
- One-click execution

### Files to Create/Modify:
- `client/src/hooks/useCEXSmartRoute.ts` (new)
- `client/src/components/cex/CEXOrderModal.tsx` (update)

---

## **WEEK 2: Final Integration & Testing (Iterations 19-23)**

---

## **Iteration 19: Testing Suite Part 1** (4 hours)
**Parallel with:** Nothing  
**Dependency:** Iterations 1-18

### Tasks:
- [ ] Write API endpoint tests (repository tests)
- [ ] Write authentication tests
- [ ] Write encryption tests
- [ ] Write smart router tests
- [ ] Aim for >80% code coverage

### Files to Create:
- `server/__tests__/cex.test.ts`
- `server/__tests__/smartRouter.test.ts`
- `server/__tests__/encryption.test.ts`

### Testing Commands:
```bash
npm test -- cex
npm test -- encryption
npm test -- smartRouter
```

---

## **Iteration 20: Testing Suite Part 2** (4 hours)
**Parallel with:** Iteration 19  
**Dependency:** Iterations 7-18

### Tasks:
- [ ] Write component tests (React Testing Library)
- [ ] Write hook tests
- [ ] Write integration tests (E2E with Playwright)
- [ ] Test on mobile viewports

### Files to Create:
- `client/src/__tests__/components/CEXChart.test.tsx`
- `client/src/__tests__/hooks/useCEXPrices.test.ts`
- `e2e/cex.spec.ts`

---

## **Iteration 21: Documentation & Examples** (4 hours)
**Parallel with:** Iteration 20  
**Dependency:** All completed

### Tasks:
- [ ] Write API documentation
- [ ] Create TypeScript interfaces guide
- [ ] Write component usage examples
- [ ] Create troubleshooting guide
- [ ] Document deployment steps

### Files to Create:
- `CCXT_PHASE_2_API_DOCUMENTATION.md`
- `CCXT_PHASE_2_COMPONENT_GUIDE.md`
- `CCXT_PHASE_2_TROUBLESHOOTING.md`

---

## **Iteration 22: Performance & Optimization** (4 hours)
**Parallel with:** Nothing  
**Dependency:** All completed

### Tasks:
- [ ] Profile component renders
- [ ] Optimize expensive computations
- [ ] Implement memoization where needed
- [ ] Reduce API calls (caching)
- [ ] Bundle size analysis

### Checklist:
- [ ] Chart renders in <100ms
- [ ] Price updates in <500ms
- [ ] No unnecessary re-renders
- [ ] API caching working
- [ ] Bundle size <500KB

---

## **Iteration 23: Final Integration & Deployment** (4 hours)
**Parallel with:** Nothing  
**Dependency:** All completed

### Tasks:
- [ ] Deploy to staging environment
- [ ] Run full smoke test suite
- [ ] Test on actual exchanges (test API keys)
- [ ] Performance benchmarking
- [ ] Security review
- [ ] Final documentation review
- [ ] Create deployment runbook

### Deliverables:
- Production-ready code
- Deployment guide
- Rollback procedure

### Deployment Checklist:
- [ ] All tests passing
- [ ] Zero TypeScript errors
- [ ] Environment variables documented
- [ ] Database migrations prepared
- [ ] API keys encrypted
- [ ] Logging configured
- [ ] Monitoring set up

---

## 📊 ITERATION DEPENDENCY DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│ Database & Authentication (Iterations 1-6)                  │
├─────────────────────────────────────────────────────────────┤
│ ├─ Iteration 1: Tables         ─────┐                       │
│ ├─ Iteration 2: Repositories   ─────┤                       │
│ ├─ Iteration 3: Encryption     ─────┼─→ Iteration 4: Auth   │
│ ├─ Iteration 5: API Endpoints  ◄─────┤                       │
│ └─ Iteration 6: Price Cache    ─────┘                       │
│                                                              │
│ PARALLEL TRACK 1: Frontend (Iterations 7-14)                │
│ ├─ Iteration 7: useCEXPrices   ─┐                           │
│ ├─ Iteration 8: Other hooks    ─┼─→ Iteration 9-12         │
│ ├─ Iteration 13: Main page     ◄─┤                          │
│ └─ Iteration 14: Integration   ◄─┘                          │
│                                                              │
│ PARALLEL TRACK 2: Smart Router (Iterations 15-18)           │
│ ├─ Iteration 15: Algorithm     ─┐                           │
│ ├─ Iteration 16: API           ─┼─→ Iteration 17: Exec     │
│ └─ Iteration 18: UI Integration◄─┘                          │
│                                                              │
│ SEQUENTIAL: Testing & Deployment (Iterations 19-23)         │
│ ├─ Iteration 19-20: Tests ─┐                                │
│ ├─ Iteration 21: Docs  ────┼─→ Iteration 22: Perf ─→ 23    │
│ └─ Integration Tests   ◄────┘                               │
└─────────────────────────────────────────────────────────────┘
```

---

## ⏱️ SUGGESTED DAILY SCHEDULE

### Day 1 (4 iterations)
- Morning: Iterations 1-2 (Database)
- Afternoon: Iterations 3-4 (Auth)

### Day 2 (4 iterations)
- Morning: Iterations 5-6 (Backend complete) + Iteration 7 (Frontend starts)
- Afternoon: Iterations 8-9 (Frontend basics) in parallel

### Day 3 (4 iterations)
- Morning: Iterations 10-12 (More frontend components)
- Afternoon: Iteration 13-14 (Frontend integration)

### Day 4 (4 iterations)
- Morning: Iterations 15-16 (Smart router)
- Afternoon: Iterations 17-18 (Router integration)

### Day 5 (3 iterations + buffer)
- Morning: Iterations 19-20 (Tests)
- Afternoon: Iterations 21-23 (Docs, optimization, deployment)

---

## 🎯 SUCCESS CRITERIA PER ITERATION

Each iteration should have:
- ✅ All tasks completed
- ✅ Code compiles without errors
- ✅ Tests pass (if applicable)
- ✅ TypeScript types correct
- ✅ Code reviewed/self-reviewed
- ✅ Commit to git
- ✅ Documentation updated

---

## 💡 TIPS FOR 4-HOUR SESSIONS

1. **Start Fresh:** Review what was completed in previous iterations
2. **Deep Focus:** No meetings/distractions during 4-hour blocks
3. **Small Commits:** Commit after each subtask (every 30-60 minutes)
4. **Test Often:** Run tests after each feature
5. **Document:** Add comments/TODOs as you go
6. **Time Box:** If something takes >1.5 hours, spike it separately
7. **Breaks:** 5-min break every hour for 4-hour sessions
8. **Review:** End of each iteration, review what was done

---

## 📈 TRACKING PROGRESS

Track completion:
```
Week 1 (Foundation): [████████████████] 100%
  - Iterations 1-6: 24 hours of database, auth, price collection

Week 2 (Frontend): [████████████░░░░] 80%
  - Iterations 7-14: 32 hours of React components
  - Iterations 15-18: 16 hours of smart router

Week 2 (Testing): [░░░░░░░░░░░░░░░░] 0%
  - Iterations 19-23: 20 hours of tests, docs, deployment
```

---

**Ready to start Iteration 1?** 🚀
