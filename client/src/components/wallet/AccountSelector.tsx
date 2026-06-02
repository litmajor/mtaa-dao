import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, Vault, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiGet } from '@/lib/api';
import { useWalletOperatingStore } from '@/stores/wallet-operating-store';

interface Account {
  id: string;
  userId: string;
  type: 'wallet' | 'trading' | 'vault' | 'escrow';
  address?: string;
  balance: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

interface AccountSelectorProps {
  onAccountSelect?: (account: Account) => void;
  selectedAccountId?: string;
  className?: string;
}

const AccountSelector: React.FC<AccountSelectorProps> = ({
  onAccountSelect,
  selectedAccountId,
  className = '',
}) => {
  const store = useWalletOperatingStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'wallet' | 'trading' | 'vault' | 'escrow'>('wallet');

  // Derive account list from operating store vaults to keep UI consistent with central state
  const accounts: Account[] = (store.vaults || []).map((v) => {
    const type = v.type === 'escrow' ? 'escrow' : v.type === 'deployed' || v.type === 'yield' ? 'trading' : v.locked ? 'vault' : 'wallet';
    return {
      id: v.id,
      userId: '',
      type: type as any,
      address: undefined,
      balance: String(v.balance || '0'),
      currency: v.currency || 'TOKEN',
      createdAt: '',
      updatedAt: ''
    } as Account;
  });

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'wallet':
        return <Wallet className="w-5 h-5" />;
      case 'trading':
        return <TrendingUp className="w-5 h-5" />;
      case 'vault':
        return <Vault className="w-5 h-5" />;
      case 'escrow':
        return <Lock className="w-5 h-5" />;
      default:
        return <Wallet className="w-5 h-5" />;
    }
  };

  const getAccountColor = (type: string) => {
    switch (type) {
      case 'wallet':
        return 'from-blue-500 to-blue-600';
      case 'trading':
        return 'from-emerald-500 to-emerald-600';
      case 'vault':
        return 'from-purple-500 to-purple-600';
      case 'escrow':
        return 'from-orange-500 to-orange-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const getAccountDescription = (type: string) => {
    switch (type) {
      case 'wallet':
        return 'Primary account for deposits and withdrawals';
      case 'trading':
        return 'Active trading and asset exchanges';
      case 'vault':
        return 'Locked savings with interest earning';
      case 'escrow':
        return 'Secure escrow for deals and transactions';
      default:
        return '';
    }
  };

  const handleAccountSelect = (account: Account) => {
    // update operating store selection as the single source of truth
    store.setSelectedAccountId(account.id);
    store.setSelectedAccount(account);
    onAccountSelect?.(account);
  };
  const filteredAccounts = accounts.filter((acc) => acc.type === selectedTab);
  const selectedAccount = accounts.find((acc) => acc.id === (selectedAccountId || store.selectedAccountId)) || filteredAccounts[0];

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Loading Accounts...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`${className} border-red-200 bg-red-50`}>
        <CardHeader>
          <CardTitle className="text-red-600">Error Loading Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <Tabs value={selectedTab} onValueChange={(val) => setSelectedTab(val as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="wallet" className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            <span className="hidden sm:inline">Wallet</span>
          </TabsTrigger>
          <TabsTrigger value="trading" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Trading</span>
          </TabsTrigger>
          <TabsTrigger value="vault" className="flex items-center gap-2">
            <Vault className="w-4 h-4" />
            <span className="hidden sm:inline">Vault</span>
          </TabsTrigger>
          <TabsTrigger value="escrow" className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            <span className="hidden sm:inline">Escrow</span>
          </TabsTrigger>
        </TabsList>

        {/* Wallet Account Tab */}
        <TabsContent value="wallet" className="space-y-4">
          {filteredAccounts.length > 0 ? (
            filteredAccounts.map((account) => (
              <Card
                key={account.id}
                className={`cursor-pointer transition-all ${
                  selectedAccountId === account.id
                    ? 'ring-2 ring-blue-500 shadow-lg'
                    : 'hover:shadow-md'
                }`}
                onClick={() => handleAccountSelect(account)}
              >
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${getAccountColor('wallet')} rounded-lg flex items-center justify-center text-white`}>
                      {getAccountIcon('wallet')}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">Primary Wallet</CardTitle>
                      <CardDescription>{getAccountDescription('wallet')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">
                    {parseFloat(account.balance).toFixed(2)} {account.currency}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Address: {account.address?.slice(0, 10)}...{account.address?.slice(-8)}
                  </p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500">No wallet account found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Trading Account Tab */}
        <TabsContent value="trading" className="space-y-4">
          {filteredAccounts.length > 0 ? (
            filteredAccounts.map((account) => (
              <Card
                key={account.id}
                className={`cursor-pointer transition-all ${
                  selectedAccountId === account.id
                    ? 'ring-2 ring-emerald-500 shadow-lg'
                    : 'hover:shadow-md'
                }`}
                onClick={() => handleAccountSelect(account)}
              >
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${getAccountColor('trading')} rounded-lg flex items-center justify-center text-white`}>
                      {getAccountIcon('trading')}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">Trading Account</CardTitle>
                      <CardDescription>{getAccountDescription('trading')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">
                    {parseFloat(account.balance).toFixed(2)} {account.currency}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Address: {account.address?.slice(0, 10)}...{account.address?.slice(-8)}
                  </p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500">No trading account found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Vault Account Tab */}
        <TabsContent value="vault" className="space-y-4">
          {filteredAccounts.length > 0 ? (
            filteredAccounts.map((account) => (
              <Card
                key={account.id}
                className={`cursor-pointer transition-all ${
                  selectedAccountId === account.id
                    ? 'ring-2 ring-purple-500 shadow-lg'
                    : 'hover:shadow-md'
                }`}
                onClick={() => handleAccountSelect(account)}
              >
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${getAccountColor('vault')} rounded-lg flex items-center justify-center text-white`}>
                      {getAccountIcon('vault')}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">Vault Account</CardTitle>
                      <CardDescription>{getAccountDescription('vault')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">
                    {parseFloat(account.balance).toFixed(2)} {account.currency}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Address: {account.address?.slice(0, 10)}...{account.address?.slice(-8)}
                  </p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500">No vault account found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Escrow Account Tab */}
        <TabsContent value="escrow" className="space-y-4">
          {filteredAccounts.length > 0 ? (
            filteredAccounts.map((account) => (
              <Card
                key={account.id}
                className={`cursor-pointer transition-all ${
                  selectedAccountId === account.id
                    ? 'ring-2 ring-orange-500 shadow-lg'
                    : 'hover:shadow-md'
                }`}
                onClick={() => handleAccountSelect(account)}
              >
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${getAccountColor('escrow')} rounded-lg flex items-center justify-center text-white`}>
                      {getAccountIcon('escrow')}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">Escrow Account</CardTitle>
                      <CardDescription>{getAccountDescription('escrow')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">
                    {parseFloat(account.balance).toFixed(2)} {account.currency}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Address: {account.address?.slice(0, 10)}...{account.address?.slice(-8)}
                  </p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500">No escrow account found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AccountSelector;
