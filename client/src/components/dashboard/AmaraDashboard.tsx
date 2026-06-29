import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

/**
 * AMARA DASHBOARD: Advanced Trader + Investor
 * 
 * Focus: Investment returns, opportunities, and advanced strategies
 * Shows:
 * - Portfolio value with YTD ROI
 * - Opportunities list (yield farming, trading, arbitrage)
 * - Governance alerts and market signals
 * - Power tools for advanced trading
 * -Will be granted access to deeper intelligence tools like asset-graphs, sentiment analysis, and strategy automation in future iterations.
 * Its the least developed but most mature dashboard, designed for active traders and investors who want to monitor their portfolio and discover new opportunities.
 *
 */

interface DashboardData {
  portfolioValue?: number;
  roiYtd?: number;
  gainsSinceStart?: number;
  opportunities?: any[];
  alerts?: any[];
}

export function AmaraDashboard({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-6">
      {/* Portfolio ROI Card */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-green-100 text-sm mb-2">Portfolio Value</p>
            <h2 className="text-4xl font-bold">
              ${data?.portfolioValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-green-100 text-sm">ROI (YTD)</p>
            <h3 className="text-3xl font-bold text-green-200">
              +{data?.roiYtd || 0}%
            </h3>
          </div>
        </div>
        <p className="text-green-100 text-xs">
          +${data?.gainsSinceStart?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} since start
        </p>
      </div>

      {/* Opportunities */}
      {data?.opportunities && data.opportunities.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Opportunities</h3>
          <div className="space-y-3">
            {data.opportunities.map((opp: any, idx: number) => (
              <Link key={idx} to={opp.href || '#'}>
                <div className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-white font-medium">{opp.title}</h4>
                    <span
                      className={`text-sm font-bold ${
                        opp.apr >= 20
                          ? 'text-green-400'
                          : opp.apr >= 10
                          ? 'text-blue-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {opp.apr}% APR
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm mb-3">{opp.description}</p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        opp.risk === 'low'
                          ? 'bg-green-600/30 text-green-300'
                          : opp.risk === 'medium'
                          ? 'bg-amber-600/30 text-amber-300'
                          : 'bg-red-600/30 text-red-300'
                      }`}
                    >
                      {opp.risk} risk
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Governance Alerts */}
      {data?.alerts && data.alerts.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">⚡ Active Alerts</h3>
          <div className="space-y-2">
            {data.alerts.map((alert: any, idx: number) => (
              <div key={idx} className="bg-slate-700 rounded-lg p-3 text-sm text-slate-300">
                {alert.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Tools Access */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">Power Tools</h3>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/trading/dex">
            <Button variant="outline" className="w-full justify-start">
              🔄 DEX Trading
            </Button>
          </Link>
          <Link to="/trading/farm">
            <Button variant="outline" className="w-full justify-start">
              🌾 Yield Farming
            </Button>
          </Link>
          <Link to="/trading/bridge">
            <Button variant="outline" className="w-full justify-start">
              🌉 Cross-Chain Bridge
            </Button>
          </Link>
          <Link to="/advanced">
            <Button variant="outline" className="w-full justify-start">
              ⚙️ Advanced Settings
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
