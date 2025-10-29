
import { useState, useEffect } from 'react';
import { MessageCircle, X, Sparkles, HelpCircle, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MorioChat } from './MorioChat';
import { Badge } from '@/components/ui/badge';

interface MorioFABProps {
  userId: string;
  daoId?: string;
  showOnboarding?: boolean;
}

export function MorioFAB({ userId, daoId, showOnboarding = false }: MorioFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [showWelcome, setShowWelcome] = useState(showOnboarding);

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
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
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
            isMinimized 
              ? 'bottom-24 right-6 w-80' 
              : 'bottom-6 right-6 w-96 md:w-[32rem]'
          }`}
          style={{ maxHeight: isMinimized ? '60px' : 'calc(100vh - 8rem)' }}
        >
          <Card className="shadow-2xl border-purple-200 dark:border-purple-800 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Morio Assistant</h3>
                  <p className="text-xs text-purple-100">Your DAO guide</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
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
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Chat Content */}
            {!isMinimized && (
              <div className="h-[500px]">
                <MorioChat userId={userId} daoId={daoId} isOnboarding={showOnboarding} />
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center group"
          aria-label="Open Morio Assistant"
        >
          <MessageCircle className="w-7 h-7 group-hover:scale-110 transition-transform" />
          {hasUnread && (
            <Badge className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 border-2 border-white dark:border-gray-900 flex items-center justify-center p-0">
              <span className="text-xs">1</span>
            </Badge>
          )}
        </button>
      )}

      {/* Quick Help Button */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setHasUnread(false);
          }}
          className="fixed bottom-24 right-6 z-40 w-12 h-12 rounded-full bg-white dark:bg-gray-800 border-2 border-purple-200 dark:border-purple-800 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 flex items-center justify-center text-purple-600 dark:text-purple-400"
          aria-label="Quick Help"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      )}
    </>
  );
}
