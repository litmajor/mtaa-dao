
import { useState, useEffect } from 'react';
import { MessageCircle, X, Sparkles, HelpCircle, Minimize2, Maximize2, Brain, Heart, Zap, TrendingUp, Users, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MorioChat } from './MorioChat';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';

interface MorioFABProps {
  userId: string;
  daoId?: string;
  showOnboarding?: boolean;
  variant?: 'full' | 'mini';
}

interface SystemHealth {
  status: string;
  components: {
    morio: string;
    nuru: string;
    kwetu: string;
  };
  metrics?: {
    activeUsers: number;
    assistanceProvided: number;
    successRate: number;
  };
}

export function MorioFAB({ userId, daoId, showOnboarding = false, variant = 'full' }: MorioFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMiniChat, setIsMiniChat] = useState(variant === 'mini');
  const [hasUnread, setHasUnread] = useState(false);
  const [showWelcome, setShowWelcome] = useState(showOnboarding);

  // Fetch system health for real-time status
  const { data: health } = useQuery<SystemHealth>({
    queryKey: ['/api/morio/health'],
    queryFn: async () => {
      const res = await fetch('/api/morio/health');
      if (!res.ok) throw new Error('Failed to fetch health');
      return res.json();
    },
    refetchInterval: 10000
  });

  useEffect(() => {
    // Show welcome message for new users
    const hasSeenWelcome = localStorage.getItem('morio-welcome-seen');
    if (!hasSeenWelcome && showOnboarding) {
      setShowWelcome(true);
      setTimeout(() => {
        setHasUnread(true);
      }, 2000);
    }
  }, [showOnboarding]);

  const handleOpen = () => {
    setIsOpen(true);
    setHasUnread(false);
    setShowWelcome(false);
    localStorage.setItem('morio-welcome-seen', 'true');
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
    setIsMiniChat(variant === 'mini');
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const toggleMiniChat = () => {
    setIsMiniChat(!isMiniChat);
  };

  return (
    <>
      {/* Welcome Tooltip */}
      {showWelcome && !isOpen && (
        <div className="fixed bottom-24 right-6 z-40 animate-bounce">
          <Card className="p-4 max-w-xs shadow-lg border-purple-200 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm mb-1">Hi! I'm Morio 👋</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Your AI assistant for navigating MtaaDAO. Click me to get started with a quick tour!
                </p>
              </div>
              <button
                onClick={() => setShowWelcome(false)}
                title="Close welcome message"
                aria-label="Close welcome message"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div 
          className={`fixed z-50 transition-all duration-300 ${
            isMiniChat
              ? 'bottom-6 right-6 w-80 md:w-96'
              : isMinimized 
                ? 'bottom-24 right-6 w-80' 
                : 'bottom-6 right-6 w-96 md:w-[40rem] lg:w-[48rem]'
          }`}
          style={{ maxHeight: isMinimized ? '60px' : isMiniChat ? '400px' : 'calc(100vh - 8rem)' }}
        >
          <Card className="shadow-2xl border-purple-200 dark:border-purple-800 overflow-hidden">
            {/* Enhanced Header with System Status */}
            <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    {health?.status === 'healthy' && (
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold">Morio AI Assistant</h3>
                    <p className="text-xs text-purple-100 flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      {health?.components?.nuru === 'active' && health?.components?.kwetu === 'active' 
                        ? 'Fully Connected' 
                        : 'Initializing...'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isMiniChat && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleMiniChat}
                      className="text-white hover:bg-white/20 h-8 px-2 text-xs"
                      title="Switch to mini mode"
                    >
                      Mini
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleMinimize}
                    className="text-white hover:bg-white/20 h-8 w-8 p-0"
                  >
                    {isMinimized ? (
                      <Maximize2 className="w-4 h-4" />
                    ) : (
                      <Minimize2 className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleClose()}
                    className="text-white hover:bg-white/20 h-8 w-8 p-0"
                    data-testid="button-morio-close"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* System Status Indicators */}
              {!isMinimized && (
                <div className="flex gap-2 text-xs">
                  <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded">
                    <Brain className="w-3 h-3" />
                    <span>Nuru: {health?.components?.nuru || 'loading'}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded">
                    <Heart className="w-3 h-3" />
                    <span>Kwetu: {health?.components?.kwetu || 'loading'}</span>
                  </div>
                  {health?.metrics && (
                    <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded">
                      <TrendingUp className="w-3 h-3" />
                      <span>{health.metrics.successRate}% success</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chat Content */}
            {!isMinimized && (
              <div className={isMiniChat ? 'h-[300px]' : 'h-[500px]'}>
                <MorioChat userId={userId} daoId={daoId} isOnboarding={showOnboarding} variant={isMiniChat ? 'compact' : 'full'} />
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Enhanced Floating Action Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40">
          {/* Pulsing ring effect */}
          <div className="absolute inset-0 w-16 h-16 rounded-full bg-purple-400 animate-ping opacity-75"></div>
          
          <button
            onClick={handleOpen}
            className="relative w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-700 text-white shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-110 flex items-center justify-center group"
            aria-label="Open Morio Assistant"
          >
            <Sparkles className="w-7 h-7 group-hover:rotate-12 transition-transform" />
            {hasUnread && (
              <Badge className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 border-2 border-white dark:border-gray-900 flex items-center justify-center p-0 animate-bounce">
                <span className="text-xs font-bold">!</span>
              </Badge>
            )}
            
            {/* Engagement indicator */}
            {health?.metrics && (
              <div className="absolute -top-2 -left-2 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-md">
                {health.metrics.activeUsers}+
              </div>
            )}
          </button>
        </div>
      )}

      {/* Quick Action Buttons */}
      {!isOpen && (
        <div className="fixed bottom-24 right-6 z-40 flex flex-col gap-2">
          <button
            onClick={() => {
              setIsOpen(true);
              setIsMiniChat(true);
              setHasUnread(false);
            }}
            className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 border-2 border-purple-200 dark:border-purple-800 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 flex items-center justify-center text-purple-600 dark:text-purple-400 group"
            aria-label="Quick Chat"
            title="Quick Chat"
          >
            <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>
          
          <button
            onClick={() => {
              setIsOpen(true);
              setHasUnread(false);
            }}
            className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 border-2 border-indigo-200 dark:border-indigo-800 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group"
            aria-label="Get Help"
            title="Get Help"
          >
            <HelpCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>

          {health?.components?.nuru === 'active' && (
            <button
              onClick={() => {
                setIsOpen(true);
                setHasUnread(false);
              }}
              className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 border-2 border-green-200 dark:border-green-800 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 flex items-center justify-center text-green-600 dark:text-green-400 group"
              aria-label="AI Insights"
              title="AI Insights"
            >
              <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
