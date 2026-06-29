import React from 'react';
import Skeleton from './skeleton';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="w-full space-y-6 p-6 bg-[#0B0F19] min-h-screen animate-pulse">
      {/* Dashboard Top Header Bar Placeholder */}
      <div className="flex justify-between items-center pb-6 border-b border-white/[0.05]">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48 bg-white/10 rounded-md" />
          <Skeleton className="h-4 w-32 bg-white/5 rounded-md" />
        </div>
        <Skeleton className="h-10 w-36 bg-white/10 rounded-xl" /> {/* Wallet/Profile Placeholder */}
      </div>

      {/* DAO Metrics Grid (3 Column Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-6 rounded-2xl border border-white/[0.05] bg-white/[0.02] space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-24 bg-white/5 rounded" />
              <Skeleton className="h-5 w-5 bg-orange-500/20 rounded-full" />
            </div>
            <Skeleton className="h-8 w-36 bg-white/10 rounded-md" />
            <Skeleton className="h-3 w-20 bg-white/5 rounded" />
          </div>
        ))}
      </div>

      {/* Main Content Area: Split Proposals & Activity Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Large Governance Proposals List Placeholder */}
        <div className="lg:col-span-2 p-6 rounded-2xl border border-white/[0.05] bg-white/[0.02] space-y-6">
          <Skeleton className="h-5 w-40 bg-white/10 rounded-md mb-2" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 rounded-xl bg-white/[0.01] border border-white/[0.02] flex items-center justify-between">
              <div className="space-y-2 w-2/3">
                <Skeleton className="h-4 w-full bg-white/10 rounded" />
                <Skeleton className="h-3 w-1/2 bg-white/5 rounded" />
              </div>
              <Skeleton className="h-7 w-20 bg-white/10 rounded-full" />
            </div>
          ))}
        </div>

        {/* Right Side: Small Recent Activity Placeholder */}
        <div className="p-6 rounded-2xl border border-white/[0.05] bg-white/[0.02] space-y-4">
          <Skeleton className="h-5 w-32 bg-white/10 rounded-md" />
          {[1, 2, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 bg-white/5 rounded-full shrink-0" />
              <div className="space-y-1.5 w-full">
                <Skeleton className="h-3 w-3/4 bg-white/10 rounded" />
                <Skeleton className="h-2 w-1/4 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default DashboardSkeleton;
