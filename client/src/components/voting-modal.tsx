import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Minus } from "lucide-react";

interface VotingModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: any;
}

export default function VotingModal({ isOpen, onClose, proposal }: VotingModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const voteMutation = useMutation({
    mutationFn: async (voteType: string) => {
      await apiRequest("POST", "/api/votes", {
        proposalId: proposal.id,
        voteType,
      });
    },
    onSuccess: () => {
  toast("Vote cast successfully! Your vote has been recorded on the blockchain");
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      onClose();
    },
    onError: (error: any) => {
  toast("Error casting vote: " + error.message);
    },
  });

  const handleVote = (voteType: string) => {
    voteMutation.mutate(voteType);
  };

  if (!proposal) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">Cast Your Vote</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">{proposal.title}</h3>
            <p className="text-gray-600 text-sm">
              Your vote weight: <span className="font-medium text-mtaa-orange">1.2x</span> (based on contribution history)
            </p>
          </div>
          
          <div className="space-y-3">
            <Button
              className="w-full bg-mtaa-emerald text-white py-3 rounded-xl font-medium hover:opacity-90 transition-opacity"
              onClick={() => handleVote("yes")}
              disabled={voteMutation.isPending}
            >
              <Check className="mr-2 h-5 w-5" />
              Vote Yes
            </Button>
            
            <Button
              className="w-full bg-mtaa-terra text-white py-3 rounded-xl font-medium hover:opacity-90 transition-opacity"
              onClick={() => handleVote("no")}
              disabled={voteMutation.isPending}
            >
              <X className="mr-2 h-5 w-5" />
              Vote No
            </Button>
            
            <Button
              variant="outline"
              className="w-full border-gray-300 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              onClick={() => handleVote("abstain")}
              disabled={voteMutation.isPending}
            >
              <Minus className="mr-2 h-5 w-5" />
              Abstain
            </Button>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-500">This action will be recorded on the blockchain</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
