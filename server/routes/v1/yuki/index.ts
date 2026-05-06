/**
 * V1 YUKI Router - Decentralized Exchange Aggregation
 * 
 * Main entry point for YUKI API versioning
 * Mounts sub-routers for complete DEX aggregation platform:
 * 
 * Architecture:
 * - Execute: Core primitives (swaps, bridges, flash loans, transfers)
 * - Exchanges: Exchange metadata and listing
 * - Routing: Smart route calculation across liquidity sources
 * - Orders: Limit orders, stop-loss orders, order tracking
 * - Market: Real-time price feeds and liquidity data
 * - Marketplace: Spot trading and derivatives
 * - Strategies: Automated strategy deployment and execution
 * - DEX: Direct DEX protocol interaction
 * - Rebalancing: Portfolio rebalancing and threshold management
 * - Staking: Token staking and yield generation
 * - Algo: Algorithmic trading (TWAPs, VWAPs)
 * - Bridge: Bridge protocol management
 * 
 * Total Endpoints: 50+ under /api/v1/yuki hierarchy
 */

import { Router } from 'express';
import executeRouter from './execute';
import exchangesRouter from './exchanges';
import routingRouter from './routing';
import ordersRouter from './orders';
import marketRouter from './market';
import marketplaceRouter from './marketplace';
import strategiesRouter from './strategies';
import dexRouter from './dex';
import rebalancingRouter from './rebalancing';
import stakingRouter from './staking';
import algoRouter from './algo';
import bridgeRouter from './bridge';

const router = Router();

/**
 * Execute operations (6 endpoints) - CORE PATTERN
 * POST   /v1/yuki/execute/swap              - Swap across DEXs
 * POST   /v1/yuki/execute/swap/preview      - Quote swap
 * POST   /v1/yuki/execute/bridge            - Cross-chain bridge (advanced mode)
 * POST   /v1/yuki/execute/bridge/preview    - Quote bridge
 * POST   /v1/yuki/execute/flash-loan        - Flash loan (advanced mode)
 * POST   /v1/yuki/execute/move              - Simple transfer
 * 
 * Pattern: JWT auth → Zod validation → Service integration → Transaction recording
 */
router.use('/execute', executeRouter);

/**
 * Exchanges (2 endpoints)
 * GET    /v1/yuki/exchanges                 - List available exchanges
 */
router.use('/exchanges', exchangesRouter);

/**
 * Routing (1 endpoint)
 * POST   /v1/yuki/routing/quote             - Calculate optimal routes
 */
router.use('/routing', routingRouter);

/**
 * Orders (3 endpoints)
 * POST   /v1/yuki/orders                    - Create new order
 * GET    /v1/yuki/orders                    - List user orders
 * DELETE /v1/yuki/orders/:orderId           - Cancel order
 */
router.use('/orders', ordersRouter);

/**
 * Market (4 endpoints)
 * GET    /v1/yuki/market/prices             - Token prices
 * GET    /v1/yuki/market/liquidity          - Liquidity depth
 * GET    /v1/yuki/market/volumes            - Trading volumes
 * GET    /v1/yuki/market/changes            - Price changes
 */
router.use('/market', marketRouter);

/**
 * Marketplace (3 endpoints)
 * POST   /v1/yuki/marketplace/trade         - Execute marketplace trade
 * GET    /v1/yuki/marketplace/positions     - Get open positions
 * POST   /v1/yuki/marketplace/close         - Close position
 */
router.use('/marketplace', marketplaceRouter);

/**
 * Strategies (4 endpoints)
 * POST   /v1/yuki/strategies                - Create strategy
 * GET    /v1/yuki/strategies                - List strategies
 * PATCH  /v1/yuki/strategies/:strategyId    - Update strategy
 * DELETE /v1/yuki/strategies/:strategyId    - Delete strategy
 */
router.use('/strategies', strategiesRouter);

/**
 * DEX (3 endpoints)
 * GET    /v1/yuki/dex/pools                 - Get DEX pools
 * POST   /v1/yuki/dex/swap                  - Direct DEX swap
 * GET    /v1/yuki/dex/liquidity             - Liquidity provider info
 */
router.use('/dex', dexRouter);

/**
 * Rebalancing (3 endpoints)
 * POST   /v1/yuki/rebalancing/trigger       - Manual rebalance
 * GET    /v1/yuki/rebalancing/status        - Rebalance status
 * POST   /v1/yuki/rebalancing/schedule      - Schedule rebalance
 */
router.use('/rebalancing', rebalancingRouter);

/**
 * Staking (4 endpoints)
 * POST   /v1/yuki/staking                   - Stake tokens
 * GET    /v1/yuki/staking                   - Get positions
 * POST   /v1/yuki/staking/harvest           - Harvest yield
 * POST   /v1/yuki/staking/unstake           - Unstake tokens
 */
router.use('/staking', stakingRouter);

/**
 * Algorithmic Trading (4 endpoints)
 * POST   /v1/yuki/algo/twap                 - TWAP order
 * POST   /v1/yuki/algo/vwap                 - VWAP order
 * GET    /v1/yuki/algo/orders               - List algo orders
 * DELETE /v1/yuki/algo/orders/:orderId      - Cancel algo order
 */
router.use('/algo', algoRouter);

/**
 * Bridge (17 endpoints) - HIGH-RISK OPERATIONS
 * 
 * Chain Discovery:
 * GET    /v1/yuki/bridge/chains             - Supported chains
 * GET    /v1/yuki/bridge/estimate-fees      - Fee estimation
 * GET    /v1/yuki/bridge/analytics          - Bridge analytics
 * GET    /v1/yuki/bridge/relayer/status     - Relayer operational status
 * 
 * Bridge Swap (Advanced Mode Required):
 * GET    /v1/yuki/bridge/swap/quote         - Get swap quote
 * POST   /v1/yuki/bridge/swap               - Execute swap (ADVANCED MODE)
 * GET    /v1/yuki/bridge/swap/:swapId       - Swap status
 * 
 * Bridge Transfer (Advanced Mode Required):
 * POST   /v1/yuki/bridge/transfer           - Initiate transfer (ADVANCED MODE)
 * GET    /v1/yuki/bridge/transfer/:id       - Transfer status
 * POST   /v1/yuki/bridge/transfer/:id/retry - Retry transfer
 * 
 * Governance:
 * GET    /v1/yuki/bridge/governance/proposals              - List proposals
 * GET    /v1/yuki/bridge/governance/proposals/:id/aggregate - Aggregate votes
 * POST   /v1/yuki/bridge/governance/votes/sync             - Sync votes
 * 
 * Monitoring:
 * GET    /v1/yuki/bridge/vault-status       - Vault health
 */
router.use('/bridge', bridgeRouter);

export default router;
