/**
 * useBotAPI Hook
 * Reusable hook for all bot API operations
 * Integrates with existing app authentication and structure
 */

import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { authClient } from '@/utils/authClient';

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
   * Generic API call wrapper using authClient
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
      
      try {
        switch (method) {
          case 'GET':
            return await authClient.get<T>(url);
          case 'POST':
            return await authClient.post<T>(url, body || {});
          case 'PUT':
            return await authClient.put<T>(url, body || {});
          case 'DELETE':
            return await authClient.delete<T>(url);
          default:
            throw new Error(`Unsupported method: ${method}`);
        }
      } catch (error) {
        throw error;
      }
    },
    [user]
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