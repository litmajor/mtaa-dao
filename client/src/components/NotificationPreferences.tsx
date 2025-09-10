import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Bell, Mail, Smartphone, Users, FileText, Briefcase } from 'lucide-react';

interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  telegramNotifications: boolean;
  daoUpdates: boolean;
  proposalUpdates: boolean;
  taskUpdates: boolean;
}

export default function NotificationPreferences() {
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/preferences');
      if (!response.ok) throw new Error('Failed to fetch preferences');
      return response.json();
    },
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: Partial<NotificationPreferences>) => {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPreferences),
      });
      if (!response.ok) throw new Error('Failed to update preferences');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });

  const handleToggle = (key: keyof NotificationPreferences) => {
    if (!preferences) return;

    const newPreferences = {
      ...preferences,
      [key]: !preferences[key],
    };

    updatePreferencesMutation.mutate(newPreferences);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="h-6 bg-gray-200 rounded w-12"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Delivery Methods */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-gray-700">Delivery Methods</h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-gray-500" />
              <Label htmlFor="email-notifications" className="text-sm">
                Email Notifications
              </Label>
            </div>
            <Switch
              id="email-notifications"
              checked={preferences?.emailNotifications || false}
              onCheckedChange={() => handleToggle('emailNotifications')}
              disabled={updatePreferencesMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="w-4 h-4 text-gray-500" />
              <Label htmlFor="push-notifications" className="text-sm">
                Push Notifications
              </Label>
            </div>
            <Switch
              id="push-notifications"
              checked={preferences?.pushNotifications || false}
              onCheckedChange={() => handleToggle('pushNotifications')}
              disabled={updatePreferencesMutation.isPending}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-gray-500" />
              <Label htmlFor="telegram-notifications" className="text-sm">
                Telegram Notifications
              </Label>
            </div>
            <Switch
              id="telegram-notifications"
              checked={preferences?.telegramNotifications || false}
              onCheckedChange={() => handleToggle('telegramNotifications')}
              disabled={updatePreferencesMutation.isPending}
            />
          </div>
        </div>

        <Separator />

        {/* Content Types */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-gray-700">Content Types</h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-gray-500" />
              <div>
                <Label htmlFor="dao-updates" className="text-sm">
                  DAO Updates
                </Label>
                <p className="text-xs text-gray-500">
                  Membership changes, treasury updates, and announcements
                </p>
              </div>
            </div>
            <Switch
              id="dao-updates"
              checked={preferences?.daoUpdates || false}
              onCheckedChange={() => handleToggle('daoUpdates')}
              disabled={updatePreferencesMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-gray-500" />
              <div>
                <Label htmlFor="proposal-updates" className="text-sm">
                  Proposal Updates
                </Label>
                <p className="text-xs text-gray-500">
                  New proposals, votes, and proposal status changes
                </p>
              </div>
            </div>
            <Switch
              id="proposal-updates"
              checked={preferences?.proposalUpdates || false}
              onCheckedChange={() => handleToggle('proposalUpdates')}
              disabled={updatePreferencesMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Briefcase className="w-4 h-4 text-gray-500" />
              <div>
                <Label htmlFor="task-updates" className="text-sm">
                  Task Updates
                </Label>
                <p className="text-xs text-gray-500">
                  Task assignments, completions, and bounty updates
                </p>
              </div>
            </div>
            <Switch
              id="task-updates"
              checked={preferences?.taskUpdates || false}
              onCheckedChange={() => handleToggle('taskUpdates')}
              disabled={updatePreferencesMutation.isPending}
            />
          </div>
        </div>

        {updatePreferencesMutation.isError && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
            Failed to update preferences. Please try again.
          </div>
        )}

        {updatePreferencesMutation.isSuccess && (
          <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
            Preferences updated successfully!
          </div>
        )}
      </CardContent>
    </Card>
  );
}