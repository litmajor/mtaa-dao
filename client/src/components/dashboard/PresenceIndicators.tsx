import React, { useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, UserCheck, UserX, Activity } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

/**
 * User presence data structure
 */
interface UserPresence {
  userId: string;
  userName: string;
  userEmail?: string;
  status: 'online' | 'away' | 'offline';
  lastSeen?: string;
  currentView?: string;
  avatar?: string;
}

/**
 * PresenceIndicators Component
 * Real-time user presence/online status tracking via WebSocket
 *
 * Features:
 * - Shows online/offline users in real-time
 * - Tracks last seen timestamp for offline users
 * - Displays current view/component being used
 * - Auto-updates as users come online/go offline
 * - Color-coded status badges (green=online, yellow=away, gray=offline)
 */
export const PresenceIndicators: React.FC = () => {
  const { socket, isConnected } = useWebSocket();
  const [presenceData, setPresenceData] = useState<Map<string, UserPresence>>(
    new Map()
  );
  const [wsConnected, setWsConnected] = useState(false);

  // Update connection status sync effect
  useEffect(() => {
    setWsConnected(isConnected);
  }, [isConnected]);

  // WebSocket presence tracking effect
  useEffect(() => {
    if (!isConnected) return;

    /**
     * Handle presence:updated event
     * Updates user online/offline status, last seen timestamp, current view
     */
    const handlePresenceUpdate = (data: {
      userId: string;
      userName: string;
      userEmail?: string;
      status: 'online' | 'away' | 'offline';
      currentView?: string;
      avatar?: string;
      timestamp?: string;
    }) => {
      setPresenceData(prev => {
        const updated = new Map(prev);
        updated.set(data.userId, {
          userId: data.userId,
          userName: data.userName,
          userEmail: data.userEmail,
          status: data.status,
          lastSeen: data.status === 'offline' ? new Date().toISOString() : prev.get(data.userId)?.lastSeen,
          currentView: data.currentView,
          avatar: data.avatar
        });
        return updated;
      });
    };

    /**
     * Handle presence:online event
     * When a user comes online
     */
    const handleUserOnline = (data: {
      userId: string;
      userName: string;
      userEmail?: string;
      timestamp?: string;
    }) => {
      setPresenceData(prev => {
        const updated = new Map(prev);
        const existing = prev.get(data.userId) || {};
        updated.set(data.userId, {
          ...existing,
          userId: data.userId,
          userName: data.userName,
          userEmail: data.userEmail,
          status: 'online',
          lastSeen: undefined
        });
        return updated;
      });
    };

    /**
     * Handle presence:offline event
     * When a user goes offline
     */
    const handleUserOffline = (data: {
      userId: string;
      timestamp?: string;
    }) => {
      setPresenceData(prev => {
        const updated = new Map(prev);
        const existing = prev.get(data.userId);
        if (existing) {
          updated.set(data.userId, {
            ...existing,
            status: 'offline',
            lastSeen: new Date().toISOString(),
            currentView: undefined
          });
        }
        return updated;
      });
    };

    // Listen to presence events
    socket.on('presence:updated', handlePresenceUpdate);
    socket.on('presence:online', handleUserOnline);
    socket.on('presence:offline', handleUserOffline);

    // Cleanup
    return () => {
      socket.off('presence:updated', handlePresenceUpdate);
      socket.off('presence:online', handleUserOnline);
      socket.off('presence:offline', handleUserOffline);
    };
  }, [socket, isConnected]);

  // Count online/offline users
  const onlineUsers = Array.from(presenceData.values()).filter(u => u.status === 'online');
  const offlineUsers = Array.from(presenceData.values()).filter(u => u.status === 'offline');
  const totalUsers = presenceData.size;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      case 'offline':
        return 'bg-gray-400';
      default:
        return 'bg-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'away':
        return 'Away';
      case 'offline':
        return 'Offline';
      default:
        return 'Unknown';
    }
  };

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            User Presence
          </CardTitle>
          <div className="flex items-center gap-2">
            {wsConnected ? (
              <Activity className="h-4 w-4 text-green-500 animate-pulse" />
            ) : (
              <Activity className="h-4 w-4 text-gray-400" />
            )}
            <span className="text-xs text-gray-400">{totalUsers} users</span>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-700">
          <div className="py-1">
            <div className="text-xs text-gray-400">Online</div>
            <div className="text-lg font-semibold text-green-400">{onlineUsers.length}</div>
          </div>
          <div className="py-1">
            <div className="text-xs text-gray-400">Away</div>
            <div className="text-lg font-semibold text-yellow-400">
              {Array.from(presenceData.values()).filter(u => u.status === 'away').length}
            </div>
          </div>
          <div className="py-1">
            <div className="text-xs text-gray-400">Offline</div>
            <div className="text-lg font-semibold text-gray-400">{offlineUsers.length}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-96">
          {totalUsers === 0 ? (
            <div className="text-center py-8 text-slate-400">No users tracked</div>
          ) : (
            <div className="space-y-2">
              {Array.from(presenceData.values())
                .sort((a, b) => {
                  // Sort: online first, then away, then offline
                  const statusOrder = { online: 0, away: 1, offline: 2 };
                  return statusOrder[a.status as keyof typeof statusOrder] -
                    statusOrder[b.status as keyof typeof statusOrder];
                })
                .map(user => (
                  <div
                    key={user.userId}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    {/* Status indicator */}
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(user.status)} flex-shrink-0`} />

                    {/* User info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{user.userName}</p>
                      {user.currentView && (
                        <p className="text-xs text-slate-400 truncate">
                          Viewing: {user.currentView}
                        </p>
                      )}
                      {user.status === 'offline' && user.lastSeen && (
                        <p className="text-xs text-slate-500">
                          Last seen: {new Date(user.lastSeen).toLocaleTimeString()}
                        </p>
                      )}
                    </div>

                    {/* Status badge */}
                    <Badge
                      variant="outline"
                      className={`text-xs flex-shrink-0 ${
                        user.status === 'online'
                          ? 'border-green-500 text-green-400'
                          : user.status === 'away'
                          ? 'border-yellow-500 text-yellow-400'
                          : 'border-gray-500 text-gray-400'
                      }`}
                    >
                      {getStatusLabel(user.status)}
                    </Badge>
                  </div>
                ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default PresenceIndicators;
