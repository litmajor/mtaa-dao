import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Send, ArrowUpRight, ArrowDownLeft, Wallet, TrendingUp, Shield, DollarSign, Users, Settings, Eye, EyeOff, Copy } from 'lucide-react';


import Decimal from 'decimal.js';

// Import new components for wallet features
const TransactionHistory = React.lazy(() => import('../components/wallet/TransactionHistory'));
const AccountSelector = React.lazy(() => import('../components/wallet/AccountSelector'));
import { apiGet } from '@/lib/api';
const ExchangeRateWidget = React.lazy(() => import('../components/wallet/ExchangeRateWidget'));
const RecurringPaymentsManager = React.lazy(() => import('@/components/wallet/RecurringPaymentsManager'));
const GiftCardVoucher = React.lazy(() => import('@/components/wallet/GiftCardVoucher'));
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Shell from '../components/ui/shell';
import PaymentRequestModal from '@/components/wallet/PaymentRequestModal';
import PhonePaymentModal from '@/components/wallet/PhonePaymentModal';
import SplitBillModal from '@/components/wallet/SplitBillModal';
import PaymentLinkModal from '@/components/wallet/PaymentLinkModal';
import StablecoinWalletPanel from '@/components/wallet/StablecoinWalletPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
const WalletBackupReminder = React.lazy(() => import('@/components/wallet/WalletBackupReminder'));
const BackupWalletModal = React.lazy(() => import('@/components/wallet/BackupWalletModal'));
const TokenSwapModal = React.lazy(() => import('@/components/wallet/TokenSwapModal'));
const StakingModal = React.lazy(() => import('@/components/wallet/StakingModal'));
const EscrowInitiator = React.lazy(() => import('@/components/wallet/EscrowInitiator'));

// Capital state and surfaces
const CapitalLayer = React.lazy(() => import('../components/wallet/CapitalLayer'));
import { useWalletOperatingStore, parseDecimal } from '../stores/wallet-operating-store';
import type { Transaction, SelectedAccount } from '../../../shared/types/wallet';
import useWalletActions from '../hooks/useWalletActions';

const EnhancedWalletPage = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const store = useWalletOperatingStore();
  const actions = useWalletActions();
  const { transactions, setVaults, setTransactions, selectedAccount, setSelectedAccount, selectedAccountId, setSelectedAccountId } = store
  const storeSetters = useRef({ setVaults, setTransactions });
  storeSetters.current = { setVaults, setTransactions };
  const [depositOpen, setDepositOpen] = useState(false);
  const [rampOpen, setRampOpen] = useState(false);
  const [rampMode, setRampMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [paymentRequestOpen, setPaymentRequestOpen] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  // vaults and transactions are managed by the wallet operating store
  const [phonePaymentOpen, setPhonePaymentOpen] = useState(false);
  const [splitBillOpen, setSplitBillOpen] = useState(false);
  const [paymentLinkOpen, setPaymentLinkOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const selectedCurrency = 'CELO';
  const [userKycStatus, setUserKycStatus] = useState<'verified' | 'pending' | 'not-started'>('not-started');

  // Use real wallet data instead of mock data
  const { address, isConnected, balance, connectMetaMask, connectValora, connectMiniPay, isLoading, error, disconnect, refreshBalances } = useWallet();
  const user = { id: address || 'no-wallet' };
  const navigate = useNavigate();

  const [fetchLoading, setFetchLoading] = useState(false);
  const [walletDataError, setWalletDataError] = useState('');

  useEffect(() => {
    storeSetters.current.setVaults(isConnected && address
      ? [{ id: address, currency: 'CELO', balance: balance ?? '0', type: 'personal' }]
      : []);
  }, [isConnected, address, balance]);

  useEffect(() => {
    let mounted = true;
    async function fetchTransactions() {
      if (!isConnected || !address) {
        storeSetters.current.setTransactions([]);
        return;
      }
      setFetchLoading(true);
      setWalletDataError('');
      try {
        const txData = await apiGet<Transaction[]>('/api/v1/wallets/transactions');
        if (mounted) storeSetters.current.setTransactions(txData);
      } catch (error) {
        console.error('Error fetching wallet transactions:', error);
        if (mounted) {
          storeSetters.current.setTransactions([]);
          setWalletDataError(error instanceof Error ? error.message : 'Unable to load wallet transactions.');
        }
      } finally {
        if (mounted) setFetchLoading(false);
      }
    }
    void fetchTransactions();
    return () => { mounted = false; };
  }, [isConnected, address, refreshTrigger]);
  
  useEffect(() => {
    let mounted = true;
    if (!isConnected) {
      setUserKycStatus('not-started');
      return () => { mounted = false; };
    }
    apiGet<{ kyc?: { status?: string } }>('/api/kyc/status')
      .then((result) => {
        if (!mounted) return;
        const status = result?.kyc?.status;
        setUserKycStatus(status === 'approved' ? 'verified' : status === 'pending' || status === 'under_review' ? 'pending' : 'not-started');
      })
      .catch((error) => {
        console.error('Failed to load KYC status:', error);
        if (mounted) setUserKycStatus('not-started');
      });
    return () => { mounted = false; };
  }, [isConnected]);

  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showStakingModal, setShowStakingModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);

  type ApiTransaction = Transaction & { currency?: string; createdAt?: string | Date };
  const txsForCapital = transactions as ApiTransaction[];
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const netFlow30dDec = txsForCapital.reduce((sum, tx) => {
    const date = tx.createdAt ? new Date(tx.createdAt).getTime() : Number.NaN;
    const type = String(tx.type ?? '').toLowerCase();
    if (!Number.isFinite(date) || date < thirtyDaysAgo || tx.currency?.toUpperCase() !== 'CELO') return sum;
    if (type === 'deposit' || type === 'received' || type === 'contribution') return sum.plus(parseDecimal(tx.amount));
    if (type === 'withdrawal' || type === 'sent') return sum.minus(parseDecimal(tx.amount));
    return sum;
  }, new Decimal(0));
  const hasNetFlowData = txsForCapital.some((tx) => {
    const date = tx.createdAt ? new Date(tx.createdAt).getTime() : Number.NaN;
    const type = String(tx.type ?? '').toLowerCase();
    return Number.isFinite(date)
      && date >= thirtyDaysAgo
      && tx.currency?.toUpperCase() === 'CELO'
      && ['deposit', 'received', 'contribution', 'withdrawal', 'sent'].includes(type);
  });
  type RecentTx = { id: string; type: 'in' | 'swap' | 'out' | 'other'; label?: string; time?: string; amount: number; currency?: string };
  const recentTxs: RecentTx[] = txsForCapital.slice(0, 4).map((tx, i) => {
    const type = String(tx.type ?? '').toLowerCase();
    const txType = type === 'deposit' || type === 'received' || type === 'contribution'
      ? 'in' : type === 'withdrawal' || type === 'sent' ? 'out' : 'other';
    return {
      id: String(tx.id ?? `${type}-${i}-${tx.timestamp ?? ''}`),
      type: txType,
      label: tx.description ?? tx.memo ?? tx.type ?? 'Transfer',
      time: tx.createdAt ? new Date(tx.createdAt).toISOString() : tx.timestamp ? new Date(tx.timestamp).toISOString() : undefined,
      amount: Number(parseDecimal(tx.amount).toNumber()),
      currency: tx.currency ?? 'Unknown',
    };
  });

  // Handle send native
  const handleSendNative = useCallback(async () => {
    const normalizedAddress = sendTo.trim();
    const normalizedAmount = Number(sendAmount);

    if (!normalizedAddress || !/^0x[a-fA-F0-9]{40}$/i.test(normalizedAddress)) {
      setActionError('Enter a valid 0x wallet address.');
      return;
    }

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setActionError('Enter an amount greater than 0.');
      return;
    }
    if (!window.confirm(`Send ${normalizedAmount} CELO to ${normalizedAddress}? This transfer cannot be reversed.`)) return;

    setActionLoading(true);
    setActionError('');
    try {
      const res = await actions.send({ toAddress: normalizedAddress, amount: normalizedAmount.toString(), currency: selectedCurrency });
      if (!res.success) throw new Error(res.error || 'Send failed');
      await refreshBalances();
      setRefreshTrigger((current) => current + 1);
      setSendAmount('');
      setSendTo('');
      setDepositOpen(false);
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err));
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  }, [actions, sendTo, sendAmount, refreshBalances]);

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

  if (!isConnected) {
    return (
      <React.Suspense fallback={<div className="p-8 text-center">Loading wallet...</div>}>
        <Shell
          brand={
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Wallet className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent">Personal Wallet</h1>
                <p className="text-gray-600 text-base sm:text-lg">Secure digital asset management</p>
              </div>
            </div>
          }
        >
          <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:bg-gray-950 flex items-center justify-center px-4">
            <Card className="w-full max-w-xl p-8 text-center">
              <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Wallet className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold mb-3">Connect your wallet</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Connect a wallet to view balances, send transfers, and access wallet features.
              </p>
              {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
              <div className="space-y-3">
                <Button onClick={connectMetaMask} disabled={isLoading} className="w-full">
                  {isLoading ? 'Connecting…' : 'Connect MetaMask'}
                </Button>
                <Button variant="outline" onClick={connectValora} disabled={isLoading} className="w-full">
                  Connect Valora
                </Button>
                <Button variant="outline" onClick={connectMiniPay} disabled={isLoading} className="w-full">
                  Connect MiniPay
                </Button>
              </div>
            </Card>
          </div>
        </Shell>
      </React.Suspense>
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
            <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent">Personal Wallet</h1>
            <p className="text-gray-600 text-base sm:text-lg">Secure digital asset management</p>
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
      {/* Subtle background wash for calm surface */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/2 opacity-5" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Backup Reminder */}
        {isConnected && address && (
          <WalletBackupReminder userId={user?.id} walletAddress={address} />
        )}
        {walletDataError && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load transaction data: {walletDataError}
          </div>
        )}

        {/* Capital overview layer (replaced multiple surfaces with a single focused component) */}
        {isConnected && address && (
          <CapitalLayer
            address={address}
            total={store.total}
            currency="CELO"
            liquidity={store.liquidity}
            deployed={store.deployed}
            pending={store.pendingTotal || '0'}
            pendingCount={store.pendingCount}
            availableVaults={store.availableVaults}
            deployedVaults={store.deployedVaults}
            recentTxs={recentTxs}
            netFlow30d={netFlow30dDec.toNumber()}
            hasNetFlowData={hasNetFlowData}
            onSend={() => setDepositOpen(true)}
            onAddFunds={() => { setRampMode('deposit'); setRampOpen(true); }}
            onSwap={() => setShowSwapModal(true)}
            onViewAll={() => setActiveTab('transactions')}
          />
        )}

        {/* Header with Settings Icon */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="min-w-0 text-sm text-gray-600 dark:text-gray-300">
            Connected: {address?.slice(0, 6)}…{address?.slice(-4)}
          </div>
          <div className="relative shrink-0">
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
                    <button
                      onClick={() => { setRefreshTrigger((current) => current + 1); setSettingsOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center space-x-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Refresh</span>
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center space-x-2" onClick={() => setShowBackupModal(true)}>
                      <Plus className="w-4 h-4" />
                      <span>Backup Wallet</span>
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center space-x-2" onClick={() => { setActiveTab('recurring'); setSettingsOpen(false); }}>
                      <ArrowUpRight className="w-4 h-4" />
                      <span>Recurring Payments</span>
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* Trust Wallet Style Balance & Actions */}
        <div className="mb-8">
          {/* Main Balance Card */}
          <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white p-4 sm:p-8 rounded-3xl relative overflow-hidden mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <p className="text-white/80 text-sm font-medium">Wallet Balance</p>
                  <button
                    onClick={() => setBalanceVisible(!balanceVisible)}
                    className="text-white/60 hover:text-white/80 transition-colors"
                    aria-label={balanceVisible ? 'Hide balance' : 'Show balance'}
                  >
                    {balanceVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-sm text-white/80">CELO</span>
              </div>
              
              <div className="mb-8">
                <h2 className="text-3xl sm:text-5xl font-bold text-white mb-1 break-all">
                  {balanceVisible ? `${balance ?? '0'} CELO` : '••••••'}
                </h2>
                <p className="text-white/70 text-sm">Native wallet balance · USD conversion not available</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Button 
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30 py-3 flex flex-col items-center justify-center"
                  onClick={() => { setRampMode('deposit'); setRampOpen(true); }}
                >
                  <Plus className="w-5 h-5 mb-1" />
                  <span className="text-xs">Deposit</span>
                </Button>
                <Button 
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30 py-3 flex flex-col items-center justify-center"
                  onClick={() => { setRampMode('withdraw'); setRampOpen(true); }}
                >
                  <ArrowUpRight className="w-5 h-5 mb-1" />
                  <span className="text-xs">Withdraw</span>
                </Button>
                <Button 
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30 py-3 flex flex-col items-center justify-center"
                  onClick={() => setPaymentRequestOpen(true)}
                >
                  <ArrowDownLeft className="w-5 h-5 mb-1" />
                  <span className="text-xs">Request</span>
                </Button>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <button
              onClick={() => setPaymentLinkOpen(true)}
              className="bg-gray-50/80 dark:bg-gray-900/40 p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:shadow-md transition-colors text-left"
            >
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <Copy className="w-5 h-5 text-amber-700" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Create Payment Link</h3>
              <p className="text-sm text-gray-500">Generate a shareable payment link</p>
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
            <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
              <TabsTrigger className="min-w-0 px-2 text-xs sm:text-sm" value="overview">Overview</TabsTrigger>
              <TabsTrigger className="min-w-0 px-2 text-xs sm:text-sm" value="transactions">Transactions</TabsTrigger>
              <TabsTrigger className="min-w-0 px-2 text-xs sm:text-sm" value="recurring">Recurring</TabsTrigger>
              <TabsTrigger className="min-w-0 px-2 text-xs sm:text-sm" value="vouchers">Vouchers</TabsTrigger>
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

      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Send CELO</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label htmlFor="send-address" className="sr-only">Recipient wallet address</label>
            <input id="send-address" type="text" placeholder="Recipient 0x address" className="w-full p-3 border rounded" value={sendTo} onChange={e => setSendTo(e.target.value)} />
            <label htmlFor="send-amount" className="sr-only">Amount in CELO</label>
            <input id="send-amount" type="number" min="0" step="any" placeholder="Amount (CELO)" className="w-full p-3 border rounded" value={sendAmount} onChange={e => setSendAmount(e.target.value)} />
            {actionError && <p role="alert" className="text-red-500">{actionError}</p>}
            <Button onClick={handleSendNative} className="w-full" disabled={actionLoading}>{actionLoading ? 'Sending...' : 'Review and send'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rampOpen} onOpenChange={setRampOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{rampMode === 'deposit' ? 'Deposit to your wallet' : 'Withdraw from your wallet'}</DialogTitle>
            <DialogDescription>
              Use the connected Celo wallet and KotaniPay M-Pesa flow. Review the live quote and settlement status before starting.
            </DialogDescription>
          </DialogHeader>
          <Tabs value={rampMode} onValueChange={(value) => setRampMode(value as 'deposit' | 'withdraw')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="deposit">Deposit</TabsTrigger>
              <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
            </TabsList>
            <TabsContent value="deposit">
              <StablecoinWalletPanel mode="receive" />
            </TabsContent>
            <TabsContent value="withdraw">
              <StablecoinWalletPanel mode="send" />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

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