import React, { useState } from 'react';
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
import { 
  Wallet, 
  TrendingUp, 
  Lock, 
  Users, 
  Zap,
  RefreshCw,
  DollarSign,
  Eye,
  EyeOff,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { useBalanceAggregator } from '@/pages/hooks/useBalanceAggregator';

const BalanceAggregatorWidget: React.FC = () => {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const aggregator = useBalanceAggregator();

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

  return (
    <div className="space-y-6">
      {/* Main Balance Card */}
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
          <div className="text-4xl font-bold mb-2">
            {balanceVisible ? `$${aggregator.totalValueUSD}` : '••••••'}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Last updated: {aggregator.lastUpdated.toLocaleTimeString()}
          </p>
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
                  <TokenCard key={token.address} token={token} visible={balanceVisible} />
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
                  <PoolCard key={pool.poolId} pool={pool} visible={balanceVisible} />
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
}

const BalanceCategory: React.FC<BalanceCategoryProps> = ({
  icon,
  title,
  amount,
  symbol,
  count,
  valueUSD,
  visible,
}) => (
  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
    <div className="flex items-center gap-3">
      <div className="text-blue-600 dark:text-blue-400">{icon}</div>
      <div>
        <p className="font-semibold">{title}</p>
        {count && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {count} item{count !== 1 ? 's' : ''}
          </p>
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

interface TokenCardProps {
  token: any;
  visible: boolean;
}

const TokenCard: React.FC<TokenCardProps> = ({ token, visible }) => (
  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
    <div className="flex items-center justify-between mb-2">
      <span className="font-semibold">{token.symbol}</span>
      <Badge variant="outline">{token.address.slice(0, 6)}...</Badge>
    </div>
    <div className="text-xl font-bold mb-1">
      {visible ? token.amount : '••••••'}
    </div>
    <p className="text-sm text-gray-600 dark:text-gray-400">
      ${token.valueUSD}
    </p>
  </div>
);

interface PoolCardProps {
  pool: any;
  visible: boolean;
}

const PoolCard: React.FC<PoolCardProps> = ({ pool, visible }) => (
  <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
    <div className="flex items-center justify-between mb-2">
      <span className="font-semibold">{pool.poolName}</span>
      <Badge className="bg-purple-600">{pool.apy}% APY</Badge>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs text-gray-600 dark:text-gray-400">Your Shares</p>
        <p className="font-bold">{visible ? pool.shares : '••••••'}</p>
      </div>
      <div>
        <p className="text-xs text-gray-600 dark:text-gray-400">USD Value</p>
        <p className="font-bold">${pool.valueUSD}</p>
      </div>
    </div>
  </div>
);

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
