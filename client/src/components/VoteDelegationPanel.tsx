
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { UserCheck, UserX, Settings, Search, Users, ArrowRight } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '@/lib/api';

interface VoteDelegation {
  id: string;
  delegatorId: string;
  delegateId: string;
  daoId: string;
  scope: string;
  category?: string;
  proposalId?: string;
  isActive: boolean;
  createdAt: string;
}

interface DaoMember {
  userId: string;
  username: string;
  profileImageUrl?: string;
  role: string;
}

interface VoteDelegationPanelProps {
  daoId: string;
  userId: string;
}

export default function VoteDelegationPanel({ daoId, userId }: VoteDelegationPanelProps) {
  const [delegations, setDelegations] = useState<VoteDelegation[]>([]);
  const [members, setMembers] = useState<DaoMember[]>([]);
  const [isCreatingDelegation, setIsCreatingDelegation] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newDelegation, setNewDelegation] = useState({
    delegateId: '',
    scope: 'all',
    category: '',
    proposalId: ''
  });

  useEffect(() => {
    fetchDelegations();
    fetchMembers();
  }, [daoId]);

  const fetchDelegations = async () => {
    try {
      const response = await apiGet(`/api/governance/${daoId}/delegations`);
      if (response.success) {
        setDelegations(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch delegations:', error);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await apiGet(`/api/daos/${daoId}/members`);
      if (response.success) {
        setMembers(response.data.filter((member: DaoMember) => member.userId !== userId));
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  };

  const handleCreateDelegation = async () => {
    try {
      const response = await apiPost(`/api/governance/${daoId}/delegate`, newDelegation);
      if (response.success) {
        setDelegations(prev => [...prev, response.data]);
        setIsCreatingDelegation(false);
        setNewDelegation({
          delegateId: '',
          scope: 'all',
          category: '',
          proposalId: ''
        });
      }
    } catch (error) {
      console.error('Failed to create delegation:', error);
    }
  };

  const handleRevokeDelegation = async (delegationId: string) => {
    try {
      await apiDelete(`/api/governance/${daoId}/delegate/${delegationId}`);
      setDelegations(prev => prev.filter(d => d.id !== delegationId));
    } catch (error) {
      console.error('Failed to revoke delegation:', error);
    }
  };

  const filteredMembers = members.filter(member => 
    member.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const delegationScopes = [
    { value: 'all', label: 'All Proposals' },
    { value: 'category', label: 'Category Specific' },
    { value: 'proposal', label: 'Single Proposal' }
  ];

  const proposalCategories = [
    'budget', 'governance', 'member', 'treasury', 'policy', 'emergency', 'general'
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              Vote Delegations
            </h3>
            <p className="text-sm text-gray-600">
              Delegate your voting power to trusted members
            </p>
          </div>
          <Button
            onClick={() => setIsCreatingDelegation(true)}
            className="flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            New Delegation
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Active Delegations */}
        <div>
          <h4 className="font-medium mb-3">Active Delegations</h4>
          {delegations.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No active delegations</p>
            </div>
          ) : (
            <div className="space-y-3">
              {delegations.map((delegation) => {
                const delegate = members.find(m => m.userId === delegation.delegateId);
                return (
                  <div key={delegation.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={delegate?.profileImageUrl} />
                        <AvatarFallback>
                          {delegate?.username?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div>
                        <p className="font-medium">{delegate?.username}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Badge variant="secondary" className="text-xs">
                            {delegation.scope === 'all' ? 'All Proposals' : 
                             delegation.scope === 'category' ? `${delegation.category} Category` :
                             'Single Proposal'}
                          </Badge>
                          <span>•</span>
                          <span>Since {new Date(delegation.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevokeDelegation(delegation.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <UserX className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Create New Delegation */}
        {isCreatingDelegation && (
          <Card className="border-blue-200">
            <CardHeader>
              <h4 className="font-medium">Create New Delegation</h4>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Member Search */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Delegate To
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search members..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <div className="max-h-40 overflow-y-auto border rounded-lg">
                  {filteredMembers.map((member) => (
                    <div
                      key={member.userId}
                      onClick={() => setNewDelegation(prev => ({ ...prev, delegateId: member.userId }))}
                      className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 ${
                        newDelegation.delegateId === member.userId ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={member.profileImageUrl} />
                        <AvatarFallback>
                          {member.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.username}</p>
                        <p className="text-xs text-gray-500">{member.role}</p>
                      </div>
                      {newDelegation.delegateId === member.userId && (
                        <ArrowRight className="w-4 h-4 text-blue-500 ml-auto" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Delegation Scope */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Delegation Scope
                </label>
                <Select
                  value={newDelegation.scope}
                  onValueChange={(value) => setNewDelegation(prev => ({ ...prev, scope: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {delegationScopes.map((scope) => (
                      <SelectItem key={scope.value} value={scope.value}>
                        {scope.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category Selection */}
              {newDelegation.scope === 'category' && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Category
                  </label>
                  <Select
                    value={newDelegation.category}
                    onValueChange={(value) => setNewDelegation(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {proposalCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Proposal ID */}
              {newDelegation.scope === 'proposal' && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Proposal ID
                  </label>
                  <Input
                    value={newDelegation.proposalId}
                    onChange={(e) => setNewDelegation(prev => ({ ...prev, proposalId: e.target.value }))}
                    placeholder="Enter proposal ID"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleCreateDelegation}
                  disabled={!newDelegation.delegateId}
                  className="flex-1"
                >
                  Create Delegation
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsCreatingDelegation(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
