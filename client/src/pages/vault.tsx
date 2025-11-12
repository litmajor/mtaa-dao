
import React, { useState } from 'react';
import { Plus, TrendingUp, Target, DollarSign, ArrowUpRight, Sparkles, Crown, Award, Zap, Eye, RefreshCw, AlertTriangle, Rocket, Wallet as WalletIcon, Users, Activity, PieChart } from 'lucide-react';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { useVaultInfo, useVaultBalance, useVaultPerformance, useVaultTransactions } from './hooks/useVault';
import { useWallet } from './hooks/useWallet';
import { DepositModal } from '../components/vault/DepositModal';
import { WithdrawalModal } from '../components/vault/WithdrawalModal';
import VaultContextIndicator from '../components/vault/VaultContextIndicator';
import VaultCreationWizard from '../components/vault/VaultCreationWizard';
import { Dialog, DialogContent } from '../components/ui/dialog';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const DEMO_VAULT_ADDRESS = "0x1234567890123456789012345678901234567890";

const VaultDashboard = () => {
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showCreationWizard, setShowCreationWizard] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"24h" | "7d" | "30d">("7d");
  const [activeTab, setActiveTab] = useState("overview");

  const handleVaultCreated = (vaultId: string) => {
    setShowCreationWizard(false);
    window.location.href = `/vault/${vaultId}`;
  };

  const { address, isConnected } = useAccount();
  const { connectMetaMask, isLoading: isConnecting } = useWallet();

  const { data: vaultInfo, isLoading: vaultInfoLoading, error: vaultInfoError } = useVaultInfo(DEMO_VAULT_ADDRESS);
  const { data: vaultBalance, isLoading: balanceLoading, refetch: refetchBalance } = useVaultBalance(address || '', DEMO_VAULT_ADDRESS);
  const { data: performance, isLoading: performanceLoading } = useVaultPerformance(DEMO_VAULT_ADDRESS, selectedPeriod);
  const { data: transactions, isLoading: transactionsLoading } = useVaultTransactions(DEMO_VAULT_ADDRESS);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20">
          <Crown className="w-16 h-16 mx-auto mb-4 text-blue-600" />
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-gray-600 mb-6">Connect your wallet to access the Maono Vault dashboard</p>
          <Button onClick={connectMetaMask} disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        </Card>
      </div>
    );
  }

  if (vaultInfoError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20">
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
      <VaultContextIndicator 
        currentVault="maono" 
        onNavigateBack={() => window.location.href = '/vault/selector'}
      />
      
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
              <p className="text-gray-600 text-lg">Professional DeFi vault management</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Badge className="flex items-center space-x-1 bg-gradient-to-r from-yellow-400 to-orange-500">
              <Sparkles className="w-4 h-4" />
              <span>Premium Vault</span>
            </Badge>
            <Button 
              onClick={() => setShowCreationWizard(true)}
              variant="outline"
              className="border-2 border-purple-300 hover:bg-purple-50"
            >
              <Rocket className="mr-2 h-5 w-5" />
              Launch App
            </Button>
            <Button onClick={() => setShowDepositModal(true)}>
              <Plus className="mr-2 h-5 w-5" />
              Deposit
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <Card className="p-6 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl flex items-center justify-center">
                <WalletIcon className="w-6 h-6 text-white" />
              </div>
              <Badge className="bg-gradient-to-r from-emerald-400 to-teal-500 text-white">TVL</Badge>
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

          <Card className="p-6 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">Balance</Badge>
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

          <Card className="p-6 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">APY</Badge>
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

          <Card className="p-6 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">Price</Badge>
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

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-white/80 backdrop-blur-xl rounded-xl p-1">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="flex items-center gap-2">
              <PieChart className="w-4 h-4" />
              Portfolio
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="governance" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Governance
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <Card className="p-8 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">Performance Chart</h2>
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
                      <p className="text-gray-500">Performance visualization coming soon</p>
                    </div>
                  )}
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="p-6 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20">
                  <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <Button onClick={() => setShowDepositModal(true)} className="w-full">
                      <Plus className="mr-2 h-4 w-4" />
                      Deposit Funds
                    </Button>
                    <Button onClick={() => setShowWithdrawModal(true)} variant="outline" className="w-full">
                      <ArrowUpRight className="mr-2 h-4 w-4" />
                      Withdraw
                    </Button>
                    <Button onClick={() => refetchBalance()} variant="outline" className="w-full">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh Balance
                    </Button>
                  </div>
                </Card>

                <Card className="p-6 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20">
                  <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
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
                      <p className="text-gray-500 text-sm text-center py-4">No transactions yet</p>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Portfolio Tab */}
          <TabsContent value="portfolio">
            <Card className="p-8 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20">
              <h2 className="text-2xl font-bold mb-6">Portfolio Allocation</h2>
              <div className="h-96 flex items-center justify-center bg-gray-50 rounded-lg">
                <p className="text-gray-500">Portfolio allocation visualization coming soon</p>
              </div>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <Card className="p-8 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20">
              <h2 className="text-2xl font-bold mb-6">Transaction History</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4">Date</th>
                      <th className="text-left py-3 px-4">Type</th>
                      <th className="text-left py-3 px-4">Token</th>
                      <th className="text-right py-3 px-4">Amount</th>
                      <th className="text-right py-3 px-4">Value (USD)</th>
                      <th className="text-center py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactionsLoading ? (
                      <tr><td colSpan={6} className="text-center py-8"><div className="animate-pulse">Loading...</div></td></tr>
                    ) : transactions?.data?.length > 0 ? (
                      transactions.data.map((tx: any, index: number) => (
                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">{new Date(tx.createdAt).toLocaleDateString()}</td>
                          <td className="py-3 px-4 capitalize">{tx.transactionType}</td>
                          <td className="py-3 px-4">{tx.tokenSymbol}</td>
                          <td className="py-3 px-4 text-right font-medium">{tx.amount}</td>
                          <td className="py-3 px-4 text-right">${tx.valueUSD}</td>
                          <td className="py-3 px-4 text-center">
                            <Badge className={tx.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                              {tx.status}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={6} className="text-center py-8 text-gray-500">No transactions found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-8 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20">
                <h2 className="text-2xl font-bold mb-6">Risk Analysis</h2>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                  <p className="text-gray-500">Risk metrics coming soon</p>
                </div>
              </Card>
              <Card className="p-8 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20">
                <h2 className="text-2xl font-bold mb-6">Yield Breakdown</h2>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                  <p className="text-gray-500">Yield analysis coming soon</p>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Governance Tab */}
          <TabsContent value="governance">
            <Card className="p-8 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20">
              <h2 className="text-2xl font-bold mb-6">Governance Proposals</h2>
              <div className="h-96 flex items-center justify-center bg-gray-50 rounded-lg">
                <p className="text-gray-500">Governance interface coming soon</p>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <DepositModal open={showDepositModal} onOpenChange={setShowDepositModal} />
      <WithdrawalModal open={showWithdrawModal} onOpenChange={setShowWithdrawModal} vaultAddress={DEMO_VAULT_ADDRESS} />
      <Dialog open={showCreationWizard} onOpenChange={setShowCreationWizard}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <VaultCreationWizard onClose={() => setShowCreationWizard(false)} onSuccess={handleVaultCreated} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VaultDashboard;
