import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Send, MessageSquare, Edit, Trash2, Users, Paperclip, Search, Smile, Reply, Pin, Hash, Volume2, VolumeX, Copy, MoreHorizontal, Download, FileImage, File, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  content: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  createdAt: string;
  updatedAt?: string;
  messageType?: 'text' | 'image' | 'file' | 'system';
  attachment?: {
    fileName: string;
    fileSize: number;
    fileType: string;
    url: string;
  };
  replyTo?: {
    id: string;
    content: string;
    userName: string;
  };
  reactions?: Array<{
    emoji: string;
    count: number;
    users: string[];
  }>;
  isPinned?: boolean;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🚀'];

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

  // Typing indicator
  useEffect(() => {
    let typingTimeout: NodeJS.Timeout;
    if (newMessage && !isTyping) {
      setIsTyping(true);
      // Simulate sending typing indicator to server
      fetch(`/api/dao/${daoId}/typing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTyping: true })
      }).catch(() => {});
    }
    
    if (isTyping) {
      typingTimeout = setTimeout(() => {
        setIsTyping(false);
        fetch(`/api/dao/${daoId}/typing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isTyping: false })
        }).catch(() => {});
      }, 2000);
    }
    
    return () => clearTimeout(typingTimeout);
  }, [newMessage, daoId, isTyping]);

  // Simulate fetching online users and typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`/api/dao/${daoId}/presence`)
        .then(res => res.json())
        .then(data => {
          setOnlineUsers(data.onlineUsers || []);
          setTypingUsers(data.typingUsers || []);
        })
        .catch(() => {});
    }, 5000);
    
    return () => clearInterval(interval);
  }, [daoId]);

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

  // Add reaction mutation
  const addReactionMutation = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const res = await fetch(`/api/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) throw new Error("Failed to add reaction");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/dao/${daoId}/messages`] });
    },
  });

  // File upload mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('daoId', daoId);
      
      const res = await fetch(`/api/dao/${daoId}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload file");
      return res.json();
    },
    onSuccess: (data) => {
      createMessageMutation.mutate(selectedFile?.name || 'File uploaded', {
        messageType: data.fileType.startsWith('image/') ? 'image' : 'file',
        attachment: data
      });
      setSelectedFile(null);
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.trim() && !selectedFile) return;
    
    if (selectedFile) {
      uploadFileMutation.mutate(selectedFile);
      return;
    }
    
    setIsSubmitting(true);
    const messageData = {
      content: newMessage,
      replyTo: replyingTo ? {
        id: replyingTo.id,
        content: replyingTo.content,
        userName: replyingTo.userName || 'Unknown'
      } : undefined
    };
    
    createMessageMutation.mutate(messageData);
    setReplyingTo(null);
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleReaction = (messageId: string, emoji: string) => {
    addReactionMutation.mutate({ messageId, emoji });
  };

  const copyMessageLink = (messageId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/dao/${daoId}/message/${messageId}`);
  };

  const filteredMessages = searchQuery 
    ? messages.filter(msg => 
        msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.userName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="flex items-center space-x-1 cursor-pointer">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span>{onlineUsers.length} online</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    <p className="font-medium mb-1">Online Users:</p>
                    {onlineUsers.length > 0 ? (
                      onlineUsers.map(user => <p key={user}>{user}</p>)
                    ) : (
                      <p>No users online</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSearch(!showSearch)}
              className="h-8 w-8 p-0"
            >
              <Search className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="h-8 w-8 p-0"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <Badge variant="secondary" className="flex items-center space-x-1">
              <Hash className="w-3 h-3" />
              <span>{filteredMessages.length}</span>
            </Badge>
          </div>
        </CardTitle>
        
        {/* Search Bar */}
        {showSearch && (
          <div className="mt-3">
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-sm"
            />
          </div>
        )}
        
        {/* Reply Banner */}
        {replyingTo && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border-l-4 border-mtaa-purple">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Replying to {replyingTo.userName}</p>
                <p className="text-sm text-gray-700 truncate">{replyingTo.content}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReplyingTo(null)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
          </div>
        )}
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
          filteredMessages.map((message: Message) => {
            const isCurrentUser = isMessageFromCurrentUser(message);
            return (
              <div
                key={message.id}
                className={`flex items-start space-x-3 group ${
                  isCurrentUser ? "flex-row-reverse space-x-reverse" : ""
                } ${message.isPinned ? "bg-yellow-50 p-2 rounded-lg border-l-4 border-yellow-400" : ""}`}
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
                      {message.isPinned && (
                        <Pin className="w-3 h-3 text-yellow-600" />
                      )}
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setReplyingTo(message)}
                        className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600"
                        title="Reply"
                      >
                        <Reply className="w-3 h-3" />
                      </Button>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-400 hover:text-yellow-600"
                            title="React"
                          >
                            <Smile className="w-3 h-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2">
                          <div className="flex space-x-1">
                            {commonEmojis.map(emoji => (
                              <Button
                                key={emoji}
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReaction(message.id, emoji)}
                                className="h-8 w-8 p-0 text-lg hover:bg-gray-100"
                              >
                                {emoji}
                              </Button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                          >
                            <MoreHorizontal className="w-3 h-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48">
                          <div className="space-y-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyMessageLink(message.id)}
                              className="w-full justify-start text-xs"
                            >
                              <Copy className="w-3 h-3 mr-2" />
                              Copy Message Link
                            </Button>
                            {isCurrentUser && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditMessage(message)}
                                  className="w-full justify-start text-xs"
                                >
                                  <Edit className="w-3 h-3 mr-2" />
                                  Edit Message
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteMessage(message.id)}
                                  className="w-full justify-start text-xs text-red-600"
                                >
                                  <Trash2 className="w-3 h-3 mr-2" />
                                  Delete Message
                                </Button>
                              </>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Reply Preview */}
                  {message.replyTo && (
                    <div className="mb-2 p-2 bg-gray-50 rounded border-l-2 border-gray-300">
                      <p className="text-xs text-gray-500 mb-1">↳ Replying to {message.replyTo.userName}</p>
                      <p className="text-xs text-gray-600 truncate">{message.replyTo.content}</p>
                    </div>
                  )}

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
                    <>
                      {/* Message Content */}
                      <div
                        className={`inline-block px-3 py-2 rounded-lg text-sm max-w-xs ${
                          isCurrentUser
                            ? "bg-gradient-mtaa text-white"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {message.messageType === 'image' && message.attachment ? (
                          <div className="space-y-2">
                            <img 
                              src={message.attachment.url} 
                              alt={message.attachment.fileName}
                              className="max-w-full h-auto rounded"
                            />
                            <p className="text-xs opacity-80">{message.attachment.fileName}</p>
                          </div>
                        ) : message.messageType === 'file' && message.attachment ? (
                          <div className="flex items-center space-x-2 p-2 bg-white/20 rounded">
                            <File className="w-4 h-4" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs truncate">{message.attachment.fileName}</p>
                              <p className="text-xs opacity-60">{(message.attachment.fileSize / 1024).toFixed(1)} KB</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(message.attachment?.url, '_blank')}
                              className="h-6 w-6 p-0"
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          message.content
                        )}
                      </div>

                      {/* Reactions */}
                      {message.reactions && message.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {message.reactions.map((reaction) => (
                            <Button
                              key={reaction.emoji}
                              variant="outline"
                              size="sm"
                              onClick={() => handleReaction(message.id, reaction.emoji)}
                              className="h-6 px-2 text-xs hover:bg-gray-100"
                            >
                              {reaction.emoji} {reaction.count}
                            </Button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
        
        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center space-x-2 text-sm text-gray-500 italic animate-pulse">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
            </div>
            <span>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</span>
          </div>
        )}}
        <div ref={messagesEndRef} />
      </CardContent>

      {/* Message Input */}
      <div className="border-t border-gray-100 p-4">
        {/* File Preview */}
        {selectedFile && (
          <div className="mb-3 p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {selectedFile.type.startsWith('image/') ? 
                  <FileImage className="w-4 h-4 text-blue-500" /> : 
                  <File className="w-4 h-4 text-gray-500" />
                }
                <span className="text-sm text-gray-700">{selectedFile.name}</span>
                <span className="text-xs text-gray-500">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFile(null)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
          </div>
        )}
        
        <div className="flex space-x-2">
          <div className="flex space-x-1">
            {/* File Upload */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-10 w-10 p-0"
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt"
            />
            
            {/* Emoji Picker */}
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0"
                  title="Add emoji"
                >
                  <Smile className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2">
                <div className="grid grid-cols-8 gap-1">
                  {commonEmojis.map(emoji => (
                    <Button
                      key={emoji}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEmojiSelect(emoji)}
                      className="h-8 w-8 p-0 text-lg hover:bg-gray-100"
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          <Input
            placeholder={selectedFile ? "Add a message with your file..." : "Type a message..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isSubmitting}
            className="flex-1 focus:border-mtaa-purple focus:ring-mtaa-purple"
          />
          <Button
            onClick={handleSendMessage}
            disabled={(!newMessage.trim() && !selectedFile) || isSubmitting}
            className="bg-gradient-mtaa text-white hover:opacity-90 px-4"
          >
            {selectedFile ? <Paperclip className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}