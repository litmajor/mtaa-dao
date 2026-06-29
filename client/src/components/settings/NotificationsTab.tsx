import React from 'react';
import { useSettings } from '../../hooks/useSettings';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Mail, Smartphone, Zap, MessageSquare, Briefcase } from 'lucide-react';

export function NotificationsTab() {
  const { settings, update } = useSettings();

  if (!settings) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Communication Channels */}
      <Card className="bg-black/40 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-yellow-500" /> Delivery Channels
          </CardTitle>
          <CardDescription className="text-gray-400">How would you like to receive notifications?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/5"><Mail className="w-5 h-5 text-gray-300" /></div>
              <div>
                <Label className="text-base text-white">Email Notifications</Label>
                <p className="text-sm text-gray-400">Receive alerts directly to your inbox.</p>
              </div>
            </div>
            <Switch 
              checked={settings.emailNotifications} 
              onCheckedChange={v => update({ emailNotifications: v })} 
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/5"><Smartphone className="w-5 h-5 text-gray-300" /></div>
              <div>
                <Label className="text-base text-white">Push Notifications</Label>
                <p className="text-sm text-gray-400">Get notified via browser or mobile app push.</p>
              </div>
            </div>
            <Switch 
              checked={settings.pushNotifications} 
              onCheckedChange={v => update({ pushNotifications: v })} 
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/5"><MessageSquare className="w-5 h-5 text-gray-300" /></div>
              <div>
                <Label className="text-base text-white">SMS Alerts</Label>
                <p className="text-sm text-gray-400">Important security alerts via text message.</p>
              </div>
            </div>
            <Switch 
              checked={settings.smsNotifications} 
              onCheckedChange={v => update({ smsNotifications: v })} 
            />
          </div>
        </CardContent>
      </Card>

      {/* Topics */}
      <Card className="bg-black/40 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" /> Notification Topics
          </CardTitle>
          <CardDescription className="text-gray-400">Choose what events trigger a notification.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* MOCK: These could be added to schema if needed, otherwise handled implicitly */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base text-white">DAO Governance Updates</Label>
              <p className="text-sm text-gray-400">New proposals, voting deadlines, and results.</p>
            </div>
            <Switch 
              checked={settings.notifyGovernance ?? true} 
              onCheckedChange={v => update({ notifyGovernance: v })} 
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base text-white">Treasury & Yield Alerts</Label>
              <p className="text-sm text-gray-400">Significant changes in vault APY, or large withdrawals.</p>
            </div>
            <Switch 
              checked={settings.notifyTreasury ?? true} 
              onCheckedChange={v => update({ notifyTreasury: v })} 
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base text-white">Market Intelligence (Morio)</Label>
              <p className="text-sm text-gray-400">Actionable insights from Morio AI agents.</p>
            </div>
            <Switch 
              checked={settings.notifyMorio ?? false} 
              onCheckedChange={v => update({ notifyMorio: v })} 
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base text-white">Weekly Summary</Label>
              <p className="text-sm text-gray-400">A weekly digest of your DAO's activity.</p>
            </div>
            <Switch 
              checked={settings.notifyWeeklySummary ?? true} 
              onCheckedChange={v => update({ notifyWeeklySummary: v })} 
            />
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
