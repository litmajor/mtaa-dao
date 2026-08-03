import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from '@/config/apiConfig';
import { WS_PATHS } from '../../../server/websocket/websocket-events';

let sharedSocket: Socket | null = null;

function createSharedSocket(): Socket {
  const socketUrl = (import.meta.env as any)?.VITE_API_URL || undefined;
  const socket = io(socketUrl, {
    path: WS_PATHS.NOTIFICATIONS,
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  return socket;
}

export function getSharedSocket(): Socket {
  if (typeof window === 'undefined') {
    throw new Error('Shared socket can only be used in the browser');
  }

  if (!sharedSocket) {
    sharedSocket = createSharedSocket();
    if (typeof window !== 'undefined') {
      (window as any).__mtaaSharedSocket = sharedSocket;
    }
  }

  return sharedSocket;
}

export function useSharedSocket() {
  const [socket, setSocket] = useState<Socket | null>(() => {
    if (typeof window === 'undefined') return null;
    return getSharedSocket();
  });
  const [isConnected, setIsConnected] = useState(() => {
    if (typeof window === 'undefined') return false;
    return getSharedSocket().connected;
  });

  useEffect(() => {
    const currentSocket = getSharedSocket();
    setSocket(currentSocket);
    setIsConnected(currentSocket.connected);

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleConnectError = (err: Error) => {
      console.warn('[sharedSocket] connect_error:', err.message);
    };

    currentSocket.on('connect', handleConnect);
    currentSocket.on('disconnect', handleDisconnect);
    currentSocket.on('connect_error', handleConnectError);

    return () => {
      currentSocket.off('connect', handleConnect);
      currentSocket.off('disconnect', handleDisconnect);
      currentSocket.off('connect_error', handleConnectError);
    };
  }, []);

  return { socket, isConnected };
}
