/**
 * Vault List Page
 * 
 * Discover and browse available trading vaults
 */

import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, BarChart3, Lock, Eye, EyeOff } from 'lucide-react';
import * as yukiApi from '../../api/yukiApi';

interface VaultCard {
  vaultId: string;
  name: string;
  category: string;
  totalValue: number;
  depositorCount: number;
  dayReturn: number;
  monthReturn: number;
  yearReturn: number;
  status: 'active' | 'paused';
  description?: string;
}

export default function VaultListPage() {
  const [vaults, setVaults] = useState<VaultCard[]>([]);
  const [filter, setFilter] = useState<'all' | 'market-neutral' | 'yield' | 'momentum' | 'stablecoin'>('all');
  const [sortBy, setSortBy] = useState<'return' | 'aum' | 'risk'>('return');
  const [loading, setLoading] = useState(true);
  const [selectedVault, setSelectedVault] = useState<VaultCard | null>(null);

  useEffect(() => {
    const fetchVaults = async () => {
      try {
        // This would call our vault API
        const data = await fetch('/api/v1/wallets/vaults').then(r => r.json());
        setVaults(data.data || []);
      } catch (err) {
        console.error('Failed to fetch vaults:', err);
        // Use placeholder data
        setVaults([
          {
            vaultId: 'vault_1',
            name: 'Market Neutral Alpha',
            category: 'market-neutral',
            totalValue: 2_500_000,
            depositorCount: 142,
            dayReturn: 0.23,
            monthReturn: 2.14,
            yearReturn: 24.5,
            status: 'active',
            description: 'Equal-weight long/short positions. Positive returns in any market.',
          },
          {
            vaultId: 'vault_2',
            name: 'Yield Farming Max',
            category: 'yield',
            totalValue: 1_800_000,
            depositorCount: 98,
            dayReturn: 0.15,
            monthReturn: 3.42,
            yearReturn: 18.7,
            status: 'active',
            description: 'Rotates through highest-yielding DeFi opportunities.',
          },
          {
            vaultId: 'vault_3',
            name: 'Momentum Surge',
            category: 'momentum',
            totalValue: 950_000,
            depositorCount: 67,
            dayReturn: 0.45,
            monthReturn: 5.23,
            yearReturn: 42.3,
            status: 'active',
            description: 'Follows price trends with technical indicators.',
          },
          {
            vaultId: 'vault_4',
            name: 'Stablecoin Shield',
            category: 'stablecoin',
            totalValue: 3_200_000,
            depositorCount: 189,
            dayReturn: 0.01,
            monthReturn: 0.34,
            yearReturn: 4.2,
            status: 'active',
            description: 'Maintains stablecoin peg + modest yield farming.',
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchVaults();
  }, []);

  const filteredVaults = vaults
    .filter(v => filter === 'all' || v.category === filter)
    .sort((a, b) => {
      if (sortBy === 'return') return b.yearReturn - a.yearReturn;
      if (sortBy === 'aum') return b.totalValue - a.totalValue;
      if (sortBy === 'risk') return 0; // Would sort by drawdown in real app
      return 0;
    });

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <div>
          <h1 className="text-4xl font-bold mb-2">📈 Strategy Vaults</h1>
          <p className="text-slate-400">Deposit capital and earn passive returns. Vaults execute strategies automatically.</p>
        </div>

        {/* FILTERS */}
        <div className="flex flex-wrap gap-2 border-b border-slate-700 pb-4">
          {[
            { id: 'all', label: 'All Vaults' },
            { id: 'market-neutral', label: '⚖️ Market-Neutral' },
            { id: 'yield', label: '🌾 Yield Farming' },
            { id: 'momentum', label: '🚀 Momentum' },
            { id: 'stablecoin', label: '🛡️ Stablecoin' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-4 py-2 rounded transition-all ${
                filter === f.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}

          <div className="ml-auto flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 rounded bg-slate-800 text-white border border-slate-700"
            >
              <option value="return">Sort by Return</option>
              <option value="aum">Sort by Size</option>
              <option value="risk">Sort by Risk</option>
            </select>
          </div>
        </div>

        {/* VAULT GRID */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-slate-400">Loading vaults...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            {filteredVaults.map((vault) => (
              <div
                key={vault.vaultId}
                onClick={() => setSelectedVault(vault)}
                className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-blue-500 transition-all cursor-pointer hover:shadow-lg hover:shadow-blue-500/20"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold">{vault.name}</h3>
                    <p className="text-sm text-slate-400 mt-1">{vault.description}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded text-xs font-semibold ${
                      vault.status === 'active'
                        ? 'bg-green-600/20 text-green-300'
                        : 'bg-amber-600/20 text-amber-300'
                    }`}
                  >
                    {vault.status === 'active' ? '● Active' : '● Paused'}
                  </span>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-slate-700 rounded p-3">
                    <p className="text-xs text-slate-400">Total AUM</p>
                    <p className="text-lg font-bold mt-1">
                      ${(vault.totalValue / 1_000_000).toFixed(1)}M
                    </p>
                  </div>
                  <div className="bg-slate-700 rounded p-3">
                    <p className="text-xs text-slate-400">Depositors</p>
                    <p className="text-lg font-bold mt-1">{vault.depositorCount}</p>
                  </div>
                  <div className="bg-slate-700 rounded p-3">
                    <p className="text-xs text-slate-400">30-Day Return</p>
                    <p className={`text-lg font-bold mt-1 ${vault.monthReturn > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {vault.monthReturn > 0 ? '+' : ''}{vault.monthReturn.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Returns */}
                <div className="flex gap-4 text-sm mb-4 border-t border-slate-700 pt-4">
                  <div>
                    <span className="text-slate-400">1D:</span>
                    <span className={`ml-2 font-semibold ${vault.dayReturn > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {vault.dayReturn > 0 ? '+' : ''}{vault.dayReturn.toFixed(3)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">1M:</span>
                    <span className={`ml-2 font-semibold ${vault.monthReturn > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {vault.monthReturn > 0 ? '+' : ''}{vault.monthReturn.toFixed(2)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">1Y:</span>
                    <span className={`ml-2 font-semibold ${vault.yearReturn > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {vault.yearReturn > 0 ? '+' : ''}{vault.yearReturn.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Action Button */}
                <button className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-semibold transition-colors">
                  Deposit & Invest
                </button>
              </div>
            ))}
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && filteredVaults.length === 0 && (
          <div className="text-center py-12 bg-slate-800 rounded-lg border border-slate-700">
            <p className="text-slate-400">No vaults match your filters</p>
          </div>
        )}
      </div>

      {/* Modal: Deposit to Vault */}
      {selectedVault && (
        <DepositModal vault={selectedVault} onClose={() => setSelectedVault(null)} />
      )}
    </div>
  );
}

// ============================================================================
// DEPOSIT MODAL
// ============================================================================

interface DepositModalProps {
  vault: VaultCard;
  onClose: () => void;
}

function DepositModal({ vault, onClose }: DepositModalProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [sharePrice, setSharePrice] = useState(1.0);

  const shares = amount ? (parseFloat(amount) / sharePrice).toFixed(4) : '0';

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    setLoading(true);
    try {
      // Call vault API
      const response = await fetch(`/api/vaults/${vault.vaultId}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ amount: parseFloat(amount) }),
      });

      if (response.ok) {
        alert(`✅ Deposit successful! You received ${shares} shares.`);
        onClose();
      } else {
        alert('❌ Deposit failed');
      }
    } catch (err) {
      console.error('Deposit error:', err);
      alert('❌ Deposit error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 max-w-md w-full space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">{vault.name}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        <div className="bg-slate-700 rounded p-4">
          <p className="text-slate-400 text-sm">1-Year Return</p>
          <p className="text-3xl font-bold text-green-400 mt-2">+{vault.yearReturn.toFixed(1)}%</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-400">Deposit Amount (USDC)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white placeholder-slate-500"
          />
        </div>

        <div className="bg-slate-700 rounded p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Share Price:</span>
            <span className="text-white font-semibold">${sharePrice.toFixed(4)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Shares to Receive:</span>
            <span className="text-white font-semibold">{shares}</span>
          </div>
        </div>

        <button
          onClick={handleDeposit}
          disabled={!amount || parseFloat(amount) <= 0 || loading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-3 rounded font-semibold transition-colors"
        >
          {loading ? 'Processing...' : 'Deposit & Invest'}
        </button>

        <p className="text-xs text-slate-500 text-center">
          Your deposit will start earning returns immediately
        </p>
      </div>
    </div>
  );
}
