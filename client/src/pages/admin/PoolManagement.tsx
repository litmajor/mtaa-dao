import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader, Plus, RefreshCw, TrendingUp, Settings, Eye, Aperture } from 'lucide-react';
import { authClient } from '@/utils/authClient';

interface Pool {
  id: string;
  name: string;
  symbol: string;
  description: string;
  totalValueLocked: string;
  shareTokenSupply: string;
  sharePrice: string;
  performanceFee: number;
  minimumInvestment: string;
  autoRebalance: boolean;
  isActive: boolean;
  createdAt: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  riskLevel: string;
  targetReturnAnnual: string;
  allocations: Array<{
    assetSymbol: string;
    targetAllocation: number;
  }>;
}

export default function PoolManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [daoId, setDaoId] = useState<string>(''); // TODO: Get from props/context for DAO-scoped management
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    description: '',
    templateId: '',
    minimumInvestment: '10',
    performanceFee: '200',
    autoRebalance: true,
  });

  // Fetch all pools - V1 endpoint
  const { data: poolsData, isLoading: poolsLoading } = useQuery({
    queryKey: [daoId, `/api/v1/daos/${daoId}/investment-pools`],
    queryFn: async () => {
      if (!daoId) return { pools: [] };
      return authClient.get(`/api/v1/daos/${daoId}/investment-pools`);
    },
    enabled: !!daoId,
  });

  // Fetch templates - V1 endpoint
  const { data: templatesData } = useQuery({
    queryKey: [daoId, `/api/v1/daos/${daoId}/investment-pools/templates`],
    queryFn: async () => {
      if (!daoId) return { templates: [] };
      return authClient.get(`/api/v1/daos/${daoId}/investment-pools/templates`);
    },
    enabled: !!daoId,
  });

  // Create pool mutation - V1 endpoint
  const createPoolMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!daoId) throw new Error('DAO context not available');
      return authClient.post(`/api/v1/daos/${daoId}/investment-pools`, data);
    },
    onSuccess: () => {
      if (daoId) {
        queryClient.invalidateQueries({ queryKey: [daoId, `/api/v1/daos/${daoId}/investment-pools`] });
      }
      toast({
        title: 'Pool Created!',
        description: 'Investment pool created successfully',
      });
      setShowCreateModal(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Creation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Trigger rebalance mutation - V1 endpoint
  const rebalanceMutation = useMutation({
    mutationFn: async (poolId: string) => {
      if (!daoId) throw new Error('DAO context not available');
      return authClient.post(`/api/v1/daos/${daoId}/investment-pools/${poolId}/trigger-rebalance`, {});
    },
    onSuccess: (data) => {
      if (daoId) {
        queryClient.invalidateQueries({ queryKey: [daoId, `/api/v1/daos/${daoId}/investment-pools`] });
      }
      toast({
        title: 'Rebalance Triggered',
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Rebalance Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Snapshot mutation - V1 endpoint
  const snapshotMutation = useMutation({
    mutationFn: async (poolId: string) => {
      if (!daoId) throw new Error('DAO context not available');
      return authClient.post(`/api/v1/daos/${daoId}/investment-pools/${poolId}/trigger-snapshot`, {});
    },
    onSuccess: () => {
      toast({
        title: 'Snapshot Recorded',
        description: 'Performance snapshot captured successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Snapshot Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      symbol: '',
      description: '',
      templateId: '',
      minimumInvestment: '10',
      performanceFee: '200',
      autoRebalance: true,
    });
    setSelectedTemplate('');
  };

  const handleCreate = () => {
    if (!formData.name || !formData.symbol) {
      toast({
        title: 'Validation Error',
        description: 'Name and symbol are required',
        variant: 'destructive',
      });
      return;
    }

    createPoolMutation.mutate({
      ...formData,
      minimumInvestment: parseFloat(formData.minimumInvestment),
      performanceFee: parseInt(formData.performanceFee),
    });
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    setFormData({ ...formData, templateId });

    const template = templatesData?.templates?.find((t: Template) => t.id === templateId);
    if (template) {
      setFormData(prev => ({
        ...prev,
        templateId,
        name: `${template.name} Pool`,
        symbol: template.name.split(' ').map((w: string) => w[0]).join('').toUpperCase(),
        description: template.description || '',
      }));
    }
  };

  const pools = poolsData?.pools || [];
  const templates = templatesData?.templates || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">💎 Pool Management</h1>
            <p className="text-white/70 text-lg">
              Create and manage investment pools
            </p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Pool
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{pools.length}</div>
                <div className="text-white/70 text-sm mt-1">Total Pools</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">
                  ${pools.reduce((sum: number, p: Pool) => sum + Number(p.totalValueLocked), 0).toLocaleString()}
                </div>
                <div className="text-white/70 text-sm mt-1">Total TVL</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">
                  {pools.filter((p: Pool) => p.autoRebalance).length}
                </div>
                <div className="text-white/70 text-sm mt-1">Auto-Rebalance</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{templates.length}</div>
                <div className="text-white/70 text-sm mt-1">Templates</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pools List */}
        {poolsLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader className="w-8 h-8 animate-spin text-purple-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {pools.map((pool: Pool) => (
              <Card key={pool.id} className="bg-white/10 border-white/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-white">{pool.name}</h3>
                        <Badge className="bg-purple-600">{pool.symbol}</Badge>
                        {pool.autoRebalance && (
                          <Badge className="bg-green-600">Auto-Rebalance</Badge>
                        )}
                        {pool.isActive ? (
                          <Badge className="bg-blue-600">Active</Badge>
                        ) : (
                          <Badge className="bg-gray-600">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-white/70 text-sm mb-3">{pool.description}</p>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <div className="text-white/60 text-xs">TVL</div>
                          <div className="text-white font-semibold">
                            ${Number(pool.totalValueLocked).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/60 text-xs">Share Price</div>
                          <div className="text-white font-semibold">
                            ${Number(pool.sharePrice).toFixed(4)}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/60 text-xs">Min Investment</div>
                          <div className="text-white font-semibold">
                            ${Number(pool.minimumInvestment).toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/60 text-xs">Fee</div>
                          <div className="text-white font-semibold">
                            {pool.performanceFee / 100}%
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-6">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-white/20 text-white hover:bg-white/10"
                        onClick={() => window.location.href = `/investment-pools/${pool.id}`}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-white/20 text-white hover:bg-white/10"
                        onClick={() => rebalanceMutation.mutate(pool.id)}
                        disabled={rebalanceMutation.isPending}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${rebalanceMutation.isPending ? 'animate-spin' : ''}`} />
                        Rebalance
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-white/20 text-white hover:bg-white/10"
                        onClick={() => snapshotMutation.mutate(pool.id)}
                        disabled={snapshotMutation.isPending}
                      >
                        <Aperture className="w-4 h-4 mr-2" />
                        Snapshot
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Pool Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="bg-gray-900 border-white/20 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Investment Pool</DialogTitle>
              <DialogDescription className="text-white/70">
                Set up a new multi-asset investment pool
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {/* Template Selection */}
              <div>
                <Label className="text-white mb-2 block">Portfolio Template (Optional)</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="bg-white/5 border-white/20 text-white">
                    <SelectValue placeholder="Choose a template or create custom" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-white/20">
                    <SelectItem value="none">Custom Pool (No Template)</SelectItem>
                    {templates.map((template: Template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} - {template.riskLevel} ({template.targetReturnAnnual}% target)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Pool Name */}
              <div>
                <Label className="text-white mb-2 block">Pool Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Balanced Growth Fund"
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>

              {/* Symbol */}
              <div>
                <Label className="text-white mb-2 block">Symbol *</Label>
                <Input
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                  placeholder="e.g., BGF"
                  maxLength={10}
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>

              {/* Description */}
              <div>
                <Label className="text-white mb-2 block">Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the pool's strategy and goals..."
                  className="bg-white/5 border-white/20 text-white"
                  rows={3}
                />
              </div>

              {/* Minimum Investment */}
              <div>
                <Label className="text-white mb-2 block">Minimum Investment (USD)</Label>
                <Input
                  type="number"
                  value={formData.minimumInvestment}
                  onChange={(e) => setFormData({ ...formData, minimumInvestment: e.target.value })}
                  placeholder="10"
                  min="1"
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>

              {/* Performance Fee */}
              <div>
                <Label className="text-white mb-2 block">Performance Fee (basis points)</Label>
                <Input
                  type="number"
                  value={formData.performanceFee}
                  onChange={(e) => setFormData({ ...formData, performanceFee: e.target.value })}
                  placeholder="200"
                  min="0"
                  max="1000"
                  className="bg-white/5 border-white/20 text-white"
                />
                <p className="text-white/60 text-xs mt-1">
                  {parseInt(formData.performanceFee) / 100}% fee on withdrawals
                </p>
              </div>

              {/* Auto Rebalance */}
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div>
                  <Label className="text-white">Enable Auto-Rebalancing</Label>
                  <p className="text-white/60 text-sm mt-1">
                    Automatically rebalance when allocations drift {'>'}  5%
                  </p>
                </div>
                <Switch
                  checked={formData.autoRebalance}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoRebalance: checked })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createPoolMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {createPoolMutation.isPending ? (
                  <Loader className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Create Pool
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

