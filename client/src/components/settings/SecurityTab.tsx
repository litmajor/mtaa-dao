import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSettings } from '../../hooks/useSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Smartphone, Mail, ShieldCheck, KeyRound, MonitorSmartphone, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function SecurityTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { settings, update } = useSettings();
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const changePassword = useMutation({
    mutationFn: async () => {
      if (passwords.newPassword !== passwords.confirmPassword) {
        throw new Error("New passwords do not match");
      }
      const res = await fetch('/api/account/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to change password');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Password changed successfully' });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const [pinData, setPinData] = useState({ currentPin: '', newPin: '' });

  const { data: pinSettings } = useQuery({
    queryKey: ['pin-settings'],
    queryFn: async () => {
      const res = await fetch('/api/account/pin-settings');
      if (!res.ok) throw new Error('Failed to fetch PIN settings');
      return res.json();
    }
  });

  const updatePinSettings = useMutation({
    mutationFn: async (newSettings: any) => {
      const res = await fetch('/api/account/pin-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (!res.ok) throw new Error('Failed to update PIN settings');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pin-settings'] }),
  });

  const setPin = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/account/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pinData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update PIN');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Application PIN updated securely.' });
      setPinData({ currentPin: '', newPin: '' });
      qc.invalidateQueries({ queryKey: ['pin-settings'] });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
  });

  const toggle2FA = async (enabled: boolean) => {
    update({ twoFactorEnabled: enabled });
    const endpoint = enabled ? '/api/account/2fa/enable' : '/api/account/2fa/disable';
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to toggle 2FA on server');
      const data = await res.json();
      if (enabled && data.qrCode) {
        toast({ title: '2FA Enabled', description: 'Setup initiated. Please scan the QR code (mocked).' });
      } else {
        toast({ title: `2FA ${enabled ? 'Enabled' : 'Disabled'}` });
      }
    } catch (e: any) {
      toast({ title: '2FA Error', description: e.message, variant: 'destructive' });
      // Revert optimism
      update({ twoFactorEnabled: !enabled });
    }
  };

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await fetch('/api/account/sessions');
      if (!res.ok) throw new Error('Failed to fetch sessions');
      return res.json();
    },
  });

  const revokeSession = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/account/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke session');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Session revoked successfully' });
      qc.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to revoke session', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Password Change */}
      <Card className="bg-black/40 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" /> Change Password
          </CardTitle>
          <CardDescription className="text-gray-400">Ensure your account is using a long, random password to stay secure.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-gray-300">Current Password</Label>
            <Input 
              type="password" 
              className="bg-white/5 border-white/10 text-white"
              value={passwords.currentPassword}
              onChange={e => setPasswords({ ...passwords, currentPassword: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">New Password</Label>
              <Input 
                type="password" 
                className="bg-white/5 border-white/10 text-white"
                value={passwords.newPassword}
                onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Confirm New Password</Label>
              <Input 
                type="password" 
                className="bg-white/5 border-white/10 text-white"
                value={passwords.confirmPassword}
                onChange={e => setPasswords({ ...passwords, confirmPassword: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={() => changePassword.mutate()}
            disabled={changePassword.isPending || !passwords.currentPassword || !passwords.newPassword}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {changePassword.isPending ? 'Updating...' : 'Update Password'}
          </Button>
        </CardFooter>
      </Card>

      {/* Two Factor Authentication */}
      <Card className="bg-black/40 border-white/10 backdrop-blur-md border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-400" /> Two-Factor Authentication (2FA)
          </CardTitle>
          <CardDescription className="text-gray-400">
            Add an extra layer of security to your account. Choose how you want to receive your security codes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base text-white">Enable 2FA</Label>
              <p className="text-sm text-gray-400">Require an extra security step when logging in.</p>
            </div>
            <Switch 
              checked={settings?.twoFactorEnabled || false} 
              onCheckedChange={toggle2FA} 
            />
          </div>

          {settings?.twoFactorEnabled && (
            <div className="pt-4 border-t border-white/10 space-y-4">
              <Label className="text-gray-300">Default Authentication Method</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div 
                  className={`p-4 rounded-xl border cursor-pointer transition-colors ${settings.twoFactorMethod === 'authenticator' ? 'bg-primary/10 border-primary text-primary' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                  onClick={() => update({ twoFactorMethod: 'authenticator' })}
                >
                  <ShieldCheck className="w-6 h-6 mb-2" />
                  <div className="font-medium">Authenticator App</div>
                  <div className="text-xs opacity-70 mt-1">Google Authenticator, Authy, etc.</div>
                </div>
                <div 
                  className={`p-4 rounded-xl border cursor-pointer transition-colors ${settings.twoFactorMethod === 'sms' ? 'bg-primary/10 border-primary text-primary' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                  onClick={() => update({ twoFactorMethod: 'sms' })}
                >
                  <Smartphone className="w-6 h-6 mb-2" />
                  <div className="font-medium">SMS Text Message</div>
                  <div className="text-xs opacity-70 mt-1">Receive a code via text.</div>
                </div>
                <div 
                  className={`p-4 rounded-xl border cursor-pointer transition-colors ${settings.twoFactorMethod === 'email' ? 'bg-primary/10 border-primary text-primary' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                  onClick={() => update({ twoFactorMethod: 'email' })}
                >
                  <Mail className="w-6 h-6 mb-2" />
                  <div className="font-medium">Email Verification</div>
                  <div className="text-xs opacity-70 mt-1">Receive a code via email.</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Application PIN */}
      <Card className="bg-black/40 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-purple-400" /> Application PIN
          </CardTitle>
          <CardDescription className="text-gray-400">Manage a secure PIN for logging in, authorizing transfers, and 2FA.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Require PIN for Login</p>
                <p className="text-sm text-gray-400">Prompt for your PIN when logging in.</p>
              </div>
              <Switch 
                checked={pinSettings?.pinEnabledForLogin || false} 
                onCheckedChange={v => updatePinSettings.mutate({ pinEnabledForLogin: v })}
                disabled={!pinSettings?.hasPinSetup}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Require PIN for Transfers</p>
                <p className="text-sm text-gray-400">Extra layer of security when sending funds.</p>
              </div>
              <Switch 
                checked={pinSettings?.pinEnabledForTransfers || false} 
                onCheckedChange={v => updatePinSettings.mutate({ pinEnabledForTransfers: v })}
                disabled={!pinSettings?.hasPinSetup}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Use PIN for 2FA</p>
                <p className="text-sm text-gray-400">Use this PIN as your primary Two-Factor Authentication method.</p>
              </div>
              <Switch 
                checked={pinSettings?.pinEnabledFor2FA || false} 
                onCheckedChange={v => updatePinSettings.mutate({ pinEnabledFor2FA: v })}
                disabled={!pinSettings?.hasPinSetup}
              />
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-white/10">
            <div className="space-y-4 flex-1">
              <Label className="text-gray-300">{pinSettings?.hasPinSetup ? 'Update' : 'Set'} 4-6 Digit PIN</Label>
              <div className="flex gap-4">
                {pinSettings?.hasPinSetup && (
                  <Input 
                    type="password" 
                    placeholder="Current" 
                    maxLength={6} 
                    className="bg-white/5 border-white/10 text-white w-full sm:w-28 text-center tracking-widest text-lg" 
                    value={pinData.currentPin}
                    onChange={e => setPinData({ ...pinData, currentPin: e.target.value })}
                  />
                )}
                <Input 
                  type="password" 
                  placeholder="New PIN" 
                  maxLength={6} 
                  className="bg-white/5 border-white/10 text-white w-full sm:w-28 text-center tracking-widest text-lg" 
                  value={pinData.newPin}
                  onChange={e => setPinData({ ...pinData, newPin: e.target.value })}
                />
                <Button 
                  variant="outline" 
                  className="border-white/20 text-white hover:bg-white/10"
                  onClick={() => setPin.mutate()}
                  disabled={setPin.isPending || pinData.newPin.length < 4 || (pinSettings?.hasPinSetup && pinData.currentPin.length < 4)}
                >
                  {setPin.isPending ? 'Saving...' : 'Save PIN'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Management */}
      <Card className="bg-black/40 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <MonitorSmartphone className="w-5 h-5 text-gray-400" /> Active Sessions
          </CardTitle>
          <CardDescription className="text-gray-400">Manage devices that are currently logged in to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="text-gray-400 text-center py-4">Loading sessions...</div>
          ) : (
            <div className="rounded-xl border border-white/10 divide-y divide-white/10 overflow-hidden">
              {sessions?.map((session: any) => (
                <div key={session.id} className="flex items-center justify-between p-4 bg-white/5">
                  <div>
                    <p className="font-medium text-white flex items-center gap-2">
                      {session.deviceName} 
                      {session.current && <Badge variant="secondary" className="bg-primary/20 text-primary hover:bg-primary/20">Current Device</Badge>}
                    </p>
                    <p className="text-sm text-gray-400">
                      {session.location} • {session.lastActive ? `Active ${new Date(session.lastActive).toLocaleDateString()}` : 'Active now'}
                    </p>
                  </div>
                  {!session.current && (
                    <Button 
                      variant="ghost" 
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => revokeSession.mutate(session.id)}
                      disabled={revokeSession.isPending}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          
          <Button variant="destructive" className="mt-4 w-full md:w-auto bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30">
            Log out of all other devices
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
