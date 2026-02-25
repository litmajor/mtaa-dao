/**
 * Session Notifications Component
 * Display alerts for new logins from other devices
 */

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Check,
  X,
  Loader,
  MapPin,
  Smartphone,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface Notification {
  id: string;
  title: string;
  message: string;
  notificationType: 'new_login' | 'login_from_new_device' | 'suspicious_activity';
  deviceName?: string;
  location?: string;
  ipAddress?: string;
  isRead: boolean;
  actionRequired: boolean;
  actionToken?: string;
  createdAt: Date;
}

export const SessionNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sessions/notifications', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch notifications');

      const data = await response.json();
      setNotifications(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Refresh every 2 minutes
    const interval = setInterval(fetchNotifications, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/sessions/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      setNotifications(
        notifications.map((n) =>
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleApproveLogin = async (notificationId: string, actionToken?: string) => {
    if (!actionToken) return;

    setActingOn(notificationId);
    try {
      const response = await fetch(`/api/sessions/notifications/${notificationId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ actionToken }),
      });

      if (response.ok) {
        setNotifications(notifications.filter((n) => n.id !== notificationId));
      }
    } catch (err) {
      console.error('Failed to approve login:', err);
    } finally {
      setActingOn(null);
    }
  };

  const handleDenyLogin = async (notificationId: string, actionToken?: string) => {
    if (!actionToken) return;

    setActingOn(notificationId);
    try {
      const response = await fetch(`/api/sessions/notifications/${notificationId}/deny`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ actionToken }),
      });

      if (response.ok) {
        setNotifications(notifications.filter((n) => n.id !== notificationId));
      }
    } catch (err) {
      console.error('Failed to deny login:', err);
    } finally {
      setActingOn(null);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_login':
      case 'login_from_new_device':
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
      case 'suspicious_activity':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Bell className="h-5 w-5 text-gray-600" />;
    }
  };

  const getNotificationBgColor = (type: string) => {
    switch (type) {
      case 'new_login':
      case 'login_from_new_device':
        return 'bg-orange-50 border-orange-200';
      case 'suspicious_activity':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Security Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Security Alerts
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Notifications about new logins and suspicious activity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {notifications.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Bell className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm text-gray-600">
              No security alerts at this time
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`rounded-lg border p-4 ${getNotificationBgColor(
                  notification.notificationType
                )} ${!notification.isRead ? 'ring-2 ring-offset-1 ring-yellow-400' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    {getNotificationIcon(notification.notificationType)}
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">
                        {notification.title}
                      </h4>
                      <p className="mt-1 text-sm text-gray-700">
                        {notification.message}
                      </p>

                      <div className="mt-3 space-y-2 text-xs text-gray-600">
                        {notification.deviceName && (
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4" />
                            {notification.deviceName}
                          </div>
                        )}

                        {notification.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {notification.location}
                          </div>
                        )}

                        {notification.ipAddress && (
                          <div>IP: {notification.ipAddress}</div>
                        )}

                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {new Date(notification.createdAt).toLocaleDateString(
                            'en-US',
                            {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }
                          )}
                        </div>
                      </div>

                      {notification.actionRequired && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() =>
                              handleApproveLogin(
                                notification.id,
                                notification.actionToken
                              )
                            }
                            disabled={actingOn === notification.id}
                          >
                            {actingOn === notification.id ? (
                              <Loader className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="mr-1 h-3 w-3" />
                            )}
                            Allow
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleDenyLogin(
                                notification.id,
                                notification.actionToken
                              )
                            }
                            disabled={actingOn === notification.id}
                          >
                            {actingOn === notification.id ? (
                              <Loader className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <X className="mr-1 h-3 w-3" />
                            )}
                            Deny
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {!notification.isRead && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMarkAsRead(notification.id)}
                    >
                      Mark as read
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Alert className="border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            💡 Pro Tip: Enable push notifications to get real-time alerts about
            new logins from other devices.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default SessionNotifications;
