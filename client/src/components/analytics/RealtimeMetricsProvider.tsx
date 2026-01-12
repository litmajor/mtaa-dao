/**
 * Real-Time Metrics Provider
 * Manages WebSocket/polling connections for live metric updates
 * 
 * Usage:
 * <RealtimeMetricsProvider>
 *   <DashboardPage />
 * </RealtimeMetricsProvider>
 */

import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { Logger } from '@/utils/logger';

const logger = new Logger('RealtimeMetricsProvider');

// ============================================================================
// TYPES
// ============================================================================

export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;  // milliseconds
}

export interface RealtimeMetricsContextType {
  // Subscription management
  subscribe: (channel: string, handler: (data: any) => void) => string;
  unsubscribe: (channel: string, subscriptionId: string) => void;
  
  // Connection status
  isConnected: boolean;
  lastUpdate: Date | null;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  error: Error | null;
  
  // Manual refresh
  refresh: (channel: string) => Promise<void>;
  
  // Cache management
  getCachedData: (channel: string) => any;
  clearCache: (channel: string | 'all') => void;
  
  // Configuration
  setRefreshInterval: (channel: string, interval: number) => void;
}

// ============================================================================
// CONTEXT & CONSTANTS
// ============================================================================

export const RealtimeMetricsContext = createContext<RealtimeMetricsContextType | undefined>(undefined);

const DEFAULT_CACHE_TTL = 5 * 60 * 1000;  // 5 minutes
const DEFAULT_REFRESH_INTERVAL = 30 * 1000;  // 30 seconds
const DEFAULT_POLLING_INTERVAL = 60 * 1000;  // 60 seconds
const RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

// Polling intervals by channel pattern
const POLLING_INTERVALS: Record<string, number> = {
  'vault:*:metrics': 30 * 1000,       // 30 seconds
  'vault:*:transactions': 60 * 1000,   // 60 seconds
  'dao:*:contributions': 45 * 1000,    // 45 seconds
  'dao:*:leaderboard': 60 * 1000,      // 60 seconds
  'system:prices': 15 * 1000,          // 15 seconds
};

// ============================================================================
// WEBSOCKET MANAGER
// ============================================================================

class MetricsWebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts: number = 0;
  private reconnectDelay: number = RECONNECT_DELAY_MS;
  private isIntentionallyClosed: boolean = false;
  
  // Subscriptions: { channelName: Set<{ id: string; handler: Function }> }
  private subscriptions: Map<string, Set<{ id: string; handler: (data: any) => void }>>;
  
  // Cache: { channelName: CacheEntry }
  private cache: Map<string, CacheEntry>;
  
  // Polling intervals: { channelName: NodeJS.Timer | null }
  private pollingIntervals: Map<string, NodeJS.Timer>;
  
  // Event listeners
  private listeners: Map<string, Set<(event: any) => void>>;
  
  // Fetch function for polling
  private fetchFn: (channel: string) => Promise<any>;

  constructor(url: string, fetchFn: (channel: string) => Promise<any>) {
    this.url = url;
    this.subscriptions = new Map();
    this.cache = new Map();
    this.pollingIntervals = new Map();
    this.listeners = new Map();
    this.fetchFn = fetchFn;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          logger.info('WebSocket connected');
          this.reconnectAttempts = 0;
          this.reconnectDelay = RECONNECT_DELAY_MS;
          this.emit('connected', {});
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            const { channel, data } = message;

            if (channel) {
              this.cache.set(channel, {
                data,
                timestamp: Date.now(),
                ttl: DEFAULT_CACHE_TTL,
              });

              // Notify all subscribers
              const subs = this.subscriptions.get(channel);
              if (subs) {
                subs.forEach(({ handler }) => {
                  try {
                    handler(data);
                  } catch (err) {
                    logger.error(`Error in subscription handler for ${channel}:`, err);
                  }
                });
              }

              this.emit('message', { channel, data });
            }
          } catch (err) {
            logger.error('Error parsing WebSocket message:', err);
          }
        };

        this.ws.onerror = (event) => {
          logger.error('WebSocket error:', event);
          this.emit('error', event);
        };

        this.ws.onclose = () => {
          logger.warn('WebSocket closed');
          this.ws = null;
          this.emit('disconnected', {});

          // Attempt reconnection if not intentionally closed
          if (!this.isIntentionallyClosed && this.subscriptions.size > 0) {
            setTimeout(() => this.reconnect(), this.reconnectDelay);
          }
        };

        // Timeout after 5 seconds
        setTimeout(() => {
          if (this.ws?.readyState === WebSocket.CONNECTING) {
            this.ws?.close();
            resolve(false);
          }
        }, 5000);
      } catch (err) {
        logger.error('Failed to create WebSocket:', err);
        resolve(false);
      }
    });
  }

  /**
   * Reconnect with exponential backoff
   */
  private reconnect(): void {
    this.reconnectAttempts++;
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      MAX_RECONNECT_DELAY_MS
    );

    logger.info(
      `Reconnecting (attempt ${this.reconnectAttempts}, delay ${this.reconnectDelay}ms)`
    );

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channel: string, handler: (data: any) => void): string {
    const id = `${Date.now()}-${Math.random()}`;

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());

      // Start polling for this channel if not connected
      if (!this.isConnected()) {
        this.startPolling(channel);
      }

      // Send subscription message if connected
      if (this.isConnected()) {
        this.send({ type: 'subscribe', channel });
      }
    }

    this.subscriptions.get(channel)!.add({ id, handler });
    logger.info(`Subscription added: ${channel} (${id})`);

    return id;
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: string, subscriptionId: string): void {
    const subs = this.subscriptions.get(channel);
    if (subs) {
      subs.forEach((sub) => {
        if (sub.id === subscriptionId) {
          subs.delete(sub);
        }
      });

      // If no more subscribers, unsubscribe from server and stop polling
      if (subs.size === 0) {
        this.subscriptions.delete(channel);
        if (this.isConnected()) {
          this.send({ type: 'unsubscribe', channel });
        }
        this.stopPolling(channel);
        logger.info(`All subscribers removed for: ${channel}`);
      }
    }
  }

  /**
   * Send message to server
   */
  private send(message: any): void {
    if (this.isConnected()) {
      try {
        this.ws!.send(JSON.stringify(message));
      } catch (err) {
        logger.error('Failed to send WebSocket message:', err);
      }
    }
  }

  /**
   * Start polling for a channel (fallback if WebSocket unavailable)
   */
  private startPolling(channel: string): void {
    if (this.pollingIntervals.has(channel)) {
      return;
    }

    // Get interval from pattern matching
    let interval = DEFAULT_POLLING_INTERVAL;
    for (const [pattern, intervalMs] of Object.entries(POLLING_INTERVALS)) {
      const regex = pattern.replace('*', '.*');
      if (new RegExp(`^${regex}$`).test(channel)) {
        interval = intervalMs;
        break;
      }
    }

    logger.info(`Starting polling for ${channel} (interval: ${interval}ms)`);

    const timer = setInterval(async () => {
      try {
        const data = await this.fetchFn(channel);
        if (data) {
          // Update cache and notify subscribers
          this.cache.set(channel, {
            data,
            timestamp: Date.now(),
            ttl: DEFAULT_CACHE_TTL,
          });

          const subs = this.subscriptions.get(channel);
          if (subs) {
            subs.forEach(({ handler }) => {
              try {
                handler(data);
              } catch (err) {
                logger.error(`Error in polling handler for ${channel}:`, err);
              }
            });
          }
        }
      } catch (err) {
        logger.error(`Polling error for ${channel}:`, err);
      }
    }, interval);

    this.pollingIntervals.set(channel, timer);
  }

  /**
   * Stop polling for a channel
   */
  private stopPolling(channel: string): void {
    const timer = this.pollingIntervals.get(channel);
    if (timer) {
      clearInterval(timer);
      this.pollingIntervals.delete(channel);
      logger.info(`Stopped polling for ${channel}`);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get cached data for a channel
   */
  getCachedData(channel: string): any {
    const entry = this.cache.get(channel);
    if (!entry) return null;

    // Check if cache is still valid
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(channel);
      return null;
    }

    return entry.data;
  }

  /**
   * Clear cache for a channel
   */
  clearCache(channel: string | 'all'): void {
    if (channel === 'all') {
      this.cache.clear();
    } else {
      this.cache.delete(channel);
    }
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    this.pollingIntervals.forEach((timer) => clearInterval(timer));
    this.pollingIntervals.clear();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Event emitter
   */
  on(event: string, handler: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (err) {
        logger.error(`Error in event handler for ${event}:`, err);
      }
    });
  }
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface RealtimeMetricsProviderProps {
  children: React.ReactNode;
  apiBaseUrl?: string;
  webSocketUrl?: string;
  cacheTTL?: number;
  enablePolling?: boolean;
}

export const RealtimeMetricsProvider: React.FC<RealtimeMetricsProviderProps> = ({
  children,
  apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  webSocketUrl,
  cacheTTL = DEFAULT_CACHE_TTL,
  enablePolling = true,
}) => {
  // Safely construct WebSocket URL, ensuring no undefined values
  const safeWebSocketUrl = (() => {
    if (webSocketUrl) return webSocketUrl;
    const wsUrl = import.meta.env.VITE_WS_URL;
    
    // Check if wsUrl is valid and doesn't contain 'undefined'
    if (wsUrl && wsUrl !== 'undefined' && !wsUrl.includes('undefined')) {
      if (wsUrl.toLowerCase().startsWith('ws')) {
        console.log('Using VITE_WS_URL:', wsUrl);
        return wsUrl;
      }
    }
    
    // Fallback: construct from current location
    const host = window.location.hostname || 'localhost';
    const port = window.location.port;
    
    // Only append port if it's explicitly set (not empty string)
    if (port && port !== '80' && port !== '443') {
      return `ws://${host}:${port}`;
    } else if (window.location.protocol === 'https:') {
      return `wss://${host}`;
    } else {
      return `ws://${host}:5000`; // Default fallback
    }
  })();
  
  console.log('[RealtimeMetricsProvider] WebSocket URL:', safeWebSocketUrl);
  
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>('disconnected');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const managerRef = useRef<MetricsWebSocketManager | null>(null);

  // Validate WebSocket URL
  const isValidWebSocketUrl = useCallback(() => {
    try {
      // Make sure URL doesn't contain 'undefined' or other invalid values
      if (!safeWebSocketUrl || safeWebSocketUrl.includes('undefined') || safeWebSocketUrl.includes('null')) {
        console.error('[RealtimeMetricsProvider] Invalid WebSocket URL:', safeWebSocketUrl);
        return false;
      }
      // Try to create a URL object to validate format
      new URL(safeWebSocketUrl);
      return true;
    } catch (e) {
      console.error('[RealtimeMetricsProvider] WebSocket URL validation failed:', e);
      return false;
    }
  }, [safeWebSocketUrl]);

  // Initialize WebSocket manager
  useEffect(() => {
    if (!isValidWebSocketUrl() || !enablePolling) {
      logger.warn('WebSocket not configured or invalid, falling back to polling only');
      return;
    }

    // Fetch function for polling
    const fetchData = async (channel: string) => {
      try {
        // Parse channel to determine endpoint
        const parts = channel.split(':');
        let endpoint = '/system/health';

        if (parts[0] === 'vault' && parts[2] === 'metrics') {
          endpoint = `/vault/${parts[1]}/performance`;
        } else if (parts[0] === 'vault' && parts[2] === 'transactions') {
          endpoint = `/vault/${parts[1]}/transactions`;
        } else if (parts[0] === 'dao' && parts[2] === 'contributions') {
          endpoint = `/analyzer/contributions/${parts[1]}`;
        } else if (parts[0] === 'dao' && parts[2] === 'leaderboard') {
          endpoint = `/analyzer/contributions/${parts[1]}`;
        }

        const token = localStorage.getItem('accessToken');
        const response = await fetch(`${apiBaseUrl}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
      } catch (err) {
        logger.error(`Failed to fetch ${channel}:`, err);
        return null;
      }
    };

    const manager = new MetricsWebSocketManager(safeWebSocketUrl, fetchData);
    managerRef.current = manager;

    // Connection state handlers
    manager.on('connected', () => {
      setConnectionStatus('connected');
      setIsConnected(true);
      setError(null);
      setLastUpdate(new Date());
    });

    manager.on('disconnected', () => {
      setConnectionStatus('disconnected');
      setIsConnected(false);
    });

    manager.on('error', (err) => {
      setConnectionStatus('error');
      setError(new Error(`WebSocket error: ${err}`));
    });

    manager.on('message', () => {
      setLastUpdate(new Date());
    });

    // Attempt connection
    setConnectionStatus('connecting');
    manager.connect();

    // Cleanup on unmount
    return () => {
      manager.disconnect();
    };
  }, [safeWebSocketUrl, enablePolling, apiBaseUrl]);

  const subscribe = useCallback(
    (channel: string, handler: (data: any) => void): string => {
      if (!managerRef.current) {
        logger.error('Metrics manager not initialized');
        return '';
      }
      return managerRef.current.subscribe(channel, handler);
    },
    []
  );

  const unsubscribe = useCallback(
    (channel: string, subscriptionId: string) => {
      if (managerRef.current) {
        managerRef.current.unsubscribe(channel, subscriptionId);
      }
    },
    []
  );

  const refresh = useCallback(
    async (channel: string): Promise<void> => {
      if (!managerRef.current) return;
      
      try {
        // Clear cache to force refresh
        managerRef.current.clearCache(channel);
        setLastUpdate(new Date());
      } catch (err) {
        setError(new Error(`Failed to refresh ${channel}`));
      }
    },
    []
  );

  const getCachedData = useCallback(
    (channel: string): any => {
      return managerRef.current?.getCachedData(channel) ?? null;
    },
    []
  );

  const clearCache = useCallback(
    (channel: string | 'all') => {
      managerRef.current?.clearCache(channel);
    },
    []
  );

  const setRefreshInterval = useCallback(
    (channel: string, interval: number) => {
      // This would require extending the manager
      logger.warn('setRefreshInterval not yet implemented');
    },
    []
  );

  const value: RealtimeMetricsContextType = {
    subscribe,
    unsubscribe,
    isConnected,
    lastUpdate,
    connectionStatus,
    error,
    refresh,
    getCachedData,
    clearCache,
    setRefreshInterval,
  };

  return (
    <RealtimeMetricsContext.Provider value={value}>
      {children}
    </RealtimeMetricsContext.Provider>
  );
};

export default RealtimeMetricsProvider;
