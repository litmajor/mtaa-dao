'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

type EventData = Record<string, unknown>;

interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnection?: boolean;
}

/**
 * useWebSocket Hook
 * Core WebSocket connection management
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('No authentication token found');
      setIsLoading(false);
      return;
    }

    const socketUrl = options.url || process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

    const socket = io(socketUrl, {
      auth: {
        token
      },
      reconnection: options.reconnection !== false,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      autoConnect: options.autoConnect !== false
    });

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
      setIsLoading(false);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('error:permission', (data: unknown) => {
      const msg = typeof data === 'object' && data !== null && 'message' in data ? (data as any).message : undefined;
      setError(msg || 'Permission denied');
    });

    socket.on('connect_error', (error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error);
      setError(msg || 'Connection error');
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [options.url, options.autoConnect, options.reconnection]);

  const subscribe = useCallback((room: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe:room', { room });
    }
  }, []);

  const unsubscribe = useCallback((room: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe:room', { room });
    }
  }, []);

  const emit = useCallback((event: string, data: Record<string, unknown> | unknown) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const on = useCallback((event: string, callback: (data: unknown) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  }, []);

  const off = useCallback((event: string, callback?: (data: unknown) => void) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    emit,
    on,
    off
  };
}

/**
 * useRealtimeNotifications Hook
 * Receive and manage real-time notifications
 */
export function useRealtimeNotifications() {
  const { socket, subscribe, unsubscribe, on, off } = useWebSocket();
  const [notifications, setNotifications] = useState<EventData[]>([]);

  useEffect(() => {
    if (!socket) return;

    subscribe('alerts');
    subscribe('dashboard:updates');

    const handleAlert = (data: unknown) => {
      const d = typeof data === 'object' && data !== null ? data as EventData : { payload: String(data) };
      setNotifications(prev => [d, ...prev].slice(0, 50)); // Keep last 50
    };

    const handleDashboardUpdate = (data: unknown) => {
      const d = typeof data === 'object' && data !== null ? data as EventData : { payload: String(data) };
      setNotifications(prev => [
        { type: 'dashboard', ...d },
        ...prev
      ].slice(0, 50));
    };

    on('alert:new', handleAlert);
    on('dashboard:update', handleDashboardUpdate);

    return () => {
      off('alert:new', handleAlert);
      off('dashboard:update', handleDashboardUpdate);
      unsubscribe('alerts');
      unsubscribe('dashboard:updates');
    };
  }, [socket, subscribe, unsubscribe, on, off]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const removeNotification = useCallback((index: number) => {
    setNotifications(prev => prev.filter((_, i) => i !== index));
  }, []);

  return {
    notifications,
    clearNotifications,
    removeNotification
  };
}

/**
 * useRealtimeActivity Hook
 * Stream of activity events
 */
export function useRealtimeActivity(entityType?: string, entityId?: string) {
  const { socket, subscribe, unsubscribe, on, off } = useWebSocket();
  const [activities, setActivities] = useState<EventData[]>([]);

  useEffect(() => {
    if (!socket) return;

    const room = entityId ? `activity:${entityType}:${entityId}` : 'activity:feed';
    subscribe(room);

    const handleActivity = (data: unknown) => {
      const d = typeof data === 'object' && data !== null ? data as EventData : { payload: String(data) };
      setActivities(prev => [d, ...prev].slice(0, 100));
    };

    on('activity:logged', handleActivity);
    on('activity:new', handleActivity);

    return () => {
      off('activity:logged', handleActivity);
      off('activity:new', handleActivity);
      unsubscribe(room);
    };
  }, [socket, entityType, entityId, subscribe, unsubscribe, on, off]);

  return { activities };
}

/**
 * useRealtimeConfig Hook
 * Real-time configuration changes
 */
export function useRealtimeConfig(entityType: string, entityId: string) {
  const { socket, subscribe, unsubscribe, on, off } = useWebSocket();
  const [configChange, setConfigChange] = useState<EventData | null>(null);
  const [changeTimestamp, setChangeTimestamp] = useState<Date | null>(null);

  useEffect(() => {
    if (!socket) return;

    const room = `config:${entityType}:${entityId}`;
    subscribe(room);

    const handleConfigChange = (data: unknown) => {
      const d = typeof data === 'object' && data !== null ? data as EventData : { payload: String(data) };
      setConfigChange(d);
      setChangeTimestamp(new Date());
    };

    on('config:changed', handleConfigChange);

    return () => {
      off('config:changed', handleConfigChange);
      unsubscribe(room);
    };
  }, [socket, entityType, entityId, subscribe, unsubscribe, on, off]);

  return { configChange, changeTimestamp };
}

/**
 * useRealtimePresence Hook
 * Track user presence and activity
 */
export function useRealtimePresence(section: string) {
  const { socket, subscribe, unsubscribe, on, off, emit } = useWebSocket();
  const [presentUsers, setPresentUsers] = useState<Map<string, EventData>>(new Map());

  useEffect(() => {
    if (!socket) return;

    const room = `presence:${section}`;
    subscribe(room);

    const handlePresenceUpdate = (data: unknown) => {
      const d = typeof data === 'object' && data !== null ? data as EventData : { payload: String(data) };
      setPresentUsers(prev => {
        const updated = new Map(prev);
        const id = (d as any).userId ? String((d as any).userId) : String(Math.random());
        updated.set(id, d);
        return updated;
      });
    };

    on('presence:updated', handlePresenceUpdate);

    // Notify presence
    emit('presence:update', { section, action: 'viewing' });

    return () => {
      off('presence:updated', handlePresenceUpdate);
      unsubscribe(room);
    };
  }, [socket, section, subscribe, unsubscribe, on, off, emit]);

  const updatePresence = useCallback((action: 'viewing' | 'editing' | 'searching') => {
    emit('presence:update', { section, action });
  }, [section, emit]);

  return {
    presentUsers: Array.from(presentUsers.values()),
    updatePresence
  };
}

/**
 * useRealtimeSearch Hook
 * Real-time search result updates
 */
export function useRealtimeSearch() {
  const { socket, subscribe, unsubscribe, on, off } = useWebSocket();
  const [searchResults, setSearchResults] = useState<EventData | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!socket) return;

    subscribe('search:results');

    const handleSearchResult = (data: unknown) => {
      const d = typeof data === 'object' && data !== null ? data as EventData : { payload: String(data) };
      setSearchResults(d);
      setIsSearching(!(d as any).completed);
    };

    on('search:result-ready', handleSearchResult);

    return () => {
      off('search:result-ready', handleSearchResult);
      unsubscribe('search:results');
    };
  }, [socket, subscribe, unsubscribe, on, off]);

  return { searchResults, isSearching };
}

/**
 * useRealtimeAnalytics Hook
 * Real-time analytics metrics
 */
export function useRealtimeAnalytics() {
  const { socket, subscribe, unsubscribe, on, off } = useWebSocket();
  const [metrics, setMetrics] = useState<EventData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!socket) return;

    subscribe('analytics');
    subscribe('dashboard:metrics');

    const handleAnalyticsUpdate = (data: unknown) => {
      const d = typeof data === 'object' && data !== null ? data as EventData : { payload: String(data) };
      setMetrics(prev => ({ ...(prev || {}), ...d }));
      setLastUpdate(new Date());
    };

    const handleMetricsUpdate = (data: unknown) => {
      const d = typeof data === 'object' && data !== null ? data as EventData : { payload: String(data) };
      setMetrics(prev => ({ ...(prev || {}), ...d }));
      setLastUpdate(new Date());
    };

    on('analytics:updated', handleAnalyticsUpdate);
    on('metrics:updated', handleMetricsUpdate);

    return () => {
      off('analytics:updated', handleAnalyticsUpdate);
      off('metrics:updated', handleMetricsUpdate);
      unsubscribe('analytics');
      unsubscribe('dashboard:metrics');
    };
  }, [socket, subscribe, unsubscribe, on, off]);

  return { metrics, lastUpdate };
}

/**
 * useRealtimeDashboard Hook
 * Combined dashboard updates
 */
export function useRealtimeDashboard() {
  const { socket, subscribe, unsubscribe, on, off } = useWebSocket();
  const [updates, setUpdates] = useState<EventData[]>([]);
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    if (!socket) return;

    subscribe('dashboard:updates');

    const handleUpdate = (data: unknown) => {
      const d = typeof data === 'object' && data !== null ? data as EventData : { payload: String(data) };
      setUpdates(prev => [d, ...prev].slice(0, 100));
    };

    const handleUserCount = (data: unknown) => {
      const d = typeof data === 'object' && data !== null ? data as EventData : { totalUsers: Number(data) };
      setUserCount(Number((d as any).totalUsers || 0));
    };

    on('dashboard:update', handleUpdate);
    on('system:user-count', handleUserCount);

    return () => {
      off('dashboard:update', handleUpdate);
      off('system:user-count', handleUserCount);
      unsubscribe('dashboard:updates');
    };
  }, [socket, subscribe, unsubscribe, on, off]);

  return { updates, userCount };
}
