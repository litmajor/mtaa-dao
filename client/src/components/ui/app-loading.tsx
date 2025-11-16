import React from 'react';

export const AppLoading: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-orange-100 opacity-50" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Logo/Icon */}
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.5 1.5H5.25A3.75 3.75 0 001.5 5.25v9.5A3.75 3.75 0 005.25 18.5h9.5a3.75 3.75 0 003.75-3.75v-5.25" />
              <circle cx="10" cy="10" r="3" fill="white" opacity="0.3" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-gray-900">MTAA DAO</span>
        </div>

        {/* Loading spinner */}
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>

        {/* Status text */}
        <div className="text-center">
          <p className="text-gray-600 text-sm font-medium">Loading Mtaa DAO...</p>
          <p className="text-gray-400 text-xs mt-1">Setting up your experience</p>
        </div>
      </div>

      {/* Bottom progress indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100">
        <div
          className="h-full bg-gradient-to-r from-orange-400 to-orange-600"
          style={{
            animation: 'slideInOut 2s ease-in-out infinite',
            width: '30%',
          }}
        />
      </div>

      <style>{`
        @keyframes slideInOut {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(calc(100vw + 100%)); }
          100% { transform: translateX(calc(100vw + 100%)); }
        }
      `}</style>
    </div>
  );
};

export default AppLoading;
