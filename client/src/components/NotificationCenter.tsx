
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, X, Check, CheckCheck, Trash2, Settings, Filter } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { formatDistanceToNow } from 'date-fns';

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

interface NotificationCenterProps {
  trigger?: React.ReactNode;
}

export default function NotificationCenter({ trigger }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'high'>('all');
  const queryClient = useQueryClient();

  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['notifications', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter === 'unread') params.append('read', 'false');
      if (filter === 'high') params.append('priority', 'high,urgent');
      
      const response = await fetch(`/api/notifications?${params}`);
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Failed to mark as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Failed to mark all as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete notification');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = notificationsData?.notifications || [];
  const unreadCount = notificationsData?.unreadCount || 0;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-blue-500';
      case 'low': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'proposal_created': return '📝';
      case 'proposal_voted': return '🗳️';
      case 'task_assigned': return '📋';
      case 'task_completed': return '✅';
      case 'payment_received': return '💰';
      case 'membership_approved': return '🎉';
      case 'membership_rejected': return '❌';
      case 'dao_invite': return '👥';
      case 'vault_deposit': return '⬇️';
      case 'vault_withdrawal': return '⬆️';
      case 'system_update': return '🔔';
      default: return '📢';
    }
  };

  const defaultTrigger = (
    <Button variant="ghost" size="sm" className="relative p-2">
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs">
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="secondary">
                  {unreadCount} unread
                </Badge>
              )}
            </span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                >
                  <CheckCheck className="w-4 h-4 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={filter} onValueChange={setFilter as any} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </TabsTrigger>
            <TabsTrigger value="high">High Priority</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="flex-1 mt-4">
            <ScrollArea className="h-[400px] pr-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No notifications found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map((notification: Notification) => (
                    <Card
                      key={notification.id}
                      className={`transition-all hover:shadow-md ${
                        !notification.read ? 'border-l-4 border-l-blue-500 bg-blue-50/50' : ''
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">
                                {getTypeIcon(notification.type)}
                              </span>
                              <h4 className="font-medium text-sm truncate">
                                {notification.title}
                              </h4>
                              <div className={`w-2 h-2 rounded-full ${getPriorityColor(notification.priority)}`} />
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsReadMutation.mutate(notification.id)}
                                disabled={markAsReadMutation.isPending}
                                className="h-8 w-8 p-0"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteNotificationMutation.mutate(notification.id)}
                              disabled={deleteNotificationMutation.isPending}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
