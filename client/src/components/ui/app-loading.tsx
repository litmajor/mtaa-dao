import React from 'react';

export const AppLoading: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] relative overflow-hidden font-sans select-none">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none [animation-delay:2s]" />

      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative z-10 flex flex-col items-center p-8 rounded-2xl border border-white/[0.05] bg-white/[0.02] backdrop-blur-md max-w-sm w-full mx-4 shadow-2xl shadow-black/40 text-center">

        {/* Actual MtaaDAO mark */}
        <div className="relative mb-6 group w-16 h-16">
          <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 to-amber-500 rounded-2xl blur-md opacity-40 animate-pulse group-hover:opacity-70 transition-opacity duration-500" />
          <svg viewBox="0 0 400 400" className="relative w-16 h-16" style={{ overflow: 'visible' }}>
            <g className="mtaa-ring">
              <circle cx="200" cy="200" r="150" fill="none" stroke="#FF6E16" strokeWidth="14" opacity="0.25" />
              <g className="mtaa-node n1"><circle cx="200" cy="50" r="20" fill="#FF6E16" /><circle cx="200" cy="50" r="9" fill="#0B0F19" /></g>
              <g className="mtaa-node n2"><circle cx="350" cy="200" r="20" fill="#FF6E16" /><circle cx="350" cy="200" r="9" fill="#0B0F19" /></g>
              <g className="mtaa-node n3"><circle cx="200" cy="350" r="20" fill="#FF6E16" /><circle cx="200" cy="350" r="9" fill="#0B0F19" /></g>
              <g className="mtaa-node n4"><circle cx="50" cy="200" r="20" fill="#FF6E16" /><circle cx="50" cy="200" r="9" fill="#0B0F19" /></g>
            </g>
            <g className="mtaa-glyph">
              <path d="M 108 260 L 108 170 L 155 130 L 200 175 L 245 130 L 292 170 L 292 260"
                fill="none" stroke="#FF6E16" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 155 260 L 155 200 L 200 245 L 245 200 L 245 260"
                fill="none" stroke="#FF6E16" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </svg>
        </div>

        <h1 className="text-2xl font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
          MTAA DAO
        </h1>

        <p className="text-gray-400 text-xs font-medium tracking-widest uppercase mt-1.5 opacity-80">
          Decentralizing Community
        </p>

        <div className="mt-4 space-y-1">
          <p className="text-gray-200 text-sm font-medium tracking-wide animate-pulse duration-1000">
            Connecting to network...
          </p>
          <p className="text-gray-500 text-xs">
            Securing your node session
          </p>
        </div>
      </div>

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
        @keyframes mtaa-rotate { to { transform: rotate(360deg); } }
        @keyframes mtaa-pulse {
          0%, 100% { opacity: 0.35; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes mtaa-breathe {
          0%, 100% { opacity: 0.75; }
          50% { opacity: 1; }
        }
        .mtaa-ring { transform-origin: 200px 200px; animation: mtaa-rotate 2.4s linear infinite; }
        .mtaa-node { animation: mtaa-pulse 1.6s ease-in-out infinite; transform-origin: center; }
        .mtaa-node.n1 { animation-delay: 0s; }
        .mtaa-node.n2 { animation-delay: 0.2s; }
        .mtaa-node.n3 { animation-delay: 0.4s; }
        .mtaa-node.n4 { animation-delay: 0.6s; }
        .mtaa-glyph { animation: mtaa-breathe 1.6s ease-in-out infinite; transform-origin: 200px 200px; }
      `}</style>
    </div>
  );
};

export default AppLoading;