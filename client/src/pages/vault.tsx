import React, { useState, useEffect } from 'react';
import { Plus, TrendingUp, Target, DollarSign, ArrowUpRight, Sparkles, Crown, Award, Zap, Eye, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { useVaultInfo, useVaultBalance, useVaultPerformance, useVaultTransactions } from './hooks/useVault';
import { useWallet } from './hooks/useWallet';
import DepositModal from '../components/vault/DepositModal';
import WithdrawalModal from '../components/vault/WithdrawalModal';

const DEMO_VAULT_ADDRESS = "0x1234567890123456789012345678901234567890"; // Replace with actual deployed vault

const VaultDashboard = () => {
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"24h" | "7d" | "30d">("7d");

  const { address, isConnected } = useAccount();
  const { connectWallet, isConnecting } = useWallet();

  // Vault data hooks
  const { data: vaultInfo, isLoading: vaultInfoLoading, error: vaultInfoError } = useVaultInfo(DEMO_VAULT_ADDRESS);
  const { data: vaultBalance, isLoading: balanceLoading, refetch: refetchBalance } = useVaultBalance(address || '', DEMO_VAULT_ADDRESS);
  const { data: performance, isLoading: performanceLoading } = useVaultPerformance(DEMO_VAULT_ADDRESS, selectedPeriod);
  const { data: transactions, isLoading: transactionsLoading } = useVaultTransactions(DEMO_VAULT_ADDRESS);

  const Card: React.FC<{ children: React.ReactNode; className?: string; hover?: boolean }> = ({ children, className = "", hover = false }) => (
    <div className={`bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 ${hover ? 'hover:shadow-2xl hover:scale-[1.02] transition-all duration-300' : ''} ${className}`}>
      {children}
    </div>
  );

  const Badge: React.FC<{ children: React.ReactNode; variant?: "default" | "gold" | "emerald" | "purple" | "red" }> = ({ children, variant = "default" }) => {
    const variants = {
      default: "bg-gradient-to-r from-blue-500 to-purple-600",
      gold: "bg-gradient-to-r from-yellow-400 to-orange-500",
      emerald: "bg-gradient-to-r from-emerald-400 to-teal-500",
      purple: "bg-gradient-to-r from-purple-500 to-pink-500",
      red: "bg-gradient-to-r from-red-500 to-pink-500"
    };

    return (
      <span className={`${variants[variant]} text-white text-xs font-semibold px-3 py-1 rounded-full`}>
        {children}
      </span>
    );
  };

  const Button: React.FC<{ children: React.ReactNode; onClick?: () => void; variant?: "default" | "outline"; disabled?: boolean }> = ({ 
    children, onClick, variant = "default", disabled = false 
  }) => {
    const variants = {
      default: "bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl",
      outline: "border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
    };

    return (
      <button 
        onClick={onClick}
        disabled={disabled}
        className={`${variants[variant]} px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {children}
      </button>
    );
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <Crown className="w-16 h-16 mx-auto mb-4 text-blue-600" />
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-gray-600 mb-6">Connect your wallet to access the Maono Vault dashboard</p>
          <Button onClick={connectWallet} disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        </Card>
      </div>
    );
  }

  if (vaultInfoError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-600" />
          <h2 className="text-2xl font-bold mb-4">Connection Error</h2>
          <p className="text-gray-600 mb-6">Unable to connect to vault contract. Please try again.</p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(typeof value === 'string' ? parseFloat(value) : value);
  };

  const formatNumber = (value: bigint | string, decimals: number = 18) => {
    if (typeof value === 'bigint') {
      return parseFloat(formatEther(value)).toFixed(4);
    }
    return parseFloat(value).toFixed(4);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/5 via-purple-400/5 to-pink-400/5" />
      <div className="absolute top-0 left-0 w-72 h-72 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent mb-2">
                Maono Vault
              </h1>
              <p className="text-gray-600 text-lg">Your DeFi vault dashboard</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="gold" className="flex items-center space-x-1">
              <Sparkles className="w-4 h-4" />
              <span>Premium Vault</span>
            </Badge>
            <Button onClick={() => setShowDepositModal(true)}>
              <Plus className="mr-2 h-5 w-5" />
              Deposit
            </Button>
          </div>
        </div>

        {/* Vault Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <Card hover className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl flex items-center justify-center">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <Badge variant="emerald">TVL</Badge>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {vaultInfoLoading ? (
                <div className="animate-pulse bg-gray-300 rounded h-6 w-24"></div>
              ) : vaultInfo ? (
                formatCurrency(formatNumber(vaultInfo.tvl))
              ) : '-'}
            </h3>
            <p className="text-gray-600 text-sm">Total Value Locked</p>
          </Card>

          <Card hover className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <Badge variant="purple">My Balance</Badge>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {balanceLoading ? (
                <div className="animate-pulse bg-gray-300 rounded h-6 w-24"></div>
              ) : vaultBalance ? (
                formatCurrency(vaultBalance.valueUSD)
              ) : '$0.00'}
            </h3>
            <p className="text-gray-600 text-sm">
              {vaultBalance ? `${formatNumber(vaultBalance.shares)} shares` : '0 shares'}
            </p>
          </Card>

          <Card hover className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <Badge variant="gold">APY</Badge>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {performanceLoading ? (
                <div className="animate-pulse bg-gray-300 rounded h-6 w-16"></div>
              ) : performance ? (
                `${performance.apy || '8.5'}%`
              ) : '8.5%'}
            </h3>
            <p className="text-gray-600 text-sm">Annual Percentage Yield</p>
          </Card>

          <Card hover className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <Badge variant="default">Share Price</Badge>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {vaultInfoLoading ? (
                <div className="animate-pulse bg-gray-300 rounded h-6 w-20"></div>
              ) : vaultInfo ? (
                `$${formatNumber(vaultInfo.sharePrice)}`
              ) : '$1.00'}
            </h3>
            <p className="text-gray-600 text-sm">Per Share Value</p>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Vault Performance Chart */}
          <div className="lg:col-span-2">
            <Card className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Performance</h2>
                <div className="flex gap-2">
                  {(['24h', '7d', '30d'] as const).map((period) => (
                    <button
                      key={period}
                      onClick={() => setSelectedPeriod(period)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        selectedPeriod === period
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>

              {performanceLoading ? (
                <div className="animate-pulse bg-gray-300 rounded h-64"></div>
              ) : (
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                  <p className="text-gray-500">Performance chart will be implemented with real data</p>
                </div>
              )}
            </Card>
          </div>

          {/* Actions Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="p-6">
              <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button 
                  onClick={() => setShowDepositModal(true)}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Deposit Funds
                </Button>
                <Button 
                  onClick={() => setShowWithdrawModal(true)}
                  variant="outline"
                  className="w-full"
                >
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  Withdraw
                </Button>
                <Button 
                  onClick={() => refetchBalance()}
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Balance
                </Button>
              </div>
            </Card>

            {/* Recent Transactions */}
            <Card className="p-6">
              <h3 className="text-lg font-bold mb-4">Recent Transactions</h3>
              <div className="space-y-3">
                {transactionsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse bg-gray-300 rounded h-12"></div>
                    ))}
                  </div>
                ) : transactions?.data?.length > 0 ? (
                  transactions.data.slice(0, 5).map((tx: any, index: number) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-medium text-sm capitalize">{tx.transactionType}</p>
                        <p className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium text-sm ${tx.transactionType === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.transactionType === 'deposit' ? '+' : '-'}{tx.amount} {tx.tokenSymbol}
                        </p>
                        <p className="text-xs text-gray-500">${tx.valueUSD}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No transactions yet</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Modals */}
      <DepositModal 
        open={showDepositModal} 
        onOpenChange={setShowDepositModal}
      />
      <WithdrawalModal 
        open={showWithdrawModal} 
        onOpenChange={setShowWithdrawModal}
        vaultAddress={DEMO_VAULT_ADDRESS}
      />
    </div>
  );
};

export default VaultDashboard;