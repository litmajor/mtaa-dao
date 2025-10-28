import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RewardCard } from "@/components/rewards/RewardsCard";
import { Trophy, TrendingUp, Calendar, Gift, Loader2, AlertCircle, Sparkles, Crown, Award } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Reward {
  id: string;
  amount: string;
  currency: string;
  awardedAt: string;
  status: 'pending' | 'claimed' | 'cancelled';
  vestingPeriodDays: number;
  vestingStartDate: string | null;
  claimedAt: string | null;
  rank?: number;
  weekEnding?: string;
}

interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  badge: string;
  referrals: number;
  earnings: number;
}

export default function MyRewards() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("rewards");
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Fetch reward history
  const { data: rewards = [], isLoading: rewardsLoading, error: rewardsError } = useQuery<Reward[]>({
    queryKey: ['/api/referral-rewards/history'],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/referral-rewards/history', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch rewards');
      return res.json();
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch current week's leaderboard
  const { data: leaderboard = [], isLoading: leaderboardLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ['/api/referral-rewards/current-week'],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/referral-rewards/current-week', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      return res.json();
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Claim reward mutation
  const claimMutation = useMutation({
    mutationFn: async (rewardId: string) => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/referral-rewards/claim/${rewardId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to claim reward');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success! 🎉",
        description: `You've claimed ${data.amount} ${data.currency} tokens!`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/referral-rewards/history'] });
      setClaimingId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Claim Failed",
        description: error.message,
        variant: "destructive",
      });
      setClaimingId(null);
    },
  });

  const handleClaim = (rewardId: string) => {
    setClaimingId(rewardId);
    claimMutation.mutate(rewardId);
  };

  // Calculate stats
  const stats = {
    totalEarned: rewards
      .filter(r => r.status === 'claimed')
      .reduce((sum, r) => sum + parseFloat(r.amount), 0),
    pendingRewards: rewards
      .filter(r => r.status === 'pending')
      .reduce((sum, r) => sum + parseFloat(r.amount), 0),
    claimedCount: rewards.filter(r => r.status === 'claimed').length,
    pendingCount: rewards.filter(r => r.status === 'pending').length,
  };

  const userRank = leaderboard.findIndex(entry => entry.id === user?.id) + 1;

  if (rewardsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (rewardsError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load rewards. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] opacity-50">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob" />
          <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000" />
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000" />
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              My Rewards
            </h1>
          </div>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Track your referral rewards, claim vested tokens, and see your ranking on the leaderboard
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white/5 backdrop-blur-xl border-purple-500/20">
            <CardHeader className="pb-3">
              <CardDescription className="text-gray-400">Total Earned</CardDescription>
              <CardTitle className="text-3xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-yellow-400" />
                {stats.totalEarned.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400">MTAA Tokens</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-xl border-purple-500/20">
            <CardHeader className="pb-3">
              <CardDescription className="text-gray-400">Pending Rewards</CardDescription>
              <CardTitle className="text-3xl font-bold text-white flex items-center gap-2">
                <Gift className="w-6 h-6 text-purple-400" />
                {stats.pendingRewards.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400">{stats.pendingCount} rewards vesting</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-xl border-purple-500/20">
            <CardHeader className="pb-3">
              <CardDescription className="text-gray-400">This Week's Rank</CardDescription>
              <CardTitle className="text-3xl font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-green-400" />
                {userRank > 0 ? `#${userRank}` : '-'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400">
                {userRank > 0 && userRank <= 10 ? '🎉 Top 10!' : 'Keep referring!'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-xl border-purple-500/20">
            <CardHeader className="pb-3">
              <CardDescription className="text-gray-400">Claimed Rewards</CardDescription>
              <CardTitle className="text-3xl font-bold text-white flex items-center gap-2">
                <Award className="w-6 h-6 text-blue-400" />
                {stats.claimedCount}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400">All-time claims</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/10 backdrop-blur-xl border border-purple-500/20">
            <TabsTrigger value="rewards" className="data-[state=active]:bg-purple-600">
              <Gift className="w-4 h-4 mr-2" />
              My Rewards
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="data-[state=active]:bg-purple-600">
              <Trophy className="w-4 h-4 mr-2" />
              Current Week
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rewards" className="space-y-4 mt-6">
            {rewards.length === 0 ? (
              <Card className="bg-white/5 backdrop-blur-xl border-purple-500/20 p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <Gift className="w-16 h-16 text-gray-500" />
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">No rewards yet</h3>
                    <p className="text-gray-400">
                      Start referring users to earn weekly MTAA token rewards!
                    </p>
                  </div>
                  <Button 
                    onClick={() => window.location.href = '/referrals'}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    Go to Referrals
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rewards.map(reward => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    onClaim={handleClaim}
                    claiming={claimingId === reward.id}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-6">
            <Card className="bg-white/5 backdrop-blur-xl border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Current Week Leaderboard
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Top 10 referrers compete for weekly MTAA rewards. Distribution happens every Sunday at midnight.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {leaderboardLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                  </div>
                ) : leaderboard.length === 0 ? (
                  <p className="text-center text-gray-400 py-12">No data for this week yet</p>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.map((entry) => (
                      <div
                        key={entry.id}
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          entry.id === user?.id
                            ? 'bg-purple-500/20 border-purple-500/50'
                            : 'bg-white/5 border-white/10'
                        } hover:bg-white/10 transition-colors`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`text-2xl font-bold ${
                            entry.rank === 1 ? 'text-yellow-400' :
                            entry.rank === 2 ? 'text-gray-300' :
                            entry.rank === 3 ? 'text-orange-400' :
                            'text-gray-500'
                          }`}>
                            #{entry.rank}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{entry.name}</p>
                            <p className="text-sm text-gray-400">{entry.referrals} referrals this week</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-white">{entry.earnings.toLocaleString()} MTAA</p>
                          <Badge variant="secondary" className="mt-1">{entry.badge}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

