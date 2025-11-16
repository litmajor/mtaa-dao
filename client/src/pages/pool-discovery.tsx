
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Search, TrendingUp, Users, Wallet, ArrowRight, Share2, Copy } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function PoolDiscovery() {
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch all pools
  const { data: pools = [], isLoading } = useQuery({
    queryKey: ['/api/investment-pools'],
    queryFn: async () => {
      const res = await fetch('/api/investment-pools', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch pools');
      return res.json();
    },
  });

  // Fetch my pool invitations
  const { data: invitations = [] } = useQuery({
    queryKey: ['/api/investment-pools/my-invitations'],
    queryFn: async () => {
      const res = await fetch('/api/investment-pools/my-invitations', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Accept invitation mutation
  const acceptInvitation = useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await fetch(`/api/investment-pools/invitations/${inviteId}/accept`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to accept invitation');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/investment-pools/my-invitations'] });
      toast({ title: 'Joined Pool!', description: `You can now invest in ${data.poolName}` });
      navigate(`/investment-pools/${data.poolId}`);
    },
  });

  const copyInviteLink = (poolId: string) => {
    const link = `${window.location.origin}/investment-pools/${poolId}/join`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link Copied!', description: 'Share this link with friends to invite them' });
  };

  const filteredPools = pools.pools?.filter((pool: any) => 
    pool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pool.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">💰 Discover Investment Groups</h1>
          <p className="text-white/70 text-lg">Find groups to invest with or accept invitations</p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search investment groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/10 border-white/20 text-white"
            />
          </div>
        </div>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">📩 Your Invitations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invitations.map((invite: any) => (
                <Card key={invite.id} className="bg-gradient-to-r from-orange-500/20 to-pink-500/20 border-orange-500/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white">{invite.poolName}</h3>
                        <p className="text-sm text-white/70">Invited by {invite.inviterName}</p>
                      </div>
                      <Badge className="bg-orange-600">New</Badge>
                    </div>
                    <p className="text-white/80 mb-4 text-sm">{invite.message || 'Join us to invest together!'}</p>
                    <Button
                      onClick={() => acceptInvitation.mutate(invite.id)}
                      disabled={acceptInvitation.isPending}
                      className="w-full bg-gradient-to-r from-orange-600 to-pink-600"
                    >
                      Accept & Join Pool
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* All Pools */}
        <h2 className="text-2xl font-bold text-white mb-4">🔍 Browse All Groups</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPools.map((pool: any) => (
            <Card key={pool.id} className="bg-white/10 border-white/20 hover:bg-white/15 transition-all">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-white">{pool.name}</CardTitle>
                    <CardDescription className="text-white/60">{pool.symbol}</CardDescription>
                  </div>
                  <Badge className="bg-purple-600">Active</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-white/70 text-sm mb-4">{pool.description}</p>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/70">Total Value</span>
                    <span className="text-white font-bold">${Number(pool.totalValueLocked).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/70">Investors</span>
                    <span className="text-white font-bold">{pool.investorCount || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/70">Min. Investment</span>
                    <span className="text-white font-bold">${pool.minimumInvestment}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => navigate(`/investment-pools/${pool.id}`)}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600"
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    View Pool
                  </Button>
                  <Button
                    onClick={() => copyInviteLink(pool.id)}
                    variant="outline"
                    className="border-white/20 text-white"
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
