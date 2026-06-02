
server/routes/governance-v2.ts | Comprehensive v2 governance router combining DAO management, membership, proposals, voting, delegation, treasury accounting, assets, budgets, expenses, reporting, and governance parameter endpoints | default (Express Router)
server/routes/governance-quorum.ts | Consolidated quorum endpoints: calculate, update, and check proposal quorum with history recording and deprecation of old endpoints | default (Express Router)
server/services/crossChainGovernanceService.ts | Cross-chain governance coordinator: create/broadcast proposals across chains, sync votes, and aggregate quorum across chains | crossChainGovernanceService (singleton)
server/services/vault/vault-governance.ts | Vault-focused governance and risk assessment service: vault proposal retrieval, risk scoring, and recommendations | VaultGovernanceService (exported)
server/routes/v1/daos/_daoId/governance.ts | DAO-scoped governance v1 router providing leaderboards, stats, member rank, and top contributors using denormalized precomputed tables | default (Express Router)
server/services/governanceSimulator.ts | Simulation services for governance actions: proposal creation, voting outcome forecasting, and execution impact analysis | exports: CreateProposalSimulator, VoteOnProposalSimulator, etc.
server/services/governanceLeaderboardService.ts | Service computing governance leaderboards and consolidated governance stats (referrals, contributors, voting activity) | GovernanceLeaderboardService (exported)
server/services/snapshotGovernanceService.ts | Integrates with Snapshot.org and on-chain fallbacks to fetch governance metrics, voter snapshots, and proposal histories | SnapshotGovernanceService (exported)
server/services/governance-service.ts | Core governance service implementing DAO creation, membership, tokens, proposals, voting, and treasury-related governance operations | exports: createDAO, getDAO, createProposal, addDAOMember, getDAOMembers, updateDAOParameters, updateTokenPrice, getDAOMembershipStats, etc.
shared/types/governance.ts | Shared TypeScript types and constants for governance: activities, proposals, votes, promotions, leaderboards, and API payloads | exports: ActivityType, UserRole, ProposalType, ProposalStatus, VoteType, types/interfaces (ProposalDetails, ActivityRecord, PromotionRequest, LeaderboardEntry, etc.), ACTIVITY_POINTS, ACTIVITY_LABELS, ROLE_LABELS
server/services/poolGovernanceService.ts | Pool-specific governance service: weighted voting based on pool shares, proposal lifecycle, vote casting, and finalization logic | default export: PoolGovernanceService (methods: calculateVotingPower, createProposal, vote, checkAndFinalizeProposal)
server/routes/governance-activity.ts | Routes for governance activity and promotion system: award activity, history, stats, leaderboard, promotion eligibility and requests | default (Express Router; endpoints under /api/governance/:daoId/activity and /promotion)
server/routes/modules/governance-routes.ts | Express module routes for cross-chain governance actions: create cross-chain proposals, aggregate votes, and sync chain votes | exports: governanceRoutes (Express Router)
server/services/priceOracle.ts | Price Oracle Service providing CEX/DEX/CoinGecko fallbacks, caching, rate-limit backoff, and symbol mapping | PriceOracleService (exported singleton)
server/services/navOracleService.ts | NAV / vault price oracle helpers used by vault strategies and NAV calculators (aggregation + validation) | navOracleService (exported)
server/services/vault/* | (pattern) Vault services and strategy integrations: deposit/withdraw, accounting, yield distribution, performance metrics, and on-chain sync | vault services
server/services/vault/vault-governance.ts | Vault-focused governance and risk assessment service: vault proposal retrieval, risk scoring, and recommendations | VaultGovernanceService (exported)
server/services/vault/vaultService.ts | (possible) Core vault operations: create vault, get vault details, deposit, withdraw, rebalance hooks, and on-chain interactions | VaultService (exported)
contracts/MultiAssetVault.sol | (referenced in env/local example) Multi-asset treasury vault contract supporting multiple assets, strategies, and accounting | MultiAssetVault (Solidity contract)
server/services/vault/navService.ts | NAV calculation and validation helpers used by vault strategies and reconciliation jobs | navService / navOracleService (related)
client/src/pages/vaults/* | Vault UI pages: vault list, create vault flow, vault dashboard, performance and analytics | vault pages/components
.env/.env.local.example | Vault feature flags: `FEATURE_CORE_VAULTS`, `FEATURE_VAULT_LIST`, `FEATURE_VAULT_CREATION`, `MULTI_ASSET_VAULT_ADDRESS`, `VAULT_CONTRACT_ADDRESS`, `FEATURE_VAULT_YIELD` | vault config flags
server/services/treasuryReconciliationJob.ts | Reconciliation job that compares computed treasury/vault balances to on-chain values and records audits (uses NAV/VAULT services) | reconciliation job
contracts/EscrowOracle.sol | Oracle-fed escrow contract referenced in roadmap; on-chain oracle verification functions for legal/process data | EscrowOracle (Solidity contract)
.env | Contains `FEATURE_SPECIAL_BRIDGE` and `RELAYER_PRIVATE_KEY` flags for optional bridge/relayer features and relayer wallet config | environment flags
server/services/relayer/* | (pattern) Relayer/bridge integration points and private-key driven signing flows (search for relayer implementations) | relayer modules
client/src/pages/trading.tsx | Unified Trading Hub UI with market streams, presets, treasury/trader modes, heatmap, and insights | TradingPage (default)
client/src/components/trading/* | Trading UI components: HeatmapView, MarketSignals, NetworkView, FocusMode, PresetsManager, YukiDashboard | trading components
client/src/hooks/useTrading.ts | Trading hooks for metrics, orders, positions, smart routing, and trading actions | useTrading, useTradingMetrics, usePlaceOrder
client/src/hooks/useMarketStream.ts | Market stream hook connecting to WebSocket market stream endpoint for real-time orderbook/ticker updates | useMarketStream
client/src/hooks/useTradingFilters.ts | Hook for trading filter state (pairs, timeframes, venues) used by trading UI | useTradingFilters
client/components/strategies/* | Strategy builder UI and deployment wizard for trading bots and strategies | StrategyDeploymentWizard, StrategyConfigurator
server/services/tradingDexSimulator.ts | Simulators for spot, margin, perpetuals, DEX swaps, and flash loans with slippage and liquidity modeling | SpotTradeSimulator, DexSwapSimulator, PerpetualsFuturesSimulator
server/routes/trading-signals.ts | Market intelligence and trading signals router exposing websocket feeds and microstructure endpoints | trading-signals router
client/components/layout/TopNavBar.tsx | Integrates trading metrics and quick alerts in the UI header | TopNavBar (uses `useTradingMetrics`)
server/api/market-stream.ts | (pattern) Market stream WebSocket API endpoint used by `VITE_MARKET_STREAM_ENDPOINT` | market-stream handlers
server/services/bridge/* | (pattern) Bridge integrations and cross-chain transfer helpers (feature-flagged by `FEATURE_SPECIAL_BRIDGE`) | bridge integrations
server/services/relayer/* | (pattern) Relayer executors and signer helpers (uses `RELAYER_PRIVATE_KEY`) | relayer executors
contracts/*Bridge*.sol | (pattern) On-chain bridge/relayer/swap contracts (search for Bridge, Relayer, Router contracts) | bridge solidity contracts
env configs (.env/.env.production/.env.local.example) | Environment flags for `FEATURE_SPECIAL_BRIDGE`, `RELAYER_PRIVATE_KEY`, `DEX_WALLET_PRIVATE_KEY`, and market stream endpoint `VITE_MARKET_STREAM_ENDPOINT` | env configs
server/services/ccxtService.ts | CCXT-based centralized exchange adapter for market data and optional authenticated trading (configurable via `CCXT_ENABLED`) | ccxtService (exported)
client/src/pages/trading.tsx (exchanges list) | UI references to CEX providers (Binance, Coinbase) for price aggregation and filtering | exchanges in TradingPage
server/services/amm/* | (pattern) AMM helpers and swap routing utilities used by DEX simulation and swap flows | AMM utilities
contracts/*Router*.sol | (pattern) On-chain router/periphery contracts for swaps and AMM interactions (Uniswap-like periphery) | Router contracts
server/services/lending/* | (pattern) Lending integrations and adapters (Aave/Compound style interfaces, collateral/liquidation helpers) | lending adapters
server/services/aaveAdapter.ts | (possible) Aave integration adapter for borrowing/lending and rate retrieval (search for Aave/Pool addresses) | aave adapter
server/services/cefi/* | (pattern) Centralized exchange helpers, custody, and settlement adapters (CEFI flows) | CEX adapters
docs/TREASURY_INTEGRATION_GUIDE.md | Section on custom price oracle and integration notes for on-chain/off-chain price feeds and custodial flows | guide reference
server/core/nuru/analytics/governance_analyzer.ts | Analytics module that computes governance health metrics, insights, risks, and recommendations from proposal and vote history | exports: GovernanceAnalyzer (analyze, calculateMetrics, generateInsights)
server/core/kwetu/services/governance_service.ts | Lightweight governance service used by core flows to fetch proposals, proposal details, and compute simple voting power from activity/delegations | exports: GovernanceService (methods: getProposals, getProposalById, getVotingPower)
client/src/pages/dao/[id]/governance.tsx | DAO governance page: lists proposals, shows vote counts/quorum progress, and provides execution queuing with multisig flow integration | default (DaoGovernancePage)
server/migrations/003_governance_activity_tracking.ts | DB migration to create governance activity, promotion, and related views/tables supporting activity points and promotions | up, down
tests/services/governance-service.test.ts | Unit tests for governance service functions (proposal querying, vote aggregation, voting power calculations) | test suite (describe blocks for GovernanceService behaviors)
client/src/hooks/useTreasuryIntelligence.ts | Hook producing treasury intelligence and governance-weight calculators used by treasury and governance views | exports: useTreasuryIntelligence, useTreasuryIntelligenceMonitor
client/src/hooks/useDashboardData.ts | Composite dashboard hook that fetches and aggregates DAO dashboard data including governance metrics, elders, treasury, and community | exports: useDashboardData
client/src/hooks/useFeatureFlags.ts | Feature-flag hook exposing whether governance and advanced governance features are enabled for the current environment/DAO | exports: useFeatureFlags (selectors: isGovernanceEnabled, isAdvancedGovernanceEnabled)
client/src/hooks/useTreasuryData.ts | Hook to fetch DAO treasury on-chain/off-chain data including governance weight attribution for members | exports: useTreasuryData
client/src/hooks/useTreasury.ts | Hook managing treasury state and operations used across admin/treasury pages (includes validation and action helpers) | exports: useTreasury
components/governance/GovernanceDashboard.tsx | Aggregated governance UI: proposals, voting, execution, parameters, and permissions panels for DAO governance | GovernanceDashboard (exported)
server/routes/governance.ts | Governance router handling quorum calculation, proposal execution queuing, cancellation, and enforcement of governance rules and timelocks | default (Express Router)
client/src/components/RotationWidget.tsx | UI widget showing DAO rotation status, next rotation date, recent cycles, and quick refresh action | RotationWidget (default export)
server/api/rotation_service.ts | Backend rotation service: select recipients, process rotation cycles, rule evaluation, and handlers for rotation status and execution | exports: selectRotationRecipient, processRotation, getRotationStatus, getRotationStatusHandler, processRotationHandler, getNextRecipientHandler
server/routes/treasuryManagement.ts | Express router exposing treasury management endpoints: whitelist requests/approvals and limits management with access checks and audit logging | default (Express Router)
server/routes/treasury-data.ts | Express router providing on-chain treasury data endpoints: holdings, budget, governance metrics, health checks, and real-time data integration | default (Express Router)
components/SimulationResultModal.tsx | Reusable modal component to display simulator results, risk levels, and actionable metrics across treasury tools | SimulationResultModal (exported)
components/treasury/FixedIncomePanel.tsx | Panel to analyze bond investments, yields, and credit risk for fixed-income strategies | FixedIncomePanel (default export)
components/treasury/MarginLendingPanel.tsx | Panel for simulating margin lending scenarios, liquidation risk, and interest cost analysis | MarginLendingPanel (default export)
components/treasury/DividendReinvestmentPanel.tsx | Panel to simulate and compare dividend reinvestment (DRIP) strategies for treasury assets | DividendReinvestmentPanel (exported)
components/treasury/GrantDistributionPanel.tsx | UI panel for planning and executing grant distributions with vesting schedules and budget tracking | GrantDistributionPanel (default export)
components/treasury/AssetAllocationPanel.tsx | UI panel to compare allocation scenarios and simulate projected outcomes for treasury allocations | AssetAllocationPanel (default export)
components/treasury/TreasuryDashboard.tsx | Aggregated treasury management dashboard combining rebalancing, allocation, grants, and strategy panels for DAO treasuries | TreasuryDashboard (default export)
components/treasury/TreasuryRebalancePanel.tsx | UI panel performing Monte Carlo rebalancing simulations and executing rebalance plans | TreasuryRebalancePanel (default export)
client/src/api/treasuryAPI.ts | Client-side API wrapper for treasury management endpoints: whitelist, limits, and multisig approval flows | TreasuryAPI class instance `treasuryAPI` (methods: requestWhitelistApproval, getWhitelistEntries, approveWhitelistEntry, getTreasuryLimits, updateTreasuryLimits, getPendingApprovals, submitMultisigSignature, rejectMultisigApproval, getApprovalStatus, getApprovalDetails)
client/src/components/TreasuryManagement.tsx | React component for DAO treasury controls: whitelist requests, approvals, limit editing, and multisig approval UI | default (TreasuryManagement)
server/routes/treasuryManagement.ts | Express routes for treasury whitelist management, limit configuration, and admin approval workflows | (endpoints: POST /:daoId/whitelist/request, POST /:daoId/whitelist/:entryId/approve, GET /:daoId/whitelist, GET /:daoId/limits, PUT /:daoId/limits)
server/routes/treasury-data.ts | Routes exposing on-chain treasury data: holdings, governance weight, budget, history, and real-time WebSocket updates | (endpoints: GET /:daoId, GET /holdings/:daoId, GET /budget/:daoId, GET /governance/:daoId, GET /history/:daoId)
server/services/treasuryValidationService.ts | Service enforcing treasury transfer rules: whitelists, daily caps, multisig thresholds, and admin approvals | TreasuryValidationService (static methods: isRecipientWhitelisted, validateTransferAmount, requiresMultisig, getMultisigRequiredSignatures, getAvailableSigners, requestWhitelistApproval, approveWhitelistEntry, getTreasuryLimits, updateTreasuryLimits)
server/services/treasuryService.ts | Core treasury DB-backed operations: balances, history, deposits, withdrawals, and contribution handling with audit logs | TreasuryService (methods: getBalance, getHistory, recordDeposit, recordWithdrawal, etc.)
server/services/treasuryReconciliationJob.ts | Periodic reconciliation job comparing computed treasury/vault balances to on-chain values and recording audits | runTreasuryReconciliationJob, reconcileDAOTreasury, reconcileVaultBalance, recordReconciliationAudit, getRecentReconciliationResults, getCriticalDiscrepancies
server/services/treasuryPriceUpdateService.ts | Service that listens for price updates and updates treasury position USD values, emitting position updates | TreasuryPriceUpdateService, treasuryPriceUpdateService
server/services/treasuryMultisigService.ts | Manages proposing, signing, executing multisig treasury transactions, budget checks, and audit logging | TreasuryMultisigService (proposeWithdrawal, signTransaction, executeTransaction, checkBudgetCompliance, getTransactions, getTransactionWithDetails)
client/src/hooks/useTreasury.ts | React hook that manages treasury initialization, asset management, validation, and summary using `treasury.service` utilities | useTreasury (default export)
server/routes/admin/admin-daos.ts | Admin routes for listing, inspecting, updating, suspending, restoring, and soft-deleting DAOs with audit logging | (default router export; endpoints: /daos/list, /daos/:daoId/detail, PUT /daos/:daoId, POST /daos/:daoId/suspend, POST /daos/:daoId/restore, DELETE /daos/:daoId, /stats)
server/routes/meta-daos.ts | Routes exposing MetaDAO creation, cross-DAO proposal submission, and voting endpoints backed by MetaDaoService | (default router export; POST /create, POST /:metaDaoId/proposals, POST /proposals/:proposalId/vote)
server/routes/v1/daos.ts | Versioned DAO API with discovery, featured DAO, details, dashboard stats, join/leave, and DAO-scoped subrouters using computed treasury | (default router export; endpoints: GET /, GET /featured, GET /:daoId, GET /:daoId/dashboard-stats, POST /:daoId/join, POST /:daoId/leave)
client/src/pages/admin/DAOsPage.tsx | Admin React page for DAO management showing list, stats, and status update modal using `useAdminDAOs` hook | DAOsPage (default)
client/pages/admin/daos.tsx | Next.js admin page for DAO management with filters, suspend/restore actions, and table view | default (AdminDAOs)
server/db/migrations/011-soft-delete-users-daos.ts | Migration adding soft-delete columns and recovery indexes to users, daos, and admin_users tables | up, down
client/src/types/treasury.ts | Type definitions for DAO treasuries, assets, multisig, transactions, and validation payloads | DAOType, ChainType, TokenType, TreasuryAsset, DAOTreasury, DAOTreasuryConfig, TreasuryTransaction, TreasuryOperationLog, MultisigConfig, TreasuryValidationRequest, TreasuryValidationResponse, TreasuryActionRequest, OraclePriceData
client/src/utils/treasury.service.ts | Core treasury business logic: create/validate treasury, add/remove assets, compute USD value and voting weights, and multisig rules | createDefaultTreasury, validateTreasuryConfiguration, addCustomTokenToTreasury, removeAssetFromTreasury, calculateTreasuryValueUSD, calculateVotingWeight, doesWithdrawalRequireMultisig, getQuorumRequirementForDAOType, getVotingPeriodForDAOType, getEmergencyWithdrawalLimit, validateAssetTransfer
client/src/utils/treasury-intelligence.ts | Semantic layer for treasury: asset classification, risk profiling, behavior analysis, cross-chain normalization, and recommendations | classifyAsset, analyzeTreasuryBehavior, normalizeCrossChainState, types: AssetClass, RiskProfile, TreasuryBehaviorAnalysis
client/src/context/treasurySystem.tsx | React context provider managing treasury workspace, multisig wallets, transactions, and signer presence with `useTreasurySystem` hook | TreasurySystemProvider, useTreasurySystem
server/api/treasury.ts | Express handlers exposing treasury intelligence analysis, formula recommendations, and health checks backed by intelligence services | analyzeTreasuryHandler, recommendFormulaHandler, getTreasuryHealthHandler
migrations/005_phase5_governance_treasury.ts | Adds Phase 5 governance and treasury DB schema changes and migration up/down scripts | up, down
components/treasury/TreasuryRebalancePanel.tsx | UI panel that previews Monte Carlo-based treasury rebalances and can execute rebalance actions via API | TreasuryRebalancePanel, default
components/treasury/TreasuryDashboard.tsx | Aggregates treasury tools (rebalancing, allocation, grants, dividends, margin lending, fixed income) into a single dashboard UI and records action history | TreasuryDashboard, default
client/src/utils/treasury.service.ts | Core treasury business logic: create/validate treasuries, asset management, USD valuation, voting-weight calculation, and multisig/transfer validation | createDefaultTreasury, validateTreasuryConfiguration, addCustomTokenToTreasury, removeAssetFromTreasury, calculateTreasuryValueUSD, calculateVotingWeight, doesWithdrawalRequireMultisig, getQuorumRequirementForDAOType, getVotingPeriodForDAOType, getEmergencyWithdrawalLimit, validateAssetTransfer, addChainSupportToTreasury, getTreasurySummary
client/src/utils/treasury-intelligence.ts | Asset classification, risk profiling, behavior analysis, cross-chain normalization, and governance-weight formulas to produce a treasury intelligence summary | classifyAsset, analyzeTreasuryBehavior, normalizeCrossChainState, GovernanceWeightFormula, recommendGovernanceFormula, generateTreasuryIntelligence
client/src/types/treasury.ts | Type definitions for the treasury system (DAO types, chains, assets, configs, transactions, validation requests/responses, oracle data) | DAOType, ChainType, TokenType, VotingWeightMapping, TreasuryAsset, DAOTreasury, DAOTreasuryConfig, TreasuryTransaction, TreasuryOperationLog, MultisigConfig, TreasuryValidationRequest, TreasuryValidationResponse, TreasuryActionRequest, OraclePriceData
client/src/context/treasurySystem.tsx | React context/provider managing treasury workspace state, multisig wallets, execution queue, signer info, and actions | TreasurySystemProvider, useTreasurySystem
client/src/config/treasury.config.ts | Treasury configuration matrix mapping DAO types to supported chains/assets, multisig rules, voting weight sources, and convenience getters | TREASURY_MATRIX, getTreasuryConfigForDAOType, getSupportedChainsForDAOType, getSupportedAssetsForDAOType, getSupportedSymbolsForDAOType, isMultisigRequiredForDAOType, getMultisigSettingsForDAOType, areCustomTokensAllowedForDAOType, getVotingWeightSourcesForDAOType, getAssetConfig, isAssetSupportedForDAOType, getVotingWeightMapping
client/src/pages/TreasuryIntelligence.tsx | Page wrapper that reads the DAO id from route params and renders the Treasury Intelligence dashboard | default
client/src/pages/dao/[id]/treasury.tsx | DAO-specific treasury page that validates the route param and renders the DAO treasury view | default
client/src/pages/dao/treasury.tsx | Top-level DAO treasury page that renders the DaoTreasuryOverview component for treasury overview | default
server/services/treasuryValidationService.ts | Server-side service enforcing treasury controls: recipient whitelist, amount limits, multisig checks, approvals, and audit logging | TreasuryValidationService, WhitelistEntry, DaoTreasuryLimits
client/src/hooks/useTreasuryIntelligence.ts | React hook that generates and exposes treasury intelligence data, accessors, governance-weight calculators, and a poll-based monitor | useTreasuryIntelligence, useTreasuryIntelligenceMonitor
client/src/pages/dao/dao_treasury_overview.tsx | Displays DAO treasury dashboard with key metrics (members, funding progress, voting activity), plan status, recent activity, and quick actions; fetches DAO dashboard stats. | DaoDashboard, default
client/src/components/TreasuryManagement.tsx | Admin UI for treasury controls: manage recipient whitelist, configure treasury limits, and handle multisig approvals; uses treasuryAPI for backend actions. | TreasuryManagement, default
client/src/components/TreasuryIntelligenceDashboard.tsx | Shows AI-powered treasury intelligence report with health indicators, top initiatives, optimization recommendations, and an apply-optimization action. | TreasuryIntelligenceDashboard, default
client/src/api/treasuryAPI.ts | Client-side API wrapper for treasury management endpoints (whitelist, limits, pending approvals, multisig signatures) with typed request/response interfaces. | treasuryAPI, TreasuryWhitelistEntry, TreasuryLimits, PendingApproval
client/pages/admin/treasury.tsx | Admin-facing treasury page showing vaults, transactions, health overview, and emergency freeze/unfreeze controls with filters and pagination. | TreasuryPage, default
server/api/treasury.ts | Server HTTP handlers exposing treasury intelligence and health endpoints: analyze treasury, recommend governance formula, and return treasury health. | analyzeTreasuryHandler, recommendFormulaHandler, getTreasuryHealthHandler
server/config/treasury.ts | Central treasury configuration and defaults (rate limits, default limits, multisig, vault settings, intelligence thresholds) with exported type. | treasuryConfig, TreasuryConfig, default
server/core/kwetu/services/treasury_service.ts | Service that computes DAO treasury balance, recent transactions, and 30-day treasury metrics from vaults and wallet transactions. | TreasuryServicemigrations/005_phase5_governance_treasury.ts | Adds Phase 5 governance & treasury DB schema changes and audit/reporting tables (SQL migrations) | up, down
components/treasury/TreasuryRebalancePanel.tsx | UI panel that previews Monte Carlo-based treasury rebalances and executes rebalance actions via API | TreasuryRebalancePanel, default
components/treasury/TreasuryDashboard.tsx | Aggregates treasury tools (rebalancing, allocation, grants, dividend strategies, margin lending, fixed income) into a dashboard UI and records action history | TreasuryDashboard, default
client/src/utils/treasury.service.ts | Core treasury business logic for creating/validating treasuries, asset management, valuation, voting-weight calculation, and multisig/transfer validation | createDefaultTreasury, validateTreasuryConfiguration, addCustomTokenToTreasury, removeAssetFromTreasury, calculateTreasuryValueUSD, calculateVotingWeight, doesWithdrawalRequireMultisig, getQuorumRequirementForDAOType, getVotingPeriodForDAOType, getEmergencyWithdrawalLimit, validateAssetTransfer, addChainSupportToTreasury, getTreasurySummary
client/src/utils/treasury-intelligence.ts | Asset classification, risk profiling, behavior analysis, cross-chain normalization, and governance-weight formulas producing treasury intelligence summaries | classifyAsset, analyzeTreasuryBehavior, normalizeCrossChainState, GovernanceWeightFormula, recommendGovernanceFormula, generateTreasuryIntelligence
client/src/types/treasury.ts | Type definitions for the treasury system (DAO types, chains, assets, configs, transactions, validations, oracle data) | DAOType, ChainType, TokenType, VotingWeightMapping, TreasuryAsset, DAOTreasury, DAOTreasuryConfig, TreasuryTransaction, TreasuryOperationLog, MultisigConfig, TreasuryValidationRequest, TreasuryValidationResponse, TreasuryActionRequest, OraclePriceData
client/src/context/treasurySystem.tsx | React context/provider managing treasury workspace state, multisig wallets, execution queue, signers, and actions | TreasurySystemProvider, useTreasurySystem
server/services/tradingDexSimulator.ts | Trading & DEX simulators covering spot, margin, perpetuals, DEX swaps, and flash loans with slippage, funding, and liquidity modeling | exports: SpotTradeSimulator, MarginTradeSimulator, PerpetualsFuturesSimulator, DexSwapSimulator, FlashLoanSimulator
server/routes/trading-signals.ts | Market intelligence and trading signals router exposing websocket realtime feeds, futures/funding metrics, liquidation detection, open interest, order-flow analytics, and advanced microstructure endpoints | default (Express Router)
modules/trading/TradingPanel.tsx | Compact trading panel component used in workspace panels showing chart placeholder and timeframe controls | TradingPanel (default export)
client/components/trading/TradingDashboard.tsx | Full trading dashboard UI aggregating orders, positions, metrics, smart routing, and quick order execution; integrates with TradingAccountProvider | default (TradingDashboard)
client/src/contexts/trading-account-context.tsx | Trading account context managing exchange connections, balances, positions, orders, metrics, and trading actions (place/cancel/close) | exports: TradingAccountProvider, useTradingAccount (context)
client/src/hooks/useTrading.ts | Trading hooks for open orders, positions, metrics, trade history, place order, smart routing, order splitting, and best venue analysis | exports: useOpenOrders, usePositions, useTradingMetrics, useTradeHistory, usePlaceOrder, useSmartRouting, useOrderSplitting, useBestVenue
client/src/config/treasury.config.ts | Treasury configuration matrix mapping DAO types to supported chains/assets, multisig rules, voting-weight sources, and helper getters | TREASURY_MATRIX, getTreasuryConfigForDAOType, getSupportedChainsForDAOType, getSupportedAssetsForDAOType, getSupportedSymbolsForDAOType, isMultisigRequiredForDAOType, getMultisigSettingsForDAOType, areCustomTokensAllowedForDAOType, getVotingWeightSourcesForDAOType, getAssetConfig, isAssetSupportedForDAOType, getVotingWeightMapping
client/src/pages/TreasuryIntelligence.tsx | Page wrapper that reads the DAO id from route and renders the TreasuryIntelligence dashboard | default
client/src/pages/dao/[id]/treasury.tsx | DAO-specific treasury page validating route param and rendering DAO treasury view | default
client/src/pages/dao/treasury.tsx | Top-level DAO treasury page rendering DaoTreasuryOverview component | default
server/services/treasuryValidationService.ts | Server-side service enforcing treasury controls: recipient whitelist, amount limits, multisig checks, approvals, and audit logging | TreasuryValidationService, WhitelistEntry, DaoTreasuryLimits
client/src/hooks/useTreasuryIntelligence.ts | React hook generating and exposing treasury intelligence data, accessors, governance-weight calculators, and a monitor | useTreasuryIntelligence, useTreasuryIntelligenceMonitor
client/src/pages/dao/dao_treasury_overview.tsx | Displays DAO treasury dashboard with key metrics, funding progress, voting activity, and recent activity; fetches dashboard stats | DaoDashboard, default
client/src/components/TreasuryManagement.tsx | Admin UI for treasury controls: manage whitelist, configure limits, and handle multisig approvals using treasuryAPI | TreasuryManagement, default
client/src/components/TreasuryIntelligenceDashboard.tsx | Shows AI-powered treasury intelligence report with health indicators, initiatives, optimizations, and recommendations | TreasuryIntelligenceDashboard, default
client/src/api/treasuryAPI.ts | Client-side API wrapper for treasury management endpoints (whitelist, limits, pending approvals, multisig signatures) with typed interfaces | treasuryAPI, TreasuryWhitelistEntry, TreasuryLimits, PendingApproval
client/pages/admin/treasury.tsx | Admin-facing treasury page showing vaults, transactions, health overview, and emergency freeze/unfreeze controls | TreasuryPage, default
server/api/treasury.ts | Server HTTP handlers exposing treasury intelligence, formula recommendation, and health endpoints | analyzeTreasuryHandler, recommendFormulaHandler, getTreasuryHealthHandler
server/config/treasury.ts | Central treasury configuration and defaults (rate limits, default limits, multisig, vaults, intelligence thresholds) | treasuryConfig, TreasuryConfig
server/core/kwetu/services/treasury_service.ts | Service computing DAO treasury balance, recent transactions, and treasury metrics from vaults and wallet transactions | TreasuryService
docs-site/components/DAOTypeComparison.tsx | Interactive component comparing DAO templates, durations, fees, and example use-cases for DAO types | DAOTypeComparison
server/api/dao_members_add_elder.ts | Server handler to add an elder to DAO multisig signers after verifying membership and current signers | addElderToMultisigHandler
server/api/dao_deploy.ts | Validates input and deploys a new DAO: creates DAO record, vault, memberships, and multisig configuration | daoDeployHandler, DaoDeployRequest
server/api/dao_create_validation.ts | Zod validation schema and server-side validation utility for DAO creation input and rules | daoCreationSchema, validateDaoCreation, DaoCreationInput
server/api/daoSettings.ts | Handlers to fetch, update, and manage DAO settings, invite codes, and analytics with admin role checks | getDaoSettingsHandler, updateDaoSettingsHandler, resetInviteCodeHandler, getDaoAnalyticsHandler, bulkUpdateDaoSettingsHandler
server/routes/daos.ts | Express routes for listing, joining, leaving, and retrieving DAO details and dashboard stats, enriching DAOs with membership and activity info | (default router export handling GET /api/daos, GET /:id, POST /:id/join, POST /:id/leave), dashboard-stats
client/src/pages/daos.tsx | React page showing DAO discovery, joined DAOs, and actions to join/leave with enhanced UI and analytics | default (EnhancedDAOs)
server/services/metaDaoService.ts | Service providing MetaDAO creation, cross-DAO proposals, child DAO registry, and federation analytics | MetaDaoService, metaDaoService
client/src/components/DaoSwitcher.tsx | UI component for switching between user's joined DAOs with a sheet and quick stats | default (DaoSwitcher)
server/config/daoTypes.ts | Defines DAO type configurations and smart defaults (labels, modules, multisig ranges, durations, and feature flags) | DAO_TYPE_CONFIG
server/middleware/daoPermissions.ts | Express middleware enforcing DAO admin/member permissions and attaching `req.daoRole` for downstream handlers | requireDAOAdmin, requireDAOMember
server/middleware/daoMembershipValidator.ts | Middleware validating DAO membership (path and query variants) and populating `req.daoMembership` | requireDAOMembership, requireDAOMembershipFromQuery
server/routes/investment-pools.ts | Express router for investment pool APIs: list pools, pool details, asset management, composition, investments, rebalancing triggers, and fee calculations | default (Express Router)
server/services/investmentPoolService.ts | Service managing multi-asset investment pools: asset CRUD, allocations, portfolio composition, and DAO membership checks | exports: InvestmentPoolService (methods: addAssetToPool, removeAssetFromPool, updateAssetAllocation, getPoolAssets, getPortfolioComposition)
server/services/investmentPoolPricingService.ts | Pricing and fee service for investment pools: platform fee lookup, fee calculations for investments/withdrawals, and revenue recording | exports: investmentPoolPricingService (InvestmentPoolPricingService)
server/services/investmentOperationsSimulator.ts | Simulator for investment operations and rebalancing scenarios including Monte Carlo and backtest helpers | exports: InvestmentOperationsSimulator
server/jobs/investmentPoolsAutomation.ts | Background jobs for pool automation: scheduled rebalances, snapshots, fee settlements, and report generation | exports: triggerManualRebalance, triggerManualSnapshot, runScheduledRebalances
client/src/pages/investment-pools.tsx | Frontend page listing investment pools with filters, TVL, and quick-join actions | default (InvestmentPoolsPage)
client/src/pages/investment-pool-detail.tsx | Detailed investment pool page showing assets, composition, performance charts, and invest/withdraw actions | default (InvestmentPoolDetail)
server/routes/v1/daos/_daoId/investment-pools.ts | DAO-scoped investment pools subrouter exposing pool list, composition, investments, and member-specific actions | default (Express Router)
server/routes/__tests__/investment-pools-multi-asset.test.ts | Integration tests for multi-asset investment pools covering asset add, allocation validation, and composition endpoints | test suite
__tests__/integration/vault-strategy-asset-graph.test.ts | Integration tests for vault+strategy+asset-graph flows: symbol validation, NAV calc (multi-source pricing), asset graph risk checks, and rebalancing | test suite
server/workers/poolVaultJobWorker.ts | Job worker for pool and vault rebalances; calculates plans and executes rebalances via pricing and smart-router services | PoolVaultJobWorker (class)
contracts/deploy_maono_vault.ts | Deployment script for `MaonoVault` using ethers, loads ABI/bytecode and deploys with env-configured params | deploy script
server/vaults.ts | Next API handler returning vaults from DB (`vaults` table) | API handler
server/vaultEventsIndexer.ts | On-chain event indexer for vault events (NAVUpdated, DepositMade, WithdrawalMade, etc.) and DB persistence | VaultEventIndexer
server/vaultAutomation.ts | Vault automation service scheduling NAV updates, rebalances, fee distributions, and risk assessments with retries/backoff | VaultAutomationService
server/utils/vaultTypeValidators.ts | Type-safe vault type constraints and validators for operations (deposit/withdraw/allocate/rebalance) | validators
server/tests/vaults.integration.test.ts | Integration tests for vault workflows: deposits, withdrawals, allocations, rebalances, and permission checks | test suite
client/src/pages/hooks/useVault.ts | React hooks for vault contract interactions, balances, info, approvals, and deposit/withdraw mutations (uses MaonoVault ABI) | hooks
server/api/vaults.ts | Express handlers for vault endpoints: create, allocate, get, deposit, withdraw, allocate-to-strategy, rebalance — delegates to `vaultService` | API handlers
server/core/nuru/analytics/vault_analyzer.ts | Analytics module computing vault health, performance metrics, risk signals, and NAV trends for dashboard and automation | VaultAnalyzer (exports: analyze, calculateMetrics, generateInsights)
client/src/hooks/useVaultAnalytics.ts | React hook exposing vault analytics, performance series, and alerts for vault dashboards | useVaultAnalytics
server/api/authVault.ts | Auth-related handlers for vault operations (vault-specific permissions, signing helpers, and delegated access checks) | authVault handlers
server/migrations/004_vault_ownership_treasury_linking.ts | DB migration linking vault ownership to treasuries and DAO relationships (adds ownership and treasury FK columns) | up, down
server/middleware/vaultOwnershipGuard.ts | Middleware enforcing vault ownership/manager permissions for vault endpoints | vaultOwnership guard
server/routes/v1/wallets/vaults.ts | Wallet-scoped vault routes for user's vaults, balances and transactions | wallet vault routes
scripts/apply-vault-constraint.ts | Utility script to enforce DB constraints/policies on vault tables (used in migrations/maintenance) | maintenance script
server/routes/v1/daos/_daoId/treasury/vaults.ts | DAO-scoped treasury vaults subrouter exposing DAO vault management, create, list, and admin ops | DAO vaults subrouter
components/vaults/VaultWithdrawalPanel.tsx | UI panel for withdrawing from vaults with validation, destination selection, and fee previews | VaultWithdrawalPanel (UI)
components/vaults/VaultStrategyPanel.tsx | UI panel to attach strategies to a vault, allocation controls, and strategy status | VaultStrategyPanel (UI)
components/vaults/VaultsDashboard.tsx | Vaults dashboard aggregating TVL, performance, recent transactions, and quick actions | VaultsDashboard (UI)
components/vaults/VaultLiquidationPanel.tsx | Panel showing liquidation risk, triggers, and emergency actions for vaults with margin/leverage | VaultLiquidationPanel (UI)
contracts/MultiAssetVault.sol | Multi-asset treasury vault Solidity contract supporting deposits, withdrawals, NAV, and strategy hooks | MultiAssetVault (contract)
contracts/MaonoVaultFactory.sol | Factory contract to deploy `MaonoVault` instances and manage vault registry on-chain | MaonoVaultFactory (contract)
contracts/MaonoVault.sol | `MaonoVault` on-chain implementation used by UI hooks and automation services (ABI available) | MaonoVault (contract)
server/migrations/005_vault_withdrawals_multisig.sql | Migration adding multisig withdrawal support and related tables/constraints for vault withdrawals | SQL migration
client/src/pages/vault.tsx | Vault creation/listing page (frontend) with create flow, list, and links to vault dashboards | Vault page
client/src/pages/vault-dashboard.tsx | Frontend vault dashboard page rendering `VaultsDashboard` and analytics components | Vault dashboard page
client/src/hooks/useWebSocket.ts | Hook for WebSocket connections and reconnection logic used by market streams and realtime features | useWebSocket
client/src/hooks/useWalletSession.ts | Manages user wallet session state, auto-reconnect, and session persistence | useWalletSession
client/src/hooks/useWalletActions.ts | Helpers to sign transactions, send payments, and wallet-related actions across UI | useWalletActions
client/src/hooks/useVaultAnalytics.ts | Exposes vault analytics queries and series for dashboard components | useVaultAnalytics
client/src/hooks/useUrlState.ts | Syncs UI state with URL params (filters, view mode) and debounced updates | useUrlState
client/src/hooks/useTypingIndicator.ts | Presence typing indicator hook for chat and messaging components | useTypingIndicator
client/src/hooks/useTreasuryIntelligence.ts | Hook producing treasury intelligence reports and governance-weight calculators | useTreasuryIntelligence
client/src/hooks/useTreasuryData.ts | Fetches DAO treasury on-chain/off-chain data and normalizes asset positions | useTreasuryData
client/src/hooks/useTreasury.ts | High-level treasury hook for admin flows and multisig actions | useTreasury
client/src/hooks/useTradingFilters.ts | Hook managing trading filter state (pairs, venues, timeframes) used across trading UI | useTradingFilters
client/src/hooks/useTrading.ts | Trading hooks for metrics, orders, positions, smart routing, and trading actions | useTrading
client/src/hooks/useTechnicalIndicators.ts | Computes technical indicators (RSI, MACD, moving averages) for charting and signals | useTechnicalIndicators
client/src/hooks/useStrategyDeployment.ts | Hook to deploy trading strategies and manage deployment state and logs | useStrategyDeployment
client/src/hooks/useSignerProfile.ts | Manages signer profiles, addresses, ENS resolution, and display metadata | useSignerProfile
client/src/hooks/useResponsive.ts | Responsive UI helpers and breakpoints hook | useResponsive
client/src/hooks/useRealtimeMetrics.ts | Hook to fetch realtime system/market metrics and expose them to dashboards | useRealtimeMetrics
client/src/hooks/usePresence.ts | Presence and online-status hook for users and components | usePresence
client/src/hooks/useOrderBook.ts | Fetches and subscribes to orderbook updates for a trading pair | useOrderBook
client/src/hooks/useOpportunityStream.ts | Stream of detected trading opportunities, arbitrage and alerts | useOpportunityStream
client/src/hooks/useNotifications.ts | Central notifications hook to manage toasts, alerts, and persistent notifications | useNotifications
client/src/hooks/useMorioSessionStorage.ts | Small wrapper around session storage for Morio UI components | useMorioSessionStorage
client/src/hooks/useMorioNotifications.ts | Morio-specific notification hooks and integrations | useMorioNotifications
client/src/hooks/useMorioDataHub.ts | Data hub hook for Morio realtime/graph integrations | useMorioDataHub
client/src/hooks/useMessages.ts | Messaging hooks for chat threads, sending, and fetching messages | useMessages
client/src/hooks/useMediaQuery.ts | Hook for evaluating CSS media queries in React | useMediaQuery
client/src/hooks/useMarketStream.ts | Market stream hook connecting to WebSocket market stream endpoint for real-time orderbook/ticker updates | useMarketStream
client/src/hooks/useLiveExchangePrices.ts | Subscribes to aggregated exchange prices and provides smoothing/aggregation | useLiveExchangePrices
client/src/hooks/useLiquidityScoring.ts | Computes liquidity scores for pairs and assets used in routing/DEX decisions | useLiquidityScoring
client/src/hooks/useKeyboardNavigation.ts | Keyboard navigation helpers for UI components and lists | useKeyboardNavigation
client/src/hooks/useHistoricalPriceData.ts | Fetches OHLCV and historical price series for charts and backtests | useHistoricalPriceData
client/src/hooks/useHistoricalData.ts | Generic historical data fetching utility for time series | useHistoricalData
client/src/hooks/useFeatureGating.ts | Feature gating hook to enable/disable UI features per DAO/environment | useFeatureGating
client/src/hooks/useFeatureFlags.ts | Exposes feature flags and selectors (`isGovernanceEnabled`, `isAdvancedGovernanceEnabled`) | useFeatureFlags
client/src/hooks/useFearGreed.ts | Fetches market fear/greed indices and normalizes for UI signals | useFearGreed
client/src/hooks/useExchangeData.ts | Aggregates exchange metadata, supported pairs, and market status | useExchangeData
client/src/hooks/useDebounce.ts | Utility hook for debouncing values and callbacks | useDebounce
client/src/hooks/useDashboardPersona.ts | Persona selection/state hook for dashboards (trader, analyst, treasury) | useDashboardPersona
client/src/hooks/useDashboardData.ts | Composite dashboard hook fetching governance, treasury, and vault metrics | useDashboardData
client/src/hooks/useContributionAnalytics.ts | Analytics hook for contribution metrics, referrals, and member activity | useContributionAnalytics
client/src/hooks/useCoinGecko.ts | Lightweight wrapper to fetch CoinGecko price and metadata endpoints | useCoinGecko
client/src/hooks/useAuth.ts | Authentication and session management hook for user login/logout and token refresh | useAuth
client/src/hooks/useAccount.ts | Primary account hook exposing current wallet/account and connection state | useAccount
client/src/hooks/useAccountBalance.ts | Fetches native and token balances for the connected account | useAccountBalance
client/src/hooks/useAccountTokens.ts | Lists ERC-20/ERC-721 assets for an account with pagination | useAccountTokens
client/src/hooks/useAssetMetadata.ts | Resolves asset metadata (icons, names, symbols, decimals) from on-chain and off-chain sources | useAssetMetadata
client/src/hooks/useAppConfig.ts | Loads app-level configuration and feature defaults from server | useAppConfig
client/src/hooks/useAmmRouter.ts | AMM routing helper hook for estimating swaps across DEXs and pools | useAmmRouter
client/src/config/apiConfig.tsx | API client configuration and environment-aware endpoints for frontend data fetching and feature toggles | apiConfig (exports: getApiBaseUrl, apiClient)
client/src/config/daoTypes.config.ts | DAO types configuration mapping templates to modules, durations, fees, and module defaults | DAO_TYPE_CONFIG (exports: DAO_TYPE_CONFIG, getDaoTypeConfig)
client/src/config/treasury.config.ts | Treasury configuration matrix mapping DAO types to supported chains/assets, multisig rules, and helper getters | TREASURY_MATRIX, getTreasuryConfigForDAOType
client/src/config/wagmi.ts | Wallet and chain provider configuration for `wagmi` including connectors and chain definitions | wagmiConfig (exports: wagmiClient, connectors)
client/src/components/WithdrawalModal.tsx | Reusable withdrawal modal used across wallets and vault UIs | WithdrawalModal
client/src/components/WalletSetup.tsx | Wallet setup and onboarding flow component | WalletSetup
client/src/components/WalletDashboard.tsx | Wallet overview component showing balances, recent txs, and actions | WalletDashboard
client/src/components/wallet/WalletConnectionManager.tsx | Manages wallet connectors and connection state | WalletConnectionManager
client/src/components/wallet/TransactionMonitor.tsx | Monitors and displays pending/confirmed transactions | TransactionMonitor
client/src/components/wallet/TransactionHistory.tsx | Paginated transaction history view component | TransactionHistory
client/src/components/wallet/TokenSwapModal.tsx | Modal UI to perform on-chain token swaps | TokenSwapModal
client/src/components/wallet/DepositWithdrawFlow.tsx | Guided deposit/withdraw multi-step flow UI | DepositWithdrawFlow
client/src/components/wallet/PortfolioOverview.tsx | Portfolio overview with balances and allocation charts | PortfolioOverview
client/src/components/voting-modal.tsx | Generic voting modal used by governance flows | VotingModal
client/src/components/VoteDelegationPanel.tsx | UI panel to delegate votes to another signer/member | VoteDelegationPanel
client/src/components/vault_selector.tsx | Vault selector component used in deposit/withdraw flows | VaultSelector
client/src/components/vault_proposal_link_panel.tsx | Links vault actions to governance proposals UI | VaultProposalLinkPanel
client/src/components/vault_disbursement_alert.tsx | Alert component showing pending vault disbursements | VaultDisbursementAlert
client/src/components/vaults/VaultListPage.tsx | Page listing vaults with filters and TVL metrics | VaultListPage
client/src/components/vaults/VaultDetailPage.tsx | Vault detail page with performance and transactions | VaultDetailPage
client/src/components/vaults/MyVaultsPage.tsx | User-specific vault list and quick actions | MyVaultsPage
client/src/components/vault/WithdrawalModal.tsx | Vault-specific withdrawal modal with validations | VaultWithdrawalModal
client/src/components/vault/VaultTypeSelector.tsx | Selector for vault types in the creation flow | VaultTypeSelector

# Bridge, Relayer, Symbols, and DEX
server/services/bridge/bridgeService.ts | Server-side bridge adapter: prepares cross-chain transfer payloads, selects bridge provider, performs pre-checks and fee estimation (guarded by `FEATURE_SPECIAL_BRIDGE`) | BridgeService
server/services/bridge/bridgeProviders/* | Individual bridge provider integrations (Hop, Connext, custom providers), quote/fee helpers, and relayer hooks | bridge providers
server/services/relayer/relayerService.ts | Relayer executor: constructs, signs (using `RELAYER_PRIVATE_KEY`), and submits cross-chain relay transactions; includes retry/idempotency helpers | RelayerService
server/services/relayer/txQueue.ts | Queue, retry, and webhook callback logic for relayer-submitted txs; ensures delivery and confirmation tracking | Relayer queue worker
server/config/symbolUniverseConfig.ts | Canonical symbol universe mappings and normalization rules used by price oracles, trading, SOR, and CCXT adapters | symbolUniverseConfig
server/services/priceOracle.ts | Price Oracle Service (maps symbol universe to CEX/DEX/CoinGecko sources) used by routing and pricing | PriceOracleService
server/services/dex/sor.ts | Smart Order Router (SOR) / routing optimizer that scores routes across AMMs, liquidity sources and simulators | SmartOrderRouter
server/services/dex/ammAdapter.ts | AMM adapter for on-chain pool interactions: pool discovery, swap calldata builder, slippage estimation | AMMAdapter
server/services/dex/dexSimulator.ts | DEX liquidity and slippage simulator used by SOR and `tradingDexSimulator.ts` for route evaluation | DexSimulator
client/src/hooks/useAmmRouter.ts | Frontend AMM routing helper (estimates routes/prices across DEXs and pools) that complements server SOR | useAmmRouter
client/src/components/crosschain/* | UI components for bridge flows (risk panels, price-impact, transfer-status, destination selectors) | crosschain UI

server/services/bridgeRelayerService.ts | Background bridge/relayer worker that polls `crossChainTransfers`, validates source chain events, and executes destination-side completion via configured bridge contracts; uses `ChainRegistry` and `RELAYER_PRIVATE_KEY`; exposes `bridgeRelayerService.start()` | BridgeRelayerService (singleton)
server/services/symbolUniverseService.ts | Runtime symbol discovery and price resolution service: performs CCXT market discovery (with 15s timeout), generates systematic fallback pairs, caches supported pairs and prices, exposes `getSupportedPairs`, `getPrice`, and background refresh logic | SymbolUniverseService (EventEmitter)
server/config/symbolUniverseConfig.ts | Canonical symbol universe config: CEX/DEX/oracle source definitions, exchange-specific `pairFallbacks`, supported quote currencies, discovery phases, and DEX router/factory addresses used by symbol and price services | SYMBOL_UNIVERSE_CONFIG
server/services/tradingDexSimulator.ts | Trading and DEX simulators covering Spot, Margin, Perpetuals, DEX swaps, and Flash Loans with slippage, liquidity, and funding modeling used for route evaluation and risk analysis | SpotTradeSimulator, DexSwapSimulator, PerpetualsFuturesSimulator
client/src/components/SmartOrderRouter.tsx | Frontend Smart Order Router UI component integrating multi-exchange price feeds, order-splitting recommendations, venue scoring (DEX vs CEX), and routing visualization; used on `ExchangeMarkets` page | SmartOrderRouter (component)


client/src/components/vault/VaultCreationWizard.tsx | Multi-step vault creation wizard UI | VaultCreationWizard
client/src/components/vault/DepositModal.tsx | Modal to deposit assets into a vault | VaultDepositModal
client/src/components/UserFollowCard.tsx | UI card for following/unfollowing users and quick profile info | UserFollowCard
client/src/components/dao-treasury.tsx | DAO treasury overview and quick actions component | DaoTreasuryOverview
client/src/components/dao-creation/NarrativeCreateDAO.tsx | Rich narrative DAO creation UI with guided steps | NarrativeCreateDAO
client/src/components/dao-creation/CreateDAOIntegration.tsx | Integration layer for DAO creation plugins and providers | CreateDAOIntegration
client/src/components/dao-creation/AdaptiveUIComponents.tsx | Adaptive UI pieces used by DAO creation flows | AdaptiveUIComponents
client/src/components/dao-chat.tsx | DAO-scoped chat interface component | DaoChat
client/src/components/CustomRules.tsx | UI for custom rule builder and rule list | CustomRules
client/src/components/crosschain/TrustBadges.tsx | Trust badges used in cross-chain UX to show protocol trust signals | TrustBadges
client/src/components/crosschain/TokenSelector.tsx | Cross-chain token selector with routing hints | CrosschainTokenSelector
client/src/components/crosschain/StickyCTA.tsx | Persistent call-to-action used in cross-chain flows | CrosschainStickyCTA
client/src/components/crosschain/StepProgress.tsx | Step progress bar used in cross-chain flows | CrosschainStepProgress
client/src/components/crosschain/RouteInfo.tsx | Displays selected cross-chain route details and ETA | CrosschainRouteInfo
client/src/components/crosschain/RiskCollapse.tsx | Collapsible risk details panel for bridge flows | CrosschainRiskCollapse
client/src/components/crosschain/PriceImpact.tsx | Price impact estimation UI for swaps/bridges | PriceImpact
client/src/components/crosschain/FeeIndicator.tsx | Fee breakdown indicator for cross-chain quotes | FeeIndicator
client/src/components/CreateTaskModal.tsx | Modal to create tasks in the workspace task system | CreateTaskModal
client/src/components/Coordinator/CoordinatorDashboard.tsx | Dashboard for coordinators with task queues and metrics | CoordinatorDashboard
client/src/components/contributor_list.tsx | List component showing contributors and activity stats | ContributorList
client/src/components/contribution-modal.tsx | Modal to submit contributions or pledges | ContributionModal
client/src/components/ConfirmDialog.tsx | Reusable confirm dialog used across the app | ConfirmDialog
client/src/components/AssetIntelligenceDashboard.tsx | Dashboard displaying asset intelligence and signals | AssetIntelligenceDashboard
client/src/components/ArbitrageOpportunitiesCard.tsx | Card that surfaces arbitrage opportunities and quick actions | ArbitrageOpportunitiesCard
client/src/components/AnnouncementsBanner.tsx | Global announcements banner displayed in header | AnnouncementsBanner
client/src/components/analytics/VaultAnalyticsTab.tsx | Tab component showing vault analytics and charts | VaultAnalyticsTab
client/src/components/analytics/ContributionAnalyticsTab.tsx | Contribution analytics view used in analytics dashboard | ContributionAnalyticsTab
client/src/components/analytics/AnalyticsDashboard.tsx | Aggregated analytics dashboard for platform metrics | AnalyticsDashboard
client/src/components/ui/ToastProvider.tsx | Toast provider and API used by `useNotifications` | ToastProvider
client/src/components/ui/toaster.tsx | Toaster integration for rendering notifications | Toaster
client/src/components/ui/modal.tsx | Standard modal component wrapper for UI library | Modal
client/src/components/ui/button.tsx | Design-system `Button` component used across app | Button
client/src/components/wallet/WithdrawalModal.tsx | Wallet withdrawal modal variant with confirmations and gas options | WalletWithdrawalModal
client/src/components/wallet/WalletBackupReminder.tsx | UI reminder to back up wallet seed/keys | WalletBackupReminder
client/src/components/wallet/WalletBackupManager.tsx | Wallet backup management UI for export/import of keys | WalletBackupManager
client/src/components/wallet/TwoFAVerificationModal.tsx | Modal for two-factor authentication verification | TwoFAVerificationModal
client/src/components/wallet/PaymentRequestModal.tsx | Modal to request payments from other users | PaymentRequestModal
client/src/components/wallet/PaymentLinkModal.tsx | Modal to create shareable payment links | PaymentLinkModal
client/src/components/wallet/PanelShell.tsx | Shell layout for wallet panels and subviews | PanelShell
client/src/components/wallet/LockedSavingsSection.tsx | UI for locked savings products and withdrawals | LockedSavingsSection
client/src/components/wallet/LiquiditySurface.tsx | Visual liquidity surface component for portfolio insights | LiquiditySurface
client/src/components/wallet/GiftCardVoucher.tsx | Gift card and voucher UI component | GiftCardVoucher
client/src/components/wallet/FiatOnRamp.tsx | Fiat on-ramp integration UI for buying crypto | FiatOnRamp
client/src/components/wallet/ExchangeRateWidget.tsx | Widget showing exchange rates and conversions | ExchangeRateWidget
client/src/components/wallet/EscrowInitiator.tsx | Initiate escrow flows with counterparty selection | EscrowInitiator
client/src/components/wallet/EscrowHistory.tsx | Shows history of escrowed transactions | EscrowHistory
client/src/components/wallet/DeviceManagement.tsx | Manage trusted devices for wallet access | DeviceManagement
client/src/components/wallet/DeploymentSurface.tsx | Deployment surface UI used by wallet/agent features | DeploymentSurface
client/src/components/wallet/CommunityVaultSection.tsx | Community vault summary and quick actions | CommunityVaultSection
client/src/components/wallet/CapitalLayer.tsx | Capital layer visualization for wallets/treasury | CapitalLayer
client/src/components/wallet/CapitalHeader.tsx | Header UI for capital-related pages | CapitalHeader
client/src/components/wallet/BiometricUnlock.tsx | Biometric unlock UI integration for devices | BiometricUnlock
client/src/components/wallet/BillSplit.tsx | UI to split bills among members | BillSplit
client/src/components/wallet/BalanceTrendsChart.tsx | Chart showing balance trends over time | BalanceTrendsChart
client/src/components/wallet/BalanceOverview.tsx | Compact balance overview component | BalanceOverview
client/src/components/wallet/BalanceAggregatorWidget.tsx | Aggregates balances across chains/accounts | BalanceAggregatorWidget
client/src/components/wallet/BackupWalletModal.tsx | Modal to guide wallet backup/export | BackupWalletModal
client/src/components/wallet/AccountSelector.tsx | Account picker used in wallet UIs | AccountSelector
client/src/components/voting-modal.tsx | Voting modal for proposal votes (duplicate entry consolidated) | VotingModal
client/src/components/VoteDelegationPanel.tsx | (duplicate) Vote delegation UI | VoteDelegationPanel
client/src/components/vault_selector.tsx | (duplicate) Vault selector component | VaultSelector
client/src/components/vault_proposal_link_panel.tsx | (duplicate) Vault-proposal link panel | VaultProposalLinkPanel
client/src/components/vault_disbursement_alert.tsx | (duplicate) Vault disbursement alert | VaultDisbursementAlert
client/src/components/vaults/VaultListPage.tsx | (duplicate) Vault list page | VaultListPage
client/src/components/vaults/VaultDetailPage.tsx | (duplicate) Vault detail page | VaultDetailPage
client/src/components/vaults/MyVaultsPage.tsx | (duplicate) My vaults page | MyVaultsPage
client/src/components/vault/WithdrawalModal.tsx | (duplicate) Vault withdrawal modal | VaultWithdrawalModal
client/src/components/vault/VaultTypeSelector.tsx | (duplicate) Vault type selector | VaultTypeSelector
client/src/components/vault/VaultCreationWizard.tsx | (duplicate) Vault creation wizard | VaultCreationWizard
client/src/components/vault/GoalVaultsManager.tsx | Manager UI for goal-based vaults and goals list | GoalVaultsManager
client/src/components/vault/VaultContextIndicator.tsx | Indicator showing current vault context and status | VaultContextIndicator
client/src/components/vault/DepositModal.tsx | (duplicate) Vault deposit modal | VaultDepositModal
client/src/components/dao-treasury.tsx | (duplicate) DAO treasury overview | DaoTreasuryOverview
client/src/components/dao-creation/NarrativeCreateDAO.tsx | (duplicate) Narrative DAO creation UI | NarrativeCreateDAO
client/src/components/dao-creation/CreateDAOIntegration.tsx | (duplicate) DAO creation integration layer | CreateDAOIntegration
client/src/components/dao-creation/AdaptiveUIComponents.tsx | (duplicate) Adaptive DAO UI components | AdaptiveUIComponents
client/src/components/dao-chat.tsx | (duplicate) DAO chat component | DaoChat
client/src/components/CustomRules.tsx | (duplicate) Custom rules UI | CustomRules
client/src/components/crosschain/TrustBadges.tsx | (duplicate) Trust badges | TrustBadges
client/src/components/crosschain/TokenSelector.tsx | (duplicate) Cross-chain token selector | CrosschainTokenSelector
client/src/components/crosschain/StickyCTA.tsx | (duplicate) Sticky CTA for cross-chain | CrosschainStickyCTA
client/src/components/crosschain/StepProgress.tsx | (duplicate) Cross-chain step progress | CrosschainStepProgress
client/src/components/crosschain/RouteInfo.tsx | (duplicate) Route info for cross-chain | CrosschainRouteInfo
client/src/components/crosschain/RiskCollapse.tsx | (duplicate) Risk collapse panel | CrosschainRiskCollapse
client/src/components/crosschain/PriceImpact.tsx | (duplicate) Price impact UI | PriceImpact
client/src/components/crosschain/FeeIndicator.tsx | (duplicate) Fee indicator | FeeIndicator
client/src/components/CreateTaskModal.tsx | (duplicate) Create task modal | CreateTaskModal
client/src/components/Coordinator/CoordinatorDashboard.tsx | (duplicate) Coordinator dashboard | CoordinatorDashboard
client/src/components/contributor_list.tsx | (duplicate) Contributor list | ContributorList
client/src/components/contribution-modal.tsx | (duplicate) Contribution modal | ContributionModal
client/src/components/ConfirmDialog.tsx | (duplicate) Confirm dialog | ConfirmDialog
client/src/components/AssetIntelligenceDashboard.tsx | (duplicate) Asset intelligence dashboard | AssetIntelligenceDashboard
client/src/components/ArbitrageOpportunitiesCard.tsx | (duplicate) Arbitrage card | ArbitrageOpportunitiesCard
client/src/components/AnnouncementsBanner.tsx | (duplicate) Announcements banner | AnnouncementsBanner
client/src/components/analytics/VaultAnalyticsTab.tsx | (duplicate) Vault analytics tab | VaultAnalyticsTab
client/src/components/analytics/ContributionAnalyticsTab.tsx | (duplicate) Contribution analytics tab | ContributionAnalyticsTab
client/src/components/analytics/AnalyticsDashboard.tsx | (duplicate) Analytics dashboard | AnalyticsDashboard
client/src/components/ui/toaster.tsx | (duplicate) Toaster integration | Toaster
client/src/components/ui/modal.tsx | (duplicate) Modal wrapper | Modal
client/src/components/ui/button.tsx | (duplicate) Button component | Button
client/src/components/ui/__tests__/toast-design.test.tsx | UI toast design unit tests | toast tests
client/src/components/ui/__tests__/tabs-design.test.tsx | UI tabs design unit tests | tabs tests
client/src/components/ui/__tests__/spinner-design.test.tsx | UI spinner tests | spinner tests
client/src/components/ui/__tests__/select-design.test.tsx | UI select tests | select tests
client/src/components/ui/__tests__/popover-design.test.tsx | UI popover tests | popover tests
client/src/components/ui/__tests__/modal-design.test.tsx | UI modal tests | modal tests
client/src/components/ui/__tests__/input-design.test.tsx | UI input tests | input tests
client/src/components/ui/__tests__/icon-design.test.tsx | UI icon tests | icon tests
client/src/components/ui/__tests__/dropdown-design.test.tsx | UI dropdown tests | dropdown tests
client/src/components/ui/__tests__/card-design.test.tsx | UI card tests | card tests
client/src/components/ui/__tests__/button-design.test.tsx | UI button tests | button tests
client/src/components/ui/__tests__/badge-design.test.tsx | UI badge tests | badge tests
client/src/components/ui/use-toast.tsx | `use-toast` hook used by UI toaster | useToast
client/src/components/ui/tooltip.tsx | Tooltip primitive component | Tooltip
client/src/components/ui/toggle.tsx | Toggle switch component | Toggle
client/src/components/ui/toggle-group.tsx | Toggle group component | ToggleGroup
client/src/components/ui/ToastProvider.tsx | (duplicate) Toast provider | ToastProvider
client/src/components/ui/toaster.tsx | (duplicate) Toaster | Toaster
client/src/components/ui/toast.tsx | Toast presentation component | Toast
client/src/components/ui/toast-design.tsx | Toast design utilities and styles | ToastDesign
client/src/components/ui/textarea.tsx | Textarea component with autosize | Textarea
client/src/components/ui/text.tsx | Typography primitives and text components | Text
client/src/components/ui/text.test.tsx | Typographic unit tests | text tests
client/src/components/ui/text.stories.tsx | Storybook stories for typography | text stories
client/src/components/ui/tabs.tsx | Tabs component | Tabs
client/src/components/ui/tabs-design.tsx | Tabs design helpers | TabsDesign
client/src/components/ui/table.tsx | Table primitive component | Table
client/src/components/ui/switch.tsx | Switch component | Switch
client/src/components/ui/surface.tsx | Surface/card component | Surface
client/src/components/ui/surface.test.tsx | Surface unit tests | surface tests
client/src/components/ui/surface.stories.tsx | Surface storybook | surface stories
client/src/components/ui/stack.tsx | Layout stack primitive for vertical spacing | Stack
client/src/components/ui/stack.test.tsx | Unit tests for `Stack` | stack tests
client/src/components/ui/stack.stories.tsx | Storybook stories for `Stack` | stack stories
client/src/components/ui/spinner.css | Spinner styles used by loading components | spinner css
client/src/components/ui/spinner-design.tsx | Spinner visual variants for design system | spinner design
client/src/components/ui/slider.tsx | Range slider component | Slider
client/src/components/ui/skip-link.tsx | Accessibility skip link for navigating to main content | SkipLink
client/src/components/ui/skeleton.tsx | Skeleton loader primitives | Skeleton
client/src/components/ui/skeleton-card.tsx | Card-shaped skeleton placeholder | SkeletonCard
client/src/components/ui/sidebar.tsx | Sidebar navigation component | Sidebar
client/src/components/ui/shell.tsx | App shell layout component | Shell
client/src/components/ui/sheet.tsx | Sheet/panel UI primitive | Sheet
client/src/components/ui/separator.tsx | Visual separator component | Separator
client/src/components/ui/select.tsx | Select input component with options | Select
client/src/components/ui/select-design.tsx | Design helpers for Select component | SelectDesign
client/src/components/ui/scroll-area.tsx | Scrollable area component with styling | ScrollArea
client/src/components/ui/resizable.tsx | Resizable panel helper component | Resizable
client/src/components/ui/radio-group.tsx | Radio group component | RadioGroup
client/src/components/ui/progress.tsx | Progress bar component | Progress
client/src/components/ui/popover.tsx | Popover primitive for contextual UI | Popover
client/src/components/ui/popover-design.tsx | Popover design variants | PopoverDesign
client/src/components/ui/pagination.tsx | Pagination controls for lists and tables | Pagination
client/src/components/ui/page-loading.tsx | Full-page loading UI with spinner | PageLoading
client/src/components/ui/navigation-menu.tsx | Navigation menu component for header | NavigationMenu
client/src/components/ui/modal-design.tsx | Design variants for modal presentations | ModalDesign
client/src/components/ui/menubar.tsx | Menubar/top navigation primitive | Menubar
client/src/components/ui/logo.tsx | Brand logo component and variants | Logo
client/src/components/ui/loading-spinner.tsx | Loading spinner component wrapper | LoadingSpinner
client/src/components/ui/label.tsx | Form label component with accessibility helpers | Label
client/src/components/ui/input.tsx | Input field component with validation states | Input
client/src/components/ui/input.test.tsx | Input unit tests | input tests
client/src/components/ui/input.stories.tsx | Input stories for design system | input stories
client/src/components/ui/input-otp.tsx | OTP input component for 2FA flows | InputOTP
client/src/components/ui/input-design.tsx | Input design helpers | InputDesign
client/src/components/ui/index.ts | UI primitives index export | UIIndex
client/src/components/ui/icon-design.tsx | Icon design utilities and variants | IconDesign
client/src/components/ui/hover-card.tsx | Hover card UI primitive with preview content | HoverCard
client/src/components/ui/grid.tsx | Grid layout primitive | Grid
client/src/components/ui/glowing-branding.tsx | Decorative glowing branding element | GlowingBranding
client/src/components/ui/form.tsx | Form layout and field helpers | Form
client/src/components/ui/focus-trap.tsx | Focus trap hook/component for modal accessibility | FocusTrap
client/src/components/ui/dropdown-menu.tsx | Dropdown menu component | DropdownMenu
client/src/components/ui/dropdown-design.tsx | Design utilities for dropdowns | DropdownDesign
client/src/components/ui/drawer.tsx | Drawer panel component for side content | Drawer
client/src/components/ui/dialog.tsx | Dialog primitive for confirmations and flows | Dialog
client/src/components/ui/date-picker-with-range.tsx | Date picker component supporting ranges | DatePickerRange
client/src/components/ui/context-menu.tsx | Context menu component for right-click actions | ContextMenu
client/src/components/ui/COMPONENTS.md | Developer-facing component registry and notes | ComponentsDoc
client/src/components/ui/command.tsx | Command palette component | CommandPalette
client/src/components/ui/collapsible.tsx | Collapsible/accordion primitive | Collapsible
client/src/components/ui/checkbox.tsx | Checkbox form control | Checkbox
client/src/components/TreasuryManagement.tsx | (duplicate) Treasury management component | TreasuryManagement
client/src/components/TreasuryIntelligenceDashboard.tsx | (duplicate) Treasury intelligence dashboard | TreasuryIntelligenceDashboard
client/src/components/treasury/ApprovalDashboard.tsx | Treasury approvals dashboard component | ApprovalDashboard
client/src/components/trading/YukiDashboard.tsx | Trading dashboard variant used in trading workspace | YukiDashboard
client/src/components/trading/VisualStrategyBuilder.tsx | Visual strategy builder UI for trading strategies | VisualStrategyBuilder
client/src/components/trading/TreasuryMode.tsx | Trading UI mode optimized for treasury operations | TreasuryMode
client/src/components/trading/StrategyMarketplace.tsx | Marketplace UI for trading strategies | StrategyMarketplace
client/src/components/trading/StrategyDetail.tsx | Detail view for a trading strategy | StrategyDetail
client/src/components/trading/PresetsManager.tsx | Manager for trading presets and saved layouts | PresetsManager
client/src/components/trading/NodeInspector.tsx | Inspector tool to debug strategy nodes and state | NodeInspector
client/src/components/trading/NetworkView.tsx | Network topology view used by trading workspace | NetworkView
client/src/components/trading/MiniGraph.tsx | Small sparkline/mini graph component used in trading lists | MiniGraph
client/src/components/trading/MarketSignals.tsx | Market signals panel showing detected signals | MarketSignals
client/src/components/InvitationManagement.tsx | Invitation management UI for inviting members | InvitationManagement
client/src/components/InlineElderSelector.tsx | Inline elder selection component (multisig signers) | InlineElderSelector
client/src/components/dao-creation/AdaptiveUIComponents.tsx | (duplicate) Adaptive UI components | AdaptiveUIComponents
client/src/components/dao-creation/CreateDAOIntegration.tsx | (duplicate) DAO create integrations | CreateDAOIntegration
client/src/components/dao-creation/NarrativeCreateDAO.tsx | (duplicate) Narrative DAO create | NarrativeCreateDAO
client/src/components/dao-creation/AdaptiveUIComponents.tsx | (duplicate) Adaptive UI components duplicate | AdaptiveUIComponents
client/src/components/DaoSwitcher.tsx | (duplicate) DAO switcher component | DaoSwitcher
client/src/components/DaoCreationConfirmDialog.tsx | Confirmation dialog specific to DAO creation flow | DaoCreationConfirmDialog
client/src/components/DaoCreationErrorHandler.tsx | Error handler UI for DAO creation | DaoCreationErrorHandler
client/src/components/DaoCreationEligibilityCheck.tsx | Eligibility validation UI for DAO creation | DaoCreationEligibilityCheck
client/src/components/DaoTemplates.tsx | Display/list DAO templates and examples | DaoTemplates
client/src/components/DaoVerificationBadge.tsx | Badge component indicating DAO verification status | DaoVerificationBadge
client/src/components/DaoTierRequirements.tsx | UI listing tier requirements for DAO templates | DaoTierRequirements
client/src/components/DaoOfTheWeekBanner.tsx | Rotating banner highlighting a DAO of the week | DaoOfTheWeekBanner
client/src/components/DAOKaizenDashboard.tsx | Kaizen dashboard for DAO continuous improvement metrics | DAOKaizenDashboard
client/src/components/DAOKaizenDashboard.tsx | (duplicate) Kaizen dashboard duplicate | DAOKaizenDashboard
client/src/components/DaoExtensionsPanel.tsx | Panel listing available DAO extensions and toggles | DaoExtensionsPanel
client/src/components/DaoSwitcher.tsx | (duplicate) DAO switcher duplicate | DaoSwitcher
client/src/components/dashboard/UnifiedDashboardPage.tsx | Unified dashboard page composing various metric panels | UnifiedDashboardPage
client/src/components/dashboard/UnifiedDashboard.tsx | Unified dashboard layout and data orchestration | UnifiedDashboard
client/src/components/dashboard/UnifiedBalance.tsx | Component showing unified balance across wallets and vaults | UnifiedBalance
client/src/components/dashboard/RealtimeActivityFeed.tsx | Real-time activity feed used across dashboards | RealtimeActivityFeed
client/src/components/dashboard/PresenceIndicators.tsx | Presence/online indicators for users in dashboard | PresenceIndicators
client/src/components/dashboard/PlatformOverviewCard.tsx | Card summarizing platform-wide metrics and health | PlatformOverviewCard
client/src/components/dashboard/PersonalizedDashboard.tsx | Personalized dashboard view per-user preferences | PersonalizedDashboard
client/src/components/dashboard/OkediDashboard.tsx | Variant dashboard for Okedi integration | OkediDashboard
client/src/components/dashboard/AssetListTable.tsx | Asset list table used in dashboards and treasury views | AssetListTable
client/src/components/dashboard/DaoTreeSection.tsx | DAO tree/organization section for dashboards | DaoTreeSection
client/src/components/dashboard/hooks/useUnifiedDashboardData.ts | Dashboard data hook composing many data sources | useUnifiedDashboardData
client/src/components/dashboard/hooks/useWebSocket.ts | Local websocket hook variant used by dashboards | useWebSocketDashboard
client/src/components/OpportunityCard.tsx | Card component used to surface opportunities to users | OpportunityCard
client/src/components/proposal-like-button.tsx | Like button for proposals and social actions | ProposalLikeButton
client/src/components/proposal-comments.tsx | Comments component for proposals with threading | ProposalComments
client/src/components/proposal-card.tsx | Proposal preview card used in lists | ProposalCard
client/src/components/poll-proposal-card.tsx | Poll-style proposal card variant | PollProposalCard
client/src/components/PersonaSelector.tsx | UI to select a persona (trader, analyst, elder) | PersonaSelector
client/src/components/PersonaProfile.tsx | Persona profile snippet component | PersonaProfile
client/src/components/PersonaModeSelector.tsx | Persona mode selector component | PersonaModeSelector
client/src/components/PendingInvites.tsx | Pending invites list and actions | PendingInvites
client/src/components/PaymentModal.tsx | Payment modal for sending funds | PaymentModal
client/src/components/OrderBookVisualization.tsx | Visual order book UI used in trading pages | OrderBookVisualization
client/src/components/orderBookStyles.tsx | Styles and helper classes for order book visuals | OrderBookStyles
client/src/components/OpportunityScannerDashboard.tsx | Dashboard scanning for trading opportunities | OpportunityScannerDashboard
client/src/components/RotationWidget.tsx | (duplicate) rotation widget | RotationWidget
client/src/components/settings/TwoFAVerification.tsx | Two-factor verification settings UI | TwoFAVerificationSettings
client/src/components/settings/TwoFASetup.tsx | Two-factor setup UI and QR display | TwoFASetup
client/src/components/settings/SettingsFeatures.tsx | Settings page section for feature toggles | SettingsFeatures
client/src/components/sendTransactionModal.tsx | Modal to send raw transactions via wallet | SendTransactionModal
client/src/components/elders/lumen/EthicalReviewRequest.tsx | Elder Lumen ethical review request UI | EthicalReviewRequest
client/src/components/elders/lumen/EldLumenDashboard.tsx | Lumen dashboard for elders | EldLumenDashboard
client/src/components/elders/lumen/index.ts | Elders Lumen index exports | EldLumenIndex
client/src/components/elders/lumen/ForecastChart.tsx | Forecast chart used in elder dashboards | ForecastChart
client/src/components/elders/lumen/EarlyWarningAlert.tsx | Early warning alert UI for elders | EarlyWarningAlert
client/src/components/RSIChart.tsx | RSI chart component used in trading UIs | RSIChart
client/src/components/rules/RuleCard.tsx | Rule card used in the rules management UI | RuleCard
client/src/components/rules/RuleBuilder.tsx | Visual rule builder for custom rules | RuleBuilder
client/src/components/rules/TemplatesGallery.tsx | Templates gallery for rule templates | TemplatesGallery
client/src/components/rewards/RewardsCard.tsx | Rewards card for incentives and bounties | RewardsCard
client/src/components/notifications/AlertToastManager.tsx | Manager for alert-toasts and critical alerts | AlertToastManager
client/src/components/register1.tsx | Registration UI (legacy variant) | RegisterLegacy
client/src/components/Register.tsx | Registration page/component | Register
client/src/components/PublicImpactFeed.tsx | Public impact feed used for community updates | PublicImpactFeed
client/src/components/proposal_leaderboard.tsx | Leaderboard component for proposal contributors | ProposalLeaderboard
client/src/components/ProposalTemplateSelector.tsx | Selector to choose proposal templates | ProposalTemplateSelector
client/src/components/NotificationPreferences.tsx | Notification preferences settings UI | NotificationPreferences
client/src/components/NotificationCenter.tsx | Notification center UI aggregating alerts and messages | NotificationCenter
client/src/components/navigation.tsx | Global navigation component | Navigation
client/src/components/multisig.tsx | Multisig management overview component | MultisigManager
client/src/components/layouts/breadcrumb-nav.tsx | Breadcrumb navigation layout | BreadcrumbNav
client/src/components/layouts/header-nav.tsx | Header navigation layout | HeaderNav
client/src/components/layouts/form-layout.tsx | Form layout helper | FormLayout
client/src/components/layouts/detail-layout.tsx | Detail page layout used by content pages | DetailLayout
client/src/components/layouts/dashboard-layout.tsx | Dashboard page layout | DashboardLayout
client/src/components/layouts/sidebar-nav.tsx | Sidebar navigation layout | SidebarNav
client/src/components/layouts/sidebar-nav-rbac.tsx | RBAC-enabled sidebar nav supporting role filters | SidebarNavRBAC
client/src/components/layouts/list-layout.tsx | List layout for table and list pages | ListLayout
client/src/components/morio/MorioChat.tsx | Morio chat main component | MorioChat
client/src/components/morio/ConfirmMorioActionModal.tsx | Confirm modal for Morio actions | ConfirmMorioActionModal
client/src/components/morio/NotificationToast.tsx | Morio notification toast variant | MorioNotificationToast
client/src/components/morio/MorioMiniWidget.tsx | Small Morio widget used on dashboards | MorioMiniWidget
client/src/components/morio/MorioFAB.tsx | Floating action button for Morio actions | MorioFAB
client/src/components/MovingAverages.tsx | Moving averages chart component | MovingAverages
client/src/components/multisig/SignerCard.tsx | Card representing a multisig signer | SignerCard
client/src/components/multisig/PendingTransactions.tsx | Pending multisig transactions list | PendingMultisigTransactions
client/src/components/multisig/MultisigWizard.tsx | Multisig setup wizard UI | MultisigWizard
client/src/components/multisig/MultisigManager.tsx | Multisig management dashboard | MultisigManager
client/src/components/modals/TransferModal.tsx | Transfer modal used across payments and treasury | TransferModal
client/src/components/modals/SendToDAOMemberModal.tsx | Modal to send funds to DAO members | SendToDAOMemberModal
client/src/components/modals/SendModal.tsx | General send modal for payments | SendModal
client/src/components/modals/SeedPhraseModal.tsx | Modal presenting seed phrase with copy and warnings | SeedPhraseModal
client/src/components/modals/RecurringPaymentModal.tsx | Modal to set up recurring payments | RecurringPaymentModal
client/src/components/modals/ReceiveModal.tsx | Modal showing receive address and QR code | ReceiveModal
client/src/components/modals/CreateMultisigModal.tsx | Modal to create a new multisig wallet | CreateMultisigModal
client/src/components/modals/BillSplitModal.tsx | Modal UI to split a bill among participants | BillSplitModal
hardhat.config.js | Hardhat configuration for local and network-specific Solidity compilation, deployments, and tasks | hardhat config
hardhat.config.ts | TypeScript Hardhat configuration variant used by scripts and deploy tools | hardhat config (ts)
hardhat.config.cjs | CommonJS Hardhat config (compat mode) | hardhat config (cjs)
vite.config.ts | Vite config for frontend build, aliases, and environment injection | viteConfig
drizzle.config.ts | Drizzle-ORM DB config for migrations and model generation | drizzleConfig
tsup.config.ts | Bundler configuration for building server/client packages with `tsup` | tsupConfig
tsconfig.json | TypeScript project configuration (paths, compiler options) used across repo | tsconfig
tsconfig.test.json | TypeScript config for test environment with Jest/ts-jest settings | tsconfig.test
tailwind.config.ts | Tailwind CSS design system config and theme tokens | tailwindConfig
shared/config.ts | Shared runtime configuration helpers and defaults used across server and client | sharedConfig
shared/chainConfiguration.ts | Chain and RPC configuration mapping used by client and server components | chainConfiguration
server/exchanges.config.json | JSON list of supported centralized exchanges and connection metadata for CCXT adapters | exchangesConfig
server/services/tokens.config.json | Token metadata config used by pricing, token lists, and UI components | tokensConfig
server/config/symbolUniverseConfig.ts | Symbol universe definitions and mapping rules for market/price services | symbolUniverseConfig
server/agent-wallet/networks-config.ts | Multi-chain network config for agent wallets: RPCs, explorers, chainIds, gas defaults | networksConfig
server/middleware/rateLimitConfig.ts | Rate-limiter configuration used by API middleware for throttling and burst rules | rateLimitConfig

### Services Inventory — Batch 1 of 3 (100 files)
# The next step will append concise per-file inventory lines for the first 100 files under `server/services/`.
# Batch appended marker: starting batch 1. Subsequent entries will follow in smaller commits to avoid context mismatches.

server/services/WebSocketService.ts | WebSocket server manager: connection lifecycle, subscriptions, and broadcast helpers | WebSocketService
server/services/websocketRealTimeFeeds.ts | Real-time feed adapters to push market/orderbook updates to WS clients | realtime feed adapters
server/services/webSocketPriceStream.ts | Price stream producer for websocket clients (aggregation + smoothing) | price stream
server/services/WebSocketMessageBatcher.ts | Batches and rate-limits websocket messages to avoid bursts | message batcher
server/services/WebSocketHealthMonitor.ts | Health checks and metrics for active WS connections and heartbeat monitoring | health monitor
server/services/WebSocketConnectionManager.ts | Manages low-level WS connections and reconnection strategies | connection manager
server/services/walletAggregatorService.ts | Aggregates balances across chains/accounts for a user or treasury | WalletAggregatorService
server/services/walletAggregatorService.production.ts | Production variant of wallet aggregator with optimized RPC strategies | production config
server/services/wallet-session-service.ts | Session management for connected wallets and ephemeral auth | wallet session service
server/services/wallet-service.ts | Wallet utilities: address resolution, nonce management, transaction helpers | wallet service
server/services/wallet-generation-service.ts | Deterministic wallet generation and key management helpers | wallet generation
server/services/voteDelegationService.ts | Vote delegation logic: delegate records, revocations, and delegation lookups | VoteDelegationService
server/services/volatilityMetricsService.ts | Computes volatility and risk metrics for assets and pairs | volatility metrics
server/services/vaultsSimulator_fixed.ts | Fixed-parameter vault simulator for deterministic tests | vault simulator
server/services/vaultsSimulator.ts | Stochastic vault simulator modeling deposits, withdrawals and yield | vault simulator
server/services/vaultServiceOptimization.mixin.ts | Optimization mixin applied to `vaultService` for performance hooks | mixin
server/services/vaultService.ts | Core vault service: create, deposit, withdraw, rebalance, and accounting | VaultService
server/services/vaultExecutionService.ts | Executes vault rebalances and on-chain operations with retries | VaultExecutionService
server/services/vaultComputationService.ts | NAV, fees, and performance computation engine for vaults | VaultComputationService
server/services/vault/vault-utilities.ts | Utility helpers for vault operations and common helpers | vault utilities
server/services/vault/vault-operations.ts | Low-level vault operation implementations (DB + on-chain coordination) | vault operations
server/services/vault/vault-helpers.ts | Helper functions used across vault modules | helpers
server/services/vault/vault-governance.ts | Vault governance helpers and risk scoring (ties to governance module) | VaultGovernanceService
server/services/vault/vault-creation.ts | Vault creation flow, validation, and factory interactions | vault creation
server/services/vault/vault-analytics.ts | Vault analytics event producers and metric exporters | vault analytics
server/services/vault/types.ts | Type definitions for vault domain objects and payloads | types
server/services/vault/README.md | Vault services README with architecture notes and usage | documentation
server/services/vault/index.ts | Vault services entrypoint re-exports | index
server/services/userSubscriptionService.ts | Manages user subscriptions, webhooks, and notification preferences | UserSubscriptionService
server/services/userNotificationService.ts | Notification delivery service (email, push, ws) and retry logic | NotificationService
server/services/unifiedStatsUpdater.ts | Aggregates and updates unified statistics across subsystems | stats updater
server/services/unifiedStatsListener.ts | Listener for events that update unified stats (event sourcing hooks) | stats listener
server/services/unifiedStatsCache.ts | In-memory/cache layer for unified stats to speed UI reads | stats cache
server/services/unifiedCacheService.ts | Generic unified caching service with invalidation APIs | cache service
server/services/two-fa-service.ts | Two-factor authentication service for accounts (TOTP, SMS hooks) | 2FA service
server/services/tronTransactionSigningService.ts | Tron-specific transaction signing utilities and key handling | Tron signer
server/services/tronIntegrationService.ts | Tron chain integration helpers and provider adapters | Tron integration
server/services/treasuryValidationService.ts | Enforces treasury transfer rules: whitelists, caps, multisig checks | TreasuryValidationService
server/services/treasuryService.ts | DB-backed treasury operations: balances, history, and transfers | TreasuryService
server/services/treasuryReconciliationJob.ts | Periodic reconciliation job comparing on-chain vs computed treasury balances | reconciliation job
server/services/treasuryPriceUpdateService.ts | Applies price updates to treasury positions and emits deltas | treasury price updater
server/services/treasuryMultisigService.ts | Multisig proposal, signing, and execution helpers for treasury flows | multisig service
server/services/treasuryIntelligenceService.ts | Generates treasury intelligence reports and recommendations | intelligence service
server/services/treasury-monitoring.service.ts | Monitoring dashboards and alerts for treasury health | monitoring service
server/services/treasury-intelligence.service.ts | Alternative name/export for treasury intelligence helpers | intelligence alias
server/services/transfer-service.ts | Generic transfer orchestration for internal transfers and hooks | transfer service
server/services/transactionMonitor.ts | Tracks pending transactions, confirmations and webhooks | transaction monitor
server/services/transactionLimitService.ts | Enforces transaction limits, rate caps and throttling per account | limit service
server/services/transaction-service.ts | Transaction creation helpers, persistence, and status updates | transaction service
server/services/tradingDexSimulator.ts | DEX and trading simulators for route evaluation and risk modeling | trading Dex simulators
server/services/tokenService.ts | Token metadata, decimals, and symbol normalization helpers | token service
server/services/tokens.config.json | Token metadata JSON used by token services and UI lists | token config
server/services/tokenRegistry.ts | Registry of known tokens and on-chain discovery helpers | token registry
server/services/tokenBlacklist.ts | Blacklist management for tokens not allowed for trading/treasury | token blacklist
server/services/timeframeUtils.ts | Timeframe conversion and utilities for indicators and charts | timeframe utils
server/services/tierThreeSimulatorsReferral.ts | Specialty simulator for referral-tier behaviors | referral simulator
server/services/tierThreeSimulatorsNFT.ts | NFT-focused simulator for tiered offerings and events | NFT simulator
server/services/tierThreeSimulatorsMicro.ts | Micro-simulators for small-scale strategy testing | micro simulator
server/services/technicalIndicators.ts | Computes RSI, MACD, moving averages and other indicators | technical indicators
server/services/technicalAnalysisService.ts | Aggregates technical indicators into signals and alerts | TA service
server/services/technicalAnalysisPropagationAdapter.ts | Adapter to propagate TA signals to downstream systems | propagation adapter
server/services/taxReportingService.ts | Prepares tax-reporting exports and transaction summaries | tax reporting
server/services/taskManagementService.ts | Task CRUD, assignment, and workflow orchestration service | task management
server/services/symbolUniverseService.ts | Symbol discovery and normalization with CCXT/timeouts and fallbacks | SymbolUniverseService
server/services/subscriptionService.ts | Pub/sub subscription manager and delivery guarantees | subscription service
server/services/strategyStatsUpdater.ts | Updates aggregated strategy statistics and performance metrics | strategy stats updater
server/services/strategyOptimizerService.ts | Strategy optimizer evaluating param sweeps and backtests | optimizer service
server/services/strategyFreqtradeIntegration.ts | Integration shim for Freqtrade strategies and adapters | freqtrade integration
server/services/strategyFreqtradeIntegration.production.ts | Production variant of freqtrade integration with hardened settings | production variant
server/services/strategyDashboardService.ts | Provides metrics and datasets for strategy dashboard views | strategy dashboard
server/services/strategyDashboardOptimization.mixin.ts | Optimization mixin for strategy dashboard performance | mixin
server/services/stakingSimulator.ts | Simulates staking rewards, epochs and validator behaviors | staking simulator
server/services/stableRiskMonitorService.ts | Monitors stablecoin exposures and risk indicators | stable risk monitor
server/services/stableOutflowModule.ts | Handles stablecoin outflow detection and mitigation hooks | outflow module
server/services/stableInflowModule.ts | Handles stablecoin inflow tracking and deposit normalization | inflow module
server/services/stableAssetRegistryService.ts | Registry and metadata for stable assets across chains | stable asset registry
server/services/solanaTransactionSigningService.ts | Solana transaction signing helpers and key wrappers | Solana signer
server/services/solanaIntegrationService.ts | Solana chain integration adapters and RPC helpers | Solana integration
server/services/softDeleteService.ts | Soft-delete helpers and recovery utilities for DB records | soft-delete service
server/services/SocketIOWebSocketService.ts | Socket.IO wrapper for WebSocket clients and namespaces | SocketIO service
server/services/snapshotGovernanceService.ts | Snapshot.org integration and fallback governance metrics fetcher | Snapshot governance
server/services/smartRouter.ts | Smart routing engine for order splitting across venues (SOR) | smart router
server/services/smartRetryLogicService.ts | Centralized retry logic used by long-running operations | retry logic
server/services/simulatorIndex.ts | Index of available simulators and test harnesses | simulator index
server/services/simulationFramework.ts | Simulation scaffolding and runner used by multiple simulators | simulation framework
server/services/serviceAccountManager.ts | Manages service accounts, keys and permissions | service account manager
server/services/rules-integration.ts | Integration layer for business rules engines and external rules | rules integration
server/services/rule-engine.ts | Core rule evaluation engine and policy evaluation | rule engine
server/services/reversibilityService.ts | Provides reversible-operation support and compensation flows | reversibility service
server/services/revenueService.ts | Revenue accounting and fee collection helpers | revenue service
server/services/retryService.ts | Generic retry queue with backoff and idempotency helpers | retry service
server/services/reputationPortabilityService.ts | Services to migrate or map reputation across DAOs/users | reputation portability
server/services/referral-integration.ts | Referral program integration and reward distribution | referral integration
server/services/redis.ts | Redis client wrapper and connection management for services | redis client
server/services/recurringPaymentService.ts | Handles scheduled recurring payments and billing flows | recurring payments
server/services/recurringAndBillSimulator.ts | Simulator for recurring payments and billing behaviors | billing simulator
server/services/rebalancingService.ts | Rebalance planner and execution engine for portfolios/vaults | rebalancer
server/services/proposalSimulationService.ts | Simulates proposal outcomes and governance impacts | proposal simulator
server/services/proposalRiskAnalyzer.ts | Risk scoring for proposals based on historical metrics | proposal risk analyzer
server/services/propagationMonitoringService.ts | Monitors propagation of events across services and graphs | propagation monitor
server/services/promotion-service.ts | Promotion awarding, campaigns and reward distribution service | promotion service
server/services/productionHardeningService.ts | Production hardening checks and safety monitors | hardening service
server/services/priceOracle.ts | Price oracle aggregator: CEX/DEX/CoinGecko fallbacks and caching | PriceOracleService

### Services Inventory — Batch 2 of 3 (100 files)
# Appending next 100 concise per-file inventory lines for `server/services/` (files 101–200).

server/services/priceHistoryService.ts | Historical price storage and retrieval for backtests and charts | price history
server/services/price.service.ts | Small price helper utilities and adapters | price helpers
server/services/portfolioService.ts | Portfolio aggregation, P&L, and allocation helpers | portfolio service
server/services/poolPricingOptimization.mixin.ts | Pricing optimization mixin for pool modules | mixin
server/services/poolGovernanceService.ts | Governance service for pool-level voting and proposals | pool governance
server/services/pin-service.ts | Pinning service for persistent assets and metadata | pin service
server/services/personaService.ts | Persona profiles and persona-aware defaults | persona service
server/services/performanceTrackingService.ts | Tracks performance metrics for strategies and services | performance tracking
server/services/PerformanceOptimizerBufferedWriter.ts | Buffered writer helper for high-throughput performance logging | performance writer
server/services/pendingActionService.ts | Tracks pending actions requiring follow-up or approvals | pending actions
server/services/paymentRecoveryWorkflowService.ts | Orchestrates recovery of failed payments and retries | payment recovery
server/services/PaymentRecoverySAGAOrchestrator.ts | SAGA orchestrator for multi-step payment recoveries | SAGA orchestrator
server/services/paymentGatewayService.ts | Integrates with external payment gateways and webhooks | payment gateway
server/services/paymentFlowSimulator.ts | Simulates payment flows and failure scenarios for testing | payment simulator
server/services/paymentFlowSimulator.test.ts | Tests for the payment flow simulator | tests
server/services/paymentExecutionService.ts | Executes payments via configured gateways and on-chain rails | payment execution
server/services/paymentErrorMonitoringService.ts | Monitors payment errors and raises alerts | payment error monitoring
server/services/paymentErrorHandler.ts | Handles payment error categorization and retries | error handler
server/services/paymentErrorAnalyticsService.ts | Analytics for payment error patterns and root causes | payment analytics
server/services/paymentErrorAlertService.ts | Alerting for critical payment error rates | payment alerts
server/services/otpService.ts | One-time password (OTP) generation and validation service | OTP service
server/services/orderRouter.ts | Order routing engine coordinating SOR and venue selection | order router
server/services/orderBookAnalyzer.ts | Analyzes orderbook depth, spreads, and liquidity events | orderbook analyzer
server/services/opportunityEngine.ts | Detects trading opportunities and arbitrage candidates | opportunity engine
server/services/operational/vault/manager.ts | Operational vault manager for runbook-driven operations | operational manager
server/services/operational/validation/metadata.ts | Metadata validators for operational workflows | metadata validators
server/services/operational/types.ts | Operational types shared across operational modules | types
server/services/operational/schema.ts | Operational JSON schema definitions for validations | schema
server/services/operational/remediation/executor.ts | Executes remediation actions for operational incidents | remediation executor
server/services/operational/index.ts | Entrypoint for operational tooling and adapters | operational index
server/services/operational/discovery/discovery.ts | Discovery utilities used by operational scanners | discovery tools
server/services/operational/audit/logger.ts | Operational audit logger used for runbooks and compliance | audit logger
server/services/onboardingService.ts | User onboarding flows and welcome sequences | onboarding service
server/services/ohlcvServicev1.ts | Legacy OHLCV service (v1) for historical candles | OHLCV v1
server/services/ohlcvService.ts | Current OHLCV service for historical candle aggregation | OHLCV service
server/services/ohlcvPropagationAdapter.ts | Adapter to propagate OHLCV updates to downstream consumers | propagation adapter
server/services/nuruPropagationAdapter.ts | Propagation adapter for Nuru analytics integrations | nuru adapter
server/services/notificationService.ts | Central notification dispatcher for email/push/ws | notification service
server/services/navUpdateService.ts | NAV update scheduler and notifier for vaults | NAV updater
server/services/navOracleService.ts | NAV-specific price aggregation helpers | nav oracle
server/services/multisigExecutionService.ts | Executes multisig transactions via external signers | multisig execution
server/services/multisigApprovalHandler.ts | Handles approval workflows and signer coordination | approval handler
server/services/multiChainProvider.ts | Multi-chain provider abstraction for RPCs and providers | multi-chain provider
server/services/morio-data-hub.service.ts | Data hub integration service for Morio features | morio data hub
server/services/metricsCacheService.ts | Caches computed metrics for dashboard consumption | metrics cache
server/services/metricsAggregationService.ts | Aggregates metrics from events and stores rollups | metrics aggregation
server/services/metaDaoService.ts | MetaDAO creation, registry, and federation helpers | metaDao service
server/services/marketStreamService.ts | Market stream producer for websocket feeds and clients | market stream
server/services/marketplaceStatsUpdater.ts | Updates marketplace stats and seller metrics | marketplace stats
server/services/marketDiscoveryScannerService.ts | Scans markets and discovers new trading pairs/assets | market discovery
server/services/marketAnalyticsService.ts | Market analytics and signal generation service | market analytics
server/services/liquidityScoring.ts | Scores liquidity for pairs and pools used by routing | liquidity scoring
server/services/liquidityOptimizer.ts | Optimizes liquidity allocations across pools and venues | liquidity optimizer
server/services/limitOrderTracker.ts | Tracks limit orders lifecycle and fills | limit order tracker
server/services/kycService.ts | KYC document verification and status tracking | KYC service
server/services/kwetuService.ts | Internal kwetu service integrations (domain-specific) | kwetu service
server/services/kotanipayService.ts | KotaniPay payment gateway integration service | kotanipay integration
server/services/keyManagementService.ts | Key management for service accounts and encrypted stores | key management
server/services/jobQueueService.ts | Job queue wrapper and job scheduling helpers | job queue
server/services/jobMonitoringService.ts | Monitors long-running jobs and worker health | job monitoring
server/services/IsolatedWorkerManager.ts | Manages isolated worker processes for heavy jobs | isolated worker manager
server/services/investmentPoolService.ts | Manages investment pools and member interactions | investment pool service
server/services/investmentPoolPricingService.ts | Pricing and fee calculations for investment pools | pool pricing
server/services/investmentOperationsSimulator.ts | Simulator for investment operations and rebalances | investment simulator
server/services/intelligenceShards.ts | Sharded intelligence workers for analytics processing | intelligence shards
server/services/INTEGRATION_PATTERNS.ts | Integration patterns docs and helpers for adapters | integration patterns
server/services/indicators.ts | Indicator utilities used by strategies and charts | indicators
server/services/historicalData.ts | Historical data storage and query helpers | historical data
server/services/graphPropagationIntegration.ts | Integrates graph propagation outputs into services | graph propagation
server/services/graphPropagationEngine.ts | Engine for propagating updates across graph topologies | propagation engine
server/services/governanceSimulator.ts | Governance action simulator used for forecasting outcomes | governance simulator
server/services/governanceLeaderboardService.ts | Builds leaderboards from governance activity data | governance leaderboard
server/services/governance-service.ts | Core governance business logic and DAO management | governance service
server/services/gatingService.ts | Feature gating and access control toggles service | gating service
server/services/gatewayAggregator.ts | Aggregates gateway providers for external integrations | gateway aggregator
server/services/gateway/types.ts | Types for gateway provider integrations | gateway types
server/services/gateway/providers.ts | Gateway provider implementations and adapters | gateway providers
server/services/gateway/optimizer.ts | Gateway optimizer to choose best gateway per request | gateway optimizer
server/services/gateway/gateway.ts | Gateway facade for external API interactions | gateway facade
server/services/gateway/api.ts | API layer for gateway provider endpoints | gateway API

### Services Inventory — Batch 3 of 3 (final 82 files)
# Finalizing the `server/services/` inventory: appending remaining concise per-file lines (files 201–282).

server/services/gasPriceOracle.ts | Gas price estimation and gas oracle helpers per chain | gas price oracle
server/services/futuresMarketSupport.ts | Futures market support utilities and margin checks | futures support
server/services/financialAnalyticsService.ts | Financial analytics: P&L, risk-adjusted returns and cohort analyses | financial analytics
server/services/feeCalculator.ts | Fee calculation utilities for markets, pools, and treasury | fee calculator
server/services/featureService.ts | Feature flag management and rollout helpers | feature service
server/services/fearGreedIndex.ts | Fetches and normalizes market fear/greed indices for UI signals | fear/greed index
server/services/externalAPITracker.ts | Tracks external API health and usage metrics | external API tracker
server/services/futuresMarketSupport.ts | Futures market helpers (duplicate alias) | futures support
server/services/financialAnalyticsService.ts | (duplicate) Financial analytics service | financial analytics
server/services/gateway/types.ts | (duplicate) Gateway types | gateway types
server/services/gateway/providers.ts | (duplicate) Gateway providers | gateway providers
server/services/gateway/optimizer.ts | (duplicate) Gateway optimizer | gateway optimizer
server/services/gateway/gateway.ts | (duplicate) Gateway facade | gateway facade
server/services/gateway/api.ts | (duplicate) Gateway API | gateway API
server/services/defiProtocols/moolaAdapter.ts | Moola protocol adapter for lending/borrow flows | moola adapter
server/services/defiProtocols/lidoCurveAdapter.ts | Lido/Curve adapter for staking/curve interactions | lido/curve adapter
server/services/defiProtocols/aaveAdapter.ts | Aave protocol adapter for lending interactions | aave adapter
server/services/dataSourceManager.ts | Manages external data sources, connectors and backfills | data source manager
server/services/databaseOptimizationLayer.ts | DB optimization helpers and query planners | DB optimization
server/services/dashboardService.ts | Provides dashboard datasets and cached views for UI | dashboard service
server/services/daoTreasurySimulator.ts | Simulates DAO treasury scenarios and rebalances | DAO treasury simulator
server/services/daoTreasuryFlowService.ts | Orchestrates DAO treasury flows and approvals | treasury flow service
server/services/daoMemberStatsUpdater.ts | Updates DAO member stats and contribution metrics | member stats updater
server/services/daoAbusePreventionService.ts | Detects and mitigates DAO abuse and sybil behaviors | abuse prevention
server/services/crossChainSyncService.ts | Syncs cross-chain state and transfer statuses | cross-chain sync
server/services/crossChainSwapService.ts | Cross-chain swap orchestration using bridges and liquidity | cross-chain swap
server/services/crossChainService.ts | Cross-chain coordination utilities and adapters | cross-chain service
server/services/crossChainGovernanceService.ts | Cross-chain governance coordinator for proposals across chains | crossChain governance
server/services/crossChainBridgesSimulator.ts | Simulator for cross-chain bridge flows and failure modes | bridge simulator
server/services/contributionIndexerService.ts | Indexes contributions and stores aggregated metrics | contribution indexer
server/services/constraintChecker.ts | Checks business constraints before critical operations | constraint checker
server/services/concurrencyControl.ts | Concurrency utilities and locks for critical sections | concurrency control
server/services/collectorService.ts | Collector for background collection jobs and metrics | collector service
server/services/cognitionEngine.ts | Cognitive processing engine connecting analytics and ML shards | cognition engine
server/services/circuitBreakerService.ts | Circuit breaker patterns for external integrations | circuit breaker
server/services/chatService.ts | Chat service integration and message routing | chat service
server/services/cexPriceCollector.ts | Collects prices from centralized exchanges (CEFs) | cex price collector
server/services/cexPriceCache.ts | Caches CEX prices for quick retrieval | cex price cache
server/services/cexPriceBackgroundJob.ts | Background job collecting CEX prices at intervals | cex price job
server/services/cexOrderManager.ts | Manager for CEX order lifecycle and mapping to internal orders | cex order manager
server/services/cexOrderExecutor.ts | Executes orders on CEXs via CCXT or adapters | cex order executor
server/services/ccxtService.ts | CCXT adapter for fetching markets/prices and optional trading | CCXT service
server/services/ccxtService.test.ts | Tests for CCXT service adapters | ccxt tests
server/services/cacheService.ts | Generic cache service wrapper with TTLs and metrics | cache service
server/services/cacheInvalidationManager.ts | Manages cache invalidation patterns and events | cache invalidation
server/services/bridgeTestingService.ts | Test utilities for bridge behavior and mocks | bridge testing
server/services/bridgeStatusPoller.ts | Polls bridge providers for transfer statuses and metrics | bridge poller
server/services/bridgeRelayerService.ts | Bridge relayer worker that validates & completes cross-chain transfers | bridge relayer
server/services/bridgeProtocolService.ts | Protocol selection and fee estimation for bridge flows | bridge protocol service
server/services/bridgeMonitoringService.ts | Observability and alerts for bridge activity and slippage | bridge monitoring
server/services/bridgeIntegration.ts | Integration shims for multiple bridge providers | bridge integration
server/services/billSplitService.ts | Bill-splitting logic and settlement across members | bill split service
server/services/automaticPhaseManager.ts | Manages automatic phase progression for cohort flows | phase manager
server/services/auditLoggingService.ts | Centralized audit logging and export for compliance | audit logging
server/services/auditLogging.ts | Audit logging helpers and sinks | audit logging helpers
server/services/auditLogger.ts | Lightweight audit logger for synchronous flows | audit logger small
server/services/auditConsolidated.ts | Consolidates audit events into rollups for queries | audit consolidated
server/services/audit-to-websocket-bridge.ts | Bridges audit events to websocket clients for live view | audit WS bridge
server/services/assetStateEngine.ts | Engine maintaining asset lifecycle state and transitions | asset state engine
server/services/assetStateEngine.refactored.ts | Refactored variant of the asset state engine | refactored engine
server/services/assetNormalization.ts | Normalizes asset identifiers and metadata across sources | asset normalization
server/services/assetIntelligence.ts | Asset-level intelligence (scoring, risk, signals) | asset intelligence
server/services/assetGraphService.ts | Builds and queries asset relationship graphs for analysis | asset graph service
server/services/assetDiscovery.ts | Discovers new assets and enriches metadata | asset discovery
server/services/arbitrageService.ts | Arbitrage execution and monitoring across venues | arbitrage service
server/services/arbitrageDetector.ts | Detects arbitrage opportunities and signals | arbitrage detector
server/services/arbitrageDetection.ts | (alias) Arbitrage detection utilities | arbitrage detection alias
server/services/apiEfficiencyLayer.ts | Middleware/helpers to improve API efficiency and latency | API efficiency
server/services/aiAnalyticsService.ts | AI/ML analytics orchestration and model runner hooks | AI analytics
server/services/agentStatusService.ts | Tracks status of autonomous agents and workers | agent status
server/services/AgentRegistry.ts | Registry of deployed agents and capabilities | agent registry
server/services/agentProposalService.ts | Manages proposals initiated by agents or automated flows | agent proposal service
server/services/agentDeploymentSimulator.ts | Simulates agent deployments and lifecycle | agent deployment simulator
server/services/agentCircuitBreaker.ts | Circuit breaker for agent operations and safety limits | agent circuit breaker
server/services/advancedMicrostructureIndicators.ts | Advanced microstructure indicators for market microstructure | microstructure indicators
server/services/advancedAnalyticsService.ts | Advanced analytics pipelines and job orchestration | advanced analytics
server/services/advanced-features-service.ts | Experimental/advanced feature toggles and scaffolding | advanced features
server/services/adminAuthService.ts | Admin authentication and elevated access flows | admin auth
server/services/adminAuditLogger.ts | Admin-specific audit logging sinks and reports | admin audit
server/services/admin-totp-service.ts | Admin TOTP management and recovery helpers | admin TOTP
server/services/activity-service.ts | Activity event ingestion and aggregation for leaderboards | activity service
server/services/activity-award-helper.ts | Helpers to award activity points and badges | award helper
server/services/achievementSystemService.ts | Achievement and badge awarding system | achievements
server/services/account-service.ts | Account management: creation, lookup, and merging helpers | account service


