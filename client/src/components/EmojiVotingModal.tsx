
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface EmojiVotingModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposalId: string;
  proposalTitle: string;
}

export default function EmojiVotingModal({ 
  isOpen, 
  onClose, 
  proposalId,
  proposalTitle 
}: EmojiVotingModalProps) {
  const [selectedVote, setSelectedVote] = useState<'yes' | 'maybe' | 'no' | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const voteMutation = useMutation({
    mutationFn: async (vote: 'yes' | 'maybe' | 'no') => {
      return await apiPost(`/api/proposals/${proposalId}/emoji-vote`, {
        vote,
        isAnonymous
      });
    },
    onSuccess: () => {
      toast({
        title: "Vote submitted!",
        description: isAnonymous ? "Your anonymous vote has been recorded" : "Your vote has been recorded"
      });
      queryClient.invalidateQueries({ queryKey: [`/api/proposals/${proposalId}`] });
      onClose();
    },
    onError: () => {
      toast({
        title: "Vote failed",
        description: "Please try again",
        variant: "destructive"
      });
    }
  });

  const handleVote = () => {
    if (selectedVote) {
      voteMutation.mutate(selectedVote);
    }
  };

  const voteOptions = [
    { 
      value: 'yes' as const, 
      emoji: '🟢', 
      label: 'Yes', 
      color: 'hover:bg-green-50 border-green-500',
      activeColor: 'bg-green-100 border-green-600'
    },
    { 
      value: 'maybe' as const, 
      emoji: '🟡', 
      label: 'Maybe', 
      color: 'hover:bg-yellow-50 border-yellow-500',
      activeColor: 'bg-yellow-100 border-yellow-600'
    },
    { 
      value: 'no' as const, 
      emoji: '🔴', 
      label: 'No', 
      color: 'hover:bg-red-50 border-red-500',
      activeColor: 'bg-red-100 border-red-600'
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cast Your Vote</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-4">{proposalTitle}</p>
          </div>

          {/* Emoji Vote Options */}
          <div className="grid grid-cols-3 gap-4">
            {voteOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedVote(option.value)}
                className={`flex flex-col items-center gap-3 p-6 border-2 rounded-xl transition-all ${
                  selectedVote === option.value ? option.activeColor : option.color
                }`}
              >
                <span className="text-5xl">{option.emoji}</span>
                <span className="text-sm font-medium">{option.label}</span>
              </button>
            ))}
          </div>

          {/* Anonymous Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <Label htmlFor="anonymous" className="text-sm font-medium">
              Vote Anonymously
            </Label>
            <Switch
              id="anonymous"
              checked={isAnonymous}
              onCheckedChange={setIsAnonymous}
            />
          </div>

          {isAnonymous && (
            <p className="text-xs text-gray-500 italic">
              Your identity will be hidden. Only the vote count will be visible.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleVote} 
            disabled={!selectedVote || voteMutation.isPending}
            className="bg-gradient-mtaa text-white"
          >
            {voteMutation.isPending ? 'Submitting...' : 'Submit Vote'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
