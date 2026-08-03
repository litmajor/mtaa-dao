import React, { useState, useEffect, useMemo } from 'react';

type Persona = 'yuki' | 'amara' | 'okedi' | 'default';

interface PageLoadingProps {
  message?: string;
  fullScreen?: boolean;
  persona?: Persona;
}

// Persona-flavored phrase pools.
const PHRASES: Record<Persona, string[]> = {
  yuki: [
    'Streaming order book...',
    'Checking spread...',
    'Syncing execution engine...',
    'Polling price feed...',
  ],
  amara: [
    'Reconciling positions...',
    'Calculating yield exposure...',
    'Aggregating pool balances...',
    'Syncing smart contracts...',
  ],
  okedi: [
    'Fetching chama ledger...',
    'Syncing member contributions...',
    'Checking treasury state...',
    'Assembling rotation schedule...',
  ],
  default: [
    'Fetching blockchain states...',
    'Syncing smart contracts...',
    'Querying decentralized ledger...',
    'Assembling dashboard nodes...',
  ],
};

// Rotation speed maps to persona: Yuki is fast/tight (trading tempo),
// Amara is slower/deliberate (analytical), Okedi/default sits in between.
const TEMPO_MS: Record<Persona, number> = {
  yuki: 1200,
  amara: 3600,
  okedi: 2400,
  default: 2400,
};

const RING_DURATION: Record<Persona, string> = {
  yuki: '1.2s',
  amara: '3.6s',
  okedi: '2.4s',
  default: '2.4s',
};

export const PageLoading: React.FC<PageLoadingProps> = ({
  message,
  fullScreen = false,
  persona = 'default',
}) => {
  const phrases = useMemo(() => PHRASES[persona], [persona]);
  const [currentMessage, setCurrentMessage] = useState(message || phrases[0]);

  useEffect(() => {
    if (message) return;
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % phrases.length;
      setCurrentMessage(phrases[index]);
    }, 2500);
    return () => clearInterval(interval);
  }, [message, phrases]);

  const ringDuration = RING_DURATION[persona];

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

        {/* Brand mark spinner: ring rotates at persona tempo, nodes pulse, glyph breathes */}
        <div className="relative w-16 h-16" style={{ ['--mtaa-ring-duration' as any]: ringDuration }}>
          <svg viewBox="0 0 400 400" className="w-full h-full" style={{ overflow: 'visible' }}>
            <g className="mtaa-ring">
              <circle cx="200" cy="200" r="150" fill="none" stroke="#FF6E16" strokeWidth="14" opacity="0.2" />
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

        <div className="space-y-1.5 min-h-[40px] flex flex-col justify-center">
          <p
            key={currentMessage}
            className="text-sm font-medium bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-300 tracking-wide animate-fade-in-out"
          >
            {currentMessage}
          </p>
          <p className="text-xs text-orange-500/60 tracking-widest uppercase font-semibold text-[10px]">
            Please wait
          </p>
        </div>
      </div>

      <style>{`
        @keyframes mtaa-rotate { to { transform: rotate(360deg); } }
        @keyframes mtaa-pulse {
          0%, 100% { opacity: 0.35; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes mtaa-breathe {
          0%, 100% { opacity: 0.75; }
          50% { opacity: 1; }
        }
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(4px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }
        .mtaa-ring {
          transform-origin: 200px 200px;
          animation: mtaa-rotate var(--mtaa-ring-duration, 2.4s) linear infinite;
        }
        .mtaa-node { animation: mtaa-pulse 1.6s ease-in-out infinite; transform-origin: center; }
        .mtaa-node.n1 { animation-delay: 0s; }
        .mtaa-node.n2 { animation-delay: 0.2s; }
        .mtaa-node.n3 { animation-delay: 0.4s; }
        .mtaa-node.n4 { animation-delay: 0.6s; }
        .mtaa-glyph { animation: mtaa-breathe 1.6s ease-in-out infinite; transform-origin: 200px 200px; }
        .animate-fade-in-out { animation: fadeInOut 2.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default PageLoading;