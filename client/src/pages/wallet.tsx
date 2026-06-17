import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Send, ArrowUpRight, ArrowDownLeft, Wallet, TrendingUp, Shield, DollarSign, Users, Settings } from 'lucide-react';


import { Line, Pie, Bar } from 'react-chartjs-2';
import Decimal from 'decimal.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement);

// Import new components for wallet features
const TransactionHistory = React.lazy(() => import('../components/wallet/TransactionHistory'));
const AccountSelector = React.lazy(() => import('../components/wallet/AccountSelector'));
import { apiGet, apiPost } from '@/lib/api';
const RecurringPayments = React.lazy(() => import('../components/wallet/RecurringPayments'));
const ExchangeRateWidget = React.lazy(() => import('../components/wallet/ExchangeRateWidget'));
const RecurringPaymentsManager = React.lazy(() => import('@/components/wallet/RecurringPaymentsManager'));
const GiftCardVoucher = React.lazy(() => import('@/components/wallet/GiftCardVoucher'));
import { useWallet } from './hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import Shell from '../components/ui/shell';
import { Grid } from '../components/ui/grid';
import PaymentRequestModal from '@/components/wallet/PaymentRequestModal';
import PhonePaymentModal from '@/components/wallet/PhonePaymentModal';
import SplitBillModal from '@/components/wallet/SplitBillModal';
import PaymentLinkModal from '@/components/wallet/PaymentLinkModal';
import BatchTransfer from '../components/batch-transfer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
const WalletConnectionManager = React.lazy(() => import('@/components/wallet/WalletConnectionManager'));
const WalletBackupReminder = React.lazy(() => import('@/components/wallet/WalletBackupReminder'));
const BackupWalletModal = React.lazy(() => import('@/components/wallet/BackupWalletModal'));
const TokenSwapModal = React.lazy(() => import('@/components/wallet/TokenSwapModal'));
const StakingModal = React.lazy(() => import('@/components/wallet/StakingModal'));
const EscrowInitiator = React.lazy(() => import('@/components/wallet/EscrowInitiator'));

// Capital state and surfaces
const CapitalLayer = React.lazy(() => import('../components/wallet/CapitalLayer'));
import { useWalletOperatingStore, parseDecimal } from '../stores/wallet-operating-store';
import type { Transaction, SelectedAccount } from '../../../shared/types/wallet';
import type { Vault } from '../stores/wallet-operating-store';
import useWalletActions from '../hooks/useWalletActions';


const EnhancedWalletPage = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const store = useWalletOperatingStore();
  const actions = useWalletActions();
  const { vaults, transactions, setVaults, setTransactions, selectedAccount, setSelectedAccount, selectedAccountId, setSelectedAccountId } = store
  const [depositOpen, setDepositOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [paymentRequestOpen, setPaymentRequestOpen] = useState(false);
  const [selectedVault, setSelectedVault] = useState<Vault | null>(null);
  const [balanceVisible, setBalanceVisible] = useState(true);
  // vaults and transactions are managed by the wallet operating store
  const [phonePaymentOpen, setPhonePaymentOpen] = useState(false);
  const [splitBillOpen, setSplitBillOpen] = useState(false);
  const [paymentLinkOpen, setPaymentLinkOpen] = useState(false);
  const [recurringPaymentOpen, setRecurringPaymentOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('cUSD');
  const [showRequestFunds, setShowRequestFunds] = useState(false);
  const [requestFundsOpen, setRequestFundsOpen] = useState(false);
  const [userKycStatus, setUserKycStatus] = useState<'verified' | 'pending' | 'not-started'>('not-started');

  // Use real wallet data instead of mock data
  const { address, isConnected, balance, connectMetaMask, connectValora, connectMiniPay, isLoading, error, disconnect } = useWallet();
  const user = { id: address || 'no-wallet' };
  const navigate = useNavigate();

  // Analytics state
  type Analytics = {
    valueOverTime?: Record<string, number>
    tokenBreakdown?: Record<string, number>
    typeSummary?: Record<string, number>
  }
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [fetchLoading, setFetchLoading] = useState(false);

  // Sparkline data for subtle capital-flow visualization
  const valueOverTime = analytics?.valueOverTime ?? {};
  const tokenBreakdown = analytics?.tokenBreakdown ?? {};
  const typeSummary = analytics?.typeSummary ?? {};

  const sparklineData = Object.keys(valueOverTime).length > 0 ? {
    labels: Object.keys(valueOverTime),
    datasets: [{
      data: Object.values(valueOverTime),
      borderColor: '#94a3b8',
      backgroundColor: 'transparent',
      tension: 0.3,
      pointRadius: 0,
    }]
  } : {
    labels: ['-4','-3','-2','-1','now'],
    datasets: [{ data: [0,0,0,0,0], borderColor: '#94a3b8', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0 }]
  };

  const sparklineOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    elements: { line: { borderWidth: 2 } },
    scales: { x: { display: false }, y: { display: false } }
  };

  useEffect(() => {
    // Fetch wallet balance, portfolio, and transaction status from API
    async function fetchWalletData() {
      setFetchLoading(true);
      try {
        // Native balance
        const balanceData = await apiGet('/api/v1/wallets/balance');
        // Portfolio (tokens)
        const portfolioData = await apiPost('/api/v1/wallets/balance/portfolio', { tokenAddresses: [] });
        // Compose vaults array for UI
        type Token = { address?: string; symbol?: string; balance?: string | number }
        const vaultsArr = [
          {
            id: 'native',
            currency: balanceData.symbol || 'ETH',
            balance: balanceData.balance || '0',
            type: 'personal',
            monthlyGoal: '0',
          },
          ...(Array.isArray(portfolioData) ? portfolioData.map((token: Token, i: number) => ({
            id: token.address || `token-${i}`,
            currency: token.symbol || 'TOKEN',
            balance: token.balance || '0',
            type: 'token',
            monthlyGoal: '0',
          })) : [])
        ];
        setVaults(vaultsArr);
        // Transactions: (for demo, fetch last 10 txs for native address)
      } catch (error) {
        console.error('Error fetching wallet data:', error);
      } finally {
        setFetchLoading(false);
      }
    }
    
    if (isConnected && address) {
      fetchWalletData();
    }
  }, [isConnected, address]);
  
  // Fetch analytics when connected
  useEffect(() => {
    let mounted = true;
    const fetchAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        const data = await apiGet('/api/v1/wallets/analytics');
        if (!mounted) return;
        setAnalytics(data || null);
        setAnalyticsError('');
      } catch (e) {
        console.error('Analytics fetch error', e);
        setAnalyticsError('Failed to load analytics');
      } finally {
        setAnalyticsLoading(false);
      }
    };

    if (isConnected) fetchAnalytics();
    return () => { mounted = false; };
  }, [isConnected]);

  // Compute derived total balance from vaults
  useEffect(() => {
    const total = (vaults || []).reduce((s: number, v: any) => s + Number(v.balance || 0), 0);
    setTotalBalance(total);
  }, [vaults]);
  
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [showFeaturesMenu, setShowFeaturesMenu] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showStakingModal, setShowStakingModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);

  // derive netFlow30d and recentTxs for CapitalLayer
  const txsForCapital = transactions || [];
  const parseAmtForCapital = (v: unknown) => parseDecimal(v);
  const netFlow30dDec = (txsForCapital as Transaction[]).reduce((s: Decimal, t: Transaction) => s.plus(parseAmtForCapital(t.amount)), new Decimal(0));
  type RecentTx = { id: string; type: 'in' | 'swap' | 'out'; label?: string; time?: string; amount: number };
  const recentTxs: RecentTx[] = (txsForCapital as Transaction[]).slice(0, 4).map((tx: Transaction, i: number) => {
    const txType = tx.type === 'received' ? 'in' : tx.type === 'swap' ? 'swap' : 'out';
    const rawTime = tx.timeAgo ?? tx.time ?? '';
    const isDate = (v: unknown): v is Date => v instanceof Date;
    let timeStr: string | undefined = undefined;
    if (typeof rawTime === 'number') timeStr = new Date(rawTime).toISOString();
    else if (isDate(rawTime)) timeStr = rawTime.toISOString();
    else if (typeof rawTime === 'string') timeStr = rawTime;

    const label = tx.description ?? tx.memo ?? tx.type ?? '';

    return {
      id: String(tx.id ?? `${tx.type}-${i}-${tx.time ?? ''}`),
      type: txType,
      label,
      time: timeStr,
      amount: Number(parseAmtForCapital(tx.amount).toNumber())
    };
  });

  // Handle send native
  const handleSendNative = useCallback(async () => {
    setActionLoading(true);
    setActionError('');
    try {
      const res = await actions.send({ toAddress: sendTo, amount: sendAmount, currency: selectedCurrency });
      if (!res.success) throw new Error(res.error || 'Send failed');
      setSendAmount('');
      setSendTo('');
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err));
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  }, [sendTo, sendAmount]);

  async function handleDeposit() {
    setActionLoading(true);
    setActionError('');
    try {
      // Prefer platform on-ramp / deposit flow if available
      if (typeof (actions as any).depositOnRamp === 'function') {
        const res = await (actions as any).depositOnRamp({ amount: depositAmount, currency: selectedCurrency });
        if (!res.success) throw new Error(res.error || 'Deposit failed');
      } else {
        // Fallback: open payment modal (external on-ramp integration)
        setPaymentOpen(true);
      }
      setDepositAmount('');
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err));
      setActionError(msg);
    } finally { setActionLoading(false); }
  }

  async function handleWithdraw() {
    setActionLoading(true); setActionError('');
    try {
      const res = await actions.withdraw({ to: sendTo, amount: withdrawAmount, currency: selectedCurrency });
      if (!res.success) throw new Error(res.error || 'Withdraw failed');
      setWithdrawAmount(''); setWithdrawOpen(false);
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err));
      setActionError(msg);
    } finally { setActionLoading(false); }
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "received":
        return <ArrowDownLeft className="w-5 h-5 text-emerald-500" />;
      case "sent":
        return <ArrowUpRight className="w-5 h-5 text-red-500" />;
      case "deposit":
        return <Plus className="w-5 h-5 text-blue-500" />;
      case "withdrawal":
        return <ArrowUpRight className="w-5 h-5 text-orange-500" />;
      default:
        return <DollarSign className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "received":
      case "deposit":
        return "text-emerald-500";
      case "sent":
      case "withdrawal":
        return "text-red-500";
      default:
        return "text-gray-900";
    }
  };

  const CustomCard: React.FC<{ children: React.ReactNode; className?: string; hover?: boolean }> = ({ children, className = "", hover = false }) => (
    <div className={`bg-gray-900/80 text-white rounded-2xl shadow-sm border border-gray-800 ${hover ? 'hover:shadow-md transition-all duration-150' : ''} ${className}`}>
      {children}
    </div>
  );

  type BadgeVariant = "default" | "emerald" | "gold" | "purple" | "orange" | "outline";
  const Badge = ({
    children,
    className = "",
    variant = "default"
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: BadgeVariant;
  }) => {
    const variants: Record<BadgeVariant, string> = {
      default: "bg-gray-800 text-white",
      emerald: "bg-emerald-600 text-white",
      gold: "bg-amber-600 text-white",
      purple: "bg-purple-700 text-white",
      orange: "bg-amber-500 text-white",
      outline: "border-2 border-gray-700 text-gray-200 bg-gray-900/60"
    };

    return (
      <span className={`${variants[variant]} text-white text-xs font-semibold px-3 py-1 rounded-full ${className}`}>
        {children}
      </span>
    );
  };

  // Use shared Button component (do not shadow import)

  // Loading state after connection
  if (isConnected && fetchLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <Plus className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
          <h3 className="text-xl font-bold mb-2">Loading Your Wallet</h3>
          <p className="text-gray-600 dark:text-gray-400">Fetching your balance and transactions...</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
        </Card>
      </div>
    );
  }

  return (
    <React.Suspense fallback={<div className="p-8 text-center">Loading wallet...</div>}>
      <Shell
      brand={
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent">Personal Wallet</h1>
            <p className="text-gray-600 text-lg">Secure digital asset management</p>
          </div>
        </div>
      }
      userActions={
        <div className="flex items-center gap-3">
          {isConnected && (
            <Button onClick={disconnect} variant="outline" size="sm" className="text-red-600">Disconnect</Button>
          )}
        </div>
      }
    >
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:bg-gray-950 relative overflow-hidden">
      {/* Connected Wallet Header */}
      {isConnected && address && (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Connected: {address.slice(0, 6)}...{address.slice(-4)}
              </span>
            </div>
            <Button
              onClick={disconnect}
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Disconnect
            </Button>
          </div>
        </div>
      )}

      {/* Analytics Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-900 to-purple-900 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">Wallet Analytics</h2>
        {analyticsLoading ? (
          <div className="text-gray-500">Loading analytics...</div>
        ) : analyticsError ? (
          <div className="text-red-500">{analyticsError}</div>
        ) : analytics ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Portfolio Value Over Time (Line Chart) */}
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold mb-2">Portfolio Value Over Time</h3>
              <Line
                data={{
                  labels: Object.keys(valueOverTime),
                  datasets: [
                    {
                      label: 'Value',
                      data: Object.values(valueOverTime),
                      borderColor: '#6366f1',
                      backgroundColor: 'rgba(99,102,241,0.1)',
                      fill: true,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false } },
                }}
                height={200}
              />
            </div>
            {/* Token Breakdown (Pie Chart) */}
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold mb-2">Token Breakdown</h3>
              <Pie
                data={{
                  labels: Object.keys(tokenBreakdown),
                  datasets: [
                    {
                      data: Object.values(tokenBreakdown),
                      backgroundColor: [
                        '#6366f1', '#f59e42', '#10b981', '#f43f5e', '#a21caf', '#fbbf24', '#0ea5e9', '#14b8a6', '#eab308', '#f472b6'
                      ],
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { position: 'bottom' } },
                }}
                height={200}
              />
            </div>
            {/* Transaction Type Summary (Bar Chart) */}
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold mb-2">Transaction Type Summary</h3>
              <Bar
                data={{
                  labels: Object.keys(typeSummary),
                  datasets: [
                    {
                      label: 'Total',
                      data: Object.values(typeSummary),
                      backgroundColor: '#6366f1',
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false } },
                }}
                height={200}
              />
            </div>
          </div>
        ) : null}
      </div>
      {/* Subtle background wash for calm surface */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/2 opacity-5" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Backup Reminder */}
        {isConnected && address && (
          <WalletBackupReminder userId={user?.id} walletAddress={address} />
        )}

        {/* Capital overview layer (replaced multiple surfaces with a single focused component) */}
        {isConnected && address && (
          <CapitalLayer
            address={address}
            total={store.total}
            liquidity={store.liquidity}
            deployed={store.deployed}
            pending={store.pendingTotal || '0'}
            pendingCount={store.pendingCount}
            walletHealth={store.walletHealth}
            availableVaults={store.availableVaults}
            deployedVaults={store.deployedVaults}
            recentTxs={recentTxs}
            netFlow30d={netFlow30dDec.toNumber()}
            flowBars={undefined}
            onSend={() => setDepositOpen(true)}
            onAddFunds={() => setPaymentOpen(true)}
            onSwap={() => setShowSwapModal(true)}
            onViewAll={() => setActiveTab('transactions')}
          />
        )}

        {/* Header with Settings Icon */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-4 mb-2">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent">
                  Personal Wallet
                </h1>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" className="h-8 px-3 text-sm" onClick={() => navigate('/dashboard')}>
                    <span className="w-4 h-4 mr-1">👥</span>
                    Community
                  </Button>
                  <Button variant="outline" className="h-8 px-3 text-sm" onClick={() => navigate('/vault-dashboard')}>
                    <TrendingUp className="w-4 h-4 mr-1" />
                    DeFi Portfolio
                  </Button>
                </div>
              </div>
              <p className="text-gray-600 text-lg">Secure digital asset management</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant="orange" className="flex items-center space-x-1">
              <Shield className="w-4 h-4" />
              <span>Secured</span>
            </Badge>
            <div className="relative">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSettingsOpen(!settingsOpen)}
              >
                <Settings className="w-4 h-4" />
              </Button>
              {settingsOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-50">
                  <div className="p-2 space-y-1">
                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center space-x-2">
                      <Plus className="w-4 h-4" />
                      <span>Refresh</span>
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center space-x-2" onClick={() => setShowBackupModal(true)}>
                      <Plus className="w-4 h-4" />
                      <span>Backup Wallet</span>
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center space-x-2" onClick={() => setRecurringPaymentOpen(true)}>
                      <ArrowUpRight className="w-4 h-4" />
                      <span>Recurring Payments</span>
                    </button>
                    {isConnected && (
                      <button className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600 rounded flex items-center space-x-2" onClick={disconnect}>
                        <ArrowUpRight className="w-4 h-4" />
                        <span>Disconnect</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Trust Wallet Style Balance & Actions */}
        <div className="mb-8">
          {/* Main Balance Card */}
          <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white p-8 rounded-3xl relative overflow-hidden mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <p className="text-white/80 text-sm font-medium">Total Balance</p>
                  <button
                    onClick={() => setBalanceVisible(!balanceVisible)}
                    className="text-white/60 hover:text-white/80 transition-colors"
                  >
                    {balanceVisible ? <Shield className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                  </button>
                </div>
                <select 
                  aria-label="Currency selection"
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  className="bg-white/20 text-white rounded px-3 py-1 text-sm border border-white/30 focus:outline-none"
                >
                  <option value="cUSD">USD</option>
                  <option value="cEUR">EUR</option>
                  <option value="CELO">CELO</option>
                  <option value="cREAL">REAL</option>
                </select>
              </div>
              
              <div className="mb-8">
                <h2 className="text-5xl font-bold text-white mb-1">
                  {balanceVisible ? `$${totalBalance.toLocaleString()}` : '••••••'}
                </h2>
                <p className="text-white/70 text-sm">Across all tokens</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Button 
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30 py-3 flex flex-col items-center justify-center"
                  onClick={() => setPaymentOpen(true)}
                >
                  <Plus className="w-5 h-5 mb-1" />
                  <span className="text-xs">Add Funds</span>
                </Button>
                <Button 
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30 py-3 flex flex-col items-center justify-center"
                  onClick={() => setWithdrawOpen(true)}
                >
                  <ArrowUpRight className="w-5 h-5 mb-1" />
                  <span className="text-xs">Withdraw</span>
                </Button>
                <Button 
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30 py-3 flex flex-col items-center justify-center"
                  onClick={() => setRequestFundsOpen(true)}
                >
                  <ArrowDownLeft className="w-5 h-5 mb-1" />
                  <span className="text-xs">Request</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Surfaces: Capital sections delegated to feature surfaces */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900">Capital Overview</h3>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-500">Capital Flow</div>
                <div className="w-48">
                  <Line data={sparklineData} options={sparklineOptions} height={40} />
                </div>
              </div>
            </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                  {/* Liquidity and Deployed panels are replaced by CapitalLayer above. */}
                </div>

                <div className="lg:col-span-1 space-y-4">
                  {/* Health/summary handled by CapitalLayer */}
                </div>
              </div>
          </div>
        </div>

        {/* DeFi & Advanced Features Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Features & Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Swap Tokens */}
            <div className="bg-gray-50/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 p-6 rounded-xl hover:shadow-md transition-colors cursor-pointer" onClick={() => setShowSwapModal(true)}>
              <div className="w-10 h-10 bg-gray-800/10 rounded-lg flex items-center justify-center mb-4">
                <ArrowUpRight className="w-5 h-5 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Swap Tokens</h3>
              <p className="text-sm text-gray-500">Exchange between tokens instantly</p>
            </div>

            {/* Stake & Earn */}
            <div className="bg-gray-50/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 p-6 rounded-xl hover:shadow-md transition-colors cursor-pointer" onClick={() => setShowStakingModal(true)}>
              <div className="w-10 h-10 bg-gray-800/10 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="w-5 h-5 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Stake & Earn</h3>
              <p className="text-sm text-gray-500">Earn rewards from your assets</p>
            </div>

            {/* Vaults */}
            <div className="bg-gray-50/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 p-6 rounded-xl hover:shadow-md transition-colors cursor-pointer" onClick={() => navigate('/vault-dashboard')}>
              <div className="w-10 h-10 bg-gray-800/10 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-5 h-5 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Vaults</h3>
              <p className="text-sm text-gray-500">Secure your savings with vaults</p>
            </div>

            {/* P2P Escrow */}
            <div className="bg-gray-50/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 p-6 rounded-xl hover:shadow-md transition-colors cursor-pointer">
              <div className="w-10 h-10 bg-gray-800/10 rounded-lg flex items-center justify-center mb-4">
                <Send className="w-5 h-5 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Peer Escrow</h3>
              {userKycStatus === 'verified' ? (
                <>
                  <p className="text-sm text-gray-500 mb-3">Safe transfers with escrow</p>
                  <EscrowInitiator walletBalance={balance} defaultCurrency="cUSD" />
                </>
              ) : (
                <p className="text-sm text-yellow-600">⚠️ KYC required to access</p>
              )}
            </div>
          </div>
        </div>

        {/* Social Payments Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Pay Your Way</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pay by Phone */}
            <button
              onClick={() => setPhonePaymentOpen(true)}
              className="bg-gray-50/80 dark:bg-gray-900/40 p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:shadow-md transition-colors text-left"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Pay by Phone</h3>
              <p className="text-sm text-gray-500">Send money using phone number</p>
            </button>

            {/* Split Bill */}
            <button
              onClick={() => setSplitBillOpen(true)}
              className="bg-gray-50/80 dark:bg-gray-900/40 p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:shadow-md transition-colors text-left"
            >
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Split Bill</h3>
              <p className="text-sm text-gray-500">Share expenses with friends</p>
            </button>

            {/* Request Payment */}
            <button
              onClick={() => setPaymentRequestOpen(true)}
              className="bg-gray-50/80 dark:bg-gray-900/40 p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:shadow-md transition-colors text-left"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Plus className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Request Payment</h3>
              <p className="text-sm text-gray-500">Ask others to send you money</p>
            </button>
          </div>
        </div>

        {/* Exchange Rate Widget */}
        <div className="mb-8">
          <ExchangeRateWidget onConvert={(fromAmount, fromCurrency, toCurrency, toAmount) => {
            console.log(`Converting ${fromAmount} ${fromCurrency} to ${toAmount} ${toCurrency}`);
          }} />
        </div>

        {/* 4-Account Structure Selector */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Accounts</h2>
          <AccountSelector
            selectedAccountId={selectedAccountId}
            onAccountSelect={(account) => {
              setSelectedAccountId(account.id);
              // Map local Account shape to shared SelectedAccount
              const mapped: SelectedAccount = {
                id: account.id,
                address: account.address ?? '',
                label: account.currency ? `${account.currency} (${account.type})` : account.type,
                name: account.currency ?? account.type,
                type: account.type,
                balance: account.balance,
                currency: account.currency
              };
              setSelectedAccount(mapped);
            }}
          />
          {selectedAccount && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Selected Account: {selectedAccount.type ? (selectedAccount.type.charAt(0).toUpperCase() + selectedAccount.type.slice(1)) : 'Account'}</CardTitle>
                <CardDescription>
                  Balance: {Number(selectedAccount.balance ?? 0).toFixed(2)} {selectedAccount.currency ?? ''}
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        {/* New Wallet Features Section */}
        <div className="space-y-6">

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="recurring">Recurring</TabsTrigger>
              <TabsTrigger value="vouchers">Vouchers</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Card>
                <CardHeader>
                  <CardTitle>Wallet Overview</CardTitle>
                  <CardDescription>Summary of your wallet activities.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {/* Placeholder for future overview components */}
                  <p className="text-sm text-gray-500">Detailed overview coming soon...</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
                  <Button onClick={() => setDepositOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Send className="w-4 h-4 mr-2" />
                    Send Money
                  </Button>
                </div>
                <TransactionHistory userId={user?.id} walletAddress={address} />
              </div>
            </TabsContent>

            <TabsContent value="recurring">
              <RecurringPaymentsManager />
            </TabsContent>

            <TabsContent value="vouchers">
              <GiftCardVoucher />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {requestFundsOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <CustomCard className="p-8 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                <ArrowDownLeft className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold">Request Funds</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">Create a payment request and share it with others</p>
            <input type="text" placeholder="Requester Name" className="w-full mb-3 p-2 border rounded text-sm" />
            <input type="number" placeholder="Amount Requested" className="w-full mb-3 p-2 border rounded text-sm" />
            <select aria-label="Currency selection" className="w-full mb-3 p-2 border rounded text-sm">
              <option>cUSD</option>
              <option>CELO</option>
              <option>cEUR</option>
              <option>cREAL</option>
            </select>
            <textarea placeholder="Message (optional)" className="w-full mb-3 p-2 border rounded text-sm" rows={3}></textarea>
            <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">Generate Request</Button>
            <Button onClick={() => setRequestFundsOpen(false)} className="w-full mt-2" variant="outline">Close</Button>
          </CustomCard>
        </div>
      )}

      {/* Mock Modals */}
      {depositOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <CustomCard className="p-8 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold">Send Money</h3>
            </div>
            <input type="text" placeholder="Recipient Address" className="w-full mb-3 p-2 border rounded" value={sendTo} onChange={e => setSendTo(e.target.value)} />
            <input type="number" placeholder="Amount" className="w-full mb-3 p-2 border rounded" value={sendAmount} onChange={e => setSendAmount(e.target.value)} />
            {actionError && <p className="text-red-500 mb-2">{actionError}</p>}
            <Button onClick={handleSendNative} className="w-full" disabled={actionLoading}>{actionLoading ? 'Sending...' : 'Send'}</Button>
            <Button onClick={() => setDepositOpen(false)} className="w-full mt-2" variant="outline">Close</Button>
          </CustomCard>
        </div>
      )}

      {paymentOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <CustomCard className="p-8 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold">Add Funds</h3>
            </div>
            <input type="text" placeholder="Recipient Address" className="w-full mb-3 p-2 border rounded" value={sendTo} onChange={e => setSendTo(e.target.value)} />
            <input type="number" placeholder="Amount" className="w-full mb-3 p-2 border rounded" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
            {actionError && <p className="text-red-500 mb-2">{actionError}</p>}
            <Button onClick={handleDeposit} className="w-full" disabled={actionLoading}>{actionLoading ? 'Depositing...' : 'Deposit'}</Button>
            <Button onClick={() => setPaymentOpen(false)} className="w-full mt-2" variant="outline">Close</Button>
          </CustomCard>
        </div>
      )}

      {withdrawOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <CustomCard className="p-8 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gray-800/20 rounded-xl flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold">Withdraw Funds</h3>
            </div>
            <input type="text" placeholder="Recipient Address" className="w-full mb-3 p-2 border rounded bg-transparent text-white" value={sendTo} onChange={e => setSendTo(e.target.value)} />
            <input type="number" placeholder="Amount" className="w-full mb-3 p-2 border rounded bg-transparent text-white" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} />
            {actionError && <p className="text-amber-300 mb-2">{actionError}</p>}
            <Button onClick={handleWithdraw} className="w-full" disabled={actionLoading}>{actionLoading ? 'Withdrawing...' : 'Withdraw'}</Button>
            <Button onClick={() => setWithdrawOpen(false)} className="w-full mt-2" variant="outline">Close</Button>
          </CustomCard>
        </div>
      )}

      {address && (
        <>
          <PaymentRequestModal
            isOpen={paymentRequestOpen}
            onClose={() => setPaymentRequestOpen(false)}
            userAddress={address}
          />
          <PhonePaymentModal
            isOpen={phonePaymentOpen}
            onClose={() => setPhonePaymentOpen(false)}
            userAddress={address}
          />
          <SplitBillModal
            isOpen={splitBillOpen}
            onClose={() => setSplitBillOpen(false)}
            userAddress={address}
          />
          <PaymentLinkModal
            isOpen={paymentLinkOpen}
            onClose={() => setPaymentLinkOpen(false)}
            userAddress={address}
          />
          <BackupWalletModal
            isOpen={showBackupModal}
            onClose={() => setShowBackupModal(false)}
            userAddress={address}
          />
          <TokenSwapModal
            isOpen={showSwapModal}
            onClose={() => setShowSwapModal(false)}
          />
          <StakingModal
            isOpen={showStakingModal}
            onClose={() => setShowStakingModal(false)}
          />
        </>
      )}
    </div>
    </Shell>
    </React.Suspense>
  );
};

export default EnhancedWalletPage;