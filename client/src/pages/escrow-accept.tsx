import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { PageLoading } from '@/components/ui/page-loading';
import { useAuth } from '@/pages/hooks/useAuth';

export default function EscrowAcceptPage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [escrow, setEscrow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const referrerId = searchParams.get('referrer');

  useEffect(() => {
    const fetchEscrow = async () => {
      try {
        if (!inviteCode) {
          setError('Invalid invite link');
          return;
        }

        const data = await apiGet(`/api/escrow/invite/${inviteCode}`);
        setEscrow(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load escrow details');
      } finally {
        setLoading(false);
      }
    };

    fetchEscrow();
  }, [inviteCode]);

  const handleAccept = async () => {
    if (!isAuthenticated) {
      // Redirect to signup with referral code
      const signupUrl = `/register?escrow=${inviteCode}&referrer=${referrerId}`;
      navigate(signupUrl);
      return;
    }

    try {
      const response = await apiGet(`/api/escrow/accept/${inviteCode}?referrer=${referrerId}`);
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Escrow accepted! Check your wallet to fund or view details.'
        });
        navigate('/wallet');
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return <PageLoading message="Loading escrow details..." />;
  }

  if (error || !escrow) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <CardTitle className="text-red-900">Invalid Escrow Link</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-red-800">{error}</p>
            <Button onClick={() => navigate('/')} className="w-full">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const payer = escrow.payer;
  const totalAmount = parseFloat(escrow.amount);
  const milestones = escrow.milestones || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center text-white">
          <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
            <Lock className="w-8 h-8" />
            Secure Payment Invitation
          </h1>
          <p className="text-gray-300">You've been invited to a secure escrow transaction</p>
        </div>

        {/* Payer Info Card */}
        <Card className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">Payment from {payer?.username || 'User'}</CardTitle>
            <CardDescription>{payer?.email}</CardDescription>
          </CardHeader>
        </Card>

        {/* Amount Card */}
        <Card className="border-2 border-green-200 bg-green-50">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">${totalAmount.toFixed(2)}</CardTitle>
                <CardDescription>{escrow.currency}</CardDescription>
              </div>
              <Badge className="bg-green-600">Pending Your Acceptance</Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Description */}
        {escrow.metadata?.description && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">About this Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{escrow.metadata.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Milestones */}
        {milestones.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Milestones</CardTitle>
              <CardDescription>{milestones.length} phases</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {milestones.map((milestone: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{milestone.description}</p>
                      <p className="text-xs text-muted-foreground">Phase {index + 1}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${parseFloat(milestone.amount).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{escrow.currency}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How Escrow Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Funds Held Securely</p>
                <p className="text-xs text-muted-foreground">Payment is held in escrow, not transferred yet</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Complete Milestones</p>
                <p className="text-xs text-muted-foreground">Work progresses through agreed phases</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Get Paid on Approval</p>
                <p className="text-xs text-muted-foreground">You receive funds as each milestone is approved</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Dispute Protection</p>
                <p className="text-xs text-muted-foreground">Built-in arbitration if there's disagreement</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="flex-1"
          >
            Decline
          </Button>
          <Button
            onClick={handleAccept}
            className="flex-1 gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
          >
            <CheckCircle className="w-4 h-4" />
            {isAuthenticated ? 'Accept Escrow' : 'Sign Up & Accept'}
          </Button>
        </div>

        {/* Info Footer */}
        <p className="text-xs text-gray-400 text-center">
          By accepting, you agree to the payment terms and escrow conditions
        </p>
      </div>
    </div>
  );
}
