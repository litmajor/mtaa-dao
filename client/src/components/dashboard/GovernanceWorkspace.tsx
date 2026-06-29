import React, { useState, useEffect } from 'react';
import ProposalCard from '../proposal-card';
import { VoteProposalModal, ProposalDetails } from '../governance/VoteProposalModal';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function GovernanceWorkspace({ daoId }: { daoId: string }) {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<ProposalDetails | null>(null);
  const [showVoteModal, setShowVoteModal] = useState(false);

  useEffect(() => {
    async function fetchProposals() {
      try {
        setLoading(true);
        const res = await fetch(`/api/v1/daos/${daoId}/proposals`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch proposals');
        const json = await res.json();
        setProposals(json.data || json.proposals || json || []);
      } catch (e) {
        console.error('Failed to fetch proposals', e);
        setProposals([]);
      } finally {
        setLoading(false);
      }
    }
    fetchProposals();
  }, [daoId]);

  const handleVote = (proposal: any) => {
    // Map the raw proposal from the API to the VoteProposalModal shape
    const mapped: ProposalDetails = {
      id: proposal.id,
      title: proposal.title || 'Untitled Proposal',
      description: proposal.description || '',
      type: proposal.type || 'general',
      status: proposal.status || 'voting',
      daoId: proposal.daoId || daoId,
      daoName: proposal.daoName || '',
      createdBy: proposal.proposerId || proposal.createdBy || '',
      createdByName: proposal.proposerName || proposal.createdByName || 'Member',
      createdAt: new Date(proposal.createdAt || Date.now()),
      votingEndsAt: new Date(proposal.voteEndTime || proposal.votingEndsAt || Date.now() + 86400000),
      currentVotes: {
        for: proposal.yesVotes || 0,
        against: proposal.noVotes || 0,
        abstain: proposal.abstainVotes || 0,
      },
      votesRequired: proposal.quorumRequired || 10,
      userVotingPower: proposal.userVotingPower || 1,
      yourVote: proposal.yourVote || null,
      votingDetails: {
        totalVoters: (proposal.yesVotes || 0) + (proposal.noVotes || 0) + (proposal.abstainVotes || 0),
        participationRate: proposal.participationRate || 0,
        quorumRequired: proposal.quorumRequired || 0,
        commentsCount: proposal.commentsCount || 0,
        amountRequested: proposal.amountRequested,
        treasuryImpact: proposal.treasuryImpact,
      },
    };
    setSelectedProposal(mapped);
    setShowVoteModal(true);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">🏛️ Governance</h2>
          <p className="text-slate-400 text-sm">
            Review, discuss, and vote on active proposals for your DAO.
          </p>
        </div>
        <a href="/governance/create">
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Proposal
          </Button>
        </a>
      </div>

      {/* Stats Bar */}
      {proposals.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Total', value: proposals.length, color: 'text-white' },
            { label: 'Active', value: proposals.filter(p => p.status === 'voting' || p.status === 'active').length, color: 'text-green-400' },
            { label: 'Pending', value: proposals.filter(p => p.status === 'pending' || p.status === 'draft').length, color: 'text-yellow-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-slate-800 rounded-lg px-4 py-3 text-center border border-slate-700">
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Proposals List */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 bg-slate-800 rounded-xl animate-pulse border border-slate-700" />
            ))}
          </div>
        ) : proposals.length > 0 ? (
          proposals.map(p => (
            <ProposalCard
              key={p.id}
              proposal={p}
              onVote={() => handleVote(p)}
            />
          ))
        ) : (
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-8 text-center">
            <div className="text-4xl mb-3">🗳️</div>
            <p className="text-slate-300 font-medium">No proposals yet</p>
            <p className="text-slate-500 text-sm mt-1">
              Be the first to create a proposal for this DAO.
            </p>
            <a href="/governance/create">
              <Button size="sm" className="mt-4 bg-purple-600 hover:bg-purple-700 text-white">
                Create Proposal
              </Button>
            </a>
          </div>
        )}
      </div>

      {/* Vote Modal */}
      {selectedProposal && (
        <VoteProposalModal
          proposal={selectedProposal}
          isOpen={showVoteModal}
          onClose={() => { setShowVoteModal(false); setSelectedProposal(null); }}
          onVoteSuccess={() => {
            setShowVoteModal(false);
            setSelectedProposal(null);
            // Refresh proposals after a vote
            fetch(`/api/v1/daos/${daoId}/proposals`, { credentials: 'include' })
              .then(r => r.json())
              .then(j => setProposals(j.data || j.proposals || j || []))
              .catch(console.error);
          }}
        />
      )}
    </div>
  );
}
