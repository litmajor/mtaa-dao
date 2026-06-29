import React from 'react';
import { useSettings } from '../../hooks/useSettings';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Palette, Globe, Accessibility, Activity } from 'lucide-react';

export function PreferencesTab() {
  const { settings, update } = useSettings();

  if (!settings) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* General Appearance */}
      <Card className="bg-black/40 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Palette className="w-5 h-5 text-pink-500" /> Appearance & Display
          </CardTitle>
          <CardDescription className="text-gray-400">Customize how MtaaDAO looks on your device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-gray-300">Theme</Label>
              <Select value={settings.theme} onValueChange={(v: any) => update({ theme: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white">
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="system">System Default</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-gray-300">Font Size</Label>
              <Select value={settings.fontSize || 'normal'} onValueChange={(v: any) => update({ fontSize: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select font size" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white">
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                  <SelectItem value="xlarge">Extra Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Localization */}
      <Card className="bg-black/40 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" /> Localization
          </CardTitle>
          <CardDescription className="text-gray-400">Language, timezone, and currency preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-gray-300">Language</Label>
              <Select value={settings.language || 'en'} onValueChange={(v: string) => update({ language: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white">
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="sw">Swahili</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-gray-300">Preferred Currency</Label>
              <Select value={settings.preferredCurrency || 'cUSD'} onValueChange={(v: string) => update({ preferredCurrency: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white">
                  <SelectItem value="cUSD">Celo Dollar (cUSD)</SelectItem>
                  <SelectItem value="KES">Kenyan Shilling (KES)</SelectItem>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="CELO">Celo Native (CELO)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label className="text-gray-300">Timezone</Label>
              <Select value={settings.timezone || 'Africa/Nairobi'} onValueChange={(v: string) => update({ timezone: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white">
                  <SelectItem value="Africa/Nairobi">East Africa Time (Nairobi)</SelectItem>
                  <SelectItem value="Africa/Lagos">West Africa Time (Lagos)</SelectItem>
                  <SelectItem value="Africa/Johannesburg">South Africa Standard Time (Johannesburg)</SelectItem>
                  <SelectItem value="UTC">Coordinated Universal Time (UTC)</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time (New York)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accessibility */}
      <Card className="bg-black/40 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Accessibility className="w-5 h-5 text-green-400" /> Accessibility
          </CardTitle>
          <CardDescription className="text-gray-400">Settings to improve visibility and interaction.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base text-white">High Contrast</Label>
              <p className="text-sm text-gray-400">Increase contrast for better readability.</p>
            </div>
            <Switch 
              checked={settings.highContrast} 
              onCheckedChange={v => update({ highContrast: v })} 
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base text-white">Reduced Motion</Label>
              <p className="text-sm text-gray-400">Minimize animations across the platform.</p>
            </div>
            <Switch 
              checked={settings.reducedMotion} 
              onCheckedChange={v => update({ reducedMotion: v })} 
            />
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
