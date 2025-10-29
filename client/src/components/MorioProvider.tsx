
import { useEffect, useState } from 'react';
import { MorioFAB } from './morio/MorioFAB';
import { useLocation } from 'wouter';

export function MorioProvider({ children, userId, daoId }: { 
  children: React.ReactNode; 
  userId?: string;
  daoId?: string;
}) {
  const [location] = useLocation();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Show onboarding for new users or on specific pages
    const isNewUser = !localStorage.getItem('morio-welcome-seen');
    const isOnboardingPage = location === '/dashboard' || location === '/';
    
    if (isNewUser && isOnboardingPage) {
      setShowOnboarding(true);
    }
  }, [location]);

  return (
    <>
      {children}
      {userId && (
        <MorioFAB 
          userId={userId} 
          daoId={daoId} 
          showOnboarding={showOnboarding}
        />
      )}
    </>
  );
}
