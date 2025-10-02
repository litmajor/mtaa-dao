
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";

interface PollOption {
  id: string;
  label: string;
  votes: number;
}

interface PollProposalCardProps {
  proposal: {
    id: string;
    title: string;
    description: string;
    pollOptions: PollOption[];
    allowMultipleChoices: boolean;
    status: string;
    voteEndTime: string;
  };
}

export default function PollProposalCard({ proposal }: PollProposalCardProps) {
  const queryClient = useQueryClient();
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  
  const totalVotes = proposal.pollOptions?.reduce((sum, opt) => sum + (opt.votes || 0), 0) || 0;

  const voteMutation = useMutation({
    mutationFn: async (optionIds: string[]) => {
      const res = await fetch(`/api/proposals/${proposal.id}/poll-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ optionIds }),
      });
      if (!res.ok) throw new Error('Failed to vote');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/proposals/${proposal.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      toast({
        title: "Vote recorded",
        description: "Your vote has been successfully recorded",
      });
      setSelectedOptions([]);
    },
    onError: () => {
      toast({
        title: "Vote failed",
        description: "Could not record your vote",
        variant: "destructive",
      });
    },
  });

  const handleOptionToggle = (optionId: string) => {
    if (proposal.allowMultipleChoices) {
      setSelectedOptions(prev => 
        prev.includes(optionId) 
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      setSelectedOptions([optionId]);
    }
  };

  const handleVote = () => {
    if (selectedOptions.length === 0) {
      toast({
        title: "No option selected",
        description: "Please select at least one option",
        variant: "destructive",
      });
      return;
    }
    voteMutation.mutate(selectedOptions);
  };

  const isVotingClosed = new Date() > new Date(proposal.voteEndTime) || proposal.status !== 'active';

  return (
    <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                Poll
              </Badge>
              {proposal.allowMultipleChoices && (
                <Badge variant="secondary" className="text-xs">
                  Multiple Choice
                </Badge>
              )}
            </div>
            <CardTitle className="text-xl font-bold mb-2">{proposal.title}</CardTitle>
            <p className="text-sm text-gray-600">{proposal.description}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Poll Options */}
        <div className="space-y-3">
          {proposal.pollOptions?.map((option: PollOption) => {
            const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
            const isSelected = selectedOptions.includes(option.id);

            return (
              <div
                key={option.id}
                className={`border rounded-lg p-3 cursor-pointer transition-all ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                } ${isVotingClosed ? 'cursor-not-allowed opacity-75' : ''}`}
                onClick={() => !isVotingClosed && handleOptionToggle(option.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1">
                    {isSelected ? (
                      <CheckCircle2 className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400" />
                    )}
                    <span className="font-medium">{option.label}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {option.votes || 0} votes ({percentage.toFixed(1)}%)
                  </div>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            );
          })}
        </div>

        {/* Vote Button */}
        {!isVotingClosed && (
          <Button
            onClick={handleVote}
            disabled={selectedOptions.length === 0 || voteMutation.isPending}
            className="w-full bg-gradient-mtaa text-white"
          >
            {voteMutation.isPending ? 'Voting...' : 'Cast Vote'}
          </Button>
        )}

        {isVotingClosed && (
          <div className="text-center text-sm text-gray-500">
            Voting has closed
          </div>
        )}

        {/* Total Votes */}
        <div className="text-center text-sm text-gray-600 pt-2 border-t">
          Total votes: {totalVotes}
        </div>
      </CardContent>
    </Card>
  );
}
