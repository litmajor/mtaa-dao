import React from 'react';

export const AppLoading: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] relative overflow-hidden font-sans select-none">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none [animation-delay:2s]" />

      {/* Subtle Grid Overlay for Tech/DAO Aesthetic */}
      <div 
        className="absolute inset-0 opacity-[0.02] pointer-events-none" 
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* Content Container (Premium Glassmorphism) */}
      <div className="relative z-10 flex flex-col items-center p-8 rounded-2xl border border-white/[0.05] bg-white/[0.02] backdrop-blur-md max-w-sm w-full mx-4 shadow-2xl shadow-black/40 text-center">
        
        {/* Logo Section with Pulsing Ring */}
        <div className="relative mb-6 group">
          <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 to-amber-500 rounded-2xl blur-md opacity-40 animate-pulse group-hover:opacity-70 transition-opacity duration-500" />
          <div className="relative w-16 h-16 bg-gradient-to-tr from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <svg className="w-9 h-9 text-white transform group-hover:scale-105 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 114 0v2m-4 0h4m-4 0H5m12 0h2" />
            </svg>
          </div>
        </div>

        {/* Brand Text */}
        <h1 className="text-2xl font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
          MTAA DAO
        </h1>
        
        <p className="text-gray-400 text-xs font-medium tracking-widest uppercase mt-1.5 opacity-80">
          Decentralizing Community
        </p>

        {/* Sleek Progress Ring & Loading State */}
        <div className="mt-10 mb-2 relative flex items-center justify-center">
          {/* Circular Spinner */}
          <svg className="animate-spin h-9 w-9 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-10" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>

        {/* Action/Status Message */}
        <div className="mt-4 space-y-1">
          <p className="text-gray-200 text-sm font-medium tracking-wide animate-pulse duration-1000">
            Connecting to network...
          </p>
          <p className="text-gray-500 text-xs">
            Securing your node session
          </p>
        </div>
      </div>

      {/* Edge Micro-Detail: Ambient Footer Loading Bar */}
      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-white/[0.03]">
        <div className="h-full bg-gradient-to-r from-transparent via-orange-500 to-transparent w-1/3 rounded-full animate-loading-slide" />
      </div>

      <style>{`
        @keyframes loadingSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .animate-loading-slide {
          animation: loadingSlide 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>
    </div>
  );
};

export default AppLoading;