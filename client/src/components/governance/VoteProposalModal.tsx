import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowDownLeft, MoreHorizontal, Activity, Send, Shield, ChartPie, Users, Target } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export interface ProposalDetails {
  id: string;
  title: string;
  description: string;
  type: 'general' | 'budget' | 'poll' | 'emergency';
  status: 'pending' | 'voting' | 'passed' | 'failed' | 'executed';
  daoId: string;
  daoName: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt?: Date;
  votingEndsAt: Date;
  currentVotes: {
    for: number;
    against: number;
    abstain: number;
  };
  votesRequired: number;
  yourVote?: 'for' | 'against' | 'abstain' | null;
  userVotingPower: number;
  votingDetails?: {
    totalVoters: number;
    participationRate: number;
    quorumRequired: number;
    commentsCount?: number;
    amountRequested?: number;
    treasuryImpact?: string;
  };
}

export interface VoteProposalModalProps {
  proposal?: ProposalDetails;
  isOpen: boolean;
  onClose: () => void;
  onVoteSuccess?: (voteType: string) => void;
  daoType?: string;
}

/**
 * VoteProposalModal - Modal for voting on proposals
 *
 * Features:
 * - Shows full proposal details
 * - Vote options: For, Against, Abstain
 * - Shows voting weight/power
 * - Real-time vote counts
 * - Time remaining
 * - Change vote capability
 * - Voting power multiplier (for Elders 2x)
 * - Quorum information
 *
 * Used in:
 * - Governance dashboard
 * - DAO pages
 * - Proposal details page
 */
export function VoteProposalModal({
  proposal,
  isOpen,
  onClose,
  onVoteSuccess,
}: VoteProposalModalProps) {
  const proposalExists = !!proposal;

  const [selectedVote, setSelectedVote] = useState<'for' | 'against' | 'abstain' | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [relativeUpdated, setRelativeUpdated] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // keep ]selectedVote in sync if proposal changes while modal is open
  useEffect(() => {
    setSelectedVote(proposal?.yourVote || null);
  }, [proposal?.id, proposal?.yourVote]);

  if (!proposalExists || !isOpen) return null;

  // Relative updated label (updates periodically)
  useEffect(() => {
    const getLabel = () => {
      const ref = new Date(proposal.updatedAt || proposal.createdAt).getTime();
      const diff = Math.floor((Date.now() - ref) / 1000);
      if (diff < 60) return `Updated ${diff}s ago`;
      if (diff < 3600) return `Updated ${Math.floor(diff / 60)}m ago`;
      return `Updated ${Math.floor(diff / 3600)}h ago`;
    };
    setRelativeUpdated(getLabel());
    const id = setInterval(() => setRelativeUpdated(getLabel()), 5000);
    return () => clearInterval(id);
  }, [proposal.id, proposal.updatedAt, proposal.createdAt]);

  // Calculate vote progress (use numeric safety)
  const totalVotes = (proposal.currentVotes.for || 0) + (proposal.currentVotes.against || 0) + (proposal.currentVotes.abstain || 0);
  const forPercentage = totalVotes > 0 ? (proposal.currentVotes.for / totalVotes) * 100 : 0;
  const againstPercentage = totalVotes > 0 ? (proposal.currentVotes.against / totalVotes) * 100 : 0;
  const abstainPercentage = totalVotes > 0 ? (proposal.currentVotes.abstain / totalVotes) * 100 : 0;

  // Calculate time remaining (accept string or Date)
  const endMs = new Date(proposal.votingEndsAt).getTime();
  const timeRemainingMs = Math.max(0, endMs - Date.now());
  const daysRemaining = Math.floor(timeRemainingMs / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.floor((timeRemainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const isVotingClosed = timeRemainingMs <= 0;

  // Proposal status mapping for a small badge near the title
  const statusMap: Record<string, { label: string; emoji: string; className: string }> = {
    pending: { label: 'Pending', emoji: '🟡', className: 'bg-yellow-600/30 text-yellow-200' },
    voting: { label: 'Voting', emoji: '🟢', className: 'bg-green-600/30 text-green-200' },
    passed: { label: 'Passed', emoji: '🟢', className: 'bg-green-600/30 text-green-200' },
    failed: { label: 'Failed', emoji: '🔴', className: 'bg-red-600/30 text-red-200' },
    executed: { label: 'Executed', emoji: '🔵', className: 'bg-blue-600/30 text-blue-200' },
  };

  const statusInfo = statusMap[proposal.status] || statusMap.pending;

  // Quorum / participation progress
  const participation = proposal.votingDetails?.participationRate ?? 0;
  const quorumRequired = proposal.votingDetails?.quorumRequired ?? 0;
  const quorumProgressPercent = quorumRequired > 0 ? Math.min(100, (participation / quorumRequired) * 100) : 0;

  // Outcome prediction
  const forVotes = proposal.currentVotes.for || 0;
  const againstVotes = proposal.currentVotes.against || 0;
  const hasQuorum = quorumRequired > 0 ? participation >= quorumRequired : true;
  let outcomeLabel = 'Tied';
  let outcomeClass = 'text-gray-300';
  if (forVotes > againstVotes && hasQuorum) {
    outcomeLabel = 'Likely Passing';
    outcomeClass = 'text-green-400';
  } else if (forVotes > againstVotes && !hasQuorum) {
    outcomeLabel = 'Leading (quorum not reached)';
    outcomeClass = 'text-yellow-300';
  } else if (againstVotes > forVotes) {
    outcomeLabel = 'Likely Failing';
    outcomeClass = 'text-red-400';
  }

  type VoteType = 'for' | 'against' | 'abstain';

  // Vote mutation (project's react-query typing expects simple handlers)
  const voteMutation = useMutation<void, any, VoteType>({
    mutationFn: async (voteType: VoteType) => {
      await apiRequest(
        'POST',
        `/api/v1/daos/${proposal!.daoId}/proposals/${proposal!.id}/vote`,
        {
          voteType,
          votingPower: proposal!.userVotingPower,
        }
      );
    },
    onSuccess: () => {
      toast({ title: 'Vote submitted!', description: `Your vote has been recorded.`, variant: 'default' });
      queryClient.invalidateQueries({ queryKey: ['proposal', proposal!.id] });
      setShowConfirm(false);
      onVoteSuccess?.(selectedVote as string);
    },
    onError: (error: any) => {
      toast({ title: 'Vote failed', description: error?.message || 'Failed to submit your vote.', variant: 'destructive' });
    },
  });

  const handleVote = async () => {
    if (!selectedVote || voteMutation.isPending) return;
    setShowConfirm(true);
  };

  const handleConfirmVote = async () => {
    if (!selectedVote || voteMutation.isPending) return;
    voteMutation.mutate(selectedVote as VoteType);
  };

  // Proposal type colors
  const typeColors: Record<string, string> = {
    general: 'bg-blue-600/40 text-blue-200',
    budget: 'bg-green-600/40 text-green-200',
    poll: 'bg-yellow-600/40 text-yellow-200',
    emergency: 'bg-red-600/40 text-red-200',
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <div className="flex items-center justify-between w-full">
            <DialogTitle className="text-2xl font-bold text-white">{proposal.title}</DialogTitle>
            <div className="ml-4 flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-sm font-semibold ${statusInfo.className}`}>
                <span className="mr-2">{statusInfo.emoji}</span>
                {statusInfo.label.toUpperCase()}
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 p-2">
          {/* Header Info */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-gray-400 mb-1">DAO • Proposed by</p>
              <p className="text-base text-white">
                {proposal.daoName} • {proposal.createdByName}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                  typeColors[proposal.type]
                }`}
              >
                {proposal.type.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Description</h3>
            <p className="text-white text-sm leading-relaxed">{proposal.description}</p>
          </div>

          {/* DAO-type intelligence */}
          {proposal.type === 'budget' && (
            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 text-sm text-gray-300">
              <p className="font-semibold text-gray-200">Treasury Impact</p>
              <p className="mt-1">Amount requested: {proposal.votingDetails?.amountRequested ?? '—'}</p>
              <p className="mt-1">Estimated impact: {proposal.votingDetails?.treasuryImpact ?? 'Not provided'}</p>
            </div>
          )}

          {proposal.type === 'emergency' && (
            <div className="bg-red-900/10 rounded-lg p-3 border border-red-700/30 text-sm text-red-200">
              <p className="font-semibold">⚠ Fast-track governance</p>
              <p className="mt-1 text-xs">Voting ends in {daysRemaining}d {hoursRemaining}h (fast-track)</p>
            </div>
          )}

          {proposal.type === 'poll' && (
            <div className="bg-yellow-900/10 rounded-lg p-3 border border-yellow-700/20 text-sm text-yellow-200">
              <p className="font-semibold">Community feedback poll</p>
              <p className="mt-1 text-xs">Non-binding result — for community sentiment</p>
            </div>
          )}

          {proposal.type === 'general' && (
            <div className="bg-blue-900/10 rounded-lg p-3 border border-blue-700/20 text-sm text-blue-200">
              <p className="font-semibold">Governance decision</p>
              <p className="mt-1 text-xs">Real-time opportunity for DAO governance</p>
            </div>
          )}

          {/* Discussion / Social Layer stub */}
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 text-sm text-gray-300">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Discussion</p>
              <p className="text-xs text-slate-400">{proposal.votingDetails?.commentsCount ?? 0} comments</p>
            </div>
            <p className="mt-2 text-xs text-gray-400">{proposal.votingDetails?.commentsCount ? 'Latest comments visible in discussion' : 'No comments yet — encourage discussion before voting.'}</p>
          </div>

          {/* Voting Status Card */}
          {!isVotingClosed && (
            <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-5 w-5 text-blue-400" />
                <p className="text-sm font-semibold text-blue-300">
                  Voting closes in {daysRemaining}d {hoursRemaining}h
                </p>
              </div>

              {proposal.votingDetails && (
                <div className="text-xs text-blue-200 space-y-2">
                  <p className="flex items-center gap-2">{Users && <Users className="w-4 h-4 text-blue-200" />} Total voters: {proposal.votingDetails.totalVoters}</p>

                  <div>
                    <p className="flex items-center gap-2">{Target && <Target className="w-4 h-4 text-blue-200" />} Quorum Progress</p>
                    <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden mt-1">
                      <div className="h-3 bg-blue-400 transition-all" style={{ width: `${quorumProgressPercent}%` }} />
                    </div>
                    <p className="text-xs text-gray-300 mt-1">{proposal.votingDetails.participationRate}% / {proposal.votingDetails.quorumRequired}%</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {isVotingClosed && (
            <div className="bg-gray-900/30 border border-gray-700/50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-gray-400" />
                <p className="text-sm font-semibold text-gray-300">Voting has ended</p>
              </div>
            </div>
          )}

          {/* Vote Results */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-300">Current Votes</p>
              <p className={`text-sm font-semibold ${outcomeClass}`}>{outcomeLabel}</p>
            </div>

            {/* For votes */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-gray-300">For</span>
                </div>
                <span className="text-sm font-bold text-green-400">
                  {proposal.currentVotes.for} votes
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                <div className={`bg-green-500 h-3 transition-all w-[${forPercentage}%]`} />
              </div>
              <p className="text-xs text-gray-500">{forPercentage.toFixed(1)}% of votes</p>
            </div>

            {/* Against votes */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ArrowDownLeft className="h-4 w-4 text-red-400" />
                  <span className="text-sm text-gray-300">Against</span>
                </div>
                <span className="text-sm font-bold text-red-400">
                  {proposal.currentVotes.against} votes
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                <div className={`bg-red-500 h-3 transition-all w-[${againstPercentage}%]`} />
              </div>
              <p className="text-xs text-gray-500">{againstPercentage.toFixed(1)}% of votes</p>
            </div>

            {/* Abstain votes */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <MoreHorizontal className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm text-gray-300">Abstain</span>
                </div>
                <span className="text-sm font-bold text-yellow-400">
                  {proposal.currentVotes.abstain} votes
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                <div className={`bg-yellow-500 h-3 transition-all w-[${abstainPercentage}%]`} />
              </div>
              <p className="text-xs text-gray-500">{abstainPercentage.toFixed(1)}% of votes</p>
            </div>
          </div>

          {/* Your Voting Power */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-yellow-400" />
                <p className="text-sm font-semibold text-gray-300">Your Voting Power</p>
              </div>
              <p className="text-lg font-bold text-yellow-400">{proposal.userVotingPower}</p>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Your vote counts as {proposal.userVotingPower} vote(s). This may be increased if you hold a leadership role.
            </p>
          </div>

          {/* Vote Options */}
          {!isVotingClosed && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-300">Your Vote</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* For Button */}
                <button
                  onClick={() => setSelectedVote('for')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedVote === 'for'
                      ? 'border-green-500 bg-green-900/30'
                      : 'border-slate-600 bg-slate-800 hover:border-green-500/50'
                  }`}
                >
                  <CheckCircle className={`h-5 w-5 mx-auto mb-2 ${selectedVote === 'for' ? 'text-green-400' : 'text-gray-400'}`} />
                  <p className={`text-sm font-medium ${selectedVote === 'for' ? 'text-green-400' : 'text-gray-300'}`}>
                    For
                  </p>
                </button>

                {/* Against Button */}
                <button
                  onClick={() => setSelectedVote('against')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedVote === 'against'
                      ? 'border-red-500 bg-red-900/30'
                      : 'border-slate-600 bg-slate-800 hover:border-red-500/50'
                  }`}
                >
                  <ArrowDownLeft className={`h-5 w-5 mx-auto mb-2 ${selectedVote === 'against' ? 'text-red-400' : 'text-gray-400'}`} />
                  <p className={`text-sm font-medium ${selectedVote === 'against' ? 'text-red-400' : 'text-gray-300'}`}>
                    Against
                  </p>
                </button>

                {/* Abstain Button */}
                <button
                  onClick={() => setSelectedVote('abstain')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedVote === 'abstain'
                      ? 'border-yellow-500 bg-yellow-900/30'
                      : 'border-slate-600 bg-slate-800 hover:border-yellow-500/50'
                  }`}
                >
                  <MoreHorizontal className={`h-5 w-5 mx-auto mb-2 ${selectedVote === 'abstain' ? 'text-yellow-400' : 'text-gray-400'}`} />
                  <p className={`text-sm font-medium ${selectedVote === 'abstain' ? 'text-yellow-400' : 'text-gray-300'}`}>
                    Abstain
                  </p>
                </button>
              </div>

              {proposal.yourVote && (
                <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-blue-400 flex-shrink-0" />
                  <p className="text-sm text-blue-300">
                    You already voted <strong>{proposal.yourVote}</strong>. You can change your vote.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Confirmation Modal */}
          {showConfirm && selectedVote && (
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-sm font-semibold text-white mb-3">Confirm your vote</p>
              <p className="text-sm text-gray-300 mb-4">
                You are about to vote <strong>{selectedVote}</strong> with a voting power of <strong>{proposal.userVotingPower}</strong>.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleConfirmVote}
                  disabled={voteMutation.isPending}
                  className={`flex-1 ${selectedVote === 'for' ? 'bg-green-600 hover:bg-green-700' : selectedVote === 'against' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-600 hover:bg-slate-700'}`}
                >
                  {voteMutation.isPending ? 'Submitting...' : `Confirm ${selectedVote?.toUpperCase()} Vote`}
                </Button>
                <Button
                  onClick={() => setShowConfirm(false)}
                  variant="outline"
                  className="flex-1 text-gray-300 border-slate-600"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-700">
          <p className="text-xs text-gray-500">{relativeUpdated || ''}</p>
          <div className="flex gap-2">
            {!isVotingClosed && selectedVote && !showConfirm && (
              <>
                <div className="mr-4 text-xs text-slate-400">Selected: <strong className="text-white">{selectedVote?.toUpperCase()}</strong></div>
                <Button
                  onClick={handleVote}
                  disabled={voteMutation.isPending}
                  className={` ${selectedVote === 'for' ? 'bg-green-600 hover:bg-green-700' : selectedVote === 'against' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-600 hover:bg-slate-700'}`}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {voteMutation.isPending ? 'Submitting...' : `Submit ${selectedVote?.toUpperCase()}`}
                </Button>
              </>
            )}
            <Button onClick={onClose} variant="outline" className="text-gray-300 border-slate-600">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default VoteProposalModal;
