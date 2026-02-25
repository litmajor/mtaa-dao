import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

type BalanceSource = {
  source: 'okedi' | 'exchange' | 'bank' | 'custodial' | 'subprofile' | 'dao' | 'escrow';
  custodyType: 'non-custodial' | 'custodial' | 'linked';
  amount: number;
  currency: string;
  label: string;
  description?: string;  // e.g., "Amara Subprofile", "OKEDI DAO Treasury"
  parentLabel?: string;  // e.g., "Primary Wallet (Okedi)", "My DAOs"
  updatedAt: string;
  status?: 'verified' | 'pending' | 'error';
  icon?: string;  // optional override icon
};

type Props = {
  totalBalance: number;
  currency: string;
  balances?: BalanceSource[];
};

const sourceIcons: Record<string, string> = {
  okedi: '🏦',
  exchange: '📊',
  bank: '🏧',
  custodial: '🔐',
  subprofile: '👤',
  dao: '🏛️',
  escrow: '🔒',
};

const custodyColors: Record<string, string> = {
  'non-custodial': 'bg-green-600/20 text-green-300 border-green-600/30',
  'custodial': 'bg-amber-600/20 text-amber-300 border-amber-600/30',
  'linked': 'bg-blue-600/20 text-blue-300 border-blue-600/30',
};

// Group balances by parent (Okedi, My DAOs, Linked Accounts, etc.)
const groupBalances = (balances: BalanceSource[]) => {
  const groups: Record<string, BalanceSource[]> = {};
  balances.forEach((b) => {
    const parent = b.parentLabel || 'Other';
    if (!groups[parent]) groups[parent] = [];
    groups[parent].push(b);
  });
  return groups;
};

const groupOrder = ['Primary Wallet (Okedi)', 'My Subprofiles', 'My DAOs', 'Linked Accounts', 'Escrow Holds', 'Other'];

export default function UnifiedBalance({ totalBalance, currency, balances = [] }: Props) {
  const [expanded, setExpanded] = useState(false);

  const formattedTotal = useMemo(() => {
    return totalBalance.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [totalBalance]);

  const groupedBalances = useMemo(() => {
    const groups = groupBalances(balances);
    return groupOrder.filter((key) => groups[key]).map((key) => ({
      key,
      balances: groups[key],
      total: groups[key].reduce((sum, b) => sum + b.amount, 0),
    }));
  }, [balances]);

  const allNonCustodial = useMemo(
    () => balances.every((b) => b.custodyType === 'non-custodial'),
    [balances]
  );

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 md:p-8 text-white shadow-lg">
      {/* UNIFIED BALANCE HEADER */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          <p className="text-blue-100 text-sm mb-2">💼 Unified Balance</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-4xl md:text-5xl font-bold">${formattedTotal}</h2>
            <span className="text-blue-100">{currency}</span>
          </div>
          <p className="text-blue-100 text-xs mt-2">
            {balances.length} {balances.length === 1 ? 'account' : 'accounts'} • 
            {allNonCustodial 
              ? ' All self-custody (you hold keys)' 
              : ` ${balances.filter(b => b.custodyType === 'non-custodial').length} self-custody`}
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-shrink-0 p-2 hover:bg-blue-700/50 rounded-lg transition-colors"
          aria-label="Toggle balance details"
        >
          {expanded ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* EXPANDABLE BREAKDOWN */}
      {expanded && balances.length > 0 && (
        <div className="border-t border-blue-500/30 pt-4 space-y-4">
          {groupedBalances.map((group) => (
            <div key={group.key} className="space-y-2">
              <div className="flex items-center justify-between px-1 mb-2">
                <h4 className="text-sm font-semibold text-blue-100">{group.key}</h4>
                <span className="text-xs text-blue-200">
                  ${group.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              {group.balances.map((balance) => (
                <div
                  key={`${balance.source}-${balance.label}-${balance.currency}`}
                  className="bg-blue-700/30 rounded-lg p-3 flex items-center justify-between hover:bg-blue-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-lg">{balance.icon || sourceIcons[balance.source] || '📌'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{balance.label}</p>
                      {balance.description && (
                        <p className="text-xs text-blue-200 truncate">{balance.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${
                            custodyColors[balance.custodyType] || custodyColors['linked']
                          }`}
                        >
                          {balance.custodyType === 'non-custodial' ? '🔓 You hold' : '🔐 ' + balance.custodyType}
                        </span>
                        {balance.status && (
                          <span className="text-xs text-slate-300">
                            {balance.status === 'verified' ? '✓' : balance.status === 'pending' ? '⏱' : '⚠'} {balance.status}
                          </span>
                        )}
                        <span className="text-xs text-blue-200 ml-auto">
                          {new Date(balance.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-sm font-semibold">
                      ${balance.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-blue-200">{balance.currency}</p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* QUICK INFO WHEN COLLAPSED */}
      {!expanded && balances.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-blue-100 flex-wrap">
          {groupedBalances.slice(0, 2).map((group) => (
            <span key={group.key} className="flex items-center gap-1">
              {group.balances[0]?.icon || sourceIcons[group.balances[0]?.source] || '📌'} 
              {group.key}: ${group.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          ))}
          {groupedBalances.length > 2 && <span>+ {groupedBalances.length - 2} more</span>}
        </div>
      )}
    </div>
  );
}
