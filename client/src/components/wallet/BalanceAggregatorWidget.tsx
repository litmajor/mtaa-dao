import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Badge 
} from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
// @ts-ignore - Icons are properly exported, type definition issue
// @ts-ignore
import { Wallet, TrendingUp, Users, DollarSign, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
// @ts-ignore
import { Lock, Zap, RefreshCw, Eye, EyeOff, TrendingDown } from 'lucide-react';
import { useBalanceAggregator } from '@/pages/hooks/useBalanceAggregator';
import { useQuery } from '@tanstack/react-query';
import { PriceBadge } from './PriceDisplay';

const BalanceAggregatorWidget: React.FC = () => {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [currencyPreferences, setCurrencyPreferences] = useState({
    primary: 'cUSD',
    secondary: 'KES'
  });
  const aggregator = useBalanceAggregator();

  // Fetch user currency preferences
  const { data: preferences } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      const response = await fetch('/api/user-preferences');
      if (!response.ok) throw new Error('Failed to fetch preferences');
      const data = await response.json();
      return data.data;
    },
    staleTime: Infinity,
    retry: 1
  } as any);

  // Fetch exchange rates for conversions
  const { data: exchangeRates = {} } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: async () => {
      const response = await fetch('/api/wallet/exchange-rates');
      if (!response.ok) throw new Error('Failed to fetch rates');
      const data = await response.json();
      return data.rates || {};
    },
    staleTime: 30000, // 30 seconds
    retry: 1
  } as any);

  useEffect(() => {
    if (preferences && typeof preferences === 'object' && 'primaryCurrency' in preferences) {
      setCurrencyPreferences({
        primary: (preferences as any).primaryCurrency || 'cUSD',
        secondary: (preferences as any).secondaryCurrency || 'KES'
      });
    }
  }, [preferences]);

  // Convert amount between currencies
  const convertAmount = (amount: string | number, from: string, to: string): string => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (from === to) return numAmount.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (!exchangeRates || typeof exchangeRates !== 'object' || Object.keys(exchangeRates).length === 0) return numAmount.toLocaleString('en-US', { maximumFractionDigits: 2 });

    const rates = exchangeRates as Record<string, any>;
    const rateKey = `${from}-${to}`;
    if (rates[rateKey]) {
      const converted = numAmount * rates[rateKey].rate;
      return converted.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }

    const reverseKey = `${to}-${from}`;
    if (rates[reverseKey]) {
      const converted = numAmount / rates[reverseKey].rate;
      return converted.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }

    return numAmount.toLocaleString('en-US', { maximumFractionDigits: 2 });
  };

  if (aggregator.isLoading && aggregator.totalValueUSD === '0') {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-300 rounded-lg"></div>
          <div className="h-12 bg-gray-300 rounded-lg"></div>
        </div>
      </div>
    );
  }

  // Convert USD balance to selected currencies
  const usdBalance = parseFloat(aggregator.totalValueUSD);
  const primaryBalance = convertAmount(usdBalance, 'USD', currencyPreferences.primary);
  const secondaryBalance = convertAmount(usdBalance, 'USD', currencyPreferences.secondary);

  return (
    <div className="space-y-6">
      {/* Main Balance Card with Dual Currency Display */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 border-blue-200 dark:border-blue-900">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Portfolio Balance</CardTitle>
              <CardDescription>
                Aggregated across all wallets and investments
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBalanceVisible(!balanceVisible)}
                className="gap-2"
              >
                {balanceVisible ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => aggregator.refetch()}
                disabled={aggregator.isLoading}
                className="gap-2"
              >
                <RefreshCw
                  className={`w-4 h-4 ${aggregator.isLoading ? 'animate-spin' : ''}`}
                />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Primary Currency Display */}
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Primary Display</p>
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                {balanceVisible ? `${currencyPreferences.primary} ${primaryBalance}` : '••••••'}
              </div>
            </div>

            {/* Secondary Currency Display */}
            <div className="pt-4 border-t border-blue-200 dark:border-blue-800">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Secondary Display (Real-time)</p>
              <div className="text-3xl font-semibold text-indigo-600 dark:text-indigo-400">
                {balanceVisible ? `${currencyPreferences.secondary} ${secondaryBalance}` : '••••••'}
              </div>
            </div>

            {/* Metadata */}
            <div className="pt-2 text-xs text-gray-500 dark:text-gray-500">
              Last updated: {aggregator.lastUpdated instanceof Date
                ? aggregator.lastUpdated.toLocaleTimeString()
                : aggregator.lastUpdated
                  ? new Date(aggregator.lastUpdated).toString() !== 'Invalid Date'
                    ? new Date(aggregator.lastUpdated).toLocaleTimeString()
                    : 'N/A'
                  : 'Never'}
              {exchangeRates && typeof exchangeRates === 'object' && Object.keys(exchangeRates as Record<string, any>).length > 0 ? (
                <p>Exchange rates refresh every 30 seconds</p>
              ) : null}
            </div>
          </div>
          {aggregator.error && (
            <p className="text-sm text-red-600 mt-2">{aggregator.error}</p>
          )}
        </CardContent>
      </Card>

      {/* Wallet Providers Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Connected Wallets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {aggregator.providers.map((provider: any) => (
              <div
                key={provider.id}
                className={`p-4 rounded-lg border-2 transition-all ${
                  provider.isConnected
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{provider.icon}</span>
                  {provider.isConnected && (
                    <Badge className="bg-emerald-600">Connected</Badge>
                  )}
                </div>
                <p className="font-semibold text-sm mb-1">{provider.name}</p>
                {provider.address && (
                  <p className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate">
                    {provider.address.slice(0, 6)}...{provider.address.slice(-4)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Balance Breakdown by Category */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="gap-2">
            <DollarSign className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="wallet" className="gap-2">
            <Wallet className="w-4 h-4" />
            <span className="hidden sm:inline">Wallet</span>
          </TabsTrigger>
          <TabsTrigger value="pools" className="gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Pools</span>
          </TabsTrigger>
          <TabsTrigger value="vaults" className="gap-2">
            <Lock className="w-4 h-4" />
            <span className="hidden sm:inline">Vaults</span>
          </TabsTrigger>
          <TabsTrigger value="staking" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Staking</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Balance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Native Balance */}
                <BalanceCategory
                  icon={<Wallet className="w-5 h-5" />}
                  title="Native Balance"
                  amount={aggregator.breakdown.nativeBalance.amount}
                  symbol={aggregator.breakdown.nativeBalance.symbol}
                  valueUSD={aggregator.breakdown.nativeBalance.valueUSD}
                  visible={balanceVisible}
                  unitPrice={(exchangeRates as Record<string, any>)[`${aggregator.breakdown.nativeBalance.symbol}-USD`]?.rate}
                  priceChangePercent={
                    (exchangeRates as Record<string, any>)[`${aggregator.breakdown.nativeBalance.symbol}-USD`]?.change24h
                      ? (((exchangeRates as Record<string, any>)[`${aggregator.breakdown.nativeBalance.symbol}-USD`].change24h / (exchangeRates as Record<string, any>)[`${aggregator.breakdown.nativeBalance.symbol}-USD`].rate) * 100)
                      : 0
                  }
                />

                {/* Tokens */}
                {aggregator.breakdown.tokens.length > 0 && (
                  <BalanceCategory
                    icon={<DollarSign className="w-5 h-5" />}
                    title="Token Holdings"
                    count={aggregator.breakdown.tokens.length}
                    valueUSD={aggregator
                      .getCategoryTotal('tokens')}
                    visible={balanceVisible}
                  />
                )}

                {/* Investment Pools */}
                {aggregator.breakdown.investmentPools.length > 0 && (
                  <BalanceCategory
                    icon={<Users className="w-5 h-5" />}
                    title="Investment Pools"
                    count={aggregator.breakdown.investmentPools.length}
                    valueUSD={aggregator.getCategoryTotal('investmentPools')}
                    visible={balanceVisible}
                  />
                )}

                {/* Vaults */}
                {aggregator.breakdown.vaults.length > 0 && (
                  <BalanceCategory
                    icon={<Lock className="w-5 h-5" />}
                    title="Vaults"
                    count={aggregator.breakdown.vaults.length}
                    valueUSD={aggregator.getCategoryTotal('vaults')}
                    visible={balanceVisible}
                  />
                )}

                {/* Staking */}
                {parseFloat(aggregator.breakdown.stakingRewards.totalStaked) >
                  0 && (
                  <BalanceCategory
                    icon={<Zap className="w-5 h-5" />}
                    title="Staking Rewards"
                    amount={aggregator.breakdown.stakingRewards.totalRewards}
                    symbol="STAKED"
                    valueUSD={
                      aggregator.breakdown.stakingRewards.valueUSD
                    }
                    visible={balanceVisible}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Wallet Tab */}
        <TabsContent value="wallet">
          <Card>
            <CardHeader>
              <CardTitle>Native & Token Balances</CardTitle>
              <CardDescription>
                Your wallet holdings across all connected providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Native */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">
                      {aggregator.breakdown.nativeBalance.symbol}
                    </span>
                    <Badge>Native</Badge>
                  </div>
                  <div className="text-2xl font-bold mb-1">
                    {balanceVisible
                      ? aggregator.breakdown.nativeBalance.amount
                      : '••••••'}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    ${aggregator.breakdown.nativeBalance.valueUSD}
                  </p>
                </div>

                {/* Tokens */}
                {aggregator.breakdown.tokens.map((token: any) => (
                  <TokenCard 
                    key={token.address} 
                    token={token} 
                    visible={balanceVisible}
                    primaryCurrency={currencyPreferences.primary}
                    secondaryCurrency={currencyPreferences.secondary}
                    convertAmount={convertAmount}
                    exchangeRates={exchangeRates}
                  />
                ))}

                {aggregator.breakdown.tokens.length === 0 && (
                  <p className="text-center text-gray-500 py-4">
                    No token holdings
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pools Tab */}
        <TabsContent value="pools">
          <Card>
            <CardHeader>
              <CardTitle>Investment Pools</CardTitle>
              <CardDescription>Your pooled investments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aggregator.breakdown.investmentPools.map((pool: any) => (
                  <PoolCard 
                    key={pool.poolId} 
                    pool={pool} 
                    visible={balanceVisible}
                    primaryCurrency={currencyPreferences.primary}
                    secondaryCurrency={currencyPreferences.secondary}
                    convertAmount={convertAmount}
                  />
                ))}
                {aggregator.breakdown.investmentPools.length === 0 && (
                  <p className="text-center text-gray-500 py-4">
                    No investment pools
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vaults Tab */}
        <TabsContent value="vaults">
          <Card>
            <CardHeader>
              <CardTitle>Vaults</CardTitle>
              <CardDescription>
                Personal and shared vault investments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aggregator.breakdown.vaults.map((vault: any) => (
                  <VaultCard key={vault.vaultId} vault={vault} visible={balanceVisible} />
                ))}
                {aggregator.breakdown.vaults.length === 0 && (
                  <p className="text-center text-gray-500 py-4">
                    No vaults
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staking Tab */}
        <TabsContent value="staking">
          <Card>
            <CardHeader>
              <CardTitle>Staking</CardTitle>
              <CardDescription>Your staking positions and rewards</CardDescription>
            </CardHeader>
            <CardContent>
              {parseFloat(aggregator.breakdown.stakingRewards.totalStaked) > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard
                      label="Total Staked"
                      value={balanceVisible ? aggregator.breakdown.stakingRewards.totalStaked : '••••••'}
                      subtext="Amount locked"
                    />
                    <StatCard
                      label="Pending Rewards"
                      value={balanceVisible ? aggregator.breakdown.stakingRewards.totalRewards : '••••••'}
                      subtext="Unclaimed"
                    />
                    <StatCard
                      label="Value (USD)"
                      value={`$${aggregator.breakdown.stakingRewards.valueUSD}`}
                      subtext="Total worth"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">
                  No staking positions
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

/**
 * Sub-components
 */

interface BalanceCategoryProps {
  icon: React.ReactNode;
  title: string;
  amount?: string;
  symbol?: string;
  count?: number;
  valueUSD: string;
  visible: boolean;
  unitPrice?: number;
  priceChangePercent?: number;
}

const BalanceCategory: React.FC<BalanceCategoryProps> = ({
  icon,
  title,
  amount,
  symbol,
  count,
  valueUSD,
  visible,
  unitPrice,
  priceChangePercent = 0,
}) => {
  const isPositive = priceChangePercent >= 0;
  const priceChangeColor = isPositive
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center gap-3 flex-1">
        <div className="text-blue-600 dark:text-blue-400">{icon}</div>
        <div className="flex-1">
          <p className="font-semibold">{title}</p>
          {count && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {count} item{count !== 1 ? 's' : ''}
            </p>
          )}
          {/* Display unit price if available */}
          {unitPrice !== undefined && unitPrice > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-600 dark:text-gray-400">
                ${unitPrice.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6
                })}
              </span>
              {priceChangePercent !== 0 && (
                <span className={`text-xs font-medium ${priceChangeColor}`}>
                  {isPositive ? '↑' : '↓'} {Math.abs(priceChangePercent).toFixed(2)}%
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="text-right">
        {amount && (
          <p className="font-bold">
            {visible ? amount : '••••••'} {symbol}
          </p>
        )}
        <p className="text-sm text-gray-600 dark:text-gray-400">
          ${valueUSD}
        </p>
      </div>
    </div>
  );
};

interface TokenCardProps {
  token: any;
  visible: boolean;
  primaryCurrency?: string;
  secondaryCurrency?: string;
  convertAmount?: (amount: string | number, from: string, to: string) => string;
  exchangeRates?: any;
}

const TokenCard: React.FC<TokenCardProps> = ({ 
  token, 
  visible, 
  primaryCurrency = 'cUSD',
  secondaryCurrency = 'KES',
  convertAmount = (amt) => typeof amt === 'string' ? amt : amt.toString(),
  exchangeRates = {}
}) => {
  const usdValue = parseFloat(token.valueUSD || '0');
  const primaryValue = convertAmount(usdValue, 'USD', primaryCurrency);
  const secondaryValue = convertAmount(usdValue, 'USD', secondaryCurrency);

  // Get unit price for this token (from USD pair or other available pair)
  const getUnitPrice = () => {
    const symbolPair = `${token.symbol}-USD`;
    if (exchangeRates[symbolPair]) {
      return {
        price: exchangeRates[symbolPair].rate,
        change24h: exchangeRates[symbolPair].change24h || 0,
        changePercent: ((exchangeRates[symbolPair].change24h || 0) / exchangeRates[symbolPair].rate) * 100
      };
    }
    return null;
  };

  const unitPrice = getUnitPrice();

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold">{token.symbol}</span>
        <Badge variant="outline">{token.address.slice(0, 6)}...</Badge>
      </div>
      <div className="space-y-3">
        {/* Amount */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-500">Amount</p>
          <div className="text-lg font-bold">
            {visible ? token.amount : '••••••'}
          </div>
        </div>

        {/* Unit Price with 24h Change */}
        {unitPrice && (
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-500">Unit Price</p>
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">
                USD ${unitPrice.price.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 8
                })}
              </div>
              <PriceBadge
                price={unitPrice.price}
                currency="USD"
                changePercent={unitPrice.changePercent}
              />
            </div>
          </div>
        )}

        {/* Primary Currency Value */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-500">Value ({primaryCurrency})</p>
          <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            {visible ? `${primaryCurrency} ${primaryValue}` : '••••••'}
          </div>
        </div>

        {/* Secondary Currency Value */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-500">Also in {secondaryCurrency}</p>
          <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            {visible ? `${secondaryCurrency} ${secondaryValue}` : '••••••'}
          </div>
        </div>
      </div>
    </div>
  );
};

interface PoolCardProps {
  pool: any;
  visible: boolean;
  primaryCurrency?: string;
  secondaryCurrency?: string;
  convertAmount?: (amount: string | number, from: string, to: string) => string;
}

const PoolCard: React.FC<PoolCardProps> = ({ 
  pool, 
  visible, 
  primaryCurrency = 'cUSD',
  secondaryCurrency = 'KES',
  convertAmount = (amt) => typeof amt === 'string' ? amt : amt.toString()
}) => {
  const usdValue = parseFloat(pool.valueUSD || '0');
  const primaryValue = convertAmount(usdValue, 'USD', primaryCurrency);
  const secondaryValue = convertAmount(usdValue, 'USD', secondaryCurrency);

  return (
    <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold">{pool.poolName}</span>
        <Badge className="bg-purple-600">{pool.apy}% APY</Badge>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400">Your Shares</p>
          <p className="font-bold">{visible ? pool.shares : '••••••'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400">Value ({primaryCurrency})</p>
          <p className="font-bold text-blue-600 dark:text-blue-400">{visible ? `${primaryCurrency} ${primaryValue}` : '••••••'}</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700">
        <p className="text-xs text-gray-600 dark:text-gray-400">Also in {secondaryCurrency}</p>
        <p className="font-semibold text-indigo-600 dark:text-indigo-400">{visible ? `${secondaryCurrency} ${secondaryValue}` : '••••••'}</p>
      </div>
    </div>
  );
};

interface VaultCardProps {
  vault: any;
  visible: boolean;
}

const VaultCard: React.FC<VaultCardProps> = ({ vault, visible }) => (
  <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
    <div className="flex items-center justify-between mb-2">
      <div>
        <span className="font-semibold">{vault.vaultName}</span>
        <Badge variant="outline" className="ml-2">
          {vault.type}
        </Badge>
      </div>
      <Badge className="bg-blue-600">{vault.apy}% APY</Badge>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs text-gray-600 dark:text-gray-400">Your Shares</p>
        <p className="font-bold">{visible ? vault.shares : '••••••'}</p>
      </div>
      <div>
        <p className="text-xs text-gray-600 dark:text-gray-400">USD Value</p>
        <p className="font-bold">${vault.valueUSD}</p>
      </div>
    </div>
  </div>
);

interface StatCardProps {
  label: string;
  value: string;
  subtext: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, subtext }) => (
  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</p>
    <p className="text-2xl font-bold mb-1">{value}</p>
    <p className="text-xs text-gray-500 dark:text-gray-500">{subtext}</p>
  </div>
);

export default BalanceAggregatorWidget;
