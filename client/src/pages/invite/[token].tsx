import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, Lock } from 'lucide-react';

interface InviteDetails {
  id: string;
  daoId: string;
  role: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  expiresAt?: string;
  dao?: {
    id: string;
    name: string;
    description?: string;
    daoType: string;
    memberCount: number;
    treasury: number;
    creatorName: string;
  };
  invitedBy?: {
    name: string;
    avatar?: string;
  };
}

export default function InviteAcceptancePage() {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState<'accepted' | 'rejected' | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const authToken = localStorage.getItem('token');
    setIsLoggedIn(!!authToken);

    if (token) {
      fetchInviteDetails();
    }
  }, [token]);

  const fetchInviteDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invitations/${token}/details`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Invitation not found or invalid');
        } else if (response.status === 410) {
          throw new Error('Invitation has expired');
        }
        throw new Error('Failed to load invitation');
      }

      const data = await response.json();
      setInviteDetails(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitation details');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!isLoggedIn) {
      // Redirect to login/signup with return URL
      navigate(`/auth/signup?redirectTo=${window.location.pathname}`);
      return;
    }

    try {
      setProcessing(true);
      const response = await fetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error('Failed to accept invitation');
      }

      setCompleted('accepted');
      setTimeout(() => {
        navigate(`/dao/${inviteDetails?.daoId}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectInvite = async () => {
    if (!confirm('Are you sure you want to reject this invitation?')) return;

    try {
      setProcessing(true);
      const response = await fetch(`/api/invitations/${token}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error('Failed to reject invitation');
      }

      setCompleted('rejected');
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject invitation');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 flex flex-col items-center justify-center gap-4">
            <div className="animate-spin w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full"></div>
            <p className="text-gray-600">Loading invitation details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !inviteDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <h2 className="text-lg font-semibold">Invalid Invitation</h2>
            </div>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button onClick={() => navigate('/')} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completed === 'accepted') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-green-200">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Invitation Accepted!</h2>
            <p className="text-gray-600 mb-6">
              You have successfully joined {inviteDetails?.dao?.name}
            </p>
            <p className="text-sm text-gray-500">
              Redirecting to DAO page...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completed === 'rejected') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Invitation Rejected</h2>
            <p className="text-gray-600 mb-6">
              You have declined the invitation to {inviteDetails?.dao?.name}
            </p>
            <p className="text-sm text-gray-500">
              Redirecting to home page...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired =
    inviteDetails?.expiresAt &&
    new Date(inviteDetails.expiresAt) < new Date();

  const getRoleBadgeColor = (role: string) => {
    const colors: { [key: string]: string } = {
      elder: 'bg-blue-600',
      treasurer: 'bg-green-600',
      proposer: 'bg-orange-600',
      member: 'bg-gray-600'
    };
    return colors[role] || 'bg-gray-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center p-4 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader className="bg-gradient-to-r from-teal-500 to-blue-500 text-white rounded-t-lg">
          <CardTitle className="text-2xl">DAO Invitation</CardTitle>
        </CardHeader>

        <CardContent className="p-8 space-y-8">
          {/* DAO Preview */}
          {inviteDetails?.dao && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">{inviteDetails.dao.name}</h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <p className="text-xs text-gray-500 mb-1">DAO Type</p>
                  <p className="font-semibold capitalize">
                    {inviteDetails.dao.daoType}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <p className="text-xs text-gray-500 mb-1">Your Role</p>
                  <Badge
                    className={`${getRoleBadgeColor(inviteDetails.role)} text-white`}
                  >
                    {inviteDetails.role}
                  </Badge>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <p className="text-xs text-gray-500 mb-1">Members</p>
                  <p className="font-semibold">{inviteDetails.dao.memberCount}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <p className="text-xs text-gray-500 mb-1">Treasury</p>
                  <p className="font-semibold">
                    ${inviteDetails.dao.treasury?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>

              {inviteDetails.dao.description && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">About this DAO:</p>
                  <p className="text-gray-700">{inviteDetails.dao.description}</p>
                </div>
              )}

              {inviteDetails.invitedBy && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-gray-600 mb-2">Invited by:</p>
                  <div className="flex items-center gap-2">
                    {inviteDetails.invitedBy.avatar ? (
                      <img
                        src={inviteDetails.invitedBy.avatar}
                        alt={inviteDetails.invitedBy.name}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-sm font-bold">
                        {inviteDetails.invitedBy.name?.charAt(0) || 'U'}
                      </div>
                    )}
                    <span className="font-semibold">{inviteDetails.invitedBy.name}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Expiry Warning */}
          {isExpired && (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-900">Invitation Expired</p>
                <p className="text-sm text-red-800">
                  This invitation expired on{' '}
                  {new Date(inviteDetails?.expiresAt || '').toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          {/* Expiry Info */}
          {inviteDetails?.expiresAt && !isExpired && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded text-sm text-yellow-800">
              This invitation expires on{' '}
              {new Date(inviteDetails.expiresAt).toLocaleDateString()}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            {!isExpired && inviteDetails?.status === 'pending' ? (
              <>
                {!isLoggedIn ? (
                  <Button
                    onClick={handleAcceptInvite}
                    className="flex-1 gap-2"
                    disabled={processing}
                  >
                    <Lock className="w-4 h-4" />
                    Sign in to Accept
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleAcceptInvite}
                      className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                      disabled={processing}
                    >
                      <CheckCircle className="w-4 h-4" />
                      {processing ? 'Accepting...' : 'Accept Invitation'}
                    </Button>
                    <Button
                      onClick={handleRejectInvite}
                      variant="outline"
                      className="flex-1 gap-2"
                      disabled={processing}
                    >
                      <XCircle className="w-4 h-4" />
                      Decline
                    </Button>
                  </>
                )}
              </>
            ) : (
              <Button onClick={() => navigate('/')} className="w-full">
                Go to Home
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
