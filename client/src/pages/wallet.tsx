import React, { useState, useEffect } from 'react';
import { Plus, Send, ArrowUpRight, ArrowDownLeft, Wallet, TrendingUp, Shield, DollarSign, Users, Settings } from 'lucide-react';

import { Line, Pie, Bar } from 'react-chartjs-2';
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
import TransactionHistory from '../components/wallet/TransactionHistory';
import { apiGet, apiPost } from '@/lib/api';
import RecurringPayments from '../components/wallet/RecurringPayments';
import ExchangeRateWidget from '../components/wallet/ExchangeRateWidget';
import RecurringPaymentsManager from '@/components/wallet/RecurringPaymentsManager';
import GiftCardVoucher from '@/components/wallet/GiftCardVoucher';
import { useWallet } from './hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PaymentRequestModal from '@/components/wallet/PaymentRequestModal';
import PhonePaymentModal from '@/components/wallet/PhonePaymentModal';
import SplitBillModal from '@/components/wallet/SplitBillModal';
import PaymentLinkModal from '@/components/wallet/PaymentLinkModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WalletConnectionManager from '@/components/wallet/WalletConnectionManager';
import WalletBackupReminder from '@/components/wallet/WalletBackupReminder';
import BackupWalletModal from '@/components/wallet/BackupWalletModal';
import TokenSwapModal from '@/components/wallet/TokenSwapModal';
import StakingModal from '@/components/wallet/StakingModal';
import EscrowInitiator from '@/components/wallet/EscrowInitiator';


const EnhancedWalletPage = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [depositOpen, setDepositOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [paymentRequestOpen, setPaymentRequestOpen] = useState(false);
  const [selectedVault, setSelectedVault] = useState<any>(null);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [vaults, setVaults] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
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

  // Analytics state
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState('');

  useEffect(() => {
    // Fetch wallet balance, portfolio, and transaction status from API
    async function fetchWalletData() {
      try {
        // Native balance
        const balanceData = await apiGet('/api/wallet/balance');
        // Portfolio (tokens)
        const portfolioData = await apiPost('/api/wallet/portfolio', { tokenAddresses: [] });
        // Compose vaults array for UI
        const vaultsArr = [
          {
            id: 'native',
            currency: balanceData.symbol || 'ETH',
            balance: balanceData.balance || '0',
            type: 'personal',
            monthlyGoal: '0',
          },
          ...(Array.isArray(portfolioData) ? portfolioData.map((token: any, i: number) => ({
            id: token.address || `token-${i}`,
            currency: token.symbol || 'TOKEN',
            balance: token.balance || '0',
            type: 'token',
            monthlyGoal: '0',
          })) : [])
        ];
        setVaults(vaultsArr);
        // Transactions: (for demo, fetch last 10 txs for native address)
        if (balanceData.address) {
          const txStatusData = await apiGet(`/api/wallet/tx-status/${balanceData.address}`);
          setTransactions(Array.isArray(txStatusData) ? txStatusData : []);
        } else {
          setTransactions([]);
        }
      } catch (e) {
        setVaults([]);
        setTransactions([]);
      }
    }
    fetchWalletData();

    // Fetch analytics
    async function fetchAnalytics() {
      setAnalyticsLoading(true);
      setAnalyticsError('');
      try {
        const data = await apiGet('/api/wallet/analytics');
        setAnalytics(data);
      } catch (e: any) {
        setAnalyticsError(e.message);
        setAnalytics(null);
      } finally {
        setAnalyticsLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  const totalBalance = vaults?.reduce((sum, vault) => sum + parseFloat((vault.balance || '0').replace(/,/g, '')), 0) || 0;

  // Show wallet setup/connection UI if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <WalletConnectionManager
            userId={user?.id}
            onConnect={(address, provider) => {
              console.log('Wallet connected:', address, provider);
              // Refresh to load wallet data
              window.location.reload();
            }}
          />
        </div>
      </div>
    );
  }

  // --- Send, Deposit, Withdraw Actions ---
  const [sendAmount, setSendAmount] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  async function handleSendNative() {
    setActionLoading(true); setActionError('');
    try {
      await apiPost('/api/wallet/send-native', { toAddress: sendTo, amount: sendAmount });
      setSendAmount(''); setSendTo(''); setDepositOpen(false);
    } catch (e: any) {
      setActionError(e.message);
    } finally { setActionLoading(false); }
  }

  async function handleDeposit() {
    setActionLoading(true); setActionError('');
    try {
      // For demo, treat deposit as send-native (or use /api/wallet/send-native)
      await apiPost('/api/wallet/send-native', { toAddress: sendTo, amount: depositAmount });
      setDepositAmount(''); setPaymentOpen(false);
    } catch (e: any) {
      setActionError(e.message);
    } finally { setActionLoading(false); }
  }

  async function handleWithdraw() {
    setActionLoading(true); setActionError('');
    try {
      // For demo, treat withdraw as send-native (or use /api/wallet/send-native)
      await apiPost('/api/wallet/send-native', { toAddress: sendTo, amount: withdrawAmount });
      setWithdrawAmount(''); setWithdrawOpen(false);
    } catch (e: any) {
      setActionError(e.message);
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
    <div className={`bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 ${hover ? 'hover:shadow-2xl hover:scale-[1.02] transition-all duration-300' : ''} ${className}`}>
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
      default: "bg-gradient-to-r from-blue-500 to-purple-600",
      emerald: "bg-gradient-to-r from-emerald-400 to-teal-500",
      gold: "bg-gradient-to-r from-yellow-400 to-orange-500",
      purple: "bg-gradient-to-r from-purple-500 to-pink-500",
      orange: "bg-gradient-to-r from-orange-400 to-pink-500",
      outline: "border-2 border-gray-200 text-gray-700 bg-white/80"
    };

    return (
      <span className={`${variants[variant]} text-white text-xs font-semibold px-3 py-1 rounded-full ${className}`}>
        {children}
      </span>
    );
  };

  type ButtonProps = {
    children: React.ReactNode;
    className?: string;
    variant?: "default" | "outline" | "emerald" | "purple" | "glass";
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    size?: "sm" | "md" | "lg";
  };

  const Button: React.FC<ButtonProps> = ({ children, className = "", variant = "default", onClick, disabled = false }) => {
    const variants = {
      default: "bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl",
      outline: "border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 bg-white/80",
      emerald: "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/25",
      purple: "bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white shadow-purple-500/25",
      glass: "bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
    };

    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`${variants[variant]} px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {children}
      </button>
    );
  };

  // Loading state after connection
  if (isConnected && !vaults.length && !transactions.length) {
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

  // Enhanced Features Menu State
  const [showFeaturesMenu, setShowFeaturesMenu] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showStakingModal, setShowStakingModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative overflow-hidden">
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
                  labels: Object.keys(analytics.valueOverTime),
                  datasets: [
                    {
                      label: 'Value',
                      data: Object.values(analytics.valueOverTime),
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
                  labels: Object.keys(analytics.tokenBreakdown),
                  datasets: [
                    {
                      data: Object.values(analytics.tokenBreakdown),
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
                  labels: Object.keys(analytics.typeSummary),
                  datasets: [
                    {
                      label: 'Total',
                      data: Object.values(analytics.typeSummary),
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
      {/* Animated Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/5 via-purple-400/5 to-pink-400/5" />
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse delay-1000" />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-gradient-to-br from-emerald-400/10 to-teal-400/10 rounded-full blur-3xl animate-pulse delay-500" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Backup Reminder */}
        {isConnected && address && (
          <WalletBackupReminder userId={user?.id} walletAddress={address} />
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
                  <Button variant="outline" className="h-8 px-3 text-sm" onClick={() => window.location.href = '/dashboard'}>
                    <span className="w-4 h-4 mr-1">👥</span>
                    Community
                  </Button>
                  <Button variant="outline" className="h-8 px-3 text-sm" onClick={() => window.location.href = '/vault-dashboard'}>
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

          {/* Token/Asset List - Trust Wallet Style */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900">Your Assets</h3>
            </div>
            <div className="divide-y">
              {balanceVisible && vaults?.length > 0 ? (
                vaults.map((vault, index) => {
                  const vaultBalance = parseFloat(vault.balance.replace(/,/g, ''));
                  return (
                    <div key={vault.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                          {vault.currency.substring(0, 1)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{vault.currency}</p>
                          <p className="text-sm text-gray-500">{vault.type === 'personal' ? 'Personal' : 'Token'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">${vaultBalance.toLocaleString()}</p>
                        <p className="text-sm text-emerald-600">+2.5%</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-500">
                  {balanceVisible ? 'No assets yet. Add funds to get started.' : 'Balance hidden'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DeFi & Advanced Features Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Features & Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Swap Tokens */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 hover:shadow-lg transition-all cursor-pointer" onClick={() => setShowSwapModal(true)}>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <ArrowUpRight className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Swap Tokens</h3>
              <p className="text-sm text-gray-500">Exchange between tokens instantly</p>
            </div>

            {/* Stake & Earn */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 hover:shadow-lg transition-all cursor-pointer" onClick={() => setShowStakingModal(true)}>
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Stake & Earn</h3>
              <p className="text-sm text-gray-500">Earn rewards from your assets</p>
            </div>

            {/* Vaults */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 hover:shadow-lg transition-all cursor-pointer" onClick={() => window.location.href = '/vault-dashboard'}>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Vaults</h3>
              <p className="text-sm text-gray-500">Secure your savings with vaults</p>
            </div>

            {/* P2P Escrow */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 hover:shadow-lg transition-all cursor-pointer">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <Send className="w-5 h-5 text-orange-600" />
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
              className="bg-white p-6 rounded-xl border border-gray-100 hover:shadow-lg transition-all text-left"
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
              className="bg-white p-6 rounded-xl border border-gray-100 hover:shadow-lg transition-all text-left"
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
              className="bg-white p-6 rounded-xl border border-gray-100 hover:shadow-lg transition-all text-left"
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

        {/* New Wallet Features Section */}
        <div className="space-y-6">

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
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
          <Card className="p-8 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold">Withdraw Funds</h3>
            </div>
            <input type="text" placeholder="Recipient Address" className="w-full mb-3 p-2 border rounded" value={sendTo} onChange={e => setSendTo(e.target.value)} />
            <input type="number" placeholder="Amount" className="w-full mb-3 p-2 border rounded" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} />
            {actionError && <p className="text-red-500 mb-2">{actionError}</p>}
            <Button onClick={handleWithdraw} className="w-full" disabled={actionLoading}>{actionLoading ? 'Withdrawing...' : 'Withdraw'}</Button>
            <Button onClick={() => setWithdrawOpen(false)} className="w-full mt-2" variant="outline">Close</Button>
          </Card>
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
  );
};

export default EnhancedWalletPage;