import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Users,
  BarChart3,
  ExternalLink,
} from 'lucide-react';

export interface ProposalResult {
  id: string;
  title: string;
  daoName: string;
  status: 'voting' | 'passed' | 'failed' | 'executed';
  type: 'general' | 'budget' | 'poll' | 'emergency';
  createdAt: Date;
  votingEndsAt: Date;
  votes: {
    for: number;
    against: number;
    abstain: number;
  };
  votesRequired: number;
  totalVoters: number;
  participationRate: number;
  quorumRequired: number;
  outcome?: {
    passedAt?: Date;
    failedAt?: Date;
    executedAt?: Date;
    margin: number; // percentage of votes
  };
  yourVote?: 'for' | 'against' | 'abstain';
}

export interface ProposalResultsCardProps {
  proposal: ProposalResult;
  onViewDetails?: () => void;
  onExecute?: () => void;
  onViewProposal?: () => void;
  compact?: boolean;
}

/**
 * ProposalResultsCard - Shows proposal results and voting outcomes
 *
 * Features:
 * - Vote breakdown with percentages
 * - Passed/Failed status
 * - Quorum information
 * - Participation rates
 * - Time to vote/executed
 * - Execute button (if passed)
 * - View full proposal button
 *
 * Used in:
 * - Proposal listings
 * - Dashboard summaries
 * - Governance history
 * - DAO management page
 */
export function ProposalResultsCard({
  proposal,
  onViewDetails,
  onExecute,
  onViewProposal,
  compact = false,
}: ProposalResultsCardProps) {
  // Calculate statistics
  const stats = useMemo(() => {
    const totalVotes = proposal.votes.for + proposal.votes.against + proposal.votes.abstain;
    const forPercentage = totalVotes > 0 ? (proposal.votes.for / totalVotes) * 100 : 0;
    const againstPercentage = totalVotes > 0 ? (proposal.votes.against / totalVotes) * 100 : 0;
    const abstainPercentage = totalVotes > 0 ? (proposal.votes.abstain / totalVotes) * 100 : 0;

    const hasQuorum = proposal.participationRate >= proposal.quorumRequired;
    const hasPassed = proposal.votes.for > proposal.votes.against;
    const result = hasQuorum && hasPassed ? 'passed' : hasQuorum && !hasPassed ? 'failed' : 'voting';

    return {
      totalVotes,
      forPercentage,
      againstPercentage,
      abstainPercentage,
      hasQuorum,
      hasPassed,
      result,
    };
  }, [proposal]);

  // Determine status colors
  const statusConfig = {
    voting: {
      icon: <Clock className="h-5 w-5" />,
      label: 'Voting',
      color: 'text-blue-400',
      bgColor: 'bg-blue-900/30',
      borderColor: 'border-blue-700/50',
    },
    passed: {
      icon: <CheckCircle2 className="h-5 w-5" />,
      label: 'Passed',
      color: 'text-green-400',
      bgColor: 'bg-green-900/30',
      borderColor: 'border-green-700/50',
    },
    failed: {
      icon: <XCircle className="h-5 w-5" />,
      label: 'Failed',
      color: 'text-red-400',
      bgColor: 'bg-red-900/30',
      borderColor: 'border-red-700/50',
    },
    executed: {
      icon: <CheckCircle2 className="h-5 w-5" />,
      label: 'Executed',
      color: 'text-purple-400',
      bgColor: 'bg-purple-900/30',
      borderColor: 'border-purple-700/50',
    },
  };

  const statusConfig_ = statusConfig[proposal.status];

  // Type colors
  const typeColors: Record<string, string> = {
    general: 'bg-blue-600/40 text-blue-200',
    budget: 'bg-green-600/40 text-green-200',
    poll: 'bg-yellow-600/40 text-yellow-200',
    emergency: 'bg-red-600/40 text-red-200',
  };

  // Compact view
  if (compact) {
    return (
      <div className={`p-3 rounded-lg border bg-slate-800 border-slate-700 hover:border-slate-600 transition-all cursor-pointer`}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-white line-clamp-1">{proposal.title}</h4>
            <p className="text-xs text-gray-400">{proposal.daoName}</p>
          </div>
          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold flex-shrink-0 ${statusConfig_[proposal.status]?.color}`}>
            {statusConfig_[proposal.status]?.label}
          </span>
        </div>

        {/* Mini vote bars */}
        <div className="flex gap-1 h-2 rounded-full overflow-hidden">
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${stats.forPercentage}%` }}
            title={`For: ${proposal.votes.for}`}
          />
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${stats.againstPercentage}%` }}
            title={`Against: ${proposal.votes.against}`}
          />
          <div
            className="bg-yellow-500 transition-all"
            style={{ width: `${stats.abstainPercentage}%` }}
            title={`Abstain: ${proposal.votes.abstain}`}
          />
        </div>

        <p className="text-xs text-gray-500 mt-1">
          {proposal.votes.for}/{proposal.votesRequired} votes needed
        </p>
      </div>
    );
  }

  // Full view
  return (
    <div className={`rounded-lg border ${statusConfig_.bgColor} ${statusConfig_.borderColor} p-6`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white mb-1">{proposal.title}</h3>
          <p className="text-sm text-gray-400">{proposal.daoName}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {statusConfig_.icon}
          <span className="text-sm font-semibold text-white">{statusConfig_.label}</span>
        </div>
      </div>

      {/* Type badge */}
      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4 ${typeColors[proposal.type]}`}>
        {proposal.type.toUpperCase()}
      </span>

      {/* Vote Breakdown */}
      <div className="space-y-4 mb-6">
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-green-400" />
              <span className="text-sm text-gray-300">For</span>
            </div>
            <span className="text-sm font-bold text-green-400">{proposal.votes.for} votes</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-green-500 h-3 transition-all"
              style={{ width: `${stats.forPercentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{stats.forPercentage.toFixed(1)}%</p>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-red-400" />
              <span className="text-sm text-gray-300">Against</span>
            </div>
            <span className="text-sm font-bold text-red-400">{proposal.votes.against} votes</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-red-500 h-3 transition-all"
              style={{ width: `${stats.againstPercentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{stats.againstPercentage.toFixed(1)}%</p>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-300">Abstain</span>
            <span className="text-sm font-bold text-yellow-400">{proposal.votes.abstain} votes</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-yellow-500 h-3 transition-all"
              style={{ width: `${stats.abstainPercentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{stats.abstainPercentage.toFixed(1)}%</p>
        </div>
      </div>

      {/* Participation & Quorum */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Total Votes</p>
          <p className="text-lg font-bold text-white">{stats.totalVotes}</p>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Participation</p>
          <p className="text-lg font-bold text-white">{proposal.participationRate}%</p>
          <p className="text-xs text-gray-500">({proposal.totalVoters} voters)</p>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Quorum</p>
          <p className="text-lg font-bold text-white">{proposal.quorumRequired}%</p>
          <p className={`text-xs ${stats.hasQuorum ? 'text-green-400' : 'text-red-400'}`}>
            {stats.hasQuorum ? '✅ Reached' : '❌ Not reached'}
          </p>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Winning Margin</p>
          <p className="text-lg font-bold text-white">{proposal.outcome?.margin || '-'}%</p>
          <p className="text-xs text-gray-500">
            {stats.hasPassed ? 'Passed' : 'Failed'}
          </p>
        </div>
      </div>

      {/* Your Vote */}
      {proposal.yourVote && (
        <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3 mb-6 flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-400 flex-shrink-0" />
          <p className="text-sm text-blue-300">
            You voted <strong>{proposal.yourVote}</strong>
          </p>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-2 text-sm text-gray-400 mb-6 pb-6 border-b border-slate-700">
        <p>📅 Created: {proposal.createdAt.toLocaleDateString()}</p>
        {proposal.status === 'voting' && (
          <p>⏱️ Voting ends: {proposal.votingEndsAt.toLocaleDateString()}</p>
        )}
        {proposal.outcome?.passedAt && (
          <p>✅ Passed: {proposal.outcome.passedAt.toLocaleDateString()}</p>
        )}
        {proposal.outcome?.executedAt && (
          <p>🚀 Executed: {proposal.outcome.executedAt.toLocaleDateString()}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {onViewProposal && (
          <Button onClick={onViewProposal} variant="outline" size="sm" className="text-gray-300 border-slate-600">
            <ExternalLink className="h-4 w-4 mr-2" />
            View Full Proposal
          </Button>
        )}

        {proposal.status === 'passed' && onExecute && (
          <Button onClick={onExecute} size="sm" className="bg-green-600 hover:bg-green-700">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Execute Proposal
          </Button>
        )}

        {onViewDetails && (
          <Button onClick={onViewDetails} variant="outline" size="sm" className="text-gray-300 border-slate-600">
            Details
          </Button>
        )}
      </div>
    </div>
  );
}

export default ProposalResultsCard;
