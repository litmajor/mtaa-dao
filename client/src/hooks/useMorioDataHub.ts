/**
 * Morio Data Hub API Client Hook
 * 
 * React hook for consuming Morio Data Hub API and WebSocket updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface DashboardMetric {
  label: string;
  value: string | number;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  severity?: 'success' | 'warning' | 'danger' | 'info';
  percentChange?: number;
}

export interface DashboardSection {
  section: string;
  title: string;
  description: string;
  icon: string;
  data: DashboardMetric[];
  lastUpdated: string;
}

export interface DashboardData {
  success: boolean;
  sections: {
    elders: DashboardSection;
    agents: DashboardSection;
    community: DashboardSection;
    treasury: DashboardSection;
    governance: DashboardSection;
  };
  timestamp: string;
}

export interface SystemStatus {
  overall: string;
  components: Record<string, any>;
  lastCheck: string;
}

export interface Alert {
  id: string;
  severity: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  timestamp: string;
  action?: string;
}

/**
 * Hook for fetching dashboard data via REST API
 */
export function useMorioDashboard(daoId?: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['morio:dashboard', daoId],
    queryFn: async () => {
      const url = new URL('/api/morio/dashboard', window.location.origin);
      if (daoId) {
        url.searchParams.set('daoId', daoId);
      }
      
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Morio dashboard');
      }

      return response.json() as Promise<DashboardData>;
    },
    enabled,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000 // Consider data stale after 10 seconds
  });
}

/**
 * Hook for fetching individual section data
 */
export function useMorioSection(
  section: 'elders' | 'agents' | 'nutu-kwetu' | 'treasury' | 'governance',
  daoId?: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['morio:section', section, daoId],
    queryFn: async () => {
      const url = new URL(
        `/api/morio/${section}/overview`,
        window.location.origin
      );
      if (daoId) {
        url.searchParams.set('daoId', daoId);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${section} overview`);
      }

      return response.json() as Promise<DashboardSection>;
    },
    enabled,
    refetchInterval: 30000,
    staleTime: 10000
  });
}

/**
 * Hook for real-time WebSocket updates
 */
export function useMorioRealTime(daoId?: string) {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [performance, setPerformance] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Only establish connection if user is authenticated
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    // Initialize WebSocket connection
    const socket = io(window.location.origin, {
      auth: {
        token
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to Morio WebSocket');
      setIsConnected(true);

      // Subscribe to updates
      socket.emit('subscribe:dashboard', daoId);
      socket.emit('subscribe:alerts', daoId);
      socket.emit('subscribe:performance');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from Morio WebSocket');
      setIsConnected(false);
    });

    // Listen for data updates
    socket.on('data:system-status', (data: SystemStatus) => {
      setSystemStatus(data);
    });

    socket.on('data:alerts', (data: { alerts: Alert[] }) => {
      setAlerts(data.alerts);
    });

    socket.on('data:performance', (data: any) => {
      setPerformance(data);
    });

    socket.on('new:alert', (alert: Alert) => {
      setAlerts(prev => [alert, ...prev]);
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('unsubscribe:dashboard', daoId);
        socketRef.current.emit('unsubscribe:alerts', daoId);
        socketRef.current.disconnect();
      }
    };
  }, [daoId]);

  const subscribe = useCallback((section: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe:section', section, daoId);
    }
  }, [daoId]);

  const unsubscribe = useCallback((section: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe:section', section, daoId);
    }
  }, [daoId]);

  return {
    systemStatus,
    alerts,
    performance,
    isConnected,
    subscribe,
    unsubscribe
  };
}

/**
 * Hook for health check
 */
export function useMorioHealth() {
  return useQuery({
    queryKey: ['morio:health'],
    queryFn: async () => {
      const response = await fetch('/api/morio/health');

      if (!response.ok) {
        throw new Error('Morio health check failed');
      }

      return response.json();
    },
    refetchInterval: 60000, // Check every minute
    staleTime: 30000
  });
}

/**
 * Helper function to get severity color
 */
export function getSeverityColor(
  severity?: 'success' | 'warning' | 'danger' | 'info'
): string {
  switch (severity) {
    case 'success':
      return 'text-green-600';
    case 'warning':
      return 'text-yellow-600';
    case 'danger':
      return 'text-red-600';
    case 'info':
      return 'text-blue-600';
    default:
      return 'text-gray-600';
  }
}

/**
 * Helper function to get severity badge color
 */
export function getSeverityBadgeColor(
  severity?: 'success' | 'warning' | 'danger' | 'info'
): string {
  switch (severity) {
    case 'success':
      return 'bg-green-100 text-green-800';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800';
    case 'danger':
      return 'bg-red-100 text-red-800';
    case 'info':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Helper function to format trend
 */
export function formatTrend(
  trend?: 'up' | 'down' | 'stable'
): { icon: string; className: string } {
  switch (trend) {
    case 'up':
      return { icon: '📈', className: 'text-green-600' };
    case 'down':
      return { icon: '📉', className: 'text-red-600' };
    case 'stable':
      return { icon: '➡️', className: 'text-gray-600' };
    default:
      return { icon: '—', className: 'text-gray-400' };
  }
}
