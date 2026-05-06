/**
 * WalletDashboard — MtaaDAO
 * High-traffic wallet interface: perf-optimized, cyberpunk/amber aesthetic
 *
 * Perf patterns applied:
 * - React.lazy + Suspense → tab JS only loads when tab is first opened
 * - React.memo on BalanceCard → skips re-render unless account data changes
 * - useCallback on all handlers → stable refs across renders
 * - useMemo on derived values (netWorth display, account slices)
 * - staleTime tuned per-query → summary refreshes every 30s, methods cached 5m
 * - Parallel queries via useQueries → summary + methods fetched simultaneously
 * - Skeleton loader with shimmer → no layout shift on load
 * - ErrorBoundary per tab → one failing tab doesn't nuke the whole page
 * - CSS scanline + noise overlay via pseudo-elements → zero JS overhead
 */

import React, {
  useState,
  useCallback,
  useMemo,
  memo,
  lazy,
  Suspense,
  Component,
  type ReactNode,
} from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { authClient } from '@/utils/authClient';

// ─── Lazy-loaded tab bundles ───────────────────────────────────────────────
const DepositTab         = lazy(() => import('./tabs/DepositTab'));
const WithdrawTab        = lazy(() => import('./tabs/WithdrawTab'));
const TransactionsTab    = lazy(() => import('./tabs/TransactionsTab'));
const MicroWithdrawalsTab = lazy(() => import('./tabs/MicroWithdrawalsTab'));
const AccountManagementTab = lazy(() => import('./tabs/AccountManagementTab'));

// ─── Types ─────────────────────────────────────────────────────────────────
export interface WalletAccount {
  id: string;
  userId: string;
  accountType: 'wallet' | 'trading' | 'vault' | 'escrow';
  balance: string;
  currency: string;
  status: string;
  createdAt: string;
}

interface WalletSummary {
  totalAccounts: number;
  accounts: WalletAccount[];
  netWorth: string;
}

interface DepositMethod {
  id: string;
  name: string;
  provider: string;
  type: 'offramp' | 'external_wallet';
  supportedCurrencies: string[];
  minAmount: string;
  maxAmount: string;
  fee: string;
}

interface WithdrawalMethod {
  id: string;
  name: string;
  provider: string;
  type: string;
  destination: string;
  minAmount: string;
  maxAmount: string;
  fee: string;
}

type Tab = 'overview' | 'deposit' | 'withdraw' | 'transactions' | 'micro-withdrawals' | 'accounts';

// ─── Fetch helpers (using authClient for secure cookie-based auth) ────────
async function fetchSummary(): Promise<WalletSummary> {
  return authClient.get<WalletSummary>('/api/accounts/summary');
}

async function fetchDepositMethods(): Promise<DepositMethod[]> {
  return authClient.get<DepositMethod[]>('/api/v1/wallets/deposits/methods');
}

async function fetchWithdrawalMethods(): Promise<WithdrawalMethod[]> {
  return authClient.get<WithdrawalMethod[]>('/api/v1/wallets/withdrawals/methods');
}

// ─── Error boundary ────────────────────────────────────────────────────────
interface EBState { hasError: boolean; message: string }
class TabErrorBoundary extends Component<{ children: ReactNode; label: string }, EBState> {
  state: EBState = { hasError: false, message: '' };
  static getDerivedStateFromError(e: Error): EBState {
    return { hasError: true, message: e.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="wallet-tab-error">
          <span className="wallet-error-label">// TAB_ERROR</span>
          <p>{this.state.message}</p>
          <button onClick={() => this.setState({ hasError: false, message: '' })}>
            RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Account type config ───────────────────────────────────────────────────
const ACCOUNT_META: Record<WalletAccount['accountType'], { label: string; color: string; glyph: string }> = {
  wallet:  { label: 'WALLET',  color: '#f59e0b', glyph: '◈' },
  trading: { label: 'TRADING', color: '#10b981', glyph: '⬡' },
  vault:   { label: 'VAULT',   color: '#a78bfa', glyph: '⬢' },
  escrow:  { label: 'ESCROW',  color: '#fb923c', glyph: '◇' },
};

// ─── BalanceCard (memoized — only re-renders when account data changes) ─────
const BalanceCard = memo(function BalanceCard({ account }: { account: WalletAccount }) {
  const meta = ACCOUNT_META[account.accountType];
  const formatted = useMemo(
    () => parseFloat(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2 }),
    [account.balance],
  );

  return (
    <div className="wallet-balance-card" style={{ '--card-accent': meta.color } as React.CSSProperties} suppressHydrationWarning>
      <div className="wallet-card-header">
        <span className="wallet-card-glyph">{meta.glyph}</span>
        <span className="wallet-card-label">{meta.label}</span>
        <span className={`wallet-card-status ${account.status === 'active' ? 'active' : 'inactive'}`}>
          {account.status.toUpperCase()}
        </span>
      </div>
      <div className="wallet-card-balance">
        <span className="wallet-balance-currency">{account.currency}</span>
        <span className="wallet-balance-amount">{formatted}</span>
      </div>
      <div className="wallet-card-scanline" />
    </div>
  );
});

// ─── NetWorthCard ──────────────────────────────────────────────────────────
const NetWorthCard = memo(function NetWorthCard({ netWorth }: { netWorth: string }) {
  const formatted = useMemo(
    () => parseFloat(netWorth).toLocaleString('en-US', { minimumFractionDigits: 2 }),
    [netWorth],
  );
  return (
    <div className="wallet-balance-card wallet-networth-card">
      <div className="wallet-card-header">
        <span className="wallet-card-glyph">⬡</span>
        <span className="wallet-card-label">NET WORTH</span>
      </div>
      <div className="wallet-card-balance">
        <span className="wallet-balance-currency">USD</span>
        <span className="wallet-balance-amount">{formatted}</span>
      </div>
      <div className="wallet-card-scanline" />
    </div>
  );
});

// ─── Skeleton ──────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="wallet-balance-card wallet-skeleton">
      <div className="skel skel-label" />
      <div className="skel skel-amount" />
    </div>
  );
}

// ─── Tab suspend fallback ──────────────────────────────────────────────────
function TabSuspenseFallback() {
  return (
    <div className="wallet-tab-loading">
      <div className="wallet-spinner" />
      <span>LOADING MODULE…</span>
    </div>
  );
}

// ─── Overview tab (inline, not lazy — it's the default landing) ────────────
function OverviewTab({
  accounts,
  onNavigate,
}: {
  accounts: WalletAccount[];
  onNavigate: (tab: Tab) => void;
}) {
  return (
    <div className="wallet-overview">
      <div className="wallet-overview-grid">
        <div className="wallet-panel">
          <div className="wallet-panel-title">// ACCOUNTS</div>
          <div className="wallet-account-list">
            {accounts.map((acc) => {
              const meta = ACCOUNT_META[acc.accountType];
              const bal = parseFloat(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2 });
              return (
                <div key={acc.id} className="wallet-account-row" style={{ '--row-accent': meta.color } as React.CSSProperties} suppressHydrationWarning>
                  <span className="wallet-row-glyph">{meta.glyph}</span>
                  <span className="wallet-row-type">{meta.label}</span>
                  <span className="wallet-row-balance">{bal} {acc.currency}</span>
                  <span className={`wallet-row-dot ${acc.status === 'active' ? 'dot-active' : 'dot-inactive'}`} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="wallet-panel">
          <div className="wallet-panel-title">// QUICK_ACTIONS</div>
          <div className="wallet-actions">
            <button className="wallet-action-btn btn-deposit" onClick={() => onNavigate('deposit')}>
              <span className="btn-glyph">↓</span> DEPOSIT
            </button>
            <button className="wallet-action-btn btn-withdraw" onClick={() => onNavigate('withdraw')}>
              <span className="btn-glyph">↑</span> WITHDRAW
            </button>
            <button className="wallet-action-btn btn-transfer" onClick={() => onNavigate('accounts')}>
              <span className="btn-glyph">⇄</span> TRANSFER
            </button>
            <button className="wallet-action-btn btn-history" onClick={() => onNavigate('transactions')}>
              <span className="btn-glyph">≡</span> HISTORY
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab config ────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; glyph: string }[] = [
  { id: 'overview',          label: 'OVERVIEW',  glyph: '◈' },
  { id: 'deposit',           label: 'DEPOSIT',   glyph: '↓' },
  { id: 'withdraw',          label: 'WITHDRAW',  glyph: '↑' },
  { id: 'transactions',      label: 'HISTORY',   glyph: '≡' },
  { id: 'micro-withdrawals', label: 'MICRO',     glyph: '∿' },
  { id: 'accounts',          label: 'ACCOUNTS',  glyph: '⬡' },
];

// ─── Main component ─────────────────────────────────────────────────────────
export default function WalletDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const handleTabChange = useCallback((tab: Tab) => setActiveTab(tab), []);

  // Fetch wallet summary
  const summaryQ = useQuery<WalletSummary>({
    queryKey: ['walletSummary'],
    queryFn: fetchSummary,
    staleTime: 30_000,
    gcTime: 60_000,
  });

  // Fetch deposit methods
  const depositMethodsQ = useQuery<DepositMethod[]>({
    queryKey: ['depositMethods'],
    queryFn: fetchDepositMethods,
    staleTime: 300_000,
    gcTime: 600_000,
  });

  // Fetch withdrawal methods
  const withdrawalMethodsQ = useQuery<WithdrawalMethod[]>({
    queryKey: ['withdrawalMethods'],
    queryFn: fetchWithdrawalMethods,
    staleTime: 300_000,
    gcTime: 600_000,
  });
  const walletSummary    = summaryQ.data as WalletSummary | undefined;
  const depositMethods   = depositMethodsQ.data as DepositMethod[] | undefined;
  const withdrawalMethods = withdrawalMethodsQ.data as WithdrawalMethod[] | undefined;

  // Memoized account slices — avoids re-filtering on unrelated renders
  const accountsByType = useMemo(() => {
    if (!walletSummary) return { wallet: [], trading: [], vault: [], escrow: [] };
    const groups = { wallet: [], trading: [], vault: [], escrow: [] } as Record<string, WalletAccount[]>;
    for (const acc of walletSummary.accounts) {
      groups[acc.accountType]?.push(acc);
    }
    return groups;
  }, [walletSummary]);

  const summaryLoading = summaryQ.isLoading;

  return (
    <>
      {/* ── Global styles injected once ── */}
      <style>{WALLET_CSS}</style>

      <div className="wallet-root">
        {/* Scanline overlay */}
        <div className="wallet-scanlines" aria-hidden />

        {/* Header */}
        <header className="wallet-header">
          <div className="wallet-header-inner">
            <div className="wallet-header-title">
              <span className="wallet-title-prefix">MTAA</span>
              <span className="wallet-title-main">WALLET</span>
              <span className="wallet-title-tag">v2.0</span>
            </div>
            <div className="wallet-header-meta">
              <span className="wallet-meta-item">
                <span className="wallet-meta-dot" />
                LIVE
              </span>
              {walletSummary && (
                <span className="wallet-meta-item">
                  {walletSummary.totalAccounts} ACCOUNTS
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Balance cards */}
        <section className="wallet-cards-row" aria-label="Account balances">
          {summaryLoading ? (
            Array.from({ length: 5 }, (_, i) => <CardSkeleton key={i} />)
          ) : walletSummary ? (
            <>
              {(Object.keys(accountsByType) as WalletAccount['accountType'][]).map((type) =>
                accountsByType[type].map((acc) => (
                  <BalanceCard key={acc.id} account={acc} />
                )),
              )}
              <NetWorthCard netWorth={walletSummary.netWorth} />
            </>
          ) : summaryQ.isError ? (
            <div className="wallet-fetch-error">
              ERR: {(summaryQ.error as Error).message}
            </div>
          ) : null}
        </section>

        {/* Tab nav */}
        <nav className="wallet-tab-nav" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              className={`wallet-tab-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => handleTabChange(t.id)}
            >
              <span className="tab-glyph">{t.glyph}</span>
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
          <div
            className="wallet-tab-indicator"
            style={{
              '--tab-offset': `${TABS.findIndex((t) => t.id === activeTab) * (100 / TABS.length)}%`,
              '--tab-width': `${100 / TABS.length}%`,
            } as React.CSSProperties}
            suppressHydrationWarning
          />
        </nav>

        {/* Tab content */}
        <main className="wallet-tab-content">
          <TabErrorBoundary label={activeTab}>
            {activeTab === 'overview' && walletSummary && (
              <OverviewTab accounts={walletSummary.accounts} onNavigate={handleTabChange} />
            )}

            <Suspense fallback={<TabSuspenseFallback />}>
              {activeTab === 'deposit' && depositMethods && (
                <DepositTab methods={depositMethods} accounts={walletSummary?.accounts ?? []} />
              )}
              {activeTab === 'withdraw' && withdrawalMethods && (
                <WithdrawTab methods={withdrawalMethods} accounts={walletSummary?.accounts ?? []} />
              )}
              {activeTab === 'transactions' && <TransactionsTab />}
              {activeTab === 'micro-withdrawals' && <MicroWithdrawalsTab />}
              {activeTab === 'accounts' && walletSummary && (
                <AccountManagementTab accounts={walletSummary.accounts} />
              )}
            </Suspense>
          </TabErrorBoundary>
        </main>
      </div>
    </>
  );
}

// ─── CSS ────────────────────────────────────────────────────────────────────
const WALLET_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');

  :root {
    --amber:       #f59e0b;
    --amber-dim:   #92400e;
    --amber-glow:  rgba(245, 158, 11, 0.15);
    --amber-faint: rgba(245, 158, 11, 0.06);
    --bg-root:     #080a0c;
    --bg-panel:    #0d1014;
    --bg-card:     #111519;
    --bg-hover:    #161c22;
    --border:      rgba(245, 158, 11, 0.18);
    --border-dim:  rgba(245, 158, 11, 0.08);
    --text-primary:   #f0e6cc;
    --text-secondary: #7a6a4f;
    --text-dim:       #3d3328;
    --green:  #10b981;
    --purple: #a78bfa;
    --orange: #fb923c;
    --red:    #f87171;
    --mono:   'IBM Plex Mono', monospace;
    --display: 'Syne', sans-serif;
  }

  /* ── Root ── */
  .wallet-root {
    position: relative;
    min-height: 100vh;
    background: var(--bg-root);
    font-family: var(--mono);
    color: var(--text-primary);
    overflow-x: hidden;
  }

  /* ── Scanlines overlay ── */
  .wallet-scanlines {
    pointer-events: none;
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: repeating-linear-gradient(
      to bottom,
      transparent,
      transparent 2px,
      rgba(0,0,0,0.08) 2px,
      rgba(0,0,0,0.08) 4px
    );
  }

  /* ── Header ── */
  .wallet-header {
    border-bottom: 1px solid var(--border);
    background: linear-gradient(180deg, #0a0d10 0%, transparent 100%);
    padding: 20px 32px;
  }
  .wallet-header-inner {
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .wallet-header-title {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .wallet-title-prefix {
    font-family: var(--display);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.3em;
    color: var(--amber-dim);
  }
  .wallet-title-main {
    font-family: var(--display);
    font-size: 26px;
    font-weight: 800;
    color: var(--amber);
    letter-spacing: 0.08em;
    text-shadow: 0 0 24px rgba(245,158,11,0.4);
  }
  .wallet-title-tag {
    font-size: 10px;
    color: var(--text-secondary);
    letter-spacing: 0.15em;
    padding: 2px 6px;
    border: 1px solid var(--border-dim);
  }
  .wallet-header-meta {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .wallet-meta-item {
    font-size: 11px;
    letter-spacing: 0.12em;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .wallet-meta-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 8px var(--green);
    animation: pulse-dot 2s ease-in-out infinite;
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* ── Balance cards row ── */
  .wallet-cards-row {
    max-width: 1400px;
    margin: 28px auto;
    padding: 0 32px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  /* ── Individual balance card ── */
  .wallet-balance-card {
    position: relative;
    background: var(--bg-card);
    border: 1px solid var(--border-dim);
    padding: 18px 20px;
    overflow: hidden;
    transition: border-color 0.2s, box-shadow 0.2s;
    cursor: default;
  }
  .wallet-balance-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: var(--card-accent, var(--amber));
    opacity: 0.7;
  }
  .wallet-balance-card:hover {
    border-color: var(--border);
    box-shadow: 0 0 20px var(--amber-faint);
  }
  .wallet-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
  }
  .wallet-card-glyph {
    font-size: 16px;
    color: var(--card-accent, var(--amber));
    line-height: 1;
  }
  .wallet-card-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.2em;
    color: var(--text-secondary);
    flex: 1;
  }
  .wallet-card-status {
    font-size: 8px;
    letter-spacing: 0.15em;
    padding: 2px 5px;
    border: 1px solid currentColor;
  }
  .wallet-card-status.active   { color: var(--green); }
  .wallet-card-status.inactive { color: var(--red); }
  .wallet-card-balance {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .wallet-balance-currency {
    font-size: 9px;
    letter-spacing: 0.2em;
    color: var(--text-secondary);
  }
  .wallet-balance-amount {
    font-size: 20px;
    font-weight: 500;
    color: var(--text-primary);
    letter-spacing: 0.02em;
    line-height: 1.1;
  }
  .wallet-card-scanline {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      180deg,
      transparent,
      transparent 3px,
      rgba(0,0,0,0.04) 3px,
      rgba(0,0,0,0.04) 4px
    );
    pointer-events: none;
  }

  /* Net worth card */
  .wallet-networth-card {
    --card-accent: #22d3ee;
    border-color: rgba(34,211,238,0.2);
  }
  .wallet-networth-card .wallet-balance-amount {
    font-size: 22px;
    color: #22d3ee;
    text-shadow: 0 0 18px rgba(34,211,238,0.35);
  }

  /* Skeleton */
  .wallet-skeleton {
    background: var(--bg-card);
    border-color: var(--border-dim);
  }
  .skel {
    border-radius: 2px;
    background: linear-gradient(90deg, #1a1f26 25%, #222933 50%, #1a1f26 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
  }
  .skel-label  { height: 10px; width: 60px; margin-bottom: 14px; }
  .skel-amount { height: 22px; width: 110px; }
  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* ── Tab nav ── */
  .wallet-tab-nav {
    position: relative;
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 32px;
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    border-bottom: 1px solid var(--border-dim);
    margin-bottom: 0;
  }
  .wallet-tab-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 13px 8px;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.15em;
    color: var(--text-secondary);
    transition: color 0.2s;
    z-index: 1;
  }
  .wallet-tab-btn:hover { color: var(--text-primary); }
  .wallet-tab-btn.active { color: var(--amber); }
  .tab-glyph { font-size: 13px; }
  .wallet-tab-indicator {
    position: absolute;
    bottom: -1px;
    left: var(--tab-offset);
    width: var(--tab-width);
    height: 2px;
    background: var(--amber);
    box-shadow: 0 0 12px rgba(245,158,11,0.6);
    transition: left 0.25s cubic-bezier(0.4,0,0.2,1);
  }

  /* ── Tab content panel ── */
  .wallet-tab-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 28px 32px;
  }

  /* ── Overview tab ── */
  .wallet-overview {}
  .wallet-overview-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .wallet-panel {
    background: var(--bg-panel);
    border: 1px solid var(--border-dim);
    padding: 24px;
  }
  .wallet-panel-title {
    font-size: 9px;
    letter-spacing: 0.25em;
    color: var(--amber-dim);
    margin-bottom: 20px;
    font-weight: 600;
  }
  .wallet-account-list { display: flex; flex-direction: column; gap: 8px; }
  .wallet-account-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: var(--bg-card);
    border: 1px solid var(--border-dim);
    transition: border-color 0.2s;
  }
  .wallet-account-row:hover { border-color: var(--border); }
  .wallet-row-glyph {
    font-size: 14px;
    color: var(--row-accent, var(--amber));
    flex-shrink: 0;
  }
  .wallet-row-type {
    font-size: 9px;
    letter-spacing: 0.18em;
    color: var(--text-secondary);
    flex: 1;
  }
  .wallet-row-balance {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
  }
  .wallet-row-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .dot-active   { background: var(--green); box-shadow: 0 0 6px var(--green); }
  .dot-inactive { background: var(--red); }

  /* Actions */
  .wallet-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .wallet-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 12px;
    background: var(--bg-card);
    border: 1px solid var(--border-dim);
    cursor: pointer;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.15em;
    color: var(--text-secondary);
    transition: all 0.18s;
  }
  .wallet-action-btn:hover { color: var(--text-primary); }
  .btn-glyph { font-size: 14px; }
  .btn-deposit:hover  { border-color: var(--amber); color: var(--amber);  box-shadow: inset 0 0 20px var(--amber-faint); }
  .btn-withdraw:hover { border-color: var(--green);  color: var(--green);  box-shadow: inset 0 0 20px rgba(16,185,129,0.08); }
  .btn-transfer:hover { border-color: var(--purple); color: var(--purple); box-shadow: inset 0 0 20px rgba(167,139,250,0.08); }
  .btn-history:hover  { border-color: #22d3ee;       color: #22d3ee;       box-shadow: inset 0 0 20px rgba(34,211,238,0.08); }

  /* ── Error / loading states ── */
  .wallet-tab-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 64px;
    color: var(--text-secondary);
    font-size: 11px;
    letter-spacing: 0.2em;
  }
  .wallet-spinner {
    width: 28px; height: 28px;
    border: 2px solid var(--border-dim);
    border-top-color: var(--amber);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .wallet-tab-error {
    padding: 32px;
    border: 1px solid rgba(248,113,113,0.3);
    background: rgba(248,113,113,0.05);
  }
  .wallet-error-label {
    display: block;
    font-size: 9px;
    letter-spacing: 0.2em;
    color: var(--red);
    margin-bottom: 10px;
  }
  .wallet-tab-error p {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 16px;
  }
  .wallet-tab-error button {
    padding: 8px 20px;
    background: none;
    border: 1px solid var(--red);
    color: var(--red);
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.18em;
    cursor: pointer;
    transition: background 0.2s;
  }
  .wallet-tab-error button:hover { background: rgba(248,113,113,0.1); }

  .wallet-fetch-error {
    grid-column: 1 / -1;
    font-size: 11px;
    color: var(--red);
    letter-spacing: 0.1em;
    padding: 16px;
    border: 1px solid rgba(248,113,113,0.25);
  }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .wallet-header        { padding: 16px 20px; }
    .wallet-cards-row     { padding: 0 20px; grid-template-columns: repeat(2, 1fr); }
    .wallet-tab-nav       { padding: 0 20px; grid-template-columns: repeat(3, 1fr); }
    .wallet-tab-content   { padding: 20px; }
    .wallet-overview-grid { grid-template-columns: 1fr; }
    .tab-label            { display: none; }
    .wallet-tab-btn       { padding: 13px 4px; }
    .wallet-tab-indicator { display: none; }
  }
  @media (max-width: 600px) {
    .wallet-cards-row { grid-template-columns: 1fr 1fr; gap: 8px; padding: 0 16px; }
    .wallet-balance-amount { font-size: 16px; }
  }
`;