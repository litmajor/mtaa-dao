// pages/proposals/index.tsx – Proposals Page

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Plus, Filter, MessageSquare, Users } from "lucide-react";
import ProposalCard from "../components/proposal-card";
import PollProposalCard from "../components/poll-proposal-card";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import VotingModal from "../components/voting-modal";
import { ProposalLeaderboard } from "../components/proposal_leaderboard";
import DaoChat from "../components/dao-chat";
import { apiGet } from "@/lib/api";
import { t } from '@/lib/uiLabels';

export default function Proposals() {
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const [showVotingModal, setShowVotingModal] = useState(false);
  const [filter, setFilter] = useState("all");
  const [showChat, setShowChat] = useState(false);
  const navigate = useNavigate();

  // Fetch proposals (live data)
  const { data: proposals, isLoading: proposalsLoading, error: proposalsError } = useQuery({
    queryKey: ["/api/proposals"],
    queryFn: async () => {
      return await apiGet<any[]>("/api/proposals");
    },
  });

  const filteredProposals = proposals?.filter((proposal: any) => {
    if (filter === "all") return true;
    if (filter === "active") return proposal.status === "active";
    if (filter === "ended") return proposal.status === "resolved" || proposal.status === "expired";
    return true;
  });

  // --- Governance Intelligence Helpers ---------------------------------
  const timeRemainingHours = (endsAt?: string | number) => {
    if (!endsAt) return Infinity;
    const t = typeof endsAt === 'string' ? Date.parse(endsAt) : endsAt;
    return Math.max(0, Math.floor((t - Date.now()) / 1000 / 3600));
  };

  const classifyImpact = (p: any) => {
    const impact = p?.treasuryImpact || 0;
    if (impact >= 50000) return 'treasury';
    if (impact >= 10000) return 'high';
    return 'normal';
  };

  const computeSentiment = (p: any) => {
    const yes = p?.votes?.yes || p?.yes || 0;
    const no = p?.votes?.no || p?.no || 0;
    const abstain = p?.votes?.abstain || p?.abstain || 0;
    const total = Math.max(yes + no + abstain, 1);
    return {
      yesPct: Math.round((yes / total) * 100),
      noPct: Math.round((no / total) * 100),
      abstainPct: Math.round((abstain / total) * 100),
      totalVotes: total,
    };
  };

  // --- Summary and Featured logic -------------------------------------
  const activeProposals = (proposals || []).filter((p: any) => p?.status === 'active');
  const activeCount = activeProposals.length;
  const participationApprox = Math.round((activeProposals.reduce((s: number, p: any) => s + (p?.participation || p?.turnout || 0), 0) / Math.max(activeProposals.length, 1)) || 0);
  const endingSoon = activeProposals.filter((p: any) => timeRemainingHours(p?.endsAt) <= 48);
  const criticalVotes = activeProposals.filter((p: any) => (p?.critical) || (p?.treasuryImpact && p?.treasuryImpact > 20000)).length;
  const treasuryImpactTotal = activeProposals.reduce((s: number, p: any) => s + (p?.treasuryImpact || 0), 0);

  // Choose featured proposals: ending soon, high impact, controversial, high engagement
  const highImpact = activeProposals.filter((p:any) => (p?.treasuryImpact || 0) >= 10000);
  const controversial = activeProposals.filter((p:any)=>{
    const s = computeSentiment(p);
    return s.yesPct >= 30 && s.yesPct <= 70 && s.totalVotes > 10;
  });
  const highEngagement = [...activeProposals].sort((a:any,b:any)=> (b?.votes?.total || b?.votesTotal || 0) - (a?.votes?.total || a?.votesTotal || 0)).slice(0,5);

  const featuredCandidates = [...endingSoon, ...highImpact, ...controversial, ...highEngagement];
  const featuredSet = Array.from(new Map(featuredCandidates.map((p:any)=>[p?.id, p])).values()).slice(0,3);
  const featuredIds = new Set(featuredSet.map((p:any)=>p?.id));
  const feedProposals = (filteredProposals || []).filter((p:any)=>!featuredIds.has(p?.id));

  // Compact proposal row for scanning
  const CompactProposalRow = ({ proposal }: { proposal: any }) => {
    const s = computeSentiment(proposal);
    const hrs = timeRemainingHours(proposal?.endsAt);
    const statusColor = proposal?.status === 'active' ? 'bg-blue-500' : proposal?.status === 'resolved' ? 'bg-green-500' : 'bg-slate-500';
    return (
      <div className="w-full flex items-center justify-between gap-4 py-3 px-3 rounded-md bg-slate-800/40">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-block px-2 py-0.5 text-xs rounded ${statusColor} text-white`}>{proposal?.status || 'unknown'}</span>
            <h3 className="text-sm font-semibold text-white truncate cursor-pointer" onClick={() => handleProposalClick(proposal)}>{proposal?.title}</h3>
          </div>
          <div className="text-xs text-slate-400 mt-1 truncate">{proposal?.proposer || proposal?.author || 'Unknown'} • {proposal?.daoName || 'DAO'}</div>

          <div className="mt-2">
            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
              <div className="bg-emerald-400 h-2" style={{ width: `${s.yesPct}%` }} />
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
              <div>{s.yesPct}% / {s.noPct}%</div>
              <div>{s.totalVotes} votes</div>
              <div>{hrs === Infinity ? 'No deadline' : `${hrs}h left`}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="default" onClick={() => { setSelectedProposal(proposal); setShowVotingModal(true); }}>Vote</Button>
          <Button size="sm" variant="outline" onClick={() => handleProposalClick(proposal)}>View</Button>
        </div>
      </div>
    );
  };

  const handleVoteClick = (proposal: any) => {
    setSelectedProposal(proposal);
    setShowVotingModal(true);
  };

  const handleProposalClick = (proposal: any) => {
    navigate(`/proposals/${proposal.id}`);
  };


  if (proposalsLoading) {
    return <div className="p-8 text-center text-lg">Loading {t('proposals').toLowerCase()}...</div>;
  }
  if (proposalsError) {
    return <div className="p-8 text-center text-red-500">Failed to load {t('proposals').toLowerCase()}: {proposalsError.message}</div>;
  }
  if (!proposals || proposals.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">No {t('proposals').toLowerCase()} yet</h2>
          <p className="text-gray-600 mb-6">Be the first to suggest what your group should do!</p>
          <Button className="bg-gradient-mtaa text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90">
            <Plus className="mr-2 h-4 w-4" />
            Suggest an Idea
          </Button>
        </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Group Decisions</h1>
          <p className="text-gray-600">Decision Operations Center — prioritize and act.</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button 
            variant={showChat ? "default" : "outline"}
            onClick={() => setShowChat(!showChat)}
            className={showChat ? "bg-mtaa-purple text-white" : ""}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            {showChat ? "Hide Chat" : "Group Chat"}
          </Button>
          <Button className="bg-gradient-mtaa text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90">
            <Plus className="mr-2 h-4 w-4" />
            Suggest an Idea
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4 mb-4">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
          className={filter === "all" ? "bg-mtaa-orange text-white" : ""}
        >
          All
        </Button>
        <Button
          variant={filter === "active" ? "default" : "outline"}
          onClick={() => setFilter("active")}
          className={filter === "active" ? "bg-mtaa-orange text-white" : ""}
        >
          Active
        </Button>
        <Button
          variant={filter === "ended" ? "default" : "outline"}
          onClick={() => setFilter("ended")}
          className={filter === "ended" ? "bg-mtaa-orange text-white" : ""}
        >
          Ended
        </Button>
        <Button variant="outline" size="sm">
          <Filter className="mr-2 h-4 w-4" />
          More Filters
        </Button>
      </div>

      {/* Main Content Layout */}
      <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
        {/* Proposals Section (primary) */}
        <div className="space-y-6 lg:col-span-2">
          {filteredProposals?.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No proposals found</h3>
              <p className="text-gray-600 mb-4">Be the first to create a proposal for your community</p>
              <Button className="bg-gradient-mtaa text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90">
                <Plus className="mr-2 h-4 w-4" />
                Create Proposal
              </Button>
            </div>
          ) : (
            <div>
              {/* Governance Summary Layer */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="px-3 py-1 rounded bg-slate-800/50 text-white text-sm">{activeCount} Active Proposals</div>
                <div className="px-3 py-1 rounded bg-slate-800/30 text-sm">{participationApprox}% Participation</div>
                <div className="px-3 py-1 rounded bg-amber-700/10 text-sm">{criticalVotes} Critical</div>
                <div className="px-3 py-1 rounded bg-orange-600/10 text-sm">{endingSoon.length} Ending Soon</div>
                <div className="px-3 py-1 rounded bg-slate-800/20 text-sm">Treasury Impact: ${treasuryImpactTotal.toLocaleString()}</div>
              </div>

              {/* Active Decision Layer (featured) */}
              {featuredSet.length > 0 && (
                <div className="grid gap-4 mb-6 lg:grid-cols-2">
                  {featuredSet.map((p:any) => (
                    <div key={p.id} className="p-4 bg-slate-800/40 rounded-md">
                      {p.proposalType === 'poll' ? (
                        <PollProposalCard proposal={p} />
                      ) : (
                        <div onClick={() => handleProposalClick(p)} className="cursor-pointer">
                          <ProposalCard proposal={p} onVote={() => handleVoteClick(p)} showFullDescription={false} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Proposal Feed (compressed) */}
              <div className="space-y-3">
                {feedProposals.map((p:any) => (
                  <CompactProposalRow key={p.id} proposal={p} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar (lower visual weight) */}
        <div className="space-y-6 lg:col-span-1">
          <ProposalLeaderboard />
        </div>

        {/* Chat Panel (collapsible slide-in) */}
        {showChat && (
          <div className="fixed right-4 top-16 w-96 max-w-full h-[80vh] bg-slate-900/95 rounded-md shadow-lg z-50 overflow-hidden">
            <div className="flex items-center justify-between p-2 border-b border-slate-700">
              <div className="text-sm font-semibold">Discussion</div>
              <Button size="sm" variant="ghost" onClick={() => setShowChat(false)}>Close</Button>
            </div>
            <div className="p-2 h-full overflow-auto">
              <DaoChat 
                daoId="default-dao" // TODO: Get actual DAO ID from context
                daoName="Community DAO"
                currentUserId="user-123" // TODO: Get actual user ID from auth
              />
            </div>
          </div>
        )}
      </div>

      {/* Voting Modal */}
      <VotingModal 
        isOpen={showVotingModal} 
        onClose={() => setShowVotingModal(false)}
        proposal={selectedProposal}
      />
    </div>
  );
}
