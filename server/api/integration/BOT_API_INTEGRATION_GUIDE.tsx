/**
 * Bot API Integration Guide
 * How to use bot trading endpoints in the main application
 */

// ============================================================
// 1. USING THE BOT API IN FRONTEND COMPONENTS
// ============================================================

/**
 * Example: Deploy a new bot from the Strategy Wizard
 */
import { useAuth } from '@/pages/hooks/useAuth';

export function DeployBotExample() {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const deployBot = async (config: any) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/bots/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          strategyId: config.strategyId,
          botName: config.botName,
          inputs: config.inputs,
          riskControl: config.riskControl,
          exchanges: config.exchanges,
          initialCapital: config.initialCapital,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const bot = await response.json();
      return bot;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to deploy bot';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={() => deployBot({ /* config */ })}>
        Deploy Bot
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading && <p>Deploying...</p>}
    </div>
  );
}

// ============================================================
// 2. API HELPER UTILITIES
// ============================================================

/**
 * Create a reusable hook for bot API calls
 * File: client/src/pages/hooks/useBotAPI.ts
 */
export function useBotAPI() {
  const getAuthHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || ''}`,
    };
  };

  // List bots
  const listBots = async () => {
    const res = await fetch('/api/bots', {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to list bots');
    return res.json();
  };

  // Get bot details
  const getBot = async (botId: string) => {
    const res = await fetch(`/api/bots/${botId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to get bot');
    return res.json();
  };

  // Deploy bot
  const deployBot = async (config: any) => {
    const res = await fetch('/api/bots/deploy', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Failed to deploy bot');
    return res.json();
  };

  // Pause bot
  const pauseBot = async (botId: string) => {
    const res = await fetch(`/api/bots/${botId}/pause`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to pause bot');
    return res.json();
  };

  // Resume bot
  const resumeBot = async (botId: string) => {
    const res = await fetch(`/api/bots/${botId}/resume`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to resume bot');
    return res.json();
  };

  // Stop bot
  const stopBot = async (botId: string) => {
    const res = await fetch(`/api/bots/${botId}/stop`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to stop bot');
    return res.json();
  };

  // Update configuration
  const updateConfig = async (botId: string, updates: any) => {
    const res = await fetch(`/api/bots/${botId}/config`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update config');
    return res.json();
  };

  // Delete bot
  const deleteBot = async (botId: string) => {
    const res = await fetch(`/api/bots/${botId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete bot');
    return res.json();
  };

  // Get trades
  const getTrades = async (botId: string, limit = 100, offset = 0) => {
    const res = await fetch(
      `/api/bots/${botId}/trades?limit=${limit}&offset=${offset}`,
      {
        method: 'GET',
        headers: getAuthHeaders(),
      }
    );
    if (!res.ok) throw new Error('Failed to get trades');
    return res.json();
  };

  // Get performance
  const getPerformance = async (botId: string) => {
    const res = await fetch(`/api/bots/${botId}/performance`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to get performance');
    return res.json();
  };

  return {
    listBots,
    getBot,
    deployBot,
    pauseBot,
    resumeBot,
    stopBot,
    updateConfig,
    deleteBot,
    getTrades,
    getPerformance,
  };
}

// ============================================================
// 3. REACT QUERY INTEGRATION
// ============================================================

/**
 * Use React Query for data fetching and caching
 * Install: npm install @tanstack/react-query
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useBotQueries() {
  const queryClient = useQueryClient();
  const botAPI = useBotAPI();

  // List bots query
  const botsQuery = useQuery({
    queryKey: ['bots'],
    queryFn: botAPI.listBots,
    staleTime: 30000, // 30 seconds
  });

  // Deploy bot mutation
  const deployBotMutation = useMutation({
    mutationFn: botAPI.deployBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] });
    },
  });

  // Pause bot mutation
  const pauseBotMutation = useMutation({
    mutationFn: (botId: string) => botAPI.pauseBot(botId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] });
    },
  });

  // Get bot performance query
  const usePerformance = (botId: string) =>
    useQuery({
      queryKey: ['bots', botId, 'performance'],
      queryFn: () => botAPI.getPerformance(botId),
      enabled: !!botId,
      refetchInterval: 60000, // Refresh every minute
    });

  return {
    botsQuery,
    deployBotMutation,
    pauseBotMutation,
    usePerformance,
  };
}

// ============================================================
// 4. COMPONENT INTEGRATION EXAMPLES
// ============================================================

/**
 * Example: List bots in the dashboard
 */
export function BotListComponent() {
  const { botsQuery } = useBotQueries();

  if (botsQuery.isLoading) return <p>Loading bots...</p>;
  if (botsQuery.error) return <p>Error loading bots</p>;

  return (
    <div>
      <h2>My Bots ({botsQuery.data?.length || 0})</h2>
      {botsQuery.data?.map((bot: any) => (
        <div key={bot.id}>
          <h3>{bot.botName}</h3>
          <p>Status: {bot.status}</p>
          <p>Profit: ${bot.performance?.profit || 0}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Example: Deploy bot from wizard
 */
export function DeployBotComponent() {
  const { deployBotMutation } = useBotQueries();

  const handleDeploy = async (config: any) => {
    try {
      const bot = await deployBotMutation.mutateAsync(config);
      alert(`Bot deployed: ${bot.id}`);
    } catch (error) {
      alert('Failed to deploy bot');
    }
  };

  return (
    <button onClick={() => handleDeploy({ /* config */ })}>
      {deployBotMutation.isPending ? 'Deploying...' : 'Deploy Bot'}
    </button>
  );
}

// ============================================================
// 5. INTEGRATION WITH EXISTING TRADING DASHBOARD
// ============================================================

/**
 * The bot API endpoints integrate seamlessly with:
 * - /pages/dashboard/trading - Add bot status section
 * - /pages/dashboard/bots - Bot management page
 * - /pages/dashboard - Show active bots
 * - TradingDashboard.tsx - Show bot trades in history
 */

// Example: Add to TradingDashboard.tsx
export function BotStatusInTradingDashboard() {
  const { botsQuery } = useBotQueries();
  const activeBots = botsQuery.data?.filter((b: any) => b.status === 'running') || [];

  return (
    <div className="bot-status">
      <h3>🤖 Active Bots: {activeBots.length}</h3>
      <div className="stats">
        <span>Total Profit: ${activeBots.reduce((sum: number, b: any) => sum + (b.performance?.profit || 0), 0)}</span>
      </div>
    </div>
  );
}

// ============================================================
// 6. ERROR HANDLING & AUTHENTICATION
// ============================================================

/**
 * The API routes automatically:
 * ✓ Check authentication via getServerSession()
 * ✓ Validate user ownership of bots
 * ✓ Handle all errors with proper HTTP codes
 * ✓ Return 401 if not authenticated
 * ✓ Return 404 if bot doesn't exist
 * ✓ Return 500 if server error
 */

// Custom error handler
export function handleBotAPIError(error: any): string {
  if (error.status === 401) {
    return 'Please login to manage bots';
  }
  if (error.status === 404) {
    return 'Bot not found';
  }
  if (error.status === 400) {
    return 'Invalid request';
  }
  return error.message || 'An error occurred';
}

// ============================================================
// 7. TYPESCRIPT TYPES
// ============================================================

/**
 * Add to shared types file
 */
export interface Bot {
  id: string;
  strategyId: string;
  botName: string;
  status: 'running' | 'paused' | 'stopped' | 'error';
  deployedAt: string;
  configuration: {
    inputs: Record<string, any>;
    riskControl: Record<string, any>;
  };
  performance: {
    trades: number;
    wins: number;
    losses: number;
    profit: number;
    profitPercent: number;
    winRate?: number;
  };
}

export interface BotTrade {
  id: string;
  pair: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  pnl: number;
  status: 'pending' | 'filled' | 'cancelled';
  timestamp: string;
}

export interface BotPerformance {
  botId: string;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  totalProfit: number;
  sharpeRatio: number;
}

// ============================================================
// 8. ENVIRONMENT SETUP
// ============================================================

/**
 * Add to .env.local:
 */
// BINANCE_API_KEY=your_testnet_key
// BINANCE_API_SECRET=your_testnet_secret
// BINANCE_SANDBOX=true
// DATABASE_URL=postgresql://user:pass@localhost:5432/trading

// ============================================================
// 9. DATABASE SETUP
// ============================================================

/**
 * Run migrations:
 * npm run db:generate
 * npm run db:migrate
 *
 * Verify tables created:
 * - bots
 * - bot_trades
 * - bot_performance
 * - bot_action_log
 */

// ============================================================
// 10. TESTING
// ============================================================

/**
 * Test with curl:
 */
// # List bots
// curl http://localhost:3000/api/bots \
//   -H "Authorization: Bearer YOUR_TOKEN"

// # Deploy bot
// curl -X POST http://localhost:3000/api/bots/deploy \
//   -H "Authorization: Bearer YOUR_TOKEN" \
//   -H "Content-Type: application/json" \
//   -d '{
//     "strategyId": "rsi_oversold",
//     "botName": "Test Bot",
//     "inputs": {"pair": "BTC/USDT", "quantity": 0.1},
//     "riskControl": {"maxLoss": 100},
//     "exchanges": ["binance"],
//     "initialCapital": 1000
//   }'

// # Get bot details
// curl http://localhost:3000/api/bots/bot-123 \
//   -H "Authorization: Bearer YOUR_TOKEN"

// # Pause bot
// curl -X POST http://localhost:3000/api/bots/bot-123/pause \
//   -H "Authorization: Bearer YOUR_TOKEN"

export default {};
