# STRUCTURAL AUDIT: MTAA-DAO Production Codebase
**Deterministic analysis only. No speculation. No narrative assumptions.**
**Analysis Date: February 19, 2026**

---

## 1. ARCHITECTURAL LAYERS (Top-Down Stack)

```
┌─────────────────────────────────────────────────────────┐
│ UI/CLIENT LAYER                                         │
│ - Vite SPA (TypeScript/React implicit)                  │
│ - WebSocket clients                                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ API/ROUTING LAYER (100+ route files)                    │
│ - HTTP endpoints (express Router)                        │
│ - WebSocket upgrade paths (express-ws)                   │
│ - SSE streams                                            │
├─────────────────────────────────────────────────────────┤
│ PRIMARY ROUTES (19):                                     │
│ • auth (JWT/refresh/OAuth)                              │
│ • wallet (generation, setup, sessions)                   │
│ • vaults (deposits, withdrawals, strategies)             │
│ • governance (voting, proposals, quorum)                 │
│ • tasks (creation, verification, claims)                │
│ • dao (creation, treasury, invitations)                  │
│ • payments (gateway, reconciliation, webhooks)           │
│ • market-data (monitoring, analytics, smartRouter)       │
│ • exchanges (cex prices, orders)                         │
│ • cross-chain (bridges, sync, swaps)                     │
│ • proposals (execution, engagement)                      │
│ • reputation (leaderboards, achievements)                │
│ • notifications (user, system, events)                   │
│ • admin (users, metrics, settings)                       │
│ • investment-pools (governance, pricing)                 │
│ • referral-rewards (earnings, distribution)              │
│ • pool-governance (weighted voting)                      │
│ • kyc (verification)                                     │
│ • subscription-management (tiers, features)              │
│
│ MARKET DATA ROUTES (NEW - Priority 4):                   │
│ • priority4 - WebSocket realtime + Futures + Microstructure
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ MIDDLEWARE LAYER                                        │
├─────────────────────────────────────────────────────────┤
│ Authentication:                                         │
│ • authenticate (JWT bearer token validation)             │
│ • isAuthenticated (NextAuth-based)                       │
│ • rate limiting (general, OTP, refresh)                  │
│                                                          │
│ Security:                                               │
│ • sanitizeInput (XSS prevention)                         │
│ • preventSqlInjection (parameterization)                │
│ • preventXSS (output encoding)                           │
│ • auditMiddleware (operation logging)                    │
│ • helmet (security headers)                              │
│ • CORS (cross-origin control)                           │
│ • compression (gzip)                                     │
│                                                          │
│ Observation:                                            │
│ • requestLogger (HTTP logging)                           │
│ • errorHandler (centralized error handling)              │
│ • asyncHandler (promise rejection wrapping)              │
│ • activityTracker (user action recording)               │
│ • performanceMonitor (latency tracking)                 │
│ • metricsCollector (system metrics)                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ CORE BUSINESS SERVICE LAYER (100+ services)             │
├─────────────────────────────────────────────────────────┤
│ IDENTITY & ACCESS PRIMITIVES (8 services):              │
│ • authentication (JWT, refresh token, OAuth)            │
│ • sessionService (user sessions)                        │
│ • otpService (2FA/OTP)                                  │
│ • kycService (KYC verification)                         │
│ • twoFAService (two-factor auth)                        │
│ • passwordReset (password recovery)                     │
│ • wallet-session-service (wallet session mgmt)          │
│ • pin-service (PIN protection)                          │
│
│ CAPITAL PRIMITIVES (15 services):                       │
│ • vaultService (vault lifecycle)                        │
│ • vaultAutomation (automated actions)                   │
│ • vaultEventsIndexer (vault event tracking)             │
│ • vaultExecutionService (vault operations)              │
│ • wallet-service (wallet operations)                    │
│ • wallet-generation-service (wallet creation)           │
│ • transfer-service (transfers)                          │
│ • transaction-service (transaction handling)            │
│ • withdrawalRouter (withdrawal routing)                 │
│ • withdrawalExecutor (withdrawal execution)             │
│ • withdrawal-signing-service (withdrawal signing)       │
│ • micro-withdrawal-service (small withdrawals)          │
│ • recurringPaymentService (recurring payments)          │
│ • deposit-service (deposits)                            │
│ • escrowService (escrow management)                     │
│
│ PAYMENT PRIMITIVES (12 services):                       │
│ • paymentGatewayService (payment processing)            │
│ • paymentExecutionService (execution)                   │
│ • paymentRecoveryWorkflowService (failure recovery)     │
│ • PaymentRecoverySAGAOrchestrator (distributed tx)      │
│ • paymentErrorHandler (error handling)                  │
│ • paymentErrorAnalyticsService (analytics)              │
│ • transaction-webhook-service (webhook mgmt)           │
│ • transactionMonitor (transaction tracking)             │
│ • transactionLimit Service (rate limits)               │
│ • kotanipayService (Kotani integration)                │
│ • feeCalculator (fee computation)                       │
│ • exchangeFeeService (exchange fees)                    │
│
│ GOVERNANCE PRIMITIVES (8 services):                     │
│ • ProposalExecutionService (governance)                 │
│ • governance-service (voting logic)                     │
│ • poolGovernanceService (pool voting)                   │
│ • crossChainGovernanceService (multi-chain voting)      │
│ • treasuryMultisigService (multi-sig treasury)          │
│ • reputationService (reputation tracking)               │
│ • achievementSystemService (achievement logic)          │
│ • agentStatusService (agent-based actions)              │
│
│ MARKETPLACE & EXCHANGE PRIMITIVES (15 services):        │
│ • ccxtService (14 exchanges via CCXT)                   │
│ • smartRouter (best execution routing)                  │
│ • orderRouter (order routing)                           │
│ • cexOrderManager (CEX order management)                │
│ • cexOrderExecutor (CEX execution)                      │
│ • cexPriceCollector (CEX price data)                    │
│ • cexPriceCache (price caching)                         │
│ • exchangeDataCacheService (exchange data cache)        │
│ • priceOracle (on-chain prices)                        │
│ • gasPriceOracle (gas price tracking)                   │
│ • dexIntegrationService (DEX integration)               │
│ • arbitrageDetector / arbitrageDetection (arb ops)     │
│ • liquidityOptimizer (liquidity improvement)            │
│ • nftMarketplaceRouter (NFT trading)                    │
│ • orderBookAnalyzer (order book parsing)               │
│
│ BRIDGE & CROSS-CHAIN PRIMITIVES (8 services):          │
│ • bridgeRelayerService (bridge relaying)               │
│ • bridgeIntegration (bridge abstraction)                │
│ • bridgeProtocolService (bridge protocols)              │
│ • bridgeMonitoringService (bridge monitoring)           │
│ • bridgeStatusPoller (bridge status tracking)           │
│ • crossChainService (cross-chain ops)                   │
│ • crossChainSyncService (multi-chain sync)              │
│ • multiChainProvider (multi-chain RPC)                  │
│
│ BLOCKCHAIN-SPECIFIC PRIMITIVES (6 services):           │
│ • solanaIntegrationService (Solana)                    │
│ • solanaTransactionSigningService (Solana TX signing)  │
│ • tronIntegrationService (Tron)                        │
│ • tronTransactionSigningService (Tron TX signing)      │
│ • blockchain-withdrawal-service (withdrawal abstraction)|
│ • keyManagementService (key storage/rotation)           │
│
│ MARKET DATA & ANALYTICS (8 services):                   │
│ • volatilityMetricsService (4-window volatility)        │
│ • marketAnalyticsService (spread/depth/liquidity)       │
│ • smartRetryLogicService (exponential backoff)          │
│ • technicalIndicators (TA indicators)                   │
│ • fearGreedIndex (market sentiment)                     │
│ • historicalData (price history)                        │
│ • indicators (various analytics)                        │
│ • treasuryIntelligenceService (DAO treasury analytics)  │
│
│ NEW PRIORITY 4 SERVICES (3 services):                   │
│ • websocketRealTimeFeeds (real-time stream + client mgmt)
│ • futuresMarketSupport (funding, liquidation, OI)      │
│ • advancedMicrostructureIndicators (order flow, toxicity, vol-of-vol)
│
│ AUTOMATION & SCHEDULING (4 services):                   │
│ • JobMonitoringService (job health)                     │
│ • ScheduledAggregationJobs (metric aggregation)         │
│ • setupWeeklyRewardsDistribution (job)                  │
│ • setupInvestmentPoolsAutomation (job)                  │
│
│ NOTIFICATION PRIMITIVES (3 services):                   │
│ • notificationService (notification dispatch)           │
│ • userNotificationService (user-specific)               │
│ • UserNotificationService (alternative impl)            │
│
│ AI/PREMIUM SERVICES (3 agents):                         │
│ • eldScry (predictive analytics)                        │
│ • eldKaizen (optimization)                              │
│ • eldLumen (explanation engine)                         │
│ • eldCoordinator (agent coordination)                   │
│ • gatewayAgent (unified marketplace interface)          │
│ • morio (AI assistant/data hub)                         │
│ • opportunityEngine (opportunity detection)             │
│
│ UTILITY & INFRASTRUCTURE (20+ services):               │
│ • cacheService (Redis cache + fallback)                │
│ • tokenService (token metadata)                        │
│ • tokenRegistry (token listing)                        │
│ • emergencyStopService (killswitch)                    │
│ • backupSystem / BackupScheduler (backups)             │
│ • softDeleteService (soft deletes)                     │
│ • reversibilityService (transaction reversals)         │
│ • subscriptionService (subscriptions)                  │
│ • featureService (feature flagging)                    │
│ • constraintChecker (constraint validation)            │
│ • schemaValidator (data validation)                    │
│ • assetDiscovery (asset detection)                     │
│ • assetNormalization (asset normalization)             │
│ • assetIntelligence (asset analytics)                  │
│ • liquidityScoring (liquidity metrics)                 │
│ • serviceAccountManager (service accounts)             │
│ • gatingService (feature gating)                       │
│ • dalService / Activity tracking                       │
│ • metricsCacheService (metrics caching)                │
│ • navUpdateService (NAV updates)                       │
│
│ SIMULATION SERVICES (tier-3) (15+ services):           │
│ • VaultDepositSimulator                                │
│ • VaultWithdrawalSimulator                             │
│ • VaultLiquidationSimulator                            │
│ • VaultStrategySimulator                               │
│ • NFTMintingSimulator                                  │
│ • NFTMarketplaceListingSimulator                       │
│ • NFTPurchaseSimulator                                 │
│ • SpotTradeSimulator                                   │
│ • MarginTradeSimulator                                 │
│ • PerpetualsFuturesSimulator                           │
│ • DexSwapSimulator                                     │
│ • FlashLoanSimulator                                   │
│ • ReferralGenerationSimulator                          │
│ • ReferralRewardsSimulator                             │
│ • MicroWithdrawalSimulator                             │
│
│ DATA INDEXERS/AGGREGATORS (3 services):               │
│ • vaultEventsIndexer (vault events)                    │
│ • ContributionIndexerService (contributions)           │
│ • opportunityStream (opportunity stream)               │
│
│ SYNCHRONIZATION (2 services):                          │
│ • crossChainSyncService (multi-chain sync)             │
│ • bridgeStatusPoller (bridge status sync)              │
│
│ MONITORING & AUDITING (6 services):                    │
│ • auditLogger / auditLogging / auditLoggingService    │
│ • adminAuditLogger (admin actions)                     │
│ • metricsCollector (system metrics)                    │
│ • performanceTrackingService (perf metrics)            │
│ • transactionMonitor (tx tracking)                     │
│ • jobMonitoringService (job health)                    │
│
│ INTEGRATION SERVICES (5 services):                      │
│ • telegramBotRoutes (Telegram bot)                     │
│ • telegramIntegrationRoutes (Telegram messaging)       │
│ • whatsappIntegrationRoutes (WhatsApp)                 │
│ • morioDataHubRoutes (data hub)                        │
│ • morioElderInsightsRoutes (insights)                  │
│
│ ANTI-ABUSE & COMPLIANCE (3 services):                  │
│ • daoAbusePreventionService (abuse detection)          │
│ • proposalRiskAnalyzer (proposal risk)                 │
│ • agentCircuitBreaker (resilience)                     │
│
│ BUSINESS LOGIC AGGREGATORS (5 services):               │
│ • economyService (economy logic)                       │
│ • dashboardService (dashboard data)                    │
│ • financialAnalyticsService (financial analysis)       │
│ • enhancedFeatureService (feature service)             │
│ • personaService (user personas)                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ DATA / PERSISTENCE LAYER                                │
├─────────────────────────────────────────────────────────┤
│ • PostgreSQL (primary via Drizzle ORM)                   │
│ • Redis (distributed cache + fallback in-memory)        │
│ • Session storage (implicit)                            │
│ • WebSocket connection state (in-memory)               │
│ • File storage (implicit)                               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ EXTERNAL INTEGRATIONS                                   │
├─────────────────────────────────────────────────────────┤
│ • CCXT (14 CEX exchanges)                               │
│ • Stripe (payment processing)                           │
│ • Kotani Pay (mobile payments)                          │
│ • M-Pesa (mobile money)                                 │
│ • Smart Contract ABIs (14 on-chain interactions)        │
│ • Ethers.js (blockchain signing/reading)               │
│ • Telegram Bot API                                      │
│ • WhatsApp Business API                                 │
│ • OAuth2 providers (Google, etc)                        │
│ • Bridge protocols (TBD - abstracted)                   │
└─────────────────────────────────────────────────────────┘
```

---

## 2. COMPONENT CLASSIFICATION MATRIX

### CORE INVARIANTS (Cannot change without breaking identity)

| Component | Category | Reason | Breaking Impact |
|-----------|----------|--------|-----------------|
| JWT auth system (generateTokens, verifyAccessToken) | Identity | All requests authorized via JWT | All API calls fail |
| User table (users.ts schema) | Identity | Every user has identity primitives | Entire system fails |
| DAO table (daos.ts schema) | Governance | Every DAO is identified by UUID | DAO system collapses |
| Vault table (vaults.ts schema) | Capital | Core capital storage primitive | All vaults inaccessible |
| VaultService.deposit/withdraw | Capital | Protocol guarantees capital safety | Deposits/withdrawals fail |
| ProposalExecutionService | Governance | Governance execution guarantee | Voting becomes signaling |
| ccxtService (exchange interfaces) | Market | Price/order primitives | Trading halts |
| PaymentGatewayService | Capital | Payment execution protocol | Payments fail |
| Blockchain signing (ethers.js) | Capital | Immutability guarantee | On-chain safety violated |
| Smart contract ABIs | Authorization | Contract method authorization | Blockchain operations fail |

### CONFIGURABLE MODULES (Can change with constraints)

| Component | Constraints | Migration Path |
|-----------|-------------|-----------------|
| Cache layer (Redis vs in-memory) | Must maintain cache interface | Swap implementation in cacheService.initialize() |
| Exchange routing (smartRouter) | Must return ApiResponse<ExecutionResult> | Replace routing algorithm, keep signature |
| Price oracles (priceOracle, gasPriceOracle) | Must return consistent numeric format | Update oracle provider, keep contract |
| Notification channels (email, SMS, Telegram, WhatsApp) | NotificationService.dispatch() contract | Add new channel, keep dispatcher interface |
| KYC providers (kycService) | Must return KYC status enum | Swap KYC provider, keep response type |
| Wallet providers (Solana, Tron, etc) | Must return signed transaction | Add blockchain, keep signing interface |
| Fee structures (feeCalculator) | Must return fee in consistent format | Update formula, keep return type |
| Vault strategies (YIELD_STRATEGIES) | Must calculate APY consistently | Add strategy, standard interface |
| Governance quorums (governance_quorum).ts | Must return boolean for authorization | Update formula, keep signature |
| Rate limiting (rateLimiter) | Must track requests per identity | Update algorithm, keep interface |

### EXTENSIONS/ADD-ONS (Can be removed/replaced without breaking core)

| Component | Purpose | Dependency | Removal Impact |
|-----------|---------|-----------|-----------------|
| Telegram Bot | User notification channel | Optional | Users lose Telegram alerts |
| WhatsApp Integration | User notification channel | Optional | Users lose WhatsApp alerts |
| Morio AI | Premium intelligence | Optional | Users lose AI assistant |
| Elder systems | AI agents (Scry, Kaizen, Lumen) | Optional | Users lose predictive analytics |
| NFT Marketplace | NFT trading platform | Optional | NFT market halts |
| Pool Governance | Weighted voting for pools | Optional | Pool voting unavailable |
| Simulator services (tier-3) | Testing/simulation framework | Testing only | Testing harness lost |
| Advanced analytics (fearGreedIndex, technicalIndicators) | Premium market data | Optional | Users lose advanced indicators |
| Bridge services | Cross-chain transfers | Optional | Bridging halts |
| Cross-chain governance | Multi-chain voting | Optional | Multi-chain voting unavailable |

---

## 3. DATA FLOW MAPPING (Actor → Component → State Change → External)

### FLOW 1: User Authentication → Capital Access

```
USER                          SYSTEM                              EXTERNAL
  |                              |                                    |
  +---(login creds)------------>  authenticate                       |
  |                              +---(hash verify)----->bcrypt      |
  |                              |<-----(match/fail)----+            |
  |                              +---(generateTokens)----->JWT signer |
  |                              |<------(access/refresh)--+         |
  |<-----(tokens)----------+     |                                    |
  |                        update sessions table                     |
  |                        user.id = {sub: userId}                  |
  |                                                                  |
  +---(API call + Bearer token)--> isAuthenticated middleware       |
  |                                 +---(verify JWT)--->JWT verifier |
  |                                 |<------(valid)---+              |
  |                                 req.user.id attached             |
  |                                 next()                           |
  |<-----(protected route response)--+                              |
```

**State Changes:**
- `sessions` table: INSERT(userId, token, expiresAt)
- `users` table: UPDATE(lastLogin)

**External Dependencies:**
- bcryptjs (password verification)
- jsonwebtoken (JWT signing/verification)

---

### FLOW 2: User Deposit → Vault Capital → Blockchain Settlement

```
USER                          VAULTSERVICE                  BLOCKCHAIN          CACHE
  |                              |                              |               |
  +---(depositRequest)-------->  validateDeposit()            |               |
  |                              +---(balance check)-------> getBalance      |
  |                              |<-------(sufficient)-----+                |
  |                              updateVault()               |               |
  |                              +---(INSERT to vaults)---> PostgreSQL     |
  |                              |<-------(success)-------+                |
  |                              signWithdrawal()                          |
  |                              +---(sign TX)-----+ethers.js              |
  |                              |<------(signed)--+                       |
  |                              +---(broadcast)-------->smartContract  |
  |                              |<------(txHash)----------+                |
  |                              recordTransaction()                       |
  |                              +---(INSERT to vaultTx)-->PostgreSQL     |
  |                              |<------(success)-------+                |
  |                              invalidateCache()                        |
  |                              |<------(delete key)----->Redis/memory   |
  |<-----(deposit confirmed)--+  |                              |               |
```

**State Mutations:**
- `vaults` table: UPDATE(balance)
- `vaultTokenHoldings` table: INSERT(tokenSymbol, amount)
- `vaultTransactions` table: INSERT(type, amount, txHash, status)
- Redis cache: DELETE(vaultBalance:{vaultId}, vaultPortfolio:{vaultId})

**External Dependencies:**
- ethers.js (blockchain signing)
- smart contract ABIs
- PostgreSQL (atomicity required)
- Redis (cache invalidation)

---

### FLOW 3: Governance Proposal → Voting → Execution → DAO Treasury Impact

```
PROPOSER                      SYSTEM                      DAO TREASURY            BLOCKCHAIN
  |                              |                              |                    |
  +---(propose)------------->  createProposal()              |                    |
  |                              +---(validate)               |                    |
  |                              +---(INSERT to proposals)-->PostgreSQL          |
  |                              |<----(proposalId)-----+                        |
  |                                                                              |
  +---(vote)-------------------> recordVote()              |                    |
  |                              +---(INSERT to votes)--->PostgreSQL          |
  |<------(vote confirmed)----+   |                          |                    |
  |                              checkQuorum()              |                    |
  |                              =GOVERN_QUORUM_THRESHOLD?  |                    |
  |                                 YES → executeProposal()  |                    |
  |                                      +---(calculate impact)                   |
  |                                      +---(sign TX)---+ethers.js             |
  |                                      |              +smartContract      |
  |                                      |<----------+(treasury transfer)        |
  |                                      recordExecution()                       |
  |                                      +--(INSERT exec log)-->PostgreSQL     |
  |                                      updateDAOTreasury()                    |
  |                                      +--UPDATE(balance)-->PostgreSQL       |
```

**State Mutations:**
- `proposals` table: INSERT(proposalData)
- `votes` table: INSERT(userId, proposalId, voteChoice)
- `proposal_executions` table: INSERT(executionLog)
- `daoTreasuryCredits` table: UPDATE(balance) — multi-record for distribution
- Smart contract state: Treasury balance updated on-chain

**External Dependencies:**
- PostgreSQL (atomicity)
- ethers.js (signing)
- Smart contract ABIs
- Quorum calculation (governance-quorum.ts)

---

### FLOW 4: Market Data Collection → Execution → Risk Monitoring

```
CEX SOURCES                   MARKET DATA LAYER              STORAGE               USER
  |                              |                              |                  |
  +---(price ticks 1s)------>  cexPriceCollector             |                  |
  |                              +---(normalize)               |                  |
  |                              +---(UPSERT)----->PostgreSQL               |
  |                              cachePrice()                |                  |
  |                              +---(SET)----+Redis/memory               |
  |                              |            +---(TTL=5min) |                  |
  |                              smartRouter()               |                  |
  |                              +---(select best exchange)   |                  |
  |                              +---(calculate slippage)--> executionTracking |
  |                              +---(execute order)          |                  |
  |                              |                 +----->CEX ORDER API        |
  |                              recordExecution()           |                  |
  |                              +---(INSERT)+-> PostgreSQL |                  |
  |                                              calculateRisk()               |
  |                                              +---(vol check)+->volatility |
  |                                              +---(depth check)------------>|
  |<-----(execution status + alerts)--+          |                            |
```

**State Mutations:**
- `cexPrices` table (implicit): UPSERT(exchange, symbol, price, timestamp)
- `executionRecords` table: INSERT(orderId, exchangeId, amount, slippage%, status)
- Redis: SET(price:{symbol}:{exchange}, {value, timestamp})
- Event stream: PUBLISH(execution.alert)

**External Dependencies:**
- CCXT (CEX APIs: 14 exchanges)
- Redis (cache)
- PostgreSQL (history)
- volatilityMetricsService (risk calculation)
- executionTrackingService (slippage calculation)

---

### FLOW 5: WebSocket Real-Time Streaming (NEW - Priority 4)

```
CLIENT 1                  CLIENT 2                    WEBSOCKET SERVICE
  |                          |                             |
  +---(ws connect)---+        |                             |
  |                  +------->websocketRealTimeFeeds    |
  |                           addClient(clientId, ws)    |
  |                           clientId registered        |
  |<-------(connect ack)---+   |                          |
  |                        |   +---(ws connect)-----+     |
  |                        |                        +--->addClient()
  |                        |                             |
  +---(subscribe price)----->subscribeClient()          |
  |                        |     subscribe:'{symbol,price}'
  |                        |     filters:{minVol, maxVol}|
  |                        |   clientsMap.set(...)      |
  |                        |                           |
  |   (1s price update triggered)                       |
  |                        |<----(broadcast update)-----+
  |                        | {symbol,price,bid,ask}     |
  |<-----(PRICE_UPDATE)---+     applyFilters(client1)  |
  |                        |                             |
  |                        |<---(PRICE_UPDATE if pass)--+
  |                        |     (filtered out if no filter match)
  |                        |                             |
  +---(unsubscribe)------->unsubscribeClient()          |
  |                        |     remove feed entry      |
  |                        |                             |
  +---(ws disconnect)------>cleanupClient()             |
  |                        |     ws.close()             |
  |                        |     delete clientId        |
  |<-------(close)--------+     resources freed         |
```

**State Mutations:**
- In-memory: `clientsMap`: INSERT client connection + subscriptions + filters
- In-memory: `subscriptionStats`: Maintain per-symbol subscription count
- WebSocket frames: Sent to all (or filtered) clients
- Event emission: Internal EventEmitter triggers broadcasts

**External Dependencies:**
- WebSocket (express-ws/ws module)
- Internal feed generators (price stream: 1s, volatility stream: 5s, health stream: 10s)
- Subscription filtering (apply per-client rules)

---

### FLOW 6: Futures Liquidation Cascade Detection (NEW - Priority 4)

```
LIQUIDATION SOURCE            FUTURES SERVICE                  ALERT SYSTEM
  |                              |                              |
  +---(liquidation event)------> getLiquidationData()          |
  |                              +---(query API/DB)-+LiqDB   |
  |                              |<---(24h window)--+         |
  |                              detectCascade()              |
  |                              +---(5+ liq in 10m window)   |
  |                              |    = CASCADE DETECTED       |
  |                              assessRisk()                 |
  |                              +---(currentPrice,entry)-+   |
  |                              |    liquidationPrice = ?|   |
  |                              |    distance% = calc()     |
  |                              |    riskLevel = CRITICAL    |
  |<-----(risk alert)----------+ |                            |
  |                              sendAlert()                  |
  |                              +------(broadcast)---+WebSocket
  |                              |                    +Email/SMS
  |                              updateHealthScore() |
  |                              +---(INSERT score)-->PostgreSQL|
  |                              |                              |
```

**State Mutations:**
- `liquidationData` (implicit): UPSERT(symbol, cascadeDetected, severity, timestamp)
- `liquidationRisks` (implicit): INSERT(symbol, positionId, riskLevel, liquidationPrice)
- `futuresHealthScores` (implicit): UPSERT(symbol, healthScore, timestamp)
- Alert system: PUBLISH(liquidation.alert)

**External Dependencies:**
- Liquidation data source (historical API)
- Position tracking (open positions DB)
- Price oracle (current price)
- Alert dispatcher (email, SMS, WebSocket)

---

### FLOW 7: Order Book Toxicity Detection via Microstructure (NEW - Priority 4)

```
ORDER BOOK DATA               MICROSTRUCTURE SERVICE         ALERTS
  |                              |                              |
  +---(bid/ask spread)-------->detectOrderBookToxicity()    |
  |                              +---(calculate spread%)       |
  |                              +---(adverse selection idx)   |
  |                              |    = spread / (mid * 0.0001)|
  |                              |    → 0-100 scale           |
  |                              +---(inventory risk)          |
  |                              |    depth_imbalance = ?     |
  |                              +---(info asymmetry)          |
  |                              |    recent_trade_side = ?   |
  |                              |    → combine metrics        |
  |                              |    toxicity in [0-100]     |
  |                              generateAlert()              |
  |                              IF toxicity > 70:           |
  |                              CREATE AdvancedMicrostructureAlert
  |<-----(TOXICITY_ALERT)------+   severity = HIGH            |
  |                              |   recommendation = REDUCE_SIZE
  |                              broadcastAlert()             |
  |                              +------(to WebSocket)---+    |
  |                              +------(to email)-------+    |
  |                                                          |
```

**State Mutations:**
- `microstructureMetrics` (implicit): INSERT(symbol, toxicity, imbalance, volOfVol, timestamp)
- `microstructureAlerts` (implicit): INSERT(type, severity, symbol, message)
- Event stream: PUBLISH(microstructure.alert)

**External Dependencies:**
- Order book source (CEX APIs or WebSocket)
- Trade history (recent trades for info asymmetry)
- Statistical calculations (skew, kurtosis for vol-of-vol)

---

## 4. CONTROL FLOW MAPPING (Who Triggers What / Governance Boundaries)

### CONTROL FLOW 1: API → Middleware Chain → Handler → Service → Persistence

```
HTTP REQUEST
  ↓
express Router (routes/*.ts)
  ↓
[Rate Limit Middleware] ← generalRateLimiter | otpVerifyRateLimiter | etc
  ↓
[Authentication Middleware] ← isAuthenticated | authenticate
  ↓
[Security Middleware] ← sanitizeInput | preventSqlInjection | preventXSS
  ↓
[Audit Middleware] ← auditMiddleware → auditLogger.log()
  ↓
Route Handler (async (req, res) => {...})
  ↓
Call Service Method
  ↓
Service.method() performs business logic
  ↓
[State Mutation Point]
  - PostgreSQL: INSERT/UPDATE/DELETE (via Drizzle ORM)
  - Redis: SET/DEL/INCR (via cacheService)
  - Email/SMS/Webhook: Async dispatch (via notificationService)
  - Blockchain: Sign → Broadcast (via ethers.js)
  ↓
Compose ApiResponse<T>
  ↓
res.json(response)
  ↓
[Error Handler Middleware] ← errorHandler (catches unhandled errors)
  ↓
HTTP RESPONSE TO CLIENT
```

**Control Points (Governance Boundaries):**
1. **Authentication Check**: Who is executing? (`req.user.id`)
2. **Authorization Check**: Can they execute? (checked in service methods via DAO membership, vault ownership, etc)
3. **Resource Ownership**: Do they own the resource? (checked in service layer)
4. **Rate Limiting**: Too many requests? (checked in middleware)
5. **Data Validation**: Valid input? (checked in middleware + service layer via Zod schemas)

---

### CONTROL FLOW 2: Scheduled Jobs → Automation (Who Triggers Automation)

```
CRON / System Timer
  ↓
setupWeeklyRewardsDistribution (runs weekly)
  ├─→ calculateRewards()
  ├─→ distributeRewards()
  ├─→ recordDistribution()
  └─→ notificationService.dispatch()

setupInvestmentPoolsAutomation (runs on interval)
  ├─→ rebalanceAllPools()
  ├─→ calculateYields()
  ├─→ updateNAV()
  └─→ recordAggregation()

cexPriceBackgroundJob (runs continuously)
  ├─→ cexPriceCollector.fetchExchangePrices()
  ├─→ normalizeAndCache()
  ├─→ detectArbitrage()
  └─→ alertOpportunities()

vaultAutomationService (event-driven + polling)
  ├─→ Check vault strategies
  ├─→ Trigger rebalancing if thresholds met
  ├─→ Record automated actions
  └─→ Notify vault owner
```

**WHO TRIGGERS AUTOMATION:**
- **Nobody (automatic)**: These run on system schedule
- **What requires governance?**: Portfolio rebalancing triggers governance proposal (if > threshold)
- **What is automated without governance?**: Weekly rewards, NAV updates, price collection
- **Audit trail?**: All via auditLogger / auditService

---

### CONTROL FLOW 3: Governance Proposal Execution (Governance Boundary)

```
PROPOSER creates proposal
  ↓
  Proposal stored (INSERT proposals table)
  ↓
VOTERS vote (via voting middleware)
  ↓
  Votes recorded (INSERT votes table)
  ↓
[GOVERNANCE CHECKPOINT]
  ↓
ProposalExecutionService.execute()
  ├─→ checkQuorum() [Must pass: GOVERN_QUORUM_THRESHOLD]
  ├─→ calculateOutcome()
  ├─→ validateExecution()
  ├─→ signMessage() [via ethers.js]
  ├─→ broadcastExecute()
  ├─→ recordExecution()
  └─→ updateDaoState()
```

**Governance Boundaries (Cannot Execute Without Approval):**
- Treasury transfers > threshold
- Protocol parameter changes
- Permission grants
- Cross-chain governance

**Automated Execution (No Governance Required):**
- Weekly reward distribution
- NAV updates
- Price updates
- Vault rebalancing (within predefined parameters)

---

### CONTROL FLOW 4: WebSocket Subscription Management (NEW - Priority 4)

```
CLIENT connects websocket
  ↓
websocketRealTimeFeeds.addClient(clientId, ws)
  ├─→ Store WebSocket connection object
  ├─→ Initialize empty subscriptions map
  └─→ Initialize default filters
  ↓
CLIENT sends subscribe message
  ↓
websocketRealTimeFeeds.subscribeClient(clientId, {symbol, feeds})
  ├─→ Add symbol to client's subscriptions
  ├─→ Start internal feed if not running
  ├─→ Apply client filters
  └─→ Return subscription confirmation
  ↓
[BROADCAST LOOP - triggered by internal timers]
  ├─→ 1s: Price updates (startPriceStream)
  ├─→ 5s: Volatility updates (startVolatilityStream)
  ├─→ 10s: Health updates (startHealthStream)
  ↓
For each update:
  ├─→ Get all subscribers for symbol
  ├─→ Apply per-client filters
  ├─→ Broadcast to matching clients
  ├─→ Update subscription stats
  └─→ Log metrics
  ↓
CLIENT sends unsubscribe message
  ↓
websocketRealTimeFeeds.unsubscribeClient(clientId, feeds)
  ├─→ Remove feeds from subscription
  ├─→ Stop feed if no more subscribers
  └─→ Clean up state
  ↓
CLIENT disconnects
  ↓
websocketRealTimeFeeds.handleDisconnect()
  ├─→ Clean up all client state
  ├─→ Close WebSocket connection
  └─→ Update connection stats
```

**Control Points:**
- Who can subscribe? (any connected client)
- Who gets data? (subscribed clients matching filters)
- What filters apply? (per-client application)
- When is broadcast triggered? (on fixed schedule, not on-demand)

---

## 5. COUPLING ANALYSIS (Tight, Implicit, Hidden Shared State)

### TIGHT COUPLING (Hard Dependencies - Difficult to Change)

| Component A | Component B | Reason | Impact |
|-------------|-----------|--------|--------|
| VaultService | PostgreSQL schema (vaults table) | Direct table references | Schema change → code break |
| vaultService.deposit() | ethers.js | Hardcoded signing | Change blockchain lib → rewrite |
| smartRouter | ccxtService | Direct function calls | Change exchange API → router fails |
| PaymentGatewayService | Stripe / Kotani / M-Pesa | API-hardcoded | Change payment provider → gateway fails |
| ProposalExecutionService | governanceService | Direct voting lookup | Change governance rules → execution fails |
| WebSocketService | express-ws module | Hardcoded WebSocket handler | Change WS lib → disconnects |
| audit logs | PostgreSQL | Direct table writes | DB unavailable → audit stops |
| authentication | JWT | Hardcoded JWT strategy | Change auth method → all requests fail |
| notifications | Stripe/Telegram/Email SDKs | Direct API calls | Remove Telegram → no alerts |

**BREAKING CHANGE RISK: HIGH**

### IMPLICIT DEPENDENCIES (Hidden Service Dependencies)

| Dependent | Depends On | How Implicit | Smell |
|-----------|-----------|-------------|-------|
| smartRouter | cacheService | Caches are called internally | No explicit param |
| vaultService.deposit | executionTrackingService | Indirectly calls for slippage | Magic call |
| ProposalExecutionService | notificationService | Broadcasts events async | Fire-and-forget |
| cexPriceCollector | volatilityMetricsService | Calls vol calc in loop | Circular potential |
| paymentGateway | UserNotificationService | Notifies user after payment | Async side-effect |
| vaultAutomation | ProposalExecutionService | May trigger governance | Implicit trigger |

**COUPLING RISK: MEDIUM**

### HIDDEN SHARED STATE (Implicit State Sharing)

| Shared State | Location | Readers | Writers | Concurrency Risk |
|-------------|----------|---------|---------|------------------|
| Vault balances | postgres: vaults.balance | vaultService, volatilityMetrics, treasury-intel | deposit, withdraw, rebalance | Race condition if 2 deposits same vault |
| Cached prices | Redis: price:{symbol}:{exchange} | smartRouter, volatility, analytics | cexPriceCollector, priceOracle | Stale data if collection fails |
| DAO treasury balance | postgres: daoTreasuryCredits | treasury-intel, proposals, distributions | governance execution, rewards | Off-by-1 if concurrent proposals |
| User sessions | postgres: sessions | auth middleware, refreshToken | login, logout, generateTokens | Session hijacking if not locked |
| Active WebSocket clients | Memory: clientsMap | broadcast loop, stats endpoint | addClient, removeClient | Memory leak if cleanup fails |
| Liquidation cascade state | Memory: liquidationHistory | detection, alerts | price update loop | Missed cascade if state lost |

**CONCURRENCY RISK: HIGH** (No explicit locking observed)

---

## 6. ARCHITECTURAL GAPS & VIOLATIONS

### MISSING ABSTRACTIONS

| Layer | Gap | Impact | Severity |
|-------|-----|--------|----------|
| Data Access | No Repository Pattern for DAOs | Hard to test governance logic | MEDIUM |
| Service | No Service Interface contracts | Services tightly coupled to implementation | MEDIUM |
| Error Handling | No typed error domain (only AppError) | Error recovery logic is fragmented | LOW |
| Caching | Cache abstraction exists but not used consistently | Some services bypass cache | MEDIUM |
| Logging | Multiple audit loggers (auditLogger, auditLogging, AuditServiceConsolidation) | Inconsistent audit trails | MEDIUM |
| Authentication | No RBAC service layer (only middleware checks) | Authorization scattered in handlers | HIGH |
| Configuration | Config implicit (env vars all over) | Hard to audit system configuration | MEDIUM |
| Transactions | No explicit saga/transaction coordinator for multi-step flows | Payment recovery is manual | MEDIUM |

### VIOLATED BOUNDARIES

| Boundary | Violation | Evidence |
|----------|-----------|----------|
| Service isolation | ProposalExecutionService calls vaultService directly | Hard to test proposals independently |
| Presentation | Handlers call services directly without DTO transformation | API contracts undocumented |
| Data isolation | Services access tables directly via Drizzle | No query abstraction |
| Cache | Both Redis and in-memory cache used | Unclear which is source of truth |
| Logging | Service layer logs + middleware logs + audit logs | Unclear event order |
| Blockchain | Smart contract interactions hardcoded in services | No abstraction layer |

### REDUNDANT LOGIC

| Logic | Locations | Count | Consolidation Issue |
|-------|-----------|-------|----------------------|
| Authorization check (vault owner) | vaultService.deposit, vaultService.withdraw, vaultService.allocate | 3+ | Could be middleware |
| Price normalization | cexPriceCollector, smartRouter, ccxtService | 3+ | Could be shared util |
| Error response formatting | Every handler | 50+ | ApiResponse is used, good |
| Cache invalidation | deposit, withdraw, rebalance, governance | 4+ | Could be centralized |
| Transaction recording | deposit, withdraw, transfer | 3+ | Could be side-effect |
| Notification dispatch | Every state mutation | 10+ | Could be event-driven |

**REFACTORING OPPORTUNITY: Medium effort, high payoff**

---

## 7. SYSTEM PRIMITIVES

### IDENTITY PRIMITIVES

```
User primitive:
  id: string (UUID via next-auth)
  email: string
  phone?: string
  walletAddress: string
  role: enum [user, dao_member, dao_founder, admin]
  verified: boolean
  2FA: boolean
  KYC: enum [pending, approved, rejected]
  reputation: number (0-1000 scale)

Authentication primitive:
  access_token: JWT { sub: userId, email, role, iat, exp }
  refresh_token: JWT { sub: userId, iat, exp }
  expires_in: 900 (15 minutes)
  token_type: "Bearer"

Session primitive:
  session_id: UUID
  user_id: string (FK)
  token: string
  issued_at: timestamp
  expires_at: timestamp
  last_activity: timestamp
```

### CAPITAL PRIMITIVES

```
Vault primitive:
  id: string (UUID)
  ownerId: string (FK: users)
  daoId?: string (FK: daos)
  type: enum [regular, savings, locked_savings, yield, dao_treasury]
  balance: decimal (18,8) per token
  strategy: string [none, aggressive_yield, conservative_yield]
  locked_until?: timestamp
  created_at: timestamp

Token holding primitive:
  vaultId: string (FK)
  tokenSymbol: enum [CELO, cUSD, cEUR, USDT, USDC, MTAA]
  amount: decimal (18,8)
  last_updated: timestamp

Transaction primitive:
  id: string (UUID)
  vaultId: string (FK)
  type: enum [deposit, withdraw, transfer, rebalance, yield_claim]
  fromAddress: string
  toAddress: string
  amount: decimal (18,8)
  tokenSymbol: enum (as above)
  status: enum [pending, confirmed, failed, reversed]
  txHash: string (blockchain)
  timestamp: timestamp
  fee: decimal (18,8)
```

### PERMISSION PRIMITIVES

```
DAO Membership primitive:
  id: string (UUID)
  daoId: string (FK)
  userId: string (FK)
  role: enum [member, contributor, moderator, founder]
  voting_power: decimal (0-1000)
  joined_at: timestamp

Proposal primitive:
  id: string (UUID)
  daoId: string (FK)
  proposerId: string (FK: users)
  title: string
  description: text
  type: enum [transfer, parameter_change, permission_grant, governance_change]
  targetAddress?: string
  targetAmount?: decimal
  votingDeadline: timestamp
  executionDeadline: timestamp
  status: enum [draft, voting, passed, failed, executed]
  created_at: timestamp

Vote primitive:
  id: string (UUID)
  proposalId: string (FK)
  voterId: string (FK)
  choice: enum [yes, no, abstain]
  weight: decimal (voting power)
  timestamp: timestamp
```

### AUTOMATION PRIMITIVES

```
Job execution primitive:
  id: string (UUID)
  jobType: enum [weekly_rewards, pool_rebalance, price_collection, health_check]
  status: enum [scheduled, running, completed, failed]
  scheduled_for: timestamp
  started_at?: timestamp
  completed_at?: timestamp
  error?: string
  result?: JSONB

Alert primitive:
  id: string (UUID)
  type: enum [liquidation_cascade, high_volatility, toxicity, slippage_warning, etc]
  severity: enum [low, medium, high, critical]
  symbol: string
  message: string
  actionable_data: JSONB
  recipient_id: string (FK: users)
  read: boolean
  created_at: timestamp
```

---

## 8. DEPENDENCY GRAPH DESCRIPTION (Deterministic)

```
LAYER DEPENDENCIES (Bottom-up):

[Data Layer]
  PostgreSQL ← Schema (shared/schema.ts)
  Redis ← cacheService.ts
  
[Persistence Adapters]
  RedisCacheService
  DB ORM (Drizzle)
  ↓
  
[Core Infrastructure Services]
  cacheService ← [Redis]
  logger ← [Console + File]
  tokenRegistry ← [Configuration]
  schemaValidator ← [Zod schemas]
  ↓
  
[Primitive Services - IDENTITY CLUSTER]
  authService ← [JWT, bcrypt]
  sessionService ← [DB, Redis]
  otpService ← [DB, SendOTP SDK]
  kycService ← [KYC provider API]
  twoFAService ← [JWT, OTP]
  ↓
  
[Primitive Services - CAPITAL CLUSTER]
  vaultService ← [DB, ethers.js, smart contract ABIs]
    ↓ calls
    withdrawalRouter ← [vaultService]
      ↓ calls
      withdrawalExecutor ← [ethers.js, blockchain]
    ↓ calls
    paymentGatewayService ← [Stripe / Kotani / M-Pesa, DB]
      ↓ calls
      paymentExecutionService ← [blockchain, PaymentRecoverySAGA]
  
  walletService ← [DB, ethers.js]
  walletGenerationService ← [bip39, HDWallet]
  transferService ← [DB, vaultService]
  ↓
  
[Primitive Services - GOVERNANCE CLUSTER]
  governanceService ← [DB, voting logic]
  ProposalExecutionService ← [governanceService, vaultService, smart contracts]
  poolGovernanceService ← [DB, voting]
  treasuryMultisigService ← [DB, multi-sig ABIs]
  reputationService ← [DB, activity tracking]
  ↓
  
[Primitive Services - MARKET CLUSTER]
  ccxtService ← [CCXT library, 14 exchanges]
  smartRouter ← [ccxtService, cacheService, executionTrackingService]
    ↓ calls
    executionTrackingService ← [DB, smartRouter results]
  priceOracle ← [smart contract oracle, fallback: ccxtService]
  gasPriceOracle ← [chain RPC, DB cache]
  ↓
  
[Analytics Services]
  volatilityMetricsService ← [priceOracle, historical prices]
  marketAnalyticsService ← [ccxtService, order book]
  smartRetryLogicService ← [executionTrackingService, metrics]
  treasuryIntelligenceService ← [vaultService, DAOs]
  ↓
  
[Bridge Services]
  bridgeRelayerService ← [bridge protocol SDKs]
  crossChainService ← [multiChainProvider, bridgeRelayerService]
  multiChainProvider ← [14 RPC endpoints]
  ↓
  
[Blockchain-Specific Services]
  solanaIntegrationService ← [Solana RPC, @solana/web3.js]
  tronIntegrationService ← [TronWeb SDK]
  blockchainWithdrawalService ← [all blockchain integrations]
  ↓
  
[Notification Services]
  notificationService ← [email SDK, SMS SDK, Telegram SDK, Stripe]
  userNotificationService ← [DB, notificationService]
  ↓
  
[Automation Services]
  vaultAutomationService ← [vaultService, proposals, scheduling]
  ProposalExecutionService ← [already above]
  ScheduledAggregationJobs ← [cron, DB]
  JobMonitoringService ← [job definitions, DB, alerts]
  ↓
  
[AI/Premium Services]
  eldScry ← [volatilityMetricsService, marketAnalyticsService]
  eldKaizen ← [vaultService, rebalancing logic]
  eldLumen ← [across all data layers]
  morio ← [all services for context, LLM]
  opportunityEngine ← [ccxtService, priceOracle]
  ↓
  
[Middleware Layer]
  authenticate ← [JWT, authService]
  isAuthenticated ← [NextAuth]
  auditMiddleware ← [auditLogger]
  errorHandler ← [typed errors, response formatting]
  ↓
  
[Route Handlers]
  /wallet → walletService, walletGenerationService
  /vaults → vaultService, vaultExecutionService
  /governance → governanceService, ProposalExecutionService
  /market → ccxtService, smartRouter, volatilityMetricsService
  /orders → smartRouter, executionTrackingService
  /bridge → crossChainService, bridgeRelayerService
  /priority4 → [websocketRealTimeFeeds, futuresMarketSupport, advancedMicrostructureIndicators]
  ↓
  
[API Response Layer]
  ApiResponse<T> ← Generic wrapper
  HTTP 200/400/404/500 ← errorHandler
```

### CRITICAL PATH DEPENDENCIES (What breaks what)

```
IF Redis fails:
  → cacheService falls back to in-memory (acceptable)
  → Price caching still works
  → Session caching still works

IF PostgreSQL fails:
  → ALL state mutations fail (CRITICAL)
  → Vault operations fail
  → Governance fails
  → NO FALLBACK

IF ethers.js signing fails:
  → Blockchain operations fail
  → Withdrawals blocked
  → Treasury transfers blocked
  → NO FALLBACK

IF ccxtService fails (exchange unavailable):
  → Swimming router fails for that exchange
  → Falls back to next exchange (acceptable)
  → Price oracle falls back to on-chain (acceptable)

IF JWT secret changes:
  → ALL existing tokens invalidate
  → ALL users must re-login (acceptable if planned)
  → Token rotation available via refresh

IF governance quorum changes:
  → Existing proposals become invalid? (AMBIGUOUS)
  → Future proposals use new quorum (acceptable)

IF notification service fails:
  → Users don't get alerts (acceptable)
  → Transactions still succeed (acceptable)
  → Logs should record failure
```

---

## 9. UNCERTAINTY & AMBIGUITIES (Explicitly Stated)

| Area | Ambiguity | Evidence | Risk |
|------|-----------|----------|------|
| **Concurrency** | No explicit locking on vault deposits | Multiple deposits could race | CRITICAL |
| **Distributed Transactions** | PaymentRecoverySAGA referenced but unclear if implemented | Multiple payment services exist | HIGH |
| **Cache Coherence** | Unclear when cache invalidation happens vs state mutation | No transaction wrapper observed | MEDIUM |
| **Multi-sig Execution** | treasuryMultisigService exists but execution unclear | Service defined but routes not found | MEDIUM |
| **Quorum Calculation** | Formula in governance-quorum.ts not examined | Calculated but calculation logic unknown | MEDIUM |
| **Smart Contract ABI Versioning** | ABIs hardcoded, no version management | Breaking ABI changes would require code update | LOW-MEDIUM |
| **Service Account Permissions** | serviceAccountManager exists but scope unclear | Unknown what service accounts can do | MEDIUM |
| **Feature Flags** | featureService exists but not integrated in handlers | Unclear if feature gates are enforced | MEDIUM |
| **Simulator Accuracy** | Simulators exist but accuracy vs reality unknown | No validation against live trades shown | MEDIUM |
| **Event Order Guarantees** | Events published async, order unclear | No event ordering observed | LOW |

---

## 10. CONSOLIDATED ARCHITECTURE SUMMARY

### PRIMARY CONCERNS (Ordered by Severity)

1. **Concurrency on Shared Vault State** (CRITICAL)
   - Multiple deposits/withdrawals can race
   - Recommendation: Use database row-level locks or optimistic concurrency control
   
2. **Single Database Dependency** (CRITICAL)
   - PostgreSQL failure = system failure
   - Recommendation: Add read replicas, backup switching, state recovery protocol
   
3. **Authorization Scatter** (HIGH)
   - Auth checks throughout handlers, not centralized
   - Recommendation: Implement RBAC layer with @Authorize decorators
   
4. **Cache Coherence** (HIGH)
   - Cache invalidation pattern unclear
   - Recommendation: Use distributed cache invalidation protocol

5. **Error Recovery Incomplete** (MEDIUM)
   - Payment recovery SAGA exists but scope unclear
   - Recommendation: Document all distributed transaction workflows

6. **Audit Trail Consolidation** (MEDIUM)
   - Multiple audit loggers (auditLogger, auditLoggingService, AuditServiceConsolidation)
   - Recommendation: Consolidate to single AuditService with strategy pattern

---

## 11. FINAL COMPONENT INVENTORY

### By Classification

**Core Invariants**: 10 components
**Configurable Modules**: 22 components  
**Extensions**: 18 components
**Simulators (Testing)**: 15+ components
**Infrastructure**: 20+ components

**Total Production Services**: 105+
**Total Route Files**: 100+
**Total Database Tables**: 50+ (schema.ts)
**External Integrations**: 20+ (CCXT, Stripe, Telegram, etc)

---

END OF STRUCTURAL AUDIT
