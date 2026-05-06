import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, TrendingUp, Users, Award, Calendar, Flame } from 'lucide-react';
import { authClient } from '@/utils/authClient';

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatar?: string;
  points: number;
  daysActive: number;
  rank: number;
  badges?: string[];
  contribution?: {
    votes: number;
    proposals: number;
    comments: number;
  };
}

export interface LeaderboardPageProps {
  daoId: string;
  daoName?: string;
  onUserSelect?: (userId: string) => void;
  timeframe?: 'week' | 'month' | 'alltime';
  limit?: number;
}

/**
 * LeaderboardPage - Display top contributors in a DAO
 *
 * Features:
 * - Rank-based leaderboard (1-10, 1-50, etc.)
 * - Time-based filtering (week, month, all-time)
 * - User details with avatar, name, points, days active
 * - Badges for achievements (Top 1, Top 5, etc.)
 * - Contribution breakdown (votes, proposals, comments)
 * - Trending indicators (up/down movement)
 * - Interactive user cards with profile links
 *
 * Used in:
 * - DAO governance page
 * - Activity dashboard
 * - Member rankings view
 */

export function LeaderboardPage({
  daoId,
  daoName = 'DAO',
  onUserSelect,
  timeframe = 'month',
  limit = 20,
}: LeaderboardPageProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'week' | 'month' | 'alltime'>(timeframe);
  const [selectedTab, setSelectedTab] = useState<'points' | 'activity' | 'growth'>('points');

  // Fetch leaderboard data
  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await authClient.get(
          `/api/governance/${daoId}/leaderboard?limit=${limit}&timeframe=${selectedTimeframe}`
        );

        const entriesWithRank = (data.leaderboard || []).map((entry: any, index: number) => ({
          ...entry,
          rank: index + 1,
        }));

        setLeaderboard(entriesWithRank);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
        setLeaderboard([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [daoId, selectedTimeframe, limit]);

  // Determine medal color by rank
  const getMedalColor = (rank: number): string => {
    if (rank === 1) return 'text-yellow-500'; // Gold
    if (rank === 2) return 'text-gray-400'; // Silver
    if (rank === 3) return 'text-amber-700'; // Bronze
    return 'text-slate-500';
  };

  const getMedalEmoji = (rank: number): string => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '·';
  };

  const getBadges = (rank: number): string[] => {
    const badges = [];
    if (rank === 1) badges.push('Top Contributor');
    if (rank <= 5) badges.push('Top 5');
    if (rank <= 10) badges.push('Top 10');
    return badges;
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-b-2 border-blue-500 rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="h-8 w-8 text-yellow-500" />
          <h1 className="text-4xl font-bold text-white">{daoName} Leaderboard</h1>
        </div>
        <p className="text-gray-400">Top contributors and community leaders</p>
      </div>

      {/* Controls */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Timeframe Filter */}
          <div className="flex gap-2">
            {(['week', 'month', 'alltime'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedTimeframe === tf
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
              >
                {tf === 'week' && 'This Week'}
                {tf === 'month' && 'This Month'}
                {tf === 'alltime' && 'All Time'}
              </button>
            ))}
          </div>

          {/* Tab Filter */}
          <div className="flex gap-2 ml-auto">
            {(['points', 'activity', 'growth'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedTab === tab
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
              >
                {tab === 'points' && 'Points'}
                {tab === 'activity' && 'Activity'}
                {tab === 'growth' && 'Growth'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="max-w-6xl mx-auto">
        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 text-red-300 mb-6">
            {error}
          </div>
        )}

        {leaderboard.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
            <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No leaderboard data available yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry) => (
              <div
                key={entry.userId}
                onClick={() => onUserSelect?.(entry.userId)}
                className="group bg-slate-800/40 border border-slate-700/50 hover:border-slate-600 rounded-lg p-4 transition-all hover:bg-slate-800/80 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className={`text-2xl font-bold w-12 text-center ${getMedalColor(entry.rank)}`}>
                    {getMedalEmoji(entry.rank)}
                    <div className="text-sm text-gray-400">#{entry.rank}</div>
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <div>
                        <h3 className="text-white font-semibold group-hover:text-blue-400 transition-colors">
                          {entry.displayName}
                        </h3>
                        <p className="text-xs text-gray-500">{entry.userId}</p>
                      </div>

                      {/* Badges */}
                      {getBadges(entry.rank).length > 0 && (
                        <div className="flex gap-1 ml-auto">
                          {getBadges(entry.rank).map((badge) => (
                            <span
                              key={badge}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-amber-900/30 border border-amber-700/50 rounded text-xs text-amber-300"
                            >
                              <Award className="h-3 w-3" />
                              {badge}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-1 text-gray-400">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span>{entry.points} points</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-400">
                        <Calendar className="h-4 w-4 text-blue-500" />
                        <span>{entry.daysActive} days active</span>
                      </div>
                      {entry.contribution && (
                        <div className="flex items-center gap-1 text-gray-400">
                          <Flame className="h-4 w-4 text-orange-500" />
                          <span>
                            {entry.contribution.votes} votes, {entry.contribution.proposals} proposals
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Points Display */}
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-400">{entry.points}</div>
                    <div className="text-xs text-gray-500">{(entry.points / entry.daysActive).toFixed(1)} pts/day</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="max-w-6xl mx-auto mt-8 text-center text-gray-500 text-sm">
        <p>Leaderboard updates every hour. Points decay over time to keep contributions fresh.</p>
      </div>
    </div>
  );
}

export default LeaderboardPage;
