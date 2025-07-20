// pages/proposals/index.tsx – Proposals Page

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Plus, Filter } from "lucide-react";
import ProposalCard from "../components/proposal-card";
import { useState } from "react";
import VotingModal from "../components/voting-modal";
import { ProposalLeaderboard } from "../components/proposal_leaderboard";

export default function Proposals() {
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const [showVotingModal, setShowVotingModal] = useState(false);
  const [filter, setFilter] = useState("all");

  // Fetch proposals (live data)
  const { data: proposals, isLoading: proposalsLoading, error: proposalsError } = useQuery({
    queryKey: ["/api/proposals"],
    queryFn: async () => {
      const res = await fetch("/api/proposals");
      if (!res.ok) throw new Error("Failed to fetch proposals");
      return res.json();
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

  if (proposalsLoading) {
    return <div className="p-8 text-center text-lg">Loading proposals...</div>;
  }
  if (proposalsError) {
    return <div className="p-8 text-center text-red-500">Failed to load proposals: {proposalsError.message}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Proposals</h1>
          <p className="text-gray-600">Review and vote on community proposals</p>
        </div>
        <Button className="bg-gradient-mtaa text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" />
          Create Proposal
        </Button>
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

      {/* Proposals Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredProposals?.map((proposal: any) => (
          <Card key={proposal.id} className="hover-lift cursor-pointer">
            <CardContent className="p-0">
              <ProposalCard
                proposal={proposal}
                onVote={() => handleVoteClick(proposal)}
                showFullDescription={true}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredProposals?.length === 0 && (
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
      )}

      {/* Leaderboard */}
      <ProposalLeaderboard />

      {/* Voting Modal */}
      <VotingModal 
        isOpen={showVotingModal} 
        onClose={() => setShowVotingModal(false)}
        proposal={selectedProposal}
      />
    </div>
  );
}
