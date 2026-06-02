/**
 * Morio AI Chat Interface
 * 
 * Conversational interface for the Morio AI assistant
 */

import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Send, LoaderCircle, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { MorioElderInsights } from './MorioElderInsights';
import { ConfirmMorioActionModal } from './ConfirmMorioActionModal';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  // optional assistant-provided metadata
  suggestions?: string[];
  actions?: Array<{ type: string; label?: string; data?: Record<string, any> }>;
  intent?: string;
  confidence?: number;
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

  const [systemMode, setSystemMode] = useState<'Conversational' | 'Analytical' | 'Governance'>('Conversational');
  const [showMoreQuickSuggestions, setShowMoreQuickSuggestions] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmToken, setConfirmToken] = useState<string | null>(null);
  const [confirmSummary, setConfirmSummary] = useState<string | undefined>(undefined);
  const [isDark, setIsDark] = useState(false);

  // Fetch onboarding session
  interface OnboardingStep {
    title: string;
    description: string;
    completed: boolean;
  }

  interface OnboardingSession {
    progress: number;
    currentStep: number;
    steps: OnboardingStep[];
  }

  const { data: onboardingSession } = useQuery({
    queryKey: ['onboarding', userId],
    queryFn: async (): Promise<OnboardingSession | null> => {
      if (!isOnboarding) return null;
      const res = await apiRequest('GET', '/api/onboarding/session');
      return await res.json();
    },
    enabled: isOnboarding,
  });

  // Complete onboarding step mutation
  const completeStep = useMutation({
    mutationFn: async (stepId: string) => {
      const res = await apiRequest('POST', '/api/onboarding/complete-step', { stepId });
      return await res.json();
    }
  });

  // Send message to Morio — include history for context, handle errors, and render suggestions/actions
  const sendMessage = useMutation({
    mutationFn: async (payload: { message: string; history: Message[] }) => {
      const res = await apiRequest('POST', '/api/morio/chat', { userId, daoId, message: payload.message, history: payload.history });
      const json = await res.json();
      return json as { jobId: string; statusUrl?: string };
    },
    onSuccess: (resp) => {
      // Create a placeholder assistant message and open SSE stream for updates
      const placeholderIndex = messages.length + 1;
      setMessages(prev => ([
        ...prev,
        {
          role: 'assistant',
          content: 'Morio is thinking...',
          timestamp: new Date()
        }
      ]));

      const evtSrc = new EventSource(`/api/morio/stream/${resp.jobId}`);

      evtSrc.addEventListener('morio_job_update', (ev: any) => {
        try {
          const data = JSON.parse(ev.data);

          // If final response present, replace placeholder with final content
          if (data.result && data.result.response && data.result.response.text) {
            const final = data.result.response;
            setMessages(prev => {
              const copy = [...prev];
              copy[copy.length - 1] = {
                role: 'assistant',
                content: final.text,
                timestamp: new Date(),
                suggestions: final.suggestions || [],
                actions: final.actions || [],
                intent: final.intent,
                confidence: final.confidence
              };
              return copy;
            });
            evtSrc.close();
            return;
          }

          // Otherwise handle partial trace updates
          if (data.result && data.result.type === 'trace') {
            const trace = data.result;
            setMessages(prev => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              const appended = `${last.content}\n[${trace.step}] ${trace.message || (trace.data ? JSON.stringify(trace.data) : '')}`;
              copy[copy.length - 1] = { ...last, content: appended };
              return copy;
            });
          }

        } catch (e) {
          console.warn('Failed to parse SSE event', e);
        }
      });

      evtSrc.addEventListener('morio_job_complete', () => {
        evtSrc.close();
      });

      evtSrc.addEventListener('morio_job_error', (ev: any) => {
        try {
          const d = JSON.parse(ev.data || '{}');
          setMessages(prev => ([...prev, { role: 'assistant', content: `Stream error: ${d.details || 'unknown'}`, timestamp: new Date() }]));
        } catch (e) {
          setMessages(prev => ([...prev, { role: 'assistant', content: 'Stream error', timestamp: new Date() }]));
        }
        evtSrc.close();
      });
    },
    onError: (error) => {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "Sorry, I couldn't process that. Try again.",
          timestamp: new Date(),
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

    // Send to Morio with recent history (last 10 messages)
    sendMessage.mutate({ message: input, history: messages.slice(-10) });
    setInput('');
  };

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
  };

  const handleActionClick = (action: { type: string; label?: string; data?: Record<string, any> }) => {
    // Basic local handler: populate input with action label or log
    if (action.label) setInput(action.label);
    console.log('Morio action triggered:', action);
    // If action requires confirmation (pending token), open modal
    const token = action.data?.pendingActionToken;
    if (token) {
      setConfirmToken(token as string);
      setConfirmSummary(action.data?.summary || action.label);
      setConfirmModalOpen(true);
      return;
    }
  };

  // Auto-scroll to bottom (use RAF to avoid jumpiness on fast replies)
  useEffect(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [messages]);

  // detect dark mode to adjust background texture
  useEffect(() => {
    try {
      const dark = document.documentElement.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(!!dark);
    } catch (e) {
      setIsDark(false);
    }
  }, []);

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 dark:bg-white/10 rounded-full flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
          <ConfirmMorioActionModal open={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} token={confirmToken || ''} summary={confirmSummary} onConfirmed={(res) => {
            // append result to messages
            setMessages(prev => ([...prev, { role: 'assistant', content: `Action executed: ${res?.result ? 'success' : 'failed'}`, timestamp: new Date() }]));
          }} />
              <div className="text-base font-medium text-white">Morio AI Assistant</div>
              <div className="text-xs text-white/70 dark:text-white/60">{sendMessage.isPending ? 'Thinking…' : 'Online'}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-white/80">Mode:</div>
            <select
              aria-label="System mode"
              value={systemMode}
              onChange={(e) => setSystemMode(e.target.value as any)}
              className="bg-white/10 text-white text-xs rounded px-2 py-0.5"
            >
              <option value="Conversational">Conversational</option>
              <option value="Analytical">Analytical</option>
              <option value="Governance">Governance</option>
            </select>
          </div>
        </div>
      </CardHeader>

      {/* Elder Insights Panel */}
      {daoId && variant === 'full' && (
        <div className="border-b p-3 bg-[#F0F2F5] dark:bg-[#1F2C34]">
          <MorioElderInsights userId={userId} daoId={daoId} />
        </div>
      )}

      {/* Messages Area with improved UX */}
      <CardContent
        className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#E5DDD5] dark:bg-[#0B141A]"
        style={isDark ? {} : { backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23D9D9D9\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M0 0h50v50H0zm50 50h50v50H50z\'/%3E%3C/g%3E%3C/svg%3E")' }}
      >
        {/* Smart empty-state cards shown when chat is at welcome state */}
        {messages.length <= 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
            <button onClick={() => { setInput('How is our treasury doing?'); }} className="text-left p-3 bg-white rounded shadow-sm">
              <div className="font-medium">💰 Treasury question</div>
              <div className="text-xs text-gray-600 mt-1">Ask about balances, allocations, and history</div>
            </button>
            <button onClick={() => { setInput('How do proposals work?'); }} className="text-left p-3 bg-white rounded shadow-sm">
              <div className="font-medium">🗳️ Governance question</div>
              <div className="text-xs text-gray-600 mt-1">Create, vote, and manage proposals</div>
            </button>
            <button onClick={() => { setInput('How can agents help me?'); }} className="text-left p-3 bg-white rounded shadow-sm">
              <div className="font-medium">🤖 Agent system question</div>
              <div className="text-xs text-gray-600 mt-1">Automations, workflows, and tasks</div>
            </button>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} group`} data-testid={`message-${message.role}`}>
            <div className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${message.role === 'user' ? 'bg-[#DCF8C6] dark:bg-[#005C4B] text-gray-900 dark:text-white rounded-br-none' : 'bg-white dark:bg-[#1F2C34] text-gray-900 dark:text-gray-100 rounded-bl-none'}`}>
              <div className="flex items-start gap-2">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
              </div>

              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 text-right invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>

              {/* assistant: intent/confidence badges */}
              {message.role === 'assistant' && (message.intent || message.confidence) && (
                <div className="flex items-center gap-2 mt-2">
                  {message.intent && <span className="text-[11px] px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full">{message.intent}</span>}
                  {typeof message.confidence === 'number' && <span className="text-[11px] px-2 py-0.5 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full">Confidence: {Math.round(message.confidence * 100)}%</span>}
                </div>
              )}

              {/* actions */}
              {message.role === 'assistant' && message.actions && message.actions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {message.actions.map((a, ai) => (
                    <button key={ai} onClick={() => handleActionClick(a)} className="text-xs px-3 py-1 bg-green-600 text-white rounded">
                      {a.label || a.type}
                    </button>
                  ))}
                </div>
              )}

              {/* suggestions row (max 4, horizontal scroll) */}
              {message.role === 'assistant' && message.suggestions && message.suggestions.length > 0 && (
                <div className="flex gap-2 overflow-x-auto whitespace-nowrap mt-2">
                  {message.suggestions.slice(0, 4).map((s, i) => (
                    <button key={i} onClick={() => handleSuggestion(s)} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full">
                      {s}
                    </button>
                  ))}
                  {message.suggestions.length > 4 && (
                    <button onClick={() => setShowMoreQuickSuggestions(!showMoreQuickSuggestions)} className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded-full">
                      More →
                    </button>
                  )}
                </div>
              )}

              {showMoreQuickSuggestions && message.suggestions && message.suggestions.length > 4 && (
                <div className="mt-2 p-2 bg-white rounded shadow-sm">
                  {message.suggestions.slice(4).map((s, i) => (
                    <div key={i} className="text-sm py-1 border-b last:border-b-0"><button onClick={() => handleSuggestion(s)}>{s}</button></div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {sendMessage.isPending && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-[#1F2C34] rounded-lg rounded-bl-none px-3 py-2 shadow-sm flex items-center gap-2">
              <LoaderCircle className="w-4 h-4 animate-spin text-gray-500" />
              <span className="text-xs text-gray-500">Morio is thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </CardContent>

      {/* WhatsApp-style Input Area with continuity line */}
      <div className="bg-[#F0F2F5] dark:bg-[#1F2C34] p-2 border-t border-white/10 dark:border-white/5">
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

        {/* Compact quick suggestions: horizontal scroll, max 4 visible */}
        <div className="flex gap-2 overflow-x-auto whitespace-nowrap mt-2 py-1">
          {(isOnboarding ? [
            'Take the full tour',
            'Setup my wallet',
            'Create my first DAO',
            'How do I vote?',
            'Explain treasury management'
          ] : [
            'Check DAO balance',
            'Show active proposals',
            'Treasury analytics',
            'Create a proposal',
            'Recent transactions'
          ]).slice(0,4).map((s, i) => (
            <button key={i} onClick={() => handleSuggestion(s)} className="text-xs px-3 py-1 bg-white dark:bg-[#2A3942] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full">
              {s}
            </button>
          ))}
          <button onClick={() => setShowMoreQuickSuggestions(!showMoreQuickSuggestions)} className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded-full">
            More →
          </button>
        </div>

        {showMoreQuickSuggestions && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(isOnboarding ? [
              'Take the full tour', 'Setup my wallet', 'Create my first DAO', 'How do I vote?', 'Explain treasury management', 'Earn rewards'
            ] : [
              'Check DAO balance', 'Show active proposals', 'Treasury analytics', 'Create a proposal', 'Recent transactions', 'Available tasks'
            ]).map((s, i) => (
              <button key={i} onClick={() => { handleSuggestion(s); setShowMoreQuickSuggestions(false); }} className="text-sm p-2 bg-white rounded border">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
