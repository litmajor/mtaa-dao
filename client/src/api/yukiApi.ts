/**
 * Yuki Trading API Client
 * 
 * Utilities for calling Yuki trading endpoints from React components
 * ✅ Migrated to authClient for centralized auth handling:
 * - Uses cookie-based authentication (httpOnly)
 * - Auto-refresh on 401
 * - Single-flight refresh to prevent token storms
 * - CSRF protection
 */

import { authClient } from '@/utils/authClient';
import type { Strategy, Position, Exchange } from './dashboardApi';
import { API_CONFIG } from '@/config/apiConfig';

const API_BASE = '/api/v1';

// ============================================================================
// MARKET INTELLIGENCE
// ============================================================================

export async function getMarketPrices(symbols: string[] = ['ETH', 'USDC', 'BTC']): Promise<unknown> {
  return authClient.get(`${API_BASE}/yuki/market/prices?symbols=${symbols.join(',')}`);
}

export async function getMarketOpportunities(): Promise<unknown> {
  return authClient.get(`${API_BASE}/yuki/market/opportunities`);
}

// Backwards-compatible aliases expected by some UI modules
export async function fetchOpportunities() {
  return getMarketOpportunities();
}

export async function getLiquidity(symbol: string) {
  return authClient.get(`${API_BASE}/yuki/market/liquidity/${symbol}`);
}

// ============================================================================
// TRADING EXECUTION
// ============================================================================

export async function previewSwap(fromToken: string, toToken: string, amount: number, slippage: number = 0.5) {
  return authClient.post(`${API_BASE}/yuki/execute/swap/preview`, {
    fromToken,
    toToken,
    amount,
    slippage,
  });
}

export async function executeSwap(fromToken: string, toToken: string, amount: number, minOutput: number) {
  return authClient.post(`${API_BASE}/yuki/execute/swap`, {
    fromToken,
    toToken,
    amount,
    minOutput,
  });
}

export async function previewBridge(token: string, amount: number, fromChain: string, toChain: string) {
  return authClient.post(`${API_BASE}/yuki/execute/bridge/preview`, {
    token,
    amount,
    fromChain,
    toChain,
  });
}

export async function executeBridge(token: string, amount: number, fromChain: string, toChain: string) {
  return authClient.post(`${API_BASE}/yuki/execute/bridge`, {
    token,
    amount,
    fromChain,
    toChain,
  });
}

export async function moveAssets(fromAccount: string, toAccount: string, amount: number, currency: string) {
  return authClient.post(`${API_BASE}/yuki/execute/move`, {
    fromAccount,
    toAccount,
    amount,
    currency,
  });
}

export async function executeFlashLoan(token: string, amount: number, operations: any[]) {
  return authClient.post(`${API_BASE}/yuki/execute/flash-loan`, {
    token,
    amount,
    operations,
  });
}

// ============================================================================
// STRATEGY MANAGEMENT
// ============================================================================

export async function createStrategy(name: string, description: string, blocks: any[]) {
  return authClient.post(`${API_BASE}/yuki/strategies`, {
    name,
    description,
    blocks,
  });
}

export async function getUserStrategies() {
  return authClient.get(`${API_BASE}/yuki/strategies`);
}

export async function getStrategy(id: string) {
  return authClient.get(`${API_BASE}/yuki/strategies/${id}`);
}

export async function updateStrategy(id: string, name: string, description: string, blocks: any[]) {
  return authClient.put(`${API_BASE}/yuki/strategies/${id}`, {
    name,
    description,
    blocks,
  });
}

export async function deleteStrategy(id: string) {
  return authClient.delete(`${API_BASE}/yuki/strategies/${id}`);
}

export async function deployStrategy(id: string) {
  return authClient.post(`${API_BASE}/yuki/strategies/${id}/deploy`, {});
}

// Deploy a fully compiled strategy object (used by the visual builder)
export async function deployCompiledStrategy(compiled: any, deploymentConfig?: any) {
  return authClient.post(`${API_BASE}/yuki/strategies/deploy`, {
    compiled,
    deploymentConfig,
  });
}

// Save the full strategy graph (used to persist node positions and layout)
export async function saveGraph(graph: any) {
  return authClient.post(`${API_BASE}/yuki/strategies/save-graph`, { graph });
}

export interface BacktestJobResponse {
  jobId: string;
  status: string;
  statusUrl: string;
  resultUrl: string;
  streamUrl: string;
}

export function normalizeBacktestJobResponse(payload: any): BacktestJobResponse {
  const body = payload?.data?.data ?? payload?.data ?? payload;
  const data = body?.data ?? body;

  return {
    jobId: data?.jobId || data?.id || '',
    status: data?.status || 'queued',
    statusUrl: data?.statusUrl || '',
    resultUrl: data?.resultUrl || '',
    streamUrl: data?.streamUrl || '',
  };
}

export async function backtestStrategy(id: string, startDate: string, endDate: string) {
  const response = await authClient.post(`${API_BASE}/yuki/strategies/${id}/backtest`, {
    startDate,
    endDate,
    pair: 'BTC/USDT',
    timeframe: '1h',
    stakeAmount: 100,
    startingCapital: 10000,
    engine: 'freqtrade',
  });

  return normalizeBacktestJobResponse(response);
}

export async function getBacktestJobStatus(jobId: string) {
  return authClient.get(`/api/jobs/${jobId}/status`);
}

export async function getBacktestJobResult(jobId: string) {
  return authClient.get(`/api/jobs/${jobId}/result`);
}

export async function getStrategySignals(id: string) {
  return authClient.get(`${API_BASE}/yuki/strategies/${id}/signals`);
}

// ============================================================================
// STRATEGY MARKETPLACE
// ============================================================================

export async function getMarketplaceStrategies(filter: string = 'all', sort: string = 'return', search: string = '') {
  const params = new URLSearchParams({ filter, sort, search });
  return authClient.get(`${API_BASE}/yuki/marketplace/strategies?${params}`);
}

export async function getMarketplaceStrategy(id: string) {
  return authClient.get(`${API_BASE}/yuki/marketplace/strategies/${id}`);
}

export async function copyMarketplaceStrategy(id: string) {
  return authClient.post(`${API_BASE}/yuki/marketplace/strategies/${id}/copy`, {});
}

// Backwards-compatible alias for a 'fork' operation (copy + open in builder)
export async function forkMarketplaceStrategy(id: string) {
  return copyMarketplaceStrategy(id);
}

export async function publishStrategy(strategyId: string, pricing: any, description: string, category: string) {
  return authClient.post(`${API_BASE}/yuki/marketplace/strategies/publish`, {
    strategyId,
    pricing,
    description,
    category,
  });
}

// ============================================================================
// CEX MANAGEMENT
// ============================================================================

export async function getConnectedExchanges() {
  return authClient.get(`${API_BASE}/yuki/exchanges`);
}

export async function connectExchange(exchangeName: string, apiKey: string, apiSecret: string) {
  return authClient.post(`${API_BASE}/yuki/exchanges`, {
    exchangeName,
    apiKey,
    apiSecret,
  });
}

export async function disconnectExchange(id: string) {
  return authClient.delete(`${API_BASE}/yuki/exchanges/${id}`);
}

export async function getExchangeBalances(id: string) {
  return authClient.get(`${API_BASE}/yuki/exchanges/${id}/balances`);
}

export async function getExchangePositions(id: string) {
  return authClient.get(`${API_BASE}/yuki/exchanges/${id}/positions`);
}

// User watchlist endpoints (UI expects `fetchWatchlist`) - expanded
export type WatchlistItemType = 'symbol' | 'pool' | 'vault' | 'investment_pool' | 'strategy' | 'creator';
export type WatchlistAlertMetric = 'price' | 'apy' | 'tvl';
export type WatchlistAlertDirection = 'above' | 'below';

export interface WatchlistItem {
  id: string;
  watchlist_id: string;
  item_type: WatchlistItemType;
  symbol_id: string | null;
  pool_id: string | null;
  vault_id: string | null;
  investment_pool_id: string | null;
  strategy_id: string | null;
  creator_id: string | null;
  target_name: string; // resolved display name, joined server-side
  alert_metric: WatchlistAlertMetric | null;
  alert_direction: WatchlistAlertDirection | null;
  alert_threshold: number | null;
  alert_active: boolean;
  alert_last_fired_at: string | null;
  metadata: Record<string, any>;
}

export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  items: WatchlistItem[];
}

export async function listWatchlists(): Promise<Watchlist[]> {
  return authClient.get(`${API_BASE}/yuki/watchlist`);
}

// Kept as an alias since the UI (per the confirmation note) already
// references `fetchWatchlist` as the entrypoint name.
export async function fetchWatchlist(): Promise<Watchlist[]> {
  return listWatchlists();
}

export async function createWatchlist(name: string): Promise<Watchlist> {
  return authClient.post(`${API_BASE}/yuki/watchlist`, { name });
}

export async function deleteWatchlist(watchlistId: string) {
  return authClient.delete(`${API_BASE}/yuki/watchlist/${watchlistId}`);
}

export async function addWatchlistItem(
  watchlistId: string,
  params: {
    itemType: WatchlistItemType;
    targetId: string;
    alertMetric?: WatchlistAlertMetric;
    alertDirection?: WatchlistAlertDirection;
    alertThreshold?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<WatchlistItem> {
  return authClient.post(`${API_BASE}/yuki/watchlist/${watchlistId}/items`, params);
}

export async function removeWatchlistItem(itemId: string): Promise<void> {
  return authClient.delete(`${API_BASE}/yuki/watchlist/items/${itemId}`);
}

// Pass alertMetric: null to clear an existing alert.
export async function updateWatchlistItemAlert(
  itemId: string,
  params: {
    alertMetric: WatchlistAlertMetric | null;
    alertDirection?: WatchlistAlertDirection;
    alertThreshold?: number;
  }
): Promise<WatchlistItem> {
  return authClient.put(`${API_BASE}/yuki/watchlist/items/${itemId}/alert`, params);
}

// ============================================================================
// SMART ORDER ROUTING
// ============================================================================

export async function compareOrderRoutes(symbol: string, amount: number, side: 'buy' | 'sell' = 'buy') {
  return authClient.post(`${API_BASE}/yuki/routing/compare`, {
    symbol,
    amount,
    side,
  });
}

export async function executeOptimalRoute(symbol: string, amount: number, venue: string) {
  return authClient.post(`${API_BASE}/yuki/routing/execute`, {
    symbol,
    amount,
    venue,
  });
}

export async function triggerRebalance(strategyId: string, orders: any[]) {
  return authClient.post(`${API_BASE}/yuki/execute/rebalance`, {
    strategyId,
    orders,
  });
}

export async function startAlgoOrder(config: any) {
  return authClient.post(`${API_BASE}/yuki/execute/algo`, config);
}


// ============================================================================
// PORTFOLIO & RISK
// ============================================================================

export async function getPortfolio() {
  return authClient.get(`${API_BASE}/yuki/portfolio`);
}

export async function getRiskSettings() {
  return authClient.get(`${API_BASE}/yuki/risk/settings`);
}

export async function updateRiskSettings(settings: any) {
  return authClient.put(`${API_BASE}/yuki/risk/settings`, settings);
}

// ============================================================================
// ALERTS
// ============================================================================

export async function getAlerts() {
  return authClient.get(`${API_BASE}/yuki/alerts`);
}

export async function createAlert(alert: any) {
  return authClient.post(`${API_BASE}/yuki/alerts`, alert);
}

export async function deleteAlert(id: string) {
  return authClient.delete(`${API_BASE}/yuki/alerts/${id}`);
}

// ============================================================================
// STAKING
// ============================================================================

export async function getStakingPools() {
  return authClient.get(`${API_BASE}/yuki/staking/pools`);
}

export async function getStakingPositions() {
  return authClient.get(`${API_BASE}/yuki/staking/positions`);
}

export async function stakeTokens(poolId: string, amount: number) {
  return authClient.post(`${API_BASE}/yuki/staking/stake`, { poolId, amount });
}

export async function unstakeTokens(poolId: string, amount: number) {
  return authClient.post(`${API_BASE}/yuki/staking/unstake`, { poolId, amount });
}

export async function claimStakingRewards(poolId: string) {
  return authClient.post(`${API_BASE}/yuki/staking/claim`, { poolId });
}

// ============================================================================
// WebSocket Real-Time Feeds
// ============================================================================

/**
 * Connects to the YUKI real-time WebSocket.
 *
 * FIXED: previously took a `token` parameter and appended it as `?token=`,
 * mirroring a Create-React-App-style token-based auth model this app
 * doesn't use. Auth here is a cookie-based, httpOnly `access_token` cookie
 * (see authClient.ts) — there's no client-readable token to pass, and native
 * WebSocket handshakes carry the browser's cookies for the target origin
 * automatically, same as a normal navigation request. No token argument or
 * query param is needed.
 *
 * ALSO FIXED: the previous fallback read `process.env.REACT_APP_WS_URL`,
 * which is a Create React App convention. This app is built with Vite (see
 * authClient.ts's use of `import.meta.env`), so that env var is never
 * defined in the browser bundle — meaning this ALWAYS fell through to the
 * hardcoded `ws://localhost:3000/...` fallback, in every environment
 * including production, and on the wrong port besides (server defaults to
 * 5000, not 3000). Now derives the WS origin from API_CONFIG, with an
 * explicit VITE_WS_URL override if you want to point it elsewhere (e.g. a
 * separate WS-only load balancer).
 *
 * SERVER-SIDE COMPANION CHANGE NEEDED: whatever handles the `/api/v1/yuki/ws`
 * upgrade needs to read the `access_token` cookie from the upgrade request's
 * headers (mirroring the same fix needed in server/index.ts's `io.use()`
 * for the Socket.IO notification channel), rather than expecting a token in
 * the query string.
 */
export function connectToYukiWebSocket(): WebSocket {
  const wsUrl =
    (typeof import.meta !== 'undefined' && (import.meta.env as any)?.VITE_WS_URL) ||
    `${API_CONFIG.BASE_URL.replace(/^http/, 'ws')}/api/v1/yuki/ws`;

  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[Yuki WebSocket] Connected');
  };

  ws.onerror = (error) => {
    console.error('[Yuki WebSocket] Error:', error);
  };

  ws.onclose = () => {
    console.log('[Yuki WebSocket] Disconnected');
  };

  return ws;
}

/**
 * Subscribe to price updates
 * WebSocket message format: { type: 'subscribe', channel: 'prices', symbols: ['ETH', 'BTC'] }
 */
export function subscribeToPrices(ws: WebSocket, symbols: string[]) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'prices',
      symbols,
    }));
  }
}

/**
 * Subscribe to order fills
 * Receives updates when executed orders fill
 */
export function subscribeToFills(ws: WebSocket) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'fills',
    }));
  }
}

/**
 * Subscribe to strategy signals
 * Receives real-time signals from deployed strategies
 */
export function subscribeToStrategySignals(ws: WebSocket, strategyId: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'strategy-signals',
      strategyId,
    }));
  }
}

/**
 * Subscribe to portfolio updates
 * Receives balance and position updates
 */
export function subscribeToPortfolio(ws: WebSocket) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'portfolio',
    }));
  }
}

/**
 * Subscribe to alerts
 * Receives important alerts (liquidation risk, price breaks, etc.)
 */
export function subscribeToAlerts(ws: WebSocket) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'alerts',
    }));
  }
}