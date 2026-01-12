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

  const handleVoteClick = (proposal: any) => {
    setSelectedProposal(proposal);
    setShowVotingModal(true);
  };

  const handleProposalClick = (proposal: any) => {
    navigate(`/proposals/${proposal.id}`);
  };


  if (proposalsLoading) {
    return <div className="p-8 text-center text-lg">Loading proposals...</div>;
  }
  if (proposalsError) {
    return <div className="p-8 text-center text-red-500">Failed to load proposals: {proposalsError.message}</div>;
  }
  if (!proposals || proposals.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 text-center">
        <h2 className="text-2xl font-bold mb-4">No decisions yet</h2>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🗳️ Group Decisions</h1>
          <p className="text-gray-600">Vote on what your group should do next</p>
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
      <div className={`grid gap-8 ${showChat ? 'grid-cols-1 xl:grid-cols-4' : 'grid-cols-1 lg:grid-cols-3'}`}>
        {/* Proposals Section */}
        <div className={`space-y-6 ${showChat ? 'xl:col-span-2' : 'lg:col-span-2'}`}>
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
            <div className="grid grid-cols-1 gap-6">
              {filteredProposals?.map((proposal: any) => (
                <div key={proposal.id}>
                  {proposal.proposalType === 'poll' ? (
                    <PollProposalCard proposal={proposal} />
                  ) : (
                    <div 
                      onClick={() => handleProposalClick(proposal)}
                      className="cursor-pointer transition-transform hover:scale-[1.02]"
                    >
                      <ProposalCard
                        proposal={proposal}
                        onVote={() => {
                          handleVoteClick(proposal);
                        }}
                        showFullDescription={true}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className={`space-y-6 ${showChat ? 'xl:col-span-1' : 'lg:col-span-1'}`}>
          <ProposalLeaderboard />
        </div>

        {/* Chat Sidebar */}
        {showChat && (
          <div className="xl:col-span-1">
            <div className="sticky top-6">
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
