import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * API Configuration
 * Frontend: 5173 (Vite) | Backend: 5000
 * 
 * The unified dashboard communicates with backend at port 5000 via:
 * - REST API: http://localhost:5000/api/*
 * - WebSocket: ws://localhost:5000 (for real-time updates)
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5000';

export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  WS_URL: WS_URL,
  
  // Endpoints
  ENDPOINTS: {
    // Dashboard
    DASHBOARD_METRICS: `${API_BASE_URL}/api/dashboard/metrics`,
    DASHBOARD_OVERVIEW: `${API_BASE_URL}/api/morio/overview`,
    
    // Elders & Analytics
    ELDERS_KAIZEN_ALL: `${API_BASE_URL}/api/elders/kaizen/all-metrics`,
    ELDERS_KAIZEN_DAO: (daoId: string) => `${API_BASE_URL}/api/elders/kaizen/dao/${daoId}/metrics`,
    ELDERS_KAIZEN_RECOMMENDATIONS: (daoId: string) => `${API_BASE_URL}/api/elders/kaizen/dao/${daoId}/recommendations`,
    ELDERS_KAIZEN_OPPORTUNITIES: (daoId: string, category: string) => 
      `${API_BASE_URL}/api/elders/kaizen/dao/${daoId}/opportunities/${category}`,
    
    // Data Hub (Aggregated)
    MORIO_ELDERS: `${API_BASE_URL}/api/morio/elders/overview`,
    MORIO_TREASURY: (daoId?: string) => 
      daoId ? `${API_BASE_URL}/api/morio/treasury/overview?daoId=${daoId}` : `${API_BASE_URL}/api/morio/treasury/overview`,
    MORIO_GOVERNANCE: (daoId?: string) => 
      daoId ? `${API_BASE_URL}/api/morio/governance/overview?daoId=${daoId}` : `${API_BASE_URL}/api/morio/governance/overview`,
    MORIO_COMMUNITY: (daoId?: string) => 
      daoId ? `${API_BASE_URL}/api/morio/community/overview?daoId=${daoId}` : `${API_BASE_URL}/api/morio/community/overview`,
    
    // DAO Specific
    DAO_METRICS: (daoId: string) => `${API_BASE_URL}/api/dao/${daoId}/metrics`,
    DAO_LIST: `${API_BASE_URL}/api/daos`,
    
    // Activity & Logs
    ACTIVITY_LOGS: `${API_BASE_URL}/api/admin/activity-logs`,
    
    // Trading & Arbitrage
    ARBITRAGE_OPPORTUNITIES: `${API_BASE_URL}/api/discover/arbitrage`,
    ARBITRAGE_ASSET: (symbol: string) => `${API_BASE_URL}/api/discover/arbitrage/${symbol}`,
    
    // Market Data
    EXCHANGE_PRICES: (pair: string) => `${API_BASE_URL}/api/exchanges/prices?pair=${pair}`,
    MARKET_DATA: `${API_BASE_URL}/api/exchanges/market-data`,
    
    // Global Metrics
    GLOBAL_METRICS: `${API_BASE_URL}/api/global-metrics`,
    FEAR_GREED: `${API_BASE_URL}/api/global-metrics/fear-greed`,
    
    // Asset Discovery
    ASSET_DISCOVER: `${API_BASE_URL}/api/discover/assets`,
    ASSET_DISCOVERY_SYNC: `${API_BASE_URL}/api/discover/sync`,
  },
  
  // WebSocket Events
  WS_EVENTS: {
    PLATFORM_METRICS: 'PLATFORM_METRICS',
    DAO_METRICS: 'DAO_METRICS',
    OPPORTUNITY: 'OPPORTUNITY',
    MARKET_DATA: 'MARKET_DATA',
    GLOBAL_METRICS: 'GLOBAL_METRICS',
    ACTIVITY: 'ACTIVITY',
    ARBITRAGE: 'ARBITRAGE',
  },
};

// Helper function to fetch data
export async function fetchAPI(endpoint: string, options?: RequestInit) {
  try {
    const response = await fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Fetch Error:', error);
    throw error;
  }
}

// Context for API availability
interface APIContextType {
  isConnected: boolean;
  lastUpdate: Date | null;
  error: string | null;
}

const APIContext = createContext<APIContextType>({
  isConnected: false,
  lastUpdate: null,
  error: null,
});

export const useAPIStatus = () => useContext(APIContext);

export function APIProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [status, setStatus] = useState<APIContextType>({
    isConnected: false,
    lastUpdate: null,
    error: null,
  });

  useEffect(() => {
    // Check API health on mount
    const checkHealth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (response.ok) {
          setStatus({
            isConnected: true,
            lastUpdate: new Date(),
            error: null,
          });
        } else {
          setStatus({
            isConnected: false,
            lastUpdate: null,
            error: 'API returned non-OK status',
          });
        }
      } catch (error) {
        setStatus({
          isConnected: false,
          lastUpdate: null,
          error: error instanceof Error ? error.message : 'Connection failed',
        });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, []);

  return <APIContext.Provider value={status}>{children}</APIContext.Provider>;
}

export default API_CONFIG;
