import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Send, AlertCircle, Users, DollarSign } from 'lucide-react';
import { useAuth } from '@/pages/hooks/useAuth';
import { authClient } from '@/utils/authClient';

interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  sender?: {
    id: string;
    firstName: string;
    lastName: string;
    username?: string;
    profileImageUrl?: string;
  };
}

interface Conversation {
  userId: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    username?: string;
    profileImageUrl?: string;
  };
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

interface MessagingPanelProps {
  recipientId?: string;
  recipientName?: string;
  onClose?: () => void;
}

const MESSAGING_ENABLED = import.meta.env.VITE_ENABLE_MESSAGING === 'true' || true;

export function MessagingPanel({ recipientId, recipientName, onClose }: MessagingPanelProps) {
  const { user } = useAuth();
  const [messageText, setMessageText] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<string | undefined>(recipientId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  if (!MESSAGING_ENABLED || !user?.id) {
    return null;
  }

  // Fetch conversations
  const { data: conversations = [] } = useQuery({
    queryKey: ['/api/messages/conversations', user?.id],
    queryFn: async () => {
      const data = await authClient.get('/api/messages/conversations');
      return data.conversations || [];
    },
    enabled: !!user?.id,
    refetchInterval: 3000, // Poll every 3 seconds after send
  });

  // Fetch messages in active conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: selectedConversation ? ['/api/messages/conversation', selectedConversation] : ['/api/messages/conversation'],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const data = await authClient.get(`/api/messages/conversation/${selectedConversation}?limit=50`);
      return data.messages || [];
    },
    enabled: !!selectedConversation && !!user?.id,
    refetchInterval: 2000, // Poll every 2 seconds for new messages
  });

  // Get unread count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['/api/messages/unread-count', user?.id],
    queryFn: async () => {
      const data = await authClient.get('/api/messages/unread-count');
      return data.unreadCount || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 5000,
  });

  // Send message state
  const [sendingMessage, setSendingMessage] = useState(false);
  const [deletingMessage, setDeletingMessage] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!selectedConversation || !messageText.trim()) return;
    setSendingMessage(true);
    try {
      await authClient.post('/api/messages/send', {
        recipientId: selectedConversation,
        content: messageText,
      });
      setMessageText('');
      // Polling will fetch new data
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    setDeletingMessage(messageId);
    try {
      await authClient.delete(`/api/messages/${messageId}`);
      // Polling will fetch new data
      // Polling will fetch new data
    } catch (error) {
      console.error('Error deleting message:', error);
    } finally {
      setDeletingMessage(null);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    sendMessage();
  };

  const currentConversation = conversations.find((c: Conversation) => c.userId === selectedConversation);

  if (!selectedConversation) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5" />
            Messages
            {unreadCount > 0 && <Badge className="ml-auto">{unreadCount}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-2">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv: Conversation) => (
              <button
                key={conv.userId}
                onClick={() => setSelectedConversation(conv.userId)}
                className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={conv.user?.profileImageUrl} />
                    <AvatarFallback>
                      {conv.user?.firstName?.[0]}{conv.user?.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {conv.user?.username || `${conv.user?.firstName} ${conv.user?.lastName}`}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <Badge className="text-xs">{conv.unreadCount}</Badge>
                  )}
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          {currentConversation?.user && (
            <>
              <Avatar className="w-8 h-8">
                <AvatarImage src={currentConversation.user.profileImageUrl} />
                <AvatarFallback>
                  {currentConversation.user.firstName?.[0]}{currentConversation.user.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">
                  {currentConversation.user.username || `${currentConversation.user.firstName} ${currentConversation.user.lastName}`}
                </p>
              </div>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedConversation(undefined);
            onClose?.();
          }}
        >
          ← Back
        </Button>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <Plus className="w-5 h-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Heart className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((msg: Message) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                    msg.senderId === user?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm break-words">{msg.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                {msg.senderId === user?.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMessage(msg.id)}
                    disabled={deletingMessage === msg.id}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </CardContent>

      <div className="border-t p-4 space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
            disabled={sendingMessage}
            maxLength={5000}
            className="text-sm"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageText.trim() || sendingMessage}
            size="sm"
          >
            {sendingMessage ? (
              <Plus className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {messageText.length}/5000
        </p>
      </div>
    </Card>
  );
}
