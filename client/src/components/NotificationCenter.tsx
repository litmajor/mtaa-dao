
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNotifications, useNotificationData } from '../hooks/useNotifications';
import { Lucide } from '../lib/icons';
// use a runtime-safe mapping to avoid compile-time missing-export errors across lucide versions
const {
  Bell,
  X,
  Check,
  CheckCircle,
  CheckCheck,
  Trash2,
  Settings,
  Search,
  FileText,
  Clipboard,
  DollarSign,
  Users,
  ArrowDown,
  ArrowUp,
} = (Lucide as any) || {};
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  metadata?: Record<string, any>;
  createdAt: string;
  // Optional navigation fields
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
}

interface NotificationCenterProps {
  trigger?: React.ReactNode;
}

export default function NotificationCenter({ trigger }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'high'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();
  
  // Initialize real-time notifications
  const { isConnected, requestNotificationPermission } = useNotifications();
  
  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  const { data: notificationsData, isLoading } = useNotificationData(filter);

  // Search notifications
  const { data: searchResults } = useQuery({
    queryKey: ['notifications', 'search', searchTerm],
    queryFn: async () => {
      if (!searchTerm.trim()) return null;
      const response = await fetch(`/api/notifications/search?q=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) throw new Error('Failed to search notifications');
      return response.json();
    },
    enabled: searchTerm.length > 2,
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

  // Decide which notifications to display (search vs normal)
  const displayedNotifications =
    searchTerm.length > 2 ? searchResults?.notifications ?? [] : notifications;
  const displayedUnreadCount =
    searchTerm.length > 2 ? searchResults?.unreadCount ?? 0 : unreadCount;

  // Group notifications by relative date
  const groupByDate = (items: Notification[]) => {
    const groups: Record<string, Notification[]> = { Today: [], Yesterday: [], 'This Week': [], Older: [] };
    const now = new Date();
    for (const n of items) {
      const d = new Date(n.createdAt);
      const diffMs = now.getTime() - d.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      ) {
        groups.Today.push(n);
      } else if (diffDays === 1) {
        groups.Yesterday.push(n);
      } else if (diffDays > 1 && diffDays <= 7) {
        groups['This Week'].push(n);
      } else {
        groups.Older.push(n);
      }
    }
    return groups;
  };

  const grouped = groupByDate(displayedNotifications);

  // Memoized notification item to avoid re-renders
  const NotificationItem = React.memo(function NotificationItem({ notification }: { notification: Notification }) {
    return (
      <Card
        key={notification.id}
        className={`transition-all hover:shadow-md ${!notification.read ? 'border-l-4 border-l-blue-500 bg-blue-50/50' : ''}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{getTypeIcon(notification.type)}</span>
                <h4 className="font-medium text-sm truncate">{notification.title}</h4>
                <div className={`w-2 h-2 rounded-full ${getPriorityColor(notification.priority)}`} />
              </div>
              <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
              <p className="text-xs text-gray-400">{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</p>
            </div>
            <div className="flex items-center gap-1">
              {!notification.read && (
                <Button variant="ghost" size="sm" onClick={() => markAsReadMutation.mutate(notification.id)} disabled={markAsReadMutation.isPending} className="h-8 w-8 p-0">
                  <Check className="w-4 h-4" />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => deleteNotificationMutation.mutate(notification.id)} disabled={deleteNotificationMutation.isPending} className="h-8 w-8 p-0 text-red-500 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  });

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
      case 'proposal_created': return <FileText className="w-5 h-5 text-slate-400" />;
      case 'proposal_voted': return <Clipboard className="w-5 h-5 text-slate-400" />;
      case 'task_assigned': return <Clipboard className="w-5 h-5 text-slate-400" />;
      case 'task_completed': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'payment_received': return <DollarSign className="w-5 h-5 text-yellow-400" />;
      case 'membership_approved': return <Users className="w-5 h-5 text-indigo-400" />;
      case 'membership_rejected': return <X className="w-5 h-5 text-red-400" />;
      case 'dao_invite': return <Users className="w-5 h-5 text-indigo-400" />;
      case 'vault_deposit': return <ArrowDown className="w-5 h-5 text-slate-400" />;
      case 'vault_withdrawal': return <ArrowUp className="w-5 h-5 text-slate-400" />;
      case 'system_update': return <Bell className="w-5 h-5 text-slate-400" />;
      default: return <FileText className="w-5 h-5 text-slate-400" />;
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
            <span className="flex items-center gap-3">
              <Bell className="w-5 h-5" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="secondary">{unreadCount} unread</Badge>
              )}
              <div className="flex items-center gap-2 ml-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs text-gray-500">{isConnected ? 'Live' : 'Offline'}</span>
              </div>
            </span>
            <div className="flex items-center gap-2">
              {displayedUnreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={() => markAllAsReadMutation.mutate(undefined as any)} disabled={markAllAsReadMutation.isPending}>
                  <CheckCheck className="w-4 h-4 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-4">
          <Input placeholder="Search notifications..." value={searchTerm} onChange={(e: any) => setSearchTerm(e.target.value)} />
        </div>

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
              ) : displayedNotifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No notifications found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {['Today', 'Yesterday', 'This Week', 'Older'].map((section) => (
                    grouped[section] && grouped[section].length > 0 ? (
                      <div key={section}>
                        <div className="text-sm font-semibold text-gray-600 mb-2">{section}</div>
                        <div className="space-y-2">
                          {grouped[section].map((n) => (
                            <NotificationItem key={n.id} notification={n} />
                          ))}
                        </div>
                      </div>
                    ) : null
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
