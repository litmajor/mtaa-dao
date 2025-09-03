import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, Edit, Trash2, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  content: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  createdAt: string;
  updatedAt?: string;
}

interface DaoChatProps {
  daoId: string;
  daoName?: string;
  currentUserId?: string;
}

export default function DaoChat({ daoId, daoName = "DAO", currentUserId }: DaoChatProps) {
  const [newMessage, setNewMessage] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch messages
  const { data: messagesData, isLoading, error } = useQuery({
    queryKey: [`/api/dao/${daoId}/messages`],
    queryFn: async () => {
      const res = await fetch(`/api/dao/${daoId}/messages?limit=100`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds for real-time feel
  });

  const messages = messagesData?.messages?.reverse() || []; // Reverse to show latest at bottom

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Create message mutation
  const createMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/dao/${daoId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/dao/${daoId}/messages`] });
      setNewMessage("");
      setIsSubmitting(false);
    },
    onError: () => {
      setIsSubmitting(false);
    },
  });

  // Update message mutation
  const updateMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to update message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/dao/${daoId}/messages`] });
      setEditingMessageId(null);
      setEditContent("");
    },
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete message");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/dao/${daoId}/messages`] });
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    setIsSubmitting(true);
    createMessageMutation.mutate(newMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEditMessage = (message: Message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  const handleUpdateMessage = (messageId: string) => {
    if (!editContent.trim()) return;
    updateMessageMutation.mutate({ messageId, content: editContent });
  };

  const handleDeleteMessage = (messageId: string) => {
    if (confirm("Are you sure you want to delete this message?")) {
      deleteMessageMutation.mutate(messageId);
    }
  };

  const isMessageFromCurrentUser = (message: Message) => {
    return currentUserId && message.userId === currentUserId;
  };

  if (!currentUserId) {
    return (
      <Card className="border border-gray-200 shadow-sm">
        <CardContent className="p-8 text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Join the Conversation</h3>
          <p className="text-gray-500">Please log in to participate in the DAO chat.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200 shadow-sm h-[600px] flex flex-col">
      <CardHeader className="pb-3 border-b border-gray-100">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-mtaa-purple" />
            <span className="text-lg">{daoName} Chat</span>
          </div>
          <Badge variant="secondary" className="flex items-center space-x-1">
            <Users className="w-3 h-3" />
            <span>{messages.length > 0 ? "Active" : "Quiet"}</span>
          </Badge>
        </CardTitle>
      </CardHeader>

      {/* Messages Container */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-start space-x-3">
                <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-300 rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message: Message) => {
            const isCurrentUser = isMessageFromCurrentUser(message);
            return (
              <div
                key={message.id}
                className={`flex items-start space-x-3 group ${
                  isCurrentUser ? "flex-row-reverse space-x-reverse" : ""
                }`}
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={message.userAvatar} />
                  <AvatarFallback className="bg-gradient-mtaa text-white text-sm">
                    {message.userName?.charAt(0) || message.userId?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>

                <div className={`flex-1 min-w-0 ${isCurrentUser ? "text-right" : ""}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className={`flex items-center space-x-2 ${isCurrentUser ? "flex-row-reverse space-x-reverse" : ""}`}>
                      <span className="font-medium text-gray-900 text-sm">
                        {isCurrentUser ? "You" : (message.userName || `User ${message.userId.slice(0, 8)}`)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                      </span>
                      {message.updatedAt && message.updatedAt !== message.createdAt && (
                        <Badge variant="secondary" className="text-xs">
                          Edited
                        </Badge>
                      )}
                    </div>

                    {isCurrentUser && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditMessage(message)}
                          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMessage(message.id)}
                          className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {editingMessageId === message.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="text-sm"
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            handleUpdateMessage(message.id);
                          }
                        }}
                      />
                      <div className={`flex space-x-2 ${isCurrentUser ? "justify-start" : "justify-end"}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingMessageId(null);
                            setEditContent("");
                          }}
                          className="h-7 px-3 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleUpdateMessage(message.id)}
                          disabled={!editContent.trim()}
                          className="bg-mtaa-purple text-white h-7 px-3 text-xs"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`inline-block px-3 py-2 rounded-lg text-sm max-w-xs ${
                        isCurrentUser
                          ? "bg-gradient-mtaa text-white"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {message.content}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      {/* Message Input */}
      <div className="border-t border-gray-100 p-4">
        <div className="flex space-x-2">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isSubmitting}
            className="flex-1 focus:border-mtaa-purple focus:ring-mtaa-purple"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || isSubmitting}
            className="bg-gradient-mtaa text-white hover:opacity-90 px-4"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}