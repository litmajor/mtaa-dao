import { useState, useEffect, useRef } from "react";
import { useMessages } from '@/hooks/useMessages';
import { usePresence } from '@/hooks/usePresence';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useChatActions } from '@/hooks/useChatActions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
// Icons replaced with lightweight emoji fallbacks to avoid lucide-react type issues
import { formatDistanceToNow } from "date-fns";
import { MorioFAB } from '@/components/morio/MorioFAB';

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
  // presence/typing handled by hooks
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<number | null>(null);
  const [longPressMenu, setLongPressMenu] = useState<{ visible: boolean; x: number; y: number; message?: Message | null }>({ visible: false, x: 0, y: 0, message: null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🚀'];

  // Hooks for messages, presence, typing and actions
  const { messages: hookMessages, isLoading, error, create, update, remove } = useMessages(daoId);
  const { onlineUsers, typingUsers } = usePresence(daoId);
  useTypingIndicator(daoId, newMessage);
  const { react, upload } = useChatActions(daoId);

  const messages = (hookMessages || []).reverse(); // show latest at bottom

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // presence and typing are handled by hooks

  // actions handled by hooks: create, update, remove, react, upload

  const handleSendMessage = () => {
    if (!newMessage.trim() && !selectedFile) return;
    
    if (selectedFile) {
      upload(selectedFile).then((data) => {
        create({ content: selectedFile?.name || 'File uploaded', messageType: data.fileType?.startsWith('image/') ? 'image' : 'file', attachment: data }).catch(() => {});
        setSelectedFile(null);
      }).catch(() => {});
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
    create(messageData).then(() => { setNewMessage(''); setIsSubmitting(false); }).catch(() => setIsSubmitting(false));
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
    update({ messageId, content: editContent }).then(() => { setEditingMessageId(null); setEditContent(''); }).catch(() => {});
  };

  const handleDeleteMessage = (messageId: string) => {
    if (confirm("Are you sure you want to delete this message?")) {
      remove(messageId).catch(() => {});
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
    react({ messageId, emoji }).catch(() => {});
  };

  const copyMessageLink = (messageId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/dao/${daoId}/message/${messageId}`);
  };

  const handleLongPressOpen = (evt: React.TouchEvent | React.MouseEvent, message: Message) => {
    evt.preventDefault();
    const touch = (evt as React.TouchEvent).touches ? (evt as React.TouchEvent).touches[0] : (evt as React.MouseEvent);
    const x = touch.clientX || 0;
    const y = touch.clientY || 0;
    setLongPressMenu({ visible: true, x, y, message });
  };

  const handleLongPressClose = () => setLongPressMenu({ visible: false, x: 0, y: 0, message: null });

  const filteredMessages = searchQuery 
    ? messages.filter((msg: Message) => 
        msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.userName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  if (!currentUserId) {
    return (
      <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 text-gray-300 text-4xl">💬</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Join the Conversation</h3>
          <p className="text-gray-500">Please log in to participate in the DAO chat.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-md h-[600px] flex flex-col overflow-hidden">
      {/* WhatsApp-style Header */}
      <CardHeader className="pb-3 bg-[#075E54] dark:bg-[#1F2C34] text-white border-none">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 dark:bg-white/10 rounded-full flex items-center justify-center text-white">💬</div>
            <div>
              <div className="text-base font-medium text-white">{daoName} Chat</div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                          <div className="flex items-center space-x-1.5 cursor-pointer">
                            <div className="w-2 h-2 bg-[#25D366] dark:bg-green-500 rounded-full animate-pulse" />
                            <span className="text-xs text-white/80 dark:text-white/70">{onlineUsers.length} online</span>
                          </div>
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
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSearch(!showSearch)}
              className="h-9 w-9 text-white hover:bg-white/10 dark:hover:bg-white/5"
            >
              <span className="w-4 h-4 inline-block text-lg">🔍</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="h-9 w-9 text-white hover:bg-white/10 dark:hover:bg-white/5"
            >
              {soundEnabled ? <span className="text-lg">🔊</span> : <span className="text-lg">🔈</span>}
            </Button>
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

      {/* Messages Container - WhatsApp style */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#E5DDD5] dark:bg-[#0B141A]"
        style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23D9D9D9\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M0 0h50v50H0zm50 50h50v50H50z\'/%3E%3C/g%3E%3C/svg%3E")'}}>
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
          <div className="text-center py-8 text-gray-600 dark:text-gray-400">
            <div className="w-12 h-12 mx-auto mb-3 text-gray-400 text-4xl">💬</div>
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
                onTouchStart={(e) => {
                  if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
                  longPressTimer.current = window.setTimeout(() => handleLongPressOpen(e, message), 600) as unknown as number;
                }}
                onTouchEnd={() => {
                  if (longPressTimer.current) {
                    window.clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                  }
                }}
                onContextMenu={(e) => { e.preventDefault(); handleLongPressOpen(e, message); }}
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
                        <span className="w-3 h-3 text-yellow-600">📌</span>
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
                        <span className="w-3 h-3">↩️</span>
                      </Button>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-400 hover:text-yellow-600"
                            title="React"
                          >
                            <span className="w-3 h-3">😄</span>
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
                            <span className="w-3 h-3">⋯</span>
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
                              <span className="w-3 h-3 mr-2">📋</span>
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
                                  <span className="w-3 h-3 mr-2">✏️</span>
                                  Edit Message
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteMessage(message.id)}
                                  className="w-full justify-start text-xs text-red-600"
                                >
                                  <span className="w-3 h-3 mr-2">🗑️</span>
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
                      {/* Message Content - WhatsApp style */}
                      <div
                        className={`inline-block px-3 py-2 shadow-sm text-sm max-w-xs ${
                          isCurrentUser
                            ? "bg-[#DCF8C6] dark:bg-[#005C4B] text-gray-900 dark:text-white rounded-lg rounded-br-none"
                            : "bg-white dark:bg-[#1F2C34] text-gray-900 dark:text-gray-100 rounded-lg rounded-bl-none"
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
                            <span className="w-4 h-4">📄</span>
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
                              <span className="w-3 h-3">⬇️</span>
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
        )}
        <div ref={messagesEndRef} />
        {/* Long-press action sheet for mobile */}
        {longPressMenu.visible && longPressMenu.message && (
          <div className="fixed z-50" style={{ left: longPressMenu.x, top: longPressMenu.y }}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 flex flex-col space-y-1 w-40">
              <button className="text-left text-sm px-2 py-1 hover:bg-gray-100 rounded" onClick={() => { setReplyingTo(longPressMenu.message!); handleLongPressClose(); }}>Reply</button>
              <button className="text-left text-sm px-2 py-1 hover:bg-gray-100 rounded" onClick={() => { copyMessageLink(longPressMenu.message!.id); handleLongPressClose(); }}>Copy Link</button>
              <button className="text-left text-sm px-2 py-1 hover:bg-gray-100 rounded" onClick={() => { handleReaction(longPressMenu.message!.id, commonEmojis[0]); handleLongPressClose(); }}>React {commonEmojis[0]}</button>
              {longPressMenu.message.userId === currentUserId && (
                <>
                  <button className="text-left text-sm px-2 py-1 hover:bg-gray-100 rounded" onClick={() => { handleEditMessage(longPressMenu.message!); handleLongPressClose(); }}>Edit</button>
                  <button className="text-left text-sm px-2 py-1 text-red-600 hover:bg-gray-100 rounded" onClick={() => { if (confirm('Delete this message?')) { handleDeleteMessage(longPressMenu.message!.id); } handleLongPressClose(); }}>Delete</button>
                </>
              )}
              <button className="text-left text-sm px-2 py-1 hover:bg-gray-100 rounded" onClick={() => handleLongPressClose()}>Close</button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Message Input - WhatsApp style */}
      <div className="bg-[#F0F2F5] dark:bg-[#1F2C34] p-3 border-t border-gray-200 dark:border-gray-700">
        {/* File Preview */}
        {selectedFile && (
          <div className="mb-2 p-2 bg-white dark:bg-[#2A3942] rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {selectedFile.type.startsWith('image/') ? 
                  <span className="w-4 h-4">🖼️</span> : 
                  <span className="w-4 h-4">📄</span>
                }
                <span className="text-sm text-gray-700 dark:text-gray-200">{selectedFile.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
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
        
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {/* File Upload */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="h-10 w-10 p-0 text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/10 rounded-full"
              title="Attach file"
            >
              <span className="w-5 h-5 text-lg">📎</span>
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
                  size="icon"
                  className="h-10 w-10 p-0 text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/10 rounded-full"
                  title="Add emoji"
                >
                  <span className="w-5 h-5">😄</span>
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
            className="flex-1 rounded-full bg-white dark:bg-[#2A3942] border-none focus-visible:ring-1 focus-visible:ring-[#25D366]"
          />
          <Button
            onClick={handleSendMessage}
            disabled={(!newMessage.trim() && !selectedFile) || isSubmitting}
            className="bg-[#25D366] hover:bg-[#20BD5C] rounded-full w-10 h-10 p-0 flex items-center justify-center"
          >
            {selectedFile ? <span className="w-4 h-4 text-white">📎</span> : <span className="w-4 h-4 text-white">➤</span>}
          </Button>
        </div>
      </div>
      {/* Morio floating assistant */}
      <MorioFAB userId={currentUserId || ''} daoId={daoId} />
    </Card>
  );
}