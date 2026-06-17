import React, { useState, useEffect } from 'react';
import { useStrategyRegistry } from '@/hooks/useStrategyRegistry';
import useStrategyDeployment from '@/hooks/useStrategyDeployment';
import { StrategyDeploymentWizard } from '@/components/strategies/StrategyDeploymentWizard';
import { TwoFAVerificationModal } from '@/components/wallet/TwoFAVerificationModal';
import { ActiveBotsList } from '@/components/strategies/ActiveBotsList';
import AppLayout from '@/components/layout/AppLayout';

type ViewMode = 'active' | 'deploy';

export default function BotsPage() {
  const [advancedMode, setAdvancedMode] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [showWizard, setShowWizard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [pendingDeploy, setPendingDeploy] = useState<any | null>(null);

  const { strategies, loadStrategies } = useStrategyRegistry();
  const {
    bots,
    loadBots,
    deployBot,
    pauseBot,
    resumeBot,
    stopBot,
    getTotalPerformance
  } = useStrategyDeployment();

  // Load data on mount
  useEffect(() => {
    (async () => {
      loadStrategies();
      loadBots();
      // Server-side auth probe: will 401 if not authenticated
      try {
        const res = await fetch('/api/v1/settings/advanced-mode');
        if (res.status === 401) return window.location.replace('/login');
        if (res.ok) {
          const json = await res.json();
          const adv = json?.data?.advancedMode === true;
          setAdvancedMode(adv);
          // persist locally for UI responsiveness
          try { localStorage.setItem('advancedModeOptIn', adv ? '1' : '0'); } catch (e) {}
        }
      } catch (e) {
        // network error — keep current behavior
      }
    })();
  }, []);

  const toggleAdvancedMode = async () => {
    try {
      const enable = !advancedMode;
      const res = await fetch('/api/v1/settings/advanced-mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: enable }) });
      if (res.ok) {
        setAdvancedMode(enable);
        try { localStorage.setItem('advancedModeOptIn', enable ? '1' : '0'); } catch (e) {}
      }
    } catch (e) {
      // ignore
    }
  };

  const handleDeploy = async (
    strategyId: string,
    inputs: Record<string, any>,
    riskControl: any,
    exchanges: string[],
    botName: string,
    initialCapital: number,
    options?: { dry_run?: boolean }
  ) => {
    try {
      setLoading(true);
      setError(null);

      const strategy = strategies.find((s: any) => s.id === strategyId);
      if (!strategy) throw new Error('Strategy not found');

      // If this is a live deploy, pre-check 2FA on the client to show helpful UI
      if (options?.dry_run === false) {
        try {
          const r = await fetch('/api/v1/settings/2fa/check', { method: 'POST' });
          if (r.status === 403) {
            const body = await r.json().catch(() => ({}));
            // If 2FA not enabled, redirect to security settings
            if (body?.error === '2FA not enabled') {
              window.location.href = '/settings/security';
              return;
            }

            // Otherwise require interactive 2FA verification flow
            setPendingDeploy({ strategyId, inputs, riskControl, exchanges, botName, initialCapital, options });
            setShow2FAModal(true);
            return;
          }
        } catch (e) {
          throw e;
        }
      }

      await deployBot(strategy, inputs, riskControl, exchanges, botName, initialCapital, options);

      setSuccessMessage(`✓ Bot "${botName}" deployed successfully!`);
      setShowWizard(false);
      setViewMode('active');

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);

      // Reload bots
      await loadBots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerified = async (_verificationToken?: string) => {
    setShow2FAModal(false);
    const p = pendingDeploy;
    setPendingDeploy(null);
    if (!p) return;
    // Retry deploy now that 2FA was verified
    try {
      setLoading(true);
      await deployBot(p.strategyId, p.inputs, p.riskControl, p.exchanges, p.botName, p.initialCapital, p.options);
      setSuccessMessage(`✓ Bot "${p.botName}" deployed successfully!`);
      setViewMode('active');
      setTimeout(() => setSuccessMessage(null), 5000);
      await loadBots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (botId: string) => {
    try {
      await pauseBot(botId);
      setSuccessMessage('✓ Bot paused');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause bot');
    }
  };

  const handleResume = async (botId: string) => {
    try {
      await resumeBot(botId);
      setSuccessMessage('✓ Bot resumed');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume bot');
    }
  };

  const handleStop = async (botId: string) => {
    if (!confirm('Are you sure you want to stop this bot?')) return;

    try {
      await stopBot(botId);
      setSuccessMessage('✓ Bot stopped');
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadBots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop bot');
    }
  };

  const totalPerformance = getTotalPerformance();

  return (
    <>
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">🤖 Trading Bots</h1>
            <p className="text-slate-400">
              Deploy and manage automated trading strategies
            </p>
          </div>
          <button
            onClick={() => {
              setShowWizard(!showWizard);
              setViewMode('deploy');
            }}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold flex items-center gap-2"
          >
            🚀 Deploy New Strategy
          </button>
          <button onClick={toggleAdvancedMode} className="ml-3 px-4 py-2 bg-slate-700 text-slate-200 rounded-lg">{advancedMode ? 'Advanced: ON' : 'Advanced: OFF'}</button>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="p-4 bg-green-900 border-l-4 border-green-500 rounded text-green-100">
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-900 border-l-4 border-red-500 rounded text-red-100 flex justify-between items-center">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-200"
            >
              ✕
            </button>
          </div>
        )}

        {/* Wizard Modal */}
        {showWizard && (
          <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto">
            <div className="min-h-screen flex items-center justify-center p-4">
              <button
                onClick={() => {
                  setShowWizard(false);
                  setViewMode('active');
                }}
                className="absolute top-4 right-4 text-white text-2xl hover:text-slate-300 z-60"
              >
                ✕
              </button>
              <StrategyDeploymentWizard
                strategies={strategies}
                onDeploy={handleDeploy}
                isLoading={loading}
              />
            </div>
          </div>
        )}

        {/* Active Bots Section */}
        {!showWizard && viewMode === 'active' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Active Bots</h2>
              {bots.length > 0 && (
                <div className="text-sm text-slate-400">
                  {bots.filter((b: any) => b.status === 'running').length} running •{' '}
                  {totalPerformance.trades} total trades
                </div>
              )}
            </div>

            <ActiveBotsList
              bots={bots}
              isLoading={loading}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleStop}
            />
          </div>
        )}

        {/* Statistics */}
        {bots.length > 0 && !showWizard && (
          <div className="mt-8 pt-6 border-t border-slate-700">
            <h3 className="text-lg font-bold text-white mb-4">Portfolio Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-800 rounded-lg">
                <div className="text-sm text-slate-400">Total Profit/Loss</div>
                <div className={`text-2xl font-bold ${
                  totalPerformance.profit >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  ${totalPerformance.profit.toFixed(2)}
                </div>
              </div>

              <div className="p-4 bg-slate-800 rounded-lg">
                <div className="text-sm text-slate-400">Win Rate</div>
                <div className="text-2xl font-bold text-blue-400">
                  {totalPerformance.winRate.toFixed(1)}%
                </div>
              </div>

              <div className="p-4 bg-slate-800 rounded-lg">
                <div className="text-sm text-slate-400">Profit Factor</div>
                <div className="text-2xl font-bold text-purple-400">
                  {totalPerformance.profitFactor.toFixed(2)}x
                </div>
              </div>

              <div className="p-4 bg-slate-800 rounded-lg">
                <div className="text-sm text-slate-400">Open Positions</div>
                <div className="text-2xl font-bold text-orange-400">
                  {totalPerformance.openPositions}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 p-6 bg-blue-900 rounded-lg border border-blue-700">
          <h3 className="font-bold text-blue-100 mb-2">💡 Getting Started with Bots</h3>
          <ul className="text-sm text-blue-200 space-y-1">
            <li>✓ Click "Deploy New Strategy" to start the deployment wizard</li>
            <li>✓ Select from pre-built strategies or create custom ones</li>
            <li>✓ Configure inputs, risk controls, and exchanges</li>
            <li>✓ Review settings and deploy your bot</li>
            <li>✓ Monitor all bot trades in Trading Dashboard → History</li>
            <li>✓ Pause, resume, or stop bots anytime</li>
          </ul>
        </div>

        {/* Coming Soon */}
        <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
          <h3 className="font-bold text-slate-100 mb-2">🔜 Coming Soon</h3>
          <ul className="text-sm text-slate-400 space-y-1">
            <li>• Advanced bot performance analytics</li>
            <li>• Custom strategy builder</li>
            <li>• Strategy backtesting engine</li>
            <li>• Community strategy marketplace</li>
            <li>• Bot performance leaderboard</li>
            <li>• Advanced alerts and notifications</li>
          </ul>
        </div>
      </div>
    </AppLayout>
    <TwoFAVerificationModal open={show2FAModal} onClose={() => setShow2FAModal(false)} onVerified={handle2FAVerified} method={'AUTHENTICATOR'} />
  </>
  );
}
