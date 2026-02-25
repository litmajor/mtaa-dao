/**
 * useBotAPI Hook
 * Reusable hook for all bot API operations
 * Integrates with existing app authentication and structure
 */

import { useCallback } from 'react';
import { useAuth } from './useAuth';

interface BotConfig {
  strategyId: string;
  botName: string;
  inputs: Record<string, any>;
  riskControl: Record<string, any>;
  exchanges: string[];
  initialCapital: number;
}

interface UpdateConfigRequest {
  inputs?: Record<string, any>;
  riskControl?: Record<string, any>;
  exchanges?: string[];
  initialCapital?: number;
}

export function useBotAPI() {
  const { user } = useAuth();

  /**
   * Get auth headers with token
   */
  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }, []);

  /**
   * Generic API call wrapper
   */
  const apiCall = useCallback(
    async <T,>(
      endpoint: string,
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
      body?: any
    ): Promise<T> => {
      if (!user) {
        throw new Error('Not authenticated');
      }

      const url = `/api/bots${endpoint}`;
      const options: RequestInit = {
        method,
        headers: getHeaders(),
        credentials: 'include',
      };

      if (body && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `API error: ${response.statusText}`
        );
      }

      return response.json();
    },
    [user, getHeaders]
  );

  /**
   * List all user bots
   */
  const listBots = useCallback(() => apiCall<any[]>(''), [apiCall]);

  /**
   * Get specific bot details
   */
  const getBot = useCallback(
    (botId: string) => apiCall<any>(`/${botId}`),
    [apiCall]
  );

  /**
   * Deploy a new bot
   */
  const deployBot = useCallback(
    (config: BotConfig) => apiCall<any>('/deploy', 'POST', config),
    [apiCall]
  );

  /**
   * Pause bot execution
   */
  const pauseBot = useCallback(
    (botId: string) => apiCall<any>(`/${botId}/pause`, 'POST'),
    [apiCall]
  );

  /**
   * Resume bot execution
   */
  const resumeBot = useCallback(
    (botId: string) => apiCall<any>(`/${botId}/resume`, 'POST'),
    [apiCall]
  );

  /**
   * Stop bot completely
   */
  const stopBot = useCallback(
    (botId: string) => apiCall<any>(`/${botId}/stop`, 'POST'),
    [apiCall]
  );

  /**
   * Update bot configuration
   */
  const updateConfig = useCallback(
    (botId: string, updates: UpdateConfigRequest) =>
      apiCall<any>(`/${botId}/config`, 'PUT', updates),
    [apiCall]
  );

  /**
   * Delete a bot
   */
  const deleteBot = useCallback(
    (botId: string) => apiCall<any>(`/${botId}`, 'DELETE'),
    [apiCall]
  );

  /**
   * Get bot trades
   */
  const getTrades = useCallback(
    (botId: string, limit = 100, offset = 0) =>
      apiCall<any[]>(`/${botId}/trades?limit=${limit}&offset=${offset}`),
    [apiCall]
  );

  /**
   * Get bot performance metrics
   */
  const getPerformance = useCallback(
    (botId: string) => apiCall<any>(`/${botId}/performance`),
    [apiCall]
  );

  return {
    // State
    isAuthenticated: !!user,
    userId: user?.id,

    // Operations
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

/**
 * Usage Examples:
 *
 * // In a component
 * function MyBotDashboard() {
 *   const botAPI = useBotAPI();
 *   const [bots, setBots] = React.useState([]);
 *   const [loading, setLoading] = React.useState(false);
 *
 *   React.useEffect(() => {
 *     setLoading(true);
 *     botAPI
 *       .listBots()
 *       .then(setBots)
 *       .catch(console.error)
 *       .finally(() => setLoading(false));
 *   }, [botAPI]);
 *
 *   if (loading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       {bots.map(bot => (
 *         <div key={bot.id}>
 *           <h3>{bot.botName}</h3>
 *           <p>Status: {bot.status}</p>
 *           <button onClick={() => botAPI.pauseBot(bot.id)}>
 *             Pause
 *           </button>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 */
