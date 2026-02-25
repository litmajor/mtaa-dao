/**
 * WalletDashboard Component
 * Main wallet interface with deposits, withdrawals, and account management
 */

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, TrendingUp, Lock, Wallet } from 'lucide-react';
import BalanceOverview from './BalanceOverview';
import DepositTab from './tabs/DepositTab';
import WithdrawTab from './tabs/WithdrawTab';
import TransactionsTab from './tabs/TransactionsTab';
import MicroWithdrawalsTab from './tabs/MicroWithdrawalsTab';
import AccountManagementTab from './tabs/AccountManagementTab';

interface WalletAccount {
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

export default function WalletDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch wallet summary
  const { data: walletSummary, isLoading: summaryLoading } = useQuery<WalletSummary>({
    queryKey: ['walletSummary'],
    queryFn: async () => {
      const response = await fetch('/api/accounts/summary', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Failed to fetch wallet summary');
      const result = await response.json();
      return result.data;
    },
    staleTime: 30000, // 30 seconds
  });

  // Fetch deposit methods
  const { data: depositMethods, isLoading: depositMethodsLoading } = useQuery<DepositMethod[]>({
    queryKey: ['depositMethods'],
    queryFn: async () => {
      const response = await fetch('/api/deposits/methods', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Failed to fetch deposit methods');
      const result = await response.json();
      return result.data;
    },
  });

  // Fetch withdrawal methods
  const { data: withdrawalMethods, isLoading: withdrawalMethodsLoading } = useQuery<WithdrawalMethod[]>({
    queryKey: ['withdrawalMethods'],
    queryFn: async () => {
      const response = await fetch('/api/withdrawals/methods', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Failed to fetch withdrawal methods');
      const result = await response.json();
      return result.data;
    },
  });

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Wallet Dashboard</h1>
        <p className="text-gray-400">Manage your accounts, deposits, and withdrawals</p>
      </div>

      {/* Balance Overview Cards */}
      <div className="max-w-7xl mx-auto mb-8">
        {walletSummary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Primary Wallet Card */}
            {walletSummary.accounts
              .filter((acc) => acc.accountType === 'wallet')
              .map((acc) => (
                <BalanceOverview
                  key={acc.id}
                  account={acc}
                  icon={<Wallet className="w-6 h-6" />}
                  color="from-blue-600 to-blue-900"
                />
              ))}

            {/* Trading Card */}
            {walletSummary.accounts
              .filter((acc) => acc.accountType === 'trading')
              .map((acc) => (
                <BalanceOverview
                  key={acc.id}
                  account={acc}
                  icon={<TrendingUp className="w-6 h-6" />}
                  color="from-green-600 to-green-900"
                />
              ))}

            {/* Vault Card */}
            {walletSummary.accounts
              .filter((acc) => acc.accountType === 'vault')
              .map((acc) => (
                <BalanceOverview
                  key={acc.id}
                  account={acc}
                  icon={<Lock className="w-6 h-6" />}
                  color="from-purple-600 to-purple-900"
                />
              ))}

            {/* Escrow Card */}
            {walletSummary.accounts
              .filter((acc) => acc.accountType === 'escrow')
              .map((acc) => (
                <BalanceOverview
                  key={acc.id}
                  account={acc}
                  icon={<DollarSign className="w-6 h-6" />}
                  color="from-orange-600 to-orange-900"
                />
              ))}

            {/* Net Worth Card */}
            <Card className="bg-gradient-to-br from-cyan-600 to-cyan-900 border-0">
              <CardContent className="pt-6">
                <div className="text-sm text-cyan-200 mb-2">Total Net Worth</div>
                <div className="text-2xl font-bold text-white">
                  ${walletSummary.netWorth}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Main Tabs */}
      <div className="max-w-7xl mx-auto">
        <Card className="bg-gray-800 border-gray-700">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-6 bg-gray-900 border-b border-gray-700 rounded-none">
              <TabsTrigger value="overview" className="rounded-none">
                Overview
              </TabsTrigger>
              <TabsTrigger value="deposit" className="rounded-none">
                Deposit
              </TabsTrigger>
              <TabsTrigger value="withdraw" className="rounded-none">
                Withdraw
              </TabsTrigger>
              <TabsTrigger value="transactions" className="rounded-none">
                Transactions
              </TabsTrigger>
              <TabsTrigger value="micro-withdrawals" className="rounded-none">
                Micro Withdraw
              </TabsTrigger>
              <TabsTrigger value="accounts" className="rounded-none">
                Accounts
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="p-6">
              <div className="space-y-6">
                {walletSummary && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Account Details */}
                    <Card className="bg-gray-700 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-white">Your Accounts</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {walletSummary.accounts.map((account) => (
                          <div
                            key={account.id}
                            className="flex justify-between items-center p-3 bg-gray-800 rounded border border-gray-600"
                          >
                            <span className="capitalize text-gray-200">{account.accountType}</span>
                            <span className="font-semibold text-white">
                              {account.balance} {account.currency}
                            </span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card className="bg-gray-700 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-white">Quick Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <button
                          onClick={() => setActiveTab('deposit')}
                          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition"
                        >
                          Deposit Funds
                        </button>
                        <button
                          onClick={() => setActiveTab('withdraw')}
                          className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded transition"
                        >
                          Withdraw Funds
                        </button>
                        <button
                          onClick={() => setActiveTab('accounts')}
                          className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded transition"
                        >
                          Transfer Between Accounts
                        </button>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="deposit" className="p-6">
              {depositMethods && (
                <DepositTab methods={depositMethods} accounts={walletSummary?.accounts || []} />
              )}
            </TabsContent>

            <TabsContent value="withdraw" className="p-6">
              {withdrawalMethods && (
                <WithdrawTab methods={withdrawalMethods} accounts={walletSummary?.accounts || []} />
              )}
            </TabsContent>

            <TabsContent value="transactions" className="p-6">
              <TransactionsTab />
            </TabsContent>

            <TabsContent value="micro-withdrawals" className="p-6">
              <MicroWithdrawalsTab />
            </TabsContent>

            <TabsContent value="accounts" className="p-6">
              {walletSummary && (
                <AccountManagementTab accounts={walletSummary.accounts} />
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
