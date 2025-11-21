import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useToast } from '../components/ui/use-toast';
import {
  Award,
  Trophy,
  Zap,
  Star,
  Lock,
  Unlock,
  Gift,
  TrendingUp,
  Share2,
  Clock
} from 'lucide-react';

interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legendary';
  icon: string;
  badgeColor: string;
  rewardPoints: number;
  rewardTokens: string;
  nftMintable: boolean;
  nftRarity?: string;
}

interface UserAchievementProgress {
  id: string;
  achievement: Achievement;
  status: 'locked' | 'unlocked' | 'claimed' | 'nft_minted';
  progressValue: string;
  progressPercent: number;
  unlockedAt?: string;
  claimedAt?: string;
  nftMintedAt?: string;
  nftTokenId?: string;
}

interface UserStats {
  totalUnlocked: number;
  totalClaimed: number;
  totalNFTMinted: number;
  completionRate: number;
}

interface Badge {
  id: string;
  name: string;
  description?: string;
  icon: string;
  badgeColor: string;
  unlockedAt: string;
  isEquipped: boolean;
}

interface Leaderboard {
  userId: string;
  userName: string;
  totalAchievements: number;
  unlockedAchievements: number;
  totalRewardPoints: number;
  tier: string;
  rank: number;
  percentile: number;
}

const TIER_COLORS: { [key: string]: string } = {
  bronze: 'from-amber-500 to-amber-600',
  silver: 'from-slate-400 to-slate-500',
  gold: 'from-yellow-400 to-yellow-500',
  platinum: 'from-cyan-400 to-cyan-500',
  diamond: 'from-blue-400 to-blue-500',
  legendary: 'from-purple-500 to-pink-500'
};

const TIER_ICONS: { [key: string]: string } = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '👑',
  diamond: '💎',
  legendary: '⭐'
};

export default function AchievementSystemPage() {
  const { toast } = useToast();
  const [achievements, setAchievements] = useState<UserAchievementProgress[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<Leaderboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingRewardId, setClaimingRewardId] = useState<string | null>(null);
  const [mintingNFTId, setMintingNFTId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked' | 'claimed'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch user progress
      const progressRes = await fetch('/api/achievements/user/progress');
      if (progressRes.ok) {
        const data = await progressRes.json();
        setAchievements(data.progress || []);
        setStats(data.stats);
      }

      // Fetch badges
      const badgesRes = await fetch('/api/achievements/user/badges');
      if (badgesRes.ok) {
        const data = await badgesRes.json();
        setBadges(data.badges || []);
      }

      // Fetch leaderboard
      const leaderboardRes = await fetch('/api/achievements/leaderboard?limit=10');
      if (leaderboardRes.ok) {
        const data = await leaderboardRes.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load achievement data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClaimReward = async (achievementId: string) => {
    try {
      setClaimingRewardId(achievementId);
      
      const response = await fetch(`/api/achievements/${achievementId}/claim`, {
        method: 'POST'
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Reward claimed successfully!'
        });
        fetchData();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to claim reward',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to claim reward',
        variant: 'destructive'
      });
    } finally {
      setClaimingRewardId(null);
    }
  };

  const handleMintNFT = async (achievementId: string) => {
    try {
      setMintingNFTId(achievementId);
      
      const walletAddress = localStorage.getItem('walletAddress');
      if (!walletAddress) {
        toast({
          title: 'Error',
          description: 'Please connect your wallet first',
          variant: 'destructive'
        });
        return;
      }

      const response = await fetch(`/api/achievements/${achievementId}/mint-nft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Success',
          description: `NFT minted! Token ID: ${data.nft.tokenId}`
        });
        fetchData();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to mint NFT',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to mint NFT',
        variant: 'destructive'
      });
    } finally {
      setMintingNFTId(null);
    }
  };

  const filteredAchievements = achievements.filter((a) => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (selectedCategory && a.achievement?.category !== selectedCategory) return false;
    return true;
  });

  const categories = [...new Set(achievements.map(a => a.achievement?.category).filter(Boolean))];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'locked':
        return <Lock className="w-4 h-4" />;
      case 'unlocked':
        return <Unlock className="w-4 h-4" />;
      case 'claimed':
        return <Gift className="w-4 h-4" />;
      case 'nft_minted':
        return <Trophy className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'locked':
        return 'bg-gray-100 text-gray-700';
      case 'unlocked':
        return 'bg-blue-100 text-blue-700';
      case 'claimed':
        return 'bg-green-100 text-green-700';
      case 'nft_minted':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Trophy className="w-16 h-16 text-purple-500 mx-auto mb-4 animate-bounce" />
          <p>Loading achievements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Achievement System
          </h1>
          <p className="text-gray-600">Unlock badges, earn rewards, and climb the leaderboard</p>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Achievements Unlocked</p>
                    <p className="text-3xl font-bold text-purple-600">{stats.totalUnlocked}</p>
                  </div>
                  <Trophy className="w-10 h-10 text-purple-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Rewards Claimed</p>
                    <p className="text-3xl font-bold text-green-600">{stats.totalClaimed}</p>
                  </div>
                  <Gift className="w-10 h-10 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">NFTs Minted</p>
                    <p className="text-3xl font-bold text-pink-600">{stats.totalNFTMinted}</p>
                  </div>
                  <Star className="w-10 h-10 text-pink-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Completion Rate</p>
                    <p className="text-3xl font-bold text-blue-600">{stats.completionRate.toFixed(0)}%</p>
                  </div>
                  <TrendingUp className="w-10 h-10 text-blue-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="achievements" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="achievements">🏆 Achievements</TabsTrigger>
            <TabsTrigger value="badges">⭐ Badges</TabsTrigger>
            <TabsTrigger value="leaderboard">📊 Leaderboard</TabsTrigger>
          </TabsList>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="space-y-6">
            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                onClick={() => setFilter('all')}
                size="sm"
              >
                All
              </Button>
              <Button
                variant={filter === 'unlocked' ? 'default' : 'outline'}
                onClick={() => setFilter('unlocked')}
                size="sm"
              >
                Unlocked
              </Button>
              <Button
                variant={filter === 'locked' ? 'default' : 'outline'}
                onClick={() => setFilter('locked')}
                size="sm"
              >
                Locked
              </Button>
              <Button
                variant={filter === 'claimed' ? 'default' : 'outline'}
                onClick={() => setFilter('claimed')}
                size="sm"
              >
                Claimed
              </Button>

              {categories.length > 0 && (
                <>
                  <div className="w-full" />
                  <label htmlFor="category-select" className="sr-only">
                    Filter by category
                  </label>
                  <select
                    id="category-select"
                    className="px-3 py-1 border rounded-md text-sm"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </>
              )}
            </div>

            {/* Achievements Grid */}
            {filteredAchievements.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAchievements.map((item) => {
                  const achievement = item.achievement;
                  const isUnlocked = item.status !== 'locked';
                  
                  return (
                    <Card
                      key={item.id}
                      className={`overflow-hidden hover:shadow-xl transition-all ${
                        isUnlocked ? 'border-purple-300 bg-gradient-to-br from-purple-50 to-blue-50' : 'opacity-60'
                      }`}
                    >
                      {/* Header with Icon */}
                      <div
                        className={`h-24 bg-gradient-to-r ${TIER_COLORS[achievement?.tier || 'bronze']} p-6 flex items-center justify-between text-white`}
                      >
                        <div className="text-4xl">{achievement?.icon || '🏆'}</div>
                        <Badge variant="secondary" className="text-xs">
                          {TIER_ICONS[achievement?.tier || 'bronze']} {achievement?.tier}
                        </Badge>
                      </div>

                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{achievement?.name}</CardTitle>
                            <CardDescription className="text-xs">
                              {achievement?.category}
                            </CardDescription>
                          </div>
                          <div className={`p-2 rounded-full ${getStatusColor(item.status)}`}>
                            {getStatusIcon(item.status)}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <p className="text-sm text-gray-600">{achievement?.description}</p>

                        {/* Progress Bar */}
                        {item.progressPercent < 100 && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs text-gray-600">
                              <span>Progress</span>
                              <span>{item.progressPercent}%</span>
                            </div>
                            <Progress value={item.progressPercent} />
                          </div>
                        )}

                        {/* Rewards */}
                        <div className="flex gap-3 text-sm">
                          <div className="flex items-center gap-1">
                            <Zap className="w-4 h-4 text-yellow-500" />
                            <span>{achievement?.rewardPoints} points</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Award className="w-4 h-4 text-green-500" />
                            <span>{achievement?.rewardTokens} tokens</span>
                          </div>
                        </div>

                        {/* Status Timeline */}
                        <div className="space-y-2 text-xs text-gray-500">
                          {item.unlockedAt && (
                            <div className="flex items-center gap-2">
                              <Unlock className="w-3 h-3" />
                              Unlocked {new Date(item.unlockedAt).toLocaleDateString()}
                            </div>
                          )}
                          {item.claimedAt && (
                            <div className="flex items-center gap-2">
                              <Gift className="w-3 h-3" />
                              Claimed {new Date(item.claimedAt).toLocaleDateString()}
                            </div>
                          )}
                          {item.nftMintedAt && (
                            <div className="flex items-center gap-2">
                              <Trophy className="w-3 h-3" />
                              NFT: #{item.nftTokenId}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-4">
                          {item.status === 'unlocked' && (
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => handleClaimReward(achievement?.id || '')}
                              disabled={claimingRewardId === achievement?.id}
                            >
                              {claimingRewardId === achievement?.id ? 'Claiming...' : 'Claim Reward'}
                            </Button>
                          )}

                          {item.status === 'claimed' && achievement?.nftMintable && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => handleMintNFT(achievement.id)}
                              disabled={mintingNFTId === achievement?.id}
                            >
                              {mintingNFTId === achievement?.id ? 'Minting...' : 'Mint NFT'}
                            </Button>
                          )}

                          {isUnlocked && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="flex-1"
                            >
                              <Share2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-12 text-center">
                  <Lock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No achievements found with current filters</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Badges Tab */}
          <TabsContent value="badges" className="space-y-6">
            {badges.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {badges.map((badge) => (
                  <Card
                    key={badge.id}
                    className={badge.isEquipped ? 'border-yellow-400 border-2' : ''}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="text-4xl">{badge.icon}</div>
                        {badge.isEquipped && (
                          <Badge className="bg-yellow-400 text-yellow-900">Equipped</Badge>
                        )}
                      </div>
                      <CardTitle className="mt-4">{badge.name}</CardTitle>
                      <CardDescription>{badge.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-gray-500">
                        Unlocked {new Date(badge.unlockedAt).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-12 text-center">
                  <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No badges yet. Unlock more achievements to earn badges!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="space-y-6">
            {leaderboard.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Top Achievers</CardTitle>
                  <CardDescription>Global achievement rankings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {leaderboard.map((user, index) => (
                      <div
                        key={user.userId}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold text-gray-400 w-8">
                            {user.rank}
                          </div>
                          <div>
                            <p className="font-semibold">{user.userName}</p>
                            <p className="text-xs text-gray-600">
                              Tier: {TIER_ICONS[user.tier]} {user.tier}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-purple-600">{user.totalAchievements}</p>
                          <p className="text-xs text-gray-600">{user.totalRewardPoints} points</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-12 text-center">
                  <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No leaderboard data available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
