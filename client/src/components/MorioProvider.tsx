
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MorioFAB } from './morio/MorioFAB';
import { useLocation } from 'react-router-dom';

interface MorioContextType {
  openMorio: (message?: string) => void;
  closeMorio: () => void;
  isOpen: boolean;
}

const MorioContext = createContext<MorioContextType | undefined>(undefined);

export function useMorio() {
  const context = useContext(MorioContext);
  if (!context) {
    throw new Error('useMorio must be used within MorioProvider');
  }
  return context;
}

interface MorioProviderProps {
  children: ReactNode;
  userId?: string;
  daoId?: string;
}

export function MorioProvider({ children, userId, daoId }: MorioProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string>();
  const location = useLocation();

  const openMorio = (message?: string) => {
    setInitialMessage(message);
    setIsOpen(true);
  };

  const closeMorio = () => {
    setIsOpen(false);
    setInitialMessage(undefined);
  };

  // Auto-show Morio on certain pages or first visit
  useEffect(() => {
    const hasSeenMorio = localStorage.getItem('morio-intro-seen');
    const isLandingPage = location.pathname === '/';
    
    if (!hasSeenMorio && isLandingPage) {
      setTimeout(() => {
        openMorio('Welcome to MtaaDAO! How can I help you get started?');
        localStorage.setItem('morio-intro-seen', 'true');
      }, 3000);
    }
  }, [location.pathname]);

  return (
    <MorioContext.Provider value={{ openMorio, closeMorio, isOpen }}>
      {children}
      {userId && (
        <MorioFAB 
          userId={userId} 
          daoId={daoId}
          showOnboarding={!localStorage.getItem('onboarding-complete')}
        />
      )}
    </MorioContext.Provider>
  );
}
