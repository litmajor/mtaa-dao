/**
 * Bot API Routes
 * All endpoints for bot management and deployment
 * 
 * Base path: /api/bots
 */

export const BOT_ENDPOINTS = {
  // Bot Management
  LIST_BOTS: '/api/bots',
  GET_BOT: '/api/bots/:id',
  DEPLOY_BOT: '/api/bots/deploy',
  UPDATE_BOT_CONFIG: '/api/bots/:id/config',
  DELETE_BOT: '/api/bots/:id',

  // Bot Control
  PAUSE_BOT: '/api/bots/:id/pause',
  RESUME_BOT: '/api/bots/:id/resume',
  STOP_BOT: '/api/bots/:id/stop',

  // Bot Trades
  GET_BOT_TRADES: '/api/bots/:id/trades',
  GET_BOT_PERFORMANCE: '/api/bots/:id/performance',

  // Strategies
  LIST_STRATEGIES: '/api/strategies',
  GET_STRATEGY: '/api/strategies/:id',
  VALIDATE_STRATEGY: '/api/strategies/validate',

  // Exchanges
  LIST_CONNECTED_EXCHANGES: '/api/exchanges',
  GET_EXCHANGE_FEES: '/api/exchanges/:name/fees',
  GET_EXCHANGE_VOLUME: '/api/exchanges/:name/volume'
};

/**
 * Request/Response Types
 */

export interface DeployBotRequest {
  strategyId: string;
  botName: string;
  inputs: Record<string, any>;
  riskControl: {
    maxOpenTrades: number;
    maxLossPerTrade: number;
    maxDailyLoss: number;
    maxLossStreak: number;
    takeProfit: number;
    stopLoss: number;
    maxLeverage: number;
    paused: boolean;
    maxDrawdown: number;
  };
  exchanges: string[];
  initialCapital: number;
}

export interface DeployBotResponse {
  id: string;
  strategyId: string;
  botName: string;
  status: 'running' | 'paused' | 'stopped' | 'error';
  deployedAt: string;
  config: DeployBotRequest;
  performance: {
    trades: number;
    wins: number;
    losses: number;
    profit: number;
    profitPercent: number;
    openPositions: number;
  };
}

export interface BotTradeEvent {
  id: string;
  botId: string;
  pair: string;
  side: 'BUY' | 'SELL' | 'CLOSE';
  type: 'market' | 'limit' | 'grid' | 'dca';
  quantity: number;
  price: number;
  fee: number;
  exchange: string;
  status: 'pending' | 'partial' | 'filled' | 'cancelled';
  filledQuantity: number;
  filledPrice: number;
  timestamp: string;
  executionTime?: number;
  pnl?: number;
  pnlPercent?: number;
}

export interface UpdateBotConfigRequest {
  inputs?: Record<string, any>;
  riskControl?: Partial<{
    maxOpenTrades: number;
    maxLossPerTrade: number;
    maxDailyLoss: number;
    maxLossStreak: number;
    takeProfit: number;
    stopLoss: number;
    maxLeverage: number;
    paused: boolean;
    maxDrawdown: number;
  }>;
  exchanges?: string[];
  initialCapital?: number;
}

export interface BotPerformanceResponse {
  botId: string;
  strategyName: string;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  currentDrawdown: number;
  totalProfit: number;
  sharpeRatio: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  avgTradeTime: string;
  totalFeesPaid: number;
}
