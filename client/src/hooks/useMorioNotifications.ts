/**
 * Hook for managing Morio notifications in the frontend
 */

import { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';

export interface MorioNotification {
  type: string;
  userId: string;
  daoId: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  timestamp: string;
  priority: 'low' | 'medium' | 'high';
}

export function useMorioNotifications(userId: string) {
  const [notifications, setNotifications] = useState<MorioNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  /**
   * Fetch notifications from server
   */
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;

    try {
      setIsLoading(true);
      const response = await apiRequest<{
        notifications: MorioNotification[];
        count: number;
      }>(`/api/morio/notifications/${userId}`, {
        method: 'GET'
      });

      setNotifications(response.notifications || []);
      setUnreadCount(response.count || 0);
      setLastFetch(new Date());
    } catch (error) {
      console.error('[Morio] Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  /**
   * Mark notification as read
   */
  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        await apiRequest(`/api/morio/notifications/${userId}/read/${notificationId}`, {
          method: 'POST'
        });

        // Remove from local state
        setNotifications(prev =>
          prev.filter(n => `${n.type}_${new Date(n.timestamp).getTime()}` !== notificationId)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('[Morio] Failed to mark notification as read:', error);
      }
    },
    [userId]
  );

  /**
   * Clear all notifications
   */
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  /**
   * Dismiss a single notification
   */
  const dismiss = useCallback((index: number) => {
    setNotifications(prev => prev.filter((_, i) => i !== index));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  /**
   * Poll for notifications every 30 seconds
   */
  useEffect(() => {
    if (!userId) return;

    // Fetch immediately on mount
    fetchNotifications();

    // Set up polling interval
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [userId, fetchNotifications]);

  /**
   * Get notifications sorted by priority
   */
  const sortedNotifications = notifications.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return {
    notifications: sortedNotifications,
    unreadCount,
    isLoading,
    lastFetch,
    fetchNotifications,
    markAsRead,
    clearAll,
    dismiss,
    hasNotifications: notifications.length > 0
  };
}
