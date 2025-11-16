import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  Shield, 
  Users, 
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  PieChart,
  Activity,
  DollarSign,
  Lock
} from 'lucide-react';
import { VaultCreationWizard } from '@/components/vault/VaultCreationWizard';
import { DepositModal } from '@/components/vault/DepositModal';
import { WithdrawalModal } from '@/components/vault/WithdrawalModal';
import { useToast } from '@/hooks/use-toast';

interface VaultData {
  id: string;
  name: string;
  vaultType: 'regular' | 'savings' | 'locked_savings' | 'yield' | 'dao_treasury';
  currency: string;
  balance: string;
  totalValueLocked: string;
  yieldGenerated: string;
  riskLevel: 'low' | 'medium' | 'high';
  isActive: boolean;
  userId?: string;
  daoId?: string;
  tokenHoldings?: Array<{
    tokenSymbol: string;
    balance: string;
    valueUSD: string;
  }>;
}

export default function MaonoVaultManagement() {
  const { toast } = useToast();
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [selectedVault, setSelectedVault] = useState<VaultData | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const { data: userVaults, isLoading, refetch } = useQuery<VaultData[]>({
    queryKey: ['/api/vaults/user'],
    queryFn: async () => {
      const res = await fetch('/api/vaults/user', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch vaults');
      const data = await res.json();
      return data.vaults as VaultData[];
    }
  });

  const { data: vaultStats } = useQuery({
    queryKey: ['/api/vaults/stats'],
    queryFn: async () => {
      const res = await fetch('/api/vaults/stats', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    }
  });

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getVaultTypeIcon = (type: string) => {
    switch (type) {
      case 'yield': return <TrendingUp className="w-5 h-5" />;
      case 'dao_treasury': return <Users className="w-5 h-5" />;
      case 'locked_savings': return <Lock className="w-5 h-5" />;
      default: return <Wallet className="w-5 h-5" />;
    }
  };

  const handleVaultCreated = (vaultId: string) => {
    toast({
      title: "Vault Created!",
      description: `Your vault has been successfully created. ID: ${vaultId}`
    });
    setShowCreateWizard(false);
    refetch(); // Refetch vaults to show the newly created one
  };

  if (showCreateWizard) {
    return (
      <VaultCreationWizard
        onClose={() => setShowCreateWizard(false)}
        onSuccess={handleVaultCreated}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                MaonoVault
              </h1>
              <p className="text-gray-600 mt-2">Multi-asset investment vaults with yield optimization</p>
            </div>
            <Button 
              onClick={() => setShowCreateWizard(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create Vault
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-white/80 backdrop-blur-xl border-white/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Value Locked</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${vaultStats?.totalValue || '0.00'}
                </div>
                <p className="text-xs text-muted-foreground">Across all vaults</p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-xl border-white/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active Vaults</CardTitle>
                <Shield className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {vaultStats?.activeVaults || 0}
                </div>
                <p className="text-xs text-muted-foreground">Personal & DAO vaults</p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-xl border-white/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Yield</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${vaultStats?.totalYield || '0.00'}
                </div>
                <p className="text-xs text-muted-foreground">All-time earnings</p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-xl border-white/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg. APY</CardTitle>
                <Activity className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {vaultStats?.averageAPY || '0'}%
                </div>
                <p className="text-xs text-muted-foreground">Weighted average</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Vaults List */}
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-white/80 backdrop-blur-xl">
            <TabsTrigger value="all">All Vaults</TabsTrigger>
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="yield">Yield</TabsTrigger>
            <TabsTrigger value="dao">DAO</TabsTrigger>
            <TabsTrigger value="locked">Locked</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading vaults...</p>
              </div>
            ) : !userVaults || userVaults.length === 0 ? (
              <Card className="bg-white/80 backdrop-blur-xl text-center py-12">
                <CardContent>
                  <Wallet className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-xl font-bold mb-2">No Vaults Yet</h3>
                  <p className="text-gray-600 mb-6">Create your first vault to start saving and earning yields!</p>
                  <Button onClick={() => setShowCreateWizard(true)} className="bg-gradient-to-r from-blue-600 to-purple-600">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Vault
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userVaults.map((vault) => (
                  <Card 
                    key={vault.id}
                    className="bg-white/80 backdrop-blur-xl border-white/20 hover:shadow-xl transition-all duration-300 cursor-pointer"
                    onClick={() => setSelectedVault(vault)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-blue-100">
                            {getVaultTypeIcon(vault.vaultType)}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{vault.name}</CardTitle>
                            <CardDescription className="capitalize">
                              {vault.vaultType.replace('_', ' ')}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge className={getRiskColor(vault.riskLevel)}>
                          {vault.riskLevel}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Total Value</span>
                          <span className="font-semibold">${vault.totalValueLocked}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Yield Generated</span>
                          <span className="font-semibold text-green-600">
                            +${vault.yieldGenerated}
                          </span>
                        </div>
                      </div>

                      {/* Multi-Asset Holdings */}
                      {vault.tokenHoldings && vault.tokenHoldings.length > 0 && (
                        <div className="space-y-2 pt-3 border-t">
                          <span className="text-sm text-gray-600">Holdings</span>
                          {vault.tokenHoldings.map((holding) => (
                            <div 
                              key={holding.tokenSymbol}
                              className="flex justify-between items-center text-sm"
                            >
                              <span className="font-medium">{holding.tokenSymbol}</span>
                              <span>{holding.balance} (${holding.valueUSD})</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2 pt-3 border-t">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVault(vault);
                            setShowDeposit(true);
                          }}
                        >
                          <ArrowUpRight className="w-4 h-4 mr-1" />
                          Deposit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVault(vault);
                            setShowWithdraw(true);
                          }}
                        >
                          <ArrowDownLeft className="w-4 h-4 mr-1" />
                          Withdraw
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Other tab contents can filter by vault type */}
          <TabsContent value="personal">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userVaults?.filter(v => v.userId && !v.daoId).map(vault => (
                <Card key={vault.id} className="bg-white/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle>{vault.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">${vault.totalValueLocked}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Modals */}
        {showDeposit && selectedVault && (
          <DepositModal
            vaultId={selectedVault.id}
            vaultName={selectedVault.name}
            onClose={() => {
              setShowDeposit(false);
              setSelectedVault(null);
            }}
          />
        )}

        {showWithdraw && selectedVault && (
          <WithdrawalModal
            vaultId={selectedVault.id}
            vaultName={selectedVault.name}
            availableBalance={selectedVault.balance}
            onClose={() => {
              setShowWithdraw(false);
              setSelectedVault(null);
            }}
          />
        )}
      </div>
    </div>
  );
}