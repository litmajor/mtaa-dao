/**
 * Yuki Trading API Client
 * 
 * Utilities for calling Yuki trading endpoints from React components
 * Replaces mock data with real API calls
 */

import { Strategy, Position, Exchange } from './dashboardApi';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// ============================================================================
// MARKET INTELLIGENCE
// ============================================================================

export async function getMarketPrices(symbols: string[] = ['ETH', 'USDC', 'BTC']) {
  try {
    const response = await fetch(`${API_BASE}/yuki/market/prices?symbols=${symbols.join(',')}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error('Failed to fetch market prices:', error);
    throw error;
  }
}

export async function getMarketOpportunities() {
  try {
    const response = await fetch(`${API_BASE}/yuki/market/opportunities`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error('Failed to fetch market opportunities:', error);
    throw error;
  }
}

export async function getLiquidity(symbol: string) {
  try {
    const response = await fetch(`${API_BASE}/yuki/market/liquidity/${symbol}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error(`Failed to fetch liquidity for ${symbol}:`, error);
    throw error;
  }
}

// ============================================================================
// TRADING EXECUTION
// ============================================================================

export async function previewSwap(fromToken: string, toToken: string, amount: number, slippage: number = 0.5) {
  try {
    const response = await fetch(`${API_BASE}/yuki/execute/swap/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ fromToken, toToken, amount, slippage }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error('Failed to preview swap:', error);
    throw error;
  }
}

export async function executeSwap(fromToken: string, toToken: string, amount: number, minOutput: number) {
  try {
    const response = await fetch(`${API_BASE}/yuki/execute/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ fromToken, toToken, amount, minOutput }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error('Failed to execute swap:', error);
    throw error;
  }
}

export async function previewBridge(token: string, amount: number, fromChain: string, toChain: string) {
  try {
    const response = await fetch(`${API_BASE}/yuki/execute/bridge/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ token, amount, fromChain, toChain }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error('Failed to preview bridge:', error);
    throw error;
  }
}

export async function executeBridge(token: string, amount: number, fromChain: string, toChain: string) {
  try {
    const response = await fetch(`${API_BASE}/yuki/execute/bridge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ token, amount, fromChain, toChain }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error('Failed to execute bridge:', error);
    throw error;
  }
}

export async function moveAssets(fromAccount: string, toAccount: string, amount: number, currency: string) {
  try {
    const response = await fetch(`${API_BASE}/yuki/execute/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ fromAccount, toAccount, amount, currency }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error('Failed to move assets:', error);
    throw error;
  }
}

export async function executeFlashLoan(token: string, amount: number, operations: any[]) {
  try {
    const response = await fetch(`${API_BASE}/yuki/execute/flash-loan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ token, amount, operations }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error('Failed to execute flash loan:', error);
    throw error;
  }
}

// ============================================================================
// STRATEGY MANAGEMENT
// ============================================================================

export async function createStrategy(name: string, description: string, blocks: any[]) {
  try {
    const response = await fetch(`${API_BASE}/yuki/strategies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ name, description, blocks }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error('Failed to create strategy:', error);
    throw error;
  }
}

export async function getUserStrategies() {
  try {
    const response = await fetch(`${API_BASE}/yuki/strategies`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error('Failed to fetch user strategies:', error);
    throw error;
  }
}

export async function getStrategy(id: string) {
  try {
    const response = await fetch(`${API_BASE}/yuki/strategies/${id}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error(`Failed to fetch strategy ${id}:`, error);
    throw error;
  }
}

export async function updateStrategy(id: string, name: string, description: string, blocks: any[]) {
  try {
    const response = await fetch(`${API_BASE}/yuki/strategies/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ name, description, blocks }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error(`Failed to update strategy ${id}:`, error);
    throw error;
  }
}

export async function deleteStrategy(id: string) {
  try {
    const response = await fetch(`${API_BASE}/yuki/strategies/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error(`Failed to delete strategy ${id}:`, error);
    throw error;
  }
}

export async function deployStrategy(id: string) {
  try {
    const response = await fetch(`${API_BASE}/yuki/strategies/${id}/deploy`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error(`Failed to deploy strategy ${id}:`, error);
    throw error;
  }
}

export async function backtestStrategy(id: string, startDate: string, endDate: string) {
  try {
    const response = await fetch(`${API_BASE}/yuki/strategies/${id}/backtest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ startDate, endDate }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error(`Failed to backtest strategy ${id}:`, error);
    throw error;
  }
}

export async function getStrategySignals(id: string) {
  try {
    const response = await fetch(`${API_BASE}/yuki/strategies/${id}/signals`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error(`Failed to fetch signals for strategy ${id}:`, error);
    throw error;
  }
}

// ============================================================================
// STRATEGY MARKETPLACE
// ============================================================================

export async function getMarketplaceStrategies(filter: string = 'all', sort: string = 'return', search: string = '') {
  try {
    const params = new URLSearchParams({ filter, sort, search });
    const response = await fetch(`${API_BASE}/yuki/marketplace/strategies?${params}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error('Failed to fetch marketplace strategies:', error);
    throw error;
  }
}

export async function getMarketplaceStrategy(id: string) {
  try {
    const response = await fetch(`${API_BASE}/yuki/marketplace/strategies/${id}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error(`Failed to fetch marketplace strategy ${id}:`, error);
    throw error;
  }
}

export async function copyMarketplaceStrategy(id: string) {
  try {
    const response = await fetch(`${API_BASE}/yuki/marketplace/strategies/${id}/copy`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error(`Failed to copy marketplace strategy ${id}:`, error);
    throw error;
  }
}

export async function publishStrategy(strategyId: string, pricing: any, description: string, category: string) {
  try {
    const response = await fetch(`${API_BASE}/yuki/marketplace/strategies/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ strategyId, pricing, description, category }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error('Failed to publish strategy:', error);
    throw error;
  }
}

// ============================================================================
// CEX MANAGEMENT
// ============================================================================

export async function getConnectedExchanges() {
  try {
    const response = await fetch(`${API_BASE}/yuki/exchanges`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error('Failed to fetch connected exchanges:', error);
    throw error;
  }
}

export async function connectExchange(exchangeName: string, apiKey: string, apiSecret: string) {
  try {
    const response = await fetch(`${API_BASE}/yuki/exchanges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ exchangeName, apiKey, apiSecret }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error('Failed to connect exchange:', error);
    throw error;
  }
}

export async function disconnectExchange(id: string) {
  try {
    const response = await fetch(`${API_BASE}/yuki/exchanges/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error(`Failed to disconnect exchange ${id}:`, error);
    throw error;
  }
}

export async function getExchangeBalances(id: string) {
  try {
    const response = await fetch(`${API_BASE}/yuki/exchanges/${id}/balances`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error(`Failed to fetch balances for exchange ${id}:`, error);
    throw error;
  }
}

export async function getExchangePositions(id: string) {
  try {
    const response = await fetch(`${API_BASE}/yuki/exchanges/${id}/positions`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error(`Failed to fetch positions for exchange ${id}:`, error);
    throw error;
  }
}

// ============================================================================
// SMART ORDER ROUTING
// ============================================================================

export async function compareOrderRoutes(symbol: string, amount: number, side: 'buy' | 'sell' = 'buy') {
  try {
    const response = await fetch(`${API_BASE}/yuki/routing/compare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ symbol, amount, side }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error('Failed to compare order routes:', error);
    throw error;
  }
}

export async function executeOptimalRoute(symbol: string, amount: number, venue: string) {
  try {
    const response = await fetch(`${API_BASE}/yuki/routing/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ symbol, amount, venue }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  } catch (error) {
    console.error('Failed to execute optimal route:', error);
    throw error;
  }
}

// ============================================================================
// WebSocket Real-Time Feeds
// ============================================================================

export function connectToYukiWebSocket(token: string): WebSocket {
  const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3000/api/yuki/ws';
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
