/**
 * Bot API Client - TypeScript Examples
 * 
 * Usage examples for all bot API endpoints
 * Copy this file to your frontend to use the API
 */

import axios, { AxiosInstance } from 'axios';

/**
 * Create an API client with automatic error handling
 */
class BotApiClient {
  private api: AxiosInstance;

  constructor(baseURL: string = '/api') {
    this.api = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add error interceptor
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  // ========================================
  // Bot Deployment & Management
  // ========================================

  /**
   * Deploy a new trading bot
   * POST /api/bots/deploy
   */
  async deployBot(data: {
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
  }) {
    const response = await this.api.post('/bots/deploy', data);
    return response.data;
  }

  /**
   * Get all bots for current user
   * GET /api/bots
   */
  async listBots() {
    const response = await this.api.get('/bots');
    return response.data;
  }

  /**
   * Get specific bot details
   * GET /api/bots/:id
   */
  async getBot(botId: string) {
    const response = await this.api.get(`/bots/${botId}`);
    return response.data;
  }

  /**
   * Pause a running bot
   * POST /api/bots/:id/pause
   */
  async pauseBot(botId: string) {
    const response = await this.api.post(`/bots/${botId}/pause`);
    return response.data;
  }

  /**
   * Resume a paused bot
   * POST /api/bots/:id/resume
   */
  async resumeBot(botId: string) {
    const response = await this.api.post(`/bots/${botId}/resume`);
    return response.data;
  }

  /**
   * Stop a bot completely
   * POST /api/bots/:id/stop
   */
  async stopBot(botId: string) {
    const response = await this.api.post(`/bots/${botId}/stop`);
    return response.data;
  }

  /**
   * Update bot configuration
   * PUT /api/bots/:id/config
   */
  async updateBotConfig(
    botId: string,
    config: {
      inputs?: Record<string, any>;
      riskControl?: Record<string, any>;
      exchanges?: string[];
      initialCapital?: number;
    }
  ) {
    const response = await this.api.put(`/bots/${botId}/config`, config);
    return response.data;
  }

  /**
   * Delete a bot
   * DELETE /api/bots/:id
   */
  async deleteBot(botId: string) {
    const response = await this.api.delete(`/bots/${botId}`);
    return response.data;
  }

  // ========================================
  // Bot Trades & Performance
  // ========================================

  /**
   * Get bot trades
   * GET /api/bots/:id/trades?limit=100&offset=0
   */
  async getBotTrades(botId: string, limit: number = 100, offset: number = 0) {
    const response = await this.api.get(`/bots/${botId}/trades`, {
      params: { limit, offset },
    });
    return response.data;
  }

  /**
   * Get bot performance metrics
   * GET /api/bots/:id/performance
   */
  async getBotPerformance(botId: string) {
    const response = await this.api.get(`/bots/${botId}/performance`);
    return response.data;
  }
}

/**
 * Usage Examples
 */

// Initialize client
const client = new BotApiClient();

// ============================================================
// Example 1: Deploy a bot
// ============================================================
export async function exampleDeployBot() {
  try {
    const bot = await client.deployBot({
      strategyId: 'rsi_oversold',
      botName: 'My First Bot',
      inputs: {
        pair: 'BTC/USDT',
        quantity: 0.1,
        rsiThreshold: 30,
      },
      riskControl: {
        maxOpenTrades: 5,
        maxLossPerTrade: 100,
        maxDailyLoss: 500,
        maxLossStreak: 3,
        takeProfit: 500,
        stopLoss: -200,
        maxLeverage: 1,
        paused: false,
        maxDrawdown: 1000,
      },
      exchanges: ['binance'],
      initialCapital: 1000,
    });

    console.log('Bot deployed:', bot);
    return bot;
  } catch (error) {
    console.error('Failed to deploy bot:', error);
  }
}

// ============================================================
// Example 2: List and monitor bots
// ============================================================
export async function exampleListBots() {
  try {
    const bots = await client.listBots();

    for (const bot of bots) {
      console.log(`Bot: ${bot.botName}`);
      console.log(`  Status: ${bot.status}`);
      console.log(`  Trades: ${bot.performance.trades}`);
      console.log(`  Win Rate: ${bot.performance.winRate}%`);
      console.log(`  Profit: $${bot.performance.profit}`);
    }

    return bots;
  } catch (error) {
    console.error('Failed to list bots:', error);
  }
}

// ============================================================
// Example 3: Get bot details and trades
// ============================================================
export async function exampleGetBotDetails(botId: string) {
  try {
    // Get bot details
    const bot = await client.getBot(botId);
    console.log('Bot Details:', bot);

    // Get recent trades
    const trades = await client.getBotTrades(botId, 10, 0);
    console.log('Recent Trades:', trades);

    // Get performance metrics
    const performance = await client.getBotPerformance(botId);
    console.log('Performance:', performance);

    return { bot, trades, performance };
  } catch (error) {
    console.error('Failed to get bot details:', error);
  }
}

// ============================================================
// Example 4: Control bot (pause/resume/stop)
// ============================================================
export async function exampleControlBot(botId: string) {
  try {
    console.log('Pausing bot...');
    await client.pauseBot(botId);

    // Wait 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log('Resuming bot...');
    await client.resumeBot(botId);

    // Later: stop bot
    console.log('Stopping bot...');
    await client.stopBot(botId);
  } catch (error) {
    console.error('Failed to control bot:', error);
  }
}

// ============================================================
// Example 5: Update bot configuration
// ============================================================
export async function exampleUpdateConfig(botId: string) {
  try {
    // First pause the bot
    await client.pauseBot(botId);

    // Update configuration
    const updated = await client.updateBotConfig(botId, {
      inputs: {
        pair: 'BTC/USDT',
        quantity: 0.2, // Increased position size
        rsiThreshold: 25, // More aggressive
      },
      riskControl: {
        maxLossPerTrade: 150,
        maxDailyLoss: 600,
      },
    });

    console.log('Configuration updated:', updated);

    // Resume bot with new config
    await client.resumeBot(botId);
  } catch (error) {
    console.error('Failed to update config:', error);
  }
}

// ============================================================
// Example 6: Delete bot
// ============================================================
export async function exampleDeleteBot(botId: string) {
  try {
    await client.deleteBot(botId);
    console.log('Bot deleted successfully');
  } catch (error) {
    console.error('Failed to delete bot:', error);
  }
}

// ============================================================
// Example 7: React Hook for bot management
// ============================================================
export function useBotManagement() {
  const [bots, setBots] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Load bots on mount
  React.useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    try {
      setLoading(true);
      const data = await client.listBots();
      setBots(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bots');
    } finally {
      setLoading(false);
    }
  };

  const deployBot = async (botData: any) => {
    try {
      setLoading(true);
      const newBot = await client.deployBot(botData);
      setBots([...bots, newBot]);
      setError(null);
      return newBot;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deploy bot');
    } finally {
      setLoading(false);
    }
  };

  const pauseBot = async (botId: string) => {
    try {
      await client.pauseBot(botId);
      loadBots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause bot');
    }
  };

  const resumeBot = async (botId: string) => {
    try {
      await client.resumeBot(botId);
      loadBots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume bot');
    }
  };

  const stopBot = async (botId: string) => {
    try {
      await client.stopBot(botId);
      loadBots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop bot');
    }
  };

  return {
    bots,
    loading,
    error,
    loadBots,
    deployBot,
    pauseBot,
    resumeBot,
    stopBot,
  };
}

// Export client for direct use
export default client;
export { BotApiClient };
