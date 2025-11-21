import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Phone, RefreshCw, Trash2, Copy, Share2 } from 'lucide-react';

interface Invitation {
  id: string;
  daoId: string;
  invitedEmail?: string;
  invitedPhone?: string;
  recipientUserId?: string;
  role: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'revoked';
  expiresAt?: string;
  acceptedAt?: string;
  inviteLink: string;
  isPeerInvite: boolean;
  createdAt: string;
}

interface InvitationManagementProps {
  daoId: string;
  isAdmin: boolean;
}

export function InvitationManagement({ daoId, isAdmin }: InvitationManagementProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInvitePhone, setNewInvitePhone] = useState('');
  const [newInviteRole, setNewInviteRole] = useState('member');
  const [peerInviteLink, setPeerInviteLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      fetchInvitations();
    }
  }, [daoId, isAdmin]);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dao/${daoId}/invitations`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Failed to fetch invitations');

      const data = await response.json();
      setInvitations(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvitation = async () => {
    try {
      if (!newInviteEmail && !newInvitePhone) {
        setError('Please enter email or phone');
        return;
      }

      const response = await fetch(`/api/dao/${daoId}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          invitedEmail: newInviteEmail,
          invitedPhone: newInvitePhone,
          role: newInviteRole
        })
      });

      if (!response.ok) throw new Error('Failed to create invitation');

      setSuccess('Invitation sent successfully!');
      setNewInviteEmail('');
      setNewInvitePhone('');
      fetchInvitations();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invitation');
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/dao/${daoId}/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Failed to revoke invitation');

      setSuccess('Invitation revoked');
      fetchInvitations();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invitation');
    }
  };

  const handleGetPeerInviteLink = async () => {
    try {
      const response = await fetch(`/api/dao/${daoId}/peer-invite-link`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Failed to generate peer invite link');

      const data = await response.json();
      setPeerInviteLink(data.peerInviteLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate peer invite link');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(peerInviteLink);
    setSuccess('Link copied to clipboard!');
    setTimeout(() => setSuccess(null), 2000);
  };

  const pendingInvites = invitations.filter(i => i.status === 'pending');
  const acceptedInvites = invitations.filter(i => i.status === 'accepted');
  const rejectedInvites = invitations.filter(i => i.status === 'rejected');

  if (!isAdmin) {
    return (
      <div className="text-center p-8 text-gray-500">
        Only DAO admins can manage invitations
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Send New Invitation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Send Invitation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              placeholder="Email address"
              value={newInviteEmail}
              onChange={(e) => setNewInviteEmail(e.target.value)}
            />
            <Input
              placeholder="Phone number (optional)"
              value={newInvitePhone}
              onChange={(e) => setNewInvitePhone(e.target.value)}
            />
            <select
              title="Member Role"
              aria-label="Member Role"
              value={newInviteRole}
              onChange={(e) => setNewInviteRole(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="member">Member</option>
              <option value="elder">Elder</option>
              <option value="treasurer">Treasurer</option>
              <option value="proposer">Proposer</option>
            </select>
          </div>
          <Button onClick={handleCreateInvitation} className="w-full">
            Send Invitation
          </Button>
        </CardContent>
      </Card>

      {/* Peer Invite Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share Peer Invite Link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!peerInviteLink ? (
            <Button onClick={handleGetPeerInviteLink} variant="outline" className="w-full">
              Generate Peer Invite Link
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  title="Peer invite link"
                  aria-label="Peer invite link"
                  value={peerInviteLink}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-lg bg-gray-50 font-mono text-sm"
                />
                <Button size="sm" variant="outline" onClick={handleCopyLink}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Share this link with anyone to invite them to the DAO. They can join using the link!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invitations List */}
      <Card>
        <CardHeader>
          <CardTitle>Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="pending">
                  Pending ({pendingInvites.length})
                </TabsTrigger>
                <TabsTrigger value="accepted">
                  Accepted ({acceptedInvites.length})
                </TabsTrigger>
                <TabsTrigger value="rejected">
                  Rejected ({rejectedInvites.length})
                </TabsTrigger>
              </TabsList>

              {/* Pending Tab */}
              <TabsContent value="pending" className="space-y-2">
                {pendingInvites.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">No pending invitations</p>
                ) : (
                  pendingInvites.map(invite => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div>
                          {invite.invitedEmail ? (
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4" />
                              <span className="font-mono text-sm">{invite.invitedEmail}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4" />
                              <span className="font-mono text-sm">{invite.invitedPhone}</span>
                            </div>
                          )}
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {invite.role}
                            </Badge>
                            {invite.isPeerInvite && (
                              <Badge variant="secondary" className="text-xs">
                                Peer
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mr-3">
                        {invite.expiresAt &&
                          new Date(invite.expiresAt) > new Date() ? (
                          `Expires in ${Math.ceil(
                            (new Date(invite.expiresAt).getTime() - Date.now()) /
                              (1000 * 60 * 60 * 24)
                          )} days`
                        ) : (
                          'Expired'
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevokeInvitation(invite.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </TabsContent>

              {/* Accepted Tab */}
              <TabsContent value="accepted" className="space-y-2">
                {acceptedInvites.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">No accepted invitations</p>
                ) : (
                  acceptedInvites.map(invite => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-green-50 dark:bg-green-950/20"
                    >
                      <div>
                        <p className="font-mono text-sm">
                          {invite.invitedEmail || invite.invitedPhone}
                        </p>
                        <p className="text-xs text-gray-500">
                          Accepted on{' '}
                          {new Date(invite.acceptedAt || '').toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className="bg-green-600">Accepted</Badge>
                    </div>
                  ))
                )}
              </TabsContent>

              {/* Rejected Tab */}
              <TabsContent value="rejected" className="space-y-2">
                {rejectedInvites.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">No rejected invitations</p>
                ) : (
                  rejectedInvites.map(invite => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-red-50 dark:bg-red-950/20"
                    >
                      <div>
                        <p className="font-mono text-sm">
                          {invite.invitedEmail || invite.invitedPhone}
                        </p>
                      </div>
                      <Badge variant="destructive">Rejected</Badge>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Messages */}
      {error && (
        <div className="text-red-600 text-sm p-3 bg-red-50 dark:bg-red-950/20 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="text-green-600 text-sm p-3 bg-green-50 dark:bg-green-950/20 rounded">
          {success}
        </div>
      )}
    </div>
  );
}

export default InvitationManagement;
