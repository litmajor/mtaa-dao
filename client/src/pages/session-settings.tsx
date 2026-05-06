/**
 * Session Settings Page
 * Comprehensive wallet security and session management
 */

import React, { useState } from 'react';
import {
  Smartphone,
  Activity,
  Lock,
  Fingerprint,
  Bell,
  LogOut,
  Settings,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { authClient } from '@/utils/authClient';

import SessionTimeoutWarning from '@/components/wallet/SessionTimeoutWarning';
import DeviceManagement from '@/components/wallet/DeviceManagement';
import SessionActivityLog from '@/components/wallet/SessionActivityLog';
import SessionNotifications from '@/components/wallet/SessionNotifications';
import BiometricUnlock from '@/components/wallet/BiometricUnlock';
import PinResetFlow from '@/components/wallet/PinResetFlow';

export const SessionSettingsPage: React.FC = () => {
  const [resetPinOpen, setResetPinOpen] = useState(false);

  const handleLogoutAll = async () => {
    if (!confirm('Are you sure? This will log you out from all devices.')) {
      return;
    }

    try {
      await authClient.post('/api/v1/wallets/sessions/disconnect-all', {});
      // Redirect to login (authClient will handle clearing cookies/storage)
      window.location.href = '/login';
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Session & Security Settings</h1>
        <p className="text-gray-600">
          Manage your wallet sessions, devices, and security preferences
        </p>
      </div>

      {/* Session Timeout Warning */}
      {/* Removed sessionToken check - now managed via authClient cookies */}

      {/* Tabs */}
      <Tabs defaultValue="devices" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="devices" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            <span className="hidden sm:inline">Devices</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Activity</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Alerts</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
        </TabsList>

        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-4">
          <DeviceManagement />

          <Card>
            <CardHeader>
              <CardTitle>Session Management</CardTitle>
              <CardDescription>
                Control how long your sessions stay active
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4">
                <h4 className="font-medium">Auto-Extend Sessions</h4>
                <p className="mt-1 text-sm text-gray-600">
                  Your sessions will automatically extend by 24 hours when you
                  perform wallet operations. This keeps you logged in during
                  active use.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    defaultChecked
                    id="auto-extend"
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor="auto-extend" className="text-sm font-medium">
                    Enable auto-extend
                  </label>
                </div>
              </div>

              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <h4 className="font-medium text-red-900">Danger Zone</h4>
                <p className="mt-1 text-sm text-red-800">
                  Log out from all devices. This will end all active sessions
                  immediately.
                </p>
                <Button
                  onClick={handleLogoutAll}
                  variant="destructive"
                  className="mt-3"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log Out from All Devices
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <SessionActivityLog />
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <SessionNotifications />
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          {/* Biometric Unlock */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5" />
                Biometric Unlock
              </CardTitle>
              <CardDescription>
                Use your fingerprint or face to quickly unlock your wallet on
                this device
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BiometricUnlock />
            </CardContent>
          </Card>

          {/* PIN Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                PIN Management
              </CardTitle>
              <CardDescription>
                Change your PIN or reset it using email or SMS verification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4">
                <h4 className="font-medium">Current PIN</h4>
                <p className="mt-1 text-sm text-gray-600">
                  Your PIN protects your wallet during sensitive operations.
                </p>
                <Button
                  onClick={() => setResetPinOpen(true)}
                  variant="outline"
                  className="mt-3"
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Reset PIN
                </Button>
              </div>

              <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
                💡 <strong>Tip:</strong> Make sure your PIN is a 4-digit code
                that's easy for you to remember but hard for others to guess.
                Avoid using sequential numbers like 1234 or 0000.
              </div>
            </CardContent>
          </Card>

          {/* Security Tips */}
          <Card>
            <CardHeader>
              <CardTitle>Security Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-green-600" />
                  <span className="text-sm">
                    Regularly review your active devices and disconnect any you
                    don't recognize
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-green-600" />
                  <span className="text-sm">
                    Enable biometric unlock to add an extra layer of security
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-green-600" />
                  <span className="text-sm">
                    Review your activity log regularly to spot any suspicious
                    activity
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-green-600" />
                  <span className="text-sm">
                    Change your PIN if you suspect it's been compromised
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-green-600" />
                  <span className="text-sm">
                    Never share your PIN or seed phrase with anyone
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* PIN Reset Modal */}
      <PinResetFlow
        isOpen={resetPinOpen}
        onClose={() => setResetPinOpen(false)}
        walletId={''} // Should come from context or props
        onSuccess={() => {
          setResetPinOpen(false);
          // Redirect to re-login
        }}
      />
    </div>
  );
};

export default SessionSettingsPage;
