
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  metadata?: Record<string, any>;
  createdAt: string;
}

export function useNotifications() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();

  // Initialize WebSocket connection
  useEffect(() => {
    // Get token from localStorage
    const token = localStorage.getItem('accessToken');
    
    const newSocket = io(window.location.origin, {
      auth: {
        token: token || undefined,
      },
      // Also send token in query as backup
      query: token ? { token } : {},
      // Reconnection settings
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });
    
    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Socket.IO connected successfully');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('new_notification', (notification: Notification) => {
      // Add new notification to the cache
      queryClient.setQueryData(['notifications'], (old: any) => {
        if (!old) return { notifications: [notification], unreadCount: 1 };
        return {
          notifications: [notification, ...old.notifications],
          unreadCount: old.unreadCount + 1
        };
      });

      // Show browser notification if permitted
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
        });
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [queryClient]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }, []);

  // Setup Server-Sent Events as fallback
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  useEffect(() => {
    if (!isConnected) {
      // Fallback to SSE if WebSocket fails
      const es = new EventSource('/api/sse/notifications');
      
      es.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data);
          if (notification.type !== 'heartbeat') {
            queryClient.setQueryData(['notifications'], (old: any) => {
              if (!old) return { notifications: [notification], unreadCount: 1 };
              return {
                notifications: [notification, ...old.notifications],
                unreadCount: old.unreadCount + 1
              };
            });
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      };

      es.onerror = (error) => {
        console.error('SSE error:', error);
        es.close();
      };

      setEventSource(es);

      return () => {
        es.close();
      };
    }
  }, [isConnected, queryClient]);

  return {
    socket,
    isConnected,
    requestNotificationPermission
  };
}

export function useNotificationData(filter: 'all' | 'unread' | 'high' = 'all') {
  return useQuery({
    queryKey: ['notifications', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter === 'unread') params.append('read', 'false');
      if (filter === 'high') params.append('priority', 'high,urgent');
      
      const response = await fetch(`/api/notifications?${params}`);
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds as backup
  });
}
