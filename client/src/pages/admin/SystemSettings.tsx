import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Settings, Globe, Zap, Shield, DollarSign, Loader2, Save, RefreshCw } from 'lucide-react';

export default function SystemSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['/api/admin/settings'],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/admin/settings', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { section: string; key: string; value: any }) => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to update settings');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      toast({
        title: 'Success',
        description: 'Settings updated successfully. Some changes may require server restart.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleToggle = (section: string, key: string, value: boolean) => {
    updateMutation.mutate({ section, key, value });
  };

  const handleSave = (section: string, key: string, value: string) => {
    updateMutation.mutate({ section, key, value });
    toast({
      title: 'Saved',
      description: `${key} updated successfully`,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">System Settings</h1>
          <p className="text-white/70">Configure platform-wide settings and parameters</p>
        </div>

        <Tabs defaultValue="platform" className="space-y-6">
          <TabsList className="bg-white/10 border border-white/20">
            <TabsTrigger value="platform" className="data-[state=active]:bg-purple-600">
              <Globe className="w-4 h-4 mr-2" />
              Platform
            </TabsTrigger>
            <TabsTrigger value="blockchain" className="data-[state=active]:bg-purple-600">
              <Zap className="w-4 h-4 mr-2" />
              Blockchain
            </TabsTrigger>
            <TabsTrigger value="features" className="data-[state=active]:bg-purple-600">
              <Settings className="w-4 h-4 mr-2" />
              Features
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-purple-600">
              <Shield className="w-4 h-4 mr-2" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Platform Settings */}
          <TabsContent value="platform">
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Platform Configuration</CardTitle>
                <CardDescription className="text-white/70">
                  General platform settings and branding
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-white mb-2 block">Platform Name</Label>
                    <div className="flex gap-2">
                      <Input
                        defaultValue={settings?.platform.name}
                        className="bg-white/5 border-white/20 text-white flex-1"
                        disabled
                      />
                      <Button
                        onClick={() => toast({ title: 'Note', description: 'Platform name changes require server restart' })}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <Separator className="bg-white/10" />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-white">Maintenance Mode</Label>
                      <p className="text-sm text-white/60">Temporarily disable public access</p>
                    </div>
                    <Switch
                      checked={settings?.platform.maintenanceMode}
                      onCheckedChange={(checked) => handleToggle('platform', 'maintenanceMode', checked)}
                    />
                  </div>

                  <Separator className="bg-white/10" />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-white">Registration Enabled</Label>
                      <p className="text-sm text-white/60">Allow new users to register</p>
                    </div>
                    <Switch
                      checked={settings?.platform.registrationEnabled}
                      onCheckedChange={(checked) => handleToggle('platform', 'registrationEnabled', checked)}
                    />
                  </div>

                  <Separator className="bg-white/10" />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-white">Require Email Verification</Label>
                      <p className="text-sm text-white/60">Users must verify email to access platform</p>
                    </div>
                    <Switch
                      checked={settings?.platform.requireEmailVerification}
                      onCheckedChange={(checked) => handleToggle('platform', 'requireEmailVerification', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Blockchain Settings */}
          <TabsContent value="blockchain">
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Blockchain Configuration</CardTitle>
                <CardDescription className="text-white/70">
                  Network and smart contract settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-white mb-2 block">Network</Label>
                    <Input
                      value={settings?.blockchain.network}
                      className="bg-white/5 border-white/20 text-white"
                      disabled
                    />
                    <p className="text-xs text-white/50 mt-1">Current: {settings?.blockchain.network}</p>
                  </div>

                  <div>
                    <Label className="text-white mb-2 block">RPC URL</Label>
                    <Input
                      value={settings?.blockchain.rpcUrl}
                      className="bg-white/5 border-white/20 text-white"
                      disabled
                    />
                  </div>

                  <Separator className="bg-white/10" />

                  <div>
                    <Label className="text-white mb-2 block">Maono Contract Address</Label>
                    <div className="bg-gray-900/50 p-3 rounded-lg">
                      <code className="text-xs text-green-400 break-all">
                        {settings?.blockchain.maonoContractAddress}
                      </code>
                    </div>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <p className="text-yellow-400 text-sm flex items-start gap-2">
                      <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>Blockchain settings are read from environment variables. Update your .env file and restart the server to change these values.</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Features */}
          <TabsContent value="features">
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Feature Flags</CardTitle>
                <CardDescription className="text-white/70">
                  Enable or disable platform features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">Chat</Label>
                    <p className="text-sm text-white/60">DAO chat messaging</p>
                  </div>
                  <Switch
                    checked={settings?.features.chatEnabled}
                    onCheckedChange={(checked) => handleToggle('features', 'chatEnabled', checked)}
                  />
                </div>

                <Separator className="bg-white/10" />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">Proposals</Label>
                    <p className="text-sm text-white/60">Proposal creation and voting</p>
                  </div>
                  <Switch
                    checked={settings?.features.proposalsEnabled}
                    onCheckedChange={(checked) => handleToggle('features', 'proposalsEnabled', checked)}
                  />
                </div>

                <Separator className="bg-white/10" />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">Vaults</Label>
                    <p className="text-sm text-white/60">Vault management and strategies</p>
                  </div>
                  <Switch
                    checked={settings?.features.vaultsEnabled}
                    onCheckedChange={(checked) => handleToggle('features', 'vaultsEnabled', checked)}
                  />
                </div>

                <Separator className="bg-white/10" />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">Referrals</Label>
                    <p className="text-sm text-white/60">Referral rewards system</p>
                  </div>
                  <Switch
                    checked={settings?.features.referralsEnabled}
                    onCheckedChange={(checked) => handleToggle('features', 'referralsEnabled', checked)}
                  />
                </div>

                <Separator className="bg-white/10" />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">NFT Marketplace</Label>
                    <p className="text-sm text-white/60">NFT trading and minting</p>
                  </div>
                  <Switch
                    checked={settings?.features.nftMarketplaceEnabled}
                    onCheckedChange={(checked) => handleToggle('features', 'nftMarketplaceEnabled', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security">
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Security & Rate Limits</CardTitle>
                <CardDescription className="text-white/70">
                  Configure security settings and API rate limits
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-white mb-2 block">Login Attempts</Label>
                    <Input
                      type="number"
                      defaultValue={settings?.rateLimits.login}
                      className="bg-white/5 border-white/20 text-white"
                      disabled
                    />
                    <p className="text-xs text-white/50 mt-1">Per 15 minutes</p>
                  </div>

                  <div>
                    <Label className="text-white mb-2 block">Registration Attempts</Label>
                    <Input
                      type="number"
                      defaultValue={settings?.rateLimits.register}
                      className="bg-white/5 border-white/20 text-white"
                      disabled
                    />
                    <p className="text-xs text-white/50 mt-1">Per 15 minutes</p>
                  </div>

                  <div>
                    <Label className="text-white mb-2 block">API Requests</Label>
                    <Input
                      type="number"
                      defaultValue={settings?.rateLimits.apiDefault}
                      className="bg-white/5 border-white/20 text-white"
                      disabled
                    />
                    <p className="text-xs text-white/50 mt-1">Per minute</p>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-blue-400 text-sm flex items-start gap-2">
                    <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Rate limits are configured in the middleware and require code changes. Contact development team to adjust these values.</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-4">
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] })}
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Settings
          </Button>
        </div>
      </div>
    </div>
  );
}

