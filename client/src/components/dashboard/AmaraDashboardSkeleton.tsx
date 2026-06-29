import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function AmaraDashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-full">
      {/* 1. Portfolio ROI Card Skeleton */}
      <div className="rounded-xl p-6 bg-gradient-to-r from-green-800/20 to-green-900/25 border border-green-500/10 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-green-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between mb-4 relative z-10">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 bg-green-500/10" />
            <Skeleton className="h-10 w-48 bg-white/10" />
          </div>
          <div className="space-y-2 flex flex-col items-end">
            <Skeleton className="h-4 w-16 bg-green-500/10" />
            <Skeleton className="h-9 w-20 bg-white/10" />
          </div>
        </div>
        <Skeleton className="h-3 w-36 bg-green-500/10 relative z-10" />
      </div>

      {/* 2. Yield Opportunities Panel Skeleton */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/40">
        <Skeleton className="h-5 w-32 bg-white/10 mb-5" />

        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-slate-700/30 rounded-lg p-4 border border-white/[0.02] space-y-3">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-1/3 bg-white/10" />
                <Skeleton className="h-4 w-16 bg-white/10" />
              </div>
              <Skeleton className="h-3 w-3/4 bg-white/5" />
              <div className="pt-1">
                <Skeleton className="h-5 w-16 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Governance/Market Alerts Skeleton */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/40">
        <Skeleton className="h-5 w-40 bg-white/10 mb-4" />
        <div className="space-y-2">
          <Skeleton className="h-11 w-full bg-slate-700/40 rounded-lg" />
          <Skeleton className="h-11 w-full bg-slate-700/40 rounded-lg" />
        </div>
      </div>

      {/* 4. Power Tools Quick Action Grid Skeleton */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/40">
        <Skeleton className="h-5 w-28 bg-white/10 mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full bg-slate-700/40 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default AmaraDashboardSkeleton;
