import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Trophy, 
  Crown, 
  Vote, 
  Target, 
  DollarSign,
  Zap,
  Star,
  TrendingUp
} from 'lucide-react';

type Contributor = {
  address: string;
  proposalCount: number;
  voteCount: number;
  totalFunding: number;
  reputation: number;
  referredBy?: string;
};

import { useContributors } from '@/pages/hooks/useContributors';

export function ContributorList() {
  const { data, isLoading } = useContributors();
  const contributors = data?.contributors || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full"></div>
        <span className="ml-3 text-purple-300">Loading champions...</span>
      </div>
    );
  }

  const getStreakBonus = (contributor: Contributor) => {
    if (contributor.reputation > 2000) return { multiplier: '🔥', label: 'On Fire!', color: 'text-orange-400' };
    if (contributor.reputation > 1500) return { multiplier: '⚡', label: 'Hot Streak', color: 'text-yellow-400' };
    if (contributor.reputation > 1000) return { multiplier: '📈', label: 'Rising', color: 'text-green-400' };
    return null;
  };

  const getTierBadge = (rank: number, reputation: number) => {
    if (rank === 1) return { tier: 'LEGEND', color: 'bg-gradient-to-r from-yellow-400 to-orange-500', textColor: 'text-white' };
    if (rank <= 3) return { tier: 'CHAMPION', color: 'bg-gradient-to-r from-purple-500 to-pink-500', textColor: 'text-white' };
    if (reputation > 1000) return { tier: 'HERO', color: 'bg-gradient-to-r from-blue-500 to-indigo-600', textColor: 'text-white' };
    if (reputation > 500) return { tier: 'WARRIOR', color: 'bg-gradient-to-r from-green-500 to-teal-500', textColor: 'text-white' };
    return { tier: 'RISING', color: 'bg-gradient-to-r from-gray-400 to-gray-600', textColor: 'text-white' };
  };

  return (
    <Card className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white border-purple-500/20 shadow-2xl">
      <CardHeader className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-b border-purple-500/20">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl shadow-lg">
            <Trophy className="w-6 h-6 text-white drop-shadow-lg" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              Governance Champions
            </h3>
            <p className="text-sm text-gray-300 flex items-center gap-2">
              <span>Top contributors this season</span>
              <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                Live
              </Badge>
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Total Players</div>
            <div className="text-2xl font-bold text-purple-300">{contributors.length}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {contributors.map((contributor: Contributor, index: number) => {
          const rank = index + 1;
          const isTop3 = rank <= 3;
          const rankIcon = rank === 1 ? '🏆' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
          const streakBonus = getStreakBonus(contributor);
          const tierInfo = getTierBadge(rank, contributor.reputation);
          
          return (
            <div 
              key={contributor.address} 
              className={`relative p-4 border-b border-purple-500/10 hover:bg-purple-500/5 transition-all duration-300 group cursor-pointer ${
                isTop3 ? 'bg-gradient-to-r from-yellow-500/5 via-purple-500/5 to-pink-500/5' : ''
              }`}
            >
              {/* Glow effect for top 3 */}
              {isTop3 && (
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-purple-500/10 blur-sm"></div>
              )}
              
              <div className="relative flex items-center gap-4">
                {/* Rank */}
                <div className="flex flex-col items-center w-14">
                  <div className="text-3xl font-bold mb-1">
                    {typeof rankIcon === 'string' && rankIcon.startsWith('#') ? (
                      <span className="text-xl text-gray-400 font-mono">{rankIcon}</span>
                    ) : (
                      <span className="drop-shadow-lg">{rankIcon}</span>
                    )}
                  </div>
                  <Badge className={`${tierInfo.color} ${tierInfo.textColor} text-[10px] px-2 py-0.5 font-bold`}>
                    {tierInfo.tier}
                  </Badge>
                </div>
                
                {/* Avatar */}
                <div className="relative">
                  <Avatar className={`w-14 h-14 border-2 ${isTop3 ? 'border-yellow-400/50 shadow-lg shadow-yellow-400/25' : 'border-purple-400/30'}`}>
                    <AvatarFallback className="bg-gradient-to-br from-purple-600 to-pink-600 text-white font-bold text-lg">
                      {contributor.address.slice(2, 4).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {isTop3 && <Crown className="absolute -top-1 -right-1 w-5 h-5 text-yellow-400 drop-shadow-lg" />}
                  {streakBonus && (
                    <div className="absolute -bottom-1 -right-1 text-lg">
                      {streakBonus.multiplier}
                    </div>
                  )}
                </div>
                
                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-semibold text-white truncate">
                      {contributor.address.slice(0, 6)}...{contributor.address.slice(-4)}
                    </span>
                    {streakBonus && (
                      <Badge className={`${streakBonus.color} bg-transparent border-0 text-xs px-0`}>
                        {streakBonus.label}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Stats Row */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-blue-300">
                      <Vote className="w-3 h-3" />
                      <span className="font-medium">{contributor.voteCount}</span>
                      <span className="text-xs text-gray-400">votes</span>
                    </div>
                    <div className="flex items-center gap-1 text-green-300">
                      <Target className="w-3 h-3" />
                      <span className="font-medium">{contributor.proposalCount}</span>
                      <span className="text-xs text-gray-400">proposals</span>
                    </div>
                    <div className="flex items-center gap-1 text-yellow-300">
                      <DollarSign className="w-3 h-3" />
                      <span className="font-medium">{contributor.totalFunding.toLocaleString()}</span>
                      <span className="text-xs text-gray-400">cUSD</span>
                    </div>
                  </div>

                  {/* Referral Info */}
                  {contributor.referredBy && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                      <Star className="w-3 h-3" />
                      <span>Recruited by {contributor.referredBy.slice(0, 6)}</span>
                    </div>
                  )}
                </div>
                
                {/* Reputation Score */}
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end mb-1">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <div className="text-2xl font-bold text-yellow-400">
                      {contributor.reputation.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 flex items-center justify-end gap-1">
                    <span>XP</span>
                    <TrendingUp className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {/* Progress Bar for Next Tier */}
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="text-gray-400 min-w-0">Next tier:</span>
                <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                    style={{ 
                      width: `${Math.min(100, (contributor.reputation % 1000) / 10)}%` 
                    }}
                  ></div>
                </div>
                <span className="text-gray-400 min-w-0">
                  {1000 - (contributor.reputation % 1000)} XP
                </span>
              </div>
            </div>
          );
        })}

        {/* Footer Stats */}
        <div className="p-4 bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-t border-purple-500/20">
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div className="text-lg font-bold text-purple-300">
                {contributors.reduce((sum: number, c: Contributor) => sum + c.proposalCount, 0)}
              </div>
              <div className="text-xs text-gray-400">Total Proposals</div>
            </div>
            <div>
              <div className="text-lg font-bold text-blue-300">
                {contributors.reduce((sum: number, c: Contributor) => sum + c.voteCount, 0)}
              </div>
              <div className="text-xs text-gray-400">Total Votes</div>
            </div>
            <div>
              <div className="text-lg font-bold text-yellow-300">
                {contributors.reduce((sum: number, c: Contributor) => sum + c.totalFunding, 0).toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">Total Funding</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}