import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, User, ThumbsUp, ThumbsDown, Minus, Clock, TrendingUp, Sparkles, Eye, MessageCircle } from "lucide-react";
import { useState } from "react";
import ProposalLikeButton from "./proposal-like-button";

interface ProposalCardProps {
  proposal: any;
  onVote: () => void;
  showFullDescription?: boolean;
}

export default function ProposalCard({ proposal, onVote, showFullDescription = false }: ProposalCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
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
    const baseClasses = "px-3 py-1 rounded-full text-xs font-semibold shadow-lg transition-all duration-300";
    switch (status) {
      case "active":
        return <Badge className={`${baseClasses} bg-gradient-to-r from-mtaa-emerald to-green-500 text-white shadow-emerald-500/30 animate-pulse`}>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
            <span>Active</span>
          </div>
        </Badge>;
      case "resolved":
        return <Badge className={`${baseClasses} bg-gradient-to-r from-mtaa-purple to-purple-600 text-white shadow-purple-500/30`}>
          <Sparkles className="w-3 h-3 mr-1" />
          Resolved
        </Badge>;
      case "expired":
        return <Badge className={`${baseClasses} bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-gray-500/30`}>
          <Clock className="w-3 h-3 mr-1" />
          Expired
        </Badge>;
      default:
        return <Badge className={`${baseClasses} bg-gradient-to-r from-mtaa-gold to-yellow-500 text-white shadow-yellow-500/30`}>
          <Eye className="w-3 h-3 mr-1" />
          Draft
        </Badge>;
    }
  };

  const getUrgencyIndicator = () => {
    if (daysLeft <= 1 && status === "active") {
      return (
        <div className="absolute top-2 right-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs px-2 py-1 rounded-full shadow-lg animate-bounce">
          🔥 Urgent
        </div>
      );
    }
    return null;
  };

  return (
    <div 
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animated background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-mtaa-orange/20 via-purple-500/20 to-mtaa-emerald/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      
      {/* Main card */}
      <div 
        className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-6 cursor-pointer transition-all duration-500 transform ${
          isHovered ? 'scale-[1.02] shadow-2xl shadow-black/10' : 'hover:shadow-lg'
        }`}
        onClick={onVote}
      >
        {/* Urgency indicator */}
        {getUrgencyIndicator()}
        
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Avatar className="w-12 h-12 ring-2 ring-mtaa-orange/20 group-hover:ring-mtaa-orange/40 transition-all duration-300">
                <AvatarFallback className="bg-gradient-to-br from-mtaa-emerald via-blue-500 to-purple-500 text-white font-bold">
                  {proposerId?.substring(0, 2) || "UN"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gradient-to-r from-mtaa-gold to-yellow-500 rounded-full flex items-center justify-center">
                <span className="text-xs">⭐</span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1 line-clamp-2 group-hover:text-mtaa-orange transition-colors duration-300">
                {title}
              </h3>
              <div className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center space-x-1">
                  <User className="w-3 h-3" />
                  <span className="font-medium">{proposerId}</span>
                </div>
                <span className="text-gray-300">•</span>
                <div className="flex items-center space-x-1">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end space-y-2">
            {getStatusBadge(status)}
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <MessageCircle className="w-3 h-3" />
              <span>{Math.floor(Math.random() * 20) + 5} comments</span>
            </div>
          </div>
        </div>
        
        {/* Description */}
        <div className="mb-6">
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            {showFullDescription ? description : 
             `${description.substring(0, 150)}${description.length > 150 ? '...' : ''}`}
          </p>
          {!showFullDescription && description.length > 150 && (
            <button className="text-mtaa-orange hover:text-mtaa-orange/80 text-sm font-medium mt-2 transition-colors duration-200">
              Read more
            </button>
          )}
        </div>
        
        {/* Voting Results */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Voting Results</span>
            <span className="text-sm text-gray-500">{totalVotes} total votes</span>
          </div>
          
          <div className="space-y-3">
            {/* Yes Votes */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 min-w-[80px]">
                <div className="w-8 h-8 bg-gradient-to-r from-mtaa-emerald to-green-500 rounded-full flex items-center justify-center shadow-lg">
                  <ThumbsUp className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{yesVotes}</span>
              </div>
              <div className="flex-1">
                <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-mtaa-emerald to-green-500 transition-all duration-700 ease-out"
                    style={{ width: `${yesPercentage}%` }}
                  ></div>
                </div>
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[40px]">
                {Math.round(yesPercentage)}%
              </span>
            </div>
            
            {/* No Votes */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 min-w-[80px]">
                <div className="w-8 h-8 bg-gradient-to-r from-mtaa-terra to-red-500 rounded-full flex items-center justify-center shadow-lg">
                  <ThumbsDown className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{noVotes}</span>
              </div>
              <div className="flex-1">
                <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-mtaa-terra to-red-500 transition-all duration-700 ease-out"
                    style={{ width: `${noPercentage}%` }}
                  ></div>
                </div>
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[40px]">
                {Math.round(noPercentage)}%
              </span>
            </div>
            
            {/* Abstain Votes */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 min-w-[80px]">
                <div className="w-8 h-8 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center shadow-lg">
                  <Minus className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{abstainVotes}</span>
              </div>
              <div className="flex-1">
                <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-gray-400 to-gray-500 transition-all duration-700 ease-out"
                    style={{ width: `${abstainPercentage}%` }}
                  ></div>
                </div>
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[40px]">
                {Math.round(abstainPercentage)}%
              </span>
            </div>
          </div>
        </div>
        
        {/* Timeline and Quorum */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className={`text-sm font-medium ${
              daysLeft <= 1 && proposal.status === "active" 
                ? "text-red-500 font-bold animate-pulse" 
                : daysLeft <= 3 && proposal.status === "active" 
                  ? "text-orange-500 font-semibold" 
                  : "text-gray-700 dark:text-gray-300"
            }`}>
              {daysLeft > 0 ? `${daysLeft} days left` : "Voting ended"}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-500">
              Quorum: {totalVotes}/{quorumRequired}
            </span>
          </div>
        </div>
        
        {/* Quorum Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Quorum Progress</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{Math.round(quorumProgress)}%</span>
          </div>
          <div className="relative">
            <Progress 
              value={quorumProgress} 
              className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
            />
            {quorumProgress >= 100 && (
              <div className="absolute inset-0 bg-gradient-to-r from-mtaa-emerald/20 to-green-500/20 rounded-full animate-pulse"></div>
            )}
          </div>
          <div className="text-xs text-gray-500 text-center">
            {quorumProgress >= 100 ? "🎉 Quorum reached!" : "More votes needed to reach quorum"}
          </div>
        </div>
        
        {/* Engagement Actions */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <ProposalLikeButton 
              proposalId={proposal?.id} 
              size="sm" 
              variant="ghost"
            />
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-gray-500 hover:text-mtaa-purple"
            >
              <MessageCircle className="w-4 h-4 mr-1" />
              <span className="text-sm">Comments</span>
            </Button>
          </div>
        </div>
        
        {/* Hover Action Buttons */}
        <div className={`mt-4 flex space-x-2 transition-all duration-300 ${
          isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}>
          <Button 
            size="sm" 
            className="flex-1 bg-gradient-to-r from-mtaa-emerald to-green-500 hover:from-mtaa-emerald/90 hover:to-green-500/90 text-white shadow-lg"
          >
            <ThumbsUp className="w-4 h-4 mr-2" />
            Vote Yes
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1 border-mtaa-terra text-mtaa-terra hover:bg-mtaa-terra hover:text-white transition-colors duration-300"
          >
            <ThumbsDown className="w-4 h-4 mr-2" />
            Vote No
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="px-4 border-gray-300 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Minus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}