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
import { MorioElderInsights } from './MorioElderInsights';

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
  isOnboarding = false,
  variant = 'full'
}: { 
  userId: string; 
  daoId?: string;
  isOnboarding?: boolean;
  variant?: 'full' | 'compact';
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
    <Card className="h-[600px] flex flex-col overflow-hidden" data-testid="morio-chat">
      {/* WhatsApp-style Header */}
      <CardHeader className="bg-[#075E54] dark:bg-[#1F2C34] text-white p-3 border-none">
        <CardTitle className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 dark:bg-white/10 rounded-full flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-base font-medium text-white">Morio AI Assistant</div>
            <div className="text-xs text-white/70 dark:text-white/60">Online - AI Powered</div>
          </div>
        </CardTitle>
      </CardHeader>

      {/* Elder Insights Panel */}
      {daoId && variant === 'full' && (
        <div className="border-b p-3 bg-[#F0F2F5] dark:bg-[#1F2C34]">
          <MorioElderInsights userId={userId} daoId={daoId} />
        </div>
      )}

      {/* WhatsApp-style Messages Area */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#E5DDD5] dark:bg-[#0B141A]" 
        style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23D9D9D9\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M0 0h50v50H0zm50 50h50v50H50z\'/%3E%3C/g%3E%3C/svg%3E")'}}>
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            data-testid={`message-${message.role}`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${
                message.role === 'user'
                  ? 'bg-[#DCF8C6] dark:bg-[#005C4B] text-gray-900 dark:text-white rounded-br-none'
                  : 'bg-white dark:bg-[#1F2C34] text-gray-900 dark:text-gray-100 rounded-bl-none'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 text-right">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {sendMessage.isPending && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-[#1F2C34] rounded-lg rounded-bl-none px-4 py-2 shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </CardContent>

      {/* WhatsApp-style Input Area */}
      <div className="bg-[#F0F2F5] dark:bg-[#1F2C34] p-3 border-t border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={sendMessage.isPending}
            data-testid="chat-input"
            className="flex-1 rounded-full bg-white dark:bg-[#2A3942] border-none focus-visible:ring-1 focus-visible:ring-[#25D366]"
          />
          <Button 
            type="submit" 
            disabled={!input.trim() || sendMessage.isPending}
            data-testid="send-button"
            className="bg-[#25D366] hover:bg-[#20BD5C] rounded-full w-10 h-10 p-0 flex items-center justify-center"
          >
            <Send className="w-4 h-4 text-white" />
          </Button>
        </form>

        {/* Quick suggestions - WhatsApp style */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {isOnboarding ? (
            <>
              <button
                onClick={() => handleSuggestion('Take the full tour')}
                className="text-xs px-3 py-1.5 bg-white dark:bg-[#2A3942] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full hover-elevate shadow-sm"
              >
                🎯 Start Tour
              </button>
              <button
                onClick={() => handleSuggestion('Setup my wallet')}
                className="text-xs px-3 py-1.5 bg-white dark:bg-[#2A3942] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full hover-elevate shadow-sm"
              >
                👛 Setup Wallet
              </button>
              <button
                onClick={() => handleSuggestion('Create my first DAO')}
                className="text-xs px-3 py-1.5 bg-white dark:bg-[#2A3942] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full hover-elevate shadow-sm"
              >
                🏗️ Create DAO
              </button>
              <button
                onClick={() => handleSuggestion('How do I vote?')}
                className="text-xs px-3 py-1.5 bg-white dark:bg-[#2A3942] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full hover-elevate shadow-sm"
              >
                🗳️ Voting Guide
              </button>
              <button
                onClick={() => handleSuggestion('Explain treasury management')}
                className="text-xs px-3 py-1.5 bg-white dark:bg-[#2A3942] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full hover-elevate shadow-sm"
              >
                💰 Treasury Basics
              </button>
              <button
                onClick={() => handleSuggestion('Show me success stories')}
                className="text-xs px-3 py-1.5 bg-white dark:bg-[#2A3942] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full hover-elevate shadow-sm"
              >
                ⭐ Success Stories
              </button>
              <button
                onClick={() => handleSuggestion('What are vaults?')}
                className="text-xs px-3 py-1.5 bg-white dark:bg-[#2A3942] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full hover-elevate shadow-sm"
              >
                🏦 Vaults Explained
              </button>
              <button
                onClick={() => handleSuggestion('How to earn rewards?')}
                className="text-xs px-3 py-1.5 bg-white dark:bg-[#2A3942] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full hover-elevate shadow-sm"
              >
                🎁 Earn Rewards
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleSuggestion('Check DAO balance')}
                className="text-xs px-2.5 py-1 bg-white dark:bg-[#2A3942] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full hover-elevate shadow-sm"
                data-testid="suggestion-balance"
              >
                💰 Check balance
              </button>
              <button
                onClick={() => handleSuggestion('Show active proposals')}
                className="text-xs px-2.5 py-1 bg-white dark:bg-[#2A3942] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full hover-elevate shadow-sm"
                data-testid="suggestion-proposals"
              >
                📝 Active proposals
              </button>
              <button
                onClick={() => handleSuggestion('Treasury analytics')}
                className="text-xs px-2.5 py-1 bg-white dark:bg-[#2A3942] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full hover-elevate shadow-sm"
                data-testid="suggestion-analytics"
              >
                📊 Analytics
              </button>
              <button
                onClick={() => handleSuggestion('Create a proposal')}
                className="text-xs px-2.5 py-1 bg-white dark:bg-[#2A3942] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full hover-elevate shadow-sm"
              >
                ➕ New proposal
              </button>
              <button
                onClick={() => handleSuggestion('My contribution score')}
                className="text-xs px-2.5 py-1 bg-white dark:bg-[#2A3942] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full hover-elevate shadow-sm"
              >
                🏆 My score
              </button>
              <button
                onClick={() => handleSuggestion('Recent transactions')}
                className="text-xs px-2.5 py-1 bg-white dark:bg-[#2A3942] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full hover-elevate shadow-sm"
              >
                💸 Transactions
              </button>
              <button
                onClick={() => handleSuggestion('Available tasks')}
                className="text-xs px-2.5 py-1 bg-white dark:bg-[#2A3942] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full hover-elevate shadow-sm"
              >
                ✅ Tasks
              </button>
              <button
                onClick={() => handleSuggestion('Investment pools')}
                className="text-xs px-2.5 py-1 bg-white dark:bg-[#2A3942] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full hover-elevate shadow-sm"
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
