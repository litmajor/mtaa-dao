import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/utils/authClient';
import { type Socket } from 'socket.io-client';
import { API_CONFIG } from '@/config/apiConfig';
import { getSharedSocket } from '@/hooks/useSharedSocket';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  metadata?: Record<string, any>;
  createdAt: string;
}

// Give Socket.IO a few seconds to connect before falling back to SSE, rather
// than racing the two on every mount.
const SSE_FALLBACK_DELAY_MS = 4000;

export function useNotifications() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();
  const sseRef = useRef<EventSource | null>(null);
  const sseFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushNotification = useCallback(
    (notification: AppNotification) => {
      queryClient.setQueryData(['notifications'], (old: any) => {
        if (!old) return { notifications: [notification], unreadCount: 1 };
        // Guard against double-delivery during the brief window where both
        // Socket.IO and the SSE fallback could both be live.
        if (old.notifications.some((n: AppNotification) => n.id === notification.id)) {
          return old;
        }
        return {
          notifications: [notification, ...old.notifications],
          unreadCount: old.unreadCount + 1,
        };
      });

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
        });
      }
    },
    [queryClient]
  );

  // ---------------------------------------------------------------------
  // Socket.IO connection
  //
  // Auth here is cookie-based (httpOnly `access_token` cookie — see
  // authClient.ts). There is no client-readable token to pass via `auth`/
  // `query`; the previous version called `authClient.getToken()`, which
  // does not exist on authClient and threw on mount. `withCredentials: true`
  // lets the httpOnly cookie ride the handshake automatically, same as
  // every authClient fetch call.
  //
  // COMPANION BACKEND CHANGE NEEDED: server/index.ts's `io.use()` currently
  // reads `socket.handshake.query.token || socket.handshake.auth?.token` —
  // it also needs to parse and verify the `access_token` cookie from the
  // handshake headers (mirroring the cookie-preference fix already applied
  // to `authenticate()` in auth.ts). Without that, this connects at the
  // transport level but `socket.userId` never resolves, so the connection
  // silently never joins the user's notification room.
  // ---------------------------------------------------------------------
  useEffect(() => {
    const sharedSocket = getSharedSocket();

    const handleConnect = () => {
      setIsConnected(true);
      console.log('[useNotifications] Socket.IO connected');
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleConnectError = (err: Error) => {
      console.warn('[useNotifications] Socket.IO connect_error:', err.message);
    };

    const handleNewNotification = (notification: AppNotification) => {
      pushNotification(notification);
    };

    sharedSocket.on('connect', handleConnect);
    sharedSocket.on('disconnect', handleDisconnect);
    sharedSocket.on('connect_error', handleConnectError);
    sharedSocket.on('new_notification', handleNewNotification);

    setSocket(sharedSocket);
    setIsConnected(sharedSocket.connected);

    return () => {
      sharedSocket.off('connect', handleConnect);
      sharedSocket.off('disconnect', handleDisconnect);
      sharedSocket.off('connect_error', handleConnectError);
      sharedSocket.off('new_notification', handleNewNotification);
    };
  }, [pushNotification]);

  // ---------------------------------------------------------------------
  // SSE fallback
  //
  // Only engages if Socket.IO hasn't connected within SSE_FALLBACK_DELAY_MS,
  // and tears down as soon as the socket connects. The previous version
  // re-ran on every `isConnected` flip, which could open/close the
  // EventSource repeatedly during Socket.IO's own reconnection attempts.
  //
  // Also fixed: the previous version passed `?token=` on the URL — that
  // token doesn't exist client-side (see above), and putting one in a query
  // string would leak it into server/proxy logs regardless. `withCredentials`
  // is the correct equivalent here; the `/api/sse/notifications` route needs
  // to sit behind the same cookie-based `authenticate` middleware as the
  // rest of the API for this to actually authenticate.
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (isConnected) {
      if (sseFallbackTimerRef.current) {
        clearTimeout(sseFallbackTimerRef.current);
        sseFallbackTimerRef.current = null;
      }
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      return;
    }

    sseFallbackTimerRef.current = setTimeout(() => {
      if (isConnected || sseRef.current) return; // socket connected in the meantime

      const backendUrl = API_CONFIG.BASE_URL;
      const es = new EventSource(`${backendUrl}/api/sse/notifications`, {
        withCredentials: true,
      } as EventSourceInit);

      es.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data);
          if (notification.type !== 'heartbeat') {
            pushNotification(notification);
          }
        } catch (error) {
          console.error('[useNotifications] Error parsing SSE data:', error);
        }
      };

      es.onerror = (error) => {
        console.error('[useNotifications] SSE error:', error);
        es.close();
        sseRef.current = null;
      };

      sseRef.current = es;
    }, SSE_FALLBACK_DELAY_MS);

    return () => {
      if (sseFallbackTimerRef.current) {
        clearTimeout(sseFallbackTimerRef.current);
        sseFallbackTimerRef.current = null;
      }
    };
  }, [isConnected, pushNotification]);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      sseRef.current?.close();
    };
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }, []);

  return {
    socket,
    isConnected,
    requestNotificationPermission,
  };
}

export function useNotificationData(filter: 'all' | 'unread' | 'high' = 'all') {
  return useQuery({
    queryKey: ['notifications', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter === 'unread') params.append('read', 'false');
      if (filter === 'high') params.append('priority', 'high,urgent');

      // Use authClient (cookie-based, auto-refresh-on-401) instead of a raw
      // fetch — the previous version called fetch() directly with no
      // `credentials: 'include'`, so the httpOnly auth cookie was never
      // sent and this endpoint 401'd on every single call.
      return authClient.get<{ notifications: AppNotification[]; unreadCount: number }>(
        `/api/notifications?${params}`
      );
    },
    refetchInterval: 30000, // backup poll in case both WS and SSE are down
  });
}