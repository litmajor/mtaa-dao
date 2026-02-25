import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Lock, CheckCircle, AlertCircle, Clock, User, DollarSign, Calendar, Milestone, Gavel, Shield } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/pages/hooks/useAuth';

export default function EscrowDetailPage() {
  const { escrowId } = useParams<{ escrowId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [escrow, setEscrow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [analyticsSent, setAnalyticsSent] = useState(false);

  useEffect(() => {
    loadEscrow();
  }, [escrowId]);

  const loadEscrow = async () => {
    try {
      setLoading(true);
      const data = await apiGet(`/api/escrow/${escrowId}`);
      setEscrow(data);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      navigate('/escrow');
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async (milestoneIndex: number) => {
    if (!confirm('Release payment for this milestone?')) return;
    try {
      await apiPost(`/api/escrow/${escrowId}/milestones/${milestoneIndex}/approve`, {});
      toast({ title: 'Success', description: 'Milestone approved and funds released' });
      loadEscrow();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) {
      toast({ title: 'Error', description: 'Please provide a reason', variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      await apiPost(`/api/escrow/${escrowId}/dispute`, { reason: disputeReason });
      toast({ title: 'Success', description: 'Dispute filed and admin notified' });
      setDisputeDialogOpen(false);
      loadEscrow();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this escrow? This action cannot be undone.')) return;
    try {
      await apiPost(`/api/escrow/${escrowId}/cancel`, {});
      toast({ title: 'Success', description: 'Escrow cancelled' });
      navigate('/escrow');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 text-center">
        <p className="text-muted-foreground">Loading escrow details...</p>
      </div>
    );
  }

  // Analytics event for viewing escrow detail
  useEffect(() => {
    if (escrow && !analyticsSent) {
      if (window?.analytics) {
        window.analytics.track('Escrow Detail Viewed', { escrowId });
      }
      setAnalyticsSent(true);
    }
  }, [escrow, analyticsSent, escrowId]);

  if (!escrow) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900">Escrow Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/escrow')}>Return to Escrows</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPayer = user?.id === escrow.payerId;
  const isPayee = user?.id === escrow.payeeId;
  const totalAmount = parseFloat(escrow.amount);
  const milestones = escrow.milestones || [];
  const disputes = escrow.disputes || [];

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-900',
    accepted: 'bg-blue-100 text-blue-900',
    funded: 'bg-purple-100 text-purple-900',
    completed: 'bg-green-100 text-green-900',
    cancelled: 'bg-gray-100 text-gray-900',
    disputed: 'bg-red-100 text-red-900',
    refunded: 'bg-orange-100 text-orange-900',
  };

  // Calculate progress for milestones
  const releasedCount = milestones.filter((m: any) => m.released).length;
  const progressPercent = milestones.length > 0 ? Math.round((releasedCount / milestones.length) * 100) : 0;

  // Governance voting UI (placeholder)
  const showGovernanceVote = disputes.some((d: any) => d.status === 'open' || d.status === 'under_review');

  // Social recovery UI (placeholder)
  const guardians = escrow.guardians || [];
  const [guardianInput, setGuardianInput] = useState('');
  const [addingGuardian, setAddingGuardian] = useState(false);
  const [removingGuardian, setRemovingGuardian] = useState<string | null>(null);
  const [recoveryStatus, setRecoveryStatus] = useState<any>(escrow.metadata?.recoveryApprovals ? {
    approvals: escrow.metadata.recoveryApprovals,
    recovered: escrow.metadata.recovered
  } : { approvals: [], recovered: false });
  const isGuardian = guardians.includes(user?.id);
  const canManageGuardians = isPayer || isPayee;

  // Add guardian handler
  const handleAddGuardian = async () => {
    if (!guardianInput.trim()) return;
    setAddingGuardian(true);
    try {
      const res = await apiPost(`/api/escrow/${escrowId}/guardians/add`, { guardians: [guardianInput.trim()] });
      toast({ title: 'Guardian Added', description: 'Guardian added successfully.' });
      setGuardianInput('');
      loadEscrow();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setAddingGuardian(false);
    }
  };

  // Remove guardian handler
  const handleRemoveGuardian = async (g: string) => {
    setRemovingGuardian(g);
    try {
      const res = await apiPost(`/api/escrow/${escrowId}/guardians/remove`, { guardian: g });
      toast({ title: 'Guardian Removed', description: 'Guardian removed.' });
      loadEscrow();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setRemovingGuardian(null);
    }
  };

  // Approve recovery handler
  const handleApproveRecovery = async () => {
    try {
      const res = await apiPost(`/api/escrow/${escrowId}/guardians/approve-recovery`, {});
      toast({ title: 'Recovery Approved', description: res.recovered ? 'Recovery completed!' : 'Your approval has been recorded.' });
      setRecoveryStatus({ approvals: res.approvals, recovered: res.recovered });
      loadEscrow();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Lock className="w-8 h-8" />
            Escrow Details
          </h1>
          <p className="text-muted-foreground mt-1">{escrow.description || 'No description'}</p>
        </div>
        <Badge className={statusColors[escrow.status] || 'secondary'}>
          {escrow.status}
        </Badge>
      </div>

      {/* Main Amount Card */}
      <Card className="border-2 border-green-200 bg-green-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-600" />
              <div>
                <CardTitle className="text-3xl">${totalAmount.toFixed(2)}</CardTitle>
                <CardDescription>{escrow.currency}</CardDescription>
              </div>
            </div>
            {isPayer && (
              <div className="text-sm text-muted-foreground">You are the payer</div>
            )}
            {isPayee && (
              <div className="text-sm text-muted-foreground">You are the recipient</div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Parties */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Payer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span>{escrow.payerName || 'Unknown'}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{escrow.payerEmail || 'No email'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recipient</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span>{escrow.payeeName || 'Pending'}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{escrow.payeeEmail || 'Awaiting acceptance'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline & Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Timeline & Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>Created: {new Date(escrow.createdAt).toLocaleDateString()}</span>
          </div>
          {escrow.acceptedAt && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Accepted: {new Date(escrow.acceptedAt).toLocaleDateString()}</span>
            </div>
          )}
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <Milestone className="w-4 h-4 text-blue-600" />
              <span>Milestone Progress:</span>
              <div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-2 bg-green-500" style={{ width: `${progressPercent}%` }} />
              </div>
              <span className="text-xs text-muted-foreground">{progressPercent}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Dispute History */}
      {disputes.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Dispute History
            </CardTitle>
            <CardDescription>All disputes for this escrow</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {disputes.map((d: any, idx: number) => (
              <div key={d.id || idx} className="p-3 border rounded-lg bg-white/80">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="font-medium">{d.status === 'resolved' ? 'Resolved' : d.status === 'under_review' ? 'Under Review' : 'Open'}</span>
                  <span className="text-xs text-muted-foreground ml-2">{new Date(d.createdAt).toLocaleString()}</span>
                </div>
                <div className="mt-1 text-sm">Reason: {d.reason}</div>
                {d.resolution && <div className="mt-1 text-xs text-green-700">Resolution: {d.resolution}</div>}
                {d.resolvedAt && <div className="mt-1 text-xs text-muted-foreground">Resolved: {new Date(d.resolvedAt).toLocaleString()}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {/* Governance Voting (if applicable) */}
      {showGovernanceVote && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gavel className="w-5 h-5 text-purple-600" />
              Governance Vote Required
            </CardTitle>
            <CardDescription>This dispute requires a DAO vote for resolution.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm mb-2">Voting UI coming soon. Please check DAO governance page to participate.</div>
            <Button variant="secondary" onClick={() => window.open('/governance', '_blank')}>Go to Governance</Button>
          </CardContent>
        </Card>
      )}
      {/* Social Recovery / Guardians (full UI) */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Social Recovery Guardians
          </CardTitle>
          <CardDescription>Guardians can help recover locked funds if needed.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <ul className="list-disc ml-6">
              {loading ? (
                <li className="text-muted-foreground">Loading guardians...</li>
              ) : guardians.length === 0 ? (
                <li className="text-muted-foreground">No guardians assigned.</li>
              ) : (
                guardians.map((g: any, idx: number) => (
                  <li key={g.id || g || idx} className="flex items-center gap-2">
                    <span title={g.name || g.email || g} className="truncate max-w-[140px] block">
                      {(g.name || g.email || g)?.length > 22 ? (g.name || g.email || g).slice(0, 20) + '…' : (g.name || g.email || g)}
                    </span>
                    {canManageGuardians && (
                      <Button size="xs" variant="outline" onClick={() => handleRemoveGuardian(g)} disabled={removingGuardian === g}>
                        {removingGuardian === g ? 'Removing...' : 'Remove'}
                      </Button>
                    )}
                  </li>
                ))
              )}
            </ul>
            {canManageGuardians && (
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Guardian user ID or email"
                  value={guardianInput}
                  onChange={e => setGuardianInput(e.target.value)}
                  disabled={addingGuardian}
                  className="w-64"
                />
                <Button onClick={handleAddGuardian} disabled={addingGuardian || !guardianInput.trim()}>
                  {addingGuardian ? 'Adding...' : 'Add Guardian'}
                </Button>
              </div>
            )}
            {/* Recovery status and actions */}
            {guardians.length > 0 && !loading && (
              <div className="mt-4">
                <div className="font-medium mb-1">Recovery Status:</div>
                <div className="text-sm mb-1">
                  {recoveryStatus.recovered ? (
                    <span className="text-green-700 font-semibold">Recovered (majority approved)</span>
                  ) : (
                    <>
                      {recoveryStatus.approvals?.length || 0} / {guardians.length} approvals
                      {isGuardian && !recoveryStatus.recovered && !recoveryStatus.approvals?.includes(user?.id) && (
                        <Button size="sm" className="ml-3" onClick={handleApproveRecovery} disabled={submitting}>
                          {submitting ? 'Processing...' : 'Approve Recovery'}
                        </Button>
                      )}
                      {isGuardian && recoveryStatus.approvals?.includes(user?.id) && (
                        <span className="ml-3 text-blue-700">You have approved</span>
                      )}
                    </>
                  )}
                </div>
                {recoveryStatus.approvals?.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Approved by: {recoveryStatus.approvals.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Milestone className="w-5 h-5" />
            Milestones ({milestones.length})
          </CardTitle>
          <CardDescription>Payment breakdown across milestones</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-center text-muted-foreground py-6">Loading milestones...</div>
          ) : milestones.length === 0 ? (
            <div className="text-center text-muted-foreground py-6">No milestones defined for this escrow.</div>
          ) : (
            milestones.map((milestone: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition">
                <div className="flex-1">
                  <div className="font-medium">{milestone.description}</div>
                  <div className="text-sm text-muted-foreground">
                    ${parseFloat(milestone.amount).toFixed(2)} {escrow.currency}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {milestone.released ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-xs text-green-600 font-medium">Released</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-5 h-5 text-yellow-600" />
                      <span className="text-xs text-yellow-600 font-medium">Pending</span>
                    </>
                  )}
                  {isPayer && !milestone.released && escrow.status === 'funded' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRelease(idx)}
                      disabled={submitting}
                    >
                      {submitting ? 'Processing...' : 'Approve'}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {(escrow.status === 'pending' && isPayer) && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-sm">Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={handleCancel} variant="destructive">
              Cancel Escrow
            </Button>
          </CardContent>
        </Card>
      )}

      {(escrow.status === 'active' || escrow.status === 'funded') && isPayer && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-sm">Dispute</CardTitle>
            <CardDescription>If there's an issue with this escrow</CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">File Dispute</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>File Escrow Dispute</DialogTitle>
                  <DialogDescription>Explain the issue so our team can help resolve it</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Textarea
                    placeholder="Describe the issue..."
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    rows={5}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleDispute}
                      disabled={submitting || !disputeReason.trim()}
                      className="flex-1"
                    >
                      {submitting ? 'Filing...' : 'File Dispute'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDisputeDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* Back Button */}
      <div className="fixed bottom-4 left-0 w-full flex justify-center z-30 md:static md:w-auto md:justify-start md:mb-0 mt-8">
        <Button
          variant="secondary"
          size="lg"
          className="font-bold px-8 py-3 shadow-md rounded-full md:rounded-lg"
          onClick={() => navigate('/escrow')}
        >
          ← Back to Escrows
        </Button>
      </div>
    </div>
  );
}
