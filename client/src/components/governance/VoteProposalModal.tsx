import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Clock,
  Users,
  Zap,
  Share2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
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
  };
}

export interface VoteProposalModalProps {
  proposal?: ProposalDetails;
  isOpen: boolean;
  onClose: () => void;
  onVoteSuccess?: (voteType: string) => void;
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
  const [selectedVote, setSelectedVote] = useState<'for' | 'against' | 'abstain' | null>(
    proposal?.yourVote || null
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (!proposal) return null;

  // Calculate vote progress
  const totalVotes = proposal.currentVotes.for + proposal.currentVotes.against + proposal.currentVotes.abstain;
  const forPercentage = totalVotes > 0 ? (proposal.currentVotes.for / totalVotes) * 100 : 0;
  const againstPercentage = totalVotes > 0 ? (proposal.currentVotes.against / totalVotes) * 100 : 0;
  const abstainPercentage = totalVotes > 0 ? (proposal.currentVotes.abstain / totalVotes) * 100 : 0;

  // Calculate time remaining
  const now = new Date();
  const timeRemaining = Math.max(0, proposal.votingEndsAt.getTime() - now.getTime());
  const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const isVotingClosed = timeRemaining <= 0;

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async (voteType: 'for' | 'against' | 'abstain') => {
      const response = await apiRequest(
        'POST',
        `/api/governance/${proposal.daoId}/proposals/${proposal.id}/vote`,
        {
          voteType,
          votingPower: proposal.userVotingPower,
        }
      );
      return response;
    },
    onSuccess: (data, voteType) => {
      toast({
        title: 'Vote submitted!',
        description: `Your ${voteType} vote has been recorded.`,
        variant: 'default',
      });

      // Invalidate proposal query to refresh data
      queryClient.invalidateQueries({
        queryKey: ['proposal', proposal.id],
      });

      setShowConfirm(false);
      onVoteSuccess?.(voteType);
    },
    onError: (error: any) => {
      toast({
        title: 'Vote failed',
        description: error?.message || 'Failed to submit your vote. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleVote = async () => {
    if (!selectedVote) return;
    setShowConfirm(true);
  };

  const handleConfirmVote = async () => {
    if (!selectedVote) return;
    await voteMutation.mutateAsync(selectedVote);
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
          <DialogTitle className="text-2xl font-bold text-white">
            {proposal.title}
          </DialogTitle>
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

          {/* Voting Status Card */}
          {!isVotingClosed && (
            <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-blue-400" />
                <p className="text-sm font-semibold text-blue-300">
                  Voting closes in {daysRemaining}d {hoursRemaining}h
                </p>
              </div>

              {proposal.votingDetails && (
                <div className="text-xs text-blue-200 space-y-1">
                  <p>📊 Participation: {proposal.votingDetails.participationRate}%</p>
                  <p>👥 Total voters: {proposal.votingDetails.totalVoters}</p>
                  <p>🎯 Quorum required: {proposal.votingDetails.quorumRequired}%</p>
                </div>
              )}
            </div>
          )}

          {isVotingClosed && (
            <div className="bg-gray-900/30 border border-gray-700/50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-gray-400" />
                <p className="text-sm font-semibold text-gray-300">Voting has ended</p>
              </div>
            </div>
          )}

          {/* Vote Results */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-300">Current Votes</p>

            {/* For votes */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-gray-300">For</span>
                </div>
                <span className="text-sm font-bold text-green-400">
                  {proposal.currentVotes.for} votes
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-green-500 h-3 transition-all"
                  style={{ width: `${forPercentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">{forPercentage.toFixed(1)}% of votes</p>
            </div>

            {/* Against votes */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ThumbsDown className="h-4 w-4 text-red-400" />
                  <span className="text-sm text-gray-300">Against</span>
                </div>
                <span className="text-sm font-bold text-red-400">
                  {proposal.currentVotes.against} votes
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-red-500 h-3 transition-all"
                  style={{ width: `${againstPercentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">{againstPercentage.toFixed(1)}% of votes</p>
            </div>

            {/* Abstain votes */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm text-gray-300">Abstain</span>
                </div>
                <span className="text-sm font-bold text-yellow-400">
                  {proposal.currentVotes.abstain} votes
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-yellow-500 h-3 transition-all"
                  style={{ width: `${abstainPercentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">{abstainPercentage.toFixed(1)}% of votes</p>
            </div>
          </div>

          {/* Your Voting Power */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-400" />
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

              <div className="grid grid-cols-3 gap-3">
                {/* For Button */}
                <button
                  onClick={() => setSelectedVote('for')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedVote === 'for'
                      ? 'border-green-500 bg-green-900/30'
                      : 'border-slate-600 bg-slate-800 hover:border-green-500/50'
                  }`}
                >
                  <ThumbsUp className={`h-5 w-5 mx-auto mb-2 ${selectedVote === 'for' ? 'text-green-400' : 'text-gray-400'}`} />
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
                  <ThumbsDown className={`h-5 w-5 mx-auto mb-2 ${selectedVote === 'against' ? 'text-red-400' : 'text-gray-400'}`} />
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
                  <HelpCircle className={`h-5 w-5 mx-auto mb-2 ${selectedVote === 'abstain' ? 'text-yellow-400' : 'text-gray-400'}`} />
                  <p className={`text-sm font-medium ${selectedVote === 'abstain' ? 'text-yellow-400' : 'text-gray-300'}`}>
                    Abstain
                  </p>
                </button>
              </div>

              {proposal.yourVote && (
                <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-400 flex-shrink-0" />
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
                You are about to vote <strong>{selectedVote}</strong> with a voting power of{' '}
                <strong>{proposal.userVotingPower}</strong>.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleConfirmVote}
                  disabled={voteMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {voteMutation.isPending ? 'Submitting...' : 'Confirm Vote'}
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
          <p className="text-xs text-gray-500">
            Last updated: {new Date().toLocaleTimeString()}
          </p>
          <div className="flex gap-2">
            {!isVotingClosed && selectedVote && !showConfirm && (
              <Button
                onClick={handleVote}
                disabled={voteMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {voteMutation.isPending ? 'Submitting...' : 'Submit Vote'}
              </Button>
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
