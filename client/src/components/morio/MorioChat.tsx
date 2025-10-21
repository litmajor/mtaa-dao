/**
 * Morio AI Chat Interface
 * 
 * Conversational interface for the Morio AI assistant
 */

import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatResponse {
  text: string;
  intent: string;
  confidence: number;
  suggestions: string[];
  actions: Array<{
    type: string;
    label: string;
    data?: Record<string, any>;
  }>;
}

export function MorioChat({ userId, daoId }: { userId: string; daoId?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Send message to Morio
  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest<ChatResponse>('/api/morio/chat', {
        method: 'POST',
        body: JSON.stringify({ userId, daoId, message })
      });
      return response;
    },
    onSuccess: (response) => {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: response.text,
          timestamp: new Date()
        }
      ]);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    setMessages(prev => [
      ...prev,
      {
        role: 'user',
        content: input,
        timestamp: new Date()
      }
    ]);

    // Send to Morio
    sendMessage.mutate(input);
    setInput('');
  };

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: 'Habari! 👋 I\'m Morio, your DAO assistant. I can help you with treasury management, proposals, voting, and analytics. What would you like to do today?',
        timestamp: new Date()
      }]);
    }
  }, []);

  return (
    <Card className="h-[600px] flex flex-col" data-testid="morio-chat">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          Morio AI Assistant
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            data-testid={`message-${message.role}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {sendMessage.isPending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </CardContent>

      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Morio anything..."
            disabled={sendMessage.isPending}
            data-testid="chat-input"
          />
          <Button 
            type="submit" 
            disabled={!input.trim() || sendMessage.isPending}
            data-testid="send-button"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>

        {/* Quick suggestions */}
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            onClick={() => handleSuggestion('Check DAO balance')}
            className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            data-testid="suggestion-balance"
          >
            Check balance
          </button>
          <button
            onClick={() => handleSuggestion('Show active proposals')}
            className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            data-testid="suggestion-proposals"
          >
            Active proposals
          </button>
          <button
            onClick={() => handleSuggestion('Treasury analytics')}
            className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            data-testid="suggestion-analytics"
          >
            Analytics
          </button>
        </div>
      </div>
    </Card>
  );
}
