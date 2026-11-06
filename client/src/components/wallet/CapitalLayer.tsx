import React from 'react';
import './capital-layer.css';
import Decimal from 'decimal.js';
import { parseDecimal } from '../../stores/wallet-operating-store';

interface Vault {
  id: string;
  name?: string;
  currency?: string;
  type?: string;
  balance?: string | number;
  apy?: number;
  monthlyYield?: number;
  lockDays?: number;
}

interface Tx {
  id: string;
  type: 'in' | 'out' | 'swap' | 'other';
  label?: string;
  time?: string | number;
  amount: number;
  currency?: string;
}

interface Props {
  address?: string;
  currency?: string;
  total?: string | number | Decimal;
  liquidity?: string | number | Decimal;
  deployed?: string | number | Decimal;
  pending?: string | number | Decimal;
  pendingCount?: number;
  availableVaults?: Vault[];
  deployedVaults?: Vault[];
  recentTxs?: Tx[];
  netFlow30d?: string | number | Decimal;
  hasNetFlowData?: boolean;
  onSend?: () => void;
  onAddFunds?: () => void;
  onSwap?: () => void;
  onViewAll?: () => void;
}

const VAULT_COLORS = [
  { bg: '#dcfce7', bar: '#22c55e', icon: '💵' },
  { bg: '#fef3c7', bar: '#f59e0b', icon: '🪙' },
  { bg: '#ede9fe', bar: '#7c3aed', icon: '💶' },
  { bg: '#dbeafe', bar: '#3b82f6', icon: '💠' },
];

// styles moved to ./capital-layer.css

const MetricCard: React.FC<{ label: string; value: string; sub?: string; valueColor?: string }> = ({ label, value, sub, valueColor }) => (
  <div className="metric-card">
    <div className="metric-label">{label}</div>
    <div className="metric-value" style={{ color: valueColor || 'inherit' }}>{value}</div>
    {sub && <div className="metric-sub">{sub}</div>}
  </div>
);

const VaultBar: React.FC<{ pct: number; color: string }> = ({ pct, color }) => (
  <div className="vault-bar-outer">
    <div className="vault-bar-inner" style={{ width: `${pct}%`, background: color }} />
  </div>
);

const TxDot: React.FC<{ type: Tx['type'] }> = ({ type }) => {
  const cls = type === 'in' ? 'tx-dot in' : type === 'out' ? 'tx-dot out' : 'tx-dot other';
  return (
    <div className={cls}>
      {type === 'in' ? '↙' : type === 'swap' ? '⇄' : '↗'}
    </div>
  );
};

const ActionBtn: React.FC<{ icon: React.ReactNode; label: string; onClick?: () => void }> = ({ icon, label, onClick }) => (
  <button onClick={onClick} className="action-btn">
    <span style={{ fontSize: 18 }}>{icon}</span>
    <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{label}</span>
  </button>
);

const LiquidityPanel: React.FC<{ vaults?: Vault[] }> = ({ vaults = [] }) => {
  const total = vaults.reduce((sum, vault) => sum.plus(vault.balance ?? 0), new Decimal(0));
  return (
    <div className="panel">
      <div className="surface-title">Liquidity</div>

      {vaults.length === 0 && <div style={{ fontSize: 13, color: '#9ca3af', padding: '12px 0' }}>No liquid vaults.</div>}

      {vaults.map((v, i) => (
        <div key={v.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: VAULT_COLORS[i % VAULT_COLORS.length].bg }}>
              <span style={{ fontSize: 14 }}>{VAULT_COLORS[i % VAULT_COLORS.length].icon}</span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{v.name || v.currency}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{v.type} · {v.currency}</div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{v.balance} {v.currency}</div>
            </div>
          </div>
          <VaultBar pct={total.gt(0) ? Math.min(100, parseDecimal(v.balance).dividedBy(total).times(100).toNumber()) : 0} color={VAULT_COLORS[i % VAULT_COLORS.length].bar} />
          {i < vaults.length - 1 && <div style={{ height: 8 }} />}
        </div>
      ))}
    </div>
  );
};

const DeployedPanel: React.FC<{ vaults?: Vault[]; currency?: string }> = ({ vaults = [], currency = 'CELO' }) => (
  <div className="panel">
    <div className="surface-title">Deployed capital</div>
    {vaults.length === 0 && <div style={{ fontSize: 13, color: '#9ca3af', padding: '12px 0' }}>No deployed positions.</div>}
    {vaults.map((v) => (
      <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#dbeafe' }}>
          <span style={{ fontSize: 14 }}>📈</span>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{v.name}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{v.type}{v.apy ? ` · ${v.apy}% APY` : ''}</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{v.balance ?? '0'} {v.currency || currency}</div>
          {v.monthlyYield != null && <div style={{ fontSize: 11, color: '#16a34a' }}>+{v.monthlyYield.toFixed(4)} {v.currency || currency}/mo</div>}
          {v.lockDays != null && <div style={{ fontSize: 11, color: '#9ca3af' }}>locked {v.lockDays}d</div>}
        </div>
      </div>
    ))}
  </div>
);

const HealthPanel: React.FC<{ netFlow30d?: string | number | Decimal; currency?: string; hasNetFlowData?: boolean }> = ({ netFlow30d = 0, currency = 'CELO', hasNetFlowData = false }) => {
  const netFlowDec = Decimal.isDecimal(netFlow30d) ? netFlow30d : new Decimal(netFlow30d);
  const flowPositive = netFlowDec.gte(0);

  return (
    <div className="panel">
      <div className="surface-title">Financial insights</div>
      {hasNetFlowData ? (
        <div className="netflow">
          <div className="health-micro">30-day net flow · CELO only</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: flowPositive ? '#16a34a' : '#dc2626' }}>
            {flowPositive ? '+' : '−'}{Math.abs(netFlowDec.toNumber()).toFixed(4)} {currency}
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: '#9ca3af' }}>Financial insights will appear when eligible transaction history is available.</p>
      )}
    </div>
  );
};

const RecentMovesPanel: React.FC<{ txs?: Tx[]; onViewAll?: () => void; currency?: string }> = ({ txs = [], onViewAll, currency = 'CELO' }) => (
  <div className="panel">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <span className="surface-title">Recent moves</span>
      <button onClick={onViewAll} style={{ fontSize: 12, color: '#6b7280', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>all →</button>
    </div>
    {txs.length === 0 && <div style={{ fontSize: 13, color: '#9ca3af', padding: '12px 0' }}>No recent transactions.</div>}
    {txs.slice(0, 4).map((tx) => (
      <div key={tx.id} className="recent-tx">
        <TxDot type={tx.type} />
        <div>
          <div style={{ fontSize: 13 }}>{tx.label}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{tx.time}</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 500, color: tx.type === 'in' ? '#16a34a' : tx.type === 'out' ? '#dc2626' : 'inherit' }}>
          {tx.type === 'in' ? '+' : tx.type === 'out' ? '−' : ''}{Math.abs(tx.amount).toFixed(4)} {tx.currency || currency}
        </div>
      </div>
    ))}
  </div>
);

const CapitalLayer: React.FC<Props> = ({
  address = '', currency = 'CELO', total = '0', liquidity = '0', deployed = '0', pending = '0', pendingCount = 0,
  availableVaults = [], deployedVaults = [], recentTxs = [], netFlow30d = 0, hasNetFlowData = false,
  onSend = () => {}, onAddFunds = () => {}, onSwap = () => {}, onViewAll = () => {},
}) => {
  const toDecimal = (value: string | number | Decimal) => Decimal.isDecimal(value) ? value : new Decimal(value);
  const totalDec = toDecimal(total || 0);
  const liquidityDec = toDecimal(liquidity || 0);
  const deployedDec = toDecimal(deployed || 0);
  const pendingDec = toDecimal(pending || 0);
  const liquidityPct = totalDec.gt(0) ? liquidityDec.dividedBy(totalDec).times(100).toFixed(1) : '0';

  return (
    <div className="capital-root">
      <div className="capital-top">
        <div className="capital-top-row">
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
          <span className="address-badge">{address ? `${address.slice(0,6)}…${address.slice(-4)}` : '0x—'}</span>
          <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>Celo Mainnet</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span className="total-amount">{totalDec.toFixed(4)}</span>
          <span className="total-sub">{currency}</span>
        </div>
        <div className="total-sub">Native wallet balance · token amounts are not converted to USD</div>

        <div className="metric-grid">
          <MetricCard label="Liquid" value={`${liquidityDec.toFixed(4)} ${currency}`} sub={`${liquidityPct}% available`} valueColor="#16a34a" />
          <MetricCard label="Deployed" value={`${deployedDec.toFixed(4)} ${currency}`} sub={`${deployedVaults.length} positions`} />
          <MetricCard label="Pending" value={`${pendingDec.toFixed(4)} ${currency}`} sub={`${pendingCount} transactions`} valueColor="#d97706" />
        </div>
      </div>

      <div className="action-row">
        <ActionBtn icon="+" label="Deposit" onClick={onAddFunds} />
        <ActionBtn icon="↗" label="Send" onClick={onSend} />
        <ActionBtn icon="⇄" label="Swap" onClick={onSwap} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <LiquidityPanel vaults={availableVaults} />
          <DeployedPanel vaults={deployedVaults} currency={currency} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <HealthPanel netFlow30d={netFlow30d} currency={currency} hasNetFlowData={hasNetFlowData} />
          <RecentMovesPanel txs={recentTxs} onViewAll={onViewAll} currency={currency} />
        </div>
      </div>
    </div>
  );
};

export default CapitalLayer;
