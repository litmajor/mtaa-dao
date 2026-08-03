import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Shield, AlertTriangle, Sliders, DollarSign, TrendingDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getRiskSettings, updateRiskSettings as updateApiRiskSettings } from '@/api/yukiApi';
import { useYukiStore } from '@/stores/useYukiStore';

export default function RiskControls() {
  const { toast } = useToast();
  const updateRiskSettingsStore = useYukiStore((state) => state.updateRiskSettings);

  const { data: serverSettings, isLoading, refetch } = useQuery({
    queryKey: ['yukiRiskSettings'],
    queryFn: async () => {
      try {
        const res = await getRiskSettings();
        return res?.data || null;
      } catch (err) {
        // Fallback for demo if API isn't ready
        return {
          maxSlippage: 1.0,
          maxDrawdown: 15,
          positionSizingMode: 'percentage',
          maxLeverage: 3,
          autoStopLossEnabled: true,
          autoStopLossPct: 5,
          dailyLossLimitUsd: 500,
        };
      }
    },
  });

  const [settings, setSettings] = useState({
    maxSlippage: 1.0,
    maxDrawdown: 15,
    positionSizingMode: 'percentage',
    maxLeverage: 3,
    autoStopLossEnabled: true,
    autoStopLossPct: 5,
    dailyLossLimitUsd: 500,
  });

  useEffect(() => {
    if (serverSettings) {
      setSettings(serverSettings);
      updateRiskSettingsStore(serverSettings);
    }
  }, [serverSettings, updateRiskSettingsStore]);

  const mutation = useMutation({
    mutationFn: async (newSettings: typeof settings) => {
      return updateApiRiskSettings(newSettings);
    },
    onSuccess: (res, newSettings) => {
      toast({
        title: 'Risk Settings Saved',
        description: 'Your risk preferences have been updated securely.',
        variant: 'default',
      });
      updateRiskSettingsStore(newSettings);
      refetch();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save risk settings. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    mutation.mutate(settings);
  };

  const handleReset = () => {
    const defaults = {
      maxSlippage: 1.0,
      maxDrawdown: 15,
      positionSizingMode: 'percentage',
      maxLeverage: 3,
      autoStopLossEnabled: true,
      autoStopLossPct: 5,
      dailyLossLimitUsd: 500,
    };
    setSettings(defaults);
  };

  // Compute a simple risk score for visual indicator
  const riskScore = settings.maxSlippage * 10 + settings.maxDrawdown + (settings.maxLeverage * 5);
  const riskLevel = riskScore > 50 ? 'high' : riskScore > 30 ? 'medium' : 'low';

  if (isLoading) {
    return <div className="text-slate-400 p-4">Loading risk settings...</div>;
  }

  return (
    <div className="bg-slate-900 text-white rounded-xl max-w-4xl mx-auto">
      <div className="p-6 border-b border-slate-700 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-400" />
            Risk Controls & Limits
          </h2>
          <p className="text-sm text-slate-400 mt-1">Configure global safety boundaries for automated and manual execution.</p>
        </div>
        <div className={`px-3 py-1 rounded text-sm font-semibold flex items-center gap-2 ${
          riskLevel === 'high' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50' :
          riskLevel === 'medium' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' :
          'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
        }`}>
          <AlertTriangle className="h-4 w-4" />
          {riskLevel.toUpperCase()} RISK PROFILE
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Execution Limits */}
        <section>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Sliders className="h-4 w-4 text-slate-400" /> Execution Limits
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <label className="block text-sm font-medium text-slate-300 mb-2">Maximum Slippage (%)</label>
              <input 
                type="range" 
                min="0.1" max="5.0" step="0.1" 
                value={settings.maxSlippage}
                onChange={(e) => setSettings({...settings, maxSlippage: parseFloat(e.target.value)})}
                className="w-full accent-blue-500"
              />
              <div className="text-right text-lg font-bold text-blue-400">{settings.maxSlippage.toFixed(1)}%</div>
            </div>
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <label className="block text-sm font-medium text-slate-300 mb-2">Maximum Leverage (x)</label>
              <input 
                type="range" 
                min="1" max="10" step="1" 
                value={settings.maxLeverage}
                onChange={(e) => setSettings({...settings, maxLeverage: parseInt(e.target.value)})}
                className="w-full accent-purple-500"
              />
              <div className="text-right text-lg font-bold text-purple-400">{settings.maxLeverage}x</div>
            </div>
          </div>
        </section>

        {/* Loss Protection */}
        <section>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <TrendingDown className="h-4 w-4 text-slate-400" /> Loss Protection
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <label className="block text-sm font-medium text-slate-300 mb-2">Max Portfolio Drawdown (%)</label>
              <input 
                type="range" 
                min="1" max="50" step="1" 
                value={settings.maxDrawdown}
                onChange={(e) => setSettings({...settings, maxDrawdown: parseInt(e.target.value)})}
                className="w-full accent-orange-500"
              />
              <div className="text-right text-lg font-bold text-orange-400">{settings.maxDrawdown}%</div>
            </div>
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <label className="block text-sm font-medium text-slate-300 mb-2">Daily Loss Limit (USD)</label>
              <input 
                type="number" 
                value={settings.dailyLossLimitUsd}
                onChange={(e) => setSettings({...settings, dailyLossLimitUsd: parseInt(e.target.value) || 0})}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 col-span-1 md:col-span-2 flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Auto Stop-Loss</div>
                <div className="text-sm text-slate-400">Automatically place a stop-loss order on new positions</div>
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  disabled={!settings.autoStopLossEnabled}
                  value={settings.autoStopLossPct}
                  onChange={(e) => setSettings({...settings, autoStopLossPct: parseInt(e.target.value) || 0})}
                  className="w-20 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white disabled:opacity-50"
                />
                <span className="text-slate-400">%</span>
                <button 
                  onClick={() => setSettings({...settings, autoStopLossEnabled: !settings.autoStopLossEnabled})}
                  className={`w-12 h-6 rounded-full relative transition-colors ${settings.autoStopLossEnabled ? 'bg-blue-600' : 'bg-slate-600'}`}
                >
                  <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.autoStopLossEnabled ? 'translate-x-6' : ''}`}></span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Position Sizing */}
        <section>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <DollarSign className="h-4 w-4 text-slate-400" /> Position Sizing Mode
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {['fixed', 'percentage', 'kelly'].map((mode) => (
              <button
                key={mode}
                onClick={() => setSettings({...settings, positionSizingMode: mode as any})}
                className={`p-4 rounded-lg border text-left transition-colors ${
                  settings.positionSizingMode === mode 
                  ? 'bg-blue-600/20 border-blue-500' 
                  : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="font-semibold capitalize text-slate-200 mb-1">{mode === 'kelly' ? 'Kelly Criterion' : mode}</div>
                <div className="text-xs text-slate-400">
                  {mode === 'fixed' && 'Use a fixed USD amount for all trades.'}
                  {mode === 'percentage' && 'Size based on a percentage of portfolio.'}
                  {mode === 'kelly' && 'Dynamically size based on win probability.'}
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="p-6 border-t border-slate-700 flex justify-end gap-4 bg-slate-800/50 rounded-b-xl">
        <button 
          onClick={handleReset}
          className="px-4 py-2 rounded text-slate-300 hover:text-white border border-slate-600 hover:bg-slate-700 transition-colors font-medium text-sm"
        >
          Reset Defaults
        </button>
        <button 
          onClick={handleSave}
          disabled={mutation.isPending}
          className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
