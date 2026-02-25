/**
 * Device Management Component
 * Manage active sessions and devices
 */

import React, { useEffect, useState } from 'react';
import {
  Smartphone,
  Monitor,
  Tablet,
  X,
  MapPin,
  Clock,
  Shield,
  Loader,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Device {
  id: string;
  deviceName: string;
  deviceId: string;
  ipAddress?: string;
  location?: string;
  connectedAt: Date;
  lastAccessedAt: Date;
  expiresAt: Date;
  biometricEnabled: boolean;
  isCurrent: boolean;
}

export const DeviceManagement: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sessions/active', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch devices');

      const data = await response.json();
      setDevices(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    // Refresh every 5 minutes
    const interval = setInterval(fetchDevices, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDisconnect = async (deviceId: string) => {
    setDisconnecting(deviceId);
    try {
      const response = await fetch(`/api/sessions/${deviceId}/disconnect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        setDevices(devices.filter((d) => d.id !== deviceId));
      } else {
        setError('Failed to disconnect device');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setDisconnecting(null);
    }
  };

  const getDeviceIcon = (deviceName: string) => {
    const name = deviceName.toLowerCase();
    if (name.includes('iphone') || name.includes('android'))
      return Smartphone;
    if (name.includes('ipad') || name.includes('tablet')) return Tablet;
    return Monitor;
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatTimeRemaining = (date: Date) => {
    const now = new Date();
    const ms = new Date(date).getTime() - now.getTime();
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms / (1000 * 60)) % 60);

    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Active Devices
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
          <Smartphone className="h-5 w-5" />
          Active Devices
        </CardTitle>
        <CardDescription>
          Manage your active sessions and devices. You have {devices.length}{' '}
          device{devices.length !== 1 ? 's' : ''} connected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {devices.length === 0 ? (
          <p className="text-center text-sm text-gray-500">
            No active devices
          </p>
        ) : (
          devices.map((device) => {
            const DeviceIcon = getDeviceIcon(device.deviceName);

            return (
              <div
                key={device.id}
                className={`rounded-lg border p-4 ${
                  device.isCurrent ? 'border-blue-300 bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <DeviceIcon className="mt-1 h-5 w-5 text-gray-600" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">
                          {device.deviceName}
                        </h4>
                        {device.isCurrent && (
                          <Badge variant="outline" className="text-blue-600">
                            Current Device
                          </Badge>
                        )}
                        {device.biometricEnabled && (
                          <Badge
                            variant="outline"
                            className="flex items-center gap-1"
                          >
                            <Shield className="h-3 w-3" />
                            Biometric
                          </Badge>
                        )}
                      </div>

                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        {device.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {device.location}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Connected {formatTimeAgo(device.connectedAt)}
                        </div>

                        <div className="text-xs text-gray-500">
                          {device.ipAddress || 'IP unknown'}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-xs">
                        <div className="inline-block rounded bg-gray-100 px-2 py-1">
                          Expires in {formatTimeRemaining(device.expiresAt)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {!device.isCurrent && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDisconnect(device.id)}
                      disabled={disconnecting === device.id}
                    >
                      {disconnecting === device.id ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default DeviceManagement;
