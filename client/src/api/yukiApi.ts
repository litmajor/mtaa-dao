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
import { Strategy, Position, Exchange } from './dashboardApi';

const API_BASE = '/api/v1';

// ============================================================================
// MARKET INTELLIGENCE
// ============================================================================

export async function getMarketPrices(symbols: string[] = ['ETH', 'USDC', 'BTC']) {
  return authClient.get(`${API_BASE}/yuki/market/prices?symbols=${symbols.join(',')}`);
}

export async function getMarketOpportunities() {
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

export async function backtestStrategy(id: string, startDate: string, endDate: string) {
  return authClient.post(`${API_BASE}/yuki/strategies/${id}/backtest`, {
    startDate,
    endDate,
  });
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

// User watchlist endpoints (UI expects `fetchWatchlist`)
export async function fetchWatchlist() {
  return authClient.get(`${API_BASE}/yuki/watchlist`);
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

// ============================================================================
// WebSocket Real-Time Feeds
// ============================================================================

export function connectToYukiWebSocket(token: string): WebSocket {
  const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3000/api/v1/yuki/ws';
  const ws = new WebSocket(`${wsUrl}?token=${token}`);

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
