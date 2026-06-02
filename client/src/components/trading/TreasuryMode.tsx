import React, { useState, useMemo } from 'react';
import { TrendingUp, AlertCircle } from 'lucide-react';
import { useTreasuryData } from '../../hooks/useTreasuryData';

interface TreasuryData {
  totalAssets: number;
  tokenHoldings: Array<{
    symbol: string;
    amount: number;
    value: number;
    allocation: number;
  }>;
  governanceWeight: number;
  monthlyBudget: number;
  spentThisMonth: number;
}

interface TreasuryModeProps {
  exchanges: any[];
  bestPrice: number;
}

/**
 * Treasury Mode: DAO financial operations dashboard
 * 
 * Shows:
 * - Treasury composition and allocation
 * - Monthly budget tracking
 * - Governance voting power
 * - Institutional trade execution
 * - Treasury rebalancing tools
 */
export const TreasuryMode: React.FC<TreasuryModeProps> = ({ exchanges }) => {
  const [selectedTab, setSelectedTab] = useState<'portfolio' | 'budget' | 'governance' | 'transfers'>('portfolio');
  
  // Fetch real treasury data from smart contracts
  const { data: treasuryDataFromContract, loading, error, health, lastUpdated } = useTreasuryData({
    refreshInterval: 30000, // Refresh every 30 seconds
  });

  // Use fetched data or fallback to mock data
  const treasury = treasuryDataFromContract || {
    totalAssets: 48500000,
    tokenHoldings: [
      { symbol: 'ETH', amount: 15000, value: 36750000, allocation: 75.8 },
      { symbol: 'USDC', amount: 8000000, value: 8000000, allocation: 16.5 },
      { symbol: 'DAO', amount: 300000, value: 3750000, allocation: 7.7 },
    ],
    governanceWeight: 42.3,
    monthlyBudget: 500000,
    spentThisMonth: 287500,
  };

  const budgetRemaining = treasury.monthlyBudget - treasury.spentThisMonth;
  const budgetUsage = (treasury.spentThisMonth / treasury.monthlyBudget) * 100;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Data Loading Indicator */}
      {loading && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse" />
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-red-900/30 border border-red-500 rounded-lg p-3 m-4 flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <span className="text-red-200">Error fetching treasury data. Using cached data.</span>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              🔐 Treasury Operations
            </h1>
            <div className="text-right">
              <p className="text-slate-400 text-sm">Total Assets</p>
              <p className="text-3xl font-bold text-green-400">
                ${(treasury.totalAssets / 1000000).toFixed(1)}M
              </p>
              {lastUpdated && (
                <p className="text-xs text-slate-500 mt-1">
                  Updated {new Date(lastUpdated).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-t border-slate-700 pt-4">
            {(['portfolio', 'budget', 'governance', 'transfers'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={`px-4 py-2 rounded transition-colors ${
                  selectedTab === tab
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                {tab === 'portfolio' && '🏦 Portfolio'}
                {tab === 'budget' && '💰 Budget'}
                {tab === 'governance' && '🗳️ Governance'}
                {tab === 'transfers' && '📤 Transfers'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {selectedTab === 'portfolio' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Holdings */}
            <div className="lg:col-span-2">
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 mb-6">
                <h2 className="text-xl font-bold mb-6">Token Holdings</h2>

                {/* Allocation Chart */}
                <div className="mb-8">
                  <div className="flex gap-2 h-8 rounded-full overflow-hidden border border-slate-700">
                    {treasury.tokenHoldings.map((holding) => (
                      <div
                        key={holding.symbol}
                        className={`flex items-center justify-center text-xs font-bold text-white ${
                          holding.symbol === 'ETH'
                            ? 'bg-blue-600'
                            : holding.symbol === 'USDC'
                            ? 'bg-green-600'
                            : 'bg-purple-600'
                        }`}
                        style={{ width: `${holding.allocation}%` }}
                      >
                        {holding.symbol}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Holdings Table */}
                <div className="space-y-3">
                  {treasury.tokenHoldings.map((holding) => (
                    <div
                      key={holding.symbol}
                      className="bg-slate-700/50 rounded p-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-lg">{holding.symbol}</p>
                        <p className="text-sm text-slate-400">
                          {holding.amount.toLocaleString()} tokens
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-green-400">
                          ${(holding.value / 1000000).toFixed(2)}M
                        </p>
                        <p className="text-sm text-slate-400">{holding.allocation.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rebalancing Recommendations */}
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-400" />
                  Rebalancing Suggestions
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="text-slate-300">
                    ✓ ETH allocation is healthy at 75.8%
                  </p>
                  <p className="text-yellow-400">
                    ⚠ USDC is underallocated - consider increasing stablecoin buffer to 25%
                  </p>
                  <p className="text-slate-300">
                    ✓ DAO token position supports governance weight
                  </p>
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="space-y-4">
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                <p className="text-slate-400 text-sm">Governance Weight</p>
                <p className="text-2xl font-bold text-purple-400 mt-2">
                  {treasury.governanceWeight.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  Voting power in DAO
                </p>
              </div>

              <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                <p className="text-slate-400 text-sm">Market Value</p>
                <p className="text-2xl font-bold text-green-400 mt-2">
                  ${(treasury.totalAssets / 1000000).toFixed(1)}M
                </p>
                <p className="text-xs text-green-400 mt-2">
                  ↑ 12.5% vs last quarter
                </p>
              </div>

              <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                <p className="text-slate-400 text-sm">Diversification Score</p>
                <div className="text-2xl font-bold text-blue-400 mt-2">8.2/10</div>
                <p className="text-xs text-slate-400 mt-2">
                  Well-balanced across assets
                </p>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'budget' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                <h2 className="text-xl font-bold mb-6">Monthly Budget</h2>

                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-semibold">Spent this month</span>
                    <span className="text-sm font-mono text-slate-300">
                      ${treasury.spentThisMonth.toLocaleString()} / ${treasury.monthlyBudget.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        budgetUsage > 90 ? 'bg-red-500' : budgetUsage > 70 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(budgetUsage, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-2">{budgetUsage.toFixed(0)}% used</p>
                </div>

                {/* Remaining Budget */}
                <div className="bg-slate-700/50 rounded p-4 mb-6">
                  <p className="text-slate-400 text-sm">Available Budget</p>
                  <p className="text-2xl font-bold text-green-400">
                    ${budgetRemaining.toLocaleString()}
                  </p>
                </div>

                {/* Recent Expenses */}
                <h3 className="text-lg font-bold mb-4">Recent Expenses</h3>
                <div className="space-y-2">
                  {[
                    { name: 'Developer Grants', amount: 125000, date: 'May 20' },
                    { name: 'Marketing Campaign', amount: 75000, date: 'May 18' },
                    { name: 'Infrastructure', amount: 50000, date: 'May 15' },
                    { name: 'Security Audit', amount: 37500, date: 'May 10' },
                  ].map((expense, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-700/50 rounded">
                      <div>
                        <p className="font-semibold text-sm">{expense.name}</p>
                        <p className="text-xs text-slate-400">{expense.date}</p>
                      </div>
                      <p className="font-bold text-orange-400">${expense.amount.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div>
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                <h3 className="font-bold mb-4">Budget Actions</h3>
                <div className="space-y-2">
                  <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-semibold text-sm transition-colors">
                    Propose New Budget
                  </button>
                  <button className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded font-semibold text-sm transition-colors">
                    View All Expenses
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'governance' && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h2 className="text-xl font-bold mb-6">🗳️ Governance Position</h2>
            
            {/* Health Status */}
            {health && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Treasury Health Score</span>
                  <span className={`text-2xl font-bold ${
                    health.score >= 80 ? 'text-green-400' :
                    health.score >= 60 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {health.score.toFixed(0)}/100
                  </span>
                </div>
                
                {health.alerts.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <p className="text-sm font-semibold text-slate-300">Alerts:</p>
                    {health.alerts.map((alert, idx) => (
                      <div 
                        key={idx}
                        className={`p-3 rounded text-sm ${
                          alert.severity === 'high' ? 'bg-red-900/30 text-red-200 border border-red-600' :
                          alert.severity === 'medium' ? 'bg-yellow-900/30 text-yellow-200 border border-yellow-600' :
                          'bg-blue-900/30 text-blue-200 border border-blue-600'
                        }`}
                      >
                        {alert.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <p className="text-slate-400">Governance voting power and proposal participation coming soon...</p>
          </div>
        )}

        {selectedTab === 'transfers' && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h2 className="text-xl font-bold mb-6">📤 Transfers</h2>
            <p className="text-slate-400">Treasury transfer interface coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
};
