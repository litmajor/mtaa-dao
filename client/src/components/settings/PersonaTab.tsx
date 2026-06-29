import React from 'react';
import { usePersona } from '@/contexts/persona-context';
import { PersonaModeSelector } from '../PersonaModeSelector';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Users, LineChart, Briefcase } from 'lucide-react';

export function PersonaTab() {
  const { currentPersona, preferences, updatePreferences } = usePersona();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <Card className="bg-black/40 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white">Active Persona</CardTitle>
          <CardDescription className="text-gray-400">
            Switch between personas to adapt your dashboard and tools to your current goal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PersonaModeSelector />
        </CardContent>
      </Card>

      {/* Okedi specific settings */}
      {currentPersona === 'okedi' && (
        <Card className="bg-blue-900/10 border-blue-500/20 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-blue-400 flex items-center gap-2">
              <Users className="w-5 h-5" /> Okedi Settings (Community)
            </CardTitle>
            <CardDescription className="text-gray-400">Governance and community management preferences.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-gray-300">Default Contribution Amount (cUSD)</Label>
              <Select defaultValue="5">
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white">
                  <SelectItem value="1">1 cUSD</SelectItem>
                  <SelectItem value="5">5 cUSD</SelectItem>
                  <SelectItem value="10">10 cUSD</SelectItem>
                  <SelectItem value="50">50 cUSD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base text-white">Auto-vote on Routine Proposals</Label>
                <p className="text-sm text-gray-400">Delegate votes for minor administrative proposals.</p>
              </div>
              <Switch defaultChecked={false} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Yuki specific settings */}
      {currentPersona === 'yuki' && (
        <Card className="bg-purple-900/10 border-purple-500/20 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-purple-400 flex items-center gap-2">
              <LineChart className="w-5 h-5" /> Yuki Settings (Trading)
            </CardTitle>
            <CardDescription className="text-gray-400">Execution, slippage, and trading alerts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between">
                <Label className="text-gray-300">Default Slippage Tolerance</Label>
                <span className="text-purple-400 font-mono">1.0%</span>
              </div>
              <Slider defaultValue={[1]} max={5} step={0.1} className="py-4" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base text-white">MEV Protection</Label>
                <p className="text-sm text-gray-400">Route trades through private RPCs to avoid front-running.</p>
              </div>
              <Switch defaultChecked={true} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Amara specific settings */}
      {currentPersona === 'amara' && (
        <Card className="bg-emerald-900/10 border-emerald-500/20 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-emerald-400 flex items-center gap-2">
              <Briefcase className="w-5 h-5" /> Amara Settings (Investing)
            </CardTitle>
            <CardDescription className="text-gray-400">Portfolio, risk management, and yield preferences.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-gray-300">Risk Profile</Label>
              <Select defaultValue="balanced">
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white">
                  <SelectItem value="conservative">Conservative (Stablecoins only)</SelectItem>
                  <SelectItem value="balanced">Balanced (Blue chips & Stablecoins)</SelectItem>
                  <SelectItem value="aggressive">Aggressive (Include alt-coins)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base text-white">Auto-Compound Yields</Label>
                <p className="text-sm text-gray-400">Automatically reinvest earned yields back into vaults.</p>
              </div>
              <Switch defaultChecked={true} />
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
