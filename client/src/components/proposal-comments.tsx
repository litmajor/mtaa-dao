import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MessageCircle, Send, Edit, Trash2, Heart, AlertCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  content: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
  likesCount?: number;
  userLiked?: boolean;
}

interface ProposalCommentsProps {
  proposalId: string;
  daoId: string;
  currentUserId?: string;
}

export default function ProposalComments({ proposalId, daoId, currentUserId }: ProposalCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch comments
  const { data: commentsData, isLoading, error: fetchError, refetch } = useQuery({
    queryKey: [`/api/proposals/${proposalId}/comments`],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/proposals/${proposalId}/comments`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: Failed to fetch comments`);
        }
        return res.json();
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Failed to fetch comments');
      }
    },
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const comments = commentsData?.comments || [];

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/proposals/${proposalId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create comment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/proposals/${proposalId}/comments`] });
      setNewComment("");
      setIsSubmitting(false);
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to create comment");
      setIsSubmitting(false);
    },
  });

  // Update comment mutation
  const updateCommentMutation = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update comment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/proposals/${proposalId}/comments`] });
      setEditingCommentId(null);
      setEditContent("");
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to update comment");
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete comment");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/proposals/${proposalId}/comments`] });
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to delete comment");
    },
  });

  // Like comment mutation
  const likeCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await fetch(`/api/comments/${commentId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daoId }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to toggle like");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/proposals/${proposalId}/comments`] });
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to toggle like");
    },
  });

  const handleSubmitComment = () => {
    if (!newComment.trim()) return;
    setError(null);
    setIsSubmitting(true);
    createCommentMutation.mutate(newComment);
  };

  const handleEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
    setError(null);
  };

  const handleUpdateComment = (commentId: string) => {
    if (!editContent.trim()) return;
    setError(null);
    updateCommentMutation.mutate({ commentId, content: editContent });
  };

  const handleDeleteComment = (commentId: string) => {
    if (confirm("Are you sure you want to delete this comment?")) {
      setError(null);
      deleteCommentMutation.mutate(commentId);
    }
  };

  const handleLikeComment = (commentId: string) => {
    setError(null);
    likeCommentMutation.mutate(commentId);
  };

  const handleDismissError = () => {
    setError(null);
  };

  if (isLoading) {
    return (
      <Card className="border border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-300 rounded w-1/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/6 mt-1"></div>
              </div>
            </div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (fetchError) {
    return (
      <Card className="border border-red-200 shadow-sm bg-red-50">
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p>Failed to load comments</p>
              <p className="text-xs mt-1">{fetchError instanceof Error ? fetchError.message : 'Unknown error'}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-3"
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-lg">
          <MessageCircle className="w-5 h-5 text-mtaa-purple" />
          <span>Comments ({comments.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-start justify-between">
                <p>{error}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismissError}
                  className="ml-2 h-6 w-6 p-0"
                >
                  ✕
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Add Comment */}
        {currentUserId && (
          <div className="space-y-3">
            <Textarea
              placeholder="Share your thoughts on this proposal..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[100px] resize-none border-gray-300 focus:border-mtaa-purple focus:ring-mtaa-purple"
              disabled={isSubmitting}
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || isSubmitting || createCommentMutation.isPending}
                className="bg-gradient-mtaa text-white hover:opacity-90 px-6"
              >
                {isSubmitting || createCommentMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Post Comment
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Comments List */}
        <div className="space-y-4">
          {comments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium">No comments yet</p>
              <p className="text-sm">Be the first to share your thoughts!</p>
            </div>
          ) : (
            comments.map((comment: Comment) => (
              <div key={comment.id} className="border border-gray-100 rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start space-x-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={comment.userAvatar} />
                    <AvatarFallback className="bg-gradient-mtaa text-white text-sm">
                      {comment.userName?.charAt(0) || comment.userId?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          {comment.userName || `User ${comment.userId.slice(0, 8)}`}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                        </span>
                        {comment.isEdited && (
                          <Badge variant="secondary" className="text-xs">
                            Edited
                          </Badge>
                        )}
                      </div>
                      
                      {currentUserId === comment.userId && (
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditComment(comment)}
                            disabled={editingCommentId === comment.id || updateCommentMutation.isPending}
                            className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
                            title="Edit comment"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteComment(comment.id)}
                            disabled={deleteCommentMutation.isPending}
                            className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                            title="Delete comment"
                          >
                            {deleteCommentMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {editingCommentId === comment.id ? (
                      <div className="space-y-3">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="min-h-[80px] resize-none"
                          disabled={updateCommentMutation.isPending}
                        />
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditContent("");
                            }}
                            disabled={updateCommentMutation.isPending}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleUpdateComment(comment.id)}
                            disabled={!editContent.trim() || updateCommentMutation.isPending}
                            className="bg-mtaa-purple text-white"
                          >
                            {updateCommentMutation.isPending ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              'Save'
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {comment.content}
                        </p>
                        
                        {/* Like Button */}
                        <div className="flex items-center mt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLikeComment(comment.id)}
                            disabled={likeCommentMutation.isPending}
                            className={`h-8 px-3 text-xs ${
                              comment.userLiked
                                ? "text-red-500 hover:text-red-600"
                                : "text-gray-500 hover:text-red-500"
                            }`}
                            title={comment.userLiked ? "Unlike comment" : "Like comment"}
                          >
                            {likeCommentMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Heart className={`w-4 h-4 mr-1 ${comment.userLiked ? "fill-current" : ""}`} />
                            )}
                            {comment.likesCount || 0}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}