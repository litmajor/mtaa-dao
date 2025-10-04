import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Users, ArrowRight, Settings, Search, UserCheck, UserX } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '@/lib/api';

interface VoteDelegation {
  id: string;
  delegateId: string; // Changed from delegateAddress to delegateId
  delegateName?: string; // Added delegateName, optional
  scope: 'all' | 'category' | 'proposal'; // More specific type for scope
  category?: string;
  proposalId?: string;
}

interface DaoMember {
  userId: string;
  username: string;
  profileImageUrl?: string;
  role: string;
}

interface DelegationStats {
  totalDelegations: number; // Renamed from totalDelegated to be consistent with fetched data
  activeDelegations: number;
  votingPowerDelegated: number; // Renamed from totalDelegated to be more specific
}

export default function VoteDelegationPanel({ daoId, currentUserId }: { daoId: string; currentUserId: string }) {
  const [delegations, setDelegations] = useState<VoteDelegation[]>([]);
  const [members, setMembers] = useState<DaoMember[]>([]);
  const [delegationStats, setDelegationStats] = useState<DelegationStats>({
    totalDelegations: 0,
    activeDelegations: 0,
    votingPowerDelegated: 0
  });
  const [selectedDelegate, setSelectedDelegate] = useState('');
  const [delegationScope, setDelegationScope] = useState<'all' | 'category' | 'proposal'>('all');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProposal, setSelectedProposal] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDelegations();
    fetchMembers();
    fetchDelegationStats();
  }, [daoId]);

  const fetchDelegations = async () => {
    try {
      const response = await apiGet<{ data: VoteDelegation[] }>(`/api/governance/${daoId}/delegations`); // Added response type
      if (response.success) {
        setDelegations(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch delegations:', error);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await apiGet<{ data: DaoMember[] }>(`/api/daos/${daoId}/members`); // Added response type
      if (response.success) {
        setMembers(response.data.filter((m: DaoMember) => m.userId !== currentUserId));
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  };

  const fetchDelegationStats = async () => {
    try {
      const response = await apiGet<{ data: DelegationStats }>(`/api/governance/${daoId}/delegation-stats`); // Added response type
      if (response.success) {
        setDelegationStats(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch delegation stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDelegation = async () => {
    if (!selectedDelegate) return;

    setIsCreating(true);
    try {
      const delegationData = {
        delegateId: selectedDelegate,
        scope: delegationScope,
        ...(delegationScope === 'category' && { category: selectedCategory }),
        ...(delegationScope === 'proposal' && { proposalId: selectedProposal })
      };

      const response = await apiPost<{ success: boolean }>(`/api/governance/${daoId}/delegate`, delegationData); // Added response type
      if (response.success) {
        await fetchDelegations();
        await fetchDelegationStats();
        setSelectedDelegate('');
        setDelegationScope('all');
        setSelectedCategory('');
        setSelectedProposal('');
      }
    } catch (error) {
      console.error('Failed to create delegation:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeDelegation = async (delegationId: string) => {
    try {
      const response = await apiDelete<{ success: boolean }>(`/api/governance/${daoId}/delegate/${delegationId}`); // Added response type
      if (response.success) {
        await fetchDelegations();
        await fetchDelegationStats();
      }
    } catch (error) {
      console.error('Failed to revoke delegation:', error);
    }
  };

  const filteredMembers = members.filter(member =>
    member.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading delegations...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Active Delegations</p>
                <p className="text-2xl font-bold">{delegationStats.activeDelegations}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Received Delegations</p>
                <p className="text-2xl font-bold">{delegationStats.votingPowerDelegated}</p> {/* Corrected to votingPowerDelegated */}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm text-gray-600">Total Delegations</p> {/* Corrected label */}
                <p className="text-2xl font-bold">{delegationStats.totalDelegations}</p> {/* Corrected to totalDelegations */}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create New Delegation */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Create Vote Delegation</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Search Members</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Select Delegate</label>
            <Select value={selectedDelegate} onValueChange={setSelectedDelegate}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a member to delegate to" />
              </SelectTrigger>
              <SelectContent>
                {filteredMembers.map(member => (
                  <SelectItem key={member.userId} value={member.userId}>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={member.profileImageUrl} alt={member.username} /> {/* Added alt text */}
                        <AvatarFallback>{member.username[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span>{member.username}</span>
                      <Badge variant="outline" className="text-xs">{member.role}</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Delegation Scope</label>
            <Select value={delegationScope} onValueChange={(value: 'all' | 'category' | 'proposal') => setDelegationScope(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Proposals</SelectItem>
                <SelectItem value="category">Specific Category</SelectItem>
                <SelectItem value="proposal">Single Proposal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {delegationScope === 'category' && (
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="governance">Governance</SelectItem>
                  <SelectItem value="treasury">Treasury</SelectItem>
                  <SelectItem value="membership">Membership</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {delegationScope === 'proposal' && (
            <div>
              <label className="block text-sm font-medium mb-2">Proposal</label>
              <Input
                placeholder="Enter proposal ID"
                value={selectedProposal}
                onChange={(e) => setSelectedProposal(e.target.value)}
              />
            </div>
          )}

          <Button
            onClick={handleCreateDelegation}
            disabled={!selectedDelegate || isCreating}
            className="w-full"
          >
            {isCreating ? 'Creating...' : 'Create Delegation'}
          </Button>
        </CardContent>
      </Card>

      {/* Active Delegations */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Your Active Delegations</h3>
        </CardHeader>
        <CardContent>
          {delegations.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No active delegations</p>
          ) : (
            <div className="space-y-3">
              {delegations.map(delegation => (
                <div key={delegation.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-medium">Delegated to: {delegation.delegateName || delegation.delegateId}</p> {/* Display name if available, otherwise delegateId */}
                      <p className="text-sm text-gray-600">
                        Scope: {delegation.scope}
                        {delegation.scope === 'category' && delegation.category && ` (${delegation.category})`}
                        {delegation.scope === 'proposal' && delegation.proposalId && ` (Proposal #${delegation.proposalId})`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevokeDelegation(delegation.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <UserX className="w-4 h-4 mr-1" />
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}