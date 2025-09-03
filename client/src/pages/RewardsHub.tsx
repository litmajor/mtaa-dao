
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from '../components/ui/use-toast';

interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  rewardPoints: number;
  rewardTokens: string;
  badge: string;
  icon: string;
  rarity: string;
  isCompleted?: boolean;
  unlockedAt?: string;
}

interface AirdropEligibility {
  id: string;
  airdropId: string;
  eligibleAmount: string;
  claimed: boolean;
  claimedAt?: string;
}

interface VestingOverview {
  overview: {
    totalAllocated: number;
    totalVested: number;
    totalClaimed: number;
    totalClaimable: number;
    vestingPercentage: number;
  };
  schedules: any[];
}

export default function RewardsHub() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [airdrops, setAirdrops] = useState<AirdropEligibility[]>([]);
  const [vesting, setVesting] = useState<VestingOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRewardsData();
  }, []);

  const fetchRewardsData = async () => {
    try {
      setLoading(true);
      
      // Fetch achievements
      const achievementsRes = await fetch('/api/reputation/achievements/user/me');
      if (achievementsRes.ok) {
        const achievementsData = await achievementsRes.json();
        setAchievements(achievementsData.achievements);
      }

      // Fetch airdrops
      const airdropsRes = await fetch('/api/reputation/airdrops/eligible');
      if (airdropsRes.ok) {
        const airdropsData = await airdropsRes.json();
        setAirdrops(airdropsData.airdrops);
      }

      // Fetch vesting
      const vestingRes = await fetch('/api/reputation/vesting/overview');
      if (vestingRes.ok) {
        const vestingData = await vestingRes.json();
        setVesting(vestingData);
      }
    } catch (error) {
      console.error('Error fetching rewards data:', error);
      toast({
        title: "Error",
        description: "Failed to load rewards data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const claimAchievementReward = async (achievementId: string) => {
    try {
      const response = await fetch(`/api/reputation/achievements/claim/${achievementId}`, {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Achievement reward claimed!",
        });
        fetchRewardsData();
      } else {
        throw new Error('Failed to claim reward');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to claim achievement reward",
        variant: "destructive",
      });
    }
  };

  const claimAirdrop = async (airdropId: string) => {
    try {
      const response = await fetch(`/api/reputation/airdrops/claim/${airdropId}`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Airdrop Claimed!",
          description: `Transaction: ${data.transactionHash.slice(0, 10)}...`,
        });
        fetchRewardsData();
      } else {
        throw new Error('Failed to claim airdrop');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to claim airdrop",
        variant: "destructive",
      });
    }
  };

  const claimVestedTokens = async (scheduleId: string) => {
    try {
      const response = await fetch(`/api/reputation/vesting/claim/${scheduleId}`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Tokens Claimed!",
          description: `Transaction: ${data.transactionHash.slice(0, 10)}...`,
        });
        fetchRewardsData();
      } else {
        throw new Error('Failed to claim tokens');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to claim vested tokens",
        variant: "destructive",
      });
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'epic': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'rare': return 'bg-blue-100 text-blue-700 border-blue-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">🎁 Rewards Hub</h1>
        <p className="text-gray-600">Manage your achievements, airdrops, and token vesting</p>
      </div>

      <Tabs defaultValue="achievements" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="achievements">🏆 Achievements</TabsTrigger>
          <TabsTrigger value="airdrops">🎁 Airdrops</TabsTrigger>
          <TabsTrigger value="vesting">⏰ Token Vesting</TabsTrigger>
        </TabsList>

        <TabsContent value="achievements" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {achievements.map((achievement) => (
              <Card key={achievement.id} className="border-2 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="text-3xl">{achievement.icon}</div>
                    <Badge className={getRarityColor(achievement.rarity)}>
                      {achievement.rarity}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg">{achievement.name}</CardTitle>
                  <CardDescription>{achievement.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Reward Points:</span>
                      <span className="font-bold text-blue-600">+{achievement.rewardPoints}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Reward Tokens:</span>
                      <span className="font-bold text-green-600">{achievement.rewardTokens} cUSD</span>
                    </div>
                    {achievement.isCompleted ? (
                      <div className="space-y-2">
                        <Badge variant="outline" className="bg-green-100 text-green-700">
                          ✅ Unlocked
                        </Badge>
                        <Button 
                          size="sm" 
                          className="w-full"
                          onClick={() => claimAchievementReward(achievement.id)}
                        >
                          Claim Reward
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="outline" className="bg-gray-100 text-gray-600">
                        🔒 Locked
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="airdrops" className="space-y-6">
          <div className="grid gap-6">
            {airdrops.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="text-6xl mb-4">🎁</div>
                  <h3 className="text-xl font-semibold mb-2">No Airdrops Available</h3>
                  <p className="text-gray-600">Keep building your reputation to qualify for future airdrops!</p>
                </CardContent>
              </Card>
            ) : (
              airdrops.map((airdrop) => (
                <Card key={airdrop.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      🎁 Airdrop Reward
                      {airdrop.claimed && <Badge variant="outline" className="bg-green-100 text-green-700">Claimed</Badge>}
                    </CardTitle>
                    <CardDescription>
                      Token reward based on your reputation score
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-lg">Reward Amount:</span>
                        <span className="text-2xl font-bold text-green-600">
                          {parseFloat(airdrop.eligibleAmount).toFixed(2)} cUSD
                        </span>
                      </div>
                      {!airdrop.claimed ? (
                        <Button 
                          className="w-full" 
                          onClick={() => claimAirdrop(airdrop.airdropId)}
                        >
                          Claim Airdrop
                        </Button>
                      ) : (
                        <div className="text-center text-gray-600">
                          Claimed on {new Date(airdrop.claimedAt!).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="vesting" className="space-y-6">
          {vesting ? (
            <>
              {/* Vesting Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>⏰ Token Vesting Overview</CardTitle>
                  <CardDescription>Your token allocation and vesting progress</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {vesting.overview.totalAllocated.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-600">Total Allocated</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {vesting.overview.totalVested.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-600">Total Vested</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {vesting.overview.totalClaimed.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-600">Total Claimed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {vesting.overview.totalClaimable.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-600">Available to Claim</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Vesting Progress</span>
                      <span>{vesting.overview.vestingPercentage.toFixed(1)}%</span>
                    </div>
                    <Progress value={vesting.overview.vestingPercentage} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* Individual Vesting Schedules */}
              <div className="grid gap-4">
                {vesting.schedules.map((schedule) => (
                  <Card key={schedule.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{schedule.reason || 'Token Vesting'}</span>
                        <Badge variant="outline">{schedule.type}</Badge>
                      </CardTitle>
                      <CardDescription>
                        {new Date(schedule.startDate).toLocaleDateString()} - {new Date(schedule.endDate).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Allocated:</span>
                            <span className="ml-2 font-semibold">{schedule.allocated.toFixed(2)} cUSD</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Vested:</span>
                            <span className="ml-2 font-semibold">{schedule.vested.toFixed(2)} cUSD</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Claimed:</span>
                            <span className="ml-2 font-semibold">{schedule.claimed.toFixed(2)} cUSD</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Claimable:</span>
                            <span className="ml-2 font-semibold text-green-600">{schedule.claimable.toFixed(2)} cUSD</span>
                          </div>
                        </div>
                        {schedule.claimable > 0 && (
                          <Button 
                            className="w-full"
                            onClick={() => claimVestedTokens(schedule.id)}
                          >
                            Claim {schedule.claimable.toFixed(2)} cUSD
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-6xl mb-4">⏰</div>
                <h3 className="text-xl font-semibold mb-2">No Vesting Schedules</h3>
                <p className="text-gray-600">You don't have any active token vesting schedules.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
