import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthUser, useUserRole } from '@/contexts/auth-context';
import MultisigWizard from '@/components/multisig/MultisigWizard';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export default function DaoGovernancePage() {
  const { id: daoId } = useParams<{ id: string }>();

  if (!daoId) {
    return <div className="p-4">Invalid DAO ID</div>;
  }

  const { data: proposals = [], isLoading, error } = useQuery({
    queryKey: [`/api/governance/proposals?daoId=${daoId}`],
    queryFn: () => apiGet(`/api/governance/proposals?daoId=${daoId}`).catch(() => []),
    enabled: !!daoId,
  });

  const operational = useMemo(() => {
    const active = (proposals || []).filter((p: any) => (p.status || '').toLowerCase() === 'active');
    const nearQuorum = active.filter((p: any) => {
      const votesFor = Number(p.votesFor || 0);
      const quorum = Number(p.quorum || 0);
      if (!quorum) return false;
      return votesFor >= Math.ceil(quorum * 0.8);
    }).length;
    const blockedByTreasury = (proposals || []).filter((p: any) => p.blockers && p.blockers.includes('treasury')).length;
    const estimatedImpact = (proposals || []).reduce((sum: number, p: any) => sum + Number(p.estimatedImpactUsd || 0), 0);
    const total = (proposals || []).length;
    return { total, activeCount: active.length, nearQuorum, blockedByTreasury, estimatedImpact };
  }, [proposals]);

  const user = useAuthUser();
  const role = useUserRole();
  const { toast } = useToast();

  async function queueForExecution(proposalId: string) {
    // Only admins may queue execution directly
    if (!user || role !== 'admin') {
      toast({ title: 'Permission', description: 'Only DAO admins may queue execution. Request elevated permissions.' }, 'error');
      return;
    }

    try {
      const res = await fetch(`/api/treasury/queue-execution`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daoId, proposalId })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || JSON.stringify(payload));

      // If backend indicates multisig required for onchain steps, open Multisig flow
      if (payload?.requiresMultisig) {
        const suggested = payload?.suggestedSigners || [];
        setWizardProposal(proposalId);
        setWizardInitial(suggested);
        setShowMultisig(true);
        toast({ title: 'Multisig Required', description: 'This action requires multisig setup. Opening Multisig Wizard.', variant: 'warning' });
        return;
      }

      toast({ title: 'Queued', description: `Proposal queued for execution (job ${payload.jobId || 'n/a'})`, variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Error', description: 'Failed to queue execution: ' + (e?.message || e), variant: 'destructive' });
    }
  }
  const [showMultisig, setShowMultisig] = useState(false);
  const [wizardInitial, setWizardInitial] = useState<string[]>([]);
  const [wizardProposal, setWizardProposal] = useState<string | null>(null);
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmProposal, setConfirmProposal] = useState<any | null>(null);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'passed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-12 gap-4 items-center">
        <div className="col-span-8">
          <div>
            <h1 className="text-3xl font-bold">Governance</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Create and vote on DAO proposals</p>
          </div>
        </div>
        <div className="col-span-4 text-right">
          <div className="inline-flex items-center gap-3">
            <div className="text-sm text-gray-500">Proposals: <span className="font-semibold">{operational.total}</span></div>
            <div className="text-sm text-yellow-400">Near quorum: <span className="font-semibold">{operational.nearQuorum}</span></div>
            <div className="text-sm text-red-400">Blocked: <span className="font-semibold">{operational.blockedByTreasury}</span></div>
          </div>
        </div>
      </div>

      {/* Operational Narrative */}
      <div className="p-4 bg-gray-900 rounded">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400">Operational Narrative</div>
            <div className="text-lg font-semibold mt-1">{operational.activeCount} active • {operational.nearQuorum} nearing quorum • Estimated impact: ${operational.estimatedImpact.toLocaleString()}</div>
            <div className="text-sm text-gray-400 mt-1">{operational.blockedByTreasury > 0 ? `${operational.blockedByTreasury} proposals blocked by treasury policy` : 'No proposals blocked by treasury'}</div>
          </div>
          <div>
            <button
              className="px-3 py-2 bg-mtaa-purple text-white rounded"
              onClick={() => navigate(`/dao/${daoId}/treasury?open=execution-queue`)}
            >
              Open Treasury Execution Queue
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Create Proposal
        </Button>
      </div>

      <div className="space-y-4">
                {isLoading ? (
          <Card>
            <CardContent className="p-6 text-center text-gray-600">
              Loading proposals...
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-center text-red-600">
              Error loading proposals
            </CardContent>
          </Card>
        ) : proposals && proposals.length > 0 ? (
          proposals.map((proposal: any) => (
            <Card key={proposal.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{proposal.title}</CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      by {proposal.author || 'Unknown'}
                    </p>
                  </div>
                  <Badge className={getStatusColor(proposal.status)}>
                    {proposal.status || 'Pending'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-600 dark:text-gray-400">{proposal.description}</p>
                
                {proposal.votesFor !== undefined && proposal.votesAgainst !== undefined && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Vote Count</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
                        <p className="text-xs text-gray-600 dark:text-gray-400">For</p>
                        <p className="text-xl font-bold text-green-600 dark:text-green-400">
                          {proposal.votesFor}
                        </p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded">
                        <p className="text-xs text-gray-600 dark:text-gray-400">Against</p>
                        <p className="text-xl font-bold text-red-600 dark:text-red-400">
                          {proposal.votesAgainst}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div>
                    <span className="text-xs text-gray-500">{proposal.createdAt && new Date(proposal.createdAt).toLocaleDateString()}</span>
                    {proposal.votesFor !== undefined && proposal.quorum !== undefined && (
                      <div className="text-xs text-gray-400 mt-1">Quorum progress: {proposal.votesFor}/{proposal.quorum}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {proposal.status === 'passed' && !proposal.executionQueued && (
                      <Button variant="outline" size="sm" onClick={() => { setConfirmProposal(proposal); setConfirmOpen(true); }}>Queue for Execution</Button>
                    )}
                    <Button variant="outline" size="sm">View Details</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-5xl mb-4">📄</div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No proposals yet. Be the first to create one!
              </p>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create First Proposal
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      {showMultisig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-3xl p-4">
            <MultisigWizard
              initialSigners={wizardInitial}
              onClose={() => setShowMultisig(false)}
              onCreated={(m) => {
                setShowMultisig(false);
                toast({ title: 'Multisig', description: 'Multisig created/queued: ' + (m?.id || m?.address || 'ok'), variant: 'success' });
              }}
            />
          </div>
        </div>
      )}
      {confirmOpen && confirmProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg p-6 bg-white rounded shadow">
            <h3 className="text-lg font-semibold">Confirm execution</h3>
            <p className="text-sm text-gray-600 mt-2">This will queue the proposal for execution. Review the consequences below before confirming.</p>
            <div className="mt-4">
              <div className="text-sm">Title: <span className="font-medium">{confirmProposal.title}</span></div>
              <div className="text-sm mt-1">Estimated impact: <span className="font-medium">${Number(confirmProposal.estimatedImpactUsd || 0).toLocaleString()}</span></div>
              <div className="text-sm mt-1">Requires signatures: <span className="font-medium">{confirmProposal.requiredSignatures || confirmProposal.required || 'TBD'}</span></div>
              <div className="text-xs text-gray-500 mt-2">Note: Executing may move funds from treasury and affect runway.</div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setConfirmOpen(false); setConfirmProposal(null); }}>Cancel</Button>
              <Button onClick={async () => { setConfirmOpen(false); await queueForExecution(confirmProposal.id); setConfirmProposal(null); }}>Confirm & Queue</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
