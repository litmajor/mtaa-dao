import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Users, Mail, Trash2, Edit2 } from 'lucide-react';
import InvitationManagement from '@/components/InvitationManagement';

interface Member {
  id: string;
  userId: string;
  daoId: string;
  role: string;
  joinedAt: string;
  contributions?: number;
  status: 'active' | 'inactive';
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
}

export default function DAOMembersPage() {
  const navigate = useNavigate();
  const { id: daoId } = useParams<{ id: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [daoName, setDaoName] = useState('');

  useEffect(() => {
    if (daoId) {
      fetchMembers();
      checkAdminStatus();
    }
  }, [daoId]);

  const checkAdminStatus = async () => {
    try {
      const response = await fetch(`/api/dao/${daoId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const dao = await response.json();
        setDaoName(dao.name);

        // Check if current user is admin
        const userResponse = await fetch('/api/user/profile', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (userResponse.ok) {
          const user = await userResponse.json();
          setIsAdmin(
            dao.creatorId === user.id ||
            dao.members?.some((m: any) => m.userId === user.id && m.role === 'admin')
          );
        }
      }
    } catch (err) {
      console.error('Failed to check admin status:', err);
    }
  };

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dao/${daoId}/members`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Failed to fetch members');

      const data = await response.json();
      setMembers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      const response = await fetch(`/api/dao/${daoId}/members/${memberId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Failed to remove member');

      setMembers(members.filter(m => m.id !== memberId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/dao/${daoId}/members/${memberId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ role: newRole })
      });

      if (!response.ok) throw new Error('Failed to update member role');

      setMembers(
        members.map(m =>
          m.id === memberId ? { ...m, role: newRole } : m
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const activeMembers = members.filter(m => m.status === 'active');
  const inactiveMembers = members.filter(m => m.status === 'inactive');

  const getRoleBadgeColor = (role: string) => {
    const colors: { [key: string]: string } = {
      admin: 'bg-purple-600',
      elder: 'bg-blue-600',
      treasurer: 'bg-green-600',
      proposer: 'bg-orange-600',
      member: 'bg-gray-600'
    };
    return colors[role] || 'bg-gray-600';
  };

  if (!daoId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">DAO Members</h1>
        <p className="text-gray-600">{daoName}</p>
      </div>

      <Tabs defaultValue="members" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Members ({activeMembers.length})
          </TabsTrigger>
          <TabsTrigger value="invitations" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Invitations
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-6">
          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center p-8">
                <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full"></div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Active Members */}
              <div>
                <h2 className="text-lg font-semibold mb-4">Active Members</h2>
                {activeMembers.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-gray-500">
                      No active members yet
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3">
                    {activeMembers.map(member => (
                      <Card key={member.id} className="hover:shadow-md transition">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                              {member.user?.avatar ? (
                                <img
                                  src={member.user.avatar}
                                  alt={member.user.name}
                                  className="w-10 h-10 rounded-full"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold">
                                  {member.user?.name?.charAt(0) || 'U'}
                                </div>
                              )}
                              <div className="flex-1">
                                <p className="font-semibold">{member.user?.name || 'Unknown'}</p>
                                <p className="text-sm text-gray-500">{member.user?.email}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                  Joined {new Date(member.joinedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <Badge className={`${getRoleBadgeColor(member.role)} text-white`}>
                                {member.role}
                              </Badge>

                              {isAdmin && (
                                <>
                                  <select
                                    title="Member Role"
                                    aria-label="Member Role"
                                    value={member.role}
                                    onChange={(e) => handleChangeRole(member.id, e.target.value)}
                                    className="px-2 py-1 border rounded text-sm"
                                  >
                                    <option value="member">Member</option>
                                    <option value="proposer">Proposer</option>
                                    <option value="treasurer">Treasurer</option>
                                    <option value="elder">Elder</option>
                                  </select>

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRemoveMember(member.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Inactive Members */}
              {inactiveMembers.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-4">Inactive Members</h2>
                  <div className="grid gap-3">
                    {inactiveMembers.map(member => (
                      <Card key={member.id} className="opacity-75">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-bold">
                                {member.user?.name?.charAt(0) || 'U'}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-600">
                                  {member.user?.name || 'Unknown'}
                                </p>
                                <p className="text-sm text-gray-500">{member.user?.email}</p>
                              </div>
                            </div>
                            <Badge variant="outline">Inactive</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Invitations Tab */}
        <TabsContent value="invitations">
          {isAdmin ? (
            <InvitationManagement daoId={daoId as string} isAdmin={isAdmin} />
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                Only DAO admins can manage invitations
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Error Message */}
      {error && (
        <div className="mt-6 text-red-600 text-sm p-3 bg-red-50 dark:bg-red-950/20 rounded">
          {error}
        </div>
      )}
    </div>
  );
}
