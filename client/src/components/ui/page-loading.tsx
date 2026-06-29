import React, { useState, useEffect } from 'react';

interface PageLoadingProps {
  message?: string;
  // Added fullScreen flag so you can reuse this inside dashboards WITHOUT breaking layout
  fullScreen?: boolean; 
}

// A pool of contextual, dynamic messages to make the wait feel faster and less static
const LOADING_PHRASES = [
  "Fetching blockchain states...",
  "Syncing smart contracts...",
  "Querying decentralized ledger...",
  "Assembling dashboard nodes...",
];

export const PageLoading: React.FC<PageLoadingProps> = ({ 
  message,
  fullScreen = false
}) => {
  const [currentMessage, setCurrentMessage] = useState(message || LOADING_PHRASES[0]);

  // Rotates messages if the user is stuck waiting a few seconds, keeping the app looking alive
  useEffect(() => {
    if (message) return; // Don't rotate if a custom hardcoded message was passed down
    
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % LOADING_PHRASES.length;
      setCurrentMessage(LOADING_PHRASES[index]);
    }, 2500);

    return () => clearInterval(interval);
  }, [message]);

  return (
    <div 
      className={`
        flex flex-col items-center justify-center p-8 transition-all duration-300
        ${fullScreen ? 'min-h-screen w-screen bg-[#0B0F19]' : 'h-full w-full min-h-[400px] bg-transparent'}
      `}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center max-w-xs w-full text-center space-y-6">
        
        {/* Futuristic Cyberpunk Ring Loader */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          {/* Static outer tracking ring */}
          <div className="absolute inset-0 rounded-full border-2 border-orange-500/10" />
          
          {/* Fast spinning accent ring */}
          <div className="absolute inset-0 rounded-full border-2 border-t-orange-500 border-r-transparent border-b-transparent border-l-transparent animate-spin [animation-duration:0.8s]" />
          
          {/* Slower counter-rotating internal ring */}
          <div className="absolute inset-2 rounded-full border border-b-amber-500/60 border-t-transparent border-r-transparent border-l-transparent animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />
          
          {/* Core pulsing energy node */}
          <div className="w-3 h-3 bg-gradient-to-tr from-orange-500 to-amber-500 rounded-full animate-pulse" />
        </div>

        {/* Dynamic Status Text Block */}
        <div className="space-y-1.5 min-h-[40px] flex flex-col justify-center">
          <p className="text-sm font-medium bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-300 tracking-wide animate-fade-in-out key={currentMessage}">
            {currentMessage}
          </p>
          <p className="text-xs text-orange-500/60 tracking-widest uppercase font-semibold text-[10px]">
            Please wait
          </p>
        </div>

      </div>

      {/* Embedded scope scoped animations */}
      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(4px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }
        .animate-fade-in-out {
          animation: fadeInOut 2.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default PageLoading;