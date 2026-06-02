import React from 'react';
import './capital-layer.css';
import Decimal from 'decimal.js';

interface Vault {
  id: string;
  name?: string;
  currency?: string;
  type?: string;
  balance?: string | number;
  usdValue?: number;
  apy?: number;
  monthlyYield?: number;
  lockDays?: number;
}

interface Tx {
  id: string;
  type: 'in' | 'out' | 'swap';
  label?: string;
  time?: string | number;
  amount: number; // signed USD
}

interface Props {
  address?: string;
  total?: string | number | Decimal;
  liquidity?: string | number | Decimal;
  deployed?: string | number | Decimal;
  pending?: string | number | Decimal;
  pendingCount?: number;
  walletHealth?: number | { liquidity: string; diversification: string; exposure: string };
  availableVaults?: Vault[];
  deployedVaults?: Vault[];
  recentTxs?: Tx[];
  netFlow30d?: string | number | Decimal;
  flowBars?: number[];
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

const FlowBars: React.FC<{ values?: number[] }> = ({ values = [12, 8, 20, 15, 24, 18, 22] }) => {
  const max = Math.max(...values, 1);
  return (
    <div className="flowbars">
      {values.map((v, i) => (
        <span
          key={i}
          className="flowbar"
          style={{ height: Math.round((v / max) * 24), background: v > max * 0.6 ? '#22c55e' : '#d1d5db' }}
        />
      ))}
    </div>
  );
};

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
  const cls = type === 'in' ? 'tx-dot in' : 'tx-dot out';
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

const LiquidityPanel: React.FC<{ vaults?: Vault[]; flowBars?: number[] }> = ({ vaults = [], flowBars }) => {
  const total = vaults.reduce((s, v) => s + (v.usdValue || 0), 0) || 1;
  return (
    <div className="panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="surface-title">Liquidity</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FlowBars values={flowBars} />
          <span style={{ fontSize: 11, color: '#9ca3af' }}>7d</span>
        </div>
      </div>

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
              <div style={{ fontSize: 13, fontWeight: 500 }}>{v.balance}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>${(v.usdValue || 0).toLocaleString()}</div>
            </div>
          </div>
          <VaultBar pct={Math.round(((v.usdValue || 0) / total) * 100)} color={VAULT_COLORS[i % VAULT_COLORS.length].bar} />
          {i < vaults.length - 1 && <div style={{ height: 8 }} />}
        </div>
      ))}
    </div>
  );
};

const DeployedPanel: React.FC<{ vaults?: Vault[] }> = ({ vaults = [] }) => (
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
          <div style={{ fontSize: 13, fontWeight: 500 }}>${(v.usdValue || 0).toLocaleString()}</div>
          {v.monthlyYield != null && <div style={{ fontSize: 11, color: '#16a34a' }}>+${v.monthlyYield.toFixed(2)}/mo</div>}
          {v.lockDays != null && <div style={{ fontSize: 11, color: '#9ca3af' }}>locked {v.lockDays}d</div>}
        </div>
      </div>
    ))}
  </div>
);

const HealthPanel: React.FC<{ walletHealth?: number | { liquidity: string; diversification: string; exposure: string }; liquidity?: string | number | Decimal; deployed?: string | number | Decimal; pending?: string | number | Decimal; total?: string | number | Decimal; netFlow30d?: string | number | Decimal }> = ({ walletHealth = 0, liquidity = 0, deployed = 0, pending = 0, total = 0, netFlow30d = 0 }) => {
  const dec = (v: any) => new Decimal(v == null ? 0 : v)
  const totalDec = dec(total)
  const liquidityDec = dec(liquidity)
  const deployedDec = dec(deployed)
  const pendingDec = dec(pending)
  const netFlowDec = dec(netFlow30d)

  const liquidityPct = totalDec.gt(0) ? liquidityDec.dividedBy(totalDec).times(100).toFixed(1) : '—';
  const deployedPct  = totalDec.gt(0) ? deployedDec.dividedBy(totalDec).times(100).toFixed(1) : '—';
  const pendingPct   = totalDec.gt(0) ? pendingDec.dividedBy(totalDec).times(100).toFixed(1) : '—';
  const flowPositive = netFlowDec.gte(0);

  // walletHealth may be a numeric score or an object with qualitative fields
  const scoreFromObj = (w: any) => {
    if (typeof w === 'number') return Math.max(0, Math.min(100, Math.round(w)));
    const map = (k: string) => {
      if (!k) return 50
      const v = String(k).toUpperCase()
      if (v.includes('STRONG') || v.includes('GOOD') || v.includes('LOW')) return 80
      if (v.includes('MEDIUM') || v.includes('MED')) return 50
      return 30
    }
    const l = map(w?.liquidity)
    const d = map(w?.diversification)
    const e = map(w?.exposure)
    return Math.round((l + d + e) / 3)
  }
  const score = scoreFromObj(walletHealth)

  return (
    <div className="panel">
      <div className="surface-title">Financial health</div>
      <div className="health-grid">
        <div className="health-card">
          <div className="health-micro">Liquidity ratio</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: '#16a34a' }}>{liquidityPct}%</div>
        </div>
        <div className="health-card">
          <div className="health-micro">Deploy ratio</div>
          <div style={{ fontSize: 16, fontWeight: 500 }}>{deployedPct}%</div>
        </div>
        <div className="health-card">
          <div className="health-micro">Pending</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: '#d97706' }}>{pendingPct}%</div>
        </div>
        <div className="health-card">
          <div className="health-micro">Score</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: score > 70 ? '#16a34a' : '#d97706' }}>{score}/100</div>
        </div>
      </div>
      <div className="netflow">
        <div className="health-micro">30d net flow</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: flowPositive ? '#16a34a' : '#dc2626' }}>
          {flowPositive ? '+' : ''}${Math.abs(netFlowDec.toNumber()).toLocaleString()}
        </div>
      </div>
    </div>
  );
};

const RecentMovesPanel: React.FC<{ txs?: Tx[]; onViewAll?: () => void }> = ({ txs = [], onViewAll }) => (
  <div className="panel">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <span className="surface-title">Recent moves</span>
      <button onClick={onViewAll} style={{ fontSize: 12, color: '#6b7280', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>all →</button>
    </div>
    {txs.slice(0, 4).map((tx) => (
      <div key={tx.id} className="recent-tx">
        <TxDot type={tx.type} />
        <div>
          <div style={{ fontSize: 13 }}>{tx.label}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{tx.time}</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 500, color: tx.amount >= 0 ? '#16a34a' : '#dc2626' }}>
          {tx.amount >= 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
        </div>
      </div>
    ))}
  </div>
);

const CapitalLayer: React.FC<Props> = ({
  address = '', total = '0', liquidity = '0', deployed = '0', pending = '0', pendingCount = 0, walletHealth = 0,
  availableVaults = [], deployedVaults = [], recentTxs = [], netFlow30d = 0, flowBars = [12, 8, 20, 15, 24, 18, 22],
  onSend = () => {}, onAddFunds = () => {}, onSwap = () => {}, onViewAll = () => {},
}) => {
  const totalDec = new Decimal(total as any || 0);
  const liquidityDec = new Decimal(liquidity as any || 0);
  const deployedDec = new Decimal(deployed as any || 0);
  const pendingDec = new Decimal(pending as any || 0);
  const netFlowDec = new Decimal(netFlow30d as any || 0);

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
          <span className="total-amount">${totalDec.toNumber().toLocaleString()}</span>
          <span className="total-sub">USD</span>
        </div>
        <div className="total-sub">Total capital across all vaults</div>

        <div className="metric-grid">
          <MetricCard label="Liquid" value={`$${liquidityDec.toNumber().toLocaleString()}`} sub={`${liquidityPct}% available`} valueColor="#16a34a" />
          <MetricCard label="Deployed" value={`$${deployedDec.toNumber().toLocaleString()}`} sub={`${deployedVaults.length} positions`} />
          <MetricCard label="Pending" value={`$${pendingDec.toNumber().toLocaleString()}`} sub={`${pendingCount} transactions`} valueColor="#d97706" />
        </div>
      </div>

      <div className="action-row">
        <ActionBtn icon="+" label="Add funds" onClick={onAddFunds} />
        <ActionBtn icon="↗" label="Send" onClick={onSend} />
        <ActionBtn icon="⇄" label="Swap" onClick={onSwap} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <LiquidityPanel vaults={availableVaults} flowBars={flowBars} />
          <DeployedPanel vaults={deployedVaults} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <HealthPanel walletHealth={walletHealth} liquidity={liquidity} deployed={deployed} pending={pending} total={total} netFlow30d={netFlow30d} />
          <RecentMovesPanel txs={recentTxs} onViewAll={onViewAll} />
        </div>
      </div>
    </div>
  );
};

export default CapitalLayer;
