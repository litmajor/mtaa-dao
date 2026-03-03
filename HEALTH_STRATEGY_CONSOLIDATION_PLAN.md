# Health Check & Strategy Consolidation Plan

**Date**: February 27, 2026  
**Status**: 🚀 IMPLEMENTATION IN PROGRESS  
**Effort**: 1.5 hours total

---

## Part 1: Health Check Consolidation

### Current State (Scattered)
```
GET /api/health/*                           → health.ts (main)
GET /api/admin/health/*                     → admin/health.ts
GET /api/yuki/health                        → yukiExchangeRoutes.ts
GET /api/treasury/health/:daoId             → treasury.ts
GET /api/morio/health                       → morio.ts
GET /api/dex/health                         → dex.ts
GET /api/propagation/health                 → graph-propagation.ts
```

### Target State (Consolidated)
```
GET /api/health/                            → Basic check (200 OK)
GET /api/health/ready                       → Kubernetes readiness probe
GET /api/health/live                        → Kubernetes liveness probe
GET /api/health/detailed                    → Full diagnostics (auth required)
GET /api/health/metrics                     → Prometheus metrics (auth required)
GET /api/health/metrics/prometheus          → Prometheus format (auth required)
GET /api/health/system                      → System resources (auth required)
GET /api/health/operational                 → Operational status (auth required)
GET /api/health/subsystems                  → All subsystem status (auth required)
  ├─ morio                                  → AI Assistant status
  ├─ dex                                    → DEX service status
  ├─ propagation                            → Graph propagation status
  ├─ treasury                               → Treasury service status
  ├─ exchange (yuki)                        → Exchange caching status
  └─ admin                                  → Admin operations status
```

**Deprecation Timeline**:
- `/api/admin/health/*` → Deprecated (6-month sunset)
- `/api/yuki/health` → Deprecated (6-month sunset)
- `/api/treasury/health/:daoId` → Migrated to `/api/health/subsystems/treasury/:daoId`
- `/api/morio/health` → Migrated to `/api/health/subsystems/morio`
- `/api/dex/health` → Migrated to `/api/health/subsystems/dex`
- `/api/propagation/health` → Migrated to `/api/health/subsystems/propagation`

---

## Part 2: Strategy Domain Consolidation

### Current State (Fragmented)

**Route 1: /api/freqtrade/strategies (Freqtrade Trading Bot)**
```
GET    /api/freqtrade/strategies                    → List strategies
POST   /api/freqtrade/strategies/upload             → Upload strategy
GET    /api/freqtrade/strategies/:strategyId        → Get strategy
POST   /api/freqtrade/strategies/:strategyId/backtest    → Run backtest
POST   /api/freqtrade/strategies/:strategyId/hyperopt    → Run hyperopt
GET    /api/freqtrade/strategies/:strategyId/performance → Get performance
POST   /api/freqtrade/strategies/:strategyId/deploy      → Deploy strategy
```

**Route 2: /api/yuki/strategies (Yuki AI Trading)**
```
POST   /api/yuki/strategies                         → Create strategy
GET    /api/yuki/strategies                         → List strategies
GET    /api/yuki/strategies/:id                     → Get strategy
PUT    /api/yuki/strategies/:id                     → Update strategy
DELETE /api/yuki/strategies/:id                     → Delete strategy
POST   /api/yuki/strategies/:id/deploy              → Deploy strategy
POST   /api/yuki/strategies/:id/backtest            → Backtest strategy
GET    /api/yuki/strategies/:id/signals             → Get trading signals
GET    /api/yuki/marketplace/strategies             → List marketplace strategies
GET    /api/yuki/marketplace/strategies/:id         → Get marketplace strategy
POST   /api/yuki/marketplace/strategies/:id/copy    → Clone marketplace strategy
POST   /api/yuki/marketplace/strategies/publish     → Publish strategy to marketplace
```

**Route 3: /api/strategy (Manual Strategy Management)**
```
POST   /api/strategy                                → Create strategy
GET    /api/strategy                                → List strategies (with filters)
GET    /api/strategy/:strategyId                    → Get strategy details
PUT    /api/strategy/:strategyId                    → Update strategy
DELETE /api/strategy/:strategyId                    → Delete strategy
POST   /api/strategy/:strategyId/rules              → Add rules (NEW from earlier)
```

**Route 4: /api/strategy-deployment (Strategy Lifecycle)**
```
POST   /api/strategy-deployment/:strategyId/backtest     → Run backtest
GET    /api/strategy-deployment/:strategyId/backtest/:statusId → Get backtest results
GET    /api/strategy-deployment/:strategyId               → Get deployment status
```

### Target State (Consolidated)

**All strategy endpoints consolidated under `/api/strategies`**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE CRUD OPERATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST   /api/strategies                      → Create strategy (manual or AI-generated)
GET    /api/strategies                      → List all strategies (with filters)
GET    /api/strategies/:id                  → Get strategy by ID
PUT    /api/strategies/:id                  → Update strategy
DELETE /api/strategies/:id                  → Delete strategy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRATEGY RULES & CONFIGURATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST   /api/strategies/:id/rules            → Add rule to strategy
GET    /api/strategies/:id/rules            → Get rules for strategy
PUT    /api/strategies/:id/rules/:ruleId    → Update rule
DELETE /api/strategies/:id/rules/:ruleId    → Delete rule

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BACKTESTING & OPTIMIZATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST   /api/strategies/:id/backtest         → Run backtest
GET    /api/strategies/:id/backtest/:runId  → Get backtest results
GET    /api/strategies/:id/backtest         → List backtest history

POST   /api/strategies/:id/optimize         → Run hyperparameter optimization
GET    /api/strategies/:id/optimize/:runId  → Get optimization results
GET    /api/strategies/:id/optimize         → List optimization runs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEPLOYMENT & EXECUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST   /api/strategies/:id/deploy           → Deploy strategy (start trading)
GET    /api/strategies/:id/deployment       → Get deployment status
PUT    /api/strategies/:id/deployment       → Update deployment (pause/resume)
DELETE /api/strategies/:id/deployment       → Stop deployment

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERFORMANCE & MONITORING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GET    /api/strategies/:id/performance      → Performance metrics & KPIs
GET    /api/strategies/:id/signals          → Trading signals generated
GET    /api/strategies/:id/trades           → Recent trades executed
GET    /api/strategies/:id/equity-curve     → Equity curve data

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MARKETPLACE & SHARING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST   /api/strategies/:id/marketplace/publish  → Publish to marketplace
GET    /api/strategies/marketplace              → Browse marketplace
GET    /api/strategies/marketplace/:id          → Get marketplace strategy
POST   /api/strategies/marketplace/:id/import   → Import marketplace strategy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NO-CODE STRATEGY BUILDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GET    /api/strategies/builder/templates         → Available templates
POST   /api/strategies/builder                   → Create from template
GET    /api/strategies/builder/:id/preview       → Preview before deploy
```

### Migration Mapping

```
FREQTRADE → STRATEGIES
GET    /api/freqtrade/strategies                   → GET    /api/strategies?source=freqtrade
POST   /api/freqtrade/strategies/upload            → POST   /api/strategies/upload
POST   /api/freqtrade/:id/backtest                 → POST   /api/strategies/:id/backtest
POST   /api/freqtrade/:id/hyperopt                 → POST   /api/strategies/:id/optimize
GET    /api/freqtrade/:id/performance              → GET    /api/strategies/:id/performance
POST   /api/freqtrade/:id/deploy                   → POST   /api/strategies/:id/deploy

YUKI → STRATEGIES
POST   /api/yuki/strategies                        → POST   /api/strategies
GET    /api/yuki/strategies                        → GET    /api/strategies?source=yuki
GET    /api/yuki/strategies/:id                    → GET    /api/strategies/:id
PUT    /api/yuki/strategies/:id                    → PUT    /api/strategies/:id
DELETE /api/yuki/strategies/:id                    → DELETE /api/strategies/:id
POST   /api/yuki/:id/backtest                      → POST   /api/strategies/:id/backtest
GET    /api/yuki/:id/signals                       → GET    /api/strategies/:id/signals
GET    /api/yuki/marketplace/strategies            → GET    /api/strategies/marketplace
POST   /api/yuki/marketplace/:id/copy              → POST   /api/strategies/marketplace/:id/import
POST   /api/yuki/marketplace/publish               → POST   /api/strategies/:id/marketplace/publish

STRATEGY → STRATEGIES
POST   /api/strategy                               → POST   /api/strategies
GET    /api/strategy                               → GET    /api/strategies
GET    /api/strategy/:id                           → GET    /api/strategies/:id
PUT    /api/strategy/:id                           → PUT    /api/strategies/:id
DELETE /api/strategy/:id                           → DELETE /api/strategies/:id
POST   /api/strategy/:id/rules                     → POST   /api/strategies/:id/rules
```

---

## Implementation Phases

### Phase 1: Health Check Consolidation (30 minutes)
- [ ] Update `health.ts` to include all subsystem health checks
- [ ] Add subsystems endpoint with morio, dex, propagation, treasury, exchange status
- [ ] Add deprecation headers to old endpoints
- [ ] Test all health endpoints

### Phase 2: Strategy Consolidation (1 hour)
- [ ] Create unified `strategies.ts` router with all endpoints
- [ ] Migrate freqtrade endpoints with deprecation headers
- [ ] Migrate yuki endpoints with deprecation headers
- [ ] Migrate strategy endpoints with deprecation headers
- [ ] Add query parameters for filtering by source (freqtrade, yuki, manual)
- [ ] Test all migrated endpoints

### Phase 3: Validation & Deprecation (15 minutes)
- [ ] Add RFC 8594 deprecation headers to old routes
- [ ] Create migration guide for API consumers
- [ ] Document new endpoint structure

---

## Benefits

✅ **Simplified API**: Single entry point for all health and strategy operations  
✅ **Better Discovery**: Clients can find related endpoints more easily  
✅ **Consistency**: Unified request/response formats across similar operations  
✅ **Maintainability**: Easier to audit and update endpoint logic  
✅ **Scalability**: Cleaner code structure for future enhancements

---

## Timeline

- **Phase 1**: ~30 min (Health consolidation)
- **Phase 2**: ~60 min (Strategy consolidation)
- **Phase 3**: ~15 min (Validation & sunset headers)
- **Total**: ~1.75 hours
