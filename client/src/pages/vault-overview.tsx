
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Wallet, 
  TrendingUp, 
  Users, 
  Lock, 
  Shield, 
  ArrowRight,
  Plus,
  PieChart,
  Activity,
  Target,
  Zap,
  Crown
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';

interface VaultStats {
  totalVaults: number;
  totalValue: string;
  totalYield: string;
  activeStrategies: number;
}

interface VaultItem {
  id: string;
  name: string;
  type: 'personal' | 'maono' | 'community' | 'locked';
  balance: string;
  apy: string;
  status: 'active' | 'beta' | 'coming_soon';
  icon: any;
  color: string;
  path: string;
}

export default function VaultOverview() {
  const { address, isConnected } = useAccount();
  const [stats, setStats] = useState<VaultStats>({
    totalVaults: 0,
    totalValue: '0.00',
    totalYield: '0.00',
    activeStrategies: 0
  });
  const [vaults, setVaults] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isConnected && address) {
      fetchVaultData();
    }
  }, [isConnected, address]);

  const fetchVaultData = async () => {
    try {
      const response = await fetch(`/api/vaults/user/${address}`, {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
        setVaults(data.vaults);
      }
    } catch (error) {
      console.error('Failed to fetch vault data:', error);
    } finally {
      setLoading(false);
    }
  };

  const vaultTypes = [
    {
      id: 'personal',
      name: 'Personal Wallet',
      description: 'Your individual CELO/cUSD wallet for daily transactions',
      icon: Wallet,
      features: ['Send/Receive', 'Balance Tracking', 'Transaction History'],
      status: 'active',
      path: '/wallet',
      color: 'blue'
    },
    {
      id: 'maono',
      name: 'MaonoVault',
      description: 'Professional managed DeFi vault with yield strategies',
      icon: TrendingUp,
      features: ['ERC4626 Shares', 'Yield Strategies', 'Professional Management'],
      status: 'active',
      path: '/vault',
      color: 'purple'
    },
    {
      id: 'community',
      name: 'Community Vaults',
      description: 'DAO treasury management with governance voting',
      icon: Users,
      features: ['Governance Voting', 'Proposal System', 'Multi-sig Security'],
      status: 'active',
      path: '/dao/treasury',
      color: 'green'
    },
    {
      id: 'locked',
      name: 'Locked Savings',
      description: 'Time-locked personal savings with goals',
      icon: Lock,
      features: ['Savings Goals', 'Time Locks', 'Interest Earning'],
      status: 'beta',
      path: '/wallet#locked-savings',
      color: 'orange'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent mb-2">
                Vault Dashboard
              </h1>
              <p className="text-gray-600 text-lg">Manage all your vaults in one place</p>
            </div>
            <div className="flex gap-2">
              <Link to="/vault">
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600">
                  <Plus className="mr-2 h-5 w-5" />
                  Create Vault
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="outline">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-white/80 backdrop-blur-xl border-white/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Vaults</CardTitle>
                <Shield className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalVaults}</div>
                <p className="text-xs text-muted-foreground">Active vaults</p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-xl border-white/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                <PieChart className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats.totalValue}</div>
                <p className="text-xs text-muted-foreground">Across all vaults</p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-xl border-white/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Yield</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats.totalYield}</div>
                <p className="text-xs text-muted-foreground">All-time earnings</p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-xl border-white/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Strategies</CardTitle>
                <Zap className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeStrategies}</div>
                <p className="text-xs text-muted-foreground">Active strategies</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Vault Types */}
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-white/80 backdrop-blur-xl">
            <TabsTrigger value="all">All Vaults</TabsTrigger>
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="maono">MaonoVault</TabsTrigger>
            <TabsTrigger value="community">Community</TabsTrigger>
            <TabsTrigger value="locked">Locked</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {vaultTypes.map((vault) => {
                const Icon = vault.icon;
                return (
                  <Card 
                    key={vault.id}
                    className="bg-white/80 backdrop-blur-xl border-white/20 hover:shadow-xl transition-all duration-300 cursor-pointer"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl bg-${vault.color}-100`}>
                            <Icon className={`w-8 h-8 text-${vault.color}-600`} />
                          </div>
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              {vault.name}
                              {vault.status === 'beta' && (
                                <Badge variant="secondary" className="text-xs">Beta</Badge>
                              )}
                            </CardTitle>
                            <CardDescription className="mt-1">
                              {vault.description}
                            </CardDescription>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {vault.features.map((feature, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                        <Link to={vault.path}>
                          <Button className="w-full" variant="outline">
                            Open Vault
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Individual vault type tabs */}
          {vaultTypes.map((vaultType) => (
            <TabsContent key={vaultType.id} value={vaultType.id}>
              <Card className="bg-white/80 backdrop-blur-xl border-white/20">
                <CardHeader>
                  <CardTitle>{vaultType.name} Details</CardTitle>
                  <CardDescription>Manage your {vaultType.name.toLowerCase()}</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-4 text-gray-600">Loading vault data...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-gray-600">
                        {vaultType.description}
                      </p>
                      <Link to={vaultType.path}>
                        <Button>
                          Go to {vaultType.name}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Quick Actions */}
        <Card className="mt-8 bg-white/80 backdrop-blur-xl border-white/20">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4 flex-wrap">
            <Link to="/vault">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Vault
              </Button>
            </Link>
            <Link to="/proposals">
              <Button variant="outline">
                <Activity className="mr-2 h-4 w-4" />
                View Proposals
              </Button>
            </Link>
            <Link to="/wallet">
              <Button variant="outline">
                <Wallet className="mr-2 h-4 w-4" />
                Manage Wallet
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
