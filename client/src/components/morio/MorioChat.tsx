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

export function MorioChat({ 
  userId, 
  daoId, 
  isOnboarding = false 
}: { 
  userId: string; 
  daoId?: string;
  isOnboarding?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch onboarding session
  const { data: onboardingSession } = useQuery({
    queryKey: ['onboarding', userId],
    queryFn: async () => {
      if (!isOnboarding) return null;
      const response = await apiRequest<any>('/api/onboarding/session', {
        method: 'GET'
      });
      return response;
    },
    enabled: isOnboarding
  });

  // Complete onboarding step mutation
  const completeStep = useMutation({
    mutationFn: async (stepId: string) => {
      const response = await apiRequest<any>('/api/onboarding/complete-step', {
        method: 'POST',
        body: JSON.stringify({ stepId })
      });
      return response;
    }
  });

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

  // Welcome message with onboarding steps
  useEffect(() => {
    if (messages.length === 0) {
      let welcomeMessage = 'Habari! 👋 I\'m Morio, your DAO assistant. I can help you with treasury management, proposals, voting, and analytics. What would you like to do today?';
      
      if (isOnboarding && onboardingSession) {
        const progress = onboardingSession.progress || 0;
        const currentStepData = onboardingSession.steps[onboardingSession.currentStep];
        
        welcomeMessage = `Habari! 👋 I'm Morio, your personal guide to MtaaDAO!

Welcome to the future of community finance. I'll be your companion throughout this journey.

**Your Progress: ${progress}% Complete**

${currentStepData ? `📍 **Current Step:** ${currentStepData.title}` : ''}

**Onboarding Steps:**
${onboardingSession.steps.map((step: any, idx: number) => 
  `${step.completed ? '✅' : '⭐'} ${step.title} - ${step.description}`
).join('\n')}

**Quick Start Options:**
• "Continue onboarding" - Resume where you left off
• "Setup my wallet" - Get started with crypto
• "Create my first DAO" - Build your community
• "Skip onboarding" - Jump straight in

What would you like to explore first?`;
      } else if (isOnboarding) {
        welcomeMessage = `Habari! 👋 I'm Morio, your personal guide to MtaaDAO!

Welcome to the future of community finance. I'll be your companion throughout this journey.

**Let's start with a quick tour:**

🏠 **Dashboard** - Your central hub for all DAO activities
💰 **Treasury** - Manage shared funds transparently
📝 **Proposals** - Create and vote on community decisions  
👛 **Wallet** - Your personal vault and transactions
📊 **Analytics** - Track growth and insights

**Quick Start Options:**
• "Take the full tour" - 5-minute walkthrough
• "Setup my wallet" - Get started with crypto
• "Create my first DAO" - Build your community

What would you like to explore first?`;
      }
      
      setMessages([{
        role: 'assistant',
        content: welcomeMessage,
        timestamp: new Date()
      }]);
    }
  }, [isOnboarding, onboardingSession]);

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
          {isOnboarding ? (
            <>
              <button
                onClick={() => handleSuggestion('Take the full tour')}
                className="text-xs px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full hover:shadow-lg transition-all"
              >
                🎯 Start Tour
              </button>
              <button
                onClick={() => handleSuggestion('Setup my wallet')}
                className="text-xs px-3 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/50"
              >
                👛 Setup Wallet
              </button>
              <button
                onClick={() => handleSuggestion('Create my first DAO')}
                className="text-xs px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                🏗️ Create DAO
              </button>
              <button
                onClick={() => handleSuggestion('How do I vote?')}
                className="text-xs px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                🗳️ Voting Guide
              </button>
              <button
                onClick={() => handleSuggestion('Explain treasury management')}
                className="text-xs px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                💰 Treasury Basics
              </button>
              <button
                onClick={() => handleSuggestion('Show me success stories')}
                className="text-xs px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                ⭐ Success Stories
              </button>
              <button
                onClick={() => handleSuggestion('What are vaults?')}
                className="text-xs px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                🏦 Vaults Explained
              </button>
              <button
                onClick={() => handleSuggestion('How to earn rewards?')}
                className="text-xs px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                🎁 Earn Rewards
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleSuggestion('Check DAO balance')}
                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                data-testid="suggestion-balance"
              >
                💰 Check balance
              </button>
              <button
                onClick={() => handleSuggestion('Show active proposals')}
                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                data-testid="suggestion-proposals"
              >
                📝 Active proposals
              </button>
              <button
                onClick={() => handleSuggestion('Treasury analytics')}
                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                data-testid="suggestion-analytics"
              >
                📊 Analytics
              </button>
              <button
                onClick={() => handleSuggestion('Create a proposal')}
                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                ➕ New proposal
              </button>
              <button
                onClick={() => handleSuggestion('My contribution score')}
                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                🏆 My score
              </button>
              <button
                onClick={() => handleSuggestion('Recent transactions')}
                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                💸 Transactions
              </button>
              <button
                onClick={() => handleSuggestion('Available tasks')}
                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                ✅ Tasks
              </button>
              <button
                onClick={() => handleSuggestion('Investment pools')}
                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                🏊 Pools
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
