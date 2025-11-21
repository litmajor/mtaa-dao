import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Mail } from 'lucide-react';

interface DaoInvitation {
  id: string;
  daoId: string;
  invitedEmail?: string;
  invitedPhone?: string;
  role: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'revoked';
  expiresAt?: string;
  inviteLink: string;
  isPeerInvite: boolean;
  createdAt: string;
}

export function PendingInvites() {
  const [invitations, setInvitations] = useState<DaoInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingInvitations();
  }, []);

  const fetchPendingInvitations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/invitations/pending', {
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

  const handleAcceptInvite = async (inviteLink: string) => {
    try {
      const response = await fetch(`/api/invitations/${inviteLink}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to accept invitation');

      // Remove from list
      setInvitations(invitations.filter(inv => inv.inviteLink !== inviteLink));
      fetchPendingInvitations();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to accept invitation');
    }
  };

  const handleRejectInvite = async (inviteLink: string) => {
    try {
      const response = await fetch(`/api/invitations/${inviteLink}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to reject invitation');

      // Remove from list
      setInvitations(invitations.filter(inv => inv.inviteLink !== inviteLink));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject invitation');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (invitations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="w-5 h-5 text-teal-600" />
        <h3 className="font-semibold text-lg">
          Pending Invitations ({invitations.length})
        </h3>
      </div>

      {invitations.map(invitation => (
        <Card key={invitation.id} className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">
                    {invitation.invitedEmail || invitation.invitedPhone || 'Unnamed DAO'}
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge variant="outline">{invitation.role}</Badge>
                    {invitation.isPeerInvite && (
                      <Badge variant="secondary" className="text-xs">
                        Peer Invite
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {invitation.expiresAt && (
                    <p className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleAcceptInvite(invitation.inviteLink)}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRejectInvite(invitation.inviteLink)}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Decline
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {error && (
        <div className="text-red-600 text-sm p-3 bg-red-50 rounded">
          {error}
        </div>
      )}
    </div>
  );
}

export default PendingInvites;
