import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProposalLikeButtonProps {
  proposalId: string;
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "ghost" | "outline";
}

export default function ProposalLikeButton({ 
  proposalId, 
  className, 
  size = "sm", 
  variant = "ghost" 
}: ProposalLikeButtonProps) {
  const [isOptimistic, setIsOptimistic] = useState(false);
  const queryClient = useQueryClient();

  // Fetch likes data
  const { data: likesData } = useQuery({
    queryKey: [`/api/proposals/${proposalId}/likes`],
    queryFn: async () => {
      const res = await fetch(`/api/proposals/${proposalId}/likes`);
      if (!res.ok) throw new Error("Failed to fetch likes");
      return res.json();
    },
  });

  // Toggle like mutation
  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/proposals/${proposalId}/like`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to toggle like");
      return res.json();
    },
    onMutate: async () => {
      // Optimistic update
      setIsOptimistic(true);
      await queryClient.cancelQueries({ queryKey: [`/api/proposals/${proposalId}/likes`] });
      
      const previousLikes = queryClient.getQueryData([`/api/proposals/${proposalId}/likes`]);
      
      // Optimistically update the cache
      queryClient.setQueryData([`/api/proposals/${proposalId}/likes`], (old: any) => ({
        ...old,
        count: (old?.count || 0) + (old?.userLiked ? -1 : 1),
        userLiked: !old?.userLiked,
      }));
      
      return { previousLikes };
    },
    onError: (err, variables, context) => {
      // Revert optimistic update on error
      queryClient.setQueryData([`/api/proposals/${proposalId}/likes`], context?.previousLikes);
    },
    onSettled: () => {
      setIsOptimistic(false);
      // Refetch to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: [`/api/proposals/${proposalId}/likes`] });
    },
  });

  const handleLike = () => {
    likeMutation.mutate();
  };

  const likesCount = likesData?.count || 0;
  const userLiked = likesData?.userLiked || false;
  const isLoading = likeMutation.isPending || isOptimistic;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleLike}
      disabled={isLoading}
      className={cn(
        "transition-all duration-200",
        userLiked 
          ? "text-red-500 hover:text-red-600" 
          : "text-gray-500 hover:text-red-500",
        isLoading && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <Heart 
        className={cn(
          "mr-1 transition-all duration-200",
          size === "sm" ? "w-4 h-4" : size === "lg" ? "w-6 h-6" : "w-5 h-5",
          userLiked && "fill-current",
          isLoading && "animate-pulse"
        )} 
      />
      <span className="font-medium">
        {likesCount}
      </span>
    </Button>
  );
}