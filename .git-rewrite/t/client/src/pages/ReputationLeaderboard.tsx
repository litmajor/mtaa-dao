import React, { useState, useEffect } from "react";
import { Trophy, Star, Medal, Crown, Gem } from "lucide-react";

interface LeaderboardEntry {
  userId: string;
  firstName: string;
  lastName: string;
  totalPoints: number;
  badge: string;
  level: number;
  profileImageUrl?: string;
}

const getBadgeIcon = (badge: string) => {
  switch (badge) {
    case 'Diamond': return <Gem className="w-4 h-4" />;
    case 'Platinum': return <Crown className="w-4 h-4" />;
    case 'Gold': return <Trophy className="w-4 h-4" />;
    case 'Silver': return <Medal className="w-4 h-4" />;
    default: return <Star className="w-4 h-4" />;
  }
};

const getBadgeColor = (badge: string) => {
  switch (badge) {
    case 'Diamond': return 'bg-purple-100 text-purple-700';
    case 'Platinum': return 'bg-gray-100 text-gray-700';
    case 'Gold': return 'bg-yellow-100 text-yellow-700';
    case 'Silver': return 'bg-blue-100 text-blue-700';
    default: return 'bg-orange-100 text-orange-700';
  }
};

export default function ReputationLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userReputation, setUserReputation] = useState<any>(null);

  useEffect(() => {
    fetchLeaderboard();
    fetchUserReputation();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('/api/reputation/leaderboard?limit=10');
      const data = await response.json();
      setLeaderboard(data.leaderboard);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserReputation = async () => {
    try {
      const response = await fetch('/api/reputation/user/me');
      if (response.ok) {
        const data = await response.json();
        setUserReputation(data);
      }
    } catch (error) {
      console.error('Error fetching user reputation:', error);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="flex items-center gap-3 mb-8">
        <Trophy className="w-8 h-8 text-yellow-500" />
        <h1 className="text-3xl font-bold">MsiaMo Reputation Leaderboard</h1>
      </div>

      {/* User's Current Reputation */}
      {userReputation && (
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg p-6 mb-8 text-white">
          <h2 className="text-xl font-bold mb-4">Your Reputation</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{userReputation.totalPoints}</div>
              <div className="text-sm opacity-90">Total Points</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                {getBadgeIcon(userReputation.badge)}
                <span className="text-lg font-bold">{userReputation.badge}</span>
              </div>
              <div className="text-sm opacity-90">Badge</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{userReputation.level}</div>
              <div className="text-sm opacity-90">Level</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{userReputation.weeklyPoints}</div>
              <div className="text-sm opacity-90">This Week</div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Progress to Level {userReputation.level + 1}</span>
              <span>{userReputation.totalPoints % 100}/100</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div 
                className="bg-white rounded-full h-2" 
                style={{ width: `${(userReputation.totalPoints % 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-4 px-6 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="py-4 px-6 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="py-4 px-6 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Points
                </th>
                <th className="py-4 px-6 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Badge
                </th>
                <th className="py-4 px-6 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Level
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaderboard.map((entry, index) => (
                <tr key={entry.userId} className="hover:bg-gray-50">
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className="flex items-center">
                      {index < 3 && (
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
                          index === 0 ? 'bg-yellow-400' : 
                          index === 1 ? 'bg-gray-300' : 'bg-orange-400'
                        }`}>
                          <span className="text-white font-bold text-xs">{index + 1}</span>
                        </div>
                      )}
                      {index >= 3 && (
                        <span className="font-bold text-gray-600 mr-8">{index + 1}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {entry.profileImageUrl ? (
                          <img 
                            className="h-10 w-10 rounded-full" 
                            src={entry.profileImageUrl} 
                            alt="" 
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center">
                            <span className="text-white font-bold">
                              {entry.firstName?.charAt(0) || 'U'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {entry.firstName} {entry.lastName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">
                      {entry.totalPoints.toLocaleString()}
                    </div>
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getBadgeColor(entry.badge)}`}>
                      {getBadgeIcon(entry.badge)}
                      {entry.badge}
                    </div>
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {entry.level}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* How to Earn Points */}
      <div className="mt-12 bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-4 text-blue-900">How to Earn MsiaMo Points</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Vote on proposals</span>
              <span className="font-bold text-blue-600">+5 points</span>
            </div>
            <div className="flex justify-between">
              <span>Create a proposal</span>
              <span className="font-bold text-blue-600">+25 points</span>
            </div>
            <div className="flex justify-between">
              <span>Contribute to DAO</span>
              <span className="font-bold text-blue-600">+10+ points</span>
            </div>
            <div className="flex justify-between">
              <span>Complete tasks</span>
              <span className="font-bold text-blue-600">+30 points</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Refer new users</span>
              <span className="font-bold text-blue-600">+20 points</span>
            </div>
            <div className="flex justify-between">
              <span>Join a DAO</span>
              <span className="font-bold text-blue-600">+15 points</span>
            </div>
            <div className="flex justify-between">
              <span>Daily activity streak</span>
              <span className="font-bold text-blue-600">+5 points</span>
            </div>
            <div className="flex justify-between">
              <span>Monthly streak bonus</span>
              <span className="font-bold text-blue-600">+100 points</span>
            </div>
          </div>
        </div>
        <div className="mt-4 p-4 bg-blue-100 rounded-lg">
          <p className="text-blue-800 text-sm">
            <strong>💡 Pro Tip:</strong> Higher reputation scores will qualify you for bigger airdrops when we launch our token! 
            Keep engaging and building your MsiaMo reputation.
          </p>
        </div>
      </div>
    </div>
  );
}
