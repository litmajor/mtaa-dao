import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { apiGet } from "@/lib/api";
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  ThumbsUp, 
  ThumbsDown, 
  Minus, 
  Clock, 
  TrendingUp, 
  Sparkles, 
  Eye,
  Share2,
  ExternalLink 
} from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import ProposalComments from "../components/proposal-comments";
import ProposalLikeButton from "../components/proposal-like-button";
import VotingModal from "../components/voting-modal";

export default function ProposalDetail() {
  const { id: proposalId } = useParams();
  const navigate = useNavigate();
  const [showVotingModal, setShowVotingModal] = useState(false);
  
  // Fetch proposal details
  const { data: proposal, isLoading, error } = useQuery({
    queryKey: [`/api/proposals/${proposalId}`],
    queryFn: async () => {
      return await apiGet(`/api/proposals/${proposalId}`);
    },
    enabled: !!proposalId,
  });

  // Fetch current user for context
  const { data: user } = useQuery({
    queryKey: ["/api/user/me"],
    queryFn: async () => {
      return await apiGet("/api/user/me");
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-300 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <div className="text-red-500 mb-4">
          <h1 className="text-2xl font-bold mb-2">Proposal Not Found</h1>
          <p>The proposal you're looking for doesn't exist or has been removed.</p>
        </div>
        <Button onClick={() => navigate("/proposals")} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Proposals
        </Button>
      </div>
    );
  }

  // Safe access to proposal properties with fallbacks
  const yesVotes = proposal?.yesVotes || 0;
  const noVotes = proposal?.noVotes || 0;
  const abstainVotes = proposal?.abstainVotes || 0;
  const quorumRequired = proposal?.quorumRequired || 0;
  const voteEndTime = proposal?.voteEndTime || new Date().toISOString();
  const status = proposal?.status || 'draft';
  const title = proposal?.title || 'Untitled Proposal';
  const description = proposal?.description || 'No description available';
  const proposerId = proposal?.proposerId || 'Unknown';
  const createdAt = proposal?.createdAt || new Date().toISOString();
  
  const totalVotes = yesVotes + noVotes + abstainVotes;
  const quorumProgress = quorumRequired > 0 ? (totalVotes / quorumRequired) * 100 : 0;
  
  const daysLeft = Math.ceil((new Date(voteEndTime).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  
  const yesPercentage = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0;
  const noPercentage = totalVotes > 0 ? (noVotes / totalVotes) * 100 : 0;
  const abstainPercentage = totalVotes > 0 ? (abstainVotes / totalVotes) * 100 : 0;

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-3 py-1 rounded-full text-sm font-semibold";
    switch (status) {
      case "active":
        return <Badge className={`${baseClasses} bg-gradient-to-r from-mtaa-emerald to-green-500 text-white`}>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
            <span>Active</span>
          </div>
        </Badge>;
      case "resolved":
        return <Badge className={`${baseClasses} bg-gradient-to-r from-mtaa-purple to-purple-600 text-white`}>
          <Sparkles className="w-3 h-3 mr-1" />
          Resolved
        </Badge>;
      case "expired":
        return <Badge className={`${baseClasses} bg-gradient-to-r from-gray-500 to-gray-600 text-white`}>
          <Clock className="w-3 h-3 mr-1" />
          Expired
        </Badge>;
      default:
        return <Badge className={`${baseClasses} bg-gradient-to-r from-mtaa-gold to-yellow-500 text-white`}>
          <Eye className="w-3 h-3 mr-1" />
          Draft
        </Badge>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button 
          onClick={() => navigate("/proposals")} 
          variant="ghost" 
          className="text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Proposals
        </Button>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm" className="flex items-center space-x-1">
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </Button>
          <Button variant="outline" size="sm" className="flex items-center space-x-1">
            <ExternalLink className="w-4 h-4" />
            <span>View on Chain</span>
          </Button>
        </div>
      </div>

      {/* Main Proposal Card */}
      <Card className="border border-gray-200 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-3">
                {getStatusBadge(status)}
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span>Created {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}</span>
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900 mb-3 leading-tight">
                {title}
              </CardTitle>
            </div>
          </div>
          
          {/* Proposal Meta Info */}
          <div className="flex items-center space-x-6 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>Proposed by {proposerId.slice(0, 8)}...</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span className={`font-medium ${
                daysLeft <= 1 && status === "active" 
                  ? "text-red-500 font-bold" 
                  : daysLeft <= 3 && status === "active" 
                    ? "text-orange-500" 
                    : "text-gray-700"
              }`}>
                {daysLeft > 0 ? `${daysLeft} days left` : "Voting ended"}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4" />
              <span>Quorum: {totalVotes}/{quorumRequired}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Proposal Description */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Description</h3>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {description}
              </p>
            </div>
          </div>

          {/* Voting Results */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">{yesVotes}</div>
              <div className="text-sm text-gray-600 mb-2">Yes Votes</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: `${yesPercentage}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">{Math.round(yesPercentage)}%</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 mb-1">{noVotes}</div>
              <div className="text-sm text-gray-600 mb-2">No Votes</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full" 
                  style={{ width: `${noPercentage}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">{Math.round(noPercentage)}%</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600 mb-1">{abstainVotes}</div>
              <div className="text-sm text-gray-600 mb-2">Abstain</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gray-500 h-2 rounded-full" 
                  style={{ width: `${abstainPercentage}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">{Math.round(abstainPercentage)}%</div>
            </div>
          </div>

          {/* Quorum Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Quorum Progress</span>
              <span className="text-sm font-bold text-gray-900">{Math.round(quorumProgress)}%</span>
            </div>
            <Progress 
              value={quorumProgress} 
              className="h-3 bg-gray-200 rounded-full"
            />
            <div className="text-xs text-gray-500 text-center">
              {quorumProgress >= 100 ? "🎉 Quorum reached!" : "More votes needed to reach quorum"}
            </div>
          </div>

          {/* Engagement Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center space-x-6">
              <ProposalLikeButton 
                proposalId={proposal.id} 
                size="default" 
                variant="ghost"
              />
            </div>
            
            {status === "active" && (
              <div className="flex space-x-3">
                <Button 
                  onClick={() => setShowVotingModal(true)}
                  className="bg-gradient-to-r from-mtaa-emerald to-green-500 text-white hover:opacity-90 px-6"
                >
                  <ThumbsUp className="w-4 h-4 mr-2" />
                  Cast Vote
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comments Section */}
      <ProposalComments 
        proposalId={proposal.id} 
        daoId={proposal.daoId} 
        currentUserId={user?.id}
      />

      {/* Voting Modal */}
      {showVotingModal && (
        <VotingModal
          proposal={proposal}
          isOpen={showVotingModal}
          onClose={() => setShowVotingModal(false)}
        />
      )}
    </div>
  );
}