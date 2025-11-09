import React, { useState, useEffect } from 'react';
import { Plus, Send, Download, History, DollarSign, ArrowUpRight, ArrowDownLeft, User, Wallet, CreditCard, TrendingUp, Shield, Zap, Star, Crown, Sparkles, Eye, EyeOff, RefreshCw, Users, Share2, Repeat, QrCode } from 'lucide-react';

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
import WalletConnectionManager from '@/components/wallet/WalletConnectionManager'; // Import the new component


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

  // Show wallet connection UI if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
        <WalletConnectionManager
          userId={user?.id}
          onConnect={(address, provider) => {
            console.log('Wallet connected:', address, provider);
            window.location.reload();
          }}
        />
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
        return <Download className="w-5 h-5 text-blue-500" />;
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
          <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
          <h3 className="text-xl font-bold mb-2">Loading Your Wallet</h3>
          <p className="text-gray-600 dark:text-gray-400">Fetching your balance and transactions...</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
        </Card>
      </div>
    );
  }

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
        {/* Enhanced Header with Dashboard Navigation */}
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
          <div className="flex items-center space-x-4">
            <Badge variant="orange" className="flex items-center space-x-1">
              <Shield className="w-4 h-4" />
              <span>Secured</span>
            </Badge>
            <Button variant="outline" className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Premium Balance Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Main Balance Card */}
          <CustomCard className="lg:col-span-2 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-2xl" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="flex items-center space-x-3 mb-4">
                    <p className="text-white/80 text-sm font-medium">Total Balance</p>
                    <button
                      onClick={() => setBalanceVisible(!balanceVisible)}
                      className="text-white/60 hover:text-white/80 transition-colors"
                    >
                      {balanceVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                  <h2 className="text-5xl font-bold text-white mb-2">
                    {balanceVisible ? `$${totalBalance.toLocaleString()}` : '••••••'}
                  </h2>
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-emerald-300" />
                    <span className="text-emerald-300 text-sm font-medium">+12.5% this month</span>
                  </div>
                </div>
                <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <DollarSign className="w-10 h-10 text-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button variant="glass" className="py-4 text-lg">
                  <Send className="mr-2 h-5 w-5" />
                  Send Money
                </Button>
                <Button variant="glass" className="py-4 text-lg" onClick={() => setPaymentOpen(true)}>
                  <Download className="mr-2 h-5 w-5" />
                  Add Funds
                </Button>
              </div>
            </div>
          </CustomCard>

          {/* Quick Actions Card */}
          <CustomCard className="bg-gradient-to-br from-white/90 to-gray-50/90 p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Quick Actions</h3>
              <Zap className="w-6 h-6 text-yellow-500" />
            </div>
            <div className="space-y-4">
              <Button variant="emerald" className="w-full py-4 text-lg">
                <Send className="mr-2 h-5 w-5" />
                Send to Friend
              </Button>
              <Button variant="purple" className="w-full py-4 text-lg" onClick={() => setPaymentOpen(true)}>
                <Download className="mr-2 h-5 w-5" />
                Deposit Funds
              </Button>
              <Button
                variant="outline"
                className="w-full py-4 text-lg"
                onClick={() => setPaymentRequestOpen(true)}
              >
                <QrCode className="mr-2 h-5 w-5" />
                Request Payment
              </Button>
              <Button
                variant="outline"
                className="w-full py-4 text-lg"
                onClick={() => setPhonePaymentOpen(true)}
              >
                <User className="mr-2 h-5 w-5" />
                Pay by Phone
              </Button>
              <Button
                variant="outline"
                className="w-full py-4 text-lg"
                onClick={() => setSplitBillOpen(true)}
              >
                <Users className="mr-2 h-5 w-5" />
                Split Bill
              </Button>
              <Button
                variant="outline"
                className="w-full py-4 text-lg"
                onClick={() => setPaymentLinkOpen(true)}
              >
                <Share2 className="mr-2 h-5 w-5" />
                Payment Link
              </Button>
              <Button
                variant="outline"
                className="w-full py-4 text-lg"
                onClick={() => setRecurringPaymentOpen(true)}
              >
                <Repeat className="mr-2 h-5 w-5" />
                Set Recurring
              </Button>
              <Button
                variant="outline"
                className="w-full py-4 text-lg"
                onClick={() => {
                  const personalVault = vaults?.find(v => v.type === 'personal');
                  setSelectedVault(personalVault);
                  setWithdrawOpen(true);
                }}
                disabled={!vaults?.some(v => v.type === 'personal')}
              >
                <ArrowUpRight className="mr-2 h-5 w-5" />
                Withdraw
              </Button>
            </div>
          </CustomCard>
        </div>

        {/* Enhanced Currency Breakdown */}
        <CustomCard className="mb-12 p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-blue-900 bg-clip-text text-transparent">
              Currency Portfolio
            </h2>
            <Button variant="outline" className="text-sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Currency
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {vaults?.map((vault, index) => (
              <CustomCard key={vault.id} hover className="p-6 bg-gradient-to-br from-white/80 to-gray-50/80 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-xl" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-sm">
                          {vault.currency.substring(0, 2)}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-gray-900 text-lg">{vault.currency}</span>
                        <p className="text-sm text-gray-500">Active</p>
                      </div>
                    </div>
                    <Badge variant="emerald" className="flex items-center space-x-1">
                      <Star className="w-3 h-3" />
                      <span>Live</span>
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-blue-900 bg-clip-text text-transparent">
                      ${parseFloat(vault.balance.replace(/,/g, '')).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      Goal: ${parseFloat(vault.monthlyGoal || 0).toLocaleString()}
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                      <div
                        className="bg-gradient-to-r from-emerald-400 to-teal-500 h-2 rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min((parseFloat(vault.balance.replace(/,/g, '')) / parseFloat(vault.monthlyGoal || 1)) * 100, 100)}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </CustomCard>
            ))}
          </div>
        </CustomCard>

        {/* New Wallet Features Section */}
        <div className="space-y-6">
          {/* Exchange Rate Widget */}
          <ExchangeRateWidget onConvert={(fromAmount, fromCurrency, toCurrency, toAmount) => {
            console.log(`Converting ${fromAmount} ${fromCurrency} to ${toAmount} ${toCurrency}`);
          }} />

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
              <TransactionHistory userId={user?.id} walletAddress={address} />
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

      {/* Mock Modals */}
      {depositOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <CustomCard className="p-8 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Download className="w-6 h-6 text-white" />
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
                <CreditCard className="w-6 h-6 text-white" />
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
        </>
      )}
    </div>
  );
};

export default EnhancedWalletPage;