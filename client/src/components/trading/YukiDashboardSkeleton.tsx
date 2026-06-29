import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const YukiDashboardSkeleton: React.FC = () => {
  return (
    <div className="w-full min-h-screen bg-[#0B0F19] p-4 space-y-4 text-slate-200 select-none">
      {/* Top Ticker Ribbon (CEX + DEX pairs) */}
      <div className="flex gap-4 overflow-hidden pb-2 border-b border-white/[0.05]">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-3 shrink-0 px-3 py-1 bg-white/[0.02] rounded-lg border border-white/[0.03]">
            <Skeleton className="h-4 w-12 bg-white/10" />
            <Skeleton className="h-4 w-16 bg-white/5" />
          </div>
        ))}
      </div>

      {/* Main Terminal Grid Split Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 h-[calc(100vh-80px)]">
        {/* Left Column: Order Book (Bids/Asks) */}
        <div className="xl:col-span-1 rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 flex flex-col justify-between">
          <div className="space-y-3">
            <Skeleton className="h-5 w-28 bg-white/10" />
            <div className="space-y-1"> {/* Red Asks */}
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-between"><Skeleton className="h-3 w-16 bg-red-500/10" /><Skeleton className="h-3 w-12 bg-white/5" /></div>
              ))}
            </div>
            <Skeleton className="h-6 w-24 bg-white/10 my-2 self-center mx-auto" /> {/* Mid Market Price */}
            <div className="space-y-1"> {/* Green Bids */}
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-between"><Skeleton className="h-3 w-16 bg-emerald-500/10" /><Skeleton className="h-3 w-12 bg-white/5" /></div>
              ))}
            </div>
          </div>
        </div>

        {/* Middle Area: Core Chart & Arbitrage Monitor */}
        <div className="xl:col-span-2 flex flex-col gap-4 h-full">
          {/* Main Candlestick Chart Placeholder */}
          <div className="flex-1 rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <Skeleton className="h-6 w-48 bg-white/10" />
              <Skeleton className="h-8 w-32 bg-white/5" />
            </div>
            {/* Simulation of a chart baseline wireframe */}
            <div className="w-full h-2/3 flex items-end gap-2 px-2 opacity-30">
              {[40, 15, 60, 23, 50, 30, 80, 45, 90, 65, 40, 85].map((height, i) => (
                <Skeleton key={i} className="w-full bg-white/10" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>

          {/* Bottom Area: Arbitrage/Smart Routing Module */}
          <div className="h-48 rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 space-y-3">
            <Skeleton className="h-5 w-44 bg-white/10" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-20 bg-white/5 rounded-lg border border-orange-500/10" />
              <Skeleton className="h-20 bg-white/5 rounded-lg" />
              <Skeleton className="h-20 bg-white/5 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Right Column: Execution Terminal (Buy/Sell Input Panels) */}
        <div className="xl:col-span-1 rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-9 bg-white/10 rounded-lg" />
              <Skeleton className="h-9 bg-white/5 rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-12 bg-white/5" />
              <Skeleton className="h-10 w-full bg-white/5 rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16 bg-white/5" />
              <Skeleton className="h-10 w-full bg-white/5 rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-12 w-full bg-orange-500/20 rounded-xl mt-4" /> {/* Big Action Button */}
        </div>

      </div>
    </div>
  );
};

export default YukiDashboardSkeleton;

